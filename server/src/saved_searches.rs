//! Saved searches (SPEC section 14): a search the reader named, listed in
//! the sidebar under "Saved searches", alphabetically, and run again when
//! opened. Renaming one, changing what it searches, and deleting it (with
//! Undo, which the screen does by saving it again).
//!
//! What a saved search looks for is kept as the screen describes it, in
//! JSON: nine turtles only checks it's a small JSON object. The search
//! itself runs through `search`, as any other.

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    folders::clean_name,
    now,
};

/// The most a saved search's description may take, in bytes. A search with
/// every filter and a long line of words fits many times over.
pub const LARGEST_QUERY: usize = 4096;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/saved-searches", get(list).post(create))
        .route("/api/saved-searches/{id}", post(change))
        .route("/api/saved-searches/{id}/delete", post(delete))
}

#[derive(Serialize)]
struct SavedSearch {
    id: i64,
    name: String,
    query: Value,
}

#[derive(Deserialize)]
struct Form {
    name: String,
    query: Map<String, Value>,
}

impl Form {
    /// The name tidied, and the query as stored; or the word for why it
    /// can't be saved.
    fn checked(&self) -> Result<(String, String), &'static str> {
        let name = clean_name(&self.name).ok_or("no-name")?;
        let query = Value::Object(self.query.clone()).to_string();
        if query.len() > LARGEST_QUERY {
            return Err("too-large");
        }
        Ok((name, query))
    }
}

/// Every saved search, alphabetically (SPEC section 5).
async fn list(_: SignedIn, State(state): State<AppState>) -> Response {
    let rows: Result<Vec<(i64, String, String)>, sqlx::Error> = sqlx::query_as(
        "SELECT id, name, query FROM saved_searches ORDER BY name COLLATE NOCASE, id",
    )
    .fetch_all(&state.db)
    .await;
    match rows {
        Ok(rows) => {
            let searches: Vec<SavedSearch> = rows
                .into_iter()
                .map(|(id, name, query)| SavedSearch {
                    id,
                    name,
                    query: serde_json::from_str(&query).unwrap_or(Value::Object(Map::new())),
                })
                .collect();
            Json(json!({ "searches": searches })).into_response()
        }
        Err(error) => database_problem("listing saved searches", &error),
    }
}

async fn create(_: SignedIn, State(state): State<AppState>, Json(form): Json<Form>) -> Response {
    let (name, query) = match form.checked() {
        Ok(checked) => checked,
        Err(refusal) => return problem(StatusCode::BAD_REQUEST, refusal),
    };
    let created: Result<i64, sqlx::Error> = sqlx::query_scalar(
        "INSERT INTO saved_searches (name, query, created_at) VALUES (?, ?, ?) RETURNING id",
    )
    .bind(&name)
    .bind(&query)
    .bind(now())
    .fetch_one(&state.db)
    .await;
    match created {
        Ok(id) => (
            StatusCode::CREATED,
            Json(json!({ "search": SavedSearch { id, name, query: Value::Object(form.query) } })),
        )
            .into_response(),
        Err(sqlx::Error::Database(error)) if error.is_unique_violation() => {
            problem(StatusCode::CONFLICT, "already")
        }
        Err(error) => database_problem("saving a search", &error),
    }
}

/// A new name, and what it searches, saved together.
async fn change(
    _: SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<Form>,
) -> Response {
    let (name, query) = match form.checked() {
        Ok(checked) => checked,
        Err(refusal) => return problem(StatusCode::BAD_REQUEST, refusal),
    };
    let changed = sqlx::query("UPDATE saved_searches SET name = ?, query = ? WHERE id = ?")
        .bind(&name)
        .bind(&query)
        .bind(id)
        .execute(&state.db)
        .await;
    match changed {
        Ok(changed) if changed.rows_affected() == 0 => StatusCode::NOT_FOUND.into_response(),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(sqlx::Error::Database(error)) if error.is_unique_violation() => {
            problem(StatusCode::CONFLICT, "already")
        }
        Err(error) => database_problem("changing a saved search", &error),
    }
}

/// Deletes a saved search. Only the search goes: no article is touched. The
/// screen keeps its name and query, so Undo can save it again.
async fn delete(_: SignedIn, State(state): State<AppState>, Path(id): Path<i64>) -> Response {
    let deleted = sqlx::query("DELETE FROM saved_searches WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await;
    match deleted {
        Ok(deleted) if deleted.rows_affected() == 0 => StatusCode::NOT_FOUND.into_response(),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("deleting a saved search", &error),
    }
}

/// A feed or folder is gone for good: saved searches limited to it now
/// look in number 0, which is nothing, so they find nothing rather than
/// searching everything. Feeds and folders are numbered without
/// AUTOINCREMENT, so SQLite may give the same number to a new one, which
/// they'd otherwise quietly start searching (decision 0076).
pub async fn forget<'c>(
    executor: impl sqlx::SqliteExecutor<'c>,
    kind: &str,
    id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE saved_searches SET query = json_set(query, '$.scope.id', 0)
         WHERE json_extract(query, '$.scope.kind') = ? AND json_extract(query, '$.scope.id') = ?",
    )
    .bind(kind)
    .bind(id)
    .execute(executor)
    .await?;
    Ok(())
}

fn problem(status: StatusCode, error: &str) -> Response {
    (status, Json(json!({ "error": error }))).into_response()
}
