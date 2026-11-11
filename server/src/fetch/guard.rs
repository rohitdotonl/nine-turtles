//! Telling a site's guard from the site itself (decision 0255).
//!
//! Many sites sit behind a guard against bots (Cloudflare's bot check,
//! Vercel's, Sucuri's, Imperva's, Akamai's, DDoS-Guard's…) that can turn a
//! feed reader away before the site ever sees the request. The reader should
//! know it's the site's guard, not nine turtles and not a broken feed, so the
//! answer is recognised here: first by the headers the guards add, and only
//! for a 403, or a 503 without a time to wait, by a short look at the page
//! they send back. A 429 is never read as a guard by its page: that's a site
//! asking to slow down, which nine turtles obeys.

use reqwest::{StatusCode, header::HeaderMap};

/// How much of a refusal's page is read to recognise a guard's: their pages
/// name themselves near the top.
pub const PAGE_LIMIT: usize = 32 * 1024;

/// Whether the answer's headers say a guard turned the request away. Only
/// headers that guards send when they act, never ones on every answer, so
/// any status counts: Amazon's guard sends its check as a 202.
pub fn says_so(status: StatusCode, headers: &HeaderMap) -> bool {
    if status.is_redirection() {
        return false;
    }
    let has = |name: &str, values: &[&str]| {
        headers
            .get(name)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| values.iter().any(|v| value.eq_ignore_ascii_case(v)))
    };
    has("cf-mitigated", &["challenge"])
        || has("x-vercel-mitigated", &["challenge", "deny"])
        || has("x-amzn-waf-action", &["challenge", "captcha", "block"])
        || headers.contains_key("x-sucuri-block")
}

/// Whether the answer might be a guard's page, worth a short look: a 403, or
/// a 503 that doesn't say how long to wait.
pub fn may_say_so(status: StatusCode, headers: &HeaderMap) -> bool {
    status == StatusCode::FORBIDDEN
        || (status == StatusCode::SERVICE_UNAVAILABLE
            && !headers.contains_key(reqwest::header::RETRY_AFTER))
}

/// Words only a guard's own page carries.
const MARKS: &[&str] = &[
    // Cloudflare: its check ("Just a moment...") and its block page.
    "<title>Just a moment...</title>",
    "/cdn-cgi/challenge-platform/",
    "Attention Required! | Cloudflare",
    "Sorry, you have been blocked",
    "Sucuri WebSite Firewall",
    "Incapsula incident ID",
    "_Incapsula_Resource",
    "errors.edgesuite.net",
    "DDoS-Guard",
    "Vercel Security Checkpoint",
];

/// Whether the start of a refusal's page is a guard's.
pub fn page_says_so(page: &[u8]) -> bool {
    let page = String::from_utf8_lossy(page);
    MARKS.iter().any(|mark| page.contains(mark))
}

#[cfg(test)]
mod tests {
    use reqwest::header::{HeaderName, HeaderValue};

    use super::*;

    fn headers(pairs: &[(&'static str, &'static str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.insert(
                HeaderName::from_static(name),
                HeaderValue::from_static(value),
            );
        }
        map
    }

    #[test]
    fn a_guards_own_headers_say_so() {
        let forbidden = StatusCode::FORBIDDEN;
        assert!(says_so(
            forbidden,
            &headers(&[("cf-mitigated", "challenge")])
        ));
        assert!(says_so(
            StatusCode::TOO_MANY_REQUESTS,
            &headers(&[("x-vercel-mitigated", "challenge")])
        ));
        assert!(says_so(
            StatusCode::ACCEPTED,
            &headers(&[("x-amzn-waf-action", "challenge")])
        ));
        assert!(says_so(forbidden, &headers(&[("x-sucuri-block", "1")])));
        // A plain refusal, or a header every answer carries, isn't a guard.
        assert!(!says_so(forbidden, &headers(&[("server", "cloudflare")])));
        assert!(!says_so(
            StatusCode::OK,
            &headers(&[("server", "cloudflare")])
        ));
    }

    #[test]
    fn only_a_403_or_a_503_without_a_time_is_read() {
        assert!(may_say_so(StatusCode::FORBIDDEN, &HeaderMap::new()));
        assert!(may_say_so(
            StatusCode::SERVICE_UNAVAILABLE,
            &HeaderMap::new()
        ));
        assert!(!may_say_so(
            StatusCode::SERVICE_UNAVAILABLE,
            &headers(&[("retry-after", "60")])
        ));
        assert!(!may_say_so(
            StatusCode::TOO_MANY_REQUESTS,
            &HeaderMap::new()
        ));
        assert!(!may_say_so(StatusCode::NOT_FOUND, &HeaderMap::new()));
    }

    #[test]
    fn a_guards_page_names_itself() {
        let check = b"<!DOCTYPE html><html><head><title>Just a moment...</title>";
        assert!(page_says_so(check));
        assert!(page_says_so(
            b"<title>Attention Required! | Cloudflare</title>"
        ));
        assert!(!page_says_so(
            b"<h1>Forbidden</h1><p>You don't have permission.</p>"
        ));
        assert!(!page_says_so(b""));
    }
}
