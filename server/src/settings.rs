//! Each reader's settings shared across their devices (SPEC section 18): the
//! sort order and whether Unread is on (SPEC section 10). Reader controls such
//! as the page, font and text size belong to each device and stay in its browser.
//! The sidebar always shows every list now (decision 0187): a `hidden` row
//! saved before is left in place and never read.

use axum::{
    Json, Router,
    extract::State,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::Order,
};

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/settings", get(read).post(change))
}

#[derive(Serialize)]
struct Settings {
    /// Newest or oldest first.
    sort: Order,
    /// Unread on (the Unread list, read styling and dots, the default) or
    /// off (none of those). Read state is recorded either way. Nothing
    /// stored means on.
    unread: bool,
}

/// A change: only the settings named are saved, so a tab that changes the
/// sort order leaves Unread as it was.
#[derive(Deserialize)]
struct Change {
    sort: Option<Order>,
    unread: Option<bool>,
}

async fn load(db: &SqlitePool, person: i64) -> Result<Settings, sqlx::Error> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT name, value FROM person_settings
         WHERE person_id = ? AND name IN ('sort', 'unread')",
    )
    .bind(person)
    .fetch_all(db)
    .await?;
    let value = |name: &str| {
        rows.iter()
            .find(|(each, _)| each == name)
            .map(|(_, value)| value.as_str())
    };
    // Anything not understood (from a later version, say) reads as the default.
    let sort = match value("sort") {
        Some("oldest") => Order::Oldest,
        _ => Order::Newest,
    };
    let unread = value("unread") != Some("off");
    Ok(Settings { sort, unread })
}

async fn read(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    match load(&state.db, person).await {
        Ok(settings) => Json(settings).into_response(),
        Err(error) => database_problem("reading settings", &error),
    }
}

async fn change(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(change): Json<Change>,
) -> Response {
    let sort = change.sort.map(|sort| match sort {
        Order::Newest => "newest",
        Order::Oldest => "oldest",
    });
    let unread = change.unread.map(|on| if on { "on" } else { "off" });
    let saved = async {
        let mut transaction = state.db.begin().await?;
        for (name, value) in [("sort", sort), ("unread", unread)] {
            if let Some(value) = value {
                sqlx::query(
                    "INSERT INTO person_settings (person_id, name, value) VALUES (?, ?, ?)
                     ON CONFLICT (person_id, name) DO UPDATE SET value = excluded.value",
                )
                .bind(person)
                .bind(name)
                .bind(value)
                .execute(&mut *transaction)
                .await?;
            }
        }
        transaction.commit().await?;
        load(&state.db, person).await
    }
    .await;
    match saved {
        Ok(settings) => Json(settings).into_response(),
        Err(error) => database_problem("saving settings", &error),
    }
}
