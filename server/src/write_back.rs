//! Writing back (SPEC section 37, decision 0147): the address a reader
//! writes to a person at. nine turtles only fills in the reader's own email
//! app (a `mailto:` link, made by the web app); it never sends or reads that
//! email.
//!
//! The address comes from two places. The publisher's, kept on the feed for
//! everyone who follows it (`feeds.email`): a feed's own author or editor
//! (`from_feed`), or a newsletter's Reply-To or From address (`newsletter`).
//! An address made only to send from ("no-reply") is never kept. And the
//! reader's own (`subscriptions.write_to`), typed once when neither had one,
//! or in Edit on their page: it wins, and is kept on every place of the person, so
//! it stays with them.

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
};
use feed_rs::model::{Feed, Person};
use serde::Deserialize;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    refused,
};

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/feeds/{id}/write-to", post(set_address))
}

/// The longest address there is (RFC 5321's path limit, less its brackets).
const LONGEST: usize = 254;

/// An email address, written one way: trimmed, without `mailto:` or anything
/// after a `?`, the part after the @ in lowercase. `None` unless it looks
/// like one address someone could write to: one @, something before it, and
/// a website's name after it, with no spaces or the characters that would
/// make it two addresses or none.
pub fn address(raw: &str) -> Option<String> {
    let raw = raw.trim();
    let raw = match raw.get(..7) {
        Some(start) if start.eq_ignore_ascii_case("mailto:") => &raw[7..],
        _ => raw,
    };
    let raw = raw.split('?').next().unwrap_or_default().trim();
    let (local, domain) = raw.split_once('@')?;
    let local_fits = !local.is_empty()
        && local.len() <= 64
        && !local.starts_with('.')
        && !local.ends_with('.')
        && local
            .chars()
            .all(|c| !c.is_whitespace() && !c.is_control() && !"<>()[]\\,;:@\"".contains(c));
    let domain_fits = domain.contains('.')
        && !domain.starts_with(['.', '-'])
        && !domain.ends_with(['.', '-'])
        && !domain.contains("..")
        && domain
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '.');
    (local_fits && domain_fits && raw.len() <= LONGEST)
        .then(|| format!("{local}@{}", domain.to_lowercase()))
}

/// An address a publisher gave that a reply would reach: not one made only
/// to send from ("no-reply@", "donotreply@", a mail system's own).
pub fn worth_writing_to(raw: &str) -> Option<String> {
    let found = address(raw)?;
    let local: String = found
        .split('@')
        .next()
        .unwrap_or_default()
        .to_lowercase()
        .chars()
        .filter(char::is_ascii_alphanumeric)
        .collect();
    let sends_only = [
        "noreply",
        "donotreply",
        "mailerdaemon",
        "bounce",
        "postmaster",
    ]
    .iter()
    .any(|word| local.contains(word));
    (!sends_only).then_some(found)
}

/// One person's address in a feed: their email, or a JSON Feed's
/// `mailto:` link.
fn of_person(person: &Person) -> Option<String> {
    person
        .email
        .as_deref()
        .and_then(worth_writing_to)
        .or_else(|| {
            let uri = person.uri.as_deref()?.trim();
            let mail = uri.get(..7)?.eq_ignore_ascii_case("mailto:");
            mail.then(|| worth_writing_to(uri)).flatten()
        })
}

/// The address a feed gives for writing to its writer: the feed's author
/// (Atom, JSON Feed), its editor (RSS `managingEditor`) or a podcast's owner
/// (`itunes:owner`); else, when its articles name an author's address and
/// all name the same one, that. A feed whose articles name several (a
/// magazine) gives none: nine turtles can't tell whose is whose. The site's
/// webmaster is never used: they run the website, they didn't write it.
pub fn from_feed(feed: &Feed) -> Option<String> {
    let editors = feed
        .contributors
        .iter()
        .filter(|person| matches!(person.role.as_deref(), Some("managingEditor" | "owner")));
    if let Some(found) = feed.authors.iter().chain(editors).find_map(of_person) {
        return Some(found);
    }
    let mut found = feed
        .entries
        .iter()
        .flat_map(|entry| entry.authors.iter().filter_map(of_person));
    let first = found.next()?;
    found.all(|other| other == first).then_some(first)
}

#[derive(Deserialize)]
struct Address {
    /// Empty or missing: forget the reader's own, so the feed's (if it
    /// gives one) is used again.
    address: Option<String>,
}

/// `POST /api/feeds/3/write-to`: the reader's own address for the person
/// place 3 belongs to, kept on every place of theirs the reader follows.
/// Refused as `not-an-address` when it isn't one, `not-found` when the
/// reader doesn't follow place 3.
async fn set_address(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<Address>,
) -> Response {
    let wanted = match form.address.as_deref().map(str::trim) {
        None | Some("") => None,
        Some(raw) => match address(raw) {
            Some(found) => Some(found),
            None => return refused(StatusCode::BAD_REQUEST, "not-an-address"),
        },
    };
    let saved = sqlx::query(
        "UPDATE subscriptions SET write_to = ?1
         WHERE person_id = ?2 AND unsubscribed_at IS NULL
             AND (feed_id = ?3 OR writer_id = (SELECT writer_id FROM subscriptions
                      WHERE person_id = ?2 AND feed_id = ?3 AND unsubscribed_at IS NULL))",
    )
    .bind(&wanted)
    .bind(person)
    .bind(id)
    .execute(&state.db)
    .await;
    match saved {
        Ok(done) if done.rows_affected() == 0 => refused(StatusCode::NOT_FOUND, "not-found"),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("keeping an address to write to", &error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_address_is_written_one_way() {
        assert_eq!(
            address(" Alpha@Example.ORG ").as_deref(),
            Some("Alpha@example.org")
        );
        assert_eq!(
            address("mailto:alpha@example.org?subject=Hi").as_deref(),
            Some("alpha@example.org")
        );
        assert_eq!(
            address("MAILTO:a.b+c@mail.example.co.uk").as_deref(),
            Some("a.b+c@mail.example.co.uk")
        );
        assert_eq!(
            address("ålpha@bücher.example").as_deref(),
            Some("ålpha@bücher.example")
        );
    }

    #[test]
    fn what_isnt_one_address_is_refused() {
        for wrong in [
            "",
            "alpha",
            "alpha@",
            "@example.org",
            "alpha@example",
            "alpha@@example.org",
            "al pha@example.org",
            "alpha@example.org, beta@example.org",
            "alpha@example.org;beta@example.org",
            "<alpha@example.org>",
            "alpha@.example.org",
            "alpha@example..org",
            ".alpha@example.org",
            "alpha@exa_mple.org",
        ] {
            assert_eq!(address(wrong), None, "{wrong:?}");
        }
        let long = format!("{}@{}.org", "a".repeat(64), "b".repeat(200));
        assert_eq!(address(&long), None);
    }

    #[test]
    fn an_address_only_sent_from_is_never_kept() {
        for sends_only in [
            "noreply@blogger.com",
            "no-reply@substack.com",
            "No_Reply@example.org",
            "donotreply@example.org",
            "do-not-reply@example.org",
            "MAILER-DAEMON@example.org",
            "bounces+123@example.org",
        ] {
            assert_eq!(worth_writing_to(sends_only), None, "{sends_only:?}");
        }
        assert_eq!(
            worth_writing_to("alpha@example.org").as_deref(),
            Some("alpha@example.org")
        );
    }

    fn parsed(body: &str) -> Feed {
        feed_rs::parser::parse(body.as_bytes()).unwrap()
    }

    #[test]
    fn an_rss_feed_gives_its_editor_never_its_webmaster() {
        let feed = parsed(
            r#"<rss version="2.0"><channel><title>Alpha</title>
            <webMaster>host@example.net (The host)</webMaster>
            <managingEditor>alpha@example.org (Alpha)</managingEditor>
            <item><title>One</title></item></channel></rss>"#,
        );
        assert_eq!(from_feed(&feed).as_deref(), Some("alpha@example.org"));
        let only_host = parsed(
            r#"<rss version="2.0"><channel><title>Alpha</title>
            <webMaster>host@example.net</webMaster><item><title>One</title></item></channel></rss>"#,
        );
        assert_eq!(from_feed(&only_host), None);
    }

    #[test]
    fn an_atom_feed_gives_its_author() {
        let feed = parsed(
            r#"<feed xmlns="http://www.w3.org/2005/Atom"><title>Alpha</title>
            <author><name>Alpha</name><email>alpha@example.org</email></author>
            <entry><title>One</title><id>1</id><updated>2026-11-01T00:00:00Z</updated></entry></feed>"#,
        );
        assert_eq!(from_feed(&feed).as_deref(), Some("alpha@example.org"));
    }

    #[test]
    fn a_json_feed_gives_its_authors_mailto_link() {
        let feed = parsed(
            r#"{"version":"https://jsonfeed.org/version/1.1","title":"Alpha",
            "authors":[{"name":"Alpha","url":"mailto:alpha@example.org"}],
            "items":[{"id":"1","content_text":"Hi"}]}"#,
        );
        assert_eq!(from_feed(&feed).as_deref(), Some("alpha@example.org"));
        let web_page = parsed(
            r#"{"version":"https://jsonfeed.org/version/1.1","title":"Alpha",
            "authors":[{"name":"Alpha","url":"https://alpha.example/about"}],
            "items":[{"id":"1","content_text":"Hi"}]}"#,
        );
        assert_eq!(from_feed(&web_page), None);
    }

    #[test]
    fn articles_give_an_address_only_when_they_all_name_the_same_one() {
        let one = parsed(
            r#"<rss version="2.0"><channel><title>Alpha</title>
            <item><title>One</title><author>alpha@example.org (Alpha)</author></item>
            <item><title>Two</title><author>alpha@example.org (Alpha)</author></item>
            <item><title>Three</title></item></channel></rss>"#,
        );
        assert_eq!(from_feed(&one).as_deref(), Some("alpha@example.org"));
        let magazine = parsed(
            r#"<rss version="2.0"><channel><title>Many</title>
            <item><title>One</title><author>alpha@example.org</author></item>
            <item><title>Two</title><author>beta@example.org</author></item></channel></rss>"#,
        );
        assert_eq!(from_feed(&magazine), None);
    }

    #[test]
    fn bloggers_no_reply_author_gives_nothing() {
        let feed = parsed(
            r#"<feed xmlns="http://www.w3.org/2005/Atom"><title>Alpha</title>
            <author><name>Alpha</name><email>noreply@blogger.com</email></author>
            <entry><title>One</title><id>1</id><updated>2026-11-01T00:00:00Z</updated></entry></feed>"#,
        );
        assert_eq!(from_feed(&feed), None);
    }
}
