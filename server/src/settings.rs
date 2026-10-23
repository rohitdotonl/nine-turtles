//! The reader's settings shared across their devices (SPEC section 18). So
//! far only the sort order. Reader controls such as the theme belong to each
//! device and stay in its browser.

use axum::{
    Json, Router,
    extract::State,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::{Deserialize, Serialize};

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::Order,
};

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/settings", get(read).post(change))
}

#[derive(Serialize, Deserialize)]
struct Settings {
    /// Newest or oldest first.
    sort: Order,
}

async fn read(_: SignedIn, State(state): State<AppState>) -> Response {
    let sort: Result<Option<String>, sqlx::Error> =
        sqlx::query_scalar("SELECT value FROM settings WHERE name = 'sort'")
            .fetch_optional(&state.db)
            .await;
    match sort {
        Ok(sort) => {
            // Anything not understood (from a later version, say) reads as the default.
            let sort = match sort.as_deref() {
                Some("oldest") => Order::Oldest,
                _ => Order::Newest,
            };
            Json(Settings { sort }).into_response()
        }
        Err(error) => database_problem("reading settings", &error),
    }
}

async fn change(
    _: SignedIn,
    State(state): State<AppState>,
    Json(settings): Json<Settings>,
) -> Response {
    let sort = match settings.sort {
        Order::Newest => "newest",
        Order::Oldest => "oldest",
    };
    let saved = sqlx::query(
        "INSERT INTO settings (name, value) VALUES ('sort', ?)
         ON CONFLICT (name) DO UPDATE SET value = excluded.value",
    )
    .bind(sort)
    .execute(&state.db)
    .await;
    match saved {
        Ok(_) => Json(settings).into_response(),
        Err(error) => database_problem("saving settings", &error),
    }
}
