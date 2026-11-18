//! "One person?" (SPEC section 36, decision 0308): when two of the reader's
//! follows share one website, nine turtles asks once whether they're one
//! person, at the top of Everyone you follow and in Add when the second is
//! followed. **Join them** joins them as "+ Add a source" does
//! (`/api/writers/join`); **Keep apart** is remembered in `kept_apart`, so
//! the same two are never asked about again.
//!
//! One website is one host, without "www." (alpha.example and
//! www.alpha.example/news are one). On a site many people share (Medium, a
//! YouTube channel's address, GitHub), it's the host and the whole path, so
//! two writers there are never taken for one. Asked only when at least one
//! of the two is a person: two publications from one site (a newspaper's
//! sections) are left alone. Someone with several sources is one row, by
//! any of their websites.

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqliteConnection;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/writers/alike", get(list_alike))
        .route("/api/writers/apart", post(keep_apart))
}

/// Sites where everyone has a place under one address, told apart by its
/// path: two follows there aren't one person because the host matches.
/// Those under a site's own name (kai.substack.com) differ by host already.
const SHARED_HOSTS: &[&str] = &[
    "medium.com",
    "substack.com",
    "youtube.com",
    "m.youtube.com",
    "github.com",
    "gitlab.com",
    "bsky.app",
    "mastodon.social",
    "buttondown.com",
    "buttondown.email",
    "micro.blog",
    "write.as",
    "dev.to",
    "hashnode.com",
    "patreon.com",
    "tumblr.com",
    "vimeo.com",
    "soundcloud.com",
    "flickr.com",
    "instagram.com",
    "x.com",
    "twitter.com",
    "reddit.com",
    "letterboxd.com",
    "goodreads.com",
    "feedburner.com",
    "feeds.feedburner.com",
    "anchor.fm",
    "podcasters.spotify.com",
    "rsshub.app",
    "mastodon.online",
    "mas.to",
    "hachyderm.io",
    "fosstodon.org",
    "threads.net",
    "linkedin.com",
];

/// The website a place belongs to, as it's compared and as the question
/// says it ("low-tide.example", "medium.com/@kai"); none for an address
/// that isn't a web page's, or a shared site's own front page.
pub fn website_of(address: &str) -> Option<String> {
    let url = reqwest::Url::parse(address).ok()?;
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }
    let host = url.host_str()?.to_ascii_lowercase();
    let host = host.strip_prefix("www.").unwrap_or(&host).to_owned();
    if !SHARED_HOSTS.contains(&host.as_str()) {
        return Some(host);
    }
    // The query too: a YouTube feed with no site of its own is told apart only by it.
    let path = url.path().trim_end_matches('/');
    let query = url
        .query()
        .map(|query| format!("?{query}"))
        .unwrap_or_default();
    (!path.is_empty()).then(|| format!("{host}{path}{query}"))
}

/// Two follows the reader might call one person, the one whose name a join
/// keeps first (someone already joined, then a person, then the one
/// followed first).
#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct Alike {
    /// One place of each, to join (`/api/writers/join`) or keep apart.
    pub feeds: [i64; 2],
    /// What the reader calls each.
    pub names: [String; 2],
    /// The website they share, as the question says it.
    pub site: String,
}

/// Someone or something the reader follows: one row, as the sidebar has it.
struct Row {
    /// Already joined from several places: their name is the one a join keeps.
    joined: bool,
    feeds: Vec<i64>,
    name: String,
    person: bool,
    sites: Vec<String>,
}

/// Every pair of the reader's follows that share a website and haven't
/// been kept apart, the one followed last first.
pub async fn alike(
    connection: &mut SqliteConnection,
    person: i64,
) -> Result<Vec<Alike>, sqlx::Error> {
    type Place = (i64, Option<i64>, String, bool, Option<String>, String);
    let places: Vec<Place> = sqlx::query_as(
        "SELECT subscriptions.feed_id, subscriptions.writer_id, COALESCE(writers.name, subscriptions.title),
             subscriptions.writer_id IS NOT NULL OR subscriptions.kind = 'person', feeds.site_url, feeds.url
         FROM subscriptions JOIN feeds ON feeds.id = subscriptions.feed_id
         LEFT JOIN writers ON writers.id = subscriptions.writer_id AND writers.person_id = subscriptions.person_id
         WHERE subscriptions.person_id = ? AND subscriptions.unsubscribed_at IS NULL
         ORDER BY subscriptions.added_at, subscriptions.feed_id",
    )
    .bind(person)
    .fetch_all(&mut *connection)
    .await?;
    let apart: Vec<(i64, i64)> =
        sqlx::query_as("SELECT feed_a, feed_b FROM kept_apart WHERE person_id = ?")
            .bind(person)
            .fetch_all(&mut *connection)
            .await?;
    let mut rows: Vec<(Option<i64>, Row)> = Vec::new();
    for (feed, writer, name, is_person, site, url) in places {
        let website = site
            .as_deref()
            .and_then(website_of)
            .or_else(|| website_of(&url));
        let row = match writer
            .and_then(|writer| rows.iter_mut().find(|(each, _)| *each == Some(writer)))
        {
            Some((_, row)) => row,
            None => {
                rows.push((
                    writer,
                    Row {
                        joined: writer.is_some(),
                        feeds: Vec::new(),
                        name,
                        person: is_person,
                        sites: Vec::new(),
                    },
                ));
                &mut rows.last_mut().expect("just pushed").1
            }
        };
        row.feeds.push(feed);
        if let Some(website) = website.filter(|website| !row.sites.contains(website)) {
            row.sites.push(website);
        }
    }
    let kept_apart = |one: &Row, other: &Row| {
        one.feeds.iter().any(|a| {
            other
                .feeds
                .iter()
                .any(|b| apart.contains(&(*a.min(b), *a.max(b))))
        })
    };
    let mut found = Vec::new();
    for (at, (_, one)) in rows.iter().enumerate() {
        for (_, other) in &rows[at + 1..] {
            let Some(site) = one.sites.iter().find(|site| other.sites.contains(site)) else {
                continue;
            };
            if !(one.person || other.person) || kept_apart(one, other) {
                continue;
            }
            // First the one whose name a join keeps (`writers::join`): someone already joined, else a
            // person, else the one followed first, so the question names who they'll be.
            let rank = |row: &Row| (row.joined, row.person);
            let (first, second) = if rank(other) > rank(one) {
                (other, one)
            } else {
                (one, other)
            };
            found.push(Alike {
                feeds: [first.feeds[0], second.feeds[0]],
                names: [first.name.clone(), second.name.clone()],
                site: site.clone(),
            });
        }
    }
    // The newest first: the pair the reader just made is the one to ask about.
    found.reverse();
    Ok(found)
}

async fn list_alike(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let found = async {
        let mut connection = state.db.acquire().await?;
        alike(&mut connection, person).await
    }
    .await;
    match found {
        Ok(pairs) => Json(json!({ "pairs": pairs })).into_response(),
        Err(error) => database_problem("finding follows that share a website", &error),
    }
}

#[derive(Deserialize)]
struct ApartForm {
    feeds: [i64; 2],
}

/// "Keep apart": these two are never asked about again. Only places the
/// reader follows; anyone else's number answers "not found".
async fn keep_apart(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<ApartForm>,
) -> Response {
    let [one, other] = form.feeds;
    if one == other {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let kept = async {
        let followed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM subscriptions WHERE person_id = ? AND feed_id IN (?, ?)",
        )
        .bind(person)
        .bind(one)
        .bind(other)
        .fetch_one(&state.db)
        .await?;
        if followed < 2 {
            return Ok(false);
        }
        sqlx::query(
            "INSERT OR IGNORE INTO kept_apart (person_id, feed_a, feed_b) VALUES (?, ?, ?)",
        )
        .bind(person)
        .bind(one.min(other))
        .bind(one.max(other))
        .execute(&state.db)
        .await?;
        Ok::<_, sqlx::Error>(true)
    }
    .await;
    match kept {
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("keeping two apart", &error),
    }
}

#[cfg(test)]
mod tests {
    use super::website_of;

    #[test]
    fn one_website_is_one_host_but_a_shared_site_is_told_apart_by_its_path() {
        assert_eq!(
            website_of("https://www.Alpha.example/news").as_deref(),
            Some("alpha.example")
        );
        assert_eq!(
            website_of("https://alpha.example/").as_deref(),
            Some("alpha.example")
        );
        assert_eq!(
            website_of("https://medium.com/@kai/").as_deref(),
            Some("medium.com/@kai")
        );
        assert_eq!(
            website_of("https://www.youtube.com/channel/UC123").as_deref(),
            Some("youtube.com/channel/UC123")
        );
        assert_eq!(
            website_of("https://kai.substack.com/").as_deref(),
            Some("kai.substack.com")
        );
        assert_eq!(website_of("https://medium.com/"), None);
        assert_eq!(website_of("newsletter:1:kai"), None);
        assert_ne!(
            website_of("https://www.youtube.com/feeds/videos.xml?channel_id=UC1"),
            website_of("https://www.youtube.com/feeds/videos.xml?channel_id=UC2")
        );
    }
}
