//! Easing unread guilt (SPEC section 8, decision 0097): unread that lets go
//! by itself, and "Catch me up".
//!
//! **Letting go:** a reader who chooses, in Settings › Reading, to let unread
//! go after a week, two weeks or a month has older unread articles counted as
//! read. They leave Unread and the counts, and stay in their feed, All and
//! search; nothing is removed. It happens in each background round
//! (`checking::round`), once the choice has stood for a minute: moving
//! through the choices with the arrow keys saves each one on the way, and
//! passing "1 week" on the way to "1 month" must let nothing go. It also runs
//! in river mode, where its row is hidden, for feeds that flow past too: no
//! harm, since river mode shows no read state, and back in inbox mode the
//! old articles have let go as chosen. "Older" is the
//! article's date in the list (`sort_at`), so a newly added blog's old posts
//! don't fill Unread either.
//!
//! **Catching up:** one action marks every unread article in Unread from
//! before the start of the reader's day as read, and answers which, so Undo
//! (the screen sending "unread" for the same articles) puts back exactly
//! those.
//!
//! **Marking older (or newer) as read** (decision 0103): `Shift+O` and the
//! list's "Mark all above as read" and "Mark all below as read" mark every
//! unread article in the list on screen that lies past the chosen one, in
//! the list's own order, including those not loaded yet. Only articles that
//! existed when the list was loaded count (its `latest`, which the list's
//! "anything new?" question uses too), so nothing that arrived in the
//! background since is touched. It answers which, so Undo puts back exactly
//! those.

use axum::{
    Json, Router,
    extract::State,
    response::{IntoResponse, Response},
    routing::post,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::{List, View},
    now,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/articles/catch-up", post(catch_up))
        .route("/api/articles/read-past", post(read_past))
}

const DAY: i64 = 86_400;

/// How long an unread article waits before it lets go, for a setting's
/// stored value: none for "never" (the default) or anything not understood.
pub fn waits_for(value: &str) -> Option<i64> {
    match value {
        "week" => Some(7 * DAY),
        "two-weeks" => Some(14 * DAY),
        "month" => Some(30 * DAY),
        _ => None,
    }
}

/// Counts reader `person`'s unread articles from before `before` as read, in
/// the feeds they follow (a feed in its Undo time after unsubscribing is left
/// as it was). Uses the `entries_unread` index (tests/speed.rs checks this).
/// Takes the reader, the time, and the reader again. Like every read mark,
/// it records when it was made, so an older mark sent late from a device
/// that was offline doesn't undo it (decision 0101).
pub const LET_GO: &str =
    "UPDATE entries SET read = 1, read_marked_at = CAST(unixepoch('subsec') * 1000 AS INTEGER)
     WHERE person_id = ?1 AND read = 0 AND sort_at < ?2
         AND feed_id IN (SELECT feed_id FROM subscriptions
             WHERE person_id = ?1 AND unsubscribed_at IS NULL)";

/// How long a newly chosen wait must stand before anything lets go.
pub const SETTLES_FOR: i64 = 60;

/// Lets go every reader's unread articles older than their chosen wait, at
/// `now`, for each reader whose choice has stood for `SETTLES_FOR` (the
/// time it was saved is the `let_go_at` setting). Answers how many articles
/// let go.
pub async fn let_go(db: &SqlitePool, now: i64) -> Result<u64, sqlx::Error> {
    let readers: Vec<(i64, String)> = sqlx::query_as(
        "SELECT person_id, value FROM person_settings AS chosen
         WHERE name = 'let_go' AND NOT EXISTS (
             SELECT 1 FROM person_settings AS saved
             WHERE saved.person_id = chosen.person_id AND saved.name = 'let_go_at'
                 AND CAST(saved.value AS INTEGER) > ?)",
    )
    .bind(now - SETTLES_FOR)
    .fetch_all(db)
    .await?;
    let mut done = 0;
    for (person, value) in readers {
        done += let_go_for(db, person, &value, now).await?;
    }
    Ok(done)
}

/// Lets go one reader's unread articles older than the wait `value` names.
async fn let_go_for(
    db: &SqlitePool,
    person: i64,
    value: &str,
    now: i64,
) -> Result<u64, sqlx::Error> {
    let Some(wait) = waits_for(value) else {
        return Ok(0);
    };
    Ok(sqlx::query(LET_GO)
        .bind(person)
        .bind(now - wait)
        .execute(db)
        .await?
        .rows_affected())
}

/// Every unread article that Unread lists from before `before`, marked read,
/// with their numbers: only feeds the reader follows, and not those that
/// flow past (they're never in Unread). Takes the reader, the time, and the
/// reader again.
pub const CATCH_UP: &str =
    "UPDATE entries SET read = 1, read_marked_at = CAST(unixepoch('subsec') * 1000 AS INTEGER)
     WHERE person_id = ?1 AND read = 0 AND sort_at < ?2
         AND feed_id IN (SELECT feed_id FROM subscriptions
             WHERE person_id = ?1 AND unsubscribed_at IS NULL AND river = 0)
     RETURNING article_id";

#[derive(Deserialize)]
struct CatchUp {
    /// The start of the reader's day, in seconds since 1970, from their
    /// device (which knows its time zone). Never later than now.
    before: i64,
}

/// "Catch me up": everything in Unread from before today counts as read.
async fn catch_up(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<CatchUp>,
) -> Response {
    let before = form.before.min(now());
    let marked: Result<Vec<i64>, sqlx::Error> = sqlx::query_scalar(CATCH_UP)
        .bind(person)
        .bind(before)
        .fetch_all(&state.db)
        .await;
    match marked {
        Ok(ids) => Json(json!({ "ids": ids })).into_response(),
        Err(error) => database_problem("catching up", &error),
    }
}

/// The start of every "mark past this one as read" question: the reader's
/// unread entries in a list, past one place in it (`?3` the date, `?4` the
/// article), that existed when the list was loaded (`?2`, its `latest`).
/// Each takes the reader as `?1`; a feed's or folder's then its number as
/// `?5`. The filters match `feeds::list_sql`, so it marks exactly what the
/// list would go on to show: muted articles (read already) are listed only
/// in Starred, Unread leaves out feeds that flow past, and All, Unread and a
/// folder leave out feeds in their Undo time after unsubscribing.
macro_rules! read_past_query {
    ($filter:literal, $past:literal) => {
        concat!(
            "UPDATE entries SET read = 1,
                 read_marked_at = CAST(unixepoch('subsec') * 1000 AS INTEGER)
             WHERE person_id = ?1 AND read = 0 AND article_id <= ?2
                 AND (sort_at, article_id) ",
            $past,
            " (?3, ?4) AND ",
            $filter,
            " RETURNING article_id"
        )
    };
}

/// Which side of the chosen article to mark: `Older` has an earlier date
/// (below it when the list is newest first), `Newer` a later one.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Older,
    Newer,
}

/// The question that marks one side of a list as read.
pub const fn read_past_sql(list: List, side: Side) -> &'static str {
    match (list, side) {
        (List::All, Side::Older) => read_past_query!(
            "feed_id IN (SELECT feed_id FROM subscriptions
                 WHERE person_id = ?1 AND unsubscribed_at IS NULL)",
            "<"
        ),
        (List::All, Side::Newer) => read_past_query!(
            "feed_id IN (SELECT feed_id FROM subscriptions
                 WHERE person_id = ?1 AND unsubscribed_at IS NULL)",
            ">"
        ),
        (List::Unread, Side::Older) => read_past_query!(
            "feed_id IN (SELECT feed_id FROM subscriptions
                 WHERE person_id = ?1 AND unsubscribed_at IS NULL AND river = 0)",
            "<"
        ),
        (List::Unread, Side::Newer) => read_past_query!(
            "feed_id IN (SELECT feed_id FROM subscriptions
                 WHERE person_id = ?1 AND unsubscribed_at IS NULL AND river = 0)",
            ">"
        ),
        (List::Starred, Side::Older) => read_past_query!("starred = 1", "<"),
        (List::Starred, Side::Newer) => read_past_query!("starred = 1", ">"),
        (List::Feed(_), Side::Older) => read_past_query!("feed_id = ?5 AND muted = 0", "<"),
        (List::Feed(_), Side::Newer) => read_past_query!("feed_id = ?5 AND muted = 0", ">"),
        (List::Folder(_), Side::Older) => read_past_query!(
            "muted = 0 AND feed_id IN (SELECT feed_id FROM feed_folders
                 WHERE folder_id = (SELECT id FROM folders WHERE id = ?5 AND person_id = ?1))
             AND feed_id IN (SELECT feed_id FROM subscriptions
                 WHERE person_id = ?1 AND unsubscribed_at IS NULL)",
            "<"
        ),
        (List::Folder(_), Side::Newer) => read_past_query!(
            "muted = 0 AND feed_id IN (SELECT feed_id FROM feed_folders
                 WHERE folder_id = (SELECT id FROM folders WHERE id = ?5 AND person_id = ?1))
             AND feed_id IN (SELECT feed_id FROM subscriptions
                 WHERE person_id = ?1 AND unsubscribed_at IS NULL)",
            ">"
        ),
    }
}

#[derive(Deserialize)]
struct ReadPast {
    /// The list, named as `GET /api/articles` names it.
    feed: Option<i64>,
    folder: Option<i64>,
    #[serde(default)]
    view: View,
    side: Side,
    /// The chosen article's place in the list: its date and its number.
    at: i64,
    id: i64,
    /// The `latest` the list was loaded with: nothing newer is touched.
    latest: i64,
}

/// "Mark older as read", "Mark all above as read" and "Mark all below as
/// read": every unread article on one side of the chosen one, listed yet or
/// not, counts as read. Answers their numbers, for Undo (which goes in
/// parts the size one mark takes).
async fn read_past(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<ReadPast>,
) -> Response {
    let list = List::from_query(form.feed, form.folder, form.view);
    let mut question = sqlx::query_scalar(read_past_sql(list, form.side))
        .bind(person)
        .bind(form.latest)
        .bind(form.at)
        .bind(form.id);
    if let List::Feed(id) | List::Folder(id) = list {
        question = question.bind(id);
    }
    let marked: Result<Vec<i64>, sqlx::Error> = question.fetch_all(&state.db).await;
    match marked {
        Ok(ids) => Json(json!({ "ids": ids })).into_response(),
        Err(error) => database_problem("marking past an article as read", &error),
    }
}
