//! Marking articles read or unread, starring them (SPEC sections 8 and 9),
//! and muting or unmuting them (SPEC section 27).
//!
//! The screen changes first and tells the server behind it (SPEC section 25),
//! always naming the exact articles: "mark all as read" sends the ones on
//! screen, so articles that arrived in the background are never touched
//! (ENGINEERING.md → "Data"). Undo is the screen sending the opposite mark
//! for the same articles.
//!
//! Marks are each reader's own (their entries, decision 0086): marking an
//! article changes nothing for another reader of the same feed, and an
//! article the reader doesn't have is skipped.
//!
//! The latest mark wins (decision 0101): a read mark or a star made on a
//! device without a connection arrives later, saying when it was made
//! (`at`, milliseconds since 1970). If the same mark was set since, on
//! another device, the late one changes nothing. A mark that doesn't say
//! when counts as made now, and none counts as made later than now.

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
};
use serde::Deserialize;
use serde_json::json;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
};

/// More articles than any screen shows at once: 200 presses of "Show older
/// items". A request naming more is refused rather than half done.
pub const MOST_AT_ONCE: usize = 10_000;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/articles/read", post(mark_read))
        .route("/api/articles/starred", post(mark_starred))
        .route("/api/articles/muted", post(mark_muted))
}

#[derive(Deserialize)]
struct Read {
    ids: Vec<i64>,
    read: bool,
    /// When the mark was made, if not just now (milliseconds since 1970).
    at: Option<i64>,
}

#[derive(Deserialize)]
struct Starred {
    ids: Vec<i64>,
    starred: bool,
    at: Option<i64>,
}

/// One of a reader's marks on an article. Every way of marking (the screen,
/// other apps, assistants) sets them with `set`, so they all behave alike.
#[derive(Clone, Copy)]
pub enum Mark {
    /// Marking a muted article unread unmutes it, so it waits in Unread again.
    Read,
    Starred,
    /// Muted articles count as read; unmuted, they come back unread.
    Muted,
}

impl Mark {
    /// Takes the mark, the articles, the reader and when the mark was made;
    /// a read mark or star older than the one stored is skipped.
    fn sql(self) -> &'static str {
        match self {
            Self::Read => READ_SQL,
            Self::Starred => STAR_SQL,
            Self::Muted => MUTE_SQL,
        }
    }
}

const READ_SQL: &str = "UPDATE entries SET read = ?1, muted = muted * ?1, read_marked_at = ?4
     WHERE person_id = ?3 AND article_id IN (SELECT value FROM json_each(?2))
         AND read_marked_at <= ?4";

const STAR_SQL: &str = "UPDATE entries SET starred = ?1, starred_marked_at = ?4
     WHERE person_id = ?3 AND article_id IN (SELECT value FROM json_each(?2))
         AND starred_marked_at <= ?4";

const MUTE_SQL: &str = "UPDATE entries SET muted = ?1, read = ?1, read_marked_at = ?4
     WHERE person_id = ?3 AND article_id IN (SELECT value FROM json_each(?2))";

/// Milliseconds since 1970 (UTC): when a mark made just now was made.
pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| {
            i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
        })
}

/// When a mark was made: as the device says, but never later than now, so a
/// device whose clock runs fast can't make its marks outlast later ones for long.
fn made_at(at: Option<i64>) -> i64 {
    let now = now_ms();
    at.map_or(now, |at| at.clamp(0, now))
}

async fn mark_read(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Read>,
) -> Response {
    mark(
        &state,
        person,
        Mark::Read,
        &form.ids,
        form.read,
        made_at(form.at),
    )
    .await
}

async fn mark_starred(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Starred>,
) -> Response {
    let at = made_at(form.at);
    mark(&state, person, Mark::Starred, &form.ids, form.starred, at).await
}

#[derive(Deserialize)]
struct Muted {
    ids: Vec<i64>,
    muted: bool,
}

/// Mutes articles, or unmutes them (SPEC section 27). Either way they count
/// as read while muted and come back unread: muting is undone by unmuting,
/// and unmuting (from the Muted page) by muting again.
async fn mark_muted(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Muted>,
) -> Response {
    mark(&state, person, Mark::Muted, &form.ids, form.muted, now_ms()).await
}

/// Marks the named articles for the screen, answering how many changed.
async fn mark(
    state: &AppState,
    person: i64,
    which: Mark,
    ids: &[i64],
    value: bool,
    at: i64,
) -> Response {
    if ids.len() > MOST_AT_ONCE {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
    match set(&state.db, person, which, ids, value, at).await {
        Ok(marked) => Json(json!({ "marked": marked })).into_response(),
        Err(error) => database_problem("marking articles", &error),
    }
}

/// Sets one of the reader's marks on the named articles, all in one step.
/// Articles they don't have (gone, or of a feed they never followed) are
/// skipped, and so are those whose mark was set later than `at`. Answers
/// how many it changed. Callers refuse more than `MOST_AT_ONCE` first.
pub async fn set<'c>(
    executor: impl sqlx::SqliteExecutor<'c>,
    person: i64,
    which: Mark,
    ids: &[i64],
    value: bool,
    at: i64,
) -> Result<u64, sqlx::Error> {
    let ids = serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_owned());
    let done = sqlx::query(which.sql())
        .bind(value)
        .bind(ids)
        .bind(person)
        .bind(at)
        .execute(executor)
        .await?;
    Ok(done.rows_affected())
}
