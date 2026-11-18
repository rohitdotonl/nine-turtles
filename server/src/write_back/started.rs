//! Replies you started (SPEC section 37, decision 0307): a line for each
//! article the reader started a reply to, shown on the person's page with
//! the day. The web app tells the server when any way back at an article's
//! end is pressed (an email, Gmail, Outlook.com, their address copied, a
//! comment on their site); nine turtles never knows whether anything was
//! sent, and never sees what was written. One line per article, with the
//! latest day; each can be removed, with Undo, and the reader can switch the
//! list off in Settings (`settings`, `replies`), which stops new lines and
//! hides it.

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::ArticleRow,
    now, refused,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/articles/{id}/reply-started", post(started))
        .route("/api/articles/{id}/reply-started/delete", post(forget))
        .route("/api/feeds/{id}/replies", get(their_replies))
}

/// The most lines their page lists: a page, not an archive.
pub const THEIR_REPLIES: i64 = 20;

/// Whether the reader keeps the list (on unless they switched it off).
pub async fn keeping(db: &sqlx::SqlitePool, person: i64) -> Result<bool, sqlx::Error> {
    let off: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM person_settings WHERE person_id = ? AND name = 'replies' AND value = 'off'",
    )
    .bind(person)
    .fetch_optional(db)
    .await?;
    Ok(off.is_none())
}

#[derive(Deserialize, Default)]
struct Started {
    /// Undo after Remove: the day the line had, so it comes back as it was.
    /// Never later than now.
    at: Option<i64>,
}

/// A way back was pressed at the article's end: its line, with today's day
/// (or, for Undo, the day it had). Nothing when the reader switched the list
/// off; 404 when the article isn't theirs.
async fn started(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    body: Option<Json<Started>>,
) -> Response {
    let at = body
        .and_then(|Json(body)| body.at)
        .map_or_else(now, |at| at.clamp(0, now()));
    let kept = async {
        if !keeping(&state.db, person).await? {
            return Ok(Some(()));
        }
        let done = sqlx::query(
            "INSERT INTO replies (person_id, article_id, started_at)
                 SELECT person_id, article_id, ?3 FROM entries WHERE person_id = ?1 AND article_id = ?2
             ON CONFLICT (person_id, article_id) DO UPDATE SET started_at = MAX(started_at, excluded.started_at)",
        )
        .bind(person)
        .bind(id)
        .bind(at)
        .execute(&state.db)
        .await?;
        Ok::<_, sqlx::Error>((done.rows_affected() > 0).then_some(()))
    }
    .await;
    match kept {
        Ok(Some(())) => StatusCode::NO_CONTENT.into_response(),
        Ok(None) => refused(StatusCode::NOT_FOUND, "not-found"),
        Err(error) => database_problem("noting a reply started", &error),
    }
}

/// Remove one line (the screen offers Undo, which writes it back with its day).
async fn forget(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let done = sqlx::query("DELETE FROM replies WHERE person_id = ? AND article_id = ?")
        .bind(person)
        .bind(id)
        .execute(&state.db)
        .await;
    match done {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("removing a reply started", &error),
    }
}

/// A reply started, as their page lists it: the day, and the article.
#[derive(Serialize, sqlx::FromRow)]
pub struct Reply {
    pub started_at: i64,
    #[sqlx(flatten)]
    pub article: ArticleRow,
}

/// The replies the reader started to articles from every place of the
/// person's, the latest first. None while the list is switched off.
pub async fn replies_to(
    db: &sqlx::SqlitePool,
    person: i64,
    feed: i64,
) -> Result<Vec<Reply>, sqlx::Error> {
    if !keeping(db, person).await? {
        return Ok(Vec::new());
    }
    sqlx::query_as(concat!(
        "WITH places AS (
             SELECT feed_id FROM subscriptions
             WHERE person_id = ?1 AND unsubscribed_at IS NULL AND (feed_id = ?2 OR writer_id =
                 (SELECT writer_id FROM subscriptions WHERE person_id = ?1 AND feed_id = ?2)))
         SELECT replies.started_at,
             entries.article_id AS id, entries.feed_id,
             COALESCE(writers.name, subscriptions.title) AS feed_title,
             articles.title, articles.link, entries.sort_at AS at,
             entries.read, entries.starred, entries.muted,
             articles.episode_url IS NOT NULL AS episode, articles.episode_seconds, ",
        crate::feeds::untitled_body!(),
        "
         FROM replies
             JOIN entries ON entries.person_id = replies.person_id AND entries.article_id = replies.article_id
             JOIN articles ON articles.id = entries.article_id
             JOIN subscriptions ON subscriptions.person_id = entries.person_id
                 AND subscriptions.feed_id = entries.feed_id
             LEFT JOIN writers ON writers.id = subscriptions.writer_id
         WHERE replies.person_id = ?1 AND entries.feed_id IN (SELECT feed_id FROM places)
         ORDER BY replies.started_at DESC, replies.article_id DESC
         LIMIT ?3",
    ))
    .bind(person)
    .bind(feed)
    .bind(THEIR_REPLIES)
    .fetch_all(db)
    .await
}

async fn their_replies(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match replies_to(&state.db, person, id).await {
        Ok(found) => Json(json!({ "replies": found })).into_response(),
        Err(error) => database_problem("listing the replies started", &error),
    }
}
