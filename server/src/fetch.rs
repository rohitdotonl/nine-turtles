//! Downloading from publishers' websites, politely and safely (DESIGN.md →
//! "The second floor", ENGINEERING.md → "Fetching feeds").
//!
//! - slowfeed says who it is, asks for compressed files, gives up after a
//!   time limit and refuses anything bigger than a size limit.
//! - Redirects are followed by hand, so slowfeed knows whether a feed has
//!   moved for good (301, 308) and can remember its new address.
//! - Only addresses on the public internet are visited. A pasted address that
//!   points inside the host's private network, or at this computer, is refused,
//!   so nobody can use slowfeed to look at things that should be unreachable.
//!   The check happens after the name is looked up, so a public-looking name
//!   that leads somewhere private is refused too.
//! - When checking a feed again, it says what it already has (ETag and
//!   Last-Modified), so an unchanged feed costs the publisher almost nothing,
//!   and it listens when a publisher asks it to slow down.

use std::{
    net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr},
    time::Duration,
};

use reqwest::{
    Client, StatusCode, Url,
    dns::{Addrs, Name, Resolve, Resolving},
    header::{self, HeaderMap, HeaderValue},
    redirect,
};

/// How slowfeed introduces itself to every website.
pub const USER_AGENT: &str = concat!(
    "slowfeed/",
    env!("CARGO_PKG_VERSION"),
    " (+https://github.com/rohitdotonl/slowfeed)"
);
/// The longest slowfeed waits for one download, start to finish.
const TIME_LIMIT: Duration = Duration::from_secs(20);
const CONNECT_LIMIT: Duration = Duration::from_secs(10);
/// The biggest file slowfeed accepts. Real feeds and home pages are far
/// smaller; this only stops a broken or hostile site from filling the disk.
pub const SIZE_LIMIT: usize = 5 * 1024 * 1024;
/// Redirects followed before giving up.
const REDIRECT_LIMIT: usize = 5;

const ACCEPT: &str = "application/rss+xml, application/atom+xml, application/feed+json, \
    application/xml;q=0.9, text/xml;q=0.9, application/json;q=0.8, text/html;q=0.7, */*;q=0.5";

/// What a download brought back.
#[derive(Debug)]
pub struct Fetched {
    /// Where the file was found, after any redirects.
    pub final_url: Url,
    /// The address to remember for next time: the new one if every redirect
    /// on the way said "moved for good", otherwise the one asked for.
    pub lasting_url: Url,
    pub content_type: String,
    pub body: Vec<u8>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
}

/// What slowfeed already has of a feed, from the publisher's last answer.
#[derive(Debug, Default)]
pub struct Known<'a> {
    pub etag: Option<&'a str>,
    pub last_modified: Option<&'a str>,
}

/// A check of a feed slowfeed already has.
#[derive(Debug)]
pub enum Answer {
    Changed(Fetched),
    /// "Nothing new" (304). `lasting_url` is as in [`Fetched`].
    Unchanged {
        lasting_url: Url,
    },
}

#[derive(Debug, PartialEq, Eq)]
pub enum FetchError {
    /// The address points somewhere slowfeed never visits (a private network,
    /// this computer, or not a web address at all).
    NotAllowed,
    /// No answer, a broken connection, too slow, or too many redirects.
    Unreachable,
    /// The site answered with an error, such as 404 "not found".
    Status(u16),
    TooBig,
    /// The publisher asked slowfeed to slow down (429, or 503 with a time):
    /// wait this many seconds, if they said.
    SlowDown(Option<i64>),
}

/// Builds the one downloader slowfeed uses. `local_allowed` lets the tests
/// serve made-up feeds from this computer; it's never set on the live app.
/// If it can't be built, slowfeed doesn't start: a plain downloader without
/// the limits and the private-address check must never stand in for it.
pub fn client(local_allowed: bool) -> Result<Client, String> {
    let mut headers = HeaderMap::new();
    headers.insert(header::ACCEPT, HeaderValue::from_static(ACCEPT));
    let builder = Client::builder()
        .user_agent(USER_AGENT)
        .default_headers(headers)
        .timeout(TIME_LIMIT)
        .connect_timeout(CONNECT_LIMIT)
        .redirect(redirect::Policy::none());
    let builder = if local_allowed {
        builder
    } else {
        builder.dns_resolver(PublicOnly)
    };
    builder
        .build()
        .map_err(|error| format!("can't set up the downloader for feeds: {error}"))
}

/// Downloads one address, following up to five redirects.
pub async fn get(client: &Client, url: &Url, local_allowed: bool) -> Result<Fetched, FetchError> {
    match check(client, url, local_allowed, &Known::default()).await? {
        Answer::Changed(fetched) => Ok(fetched),
        // Only an answer to "anything new?" can be "nothing new", and `get` never asks.
        Answer::Unchanged { .. } => Err(FetchError::Unreachable),
    }
}

/// Downloads a feed again, telling the publisher what slowfeed already has,
/// so an unchanged feed can answer "nothing new" in a few bytes.
pub async fn check(
    client: &Client,
    url: &Url,
    local_allowed: bool,
    known: &Known<'_>,
) -> Result<Answer, FetchError> {
    let mut current = url.clone();
    let mut lasting = url.clone();
    let mut moved_for_good = true;

    for _ in 0..=REDIRECT_LIMIT {
        if !allowed(&current, local_allowed) {
            return Err(FetchError::NotAllowed);
        }
        let mut request = client.get(current.clone());
        if let Some(etag) = known.etag {
            request = request.header(header::IF_NONE_MATCH, etag);
        }
        if let Some(date) = known.last_modified {
            request = request.header(header::IF_MODIFIED_SINCE, date);
        }
        let response = request.send().await.map_err(|error| {
            if is_refused_address(&error) {
                FetchError::NotAllowed
            } else {
                FetchError::Unreachable
            }
        })?;
        let status = response.status();

        if status.is_redirection() && status != StatusCode::NOT_MODIFIED {
            let next = response
                .headers()
                .get(header::LOCATION)
                .and_then(|value| value.to_str().ok())
                .and_then(|location| current.join(location).ok())
                .ok_or(FetchError::Unreachable)?;
            let permanent = matches!(
                status,
                StatusCode::MOVED_PERMANENTLY | StatusCode::PERMANENT_REDIRECT
            );
            moved_for_good &= permanent;
            if moved_for_good {
                lasting = next.clone();
            }
            current = next;
            continue;
        }
        if status == StatusCode::NOT_MODIFIED {
            return Ok(Answer::Unchanged {
                lasting_url: lasting,
            });
        }
        let retry_after = response
            .headers()
            .get(header::RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| seconds_to_wait(value, crate::now()));
        if status == StatusCode::TOO_MANY_REQUESTS
            || (status == StatusCode::SERVICE_UNAVAILABLE && retry_after.is_some())
        {
            return Err(FetchError::SlowDown(retry_after));
        }
        if !status.is_success() {
            return Err(FetchError::Status(status.as_u16()));
        }

        let text = |name| {
            response
                .headers()
                .get(name)
                .and_then(|value: &HeaderValue| value.to_str().ok())
                .map(str::to_owned)
        };
        let content_type = text(header::CONTENT_TYPE).unwrap_or_default();
        let etag = text(header::ETAG);
        let last_modified = text(header::LAST_MODIFIED);
        let body = read_limited(response).await?;
        return Ok(Answer::Changed(Fetched {
            final_url: current,
            lasting_url: lasting,
            content_type,
            body,
            etag,
            last_modified,
        }));
    }
    Err(FetchError::Unreachable)
}

/// A `Retry-After` answer as seconds from `now`: either a number of seconds
/// or a date (`Wed, 21 Oct 2026 07:28:00 GMT`, the one form the web standard
/// asks publishers to use). Anything else is ignored.
pub fn seconds_to_wait(value: &str, now: i64) -> Option<i64> {
    let value = value.trim();
    if let Ok(seconds) = value.parse::<i64>() {
        return (seconds >= 0).then_some(seconds);
    }
    http_date(value).map(|at| (at - now).max(0))
}

/// Seconds since 1970 for a date like `Wed, 21 Oct 2026 07:28:00 GMT`.
fn http_date(value: &str) -> Option<i64> {
    const MONTHS: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    let mut parts = value.split_whitespace();
    let _weekday = parts.next()?;
    let day: i64 = parts.next()?.parse().ok()?;
    let month = parts.next()?;
    let month = i64::try_from(MONTHS.iter().position(|name| *name == month)?).ok()? + 1;
    let year: i64 = parts.next()?.parse().ok()?;
    let mut clock = parts.next()?.split(':').map(str::parse::<i64>);
    let (hour, minute, second) = (
        clock.next()?.ok()?,
        clock.next()?.ok()?,
        clock.next()?.ok()?,
    );
    if parts.next()? != "GMT" || !(1..=31).contains(&day) || hour > 23 || minute > 59 || second > 60
    {
        return None;
    }
    // Days since 1970 for a calendar date (Howard Hinnant's well-known method).
    let shifted = if month <= 2 { year - 1 } else { year };
    let era = shifted.div_euclid(400);
    let year_of_era = shifted - era * 400;
    let day_of_year = (153 * ((month + 9) % 12) + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    let days = era * 146_097 + day_of_era - 719_468;
    Some(days * 86_400 + hour * 3_600 + minute * 60 + second)
}

/// Reads the body bit by bit, stopping as soon as it passes the size limit,
/// so a huge file is never held whole.
async fn read_limited(mut response: reqwest::Response) -> Result<Vec<u8>, FetchError> {
    if response
        .content_length()
        .is_some_and(|length| length > SIZE_LIMIT as u64)
    {
        return Err(FetchError::TooBig);
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| FetchError::Unreachable)?
    {
        if body.len() + chunk.len() > SIZE_LIMIT {
            return Err(FetchError::TooBig);
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

/// Only ordinary web addresses. A written-out number address (such as
/// `http://10.0.0.1/`) skips the name lookup, so it's checked here instead.
fn allowed(url: &Url, local_allowed: bool) -> bool {
    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    if local_allowed {
        return true;
    }
    // Number addresses for IPv6 are written in brackets, as in `http://[::1]/`.
    match host.trim_start_matches('[').trim_end_matches(']').parse() {
        Ok(ip) => is_public(ip),
        Err(_) => {
            let name = host.trim_end_matches('.');
            !(name.eq_ignore_ascii_case("localhost")
                || name.to_ascii_lowercase().ends_with(".localhost"))
        }
    }
}

/// Looks names up as usual, then keeps only public addresses.
struct PublicOnly;

/// The message the lookup gives when every address was private, so `get`
/// can tell "not allowed" apart from "no answer".
const REFUSED: &str = "slowfeed doesn't visit private addresses";

impl Resolve for PublicOnly {
    fn resolve(&self, name: Name) -> Resolving {
        let host = name.as_str().to_owned();
        Box::pin(async move {
            let found: Vec<SocketAddr> =
                tokio::net::lookup_host((host.as_str(), 0)).await?.collect();
            let public: Vec<SocketAddr> = found
                .iter()
                .copied()
                .filter(|address| is_public(address.ip()))
                .collect();
            if public.is_empty() && !found.is_empty() {
                return Err(REFUSED.into());
            }
            let addresses: Addrs = Box::new(public.into_iter());
            Ok(addresses)
        })
    }
}

fn is_refused_address(error: &reqwest::Error) -> bool {
    let mut source: Option<&dyn std::error::Error> = Some(error);
    while let Some(current) = source {
        if current.to_string().contains(REFUSED) {
            return true;
        }
        source = current.source();
    }
    false
}

/// Whether an address is on the public internet: not this computer, not a
/// private or shared network, not reserved for special uses.
pub fn is_public(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_public_v4(ip),
        IpAddr::V6(ip) => match ip.to_ipv4_mapped() {
            Some(v4) => is_public_v4(v4),
            None => is_public_v6(ip),
        },
    }
}

fn is_public_v4(ip: Ipv4Addr) -> bool {
    let [a, b, c, _] = ip.octets();
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_private()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_multicast()
        || a == 0
        // Shared by internet providers (100.64.0.0/10).
        || (a == 100 && (64..128).contains(&b))
        // Reserved for protocol tests and benchmarks.
        || (a == 192 && b == 0 && c == 0)
        || (a == 198 && (b == 18 || b == 19))
        || a >= 240)
}

fn is_public_v6(ip: Ipv6Addr) -> bool {
    let first = ip.segments()[0];
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_multicast()
        // Private (fc00::/7) and link-local (fe80::/10) networks.
        || (first & 0xfe00) == 0xfc00
        || (first & 0xffc0) == 0xfe80
        // Documentation examples (2001:db8::/32).
        || (first == 0x2001 && ip.segments()[1] == 0x0db8))
        && embedded_v4(ip).is_none_or(is_public_v4)
}

/// The IPv4 address hidden inside an IPv6 one by the two ways of carrying
/// one over the other (NAT64, 64:ff9b::/96, and 6to4, 2002::/16), so a
/// private address can't slip through in disguise.
fn embedded_v4(ip: Ipv6Addr) -> Option<Ipv4Addr> {
    let segments = ip.segments();
    let pair = |high: u16, low: u16| {
        let [a, b] = high.to_be_bytes();
        let [c, d] = low.to_be_bytes();
        Ipv4Addr::new(a, b, c, d)
    };
    if segments[..6] == [0x64, 0xff9b, 0, 0, 0, 0] {
        return Some(pair(segments[6], segments[7]));
    }
    (segments[0] == 0x2002).then(|| pair(segments[1], segments[2]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn private_and_special_addresses_are_never_visited() {
        for address in [
            "127.0.0.1",
            "10.1.2.3",
            "172.16.0.1",
            "192.168.1.1",
            "169.254.169.254",
            "100.64.0.1",
            "0.0.0.0",
            "::1",
            "fd00::1",
            "fe80::1",
            "::ffff:127.0.0.1",
            "::ffff:10.0.0.1",
            "64:ff9b::7f00:1",
            "64:ff9b::a9fe:a9fe",
            "2002:c0a8:101::1",
        ] {
            assert!(!is_public(address.parse().unwrap()), "{address}");
        }
        for address in [
            "93.184.215.14",
            "1.1.1.1",
            "2606:4700::1111",
            "64:ff9b::101:101",
        ] {
            assert!(is_public(address.parse().unwrap()), "{address}");
        }
    }

    #[tokio::test]
    async fn a_name_that_leads_to_this_computer_is_refused() {
        // The same check runs on every redirect, since each one is looked up
        // through this resolver again.
        let name: Name = "localhost".parse().unwrap();
        let refused = PublicOnly.resolve(name).await.err().unwrap();
        assert!(refused.to_string().contains(REFUSED));
    }

    #[test]
    fn a_publishers_slow_down_is_read_as_seconds_or_a_date() {
        let now = 1_792_567_680; // Wed, 21 Oct 2026 07:28:00 GMT
        assert_eq!(seconds_to_wait("120", now), Some(120));
        assert_eq!(seconds_to_wait(" 3600 ", now), Some(3600));
        assert_eq!(
            seconds_to_wait("Wed, 21 Oct 2026 09:28:00 GMT", now),
            Some(7200)
        );
        assert_eq!(
            seconds_to_wait("Thu, 01 Jan 1970 00:00:00 GMT", now),
            Some(0)
        );
        assert_eq!(
            http_date("Sun, 06 Nov 1994 08:49:37 GMT"),
            Some(784_111_777)
        );
        assert_eq!(seconds_to_wait("-5", now), None);
        assert_eq!(seconds_to_wait("soon", now), None);
        assert_eq!(seconds_to_wait("Wed, 21 Oct 2026 07:28:00 PST", now), None);
    }

    #[test]
    fn only_ordinary_web_addresses_are_allowed() {
        let check = |text: &str| allowed(&Url::parse(text).unwrap(), false);
        assert!(check("https://example.com/feed"));
        assert!(check("http://93.184.215.14/"));
        assert!(!check("http://127.0.0.1:8080/"));
        assert!(!check("http://[::1]/"));
        assert!(!check("http://localhost/"));
        assert!(!check("file:///etc/passwd"));
        assert!(!check("ftp://example.com/"));
    }
}
