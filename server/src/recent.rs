//! Recently read (SPEC section 5, decision 0105): the last 50 articles the
//! reader opened, newest-opened first, as a plain list. No counts, no
//! streaks, nothing about reading habits: only when each was last opened,
//! on the reader's own line for it (`entries.opened_at`, structure change
//! 22), and only for their latest 50, so it stays tiny.
//!
//! The screen says "opened" each time the reading area shows an article
//! (`POST /api/articles/opened`), whether opening it marked it read or it
//! was read already. The list itself is `GET /api/articles?view=recent`
//! (`feeds::list_articles` hands it here).

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
};
use serde::Deserialize;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::ArticleRow,
    marks::now_ms,
};

/// How many opened articles each reader's list keeps.
pub const KEPT: i64 = 50;

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/articles/opened", post(opened))
}

#[derive(Deserialize)]
struct Opened {
    id: i64,
}

/// Notes that the reader opened an article just now, then lets go of the
/// times beyond their latest 50. An article they don't have is skipped.
async fn opened(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Opened>,
) -> Response {
    match note(&state.db, person, form.id, now_ms()).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("noting an opened article", &error),
    }
}

/// Notes that reader `person` opened article `id` at `at` (milliseconds),
/// keeping only the latest `KEPT` times their list can show. Both in one
/// transaction.
pub async fn note(db: &sqlx::SqlitePool, person: i64, id: i64, at: i64) -> Result<(), sqlx::Error> {
    let mut transaction = db.begin().await?;
    let changed =
        sqlx::query("UPDATE entries SET opened_at = ?3 WHERE person_id = ?1 AND article_id = ?2")
            .bind(person)
            .bind(id)
            .bind(at)
            .execute(&mut *transaction)
            .await?
            .rows_affected();
    if changed > 0 {
        // Every time but the latest 50 the list can show goes, read through
        // the `entries_opened` index: at most one, usually. A muted article,
        // or one of a feed since left, isn't listed, so it keeps no place
        // and the list always fills its 50.
        sqlx::query(
            "UPDATE entries SET opened_at = NULL
             WHERE person_id = ?1 AND opened_at IS NOT NULL AND article_id NOT IN (
                 SELECT entries.article_id FROM entries
                     CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
                         AND subscriptions.feed_id = entries.feed_id
                 WHERE entries.person_id = ?1 AND entries.opened_at IS NOT NULL
                     AND entries.muted = 0 AND subscriptions.unsubscribed_at IS NULL
                 ORDER BY entries.opened_at DESC, entries.article_id DESC LIMIT ?2)",
        )
        .bind(person)
        .bind(KEPT)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await
}

/// The reader's recently read list, newest-opened first: every article they
/// still have with an opening time, from feeds they still follow (a starred
/// article of a feed since left stays in Starred, not here). Muted ones are
/// left out, as in All. Takes the reader.
pub const LIST: &str =
    "SELECT entries.article_id AS id, entries.feed_id, subscriptions.title AS feed_title,
            articles.title, articles.link, entries.sort_at AS at,
            entries.read, entries.starred, entries.muted,
            articles.episode_url IS NOT NULL AS episode, articles.episode_seconds
     FROM entries CROSS JOIN articles ON articles.id = entries.article_id
         CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
             AND subscriptions.feed_id = entries.feed_id
     WHERE entries.person_id = ? AND entries.opened_at IS NOT NULL AND entries.muted = 0
         AND subscriptions.unsubscribed_at IS NULL
     ORDER BY entries.opened_at DESC, entries.article_id DESC
     LIMIT 50";

/// The whole list: it's never longer than one page.
pub async fn list(db: &sqlx::SqlitePool, person: i64) -> Result<Vec<ArticleRow>, sqlx::Error> {
    sqlx::query_as(LIST).bind(person).fetch_all(db).await
}
