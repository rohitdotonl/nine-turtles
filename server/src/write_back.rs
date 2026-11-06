//! Writing back (SPEC section 37, decision 0147): the address a reader
//! writes to a person at. nine turtles only fills in the reader's own email
//! app (a `mailto:` link, made by the web app); it never sends or reads that
//! email.
//!
//! The address comes from two places. The publisher's, kept on the feed for
//! everyone who follows it (`feeds.email`): a feed's own author or editor,
//! or a "Reply by email" link in its articles' text (`from_feed`), or a newsletter's Reply-To or From address (`newsletter`).
//! An address made only to send from ("no-reply") is never kept. And the
//! reader's own (`subscriptions.write_to`), typed once when neither had one,
//! or in Edit on their page: it wins, and is kept on every place of the person, so
//! it stays with them. When neither is known, the writer's own site is
//! looked on once, when the reader asks (`site`, decision 0168).

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

pub(crate) mod site;
mod unfollowed;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/feeds/{id}/write-to", post(set_address))
        .merge(site::routes())
        .merge(unfollowed::routes())
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
/// all name the same one, that; else, when no article names one, the one
/// the articles' own text gives (`in_text`). A feed whose articles name
/// several (a magazine) gives none: nine turtles can't tell whose is whose.
/// The site's webmaster is never used: they run the website, they didn't
/// write it.
pub fn from_feed(feed: &Feed) -> Option<String> {
    match named(feed) {
        Named::One(found) => Some(found),
        Named::Several => None,
        Named::None => in_posts(feed),
    }
}

/// What a feed's authors say about their addresses (the blog checkup tells
/// a writer which it is).
#[derive(Debug, PartialEq, Eq)]
pub enum Named {
    /// No author or editor of the feed or its articles gives one.
    None,
    /// One address, the writer's.
    One(String),
    /// Its articles name different ones (a magazine's writers).
    Several,
}

/// The address the feed's author, editor or podcast owner gives; else the
/// one all its articles' authors give.
pub fn named(feed: &Feed) -> Named {
    let editors = feed
        .contributors
        .iter()
        .filter(|person| matches!(person.role.as_deref(), Some("managingEditor" | "owner")));
    if let Some(found) = feed.authors.iter().chain(editors).find_map(of_person) {
        return Named::One(found);
    }
    let mut named = feed
        .entries
        .iter()
        .flat_map(|entry| entry.authors.iter().filter_map(of_person))
        .peekable();
    if named.peek().is_none() {
        return Named::None;
    }
    only_one(named).map_or(Named::Several, Named::One)
}

/// The one address the articles' own text gives for writing back, such as a
/// "Reply by email" link (`in_text`).
pub fn in_posts(feed: &Feed) -> Option<String> {
    only_one(in_text(feed).into_iter())
}

/// The one address in `found`, or none when there are several (a magazine's
/// writers): nine turtles can't tell whose is whose.
fn only_one(mut found: impl Iterator<Item = String>) -> Option<String> {
    let first = found.next()?;
    found.all(|other| other == first).then_some(first)
}

/// What a link's words say when it's for writing to the writer: "Reply by
/// email", "Email me", "Get in touch" and the like.
const WRITE_TO_ME: [&str; 11] = [
    "reply",
    "respond",
    "write back",
    "write to me",
    "email me",
    "e-mail me",
    "mail me",
    "contact me",
    "get in touch",
    "say hi",
    "say hello",
];

/// Whether a link's words start with `phrase` as a whole word: "Reply by
/// email" says "reply", but "Replying to Beta" and "Beta's reply" don't, as
/// a link to someone else's address might read.
fn says(words: &str, phrase: &str) -> bool {
    words
        .strip_prefix(phrase)
        .is_some_and(|rest| !rest.starts_with(char::is_alphanumeric))
}

/// The addresses the articles' own text gives for writing to the writer
/// (SPEC section 37): a `mailto:` link that says it's for replying (its
/// subject starts "Re:", or its words are "Reply by email", "Email me" and
/// the like), or a `mailto:` link to the same address in two or more
/// articles, as a sign-off at each one's end is. Any other address in an
/// article's text may be someone else's, so it's left alone. Only what the
/// feed brought is read: nothing is fetched.
fn in_text(feed: &Feed) -> Vec<String> {
    let links = scraper::Selector::parse("a[href]").expect("a fixed, valid selector");
    let mut replies = Vec::new();
    let mut in_articles: Vec<Vec<String>> = Vec::new();
    for entry in &feed.entries {
        let text = entry
            .content
            .as_ref()
            .and_then(|content| content.body.as_deref())
            .into_iter()
            .chain(
                entry
                    .summary
                    .as_ref()
                    .map(|summary| summary.content.as_str()),
            );
        let mut here = Vec::new();
        // Most articles link no address at all: skip reading them.
        for html in text.filter(|html| html.to_ascii_lowercase().contains("mailto:")) {
            for link in scraper::Html::parse_fragment(html).select(&links) {
                let href = link.value().attr("href").unwrap_or_default().trim();
                if !href
                    .get(..7)
                    .is_some_and(|start| start.eq_ignore_ascii_case("mailto:"))
                {
                    continue;
                }
                // One address however it's capitalised, so a sign-off
                // written two ways still counts as one.
                let Some(found) = worth_writing_to(href).map(|found| found.to_lowercase()) else {
                    continue;
                };
                let query = href
                    .split_once('?')
                    .map(|(_, query)| query.to_lowercase())
                    .unwrap_or_default();
                let words = link.text().collect::<String>().trim().to_lowercase();
                let says_reply = query.split('&').any(|part| {
                    part.strip_prefix("subject=").is_some_and(|subject| {
                        subject.starts_with("re:") || subject.starts_with("re%3a")
                    })
                }) || WRITE_TO_ME.iter().any(|said| says(&words, said));
                if says_reply {
                    replies.push(found.clone());
                }
                if !here.contains(&found) {
                    here.push(found);
                }
            }
        }
        in_articles.push(here);
    }
    let all: Vec<&String> = in_articles.iter().flatten().collect();
    let signed: Vec<String> = all
        .iter()
        .filter(|found| all.iter().filter(|other| other == found).count() >= 2)
        .map(|found| (*found).clone())
        .collect();
    replies.extend(signed);
    replies
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

    fn rss(items: &[&str]) -> Feed {
        let items: String = items
            .iter()
            .enumerate()
            .map(|(n, html)| {
                format!(
                    "<item><title>{n}</title><description><![CDATA[{html}]]></description></item>"
                )
            })
            .collect();
        parsed(&format!(
            r#"<rss version="2.0"><channel><title>Alpha</title>{items}</channel></rss>"#
        ))
    }

    #[test]
    fn a_reply_by_email_link_in_an_article_gives_its_address() {
        let feed = rss(&[
            r#"<p>Words.</p><p><a href="mailto:Alpha@Example.org?subject=Re:%20One">Reply by email</a></p>"#,
            "<p>More words.</p>",
        ]);
        assert_eq!(from_feed(&feed).as_deref(), Some("alpha@example.org"));
        let by_its_words =
            rss(&[r#"<p>Thoughts? <a href="mailto:alpha@example.org">Email me</a>.</p>"#]);
        assert_eq!(
            from_feed(&by_its_words).as_deref(),
            Some("alpha@example.org")
        );
        let by_its_subject = rss(&[
            r#"<a href="MAILTO:alpha@example.org?subject=re%3A%20One">alpha@example.org</a>"#,
        ]);
        assert_eq!(
            from_feed(&by_its_subject).as_deref(),
            Some("alpha@example.org")
        );
    }

    #[test]
    fn a_sign_off_in_two_articles_gives_its_address() {
        let feed = rss(&[
            r#"<p>One.</p><p>— <a href="mailto:alpha@example.org">alpha@example.org</a></p>"#,
            r#"<p>Two.</p><p>— <a href="mailto:alpha@example.org">alpha@example.org</a></p>"#,
        ]);
        assert_eq!(from_feed(&feed).as_deref(), Some("alpha@example.org"));
    }

    #[test]
    fn a_sign_off_written_two_ways_is_one_address() {
        let feed = rss(&[
            r#"<a href="mailto:Alpha@example.org">Alpha@example.org</a>"#,
            r#"<a href="mailto:alpha@EXAMPLE.org">alpha@example.org</a>"#,
            r#"<a href="mailto:alpha@example.org">Reply by email</a>"#,
        ]);
        assert_eq!(from_feed(&feed).as_deref(), Some("alpha@example.org"));
    }

    #[test]
    fn someone_elses_address_in_one_article_gives_nothing() {
        let feed = rss(&[
            r#"<p>My friend <a href="mailto:beta@example.org">Beta</a> fixes bikes.</p>"#,
            "<p>Two.</p>",
        ]);
        assert_eq!(from_feed(&feed), None);
        let words_inside = rss(&[
            r#"<p><a href="mailto:beta@example.org">Beta's reply</a>, and <a href="mailto:beta@example.org?subject=Hi">Replying to Beta</a></p>"#,
        ]);
        assert_eq!(from_feed(&words_inside), None);
        let a_plain_address = rss(&["<p>Write to alpha@example.org</p>"]);
        assert_eq!(from_feed(&a_plain_address), None);
    }

    #[test]
    fn articles_replying_to_several_addresses_give_none() {
        let feed = rss(&[
            r#"<a href="mailto:alpha@example.org">Reply by email</a>"#,
            r#"<a href="mailto:beta@example.org">Reply by email</a>"#,
        ]);
        assert_eq!(from_feed(&feed), None);
        let no_reply = rss(&[r#"<a href="mailto:noreply@example.org">Reply by email</a>"#]);
        assert_eq!(from_feed(&no_reply), None);
    }

    #[test]
    fn the_feeds_own_address_wins_over_its_articles_text() {
        let feed = parsed(
            r#"<rss version="2.0"><channel><title>Alpha</title>
            <managingEditor>alpha@example.org (Alpha)</managingEditor>
            <item><title>One</title><description><![CDATA[<a href="mailto:other@example.org">Reply by email</a>]]></description></item>
            </channel></rss>"#,
        );
        assert_eq!(from_feed(&feed).as_deref(), Some("alpha@example.org"));
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
