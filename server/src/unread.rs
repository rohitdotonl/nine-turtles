//! Easing unread guilt (SPEC section 8, decision 0095): unread that lets go
//! by itself, and "Catch me up".
//!
//! **Letting go:** a reader who chooses, in Settings › Reading, to let unread
//! go after a week, two weeks or a month has older unread articles counted as
//! read. They leave Unread and the counts, and stay in their feed, All and
//! search; nothing is removed. It happens in each background round
//! (`checking::round`) and at once when the setting is saved. "Older" is the
//! article's date in the list (`sort_at`), so a newly added blog's old posts
//! don't fill Unread either.
//!
//! **Catching up:** one action marks every unread article in Unread from
//! before the start of the reader's day as read, and answers which, so Undo
//! (the screen sending "unread" for the same articles) puts back exactly
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
    now,
};

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/articles/catch-up", post(catch_up))
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
/// Takes the reader, the time, and the reader again.
pub const LET_GO: &str = "UPDATE entries SET read = 1
     WHERE person_id = ?1 AND read = 0 AND sort_at < ?2
         AND feed_id IN (SELECT feed_id FROM subscriptions
             WHERE person_id = ?1 AND unsubscribed_at IS NULL)";

/// Lets go every reader's unread articles older than their chosen wait, at
/// `now`. Answers how many articles let go.
pub async fn let_go(db: &SqlitePool, now: i64) -> Result<u64, sqlx::Error> {
    let readers: Vec<(i64, String)> =
        sqlx::query_as("SELECT person_id, value FROM person_settings WHERE name = 'let_go'")
            .fetch_all(db)
            .await?;
    let mut done = 0;
    for (person, value) in readers {
        done += let_go_for(db, person, &value, now).await?;
    }
    Ok(done)
}

/// Lets go one reader's unread articles older than the wait `value` names.
pub async fn let_go_for(
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
pub const CATCH_UP: &str = "UPDATE entries SET read = 1
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
