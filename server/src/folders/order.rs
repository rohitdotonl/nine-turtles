//! The reader's own order of their folders (SPEC section 5, decision 0207):
//! the sidebar sends every folder's number, top to bottom, after a drag or
//! a Move up, and again for Undo.

use axum::{
    Json,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Deserialize;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
};

#[derive(Deserialize)]
pub(super) struct Order {
    /// The reader's folders, top to bottom.
    folders: Vec<i64>,
}

/// Puts the reader's folders in the order given. A number that isn't one of
/// theirs changes nothing; a folder left out keeps its place number.
pub(super) async fn save(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Order>,
) -> Response {
    let saved: Result<(), sqlx::Error> = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        for (place, id) in (1_i64..).zip(&form.folders) {
            sqlx::query("UPDATE folders SET position = ? WHERE id = ? AND person_id = ?")
                .bind(place)
                .bind(id)
                .bind(person)
                .execute(&mut *transaction)
                .await?;
        }
        transaction.commit().await
    }
    .await;
    match saved {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("ordering folders", &error),
    }
}
