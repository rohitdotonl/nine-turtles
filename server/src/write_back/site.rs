//! Looking on a writer's own site for their address (SPEC section 37,
//! decision 0168): the one visit the second floor allows for Write back.
//!
//! When the reader presses Write back and nine turtles knows no address for
//! the person, the web app asks here, and nine turtles visits their site
//! once: the home page, and, if that gives no address, one contact or about
//! page it links to. Never an article's page, never in the background, and
//! never twice for the same writer: what was found, or that nothing was, is
//! kept on the feed (`feeds.site_looked_at`, `site_email`), for everyone who
//! follows it, once the visit is over. A site that doesn't answer in time
//! isn't counted as looked, so a later press can try again; one that answers
//! with an error (or "slow down") is, and is never asked again.
//!
//! What's found only fills in the reader's field: they check it and press
//! Write back themselves, since a page can show someone else's address too.

use std::time::Duration;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
};
use reqwest::{Client, Url};
use scraper::{ElementRef, Html, Selector};
use serde_json::json;

use super::worth_writing_to;
use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    fetch::{self, FetchError},
    refused,
};

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/feeds/{id}/look-for-address", post(look))
}

/// The longest the whole visit may take, both pages together: the reader
/// is waiting, so after this the box asks them instead.
const LOOKING_FOR: Duration = Duration::from_secs(8);

/// One place of the reader's person, as kept: its site, and whether that
/// site was looked on, and what it gave.
#[derive(sqlx::FromRow)]
struct Place {
    id: i64,
    site_url: Option<String>,
    site_looked_at: Option<i64>,
    site_email: Option<String>,
    /// Its newest article's link, for the home page when the feed names no site.
    newest_link: Option<String>,
}

/// `POST /api/feeds/3/look-for-address`: the address the writer's site
/// gives, for the person place 3 belongs to, as `{"address": … or null,
/// "looked": whether nine turtles looked}`.
/// Visits their site only if no place of theirs was looked on before.
/// Refused as `not-found` when the reader doesn't follow place 3.
async fn look(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let places: Result<Vec<Place>, sqlx::Error> = sqlx::query_as(
        "SELECT feeds.id, feeds.site_url, feeds.site_looked_at, feeds.site_email,
             (SELECT link FROM articles WHERE articles.feed_id = feeds.id AND link IS NOT NULL
                  ORDER BY sort_at DESC LIMIT 1) AS newest_link
         FROM subscriptions JOIN feeds ON feeds.id = subscriptions.feed_id
         WHERE subscriptions.person_id = ?1 AND subscriptions.unsubscribed_at IS NULL
             AND (subscriptions.feed_id = ?2 OR subscriptions.writer_id = (SELECT writer_id
                      FROM subscriptions WHERE person_id = ?1 AND feed_id = ?2
                          AND unsubscribed_at IS NULL))
         ORDER BY subscriptions.feed_id = ?2 DESC, feeds.id",
    )
    .bind(person)
    .bind(id)
    .fetch_all(&state.db)
    .await;
    let places = match places {
        Ok(places) => places,
        Err(error) => return database_problem("finding where to look for an address", &error),
    };
    let Some(place) = places.first() else {
        return refused(StatusCode::NOT_FOUND, "not-found");
    };
    // Never twice for the same writer: any of their places looked on before answers.
    if places.iter().any(|place| place.site_looked_at.is_some()) {
        return answer(places.into_iter().find_map(|place| place.site_email), true);
    }
    let Some(home) = home_of(place) else {
        return answer(None, false);
    };
    let place = place.id;
    // One visit at a time for a feed: a second press meanwhile is told nine turtles hasn't looked yet.
    if !state
        .site_visits
        .lock()
        .is_ok_and(|mut visiting| visiting.insert(place))
    {
        return answer(None, false);
    }
    // In a task of its own, so a reader leaving mid-visit doesn't cut it short.
    let (db, http, local) = (
        state.db.clone(),
        state.http.clone(),
        state.config.local_feeds_allowed,
    );
    let visits = state.site_visits.clone();
    let task = tokio::spawn(async move {
        let visited = tokio::time::timeout(LOOKING_FOR, visit(&http, &home, local)).await;
        let found = match visited {
            Ok(Ok(found)) => Some(found),
            // Their site answered, but with an error or "slow down": looked, nothing found.
            Ok(Err(
                FetchError::Status(_)
                | FetchError::TooBig
                | FetchError::SlowDown(_)
                | FetchError::NotAllowed,
            )) => Some(None),
            // It didn't answer, or not in time: not looked, so a later press tries again.
            Ok(Err(FetchError::Unreachable)) | Err(_) => None,
        };
        // Kept only once the visit is over, so a visit cut off by a restart counts as never made.
        let kept = match &found {
            Some(address) => sqlx::query(
                "UPDATE feeds SET site_looked_at = ?1, site_email = ?2 WHERE id = ?3 AND site_looked_at IS NULL",
            )
            .bind(crate::now())
            .bind(address)
            .bind(place)
            .execute(&db)
            .await
            .map(|_| ()),
            None => Ok(()),
        };
        if let Ok(mut visiting) = visits.lock() {
            visiting.remove(&place);
        }
        kept.map(|()| found)
    });
    match task.await {
        Ok(Ok(Some(found))) => answer(found, true),
        Ok(Ok(None)) => answer(None, false),
        Ok(Err(error)) => database_problem("keeping what a writer's site gave", &error),
        Err(_) => answer(None, false),
    }
}

/// What the site gave, and whether nine turtles has looked there at all
/// (it hasn't while another visit is under way, or when the site didn't answer).
fn answer(address: Option<String>, looked: bool) -> Response {
    Json(json!({ "address": address, "looked": looked })).into_response()
}

/// Where the writer's site starts: the site their feed names, else the home
/// page of their newest article's site (never the article itself).
fn home_of(place: &Place) -> Option<Url> {
    let web = |address: &str| {
        Url::parse(address)
            .ok()
            .filter(|url| matches!(url.scheme(), "http" | "https") && url.host().is_some())
    };
    place.site_url.as_deref().and_then(web).or_else(|| {
        let mut home = place.newest_link.as_deref().and_then(web)?;
        home.set_path("/");
        home.set_query(None);
        home.set_fragment(None);
        Some(home)
    })
}

/// The visit itself: the home page, then, if it gives no address, the one
/// contact or about page it links to. `Err` only when the home page didn't
/// answer; anything after that is "nothing found".
async fn visit(client: &Client, home: &Url, local: bool) -> Result<Option<String>, FetchError> {
    let Some((page, site)) = page_at(client, home, local).await? else {
        return Ok(None);
    };
    let read = read(&page, &site);
    if let Some(found) = choose(&read.addresses, &site) {
        return Ok(Some(found));
    }
    let Some(next) = read.next else {
        return Ok(None);
    };
    Ok(match page_at(client, &next, local).await {
        Ok(Some((page, _))) => choose(&addresses_in(&Html::parse_document(&page)), &site),
        _ => None,
    })
}

/// A web page's text and where it was found; `None` for anything that isn't a web page.
async fn page_at(
    client: &Client,
    url: &Url,
    local: bool,
) -> Result<Option<(String, Url)>, FetchError> {
    let fetched = fetch::get(client, url, local).await?;
    let kind = fetched.content_type.to_ascii_lowercase();
    let html = kind.is_empty() || kind.contains("html");
    Ok(html.then(|| {
        (
            String::from_utf8_lossy(&fetched.body).into_owned(),
            fetched.final_url,
        )
    }))
}

/// What one page gives: its addresses, in order, and the page to try next.
struct Read {
    addresses: Vec<String>,
    next: Option<Url>,
}

fn read(page: &str, at: &Url) -> Read {
    let document = Html::parse_document(page);
    Read {
        addresses: addresses_in(&document),
        next: next_page(&document, at),
    }
}

/// Every address a page shows, in order, without repeats: its `mailto:`
/// links, the ones Cloudflare's "email protection" hides, and addresses
/// written out in its text. Never one only sent from ("no-reply").
fn addresses_in(document: &Html) -> Vec<String> {
    let mut found: Vec<String> = Vec::new();
    let mut keep = |raw: &str| {
        if let Some(address) = worth_writing_to(raw).map(|address| address.to_lowercase())
            && !found.contains(&address)
        {
            found.push(address);
        }
    };
    let links = Selector::parse("a[href]").expect("a fixed, valid selector");
    for link in document.select(&links) {
        let href = link.value().attr("href").unwrap_or_default().trim();
        if href
            .get(..7)
            .is_some_and(|start| start.eq_ignore_ascii_case("mailto:"))
        {
            keep(href);
        } else if let Some((_, hidden)) = href.split_once("/cdn-cgi/l/email-protection#") {
            keep(&unhide(hidden).unwrap_or_default());
        }
    }
    let hidden = Selector::parse("[data-cfemail]").expect("a fixed, valid selector");
    for element in document.select(&hidden) {
        keep(&unhide(element.value().attr("data-cfemail").unwrap_or_default()).unwrap_or_default());
    }
    for text in shown_text(document) {
        for word in text.split(|c: char| c.is_whitespace() || "<>()[]{},;:\"'`|/\\".contains(c)) {
            let word = word.trim_matches(|c: char| c == '.' || c == '!' || c == '?');
            if word.contains('@') && !names_a_file(word) {
                keep(word);
            }
        }
    }
    found
}

/// The page's text a reader sees: not its scripts or styles.
fn shown_text(document: &Html) -> Vec<String> {
    document
        .root_element()
        .descendants()
        .filter_map(|node| {
            let text = node.value().as_text()?;
            let hidden = node
                .ancestors()
                .filter_map(ElementRef::wrap)
                .any(|element| {
                    matches!(
                        element.value().name(),
                        "script" | "style" | "template" | "noscript"
                    )
                });
            (!hidden).then(|| text.to_string())
        })
        .collect()
}

/// "logo@2x.png" is a picture's name, not an address.
fn names_a_file(word: &str) -> bool {
    let ending = word
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();
    [
        "png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "css", "js",
    ]
    .contains(&ending.as_str())
}

/// Cloudflare's hidden address: hex, its first byte the key the rest is
/// turned with.
fn unhide(hex: &str) -> Option<String> {
    let bytes = crate::encoding::from_hex(hex.get(..hex.len().min(600))?)?;
    let (key, rest) = bytes.split_first()?;
    String::from_utf8(rest.iter().map(|byte| byte ^ key).collect()).ok()
}

/// The writer's address among a page's: one at their own site's name wins
/// ("hal@hal.example" on hal.example or blog.hal.example, never a platform's
/// own on a blog it hosts, as "support@" a host's name is on
/// "hal.host.example"); else the page's only one. Several
/// others may be anyone's, so none is chosen.
fn choose(addresses: &[String], site: &Url) -> Option<String> {
    let host = bare(site.host_str().unwrap_or_default());
    addresses
        .iter()
        .find(|address| {
            let domain = bare(address.rsplit('@').next().unwrap_or_default());
            !domain.is_empty() && (host == domain || host == format!("blog.{domain}"))
        })
        .or_else(|| (addresses.len() == 1).then(|| &addresses[0]))
        .cloned()
}

fn bare(host: &str) -> String {
    let host = host.to_ascii_lowercase();
    host.strip_prefix("www.").map(str::to_owned).unwrap_or(host)
}

/// The words and addresses that make a link a contact page's, then an about page's.
const CONTACT: &[&str] = &[
    "contact",
    "get in touch",
    "say hello",
    "say hi",
    "email me",
    "write to me",
    "kontakt",
    "contacto",
];
const ABOUT: &[&str] = &["about", "who am i", "colophon"];

/// The one page to try after the home page: a contact page it links to on
/// the same site, else an about page.
fn next_page(document: &Html, at: &Url) -> Option<Url> {
    let links = Selector::parse("a[href]").expect("a fixed, valid selector");
    let host = bare(at.host_str().unwrap_or_default());
    let mut about = None;
    for link in document.select(&links) {
        let Some(url) = link
            .value()
            .attr("href")
            .and_then(|href| at.join(href.trim()).ok())
        else {
            continue;
        };
        if !matches!(url.scheme(), "http" | "https")
            || bare(url.host_str().unwrap_or_default()) != host
            || url.path() == at.path()
        {
            continue;
        }
        let words = link
            .text()
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .to_lowercase();
        // A post's own address is deeper ("/2026/about-face"), so only a short one counts.
        let parts: Vec<&str> = url
            .path()
            .split('/')
            .filter(|part| !part.is_empty())
            .collect();
        // Counted from the home page's own place, for a site that lives inside a bigger one.
        let home = at.path().split('/').filter(|part| !part.is_empty()).count();
        let below = if url.path().starts_with(at.path()) {
            parts.len().saturating_sub(home)
        } else {
            parts.len()
        };
        let path = match parts.as_slice() {
            [.., last] if below <= 2 => last
                .trim_end_matches(".html")
                .trim_end_matches(".php")
                .to_lowercase(),
            _ => String::new(),
        };
        // Whole words only: "About me" is an about page, "About time" a post.
        let says = |list: &[&str]| {
            list.iter().any(|said| {
                let dashed = said.replace(' ', "-");
                [String::new(), " me".to_owned(), " us".to_owned()]
                    .iter()
                    .any(|end| {
                        words == format!("{said}{end}")
                            || path == format!("{dashed}{}", end.replace(' ', "-"))
                    })
            })
        };
        if says(CONTACT) {
            return Some(url);
        }
        if about.is_none() && says(ABOUT) {
            about = Some(url);
        }
    }
    about
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at() -> Url {
        Url::parse("https://www.hal.example/").unwrap()
    }

    #[test]
    fn a_mailto_link_on_the_page_gives_its_address() {
        let page = r#"<html><body><p>Hi, I'm Hal. <a href="mailto:Hal@Hal.example?subject=Hello">Email</a></p></body></html>"#;
        let read = read(page, &at());
        assert_eq!(
            choose(&read.addresses, &at()).as_deref(),
            Some("hal@hal.example")
        );
    }

    #[test]
    fn an_address_written_out_or_hidden_by_cloudflare_counts() {
        let page =
            "<p>Write to me at hal@hal.example.</p><script>var x='bot@tracker.example'</script>";
        assert_eq!(read(page, &at()).addresses, ["hal@hal.example"]);
        // "hal@hal.example" turned with the key 0x42.
        let hidden: String = std::iter::once(0x42u8)
            .chain("hal@hal.example".bytes().map(|byte| byte ^ 0x42))
            .map(|byte| format!("{byte:02x}"))
            .collect();
        let page =
            format!(r#"<a href="/cdn-cgi/l/email-protection#{hidden}">[email protected]</a>"#);
        assert_eq!(read(&page, &at()).addresses, ["hal@hal.example"]);
    }

    #[test]
    fn the_writers_own_domain_wins_and_several_others_give_none() {
        let site = at();
        let mine = [
            "theme@maker.example".to_owned(),
            "hal@hal.example".to_owned(),
        ];
        assert_eq!(choose(&mine, &site).as_deref(), Some("hal@hal.example"));
        let others = ["a@one.example".to_owned(), "b@two.example".to_owned()];
        assert_eq!(choose(&others, &site), None);
        let hosted = Url::parse("https://hal.host.example/").unwrap();
        let platform = [
            "support@host.example".to_owned(),
            "hal@hal.example".to_owned(),
        ];
        assert_eq!(choose(&platform, &hosted), None);
        let one = ["hal.writes@gmail.example".to_owned()];
        assert_eq!(
            choose(&one, &site).as_deref(),
            Some("hal.writes@gmail.example")
        );
    }

    #[test]
    fn pictures_and_no_reply_addresses_are_never_addresses() {
        let page = r#"<img src="logo@2x.png"><p>logo@2x.png</p><a href="mailto:no-reply@hal.example">x</a>"#;
        assert!(read(page, &at()).addresses.is_empty());
    }

    #[test]
    fn a_contact_page_is_tried_before_an_about_page_and_only_on_the_same_site() {
        let page = r#"<a href="https://elsewhere.example/contact">Contact</a>
            <a href="/about/">About me</a><a href="/contact-me">Get in touch</a>"#;
        assert_eq!(
            read(page, &at()).next.unwrap().as_str(),
            "https://www.hal.example/contact-me"
        );
        let page = r#"<a href="/posts/1">A post</a><a href="https://hal.example/about">About</a>"#;
        assert_eq!(
            read(page, &at()).next.unwrap().as_str(),
            "https://hal.example/about"
        );
        assert!(
            read(r#"<a href="/posts/1">A post</a>"#, &at())
                .next
                .is_none()
        );
    }

    #[test]
    fn the_home_page_is_the_sites_never_the_articles() {
        let place = |site: Option<&str>, link: Option<&str>| Place {
            id: 1,
            site_url: site.map(str::to_owned),
            site_looked_at: None,
            site_email: None,
            newest_link: link.map(str::to_owned),
        };
        let home = |p: &Place| home_of(p).map(|url| url.to_string());
        assert_eq!(
            home(&place(Some("https://hal.example/blog"), None)).as_deref(),
            Some("https://hal.example/blog")
        );
        assert_eq!(
            home(&place(None, Some("https://hal.example/2026/tea?x=1#y"))).as_deref(),
            Some("https://hal.example/")
        );
        assert_eq!(home(&place(Some("javascript:alert(1)"), None)), None);
    }
}
