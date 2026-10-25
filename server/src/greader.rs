//! Syncing with other feed readers (SPEC section 26): the Google Reader API,
//! as FreshRSS and Miniflux offer it, so Reeder, NetNewsWire and similar
//! apps can show the reader's feeds and articles and keep read and starred
//! in step with nine turtles.
//!
//! Apps sign in with the app password (`apps`), never the reader's own.
//! They can read everything, change read and starred marks, follow and
//! unfollow feeds, rename them and sort them into folders (decision 0070).
//! Unfollowing from an app hides the feed first, as nine turtles does, and
//! following it again from an app in the next ten minutes brings it back
//! with its articles and read marks. The API answers at `/api/greader` and, for apps
//! that expect FreshRSS's address, `/api/greader.php`.
//!
//! The protocol was never written down by Google; this follows what
//! FreshRSS and Miniflux answer, which is what the apps are tested against.
//! Article numbers are the item IDs: nine turtles never reuses one. Lists
//! are in the same order as nine turtles' own, newest published first.

use std::collections::HashMap;

use axum::{
    Json, Router,
    body::Bytes,
    extract::{FromRequest, FromRequestParts, Path, Request, State},
    http::{StatusCode, header, request::Parts},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde_json::{Value, json};
use sqlx::{QueryBuilder, Sqlite};

use crate::{
    AppState, apps, auth::database_problem, feeds, folders, log, marks::MOST_AT_ONCE, now,
};

const READING_LIST: &str = "user/-/state/com.google/reading-list";
const READ: &str = "user/-/state/com.google/read";
const STARRED: &str = "user/-/state/com.google/starred";
const KEPT_UNREAD: &str = "user/-/state/com.google/kept-unread";
const LABEL: &str = "user/-/label/";
const ITEM_PREFIX: &str = "tag:google.com,2005:reader/item/";

/// Items in one answer when the app doesn't say: Google's own default.
const DEFAULT_COUNT: usize = 20;
/// The most articles with their text in one answer.
const MOST_CONTENTS: usize = 1_000;
/// A request's body is a list of article numbers at most; anything bigger
/// isn't a sync app.
const LARGEST_BODY: usize = 1024 * 1024;

/// The columns an `Article` is read from.
macro_rules! article_columns {
    () => {
        "articles.id, articles.feed_id, feeds.title AS feed_title,
         feeds.site_url, articles.title, articles.link, articles.author, articles.content,
         articles.summary, articles.published_at, articles.received_at, articles.sort_at,
         articles.read, articles.starred"
    };
}

pub fn routes() -> Router<AppState> {
    let api = Router::new()
        .route(
            "/accounts/ClientLogin",
            get(client_login).post(client_login),
        )
        .route("/reader/api/0/token", get(token).post(token))
        .route("/reader/api/0/user-info", get(user_info))
        .route("/reader/api/0/subscription/list", get(subscriptions))
        .route("/reader/api/0/tag/list", get(tags))
        .route("/reader/api/0/unread-count", get(unread_counts))
        .route(
            "/reader/api/0/stream/items/ids",
            get(item_ids).post(item_ids),
        )
        .route(
            "/reader/api/0/stream/items/contents",
            get(item_contents).post(item_contents),
        )
        .route(
            "/reader/api/0/stream/contents",
            get(stream_contents).post(stream_contents),
        )
        .route(
            "/reader/api/0/stream/contents/{*stream}",
            get(named_stream_contents).post(named_stream_contents),
        )
        .route("/reader/api/0/edit-tag", post(edit_tag))
        .route("/reader/api/0/mark-all-as-read", post(mark_all_as_read))
        .route("/reader/api/0/subscription/edit", post(edit_subscription))
        .route("/reader/api/0/subscription/quickadd", post(quick_add))
        .route("/reader/api/0/rename-tag", post(rename_folder))
        .route("/reader/api/0/disable-tag", post(delete_folder));
    Router::new()
        .nest("/api/greader", api.clone())
        .nest("/api/greader.php", api)
}

/// The parameters an app sent, from the address and (for POST) the form in
/// the body, in order. Names can repeat: `i=1&i=2` names two articles.
struct Params(Vec<(String, String)>);

impl Params {
    fn first(&self, name: &str) -> Option<&str> {
        self.0
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.as_str())
    }

    fn all(&self, name: &str) -> impl Iterator<Item = &str> {
        self.0
            .iter()
            .filter(move |(key, _)| key == name)
            .map(|(_, value)| value.as_str())
    }

    fn number(&self, name: &str) -> Option<i64> {
        self.first(name)?.trim().parse().ok()
    }
}

impl FromRequest<AppState> for Params {
    type Rejection = Response;

    async fn from_request(request: Request, state: &AppState) -> Result<Self, Response> {
        let mut pairs = request.uri().query().map(decode_form).unwrap_or_default();
        let body = Bytes::from_request(request, state)
            .await
            .map_err(IntoResponse::into_response)?;
        if body.len() > LARGEST_BODY {
            return Err(StatusCode::PAYLOAD_TOO_LARGE.into_response());
        }
        pairs.extend(decode_form(&String::from_utf8_lossy(&body)));
        Ok(Self(pairs))
    }
}

/// Reads `a=1&b=two+words&c=%2F` into pairs.
fn decode_form(text: &str) -> Vec<(String, String)> {
    text.split('&')
        .filter(|pair| !pair.is_empty())
        .map(|pair| {
            let (name, value) = pair.split_once('=').unwrap_or((pair, ""));
            (percent_decode(name), percent_decode(value))
        })
        .collect()
}

fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let hex = |at: usize| {
        bytes
            .get(at)
            .and_then(|byte| char::from(*byte).to_digit(16))
    };
    let mut out = Vec::with_capacity(bytes.len());
    let mut at = 0;
    while let Some(&byte) = bytes.get(at) {
        match (byte, hex(at + 1), hex(at + 2)) {
            (b'+', _, _) => out.push(b' '),
            (b'%', Some(high), Some(low)) => {
                out.push(u8::try_from(high * 16 + low).unwrap_or(b'?'));
                at += 2;
            }
            _ => out.push(byte),
        }
        at += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Proof that a request comes from an app holding a reader's app password,
/// and whose it is (their number in `people`). Apps get Google's plain
/// "Unauthorized" otherwise, which they understand as "sign in again".
#[derive(Clone, Copy)]
struct App(i64);

impl FromRequestParts<AppState> for App {
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Response> {
        let Some(password) = apps::from_headers(&parts.headers) else {
            return Err(unauthorized());
        };
        match apps::matches(state, &password).await {
            Ok(Some(person)) => Ok(Self(person)),
            Ok(None) => Err(unauthorized()),
            Err(error) => Err(database_problem("checking an app password", &error)),
        }
    }
}

fn unauthorized() -> Response {
    (StatusCode::UNAUTHORIZED, "Unauthorized").into_response()
}

fn text(body: impl Into<String>) -> Response {
    (
        [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
        body.into(),
    )
        .into_response()
}

/// Signing in: the app sends `Email` (anything) and `Passwd` (the app
/// password), and gets the token it sends with every later request. The
/// token is the app password itself, without its dashes.
async fn client_login(State(state): State<AppState>, params: Params) -> Response {
    let password = params.first("Passwd").unwrap_or_default();
    match apps::matches(&state, password).await {
        Ok(Some(_)) => {
            let token = apps::normalize(password);
            text(format!("SID={token}\nLSID=null\nAuth={token}\n"))
        }
        Ok(None) => {
            // The app password can't be guessed (119 bits), so there's no
            // wait as there is for the sign-in page, which would let a
            // stranger lock the owner out. It's counted on the diagnostics
            // page with the other wrong passwords.
            state
                .wrong_passwords
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            log::info("an app tried to sign in with a wrong app password");
            (StatusCode::UNAUTHORIZED, "Error=BadAuthentication\n").into_response()
        }
        Err(error) => database_problem("checking an app password", &error),
    }
}

/// The short token Google's API wanted with every change, against forged
/// requests from web pages. Apps send the app password in a header no web
/// page can add, so any token will do; apps still ask for one.
async fn token(_: App) -> Response {
    text("ninturtlesnotneeded\n")
}

async fn user_info(_: App) -> Response {
    Json(json!({
        "userId": "1",
        "userName": "nine turtles",
        "userProfileId": "1",
        "userEmail": "",
    }))
    .into_response()
}

/// A feed's number, name, address and website.
type FeedLine = (i64, String, String, Option<String>);
/// A feed's number, its unread articles and when the newest arrived.
type UnreadLine = (i64, i64, i64);

/// Every followed feed, with its folders as Google's "labels".
async fn subscriptions(App(person): App, State(state): State<AppState>) -> Response {
    let listed: Result<(Vec<FeedLine>, Labels), sqlx::Error> = async {
        let feeds = sqlx::query_as(
            "SELECT id, title, url, site_url FROM feeds WHERE unsubscribed_at IS NULL
             ORDER BY title COLLATE NOCASE, id",
        )
        .fetch_all(&state.db)
        .await?;
        Ok((feeds, labels(&state.db, person).await?))
    }
    .await;
    let (feeds, labels) = match listed {
        Ok(listed) => listed,
        Err(error) => return database_problem("listing feeds for an app", &error),
    };
    let subscriptions: Vec<Value> = feeds
        .into_iter()
        .map(|(id, title, url, site_url)| {
            let categories: Vec<Value> = labels
                .get(&id)
                .into_iter()
                .flatten()
                .map(|name| json!({ "id": format!("{LABEL}{name}"), "label": name }))
                .collect();
            json!({
                "id": format!("feed/{id}"),
                "title": title,
                "categories": categories,
                "url": url,
                "htmlUrl": site_url.unwrap_or_default(),
                "iconUrl": "",
            })
        })
        .collect();
    Json(json!({ "subscriptions": subscriptions })).into_response()
}

/// Starred, and every folder.
async fn tags(App(person): App, State(state): State<AppState>) -> Response {
    let folders: Result<Vec<String>, sqlx::Error> = sqlx::query_scalar(
        "SELECT name FROM folders WHERE person_id = ? ORDER BY name COLLATE NOCASE",
    )
    .bind(person)
    .fetch_all(&state.db)
    .await;
    match folders {
        Ok(folders) => {
            let mut tags = vec![json!({ "id": STARRED })];
            tags.extend(
                folders
                    .into_iter()
                    .map(|name| json!({ "id": format!("{LABEL}{name}"), "type": "folder" })),
            );
            Json(json!({ "tags": tags })).into_response()
        }
        Err(error) => database_problem("listing folders for an app", &error),
    }
}

/// Unread articles per followed feed, per folder and in all.
async fn unread_counts(App(person): App, State(state): State<AppState>) -> Response {
    let counted: Result<(Vec<UnreadLine>, Labels), sqlx::Error> = async {
        let counts = sqlx::query_as(
            "SELECT articles.feed_id, COUNT(*), MAX(articles.received_at)
             FROM articles JOIN feeds ON feeds.id = articles.feed_id
             WHERE articles.read = 0 AND feeds.unsubscribed_at IS NULL
             GROUP BY articles.feed_id",
        )
        .fetch_all(&state.db)
        .await?;
        Ok((counts, labels(&state.db, person).await?))
    }
    .await;
    let (counts, labels) = match counted {
        Ok(counted) => counted,
        Err(error) => return database_problem("counting unread articles for an app", &error),
    };

    let usec = |at: i64| (at.saturating_mul(1_000_000)).to_string();
    let mut by_label: HashMap<&str, (i64, i64)> = HashMap::new();
    let (mut total, mut newest) = (0, 0);
    let mut unread: Vec<Value> = Vec::with_capacity(counts.len() + 1);
    for (feed, count, latest) in &counts {
        total += count;
        newest = newest.max(*latest);
        for name in labels.get(feed).into_iter().flatten() {
            let entry = by_label.entry(name).or_default();
            entry.0 += count;
            entry.1 = entry.1.max(*latest);
        }
        unread.push(json!({
            "id": format!("feed/{feed}"),
            "count": count,
            "newestItemTimestampUsec": usec(*latest),
        }));
    }
    for (name, (count, latest)) in by_label {
        unread.push(json!({
            "id": format!("{LABEL}{name}"),
            "count": count,
            "newestItemTimestampUsec": usec(latest),
        }));
    }
    unread.push(json!({
        "id": READING_LIST,
        "count": total,
        "newestItemTimestampUsec": usec(newest),
    }));
    Json(json!({ "max": total, "unreadcounts": unread })).into_response()
}

/// Folder names per feed.
type Labels = HashMap<i64, Vec<String>>;

async fn labels(db: &sqlx::SqlitePool, person: i64) -> Result<Labels, sqlx::Error> {
    let pairs: Vec<(i64, String)> = sqlx::query_as(
        "SELECT feed_folders.feed_id, folders.name
         FROM feed_folders JOIN folders ON folders.id = feed_folders.folder_id
         WHERE folders.person_id = ?
         ORDER BY folders.name COLLATE NOCASE",
    )
    .bind(person)
    .fetch_all(db)
    .await?;
    let mut labels = Labels::new();
    for (feed, name) in pairs {
        labels.entry(feed).or_default().push(name);
    }
    Ok(labels)
}

/// A list of articles an app can ask for.
#[derive(Debug, PartialEq, Eq)]
enum Stream {
    /// Every followed feed's articles.
    ReadingList,
    Starred,
    Read,
    Feed(i64),
    Folder(String),
    /// Anything else (Google had "broadcast", "like" and more): always empty.
    Nothing,
}

impl Stream {
    fn parse(id: &str) -> Self {
        let id = mine(id);
        match id.as_str() {
            READING_LIST => Self::ReadingList,
            STARRED => Self::Starred,
            READ => Self::Read,
            _ => {
                if let Some(feed) = id.strip_prefix("feed/") {
                    feed.parse().map_or(Self::Nothing, Self::Feed)
                } else if let Some(name) = id.strip_prefix(LABEL) {
                    Self::Folder(name.to_owned())
                } else {
                    Self::Nothing
                }
            }
        }
    }

    /// Adds this list's condition for reader `person`, after a `WHERE` or `AND`.
    fn condition(&self, query: &mut QueryBuilder<Sqlite>, person: i64) {
        match self {
            Self::ReadingList => {
                query.push("feeds.unsubscribed_at IS NULL");
            }
            Self::Starred => {
                query.push("articles.starred = 1");
            }
            Self::Read => {
                query.push("articles.read = 1 AND feeds.unsubscribed_at IS NULL");
            }
            Self::Feed(id) => {
                query
                    .push("feeds.unsubscribed_at IS NULL AND articles.feed_id = ")
                    .push_bind(*id);
            }
            Self::Folder(name) => {
                query
                    .push(
                        "feeds.unsubscribed_at IS NULL AND articles.feed_id IN
                         (SELECT feed_id FROM feed_folders JOIN folders ON folders.id = feed_folders.folder_id
                          WHERE folders.person_id = ",
                    )
                    .push_bind(person)
                    .push(" AND folders.name = ")
                    .push_bind(name.clone())
                    .push(")");
            }
            Self::Nothing => {
                query.push("0");
            }
        }
    }
}

/// Google's IDs name the user (`user/1234/state/…`); `-` means "me", and
/// there is only one reader here, so any user is read as `-`.
fn mine(id: &str) -> String {
    match id
        .strip_prefix("user/")
        .and_then(|rest| rest.split_once('/'))
    {
        Some((_, rest)) => format!("user/-/{rest}"),
        None => id.to_owned(),
    }
}

/// What an app asked for: which list, which articles in it, how many and
/// from where.
struct Asked {
    stream: Stream,
    /// `xt`: leave out articles that are read (or starred).
    exclude: Vec<Stream>,
    /// `it`: only articles that are read (or starred).
    include: Vec<Stream>,
    /// `ot`: only articles that arrived at or after this time.
    since: Option<i64>,
    /// `nt`: only articles that arrived at or before this time.
    until: Option<i64>,
    oldest_first: bool,
    count: usize,
    /// `c`: carry on after this article, written `time_number`.
    after: Option<(i64, i64)>,
}

impl Asked {
    fn from(params: &Params, stream: Option<&str>, most: usize) -> Self {
        let stream = stream.or_else(|| params.first("s")).unwrap_or(READING_LIST);
        Self {
            stream: Stream::parse(stream),
            exclude: params.all("xt").map(Stream::parse).collect(),
            include: params.all("it").map(Stream::parse).collect(),
            since: params.number("ot").map(seconds),
            until: params.number("nt").map(seconds),
            oldest_first: params.first("r") == Some("o"),
            count: params
                .number("n")
                .and_then(|count| usize::try_from(count).ok())
                .unwrap_or(DEFAULT_COUNT)
                .clamp(1, most),
            after: params.first("c").and_then(cursor),
        }
    }

    /// The query for this page of reader `person`'s articles, with one extra
    /// row to know whether another page follows.
    fn query(&self, columns: &str, person: i64) -> QueryBuilder<Sqlite> {
        let mut query = QueryBuilder::new(format!(
            "SELECT {columns} FROM articles JOIN feeds ON feeds.id = articles.feed_id WHERE "
        ));
        self.stream.condition(&mut query, person);
        for (states, value) in [(&self.exclude, 0), (&self.include, 1)] {
            for state in states {
                match state {
                    Stream::Read => {
                        query.push(format!(" AND articles.read = {value}"));
                    }
                    Stream::Starred => {
                        query.push(format!(" AND articles.starred = {value}"));
                    }
                    _ => {}
                }
            }
        }
        if let Some(since) = self.since {
            query.push(" AND articles.received_at >= ").push_bind(since);
        }
        if let Some(until) = self.until {
            query.push(" AND articles.received_at <= ").push_bind(until);
        }
        if let Some((at, id)) = self.after {
            query
                .push(if self.oldest_first {
                    " AND (articles.sort_at, articles.id) > ("
                } else {
                    " AND (articles.sort_at, articles.id) < ("
                })
                .push_bind(at)
                .push(", ")
                .push_bind(id)
                .push(")");
        }
        query.push(if self.oldest_first {
            " ORDER BY articles.sort_at ASC, articles.id ASC LIMIT "
        } else {
            " ORDER BY articles.sort_at DESC, articles.id DESC LIMIT "
        });
        query.push_bind(i64::try_from(self.count).unwrap_or(i64::MAX) + 1);
        query
    }
}

/// Where the next page starts: the last article's time and number, as
/// `continuation` gave them.
fn cursor(text: &str) -> Option<(i64, i64)> {
    let (at, id) = text.split_once('_')?;
    Some((at.parse().ok()?, id.parse().ok()?))
}

/// Google's times come in seconds, milliseconds or microseconds depending on
/// the app; nine turtles keeps seconds.
fn seconds(mut at: i64) -> i64 {
    while at > 100_000_000_000 {
        at /= 1_000;
    }
    at
}

/// The article numbers in a list, without their text: what apps ask first,
/// to learn what's unread and starred.
async fn item_ids(App(person): App, State(state): State<AppState>, params: Params) -> Response {
    let asked = Asked::from(&params, None, MOST_AT_ONCE);
    let found: Result<Vec<(i64, i64, i64, i64)>, sqlx::Error> = asked
        .query(
            "articles.id, articles.feed_id, articles.received_at, articles.sort_at",
            person,
        )
        .build_query_as()
        .fetch_all(&state.db)
        .await;
    let mut found = match found {
        Ok(found) => found,
        Err(error) => return database_problem("listing articles for an app", &error),
    };
    let more = found.len() > asked.count;
    found.truncate(asked.count);
    let continuation = more.then(|| found.last().map(|(id, _, _, at)| format!("{at}_{id}")));
    let refs: Vec<Value> = found
        .iter()
        .map(|(id, feed, at, _)| {
            json!({
                "id": id.to_string(),
                "directStreamIds": [format!("feed/{feed}")],
                "timestampUsec": (at.saturating_mul(1_000_000)).to_string(),
            })
        })
        .collect();
    let mut answer = json!({ "itemRefs": refs });
    if let Some(Some(continuation)) = continuation {
        answer["continuation"] = json!(continuation);
    }
    Json(answer).into_response()
}

/// A list's articles with their text. The list is named in the address
/// (`/stream/contents/feed%2F12`) or as `s`.
async fn named_stream_contents(
    app: App,
    State(state): State<AppState>,
    Path(stream): Path<String>,
    params: Params,
) -> Response {
    contents_of(app, &state, &params, Some(&stream)).await
}

async fn stream_contents(app: App, State(state): State<AppState>, params: Params) -> Response {
    contents_of(app, &state, &params, None).await
}

async fn contents_of(
    App(person): App,
    state: &AppState,
    params: &Params,
    stream: Option<&str>,
) -> Response {
    let asked = Asked::from(params, stream, MOST_CONTENTS);
    let id = mine(stream.or_else(|| params.first("s")).unwrap_or(READING_LIST));
    let found: Result<(Vec<Article>, Labels), sqlx::Error> = async {
        let articles = asked
            .query(article_columns!(), person)
            .build_query_as()
            .fetch_all(&state.db)
            .await?;
        Ok((articles, labels(&state.db, person).await?))
    }
    .await;
    let (mut articles, labels) = match found {
        Ok(found) => found,
        Err(error) => return database_problem("reading articles for an app", &error),
    };
    let more = articles.len() > asked.count;
    articles.truncate(asked.count);
    let mut answer = json!({
        "direction": "ltr",
        "id": id,
        "updated": now(),
        "items": articles.iter().map(|article| article.item(&labels)).collect::<Vec<_>>(),
    });
    if more && let Some(last) = articles.last() {
        answer["continuation"] = json!(format!("{}_{}", last.sort_at, last.id));
    }
    Json(answer).into_response()
}

/// Named articles with their text: `i` once per article.
async fn item_contents(
    App(person): App,
    State(state): State<AppState>,
    params: Params,
) -> Response {
    let ids: Vec<i64> = params.all("i").filter_map(item_number).collect();
    if ids.len() > MOST_AT_ONCE {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
    let found: Result<(Vec<Article>, Labels), sqlx::Error> = async {
        let articles = sqlx::query_as(concat!(
            "SELECT ",
            article_columns!(),
            " FROM articles JOIN feeds ON feeds.id = articles.feed_id
             WHERE articles.id IN (SELECT value FROM json_each(?))
             ORDER BY articles.sort_at DESC, articles.id DESC"
        ))
        .bind(serde_json::to_string(&ids).unwrap_or_else(|_| "[]".to_owned()))
        .fetch_all(&state.db)
        .await?;
        Ok((articles, labels(&state.db, person).await?))
    }
    .await;
    match found {
        Ok((articles, labels)) => Json(json!({
            "direction": "ltr",
            "id": READING_LIST,
            "updated": now(),
            "items": articles.iter().map(|article| article.item(&labels)).collect::<Vec<_>>(),
        }))
        .into_response(),
        Err(error) => database_problem("reading articles for an app", &error),
    }
}

/// An article's number from how an app wrote it: plain digits, or Google's
/// long form `tag:google.com,2005:reader/item/` and 16 hexadecimal digits.
fn item_number(id: &str) -> Option<i64> {
    let id = id.trim();
    match id.strip_prefix(ITEM_PREFIX) {
        Some(hex) => u64::from_str_radix(hex, 16)
            .ok()
            .and_then(|number| i64::try_from(number).ok()),
        None => id.parse().ok(),
    }
}

#[derive(sqlx::FromRow)]
struct Article {
    id: i64,
    feed_id: i64,
    feed_title: String,
    site_url: Option<String>,
    title: String,
    link: Option<String>,
    author: Option<String>,
    /// Already cleaned of anything unsafe when it arrived (`feed`).
    content: Option<String>,
    summary: Option<String>,
    published_at: Option<i64>,
    received_at: i64,
    sort_at: i64,
    read: bool,
    starred: bool,
}

impl Article {
    /// The article as Google's API wrote one.
    fn item(&self, labels: &Labels) -> Value {
        let mut categories = vec![READING_LIST.to_owned()];
        if self.read {
            categories.push(READ.to_owned());
        }
        if self.starred {
            categories.push(STARRED.to_owned());
        }
        for name in labels.get(&self.feed_id).into_iter().flatten() {
            categories.push(format!("{LABEL}{name}"));
        }
        let link: Vec<Value> = self
            .link
            .iter()
            .map(|href| json!({ "href": href, "type": "text/html" }))
            .collect();
        let published = self.published_at.unwrap_or(self.sort_at);
        json!({
            "id": format!("{ITEM_PREFIX}{:016x}", self.id),
            "crawlTimeMsec": (self.received_at.saturating_mul(1_000)).to_string(),
            "timestampUsec": (self.received_at.saturating_mul(1_000_000)).to_string(),
            "published": published,
            "updated": published,
            "title": self.title,
            "author": self.author.clone().unwrap_or_default(),
            "canonical": link,
            "alternate": link,
            "categories": categories,
            "summary": {
                "direction": "ltr",
                "content": self.content.clone().or_else(|| self.summary.clone()).unwrap_or_default(),
            },
            "origin": {
                "streamId": format!("feed/{}", self.feed_id),
                "title": self.feed_title,
                "htmlUrl": self.site_url.clone().unwrap_or_default(),
            },
        })
    }
}

/// Marks articles read or unread, starred or not: `i` once per article, `a`
/// for marks to add and `r` for marks to take off.
async fn edit_tag(_: App, State(state): State<AppState>, params: Params) -> Response {
    let ids: Vec<i64> = params.all("i").filter_map(item_number).collect();
    if ids.len() > MOST_AT_ONCE {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
    let mut changes: Vec<(&'static str, bool)> = Vec::new();
    // Marked unread, a muted article is unmuted too, as on nine turtles' own screen.
    const READ_SQL: &str = "UPDATE articles SET read = ?1, muted = muted * ?1 WHERE id IN (SELECT value FROM json_each(?2))";
    const STAR_SQL: &str =
        "UPDATE articles SET starred = ? WHERE id IN (SELECT value FROM json_each(?))";
    for (tags, adding) in [(params.all("a"), true), (params.all("r"), false)] {
        for tag in tags {
            match mine(tag).as_str() {
                READ => changes.push((READ_SQL, adding)),
                KEPT_UNREAD => changes.push((READ_SQL, !adding)),
                STARRED => changes.push((STAR_SQL, adding)),
                // Folders hold feeds here, not articles: nothing to do.
                _ => {}
            }
        }
    }
    let ids = serde_json::to_string(&ids).unwrap_or_else(|_| "[]".to_owned());
    let changed = async {
        let mut transaction = state.db.begin().await?;
        for (sql, value) in changes {
            sqlx::query(sql)
                .bind(value)
                .bind(&ids)
                .execute(&mut *transaction)
                .await?;
        }
        transaction.commit().await
    }
    .await;
    match changed {
        Ok(()) => text("OK"),
        Err(error) => database_problem("marking articles for an app", &error),
    }
}

/// Marks a list read, but only articles that had arrived by `ts`, the moment
/// the app last looked: as with nine turtles' own "Mark all as read",
/// articles that arrived since are never touched.
async fn mark_all_as_read(
    App(person): App,
    State(state): State<AppState>,
    params: Params,
) -> Response {
    let stream = Stream::parse(params.first("s").unwrap_or(READING_LIST));
    let until = params.number("ts").map_or_else(now, seconds);
    let mut query = QueryBuilder::<Sqlite>::new(
        "UPDATE articles SET read = 1 WHERE read = 0 AND id IN
         (SELECT articles.id FROM articles JOIN feeds ON feeds.id = articles.feed_id WHERE ",
    );
    stream.condition(&mut query, person);
    query
        .push(" AND articles.received_at <= ")
        .push_bind(until)
        .push(")");
    match query.build().execute(&state.db).await {
        Ok(_) => text("OK"),
        Err(error) => database_problem("marking a list read for an app", &error),
    }
}

/// Follows, unfollows, renames or files a feed: `ac` says which
/// (`subscribe`, `unsubscribe` or `edit`), `s` names the feed (`feed/12`,
/// or `feed/` and its address to follow it), `t` is a new name, `a` a folder
/// to put it in and `r` one to take it out of.
async fn edit_subscription(
    App(person): App,
    State(state): State<AppState>,
    params: Params,
) -> Response {
    let action = params.first("ac").unwrap_or("edit");
    let feeds: Vec<&str> = params.all("s").collect();
    if feeds.is_empty() {
        return (StatusCode::BAD_REQUEST, "No feed named.").into_response();
    }
    for feed in feeds {
        let feed = feed.strip_prefix("feed/").unwrap_or(feed);
        let id = match (action, feed.parse::<i64>()) {
            (_, Ok(id)) => id,
            ("subscribe", Err(_)) => match feeds::add_for_app(&state, feed).await {
                Ok(id) => id,
                Err(not_added) => return not_added.into_response(),
            },
            (_, Err(_)) => return StatusCode::NOT_FOUND.into_response(),
        };
        let done = match action {
            "unsubscribe" => unfollow(&state, id).await,
            "subscribe" => match bring_back(&state, id).await {
                Ok(()) => file(&state, person, id, &params).await,
                Err(error) => Err(error),
            },
            _ => file(&state, person, id, &params).await,
        };
        if let Err(error) = done {
            return database_problem("changing a feed for an app", &error);
        }
    }
    text("OK")
}

/// Follows a feed by its address, or a page's first feed: `quickadd`.
async fn quick_add(_: App, State(state): State<AppState>, params: Params) -> Response {
    let address = params.first("quickadd").unwrap_or_default();
    let address = address.strip_prefix("feed/").unwrap_or(address);
    let id = match feeds::add_for_app(&state, address).await {
        Ok(id) => id,
        Err(not_added) => return not_added.into_response(),
    };
    let title: Result<String, sqlx::Error> =
        sqlx::query_scalar("SELECT title FROM feeds WHERE id = ?")
            .bind(id)
            .fetch_one(&state.db)
            .await;
    match title {
        Ok(title) => Json(json!({
            "query": address,
            "numResults": 1,
            "streamId": format!("feed/{id}"),
            "streamName": title,
        }))
        .into_response(),
        Err(error) => database_problem("following a feed for an app", &error),
    }
}

/// Unfollows the way nine turtles does: the feed is hidden and no longer
/// checked straight away, and cleared for good ten minutes later by
/// background checking. Unlike unfollowing on nine turtles' own page, an
/// earlier unfollowed feed isn't cleared early, so each keeps its ten
/// minutes in which following it again brings it back (unless the reader
/// unsubscribes on nine turtles' page meanwhile, which clears every feed
/// waiting, since its Undo covers only the last action).
async fn unfollow(state: &AppState, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE feeds SET unsubscribed_at = ? WHERE id = ? AND unsubscribed_at IS NULL")
        .bind(now())
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(())
}

/// Follows again, by its number, a feed unfollowed but not yet cleared, as
/// Undo does.
async fn bring_back(state: &AppState, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE feeds SET unsubscribed_at = NULL, next_check_at = ?
         WHERE id = ? AND unsubscribed_at IS NOT NULL AND cleared = 0",
    )
    .bind(now())
    .bind(id)
    .execute(&state.db)
    .await?;
    Ok(())
}

/// Renames a followed feed and moves it in or out of folders, creating a
/// folder named for the first time. Names are cleaned as nine turtles' own
/// fields clean them; a name that's empty or too long is ignored. `t` is
/// the new name, `a` folders to put it in and `r` folders to take it out of.
async fn file(state: &AppState, person: i64, id: i64, params: &Params) -> Result<(), sqlx::Error> {
    let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
    let followed: Option<i64> =
        sqlx::query_scalar("SELECT id FROM feeds WHERE id = ? AND unsubscribed_at IS NULL")
            .bind(id)
            .fetch_optional(&mut *transaction)
            .await?;
    if followed.is_none() {
        return Ok(());
    }
    if let Some(title) = params.first("t").and_then(folders::clean_name) {
        sqlx::query("UPDATE feeds SET title = ? WHERE id = ?")
            .bind(title)
            .bind(id)
            .execute(&mut *transaction)
            .await?;
    }
    for name in params.all("a").filter_map(folder_name) {
        let (folder, _) = folders::folder_named(&mut transaction, person, &name).await?;
        sqlx::query("INSERT OR IGNORE INTO feed_folders (folder_id, feed_id) VALUES (?, ?)")
            .bind(folder)
            .bind(id)
            .execute(&mut *transaction)
            .await?;
    }
    for name in params.all("r").filter_map(folder_name) {
        sqlx::query(
            "DELETE FROM feed_folders WHERE feed_id = ?
             AND folder_id IN (SELECT id FROM folders WHERE person_id = ? AND name = ?)",
        )
        .bind(id)
        .bind(person)
        .bind(name)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await
}

/// A folder's name from Google's `user/-/label/Name`, or a bare name, cleaned.
fn folder_name(label: &str) -> Option<String> {
    let label = mine(label);
    folders::clean_name(label.strip_prefix(LABEL).unwrap_or(&label))
}

/// Renames a folder: `s` (or `t`) the folder, `dest` its new name.
async fn rename_folder(
    App(person): App,
    State(state): State<AppState>,
    params: Params,
) -> Response {
    let (Some(old), Some(new)) = (
        params
            .first("s")
            .or_else(|| params.first("t"))
            .and_then(folder_name),
        params.first("dest").and_then(folder_name),
    ) else {
        return (StatusCode::BAD_REQUEST, "Name a folder and its new name.").into_response();
    };
    let renamed = sqlx::query(
        "UPDATE folders SET name = ?1 WHERE person_id = ?2 AND name = ?3
         AND NOT EXISTS (SELECT 1 FROM folders AS other
                         WHERE other.person_id = ?2 AND other.name = ?1 AND other.name != ?3)",
    )
    .bind(&new)
    .bind(person)
    .bind(&old)
    .execute(&state.db)
    .await;
    match renamed {
        Ok(done) if done.rows_affected() == 0 => (
            StatusCode::BAD_REQUEST,
            "No such folder, or another folder already has that name.",
        )
            .into_response(),
        Ok(_) => text("OK"),
        Err(error) => database_problem("renaming a folder for an app", &error),
    }
}

/// Deletes a folder: `s` (or `t`) names it. Its feeds stay followed, as
/// when a folder is deleted in nine turtles.
async fn delete_folder(
    App(person): App,
    State(state): State<AppState>,
    params: Params,
) -> Response {
    let Some(name) = params
        .first("s")
        .or_else(|| params.first("t"))
        .and_then(folder_name)
    else {
        return (StatusCode::BAD_REQUEST, "Name a folder.").into_response();
    };
    // As on nine turtles' own screen: saved searches and rules for the
    // folder stay, finding and matching nothing (decisions 0077 and 0081).
    let deleted = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let id: Option<i64> =
            sqlx::query_scalar("DELETE FROM folders WHERE person_id = ? AND name = ? RETURNING id")
                .bind(person)
                .bind(name)
                .fetch_optional(&mut *transaction)
                .await?;
        if let Some(id) = id {
            crate::saved_searches::forget(&mut *transaction, "folder", id).await?;
            crate::rules::place_gone(&mut transaction, None, Some(id)).await?;
        }
        transaction.commit().await
    }
    .await;
    match deleted {
        Ok(()) => text("OK"),
        Err(error) => database_problem("deleting a folder for an app", &error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_are_read_whoever_they_name() {
        assert_eq!(
            Stream::parse("user/1/state/com.google/reading-list"),
            Stream::ReadingList
        );
        assert_eq!(
            Stream::parse("user/-/state/com.google/starred"),
            Stream::Starred
        );
        assert_eq!(Stream::parse("feed/12"), Stream::Feed(12));
        assert_eq!(
            Stream::parse("user/-/label/Friends & family"),
            Stream::Folder("Friends & family".to_owned())
        );
        assert_eq!(Stream::parse("feed/https://example.com"), Stream::Nothing);
        assert_eq!(
            Stream::parse("user/-/state/com.google/broadcast"),
            Stream::Nothing
        );
    }

    #[test]
    fn article_numbers_are_read_in_both_forms() {
        assert_eq!(item_number("42"), Some(42));
        assert_eq!(
            item_number("tag:google.com,2005:reader/item/000000000000002a"),
            Some(42)
        );
        assert_eq!(item_number("nonsense"), None);
    }

    #[test]
    fn forms_are_decoded() {
        assert_eq!(
            decode_form("i=1&i=2&a=user%2F-%2Fstate%2Fcom.google%2Fread&T=x+y&bad=%zz&end=%"),
            vec![
                ("i".to_owned(), "1".to_owned()),
                ("i".to_owned(), "2".to_owned()),
                ("a".to_owned(), "user/-/state/com.google/read".to_owned()),
                ("T".to_owned(), "x y".to_owned()),
                ("bad".to_owned(), "%zz".to_owned()),
                ("end".to_owned(), "%".to_owned()),
            ]
        );
    }

    #[test]
    fn times_in_any_unit_become_seconds() {
        assert_eq!(seconds(1_767_268_800), 1_767_268_800);
        assert_eq!(seconds(1_767_268_800_000), 1_767_268_800);
        assert_eq!(seconds(1_767_268_800_000_000), 1_767_268_800);
    }
}
