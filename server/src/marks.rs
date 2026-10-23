//! Marking articles read or unread, and starring them (SPEC sections 8 and 9).
//!
//! The screen changes first and tells the server behind it (SPEC section 25),
//! always naming the exact articles: "mark all as read" sends the ones on
//! screen, so articles that arrived in the background are never touched
//! (ENGINEERING.md → "Data"). Undo is the screen sending the opposite mark
//! for the same articles.

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

async fn mark_read(_: SignedIn, State(state): State<AppState>, Json(form): Json<Read>) -> Response {
    mark(
        &state,
        "UPDATE articles SET read = ? WHERE id IN (SELECT value FROM json_each(?))",
        &form.ids,
        form.read,
    )
    .await
}

async fn mark_starred(
    _: SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Starred>,
) -> Response {
    mark(
        &state,
        "UPDATE articles SET starred = ? WHERE id IN (SELECT value FROM json_each(?))",
        &form.ids,
        form.starred,
    )
    .await
}

/// Sets one mark on the named articles, all in one step. Articles that no
/// longer exist are skipped. Answers how many articles it found.
async fn mark(state: &AppState, sql: &'static str, ids: &[i64], value: bool) -> Response {
    if ids.len() > MOST_AT_ONCE {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
    let ids = serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_owned());
    match sqlx::query(sql)
        .bind(value)
        .bind(ids)
        .execute(&state.db)
        .await
    {
        Ok(done) => Json(json!({ "marked": done.rows_affected() })).into_response(),
        Err(error) => database_problem("marking articles", &error),
    }
}
