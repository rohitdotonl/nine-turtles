//! The reader's settings shared across their devices (SPEC section 18): the
//! sort order and the reading mode, inbox or river (SPEC section 10). Reader
//! controls such as the theme belong to each device and stay in its browser.

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

/// Inbox (things to get through, the default) or river (things flowing past,
/// with no unread view, styling or counts). Read state is recorded in both.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum Mode {
    #[default]
    Inbox,
    River,
}

#[derive(Serialize)]
struct Settings {
    /// Newest or oldest first.
    sort: Order,
    mode: Mode,
}

/// A change: only the settings named are saved, so a tab from before river
/// mode that changes the sort order leaves the mode as it was.
#[derive(Deserialize)]
struct Change {
    sort: Option<Order>,
    mode: Option<Mode>,
}

async fn load(db: &SqlitePool) -> Result<Settings, sqlx::Error> {
    let rows: Vec<(String, String)> =
        sqlx::query_as("SELECT name, value FROM settings WHERE name IN ('sort', 'mode')")
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
    let mode = match value("mode") {
        Some("river") => Mode::River,
        _ => Mode::Inbox,
    };
    Ok(Settings { sort, mode })
}

async fn read(_: SignedIn, State(state): State<AppState>) -> Response {
    match load(&state.db).await {
        Ok(settings) => Json(settings).into_response(),
        Err(error) => database_problem("reading settings", &error),
    }
}

async fn change(
    _: SignedIn,
    State(state): State<AppState>,
    Json(change): Json<Change>,
) -> Response {
    let sort = change.sort.map(|sort| match sort {
        Order::Newest => "newest",
        Order::Oldest => "oldest",
    });
    let mode = change.mode.map(|mode| match mode {
        Mode::Inbox => "inbox",
        Mode::River => "river",
    });
    let saved = async {
        let mut transaction = state.db.begin().await?;
        for (name, value) in [("sort", sort), ("mode", mode)] {
            if let Some(value) = value {
                sqlx::query(
                    "INSERT INTO settings (name, value) VALUES (?, ?)
                     ON CONFLICT (name) DO UPDATE SET value = excluded.value",
                )
                .bind(name)
                .bind(value)
                .execute(&mut *transaction)
                .await?;
            }
        }
        transaction.commit().await?;
        load(&state.db).await
    }
    .await;
    match saved {
        Ok(settings) => Json(settings).into_response(),
        Err(error) => database_problem("saving settings", &error),
    }
}
