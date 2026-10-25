//! Adding a feed, listing feeds and their articles, and reading one article
//! (SPEC sections 3, 5, 6 and 7). Marking articles read or starred is in
//! `marks`; folders, editing feeds and unsubscribing in `folders`.
//!
//! Adding: the reader pastes a feed's address or a website's. nine turtles
//! fetches it once; if it's a web page, it looks in it for the feeds the site
//! names (autodiscovery). One feed is followed straight away; several are
//! offered as a choice; none gets a plain message. After that, `checking`
//! looks at the feed again in the background, on its own rhythm.

use axum::{
    Json, Router,
    extract::{Path, Query, State},
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
    checking, discover, feed,
    fetch::{self, FetchError, Fetched},
    folders::{self, FOLDERS, Folder, MEMBERSHIPS},
    log, now, rules, search, websub,
};

/// How many articles the list shows before "Show older items" (SPEC section 6).
pub const PAGE_SIZE: i64 = 50;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/feeds", get(list_feeds).post(add_feed))
        .route("/api/articles", get(list_articles))
        .route("/api/articles/new", get(new_articles))
        .route("/api/articles/{id}", get(read_article))
}

#[derive(Serialize, sqlx::FromRow)]
struct FeedRow {
    id: i64,
    title: String,
    site_url: Option<String>,
    /// How many of its articles are unread, for the sidebar's muted count.
    unread: i64,
    /// The folders it's in, by number.
    #[sqlx(skip)]
    folders: Vec<i64>,
}

/// Each followed feed's unread count, counted from the
/// `articles_unread_by_feed` index alone (tests/speed.rs checks this).
pub const FEEDS: &str = "SELECT id, title, site_url,
        (SELECT COUNT(*) FROM articles WHERE articles.feed_id = feeds.id AND articles.read = 0) AS unread
     FROM feeds WHERE unsubscribed_at IS NULL ORDER BY title COLLATE NOCASE, id";

/// Every followed feed, alphabetically, with its unread count and folders,
/// and every folder, alphabetically (SPEC section 5).
async fn list_feeds(_: SignedIn, State(state): State<AppState>) -> Response {
    let listed: Result<(Vec<FeedRow>, Vec<Folder>), sqlx::Error> = async {
        let mut connection = state.db.acquire().await?;
        // One snapshot, so the feeds, folders and memberships agree.
        let mut transaction = sqlx::Connection::begin(&mut *connection).await?;
        let mut feeds: Vec<FeedRow> = sqlx::query_as(FEEDS).fetch_all(&mut *transaction).await?;
        let folders: Vec<Folder> = sqlx::query_as(FOLDERS).fetch_all(&mut *transaction).await?;
        let memberships: Vec<(i64, i64)> = sqlx::query_as(MEMBERSHIPS)
            .fetch_all(&mut *transaction)
            .await?;
        transaction.commit().await?;
        let mut by_feed = std::collections::HashMap::<i64, Vec<i64>>::new();
        for (feed, folder) in memberships {
            by_feed.entry(feed).or_default().push(folder);
        }
        for feed in &mut feeds {
            feed.folders = by_feed.remove(&feed.id).unwrap_or_default();
        }
        Ok((feeds, folders))
    }
    .await;
    match listed {
        Ok((feeds, folders)) => Json(json!({ "feeds": feeds, "folders": folders })).into_response(),
        Err(error) => database_problem("listing feeds", &error),
    }
}

#[derive(Deserialize)]
struct AddFeed {
    address: String,
}

/// Why adding didn't work, in words the screen turns into a calm sentence.
#[derive(Debug, PartialEq, Eq)]
pub enum NotAdded {
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
            FetchError::Status(_) | FetchError::SlowDown(_) => Self::Unreachable,
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

/// Following a feed from another app (`greader`, SPEC section 26): as the
/// Add field does, except that a page naming several feeds follows the
/// first, a feed already followed is simply answered, and a feed unfollowed
/// in the last few minutes (not yet cleared) comes back as it was, with its
/// articles, read marks and folders, as Undo would bring it back.
pub async fn add_for_app(state: &AppState, address: &str) -> Result<i64, NotAdded> {
    let url = parse_address(address).ok_or(NotAdded::NotAnAddress)?;
    if let Some(id) = bring_back(state, &url).await? {
        return Ok(id);
    }
    let address = match add(state, url.as_str()).await {
        Ok(Added::Feed(feed)) => return Ok(feed.id),
        Err(NotAdded::Already(id)) => return Ok(id),
        Err(not_added) => return Err(not_added),
        Ok(Added::Choices(choices)) => match choices.into_iter().next() {
            Some(first) => first.url,
            None => return Err(NotAdded::NoFeed),
        },
    };
    if let Some(id) = bring_back(state, &address).await? {
        return Ok(id);
    }
    match add(state, address.as_str()).await {
        Ok(Added::Feed(feed)) => Ok(feed.id),
        Err(NotAdded::Already(id)) => Ok(id),
        Ok(Added::Choices(_)) => Err(NotAdded::NoFeed),
        Err(not_added) => Err(not_added),
    }
}

/// Follows again a feed at this address that was unfollowed but not yet
/// cleared, as Undo does.
async fn bring_back(state: &AppState, url: &Url) -> Result<Option<i64>, sqlx::Error> {
    sqlx::query_scalar(
        "UPDATE feeds SET unsubscribed_at = NULL, next_check_at = ?
         WHERE url_key = ? AND unsubscribed_at IS NOT NULL AND cleared = 0
         RETURNING id",
    )
    .bind(now())
    .bind(feed::normalize(url))
    .fetch_optional(&state.db)
    .await
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
    let id: Option<i64> =
        sqlx::query_scalar("SELECT id FROM feeds WHERE url_key = ? AND unsubscribed_at IS NULL")
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
    let every = checking::rhythm(&parsed, now);
    let hub = parsed.hub.clone();
    let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
    make_room(&mut transaction, &key).await?;

    let inserted: Option<i64> = sqlx::query_scalar(
        "INSERT INTO feeds (url, url_key, title, site_url, language, etag, last_modified, added_at,
             fetched_at, check_every, next_check_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (url_key) DO UPDATE SET
             url = excluded.url, title = excluded.title, site_url = excluded.site_url,
             language = excluded.language, etag = excluded.etag,
             last_modified = excluded.last_modified, added_at = excluded.added_at,
             fetched_at = excluded.fetched_at, check_every = excluded.check_every,
             next_check_at = excluded.next_check_at, failures = 0, failing_since = NULL,
             missing_since = NULL, problem = NULL, unsubscribed_at = NULL, cleared = 0
         WHERE feeds.unsubscribed_at IS NOT NULL
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
    .bind(every)
    .bind(now + checking::wait(state, every))
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
    let unread = sqlx::query_scalar("SELECT COUNT(*) FROM articles WHERE feed_id = ? AND read = 0")
        .bind(feed_id)
        .fetch_one(&mut *transaction)
        .await?;
    transaction.commit().await?;
    // Signing up with the feed's hub, if it has one, needn't hold up adding it.
    let background = state.clone();
    tokio::spawn(async move {
        if let Err(error) = websub::offered(&background, feed_id, hub.as_ref(), now).await {
            log::problem(&format!(
                "database error while signing up with a hub: {error}"
            ));
        }
    });

    Ok(FeedRow {
        id: feed_id,
        title: parsed.title,
        site_url: parsed.site_url,
        unread,
        folders: Vec::new(),
    })
}

/// Following again a feed the reader unsubscribed from starts it afresh:
/// whatever Undo could still have brought back is cleared first, so only
/// its starred articles carry over. The feed's line is then reused (or
/// made anew if nothing needed it).
pub async fn make_room(
    connection: &mut sqlx::SqliteConnection,
    url_key: &str,
) -> Result<(), sqlx::Error> {
    let waiting: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM feeds WHERE url_key = ? AND unsubscribed_at IS NOT NULL AND cleared = 0",
    )
    .bind(url_key)
    .fetch_optional(&mut *connection)
    .await?;
    if let Some(id) = waiting {
        folders::clear(connection, id).await?;
    }
    Ok(())
}

/// Stores new articles, numbered above every article ever stored, even ones
/// since removed by unsubscribing, so "anything newer than article N?"
/// never misses one and a number never means two articles. One already stored
/// (same fingerprint, same feed) that the publisher has since edited gets
/// the new words quietly: it keeps its place in the list, its read mark and
/// its star (SPEC section 11). The reader's rules then act on the new ones
/// (SPEC section 27).
pub async fn store_articles(
    connection: &mut sqlx::SqliteConnection,
    feed_id: i64,
    articles: &[feed::ParsedArticle],
    received_at: i64,
) -> Result<(), sqlx::Error> {
    // An article a feed lists twice counts once, as it's first listed, so
    // a check never flips it back and forth between the two.
    let mut seen = std::collections::HashSet::new();
    // Every new article is numbered above this; an edited one keeps its number.
    let before: i64 = sqlx::query_scalar(LATEST)
        .fetch_one(&mut *connection)
        .await?;
    for article in articles {
        if !seen.insert(article.fingerprint.as_str()) {
            continue;
        }
        let sort_at = article
            .published_at
            .map_or(received_at, |published| published.min(received_at));
        let stored: Option<i64> = sqlx::query_scalar(
            "INSERT INTO articles (id, feed_id, fingerprint, title, link, author, content,
                 summary, language, published_at, received_at, sort_at)
             VALUES (1 + MAX(COALESCE((SELECT MAX(id) FROM articles), 0),
                     COALESCE((SELECT CAST(value AS INTEGER) FROM settings
                               WHERE name = 'articles_high_water'), 0)),
                 ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (feed_id, fingerprint) DO UPDATE SET
                 title = excluded.title, link = excluded.link, author = excluded.author,
                 content = excluded.content, summary = excluded.summary,
                 language = excluded.language
             WHERE articles.title IS NOT excluded.title OR articles.link IS NOT excluded.link
                 OR articles.author IS NOT excluded.author
                 OR articles.content IS NOT excluded.content
                 OR articles.summary IS NOT excluded.summary
                 OR articles.language IS NOT excluded.language
             RETURNING id",
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
        .fetch_optional(&mut *connection)
        .await?;
        // New, or edited since: the search index gets its words.
        if let Some(id) = stored {
            search::index(
                connection,
                id,
                &article.title,
                article.content.as_deref(),
                article.summary.as_deref(),
            )
            .await?;
        }
    }
    rules::apply_to_new(connection, feed_id, before).await
}

/// Which articles a list shows (SPEC sections 4 and 6).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum List {
    All,
    Unread,
    Starred,
    /// One feed's articles, read or not.
    Feed(i64),
    /// The articles of every feed in a folder, read or not.
    Folder(i64),
}

/// The list's order: the reader's "Sort" setting (SPEC section 18).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Order {
    #[default]
    Newest,
    Oldest,
}

impl List {
    /// A feed's or a folder's articles if one is named, otherwise the view's.
    const fn from_query(feed: Option<i64>, folder: Option<i64>, view: View) -> Self {
        match (feed, folder, view) {
            (Some(feed), _, _) => Self::Feed(feed),
            (None, Some(folder), _) => Self::Folder(folder),
            (None, None, View::All) => Self::All,
            (None, None, View::Unread) => Self::Unread,
            (None, None, View::Starred) => Self::Starred,
        }
    }
}

#[derive(Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
enum View {
    #[default]
    All,
    Unread,
    Starred,
}

#[derive(Deserialize)]
struct ArticlesQuery {
    /// Only this feed's articles (all of them); otherwise `folder`, then
    /// `view`, decides.
    feed: Option<i64>,
    folder: Option<i64>,
    #[serde(default)]
    view: View,
    #[serde(default)]
    order: Order,
    /// Where the previous page ended, as `time:id`, for "Show older items"
    /// (or "Show newer items" when the list is oldest first).
    after: Option<String>,
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
    pub read: bool,
    pub starred: bool,
    /// A rule (or the reader) muted it: only search and the Muted page show it.
    pub muted: bool,
}

/// One page of the item list. `next` says where the next page starts, or is
/// null at the very end.
async fn list_articles(
    _: SignedIn,
    State(state): State<AppState>,
    Query(query): Query<ArticlesQuery>,
) -> Response {
    let after = match query.after.as_deref().map(parse_cursor) {
        None => None,
        Some(Some(cursor)) => Some(cursor),
        Some(None) => return StatusCode::BAD_REQUEST.into_response(),
    };
    let list = List::from_query(query.feed, query.folder, query.view);
    // Asked before the list, so an article arriving in between is reported
    // as new rather than missed.
    let latest: Result<i64, sqlx::Error> = sqlx::query_scalar(LATEST).fetch_one(&state.db).await;
    let listed = match latest {
        Ok(latest) => page(&state.db, list, query.order, after)
            .await
            .map(|listed| (latest, listed)),
        Err(error) => Err(error),
    };
    match listed {
        Ok((latest, (articles, next))) => {
            let next = next.map(|(at, id)| format!("{at}:{id}"));
            Json(json!({ "articles": articles, "next": next, "latest": latest })).into_response()
        }
        Err(error) => database_problem("listing articles", &error),
    }
}

/// The newest article's number. Articles are numbered as they arrive, so
/// any article with a higher number came after the list was loaded.
pub const LATEST: &str = "SELECT COALESCE(MAX(id), 0) FROM articles";

/// "Has anything arrived for this list since article `since`?", one question
/// per list. Each reads only the articles that arrived since, by number (the
/// `+` keeps SQLite from reading the whole feed through its index instead).
pub const fn new_sql(list: List) -> Option<&'static str> {
    match list {
        List::All => Some("SELECT EXISTS (SELECT 1 FROM articles WHERE id > ? AND +muted = 0)"),
        List::Unread => Some("SELECT EXISTS (SELECT 1 FROM articles WHERE id > ? AND +read = 0)"),
        List::Feed(_) => Some(
            "SELECT EXISTS (SELECT 1 FROM articles WHERE id > ? AND +muted = 0 AND +feed_id = ?)",
        ),
        List::Folder(_) => Some(
            "SELECT EXISTS (SELECT 1 FROM articles WHERE id > ? AND +muted = 0
                 AND +feed_id IN (SELECT feed_id FROM feed_folders WHERE folder_id = ?))",
        ),
        // Nothing arrives starred.
        List::Starred => None,
    }
}

#[derive(Deserialize)]
struct NewQuery {
    feed: Option<i64>,
    folder: Option<i64>,
    #[serde(default)]
    view: View,
    /// The `latest` the list was loaded with.
    since: i64,
}

/// Whether new articles are waiting for the list on screen, so it can say
/// "New items · press r" (SPEC section 13). It never says how many.
async fn new_articles(
    _: SignedIn,
    State(state): State<AppState>,
    Query(query): Query<NewQuery>,
) -> Response {
    let list = List::from_query(query.feed, query.folder, query.view);
    let Some(sql) = new_sql(list) else {
        return Json(json!({ "new": false })).into_response();
    };
    let mut question = sqlx::query_scalar(sql).bind(query.since);
    if let List::Feed(id) | List::Folder(id) = list {
        question = question.bind(id);
    }
    let found: Result<bool, sqlx::Error> = question.fetch_one(&state.db).await;
    match found {
        Ok(found) => Json(json!({ "new": found })).into_response(),
        Err(error) => database_problem("looking for new articles", &error),
    }
}

fn parse_cursor(text: &str) -> Option<(i64, i64)> {
    let (at, id) = text.split_once(':')?;
    Some((at.parse().ok()?, id.parse().ok()?))
}

/// The item-list questions, one per list and order, each matching one index
/// so the database always picks the right one: `articles_newest`,
/// `articles_newest_by_feed`, `articles_unread` and `articles_starred`, read
/// backwards for oldest first. `CROSS JOIN` tells SQLite to walk the
/// articles in list order and look up each one's feed, rather than sorting
/// afterwards (tests/speed.rs checks this). A folder's list walks every
/// article in order too, keeping its feeds' (the `+` stops SQLite from
/// gathering them feed by feed and sorting them all on the spot).
///
/// Unread and All leave out feeds the reader has unsubscribed from; Starred
/// keeps their starred articles (SPEC section 15). Only Starred shows muted
/// articles (muted ones are read, so never in Unread; SPEC section 27).
macro_rules! list_query {
    ($filter:literal, $past:literal, $order:literal) => {
        concat!(
            "SELECT articles.id, articles.feed_id, feeds.title AS feed_title,
                    articles.title, articles.link, articles.sort_at AS at,
                    articles.read, articles.starred, articles.muted
             FROM articles CROSS JOIN feeds ON feeds.id = articles.feed_id
             WHERE ",
            $filter,
            " (articles.sort_at, articles.id) ",
            $past,
            " (?, ?)
             ORDER BY articles.sort_at ",
            $order,
            ", articles.id ",
            $order,
            " LIMIT ?"
        )
    };
}

/// The question for a list in an order. A feed's or folder's question takes
/// its ID first; every question then takes the cursor (time, id) and the limit.
pub const fn list_sql(list: List, order: Order) -> &'static str {
    match (list, order) {
        (List::All, Order::Newest) => list_query!(
            "articles.muted = 0 AND feeds.unsubscribed_at IS NULL AND",
            "<",
            "DESC"
        ),
        (List::All, Order::Oldest) => list_query!(
            "articles.muted = 0 AND feeds.unsubscribed_at IS NULL AND",
            ">",
            "ASC"
        ),
        (List::Unread, Order::Newest) => list_query!(
            "articles.read = 0 AND feeds.unsubscribed_at IS NULL AND",
            "<",
            "DESC"
        ),
        (List::Unread, Order::Oldest) => list_query!(
            "articles.read = 0 AND feeds.unsubscribed_at IS NULL AND",
            ">",
            "ASC"
        ),
        (List::Starred, Order::Newest) => list_query!("articles.starred = 1 AND", "<", "DESC"),
        (List::Starred, Order::Oldest) => list_query!("articles.starred = 1 AND", ">", "ASC"),
        (List::Feed(_), Order::Newest) => list_query!(
            "articles.feed_id = ? AND articles.muted = 0 AND",
            "<",
            "DESC"
        ),
        (List::Feed(_), Order::Oldest) => list_query!(
            "articles.feed_id = ? AND articles.muted = 0 AND",
            ">",
            "ASC"
        ),
        (List::Folder(_), Order::Newest) => list_query!(
            "+articles.feed_id IN (SELECT feed_id FROM feed_folders WHERE folder_id = ?)
                 AND articles.muted = 0 AND feeds.unsubscribed_at IS NULL AND",
            "<",
            "DESC"
        ),
        (List::Folder(_), Order::Oldest) => list_query!(
            "+articles.feed_id IN (SELECT feed_id FROM feed_folders WHERE folder_id = ?)
                 AND articles.muted = 0 AND feeds.unsubscribed_at IS NULL AND",
            ">",
            "ASC"
        ),
    }
}

/// One page of a list, starting after `after` (from the start when absent),
/// using the list's index. One extra row is asked for, to know whether
/// another page exists.
pub async fn page(
    db: &sqlx::SqlitePool,
    list: List,
    order: Order,
    after: Option<(i64, i64)>,
) -> Result<(Vec<ArticleRow>, Option<(i64, i64)>), sqlx::Error> {
    let start = match order {
        Order::Newest => (i64::MAX, i64::MAX),
        Order::Oldest => (i64::MIN, i64::MIN),
    };
    let (after_at, after_id) = after.unwrap_or(start);
    let mut query = sqlx::query_as(list_sql(list, order));
    if let List::Feed(id) | List::Folder(id) = list {
        query = query.bind(id);
    }
    let mut rows: Vec<ArticleRow> = query
        .bind(after_at)
        .bind(after_id)
        .bind(PAGE_SIZE + 1)
        .fetch_all(db)
        .await?;
    let next = if rows.len() > usize::try_from(PAGE_SIZE).unwrap_or(usize::MAX) {
        rows.pop();
        rows.last().map(|last| (last.at, last.id))
    } else {
        None
    };
    Ok((rows, next))
}

/// One article, everything the reading area shows (SPEC section 7).
#[derive(Serialize, sqlx::FromRow)]
pub struct FullArticle {
    pub id: i64,
    pub feed_id: i64,
    pub feed_title: String,
    /// The publisher's website, so the source is credited with a link.
    pub site_url: Option<String>,
    pub title: String,
    /// The original article: "Open original" and Copy link go here.
    pub link: Option<String>,
    pub author: Option<String>,
    /// The article's text, already cleaned (feed.rs). Null when the feed
    /// gives only a summary.
    pub content: Option<String>,
    pub summary: Option<String>,
    /// The article's language, or its feed's; null if neither says.
    pub language: Option<String>,
    /// Seconds since 1970 (UTC), as in the list.
    pub at: i64,
    pub read: bool,
    pub starred: bool,
}

async fn read_article(_: SignedIn, State(state): State<AppState>, Path(id): Path<i64>) -> Response {
    let article: Result<Option<FullArticle>, sqlx::Error> = sqlx::query_as(
        "SELECT articles.id, articles.feed_id, feeds.title AS feed_title, feeds.site_url,
                articles.title, articles.link, articles.author, articles.content,
                articles.summary, COALESCE(articles.language, feeds.language) AS language,
                articles.sort_at AS at, articles.read, articles.starred
         FROM articles JOIN feeds ON feeds.id = articles.feed_id
         WHERE articles.id = ?",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;
    match article {
        Ok(Some(mut article)) => {
            // Articles stored before tracking images were removed on arrival
            // (Milestone 5) lose them here instead.
            article.content = article
                .content
                .map(|html| feed::without_tracking_images(&html));
            article.summary = article
                .summary
                .map(|html| feed::without_tracking_images(&html));
            article.language = article.language.filter(|tag| is_language_tag(tag));
            Json(json!({ "article": article })).into_response()
        }
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("reading an article", &error),
    }
}

/// A language as feeds write it (`en`, `en-GB`, `hi`), so screen readers can
/// use it. Anything else is left out rather than guessed.
fn is_language_tag(tag: &str) -> bool {
    let mut parts = tag.split('-');
    let first = parts.next().unwrap_or("");
    (2..=8).contains(&first.len())
        && first.chars().all(|c| c.is_ascii_alphabetic())
        && parts.all(|part| {
            (1..=8).contains(&part.len()) && part.chars().all(|c| c.is_ascii_alphanumeric())
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_real_language_tags_mark_an_article() {
        for good in ["en", "en-GB", "hi", "zh-Hant-TW", "pt-br"] {
            assert!(is_language_tag(good), "{good}");
        }
        for bad in ["", "e", "en_GB", "english language", "en-", "<b>"] {
            assert!(!is_language_tag(bad), "{bad}");
        }
    }

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
