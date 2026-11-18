//! Pinned (SPEC section 5, decision 0310): the people and publications a
//! reader keeps at the top of Home, up to `MOST`, in the order pinned. The
//! reader pins someone from their page; nine turtles never pins anyone by
//! itself. A person's pin is kept on every place of theirs
//! (`subscriptions.pinned_at`), as Write back's switch is, so a row stands
//! pinned when any of its places is.
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
};
use serde::Deserialize;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    now, refused,
};

/// The most rows Pinned holds: a handful, never a second list of everyone.
pub const MOST: i64 = 9;

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/feeds/{id}/pin", post(pin))
}

#[derive(Deserialize)]
struct Pin {
    pinned: bool,
}

/// How a pin went: done, refused as Pinned is full, or the place isn't followed.
#[derive(Debug, PartialEq, Eq)]
pub enum Pinned {
    Done,
    Full,
    NotFound,
}

/// `POST /api/feeds/3/pin` with `{"pinned": true}` pins place 3's person (all
/// their places), or with `false` unpins them. Refused as `full` when `MOST`
/// others are pinned already, `not-found` when the reader doesn't follow it.
async fn pin(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<Pin>,
) -> Response {
    match set(&state.db, person, id, form.pinned).await {
        Ok(Pinned::Done) => StatusCode::NO_CONTENT.into_response(),
        Ok(Pinned::Full) => refused(StatusCode::CONFLICT, "full"),
        Ok(Pinned::NotFound) => refused(StatusCode::NOT_FOUND, "not-found"),
        Err(error) => database_problem("pinning someone to Home", &error),
    }
}

/// How many rows the reader has pinned: people, not places.
async fn pinned_rows(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT COUNT(DISTINCT COALESCE('w' || writer_id, 'f' || feed_id)) FROM subscriptions
         WHERE person_id = ? AND unsubscribed_at IS NULL AND pinned_at IS NOT NULL",
    )
    .bind(person)
    .fetch_one(connection)
    .await
}

/// A place brought back (Undo, Bring back) keeps its pin only while Pinned
/// has room: past `MOST`, it comes back unpinned.
pub async fn keep_to_most(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    feed: i64,
) -> Result<(), sqlx::Error> {
    if pinned_rows(connection, person).await? > MOST {
        sqlx::query(
            "UPDATE subscriptions SET pinned_at = NULL WHERE person_id = ? AND feed_id = ?",
        )
        .bind(person)
        .bind(feed)
        .execute(connection)
        .await?;
    }
    Ok(())
}

/// Pins or unpins the person place `feed` belongs to, for reader `person`.
/// Pinning someone already pinned keeps their place in the order.
pub async fn set(
    db: &sqlx::SqlitePool,
    person: i64,
    feed: i64,
    pinned: bool,
) -> Result<Pinned, sqlx::Error> {
    // It reads, then writes: the write lock first, so two pins at once can't both pass the count.
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let followed: Option<(Option<i64>, Option<i64>)> = sqlx::query_as(
        "SELECT writer_id, pinned_at FROM subscriptions
         WHERE person_id = ? AND feed_id = ? AND unsubscribed_at IS NULL",
    )
    .bind(person)
    .bind(feed)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some((writer, already)) = followed else {
        return Ok(Pinned::NotFound);
    };
    if pinned && already.is_some() {
        return Ok(Pinned::Done);
    }
    if pinned {
        // Rows, not places: a person with three places pinned is one.
        let others: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT COALESCE('w' || writer_id, 'f' || feed_id)) FROM subscriptions
             WHERE person_id = ?1 AND unsubscribed_at IS NULL AND pinned_at IS NOT NULL
                 AND NOT (feed_id = ?2 OR (?3 IS NOT NULL AND writer_id = ?3))",
        )
        .bind(person)
        .bind(feed)
        .bind(writer)
        .fetch_one(&mut *transaction)
        .await?;
        if others >= MOST {
            return Ok(Pinned::Full);
        }
    }
    // Every place of theirs: those followed, and those unsubscribed within
    // Bring back's 30 days, so one brought back agrees.
    sqlx::query(
        "UPDATE subscriptions SET pinned_at = ?3
         WHERE person_id = ?1
             AND (feed_id = ?2 OR (?4 IS NOT NULL AND writer_id = ?4))",
    )
    .bind(person)
    .bind(feed)
    .bind(pinned.then(now))
    .bind(writer)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Pinned::Done)
}
