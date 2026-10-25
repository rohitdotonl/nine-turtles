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
}

#[derive(Deserialize)]
struct Starred {
    ids: Vec<i64>,
    starred: bool,
}

/// Marking a muted article unread unmutes it, so it waits in Unread again.
/// Takes the mark, the articles and the reader, as every mark here does.
pub const READ_SQL: &str = "UPDATE entries SET read = ?1, muted = muted * ?1
     WHERE person_id = ?3 AND article_id IN (SELECT value FROM json_each(?2))";

pub const STAR_SQL: &str = "UPDATE entries SET starred = ?1
     WHERE person_id = ?3 AND article_id IN (SELECT value FROM json_each(?2))";

const MUTE_SQL: &str = "UPDATE entries SET muted = ?1, read = ?1
     WHERE person_id = ?3 AND article_id IN (SELECT value FROM json_each(?2))";

async fn mark_read(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Read>,
) -> Response {
    mark(&state, person, READ_SQL, &form.ids, form.read).await
}

async fn mark_starred(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Starred>,
) -> Response {
    mark(&state, person, STAR_SQL, &form.ids, form.starred).await
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
    mark(&state, person, MUTE_SQL, &form.ids, form.muted).await
}

/// Sets one of the reader's marks on the named articles, all in one step.
/// Articles they don't have (gone, or of a feed they never followed) are
/// skipped. Answers how many it found.
async fn mark(
    state: &AppState,
    person: i64,
    sql: &'static str,
    ids: &[i64],
    value: bool,
) -> Response {
    if ids.len() > MOST_AT_ONCE {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
    let ids = serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_owned());
    match sqlx::query(sql)
        .bind(value)
        .bind(ids)
        .bind(person)
        .execute(&state.db)
        .await
    {
        Ok(done) => Json(json!({ "marked": done.rows_affected() })).into_response(),
        Err(error) => database_problem("marking articles", &error),
    }
}
