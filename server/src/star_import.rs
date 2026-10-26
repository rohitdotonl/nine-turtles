//! Bringing stars over from another feed reader (SPEC section 23, decision
//! 0098): Settings › Your data › Import starred articles reads the file
//! another reader exports its starred (or "saved") articles in, and stars
//! each of them here.
//!
//! Two kinds of file are read. The Google Reader kind, which Inoreader,
//! Feedly, The Old Reader, FreshRSS, BazQux and others export (`items`,
//! each with `alternate`, `origin` and `published`), and JSON Feed, which
//! nine turtles' own starred export is (so it comes back whole, into this
//! nine turtles or another). Flat lists of articles (`url`, `title`,
//! `content`), as Feedbin's export is, read too. Pocket isn't: it keeps whole
//! web pages, not what a feed sent (the publisher floor).
//!
//! An article nine turtles already stores from the same feed is starred as
//! it is. Any other comes in as the file has it, cleaned like any feed's
//! text, into a feed of the reader's own (`imported:<reader>:<feed>`), never
//! into the shared feed: what one reader's file says can't appear in another
//! reader's lists as if the publisher had sent it. Those feeds are hidden,
//! like a feed unsubscribed from whose starred articles stay: the articles
//! show in Starred and search, read, each with its original link, and
//! nothing is ever fetched for them. Importing only adds stars; it never
//! unstars, removes or changes anything already here, so it needs no Undo.

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
};
use reqwest::Url;
use serde::Serialize;
use serde_json::{Map, Value, json};

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feed, now, search,
};

/// The biggest file read: a few thousand starred articles with their text.
pub const SIZE_LIMIT: usize = 25 * 1024 * 1024;
/// More stars than one file may bring. A file with more is refused rather
/// than half imported.
pub const MOST_STARS: usize = 10_000;
/// The most articles one reader may keep from imports, all files together,
/// and the most text (content and summary, in bytes): the disk is shared by
/// every reader. An import that would go past either stores nothing.
pub const MOST_KEPT: i64 = 10_000;
pub const MOST_KEPT_BYTES: i64 = 50 * 1024 * 1024;
/// The name of the feed that holds stars whose file doesn't say where they
/// came from.
const NO_FEED_TITLE: &str = "Imported stars";

pub fn routes() -> Router<AppState> {
    Router::new().route(
        "/api/starred/import",
        post(import).layer(DefaultBodyLimit::max(SIZE_LIMIT)),
    )
}

/// One starred article, as the file has it.
#[derive(Debug, PartialEq, Eq)]
pub struct Star {
    /// The feed it came from, if the file says.
    pub feed_url: Option<Url>,
    pub feed_title: Option<String>,
    pub site_url: Option<String>,
    pub fingerprint: String,
    pub title: String,
    /// The original, always there: an article without one isn't read.
    pub link: Url,
    pub author: Option<String>,
    /// Cleaned HTML, safe to show.
    pub content: Option<String>,
    pub summary: Option<String>,
    pub published_at: Option<i64>,
}

/// What a file holds: its stars, and how many articles couldn't be read
/// (most often, no link to the original).
#[derive(Debug, Default)]
pub struct Read {
    pub stars: Vec<Star>,
    pub unreadable: usize,
}

/// What importing did, for the plain summary.
#[derive(Debug, Default, PartialEq, Eq, Serialize)]
pub struct Summary {
    /// Newly starred.
    pub starred: usize,
    /// Starred here already.
    pub already: usize,
    pub unreadable: usize,
}

async fn import(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    text: String,
) -> Response {
    let Some(read) = read(&text) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "not-stars" })),
        )
            .into_response();
    };
    if read.stars.len() > MOST_STARS {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
    match star_all(&state.db, person, &read, now()).await {
        Ok(Imported::Done(summary)) => Json(json!({ "summary": summary })).into_response(),
        Ok(Imported::TooMuch) => (
            StatusCode::CONFLICT,
            Json(json!({ "error": "too-much", "most": MOST_KEPT })),
        )
            .into_response(),
        Err(error) => database_problem("importing starred articles", &error),
    }
}

/// Reads a file of starred articles. None if it isn't one: not JSON, or no
/// list of articles in it.
pub fn read(text: &str) -> Option<Read> {
    let file: Value = serde_json::from_str(text.trim_start_matches('\u{feff}')).ok()?;
    let (items, whole) = match &file {
        Value::Array(items) => (items, None),
        Value::Object(whole) => (whole.get("items")?.as_array()?, Some(whole)),
        _ => return None,
    };
    // A JSON Feed file of one feed names it once, for all its articles.
    let is_json_feed = whole
        .and_then(|whole| whole.get("version"))
        .and_then(Value::as_str)
        .is_some_and(|version| version.starts_with("https://jsonfeed.org/"));
    // Only a file that gives its feed's address is one feed's articles; a
    // collection (nine turtles' own export has none) names no publisher.
    let whole_feed = whole.filter(|_| is_json_feed).and_then(|whole| {
        Some(Origin {
            url: Some(text_at(whole, &["feed_url"]).and_then(web_address)?),
            title: text_at(whole, &["title"]),
            site: text_at(whole, &["home_page_url"]),
        })
    });
    let mut read = Read::default();
    for item in items {
        match item
            .as_object()
            .and_then(|item| star(item, whole_feed.as_ref(), is_json_feed))
        {
            Some(star) => read.stars.push(star),
            None => read.unreadable += 1,
        }
    }
    Some(read)
}

/// Where an article came from, as a file says.
struct Origin {
    url: Option<Url>,
    title: Option<String>,
    site: Option<String>,
}

fn star(
    item: &Map<String, Value>,
    whole_feed: Option<&Origin>,
    is_json_feed: bool,
) -> Option<Star> {
    let link = first_link(item)?;
    // Where it came from: Google Reader's `origin`, nine turtles' own
    // export's `_nine_turtles`, then the JSON Feed file's own feed.
    let origin = item.get("origin").and_then(Value::as_object);
    let ours = item.get("_nine_turtles").and_then(Value::as_object);
    let feed_url = origin
        .and_then(|origin| text_at(origin, &["streamId"]))
        .and_then(|stream| stream.strip_prefix("feed/").map(str::to_owned))
        .and_then(|address| web_address(&address))
        .or_else(|| {
            ours.and_then(|ours| text_at(ours, &["feed_url"]))
                .and_then(web_address)
        })
        .or_else(|| text_at(item, &["feed_url"]).and_then(web_address))
        .or_else(|| whole_feed.and_then(|feed| feed.url.clone()));
    let feed_title = origin
        .and_then(|origin| text_at(origin, &["title"]))
        .or_else(|| ours.and_then(|ours| text_at(ours, &["feed_title"])))
        .or_else(|| whole_feed.and_then(|feed| feed.title.clone()))
        .map(|title| plain(&title))
        .filter(|title| !title.is_empty());
    let site_url = origin
        .and_then(|origin| text_at(origin, &["htmlUrl"]))
        .or_else(|| ours.and_then(|ours| text_at(ours, &["home_page_url"])))
        .or_else(|| whole_feed.and_then(|feed| feed.site.clone()))
        .and_then(web_address)
        .map(String::from);

    let title = text_at(item, &["title"])
        .map(|title| plain(&title))
        .unwrap_or_default();
    let published_at = ["published", "date_published", "updated", "date_modified"]
        .iter()
        .find_map(|name| item.get(*name).and_then(time));
    // The feed's own ID for the article, where the file keeps it, so it's
    // recognised as the article nine turtles may already store: nine
    // turtles' own export writes it after the feed's address, Feedly calls
    // it `originId`, and a JSON Feed file of one feed has it as `id`. The
    // Google Reader kind's `id` is that app's own, so it isn't used.
    let feed_id = text_at(item, &["id"]);
    let fingerprint = match (&feed_id, ours.and_then(|ours| text_at(ours, &["feed_url"]))) {
        (Some(id), Some(feed)) if id.starts_with(&format!("{feed}#")) => {
            id[feed.len() + 1..].to_owned()
        }
        _ => {
            let own = text_at(item, &["originId"])
                .or_else(|| feed_id.filter(|_| is_json_feed && ours.is_none()))
                .unwrap_or_default();
            feed::fingerprint(&own, Some(&link), &title, published_at)
        }
    };

    let html = |names: &[&str]| {
        names.iter().find_map(|name| match item.get(*name)? {
            Value::String(text) => Some(text.clone()),
            // The Google Reader kind: `{ "content": "<p>…" }`.
            Value::Object(inner) => text_at(inner, &["content"]),
            _ => None,
        })
    };
    let clean = |body: String| feed::clean(&body, "text/html", &link);
    let content = html(&["content", "content_html"])
        .map(clean)
        .or_else(|| text_at(item, &["content_text"]).map(|text| clean(feed::paragraphs(&text))))
        .filter(|html| !html.trim().is_empty());
    let summary = html(&["summary"])
        .map(clean)
        .filter(|html| !html.trim().is_empty());
    let author = match item.get("author") {
        Some(Value::String(name)) => Some(name.clone()),
        Some(Value::Object(author)) => text_at(author, &["name"]),
        _ => item
            .get("authors")
            .and_then(Value::as_array)
            .and_then(|authors| authors.first())
            .and_then(Value::as_object)
            .and_then(|author| text_at(author, &["name"])),
    }
    .map(|name| plain(&name))
    .filter(|name| !name.is_empty());

    Some(Star {
        feed_url,
        feed_title,
        site_url,
        fingerprint,
        title,
        link,
        author,
        content,
        summary,
        published_at,
    })
}

/// The article's original, the first web address the file gives for it:
/// Google Reader's `alternate` and `canonical` lists, Feedly's
/// `canonicalUrl`, JSON Feed's `url`, or a plain `link`.
fn first_link(item: &Map<String, Value>) -> Option<Url> {
    let listed = ["alternate", "canonical"].iter().find_map(|name| {
        item.get(*name)?.as_array()?.iter().find_map(|link| {
            link.as_object()
                .and_then(|link| text_at(link, &["href"]))
                .and_then(web_address)
        })
    });
    listed.or_else(|| {
        ["canonicalUrl", "url", "link", "external_url"]
            .iter()
            .find_map(|name| text_at(item, &[*name]).and_then(web_address))
    })
}

/// The text under the first of these names that has some.
fn text_at(object: &Map<String, Value>, names: &[&str]) -> Option<String> {
    names.iter().find_map(|name| {
        object
            .get(*name)?
            .as_str()
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(str::to_owned)
    })
}

/// An `http` or `https` address, or None.
fn web_address(text: impl AsRef<str>) -> Option<Url> {
    Url::parse(text.as_ref().trim())
        .ok()
        .filter(|url| matches!(url.scheme(), "http" | "https") && url.host_str().is_some())
}

/// Plain text from a title or name that may carry HTML (`&amp;`, `<b>`).
fn plain(text: &str) -> String {
    let fragment = scraper::Html::parse_fragment(text);
    let words: String = fragment.root_element().text().collect();
    words.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// A time in seconds since 1970: a number (seconds, or milliseconds or
/// microseconds as some apps write them), or RFC 3339 text.
fn time(value: &Value) -> Option<i64> {
    let number = match value {
        Value::Number(number) => number
            .as_i64()
            .or_else(|| number.as_f64().map(|float| float as i64))?,
        Value::String(text) => match text.trim().parse::<i64>() {
            Ok(number) => number,
            Err(_) => return rfc3339(text.trim()),
        },
        _ => return None,
    };
    let seconds = match number {
        n if n > 100_000_000_000_000 => n / 1_000_000,
        n if n > 100_000_000_000 => n / 1_000,
        n => n,
    };
    (seconds > 0).then_some(seconds)
}

/// Reads `2026-10-23T20:18:35Z` (or with a fraction of a second, a space for
/// the `T`, or an offset such as `+05:30`) as seconds since 1970.
pub fn rfc3339(text: &str) -> Option<i64> {
    let number = |range: std::ops::Range<usize>| -> Option<i64> {
        let part = text.get(range)?;
        part.bytes()
            .all(|byte| byte.is_ascii_digit())
            .then(|| part.parse().ok())?
    };
    let (year, month, day) = (number(0..4)?, number(5..7)?, number(8..10)?);
    let (hour, minute, second) = (number(11..13)?, number(14..16)?, number(17..19)?);
    let separators = text.as_bytes();
    if separators.get(4) != Some(&b'-')
        || separators.get(7) != Some(&b'-')
        || !matches!(separators.get(10), Some(b'T' | b't' | b' '))
        || separators.get(13) != Some(&b':')
        || separators.get(16) != Some(&b':')
        || !(1..=12).contains(&month)
        || !(1..=31).contains(&day)
        || hour > 23
        || minute > 59
        || second > 60
    {
        return None;
    }
    let rest = text[19..].trim_start_matches(|c: char| c == '.' || c.is_ascii_digit());
    let offset = match rest.as_bytes().first() {
        None | Some(b'Z' | b'z') => 0,
        Some(sign @ (b'+' | b'-')) => {
            let hours: i64 = rest.get(1..3)?.parse().ok()?;
            let minutes: i64 = rest.get(4..6).map_or(Some(0), |m| m.parse().ok())?;
            let offset = hours * 3_600 + minutes * 60;
            if *sign == b'+' { offset } else { -offset }
        }
        _ => return None,
    };
    // A calendar date to days since 1970 (Howard Hinnant's "days_from_civil").
    let year = if month <= 2 { year - 1 } else { year };
    let era = year.div_euclid(400);
    let year_of_era = year.rem_euclid(400);
    let day_of_year = (153 * (if month > 2 { month - 3 } else { month + 9 }) + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    let days = era * 146_097 + day_of_era - 719_468;
    Some(days * 86_400 + hour * 3_600 + minute * 60 + second - offset)
}

/// What `star_all` did.
#[derive(Debug, PartialEq, Eq)]
pub enum Imported {
    Done(Summary),
    /// Nothing was imported: the reader would keep more than `MOST_KEPT`
    /// imported articles, or `MOST_KEPT_BYTES` of their text.
    TooMuch,
}

/// Stars every article the file holds for reader `person`, all at once or
/// not at all: nothing, if it would take them past what one reader may keep
/// from imports.
pub async fn star_all(
    db: &sqlx::SqlitePool,
    person: i64,
    read: &Read,
    now: i64,
) -> Result<Imported, sqlx::Error> {
    let mut summary = Summary {
        unreadable: read.unreadable,
        ..Summary::default()
    };
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    for star in &read.stars {
        let article = match stored(&mut transaction, person, star).await? {
            Some(article) => article,
            None => {
                let feed = own_feed(&mut transaction, person, star, now).await?;
                store(&mut transaction, feed, star, now).await?
            }
        };
        // Read, so a thousand stars don't fill Unread. An entry the reader
        // has already keeps its read mark, and gains the star.
        let starred = sqlx::query(
            "INSERT INTO entries (person_id, article_id, feed_id, sort_at, read, starred)
             SELECT ?, id, feed_id, sort_at, 1, 1 FROM articles WHERE id = ?
             ON CONFLICT (person_id, article_id) DO UPDATE SET starred = 1
             WHERE entries.starred = 0",
        )
        .bind(person)
        .bind(article)
        .execute(&mut *transaction)
        .await?;
        if starred.rows_affected() == 0 {
            summary.already += 1;
        } else {
            summary.starred += 1;
        }
    }
    // The reader's own feeds' keys all start `imported:<reader>:`, and none
    // else does (`own_key`), so this range of the unique index is theirs.
    let (kept, bytes): (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*), COALESCE(SUM(length(CAST(articles.content AS BLOB))
                    + COALESCE(length(CAST(articles.summary AS BLOB)), 0)), 0)
         FROM feeds JOIN articles ON articles.feed_id = feeds.id
         WHERE feeds.url_key >= ? AND feeds.url_key < ?",
    )
    .bind(format!("imported:{person}:"))
    .bind(format!("imported:{person};"))
    .fetch_one(&mut *transaction)
    .await?;
    if kept > MOST_KEPT || bytes > MOST_KEPT_BYTES {
        transaction.rollback().await?;
        return Ok(Imported::TooMuch);
    }
    transaction.commit().await?;
    Ok(Imported::Done(summary))
}

/// The article as nine turtles already stores it, if it does: from the
/// feed it came from (fetched from the publisher, so the reader's star
/// goes on the real thing), or from an earlier import into the reader's
/// own feed for it. The reader then has a subscription to its feed (a
/// hidden one if they don't follow it), which their entry needs.
async fn stored(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    star: &Star,
) -> Result<Option<i64>, sqlx::Error> {
    let mut keys = vec![own_key(person, star)];
    if let Some(url) = &star.feed_url {
        keys.insert(0, feed::normalize(url));
    }
    for key in keys {
        let found: Option<(i64, i64, String)> = sqlx::query_as(
            "SELECT articles.id, feeds.id, feeds.title
             FROM feeds JOIN articles ON articles.feed_id = feeds.id
             WHERE feeds.url_key = ? AND feeds.newsletter_of IS NULL
                 AND (articles.fingerprint = ? OR articles.link = ?)
             ORDER BY articles.fingerprint != ? LIMIT 1",
        )
        .bind(&key)
        .bind(&star.fingerprint)
        .bind(star.link.as_str())
        .bind(&star.fingerprint)
        .fetch_optional(&mut *connection)
        .await?;
        if let Some((article, feed, title)) = found {
            hidden_subscription(
                connection,
                person,
                feed,
                star.feed_title.as_ref().unwrap_or(&title),
            )
            .await?;
            return Ok(Some(article));
        }
    }
    Ok(None)
}

/// The key (`url_key`) of the reader's own feed for stars from this feed:
/// `imported:<reader>:feed:<normalized address>`, or, when the file gives
/// no address, `imported:<reader>:named:<the feed's name>`, or
/// `imported:<reader>:` when it names no feed at all. No two readers ever
/// share one, and no web feed's key can look like one: `feed::normalize`
/// writes an address without its `http(s)://`, so a key starting
/// `imported:<number>:` would need a host `imported` with a port followed by
/// another colon, which no web address has.
fn own_key(person: i64, star: &Star) -> String {
    match (&star.feed_url, &star.feed_title) {
        (Some(url), _) => format!("imported:{person}:feed:{}", feed::normalize(url)),
        (None, Some(title)) => format!("imported:{person}:named:{}", title.to_lowercase()),
        (None, None) => format!("imported:{person}:"),
    }
}

/// The reader's own feed for stars from this star's feed, made with its
/// first star: never fetched (nobody follows it, and it's never due), and
/// the reader's hidden subscription holds its name. Its `url` is the feed's
/// real address, so the starred export credits it; `imported:` when the
/// file gave none.
async fn own_feed(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    star: &Star,
    now: i64,
) -> Result<i64, sqlx::Error> {
    let key = own_key(person, star);
    let title = star
        .feed_title
        .clone()
        .or_else(|| {
            star.feed_url
                .as_ref()
                .and_then(Url::host_str)
                .map(|host| host.trim_start_matches("www.").to_owned())
        })
        .unwrap_or_else(|| NO_FEED_TITLE.to_owned());
    let url = star
        .feed_url
        .as_ref()
        .map_or_else(|| "imported:".to_owned(), |url| url.as_str().to_owned());
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO feeds (url, url_key, title, site_url, added_at, next_check_at, unsubscribed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?5)
         ON CONFLICT (url_key) DO UPDATE SET url_key = excluded.url_key
         RETURNING id",
    )
    .bind(&url)
    .bind(&key)
    .bind(&title)
    .bind(&star.site_url)
    .bind(now)
    // Never due: nothing is ever fetched for it.
    .bind(i64::MAX)
    .fetch_one(&mut *connection)
    .await?;
    hidden_subscription(connection, person, id, &title).await?;
    Ok(id)
}

/// Gives the reader a subscription to this feed if they have none: hidden
/// and already let go, like one unsubscribed from whose starred articles
/// stay. One they have (followed or not) stays as it is.
async fn hidden_subscription(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    feed: i64,
    title: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR IGNORE INTO subscriptions (person_id, feed_id, title, added_at, unsubscribed_at,
             cleared)
         VALUES (?, ?, ?, unixepoch(), unixepoch(), 1)",
    )
    .bind(person)
    .bind(feed)
    .bind(title)
    .execute(connection)
    .await?;
    Ok(())
}

/// Stores the article in the reader's own feed, numbered as
/// `feeds::store_articles` numbers new articles, with its words in search.
async fn store(
    connection: &mut sqlx::SqliteConnection,
    feed: i64,
    star: &Star,
    now: i64,
) -> Result<i64, sqlx::Error> {
    let sort_at = star
        .published_at
        .map_or(now, |published| published.min(now));
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO articles (id, feed_id, fingerprint, title, link, author, content, summary,
             published_at, received_at, sort_at)
         VALUES (1 + MAX(COALESCE((SELECT MAX(id) FROM articles), 0),
                 COALESCE((SELECT CAST(value AS INTEGER) FROM settings
                           WHERE name = 'articles_high_water'), 0)),
             ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id",
    )
    .bind(feed)
    .bind(&star.fingerprint)
    .bind(&star.title)
    .bind(star.link.as_str())
    .bind(&star.author)
    .bind(&star.content)
    .bind(&star.summary)
    .bind(star.published_at)
    .bind(now)
    .bind(sort_at)
    .fetch_one(&mut *connection)
    .await?;
    search::index(
        connection,
        id,
        &star.title,
        star.content.as_deref(),
        star.summary.as_deref(),
    )
    .await?;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn times_are_read_in_seconds_milliseconds_or_rfc_3339() {
        assert_eq!(rfc3339("2026-10-23T20:18:35Z"), Some(1_792_786_715));
        assert_eq!(rfc3339("2026-10-23T20:18:35.123456Z"), Some(1_792_786_715));
        assert_eq!(rfc3339("2026-10-24T01:48:35+05:30"), Some(1_792_786_715));
        assert_eq!(rfc3339("2000-02-29 00:00:00"), Some(951_782_400));
        assert_eq!(rfc3339("1969-12-31T23:59:59Z"), Some(-1));
        assert_eq!(rfc3339("yesterday"), None);
        assert_eq!(rfc3339("2026-13-01T00:00:00Z"), None);
        assert_eq!(time(&json!(1_792_786_715)), Some(1_792_786_715));
        assert_eq!(time(&json!(1_792_786_715_000_i64)), Some(1_792_786_715));
        assert_eq!(time(&json!("1792786715000000")), Some(1_792_786_715));
        assert_eq!(time(&json!("2026-10-23T20:18:35Z")), Some(1_792_786_715));
    }

    #[test]
    fn no_web_address_has_an_imported_key() {
        for address in [
            "http://imported:5/x",
            "https://imported:5@example.com/",
            "https://imported/5:x",
            "http://imported.example:8080/feed",
        ] {
            let key = feed::normalize(&Url::parse(address).unwrap());
            let looks_imported = key
                .strip_prefix("imported:")
                .and_then(|rest| rest.split_once(':'))
                .is_some_and(|(reader, _)| reader.parse::<i64>().is_ok());
            assert!(!looks_imported, "{address} → {key}");
        }
    }

    #[test]
    fn a_google_reader_file_is_read() {
        let file = r#"{"id":"user/1/state/com.google/starred","items":[
            {"id":"tag:google.com,2005:reader/item/0001","title":"Tea &amp; <b>quiet</b>",
             "published":1792786715,"author":"Ada",
             "alternate":[{"href":"https://blog.example/tea","type":"text/html"}],
             "summary":{"direction":"ltr","content":"<p>Hello<script>alert(1)</script></p>"},
             "origin":{"streamId":"feed/https://blog.example/feed.xml","title":"A blog",
                       "htmlUrl":"https://blog.example/"}},
            {"id":"tag:google.com,2005:reader/item/0002","title":"No link"}]}"#;
        let read = read(file).unwrap();
        assert_eq!(read.unreadable, 1);
        let star = &read.stars[0];
        assert_eq!(star.title, "Tea & quiet");
        assert_eq!(star.link.as_str(), "https://blog.example/tea");
        assert_eq!(star.fingerprint, "link:blog.example/tea");
        assert_eq!(
            star.feed_url.as_ref().unwrap().as_str(),
            "https://blog.example/feed.xml"
        );
        assert_eq!(star.feed_title.as_deref(), Some("A blog"));
        assert_eq!(star.site_url.as_deref(), Some("https://blog.example/"));
        assert_eq!(star.author.as_deref(), Some("Ada"));
        assert_eq!(star.published_at, Some(1_792_786_715));
        assert_eq!(star.content, None);
        assert_eq!(star.summary.as_deref(), Some("<p>Hello</p>"));
    }

    #[test]
    fn feedly_keeps_the_feeds_own_id_in_milliseconds() {
        let file = r#"{"items":[{"id":"feedly-own","originId":"post-7",
            "canonicalUrl":"https://blog.example/7","published":1792786715000,
            "content":{"content":"<p>Seven</p>"},
            "origin":{"streamId":"feed/http://blog.example/rss","title":"Blog"}}]}"#;
        let star = &read(file).unwrap().stars[0];
        assert_eq!(star.fingerprint, "id:post-7");
        assert_eq!(star.published_at, Some(1_792_786_715));
        assert_eq!(star.content.as_deref(), Some("<p>Seven</p>"));
    }

    #[test]
    fn nine_turtles_own_export_comes_back_with_its_fingerprints() {
        let file = r#"{"version":"https://jsonfeed.org/version/1.1","title":"nine turtles starred articles",
            "items":[{"id":"https://blog.example/feed.xml#id:abc","url":"https://blog.example/a",
            "title":"A","content_html":"<p>A</p>","date_published":"2026-10-23T20:18:35Z",
            "authors":[{"name":"Ada"}],
            "_nine_turtles":{"feed_title":"My blog","feed_url":"https://blog.example/feed.xml",
                             "home_page_url":"https://blog.example/"}}]}"#;
        let star = &read(file).unwrap().stars[0];
        assert_eq!(star.fingerprint, "id:abc");
        assert_eq!(star.feed_title.as_deref(), Some("My blog"));
        assert_eq!(star.author.as_deref(), Some("Ada"));
        assert_eq!(star.published_at, Some(1_792_786_715));
    }

    #[test]
    fn a_flat_list_reads_too_and_other_files_dont() {
        let file = r#"[{"title":"Flat","url":"https://blog.example/flat","content":"<p>Hi</p>",
            "published":"2026-10-23T20:18:35.000000Z"}]"#;
        let read = read(file).unwrap();
        assert_eq!(read.stars[0].feed_url, None);
        assert_eq!(read.stars[0].fingerprint, "link:blog.example/flat");
        assert!(super::read("<opml/>").is_none());
        assert!(super::read(r#"{"feeds":[]}"#).is_none());
        // Only web addresses are originals.
        let odd = r#"[{"title":"x","url":"javascript:alert(1)"}]"#;
        assert_eq!(super::read(odd).unwrap().unreadable, 1);
    }
}
