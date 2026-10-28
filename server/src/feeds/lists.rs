//! The item list (SPEC sections 4, 6 and 13): which articles each list
//! shows, in which order, a page at a time, and whether new ones arrived.
//! Each list's question matches one index (tests/speed.rs checks this).

use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::stored_link;
use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    recent,
};

/// How many articles the list shows before "Show older items" (SPEC section 6).
pub const PAGE_SIZE: i64 = 50;

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
    /// The articles on one of the reader's collections (`collections`),
    /// muted ones and those of feeds since left included, as in Starred.
    Collection(i64),
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
    /// A feed's, a folder's or a collection's articles if one is named,
    /// otherwise the view's; none for Recently read and Up Next, which are
    /// `recent`'s and `podcasts`' own lists.
    pub(crate) const fn from_query(
        feed: Option<i64>,
        folder: Option<i64>,
        collection: Option<i64>,
        view: View,
    ) -> Option<Self> {
        match (feed, folder, collection, view) {
            (Some(feed), _, _, _) => Some(Self::Feed(feed)),
            (None, Some(folder), _, _) => Some(Self::Folder(folder)),
            (None, None, Some(collection), _) => Some(Self::Collection(collection)),
            (None, None, None, View::All) => Some(Self::All),
            (None, None, None, View::Unread) => Some(Self::Unread),
            (None, None, None, View::Starred) => Some(Self::Starred),
            (None, None, None, View::Recent | View::Upnext) => None,
        }
    }
}

#[derive(Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum View {
    #[default]
    All,
    Unread,
    Starred,
    /// Recently read: the last 50 articles the reader opened (`recent`).
    Recent,
    /// Up Next: the episodes the reader lined up, in their order (`podcasts`).
    Upnext,
}

#[derive(Deserialize)]
pub(super) struct ArticlesQuery {
    /// Only this feed's articles (all of them); otherwise `folder`, then
    /// `view`, decides.
    feed: Option<i64>,
    folder: Option<i64>,
    collection: Option<i64>,
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
    /// Without tracking tags, even for an article stored before they were
    /// taken off on arrival (decision 0112).
    #[serde(serialize_with = "link_without_tracking")]
    pub link: Option<String>,
    /// Seconds since 1970 (UTC); the screen shows it in the device's time zone.
    pub at: i64,
    pub read: bool,
    pub starred: bool,
    /// A rule (or the reader) muted it: only search, the Muted page and
    /// Starred show it.
    pub muted: bool,
    /// A podcast's episode (SPEC section 35): the list shows a small
    /// headphones mark and its length.
    pub episode: bool,
    /// How long the episode plays, in seconds, if its feed says.
    pub episode_seconds: Option<i64>,
    /// When the reader last opened it, in seconds since 1970 (UTC): only in
    /// Recently read, whose list is grouped by day on screen (SPEC section
    /// 5). Left out of every other list.
    #[sqlx(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opened: Option<i64>,
}

/// Writes an article's link without its tracking tags (`ArticleRow`).
fn link_without_tracking<S: serde::Serializer>(
    link: &Option<String>,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    serde::Serialize::serialize(&link.as_deref().map(stored_link), serializer)
}

/// One page of the item list. `next` says where the next page starts, or is
/// null at the very end.
pub(super) async fn list_articles(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Query(query): Query<ArticlesQuery>,
) -> Response {
    let after = match query.after.as_deref().map(parse_cursor) {
        None => None,
        Some(Some(cursor)) => Some(cursor),
        Some(None) => return StatusCode::BAD_REQUEST.into_response(),
    };
    let list = List::from_query(query.feed, query.folder, query.collection, query.view);
    // Asked before the list, so an article arriving in between is reported
    // as new rather than missed.
    let latest: Result<i64, sqlx::Error> = sqlx::query_scalar(LATEST).fetch_one(&state.db).await;
    let listed = match (latest, list) {
        (Ok(latest), Some(list)) => page(&state.db, person, list, query.order, after)
            .await
            .map(|listed| (latest, listed)),
        // Up Next is one short page, in the reader's own order, whatever the sort.
        (Ok(latest), None) if matches!(query.view, View::Upnext) => {
            crate::podcasts::list(&state.db, person)
                .await
                .map(|listed| (latest, (listed, None)))
        }
        // Recently read is one short page, in the order opened, whatever the sort.
        (Ok(latest), None) => recent::list(&state.db, person)
            .await
            .map(|listed| (latest, (listed, None))),
        (Err(error), _) => Err(error),
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
        // Nothing arrives starred, or on a collection.
        List::Starred | List::Collection(_) => None,
    }
}

#[derive(Deserialize)]
pub(super) struct NewQuery {
    feed: Option<i64>,
    folder: Option<i64>,
    collection: Option<i64>,
    #[serde(default)]
    view: View,
    /// The `latest` the list was loaded with.
    since: i64,
}

/// Whether new articles are waiting for the list on screen, so it can say
/// "New items · press r" (SPEC section 13). It never says how many.
pub(super) async fn new_articles(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Query(query): Query<NewQuery>,
) -> Response {
    // Nothing arrives already opened, or lined up, so Recently read and Up
    // Next never have new items.
    let Some(list) = List::from_query(query.feed, query.folder, query.collection, query.view)
    else {
        return Json(json!({ "new": false })).into_response();
    };
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
                    entries.read, entries.starred, entries.muted,
                    articles.episode_url IS NOT NULL AS episode, articles.episode_seconds
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

/// A collection's list: its own lines, read through their primary key, then
/// each one's entry, sorted on the spot. A collection is the reader's own
/// short shelf, so the sort is small, and walking every entry in order to
/// find a few would be slower. Takes the reader, then the collection's
/// number (only lines of the reader's own count), then the cursor and the
/// limit, as `list_sql`'s questions do. The `+` keeps SQLite from reading
/// every line of the reader's through `collection_articles_by_entry` instead.
macro_rules! collection_query {
    ($past:literal, $order:literal) => {
        concat!(
            "SELECT entries.article_id AS id, entries.feed_id, subscriptions.title AS feed_title,
                    articles.title, articles.link, entries.sort_at AS at,
                    entries.read, entries.starred, entries.muted,
                    articles.episode_url IS NOT NULL AS episode, articles.episode_seconds
             FROM collection_articles
                 CROSS JOIN entries ON entries.person_id = collection_articles.person_id
                     AND entries.article_id = collection_articles.article_id
                 CROSS JOIN articles ON articles.id = entries.article_id
                 CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
                     AND subscriptions.feed_id = entries.feed_id
             WHERE +collection_articles.person_id = ? AND collection_articles.collection_id = ?
                 AND (entries.sort_at, entries.article_id) ",
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
        (List::Collection(_), Order::Newest) => collection_query!("<", "DESC"),
        (List::Collection(_), Order::Oldest) => collection_query!(">", "ASC"),
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
    if let List::Feed(id) | List::Folder(id) | List::Collection(id) = list {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_positions_are_read_strictly() {
        assert_eq!(parse_cursor("1700000000:42"), Some((1_700_000_000, 42)));
        assert_eq!(parse_cursor("1700000000"), None);
        assert_eq!(parse_cursor("a:b"), None);
    }
}
