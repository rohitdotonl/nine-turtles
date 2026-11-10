//! Settings › Connected assistants (SPEC section 33): the reader's
//! connections, disconnecting one with Undo (decision 0235), and making an
//! assistant key.
//!
//! Disconnecting stops the assistant at once: every ticket of the
//! connection is refused from that moment (`disconnected_at` is checked
//! wherever a ticket is). The connection itself waits, hidden, for
//! `UNDO_FOR`, so Undo can bring the same connection back with its tickets,
//! and the reader doesn't have to connect again from inside the assistant.
//! After that, or as soon as the reader disconnects another (Undo only
//! reverses the last action), it's deleted for good, tickets and all.

use axum::{
    Json,
    extract::{Path, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqlitePool;

use super::{KEY_PREFIX, clean_name};
use crate::{
    AppState,
    auth::{SignedIn, database_problem, new_token, scramble},
    folders::UNDO_FOR,
    log, now,
};

#[derive(Serialize, sqlx::FromRow)]
struct Connected {
    id: i64,
    name: String,
    connected_at: i64,
    last_used_at: Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
struct Kept {
    feed_id: i64,
    title: String,
    unsubscribed_at: i64,
    kept_until: i64,
}

/// Deletes for good, tickets and all, the disconnected assistants that Undo
/// can't reach any more (those disconnected at or before `before`): one
/// reader's, or (`None`) everyone's, as each background round does.
pub async fn forget_disconnected(
    db: &SqlitePool,
    person: Option<i64>,
    before: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM assistant_connections
         WHERE (?1 IS NULL OR person_id = ?1) AND disconnected_at <= ?2",
    )
    .bind(person)
    .bind(before)
    .execute(db)
    .await
    .map(|_| ())
}

/// Settings: the reader's connected assistants, and the feeds an assistant
/// unsubscribed from that can still be brought back.
pub async fn list(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let listed = async {
        forget_disconnected(&state.db, Some(person), now() - UNDO_FOR).await?;
        let assistants: Vec<Connected> = sqlx::query_as(
            "SELECT id, name, created_at AS connected_at, last_used_at
             FROM assistant_connections WHERE person_id = ? AND disconnected_at IS NULL
             ORDER BY created_at, id",
        )
        .bind(person)
        .fetch_all(&state.db)
        .await?;
        let kept: Vec<Kept> = sqlx::query_as(
            "SELECT feed_id, title, unsubscribed_at, kept_until FROM subscriptions
             WHERE person_id = ? AND kept_until IS NOT NULL AND unsubscribed_at IS NOT NULL
                 AND cleared = 0
             ORDER BY unsubscribed_at DESC, feed_id",
        )
        .bind(person)
        .fetch_all(&state.db)
        .await?;
        Ok::<_, sqlx::Error>((assistants, kept))
    }
    .await;
    match listed {
        Ok((assistants, kept)) => {
            Json(json!({ "assistants": assistants, "unsubscribed": kept })).into_response()
        }
        Err(error) => database_problem("listing assistants", &error),
    }
}

/// Disconnects an assistant: its tickets stop working at once, and Undo
/// (`reconnect`) can bring it back for a while. One disconnected before is
/// forgotten for good first, since Undo only reverses the last action.
pub async fn disconnect(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let at = now();
    let done = async {
        forget_disconnected(&state.db, Some(person), i64::MAX).await?;
        sqlx::query(
            "UPDATE assistant_connections SET disconnected_at = ?
             WHERE id = ? AND person_id = ? AND disconnected_at IS NULL",
        )
        .bind(at)
        .bind(id)
        .bind(person)
        .execute(&state.db)
        .await
    }
    .await;
    match done {
        Ok(done) if done.rows_affected() == 0 => StatusCode::NOT_FOUND.into_response(),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("disconnecting an assistant", &error),
    }
}

/// Undo for `disconnect`: the same connection comes back, with its tickets,
/// so the assistant carries on as before. Too late once it's forgotten.
pub async fn reconnect(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let back = sqlx::query(
        "UPDATE assistant_connections SET disconnected_at = NULL
         WHERE id = ? AND person_id = ? AND disconnected_at > ?",
    )
    .bind(id)
    .bind(person)
    .bind(now() - UNDO_FOR)
    .execute(&state.db)
    .await;
    match back {
        Ok(back) if back.rows_affected() == 0 => {
            (StatusCode::CONFLICT, Json(json!({ "error": "too-late" }))).into_response()
        }
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("bringing an assistant back", &error),
    }
}

#[derive(Deserialize)]
pub struct KeyForm {
    #[serde(default)]
    name: Option<String>,
}

/// Makes an assistant key, for an assistant that can't show the "Connect
/// this assistant?" page, and shows it this once.
pub async fn make_key(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<KeyForm>,
) -> Response {
    let key = match new_token() {
        Ok(token) => format!("{KEY_PREFIX}{token}"),
        Err(error) => {
            log::problem(&format!("couldn't make an assistant key: {error}"));
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };
    let name = match form.name.as_deref().map(str::trim) {
        Some(name) if !name.is_empty() => clean_name(Some(name)),
        _ => "Assistant key".to_owned(),
    };
    let at = now();
    let made = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO assistant_connections (person_id, client_id, name, created_at)
             VALUES (?, NULL, ?, ?) RETURNING id",
        )
        .bind(person)
        .bind(&name)
        .bind(at)
        .fetch_one(&mut *transaction)
        .await?;
        sqlx::query(
            "INSERT INTO assistant_tokens (token_hash, connection_id, kind, expires_at)
             VALUES (?, ?, 'key', NULL)",
        )
        .bind(&scramble(&key)[..])
        .bind(id)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok::<i64, sqlx::Error>(id)
    }
    .await;
    match made {
        Ok(id) => (
            StatusCode::CREATED,
            [(header::CACHE_CONTROL, "no-store")],
            Json(json!({
                "key": key,
                "assistant": Connected { id, name, connected_at: at, last_used_at: None },
            })),
        )
            .into_response(),
        Err(error) => database_problem("making an assistant key", &error),
    }
}
