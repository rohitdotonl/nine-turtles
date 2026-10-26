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
    AppState, admin,
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
        .route("/api/articles/several", get(read_several))
        .route("/api/articles/{id}", get(read_article))
}

#[derive(Serialize, sqlx::FromRow)]
struct FeedRow {
    id: i64,
    title: String,
    site_url: Option<String>,
    /// How many of its articles are unread, for the sidebar's muted count;
    /// none for a feed that flows past.
    unread: i64,
    /// Its settings from Edit feed (SPEC section 15): it flows past as in
    /// river mode, the shortest wait between checks (seconds, 0 for its own
    /// rhythm), and whether its articles open on the publisher's site.
    river: bool,
    check_at_most: i64,
    open_on_site: bool,
    /// When the reader paused it, if it's paused.
    paused_at: Option<i64>,
    /// The folders it's in, by number.
    #[sqlx(skip)]
    folders: Vec<i64>,
}

/// Each feed a reader follows, with their name for it, their settings and
/// their unread count, counted from the `entries_unread_by_feed` index alone
/// (tests/speed.rs checks this). A feed that flows past (`river`) counts
/// nothing. Takes the reader.
pub const FEEDS: &str = "SELECT feeds.id, subscriptions.title, feeds.site_url, subscriptions.river,
        subscriptions.check_at_most, subscriptions.open_on_site, subscriptions.paused_at,
        CASE WHEN subscriptions.river THEN 0 ELSE
            (SELECT COUNT(*) FROM entries WHERE entries.person_id = subscriptions.person_id
                 AND entries.feed_id = subscriptions.feed_id AND entries.read = 0)
        END AS unread
     FROM subscriptions JOIN feeds ON feeds.id = subscriptions.feed_id
     WHERE subscriptions.person_id = ? AND subscriptions.unsubscribed_at IS NULL
     ORDER BY subscriptions.title COLLATE NOCASE, feeds.id";

/// Every followed feed, alphabetically, with its unread count and folders,
/// and every folder, alphabetically (SPEC section 5).
async fn list_feeds(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let listed: Result<(Vec<FeedRow>, Vec<Folder>), sqlx::Error> = async {
        let mut connection = state.db.acquire().await?;
        // One snapshot, so the feeds, folders and memberships agree.
        let mut transaction = sqlx::Connection::begin(&mut *connection).await?;
        let mut feeds: Vec<FeedRow> = sqlx::query_as(FEEDS)
            .bind(person)
            .fetch_all(&mut *transaction)
            .await?;
        let folders: Vec<Folder> = sqlx::query_as(FOLDERS)
            .bind(person)
            .fetch_all(&mut *transaction)
            .await?;
        let memberships: Vec<(i64, i64)> = sqlx::query_as(MEMBERSHIPS)
            .bind(person)
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
    /// The reader follows as many feeds as one reader can (`admin::MOST_FEEDS`).
    TooMany,
    /// The reader's trial or plan has ended (`payments`).
    PlanEnded,
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
            Self::TooMany => (StatusCode::CONFLICT, "too-many"),
            Self::PlanEnded => (StatusCode::PAYMENT_REQUIRED, "plan-ended"),
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
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<AddFeed>,
) -> Response {
    match add(&state, person, &form.address).await {
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

async fn add(state: &AppState, person: i64, address: &str) -> Result<Added, NotAdded> {
    let url = parse_address(address).ok_or(NotAdded::NotAnAddress)?;
    already_followed(state, person, &url).await?;
    if !crate::payments::may_add_feeds(state, person).await? {
        return Err(NotAdded::PlanEnded);
    }
    // Asked before anything is fetched, so no publisher is bothered for
    // nothing; asked again as the feed is followed.
    if !admin::room_for_one_more(&mut *state.db.acquire().await?, person).await? {
        return Err(NotAdded::TooMany);
    }
    let local = state.config.local_feeds_allowed;
    let fetched = fetch::get(&state.http, &url, local).await?;

    if let Some(parsed) = feed::parse(&fetched.body, &fetched.final_url) {
        return Ok(Added::Feed(follow(state, person, &fetched, parsed).await?));
    }

    // Not a feed, so a web page: look for the feeds it names.
    let page = String::from_utf8_lossy(&fetched.body);
    let found = discover::feeds_in(&page, &fetched.final_url);
    match found.as_slice() {
        [] => Err(NotAdded::NoFeed),
        [only] => {
            already_followed(state, person, &only.url).await?;
            let fetched = fetch::get(&state.http, &only.url, local).await?;
            let parsed = feed::parse(&fetched.body, &fetched.final_url).ok_or(NotAdded::NoFeed)?;
            Ok(Added::Feed(follow(state, person, &fetched, parsed).await?))
        }
        _ => Ok(Added::Choices(found)),
    }
}

/// Following a feed from another app (`greader`, SPEC section 26): as the
/// Add field does, except that a page naming several feeds follows the
/// first, a feed already followed is simply answered, and a feed unfollowed
/// in the last few minutes (not yet cleared) comes back as it was, with its
/// articles, read marks and folders, as Undo would bring it back.
pub async fn add_for_app(state: &AppState, person: i64, address: &str) -> Result<i64, NotAdded> {
    let url = parse_address(address).ok_or(NotAdded::NotAnAddress)?;
    if let Some(id) = bring_back(state, person, &url).await? {
        return Ok(id);
    }
    let address = match add(state, person, url.as_str()).await {
        Ok(Added::Feed(feed)) => return Ok(feed.id),
        Err(NotAdded::Already(id)) => return Ok(id),
        Err(not_added) => return Err(not_added),
        Ok(Added::Choices(choices)) => match choices.into_iter().next() {
            Some(first) => first.url,
            None => return Err(NotAdded::NoFeed),
        },
    };
    if let Some(id) = bring_back(state, person, &address).await? {
        return Ok(id);
    }
    match add(state, person, address.as_str()).await {
        Ok(Added::Feed(feed)) => Ok(feed.id),
        Err(NotAdded::Already(id)) => Ok(id),
        Ok(Added::Choices(_)) => Err(NotAdded::NoFeed),
        Err(not_added) => Err(not_added),
    }
}

/// Follows again a feed at this address that the reader unfollowed but
/// that isn't cleared yet, as Undo does.
async fn bring_back(state: &AppState, person: i64, url: &Url) -> Result<Option<i64>, sqlx::Error> {
    let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
    let waiting: Option<i64> = sqlx::query_scalar(
        "SELECT feeds.id FROM feeds JOIN subscriptions ON subscriptions.feed_id = feeds.id
         WHERE feeds.url_key = ? AND subscriptions.person_id = ?
             AND subscriptions.unsubscribed_at IS NOT NULL AND subscriptions.cleared = 0",
    )
    .bind(feed::normalize(url))
    .bind(person)
    .fetch_optional(&mut *transaction)
    .await?;
    if let Some(id) = waiting {
        follow_again(&mut transaction, person, id, now()).await?;
    }
    transaction.commit().await?;
    Ok(waiting)
}

/// Undo for unsubscribing: the reader's subscription comes back as it was,
/// if it isn't cleared yet, and a feed nobody else followed meanwhile is
/// checked again soon. Answers whether it came back.
pub async fn follow_again(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    feed_id: i64,
    now: i64,
) -> Result<bool, sqlx::Error> {
    let back = sqlx::query(
        "UPDATE subscriptions SET unsubscribed_at = NULL
         WHERE person_id = ? AND feed_id = ? AND unsubscribed_at IS NOT NULL AND cleared = 0",
    )
    .bind(person)
    .bind(feed_id)
    .execute(&mut *connection)
    .await?;
    if back.rows_affected() == 0 {
        return Ok(false);
    }
    sqlx::query("UPDATE feeds SET next_check_at = ? WHERE id = ? AND unsubscribed_at IS NOT NULL")
        .bind(now)
        .bind(feed_id)
        .execute(&mut *connection)
        .await?;
    refresh_shared(connection, feed_id).await?;
    Ok(true)
}

/// Works out again what a feed's followers share, after any change to who
/// follows it or how: `feeds.unsubscribed_at` is null while anyone follows
/// it (so background checks and WebSub carry on), and `feeds.check_at_most`
/// is the shortest wait any follower allows (0, its own rhythm, if any
/// says so).
pub async fn refresh_shared(
    connection: &mut sqlx::SqliteConnection,
    feed_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE feeds SET
             unsubscribed_at = CASE
                 WHEN EXISTS (SELECT 1 FROM subscriptions
                              WHERE feed_id = feeds.id AND unsubscribed_at IS NULL) THEN NULL
                 ELSE COALESCE((SELECT MAX(unsubscribed_at) FROM subscriptions
                                WHERE feed_id = feeds.id),
                               feeds.unsubscribed_at, unixepoch())
             END,
             check_at_most = COALESCE((SELECT MIN(check_at_most) FROM subscriptions
                                       WHERE feed_id = feeds.id AND unsubscribed_at IS NULL), 0)
         WHERE id = ?",
    )
    .bind(feed_id)
    .execute(connection)
    .await?;
    Ok(())
}

/// The reader follows a feed already stored: a new subscription with the
/// name given and every setting as new, or their old one (kept for its
/// starred articles) started afresh.
pub async fn subscribe(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    feed_id: i64,
    title: &str,
    now: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (person_id, feed_id) DO UPDATE SET
             title = excluded.title, added_at = excluded.added_at, unsubscribed_at = NULL,
             cleared = 0, river = 0, check_at_most = 0, open_on_site = 0,
             paused_at = NULL",
    )
    .bind(person)
    .bind(feed_id)
    .bind(title)
    .bind(now)
    .execute(&mut *connection)
    .await?;
    refresh_shared(connection, feed_id).await
}

/// Gives a reader who just followed a feed their own entry for each of its
/// articles already stored (for other readers): the ones the publisher
/// still lists (`fresh`) unread, older ones read. Entries they already have
/// (starred ones kept from before) stay as they are. Their rules then act on
/// the unread ones, as on any new article.
pub async fn enter_stored(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    feed_id: i64,
    fresh: &[feed::ParsedArticle],
) -> Result<(), sqlx::Error> {
    let mut unread = Vec::new();
    for article in fresh {
        let entered: Option<i64> = sqlx::query_scalar(
            "INSERT OR IGNORE INTO entries (person_id, article_id, feed_id, sort_at)
             SELECT ?, id, feed_id, sort_at FROM articles WHERE feed_id = ? AND fingerprint = ?
             RETURNING article_id",
        )
        .bind(person)
        .bind(feed_id)
        .bind(&article.fingerprint)
        .fetch_optional(&mut *connection)
        .await?;
        unread.extend(entered);
    }
    sqlx::query(
        "INSERT OR IGNORE INTO entries (person_id, article_id, feed_id, sort_at, read)
         SELECT ?, id, feed_id, sort_at, 1 FROM articles WHERE feed_id = ?",
    )
    .bind(person)
    .bind(feed_id)
    .execute(&mut *connection)
    .await?;
    rules::apply_to(connection, person, feed_id, &unread).await
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

async fn already_followed(state: &AppState, person: i64, url: &Url) -> Result<(), NotAdded> {
    let id: Option<i64> = sqlx::query_scalar(
        "SELECT feeds.id FROM feeds JOIN subscriptions ON subscriptions.feed_id = feeds.id
         WHERE feeds.url_key = ? AND subscriptions.person_id = ?
             AND subscriptions.unsubscribed_at IS NULL",
    )
    .bind(feed::normalize(url))
    .bind(person)
    .fetch_optional(&state.db)
    .await?;
    id.map_or(Ok(()), |id| Err(NotAdded::Already(id)))
}

/// Does the reader follow this feed (not unsubscribed)?
pub async fn follows(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    feed_id: i64,
) -> Result<bool, sqlx::Error> {
    let found: Option<i64> = sqlx::query_scalar(
        "SELECT feed_id FROM subscriptions
         WHERE person_id = ? AND feed_id = ? AND unsubscribed_at IS NULL",
    )
    .bind(person)
    .bind(feed_id)
    .fetch_optional(connection)
    .await?;
    Ok(found.is_some())
}

/// Remembers the feed and stores its articles, all at once or not at all.
/// A feed someone else already follows isn't stored twice: the reader gets
/// their own subscription to it, and their own entries for its articles.
async fn follow(
    state: &AppState,
    person: i64,
    fetched: &Fetched,
    parsed: feed::ParsedFeed,
) -> Result<FeedRow, NotAdded> {
    let now = now();
    let hub = parsed.hub.clone();
    let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
    if !admin::room_for_one_more(&mut transaction, person).await? {
        return Err(NotAdded::TooMany);
    }
    let (feed_id, fresh) = match follow_in(
        &mut transaction,
        state,
        person,
        fetched,
        &parsed,
        &parsed.title,
        now,
    )
    .await?
    {
        Followed::New { feed_id, fresh } => (feed_id, fresh),
        Followed::Already(feed_id) => {
            // Followed after all, by an address that led to the same feed.
            transaction.rollback().await?;
            return Err(NotAdded::Already(feed_id));
        }
    };
    let unread = sqlx::query_scalar(
        "SELECT COUNT(*) FROM entries WHERE person_id = ? AND feed_id = ? AND read = 0",
    )
    .bind(person)
    .bind(feed_id)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    // Signing up with the feed's hub, if it has one, needn't hold up adding
    // it. A feed others already follow has its checks and its hub.
    if fresh {
        offer_hub(state, feed_id, hub, now);
    }

    Ok(FeedRow {
        id: feed_id,
        title: parsed.title,
        site_url: parsed.site_url,
        unread,
        river: false,
        check_at_most: 0,
        open_on_site: false,
        paused_at: None,
        folders: Vec::new(),
    })
}

/// Signs up with a feed's hub, if it names one, in the background.
pub fn offer_hub(state: &AppState, feed_id: i64, hub: Option<feed::Hub>, now: i64) {
    let background = state.clone();
    tokio::spawn(async move {
        if let Err(error) = websub::offered(&background, feed_id, hub.as_ref(), now).await {
            log::problem(&format!(
                "database error while signing up with a hub: {error}"
            ));
        }
    });
}

/// What `follow_in` did.
pub enum Followed {
    /// The reader follows the feed now. `fresh`: it was new, or nobody
    /// followed it any more, so it was stored (or started afresh) from this
    /// fetch.
    New { feed_id: i64, fresh: bool },
    /// The reader already followed it.
    Already(i64),
}

/// Inside the caller's write: the reader follows the feed just fetched,
/// under the name given. The feed is stored once for everyone; the reader
/// gets their own subscription and entries.
pub async fn follow_in(
    transaction: &mut sqlx::SqliteConnection,
    state: &AppState,
    person: i64,
    fetched: &Fetched,
    parsed: &feed::ParsedFeed,
    title: &str,
    now: i64,
) -> Result<Followed, sqlx::Error> {
    // A feed that moved for good is remembered at its new address.
    let url = &fetched.lasting_url;
    let key = feed::normalize(url);
    let every = checking::rhythm(parsed, now);
    make_room(&mut *transaction, person, &key).await?;

    // New, or one nobody follows any more, started afresh. One that others
    // follow is left exactly as it is: their checks carry on.
    let fresh: Option<i64> = sqlx::query_scalar(
        "INSERT INTO feeds (url, url_key, title, site_url, language, etag, last_modified, added_at,
             fetched_at, check_every, next_check_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (url_key) DO UPDATE SET
             url = excluded.url, title = excluded.title, site_url = excluded.site_url,
             language = excluded.language, etag = excluded.etag,
             last_modified = excluded.last_modified, added_at = excluded.added_at,
             fetched_at = excluded.fetched_at, check_every = excluded.check_every,
             next_check_at = excluded.next_check_at, failures = 0, failing_since = NULL,
             missing_since = NULL, problem = NULL
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
    let feed_id: i64 = match fresh {
        Some(id) => id,
        None => {
            sqlx::query_scalar("SELECT id FROM feeds WHERE url_key = ?")
                .bind(&key)
                .fetch_one(&mut *transaction)
                .await?
        }
    };
    if follows(&mut *transaction, person, feed_id).await? {
        return Ok(Followed::Already(feed_id));
    }
    subscribe(&mut *transaction, person, feed_id, title, now).await?;
    store_articles(&mut *transaction, feed_id, &parsed.articles, now).await?;
    enter_stored(&mut *transaction, person, feed_id, &parsed.articles).await?;
    Ok(Followed::New {
        feed_id,
        fresh: fresh.is_some(),
    })
}

/// Following again a feed the reader unsubscribed from starts it afresh:
/// whatever Undo could still have brought back is cleared first, so only
/// their starred articles carry over. Their subscription's line is then
/// reused (or made anew if nothing needed it).
pub async fn make_room(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    url_key: &str,
) -> Result<(), sqlx::Error> {
    let waiting: Option<i64> = sqlx::query_scalar(
        "SELECT feeds.id FROM feeds JOIN subscriptions ON subscriptions.feed_id = feeds.id
         WHERE feeds.url_key = ? AND subscriptions.person_id = ?
             AND subscriptions.unsubscribed_at IS NOT NULL AND subscriptions.cleared = 0",
    )
    .bind(url_key)
    .bind(person)
    .fetch_optional(&mut *connection)
    .await?;
    if let Some(id) = waiting {
        folders::clear(connection, person, id).await?;
    }
    Ok(())
}

/// Stores new articles, numbered above every article ever stored, even ones
/// since removed by unsubscribing, so "anything newer than article N?"
/// never misses one and a number never means two articles. One already stored
/// (same fingerprint, same feed) that the publisher has since edited gets
/// the new words quietly: it keeps its place in the list, its read mark and
/// its star (SPEC section 11). One the yearly clean-up removed stays
/// removed (`cleanup`). Every reader whose subscription isn't
/// cleared (including one waiting for Undo) gets an entry for each new one,
/// unread (or already read, for a reader who paused the feed; SPEC section
/// 15), and each reader's rules then act on theirs (SPEC section 27).
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
        // Removed by the yearly clean-up: still listed, but not new.
        let forgotten: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM forgotten_articles WHERE feed_id = ? AND fingerprint = ?",
        )
        .bind(feed_id)
        .bind(&article.fingerprint)
        .fetch_optional(&mut *connection)
        .await?;
        if forgotten.is_some() {
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
    sqlx::query(
        "INSERT OR IGNORE INTO entries (person_id, article_id, feed_id, sort_at, read)
         SELECT subscriptions.person_id, articles.id, articles.feed_id, articles.sort_at,
             subscriptions.paused_at IS NOT NULL
         FROM articles JOIN subscriptions ON subscriptions.feed_id = articles.feed_id
         WHERE articles.feed_id = ? AND articles.id > ? AND subscriptions.cleared = 0",
    )
    .bind(feed_id)
    .bind(before)
    .execute(&mut *connection)
    .await?;
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
    /// A rule (or the reader) muted it: only search, the Muted page and
    /// Starred show it.
    pub muted: bool,
}

/// One page of the item list. `next` says where the next page starts, or is
/// null at the very end.
async fn list_articles(
    SignedIn(person): SignedIn,
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
        Ok(latest) => page(&state.db, person, list, query.order, after)
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

/// The start of every "anything new?" question: the reader's entries that
/// arrived after article `since`, with their subscription.
macro_rules! new_query {
    ($filter:literal) => {
        concat!(
            "SELECT EXISTS (SELECT 1 FROM entries CROSS JOIN subscriptions
                 ON subscriptions.person_id = entries.person_id
                 AND subscriptions.feed_id = entries.feed_id
             WHERE entries.person_id = ? AND entries.article_id > ?
                 AND subscriptions.unsubscribed_at IS NULL AND ",
            $filter,
            ")"
        )
    };
}

/// "Has anything arrived for this list since article `since`?", one question
/// per list. Each reads only the reader's entries that arrived since, by
/// number (the `+` keeps SQLite from reading the whole feed through its
/// index instead). Each takes the reader and `since`; a feed's or folder's
/// then its number, and a folder's the reader again.
pub const fn new_sql(list: List) -> Option<&'static str> {
    match list {
        List::All => Some(new_query!("+entries.muted = 0")),
        List::Unread => Some(new_query!("+entries.read = 0 AND subscriptions.river = 0")),
        List::Feed(_) => Some(new_query!("+entries.muted = 0 AND +entries.feed_id = ?")),
        List::Folder(_) => Some(new_query!(
            "+entries.muted = 0 AND +entries.feed_id IN (SELECT feed_id FROM feed_folders
                  WHERE folder_id = (SELECT id FROM folders WHERE id = ? AND person_id = ?))"
        )),
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
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Query(query): Query<NewQuery>,
) -> Response {
    let list = List::from_query(query.feed, query.folder, query.view);
    let Some(sql) = new_sql(list) else {
        return Json(json!({ "new": false })).into_response();
    };
    let mut question = sqlx::query_scalar(sql).bind(person).bind(query.since);
    if let List::Feed(id) | List::Folder(id) = list {
        question = question.bind(id);
    }
    if let List::Folder(_) = list {
        question = question.bind(person);
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
/// of the reader's entries so the database always picks the right one:
/// `entries_newest`, `entries_newest_by_feed`, `entries_unread` and
/// `entries_starred`, read backwards for oldest first. `CROSS JOIN` tells
/// SQLite to walk the reader's entries in list order and look up each one's
/// article and subscription, rather than sorting afterwards (tests/speed.rs
/// checks this). A folder's list walks every entry in order too, keeping its
/// feeds' (the `+` stops SQLite from gathering them feed by feed and sorting
/// them all on the spot).
///
/// Unread and All leave out feeds the reader has unsubscribed from; Starred
/// keeps their starred articles (SPEC section 15). Unread also leaves out
/// feeds that flow past (`river`, set in Edit feed). Only Starred shows muted
/// articles (muted ones are read, so never in Unread; SPEC section 27).
macro_rules! list_query {
    ($filter:literal, $past:literal, $order:literal) => {
        concat!(
            "SELECT entries.article_id AS id, entries.feed_id, subscriptions.title AS feed_title,
                    articles.title, articles.link, entries.sort_at AS at,
                    entries.read, entries.starred, entries.muted
             FROM entries CROSS JOIN articles ON articles.id = entries.article_id
                 CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
                     AND subscriptions.feed_id = entries.feed_id
             WHERE entries.person_id = ? AND ",
            $filter,
            " (entries.sort_at, entries.article_id) ",
            $past,
            " (?, ?)
             ORDER BY entries.sort_at ",
            $order,
            ", entries.article_id ",
            $order,
            " LIMIT ?"
        )
    };
}

/// The question for a list in an order. Every question takes the reader
/// first; a feed's or folder's then its ID, and a folder's the reader again
/// (it must be theirs); every question then takes the cursor (time, id) and
/// the limit.
pub const fn list_sql(list: List, order: Order) -> &'static str {
    match (list, order) {
        (List::All, Order::Newest) => list_query!(
            "entries.muted = 0 AND subscriptions.unsubscribed_at IS NULL AND",
            "<",
            "DESC"
        ),
        (List::All, Order::Oldest) => list_query!(
            "entries.muted = 0 AND subscriptions.unsubscribed_at IS NULL AND",
            ">",
            "ASC"
        ),
        (List::Unread, Order::Newest) => list_query!(
            "entries.read = 0 AND subscriptions.unsubscribed_at IS NULL
                 AND subscriptions.river = 0 AND",
            "<",
            "DESC"
        ),
        (List::Unread, Order::Oldest) => list_query!(
            "entries.read = 0 AND subscriptions.unsubscribed_at IS NULL
                 AND subscriptions.river = 0 AND",
            ">",
            "ASC"
        ),
        (List::Starred, Order::Newest) => list_query!("entries.starred = 1 AND", "<", "DESC"),
        (List::Starred, Order::Oldest) => list_query!("entries.starred = 1 AND", ">", "ASC"),
        (List::Feed(_), Order::Newest) => {
            list_query!("entries.feed_id = ? AND entries.muted = 0 AND", "<", "DESC")
        }
        (List::Feed(_), Order::Oldest) => {
            list_query!("entries.feed_id = ? AND entries.muted = 0 AND", ">", "ASC")
        }
        (List::Folder(_), Order::Newest) => list_query!(
            "+entries.feed_id IN (SELECT feed_id FROM feed_folders
                  WHERE folder_id = (SELECT id FROM folders WHERE id = ? AND person_id = ?))
                 AND entries.muted = 0 AND subscriptions.unsubscribed_at IS NULL AND",
            "<",
            "DESC"
        ),
        (List::Folder(_), Order::Oldest) => list_query!(
            "+entries.feed_id IN (SELECT feed_id FROM feed_folders
                  WHERE folder_id = (SELECT id FROM folders WHERE id = ? AND person_id = ?))
                 AND entries.muted = 0 AND subscriptions.unsubscribed_at IS NULL AND",
            ">",
            "ASC"
        ),
    }
}

/// One page of reader `person`'s list, starting after `after` (from the
/// start when absent), using the list's index. One extra row is asked for,
/// to know whether another page exists.
pub async fn page(
    db: &sqlx::SqlitePool,
    person: i64,
    list: List,
    order: Order,
    after: Option<(i64, i64)>,
) -> Result<(Vec<ArticleRow>, Option<(i64, i64)>), sqlx::Error> {
    let start = match order {
        Order::Newest => (i64::MAX, i64::MAX),
        Order::Oldest => (i64::MIN, i64::MIN),
    };
    let (after_at, after_id) = after.unwrap_or(start);
    let mut query = sqlx::query_as(list_sql(list, order)).bind(person);
    if let List::Feed(id) | List::Folder(id) = list {
        query = query.bind(id);
    }
    if let List::Folder(_) = list {
        query = query.bind(person);
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

/// Only an article the reader has (an entry of theirs); any other is not
/// found, as if it didn't exist.
async fn read_article(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match full_articles(&state, person, &[id]).await {
        Ok(mut found) => match found.pop() {
            Some(article) => Json(json!({ "article": article })).into_response(),
            None => StatusCode::NOT_FOUND.into_response(),
        },
        Err(error) => database_problem("reading an article", &error),
    }
}

/// The most articles `/api/articles/several` gives at once.
pub const SEVERAL_AT_ONCE: usize = 50;

#[derive(Deserialize)]
struct Several {
    /// The articles' numbers, separated by commas.
    ids: String,
}

/// Several articles at once, for the copies kept on a device for reading
/// offline (SPEC section 30): a few requests instead of hundreds, and only
/// the words, each image a short note (`feed::text_only`). Only the
/// reader's own; any other is left out, so the answer may hold fewer than
/// were asked for.
async fn read_several(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Query(query): Query<Several>,
) -> Response {
    let ids: Option<Vec<i64>> = query
        .ids
        .split(',')
        .filter(|id| !id.is_empty())
        .map(|id| id.trim().parse().ok())
        .collect();
    let Some(ids) = ids else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    if ids.len() > SEVERAL_AT_ONCE {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
    match full_articles(&state, person, &ids).await {
        Ok(mut articles) => {
            for article in &mut articles {
                article.content = article.content.take().map(|html| feed::text_only(&html));
                article.summary = article.summary.take().map(|html| feed::text_only(&html));
            }
            Json(json!({ "articles": articles })).into_response()
        }
        Err(error) => database_problem("reading articles", &error),
    }
}

/// The reader's articles among `ids`, each ready for the reading area.
async fn full_articles(
    state: &AppState,
    person: i64,
    ids: &[i64],
) -> Result<Vec<FullArticle>, sqlx::Error> {
    let ids = serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_owned());
    let mut articles: Vec<FullArticle> = sqlx::query_as(
        "SELECT articles.id, entries.feed_id, subscriptions.title AS feed_title, feeds.site_url,
                articles.title, articles.link, articles.author, articles.content,
                articles.summary, COALESCE(articles.language, feeds.language) AS language,
                entries.sort_at AS at, entries.read, entries.starred
         FROM entries JOIN articles ON articles.id = entries.article_id
             JOIN feeds ON feeds.id = entries.feed_id
             JOIN subscriptions ON subscriptions.person_id = entries.person_id
                 AND subscriptions.feed_id = entries.feed_id
         WHERE entries.person_id = ? AND entries.article_id IN (SELECT value FROM json_each(?))",
    )
    .bind(person)
    .bind(ids)
    .fetch_all(&state.db)
    .await?;
    for article in &mut articles {
        // Articles stored before tracking images were removed on arrival
        // (Milestone 5) lose them here instead.
        article.content = article
            .content
            .take()
            .map(|html| feed::without_tracking_images(&html));
        article.summary = article
            .summary
            .take()
            .map(|html| feed::without_tracking_images(&html));
        article.language = article.language.take().filter(|tag| is_language_tag(tag));
    }
    Ok(articles)
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
