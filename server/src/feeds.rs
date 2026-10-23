//! Adding a feed, and listing feeds and their articles (SPEC sections 3, 5
//! and 6).
//!
//! Adding: the reader pastes a feed's address or a website's. slowfeed
//! fetches it once; if it's a web page, it looks in it for the feeds the site
//! names (autodiscovery). One feed is followed straight away; several are
//! offered as a choice; none gets a plain message. Background fetching comes
//! in Milestone 8.

use axum::{
    Json, Router,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    discover, feed,
    fetch::{self, FetchError, Fetched},
    now,
};

/// How many articles the list shows before "Show older items" (SPEC section 6).
pub const PAGE_SIZE: i64 = 50;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/feeds", get(list_feeds).post(add_feed))
        .route("/api/articles", get(list_articles))
}

#[derive(Serialize, sqlx::FromRow)]
struct FeedRow {
    id: i64,
    title: String,
    site_url: Option<String>,
}

/// Every followed feed, alphabetically (SPEC section 5).
async fn list_feeds(_: SignedIn, State(state): State<AppState>) -> Response {
    let feeds: Result<Vec<FeedRow>, sqlx::Error> =
        sqlx::query_as("SELECT id, title, site_url FROM feeds ORDER BY title COLLATE NOCASE, id")
            .fetch_all(&state.db)
            .await;
    match feeds {
        Ok(feeds) => Json(json!({ "feeds": feeds })).into_response(),
        Err(error) => database_problem("listing feeds", &error),
    }
}

#[derive(Deserialize)]
struct AddFeed {
    address: String,
}

/// Why adding didn't work, in words the screen turns into a calm sentence.
#[derive(Debug, PartialEq, Eq)]
enum NotAdded {
    NotAnAddress,
    NotAllowed,
    Unreachable,
    NotFound,
    TooBig,
    NoFeed,
    Already(i64),
    Database,
}

impl IntoResponse for NotAdded {
    fn into_response(self) -> Response {
        let (status, error) = match self {
            Self::NotAnAddress => (StatusCode::BAD_REQUEST, "not-an-address"),
            Self::NotAllowed => (StatusCode::BAD_REQUEST, "not-allowed"),
            Self::Unreachable => (StatusCode::BAD_GATEWAY, "unreachable"),
            Self::NotFound => (StatusCode::BAD_GATEWAY, "not-found"),
            Self::TooBig => (StatusCode::BAD_GATEWAY, "too-big"),
            Self::NoFeed => (StatusCode::UNPROCESSABLE_ENTITY, "no-feed"),
            Self::Already(id) => {
                return (
                    StatusCode::CONFLICT,
                    Json(json!({ "error": "already", "feed_id": id })),
                )
                    .into_response();
            }
            Self::Database => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        };
        (status, Json(json!({ "error": error }))).into_response()
    }
}

impl From<FetchError> for NotAdded {
    fn from(error: FetchError) -> Self {
        match error {
            FetchError::NotAllowed => Self::NotAllowed,
            FetchError::Unreachable => Self::Unreachable,
            FetchError::Status(404 | 410) => Self::NotFound,
            FetchError::Status(_) => Self::Unreachable,
            FetchError::TooBig => Self::TooBig,
        }
    }
}

impl From<sqlx::Error> for NotAdded {
    fn from(error: sqlx::Error) -> Self {
        database_problem("adding a feed", &error);
        Self::Database
    }
}

async fn add_feed(
    _: SignedIn,
    State(state): State<AppState>,
    Json(form): Json<AddFeed>,
) -> Response {
    match add(&state, &form.address).await {
        Ok(Added::Feed(feed)) => {
            (StatusCode::CREATED, Json(json!({ "feed": feed }))).into_response()
        }
        Ok(Added::Choices(choices)) => {
            let choices: Vec<_> = choices
                .into_iter()
                .map(|found| json!({ "title": found.title, "url": found.url.as_str() }))
                .collect();
            Json(json!({ "choices": choices })).into_response()
        }
        Err(not_added) => not_added.into_response(),
    }
}

enum Added {
    Feed(FeedRow),
    /// The page names several feeds; the reader picks one.
    Choices(Vec<discover::Found>),
}

async fn add(state: &AppState, address: &str) -> Result<Added, NotAdded> {
    let url = parse_address(address).ok_or(NotAdded::NotAnAddress)?;
    already_followed(state, &url).await?;
    let local = state.config.local_feeds_allowed;
    let fetched = fetch::get(&state.http, &url, local).await?;

    if let Some(parsed) = feed::parse(&fetched.body, &fetched.final_url) {
        return Ok(Added::Feed(follow(state, &fetched, parsed).await?));
    }

    // Not a feed, so a web page: look for the feeds it names.
    let page = String::from_utf8_lossy(&fetched.body);
    let found = discover::feeds_in(&page, &fetched.final_url);
    match found.as_slice() {
        [] => Err(NotAdded::NoFeed),
        [only] => {
            already_followed(state, &only.url).await?;
            let fetched = fetch::get(&state.http, &only.url, local).await?;
            let parsed = feed::parse(&fetched.body, &fetched.final_url).ok_or(NotAdded::NoFeed)?;
            Ok(Added::Feed(follow(state, &fetched, parsed).await?))
        }
        _ => Ok(Added::Choices(found)),
    }
}

/// What the reader typed, as a web address. `example.com` means
/// `https://example.com`.
fn parse_address(address: &str) -> Option<Url> {
    let address = address.trim();
    if address.is_empty() || address.chars().any(char::is_whitespace) {
        return None;
    }
    let url = if address.contains("://") {
        Url::parse(address).ok()?
    } else {
        Url::parse(&format!("https://{address}")).ok()?
    };
    let named = url
        .host_str()
        .is_some_and(|host| host.contains('.') || host.starts_with('[') || host == "localhost");
    (matches!(url.scheme(), "http" | "https") && named).then_some(url)
}

async fn already_followed(state: &AppState, url: &Url) -> Result<(), NotAdded> {
    let id: Option<i64> = sqlx::query_scalar("SELECT id FROM feeds WHERE url_key = ?")
        .bind(feed::normalize(url))
        .fetch_optional(&state.db)
        .await?;
    id.map_or(Ok(()), |id| Err(NotAdded::Already(id)))
}

/// Remembers the feed and stores its articles, all at once or not at all.
async fn follow(
    state: &AppState,
    fetched: &Fetched,
    parsed: feed::ParsedFeed,
) -> Result<FeedRow, NotAdded> {
    // A feed that moved for good is remembered at its new address.
    let url = &fetched.lasting_url;
    let key = feed::normalize(url);
    let now = now();
    let mut transaction = state.db.begin().await?;

    let inserted: Option<i64> = sqlx::query_scalar(
        "INSERT INTO feeds (url, url_key, title, site_url, language, etag, last_modified, added_at, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (url_key) DO NOTHING
         RETURNING id",
    )
    .bind(url.as_str())
    .bind(&key)
    .bind(&parsed.title)
    .bind(&parsed.site_url)
    .bind(&parsed.language)
    .bind(&fetched.etag)
    .bind(&fetched.last_modified)
    .bind(now)
    .bind(now)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(feed_id) = inserted else {
        // Followed after all, by an address that led to the same feed.
        transaction.rollback().await?;
        let id: i64 = sqlx::query_scalar("SELECT id FROM feeds WHERE url_key = ?")
            .bind(&key)
            .fetch_one(&state.db)
            .await?;
        return Err(NotAdded::Already(id));
    };

    store_articles(&mut transaction, feed_id, &parsed.articles, now).await?;
    transaction.commit().await?;

    Ok(FeedRow {
        id: feed_id,
        title: parsed.title,
        site_url: parsed.site_url,
    })
}

/// Stores new articles; one already stored (same fingerprint, same feed) is
/// left as it is.
pub async fn store_articles(
    connection: &mut sqlx::SqliteConnection,
    feed_id: i64,
    articles: &[feed::ParsedArticle],
    received_at: i64,
) -> Result<(), sqlx::Error> {
    for article in articles {
        let sort_at = article
            .published_at
            .map_or(received_at, |published| published.min(received_at));
        sqlx::query(
            "INSERT INTO articles (feed_id, fingerprint, title, link, author, content, summary,
                 language, published_at, received_at, sort_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (feed_id, fingerprint) DO NOTHING",
        )
        .bind(feed_id)
        .bind(&article.fingerprint)
        .bind(&article.title)
        .bind(&article.link)
        .bind(&article.author)
        .bind(&article.content)
        .bind(&article.summary)
        .bind(&article.language)
        .bind(article.published_at)
        .bind(received_at)
        .bind(sort_at)
        .execute(&mut *connection)
        .await?;
    }
    Ok(())
}

#[derive(Deserialize)]
struct ArticlesQuery {
    /// Only this feed's articles; all feeds when absent.
    feed: Option<i64>,
    /// Where the previous page ended, as `time:id`, for "Show older items".
    before: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct ArticleRow {
    pub id: i64,
    pub feed_id: i64,
    pub feed_title: String,
    pub title: String,
    pub link: Option<String>,
    /// Seconds since 1970 (UTC); the screen shows it in the device's time zone.
    pub at: i64,
}

/// One page of the item list, newest first. `older` says where the next page
/// starts, or is null at the very end.
async fn list_articles(
    _: SignedIn,
    State(state): State<AppState>,
    Query(query): Query<ArticlesQuery>,
) -> Response {
    let before = match query.before.as_deref().map(parse_cursor) {
        None => None,
        Some(Some(cursor)) => Some(cursor),
        Some(None) => return StatusCode::BAD_REQUEST.into_response(),
    };
    match page(&state.db, query.feed, before).await {
        Ok((articles, older)) => {
            let older = older.map(|(at, id)| format!("{at}:{id}"));
            Json(json!({ "articles": articles, "older": older })).into_response()
        }
        Err(error) => database_problem("listing articles", &error),
    }
}

fn parse_cursor(text: &str) -> Option<(i64, i64)> {
    let (at, id) = text.split_once(':')?;
    Some((at.parse().ok()?, id.parse().ok()?))
}

/// The two item-list questions, one per index, so the database always picks
/// the right one. `CROSS JOIN` tells SQLite to walk the articles in list
/// order and look up each one's feed, rather than sorting afterwards
/// (tests/speed.rs checks this).
macro_rules! newest_articles {
    ($filter:literal) => {
        concat!(
            "SELECT articles.id, articles.feed_id, feeds.title AS feed_title,
                    articles.title, articles.link, articles.sort_at AS at
             FROM articles CROSS JOIN feeds ON feeds.id = articles.feed_id
             WHERE ",
            $filter,
            " (articles.sort_at, articles.id) < (?, ?)
             ORDER BY articles.sort_at DESC, articles.id DESC
             LIMIT ?"
        )
    };
}
pub const ALL_FEEDS: &str = newest_articles!("");
pub const ONE_FEED: &str = newest_articles!("articles.feed_id = ? AND");

/// The newest articles older than `before`, using the list's indexes. One
/// extra row is asked for, to know whether an older page exists.
pub async fn page(
    db: &sqlx::SqlitePool,
    feed: Option<i64>,
    before: Option<(i64, i64)>,
) -> Result<(Vec<ArticleRow>, Option<(i64, i64)>), sqlx::Error> {
    let (before_at, before_id) = before.unwrap_or((i64::MAX, i64::MAX));
    let mut query = sqlx::query_as(if feed.is_some() { ONE_FEED } else { ALL_FEEDS });
    if let Some(feed) = feed {
        query = query.bind(feed);
    }
    let mut rows: Vec<ArticleRow> = query
        .bind(before_at)
        .bind(before_id)
        .bind(PAGE_SIZE + 1)
        .fetch_all(db)
        .await?;
    let older = if rows.len() > usize::try_from(PAGE_SIZE).unwrap_or(usize::MAX) {
        rows.pop();
        rows.last().map(|last| (last.at, last.id))
    } else {
        None
    };
    Ok((rows, older))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn typed_addresses_become_web_addresses() {
        let parsed = |text: &str| parse_address(text).map(String::from);
        assert_eq!(
            parsed("example.com").as_deref(),
            Some("https://example.com/")
        );
        assert_eq!(
            parsed("  http://example.com/blog  ").as_deref(),
            Some("http://example.com/blog")
        );
        assert_eq!(parsed(""), None);
        assert_eq!(parsed("hello"), None);
        assert_eq!(parsed("two words.com"), None);
        assert_eq!(parsed("ftp://example.com/"), None);
        assert_eq!(parsed("javascript:alert(1)"), None);
    }

    #[test]
    fn page_positions_are_read_strictly() {
        assert_eq!(parse_cursor("1700000000:42"), Some((1_700_000_000, 42)));
        assert_eq!(parse_cursor("1700000000"), None);
        assert_eq!(parse_cursor("a:b"), None);
    }
}
