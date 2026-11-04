//! Podcasts (SPEC section 35, decision 0113): where each reader stopped in
//! each episode. Each reader's alone, like every mark.
//!
//! nine turtles never fetches, copies or passes on an episode's audio: the
//! reader's browser plays the publisher's own file from the publisher's own
//! address (the publisher floor). The server only keeps, per reader, a
//! position in seconds (`episode_progress`), tied to the reader's own entry
//! for the article (structure change 24), so it goes with it when the entry
//! goes. (Up Next was removed in step 5 of the owner's review; its old
//! `up_next` table is kept, unused, until the owner says it can go.) A YouTube video's place is kept the
//! same way (decision 0144): any article whose link is on YouTube may have
//! one, so a video picks up where you stopped, on any device.
//!
//! - `GET /api/episodes/{id}/progress`: where the reader stopped, or null.
//! - `POST /api/episodes/{id}/progress` `{position, duration, finished, at}`:
//!   the latest save wins (`at`, milliseconds, as marks are; never later
//!   than the server's own now).

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    marks::now_ms,
};

/// An article whose link is a YouTube video, as YouTube's feeds write
/// one (decision 0149): it keeps a place too, as an episode does.
/// (A macro, so the queries stay fixed strings.)
macro_rules! youtube_video {
    () => {
        "articles.link LIKE 'https://www.youtube.com/watch?v=%'
         OR articles.link LIKE 'https://www.youtube.com/shorts/%'
         OR articles.link LIKE 'https://www.youtube.com/live/%'
         OR articles.link LIKE 'https://youtu.be/%'"
    };
}

pub fn routes() -> Router<AppState> {
    Router::new().route(
        "/api/episodes/{id}/progress",
        get(progress).post(save_progress),
    )
}

#[derive(Debug, PartialEq, Serialize, sqlx::FromRow)]
pub struct Progress {
    /// Where the reader stopped, in seconds from the start.
    pub position: f64,
    /// How long the episode turned out to be, in seconds, if known.
    pub duration: Option<f64>,
    /// Played to (nearly) the end.
    pub finished: bool,
    /// When it was saved (milliseconds, by the server's clock), so a device
    /// can tell whether its own copy, kept while offline, is newer.
    pub saved_at: i64,
}

/// Where reader `person` stopped in episode `id`, if anywhere.
pub async fn progress_of(
    db: &sqlx::SqlitePool,
    person: i64,
    id: i64,
) -> Result<Option<Progress>, sqlx::Error> {
    sqlx::query_as(
        "SELECT position, duration, finished, saved_at FROM episode_progress
         WHERE person_id = ? AND article_id = ?",
    )
    .bind(person)
    .bind(id)
    .fetch_optional(db)
    .await
}

async fn progress(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match progress_of(&state.db, person, id).await {
        Ok(progress) => Json(json!({ "progress": progress })).into_response(),
        Err(error) => database_problem("reading where an episode stopped", &error),
    }
}

#[derive(Deserialize)]
struct Saving {
    position: f64,
    duration: Option<f64>,
    #[serde(default)]
    finished: bool,
    /// When the device saved it (milliseconds since 1970, by the server's
    /// clock as the device knows it); just now if absent.
    at: Option<i64>,
}

/// Keeps where the reader stopped. Only an episode or a video they have (an
/// entry of theirs); any other is not found. A save older than
/// the one kept changes nothing, so a late save from another device never
/// takes the reader back.
async fn save_progress(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<Saving>,
) -> Response {
    let sensible = |seconds: f64| seconds.is_finite() && (0.0..=86_400.0 * 7.0).contains(&seconds);
    if !sensible(form.position) || form.duration.is_some_and(|duration| !sensible(duration)) {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let now = now_ms();
    let at = form.at.map_or(now, |at| at.min(now));
    let saved = sqlx::query(concat!(
        "INSERT INTO episode_progress (person_id, article_id, position, duration, finished, saved_at)
         SELECT entries.person_id, entries.article_id, ?3, ?4, ?5, ?6
         FROM entries JOIN articles ON articles.id = entries.article_id
         WHERE entries.person_id = ?1 AND entries.article_id = ?2
             AND (articles.episode_url IS NOT NULL OR " , youtube_video!(), ")
         ON CONFLICT (person_id, article_id) DO UPDATE SET
             position = excluded.position, duration = excluded.duration,
             finished = excluded.finished, saved_at = excluded.saved_at
         WHERE excluded.saved_at >= episode_progress.saved_at"
    ))
    .bind(person)
    .bind(id)
    .bind(form.position)
    .bind(form.duration)
    .bind(form.finished)
    .bind(at)
    .execute(&state.db)
    .await;
    match saved {
        Ok(_) => match is_episode_of(&state.db, person, id).await {
            Ok(true) => StatusCode::NO_CONTENT.into_response(),
            Ok(false) => StatusCode::NOT_FOUND.into_response(),
            Err(error) => database_problem("saving where an episode stopped", &error),
        },
        Err(error) => database_problem("saving where an episode stopped", &error),
    }
}

/// Whether article `id` is an episode or a video reader `person` has.
async fn is_episode_of(db: &sqlx::SqlitePool, person: i64, id: i64) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(concat!(
        "SELECT EXISTS (SELECT 1 FROM entries JOIN articles ON articles.id = entries.article_id
             WHERE entries.person_id = ? AND entries.article_id = ?
                 AND (articles.episode_url IS NOT NULL OR ",
        youtube_video!(),
        "))"
    ))
    .bind(person)
    .bind(id)
    .fetch_one(db)
    .await
}
