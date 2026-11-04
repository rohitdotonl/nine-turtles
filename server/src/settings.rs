//! Each reader's settings shared across their devices (SPEC section 18): the
//! sort order, whether Unread is on (SPEC section 10), and
//! which lists the sidebar shows (`hidden`, decision 0105). Reader controls such as the theme
//! belong to each device and stay in its browser.
//!
//! Readers could once give shortcuts keys of their own (decision 0110, removed
//! in step 5 of the owner's review). A reader who had is told once, at the
//! foot of the `?` list, that the keys are back to nine turtles' own
//! (`keys_reset`); seeing it removes the old keys (`keys_seen`).

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

/// A list the reader can hide from the sidebar (Settings › Show in the sidebar). Unread,
/// folders and feeds always show. A hidden list still opens by its address
/// and its keys.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum Hideable {
    Starred,
    All,
    Recent,
    Searches,
    Collections,
}

impl Hideable {
    const EVERY: [Self; 5] = [
        Self::Starred,
        Self::All,
        Self::Recent,
        Self::Searches,
        Self::Collections,
    ];

    const fn stored(self) -> &'static str {
        match self {
            Self::Starred => "starred",
            Self::All => "all",
            Self::Recent => "recent",
            Self::Searches => "searches",
            Self::Collections => "collections",
        }
    }
}

/// The hidden lists as stored: their words, separated by commas, in one
/// order. Anything not understood is left out.
fn hidden_from(stored: Option<&str>) -> Vec<Hideable> {
    let words: Vec<&str> = stored.unwrap_or("").split(',').collect();
    Hideable::EVERY
        .into_iter()
        .filter(|list| words.contains(&list.stored()))
        .collect()
}

fn hidden_stored(hidden: &[Hideable]) -> String {
    Hideable::EVERY
        .into_iter()
        .filter(|list| hidden.contains(list))
        .map(Hideable::stored)
        .collect::<Vec<_>>()
        .join(",")
}

#[derive(Serialize)]
struct Settings {
    /// Newest or oldest first.
    sort: Order,
    /// Unread on (the Unread list, read styling and dots, the default) or
    /// off (none of those). Read state is recorded either way. Nothing
    /// stored means on.
    unread: bool,
    /// The reader had given shortcuts keys of their own, which are back to
    /// nine turtles' own now, and hasn't been told yet.
    keys_reset: bool,
    /// The lists the sidebar leaves out; none by default.
    hidden: Vec<Hideable>,
}

/// A change: only the settings named are saved, so a tab that changes the
/// sort order leaves Unread as it was.
#[derive(Deserialize)]
struct Change {
    sort: Option<Order>,
    unread: Option<bool>,
    /// The reader has been told their own keys are gone: the old ones are removed.
    #[serde(default)]
    keys_seen: bool,
    hidden: Option<Vec<Hideable>>,
}

async fn load(db: &SqlitePool, person: i64) -> Result<Settings, sqlx::Error> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT name, value FROM person_settings
         WHERE person_id = ? AND name IN ('sort', 'unread', 'keys', 'hidden')",
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
    // `{}` was what Reset all keys left: nothing changed, nothing to tell.
    let keys_reset = value("keys").is_some_and(|saved| saved.trim() != "{}");
    let hidden = hidden_from(value("hidden"));
    Ok(Settings {
        sort,
        unread,
        keys_reset,
        hidden,
    })
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
    let hidden = change.hidden.as_deref().map(hidden_stored);
    let saved = async {
        let mut transaction = state.db.begin().await?;
        for (name, value) in [
            ("sort", sort),
            ("unread", unread),
            ("hidden", hidden.as_deref()),
        ] {
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
        if change.keys_seen {
            sqlx::query("DELETE FROM person_settings WHERE person_id = ? AND name = 'keys'")
                .bind(person)
                .execute(&mut *transaction)
                .await?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hidden_lists_are_kept_in_one_order_and_unknown_words_are_left_out() {
        assert_eq!(
            hidden_stored(&[Hideable::Searches, Hideable::Starred]),
            "starred,searches"
        );
        assert_eq!(hidden_stored(&[]), "");
        assert_eq!(
            hidden_from(Some("recent,later,starred")),
            [Hideable::Starred, Hideable::Recent]
        );
        assert!(hidden_from(None).is_empty());
        assert!(hidden_from(Some("")).is_empty());
    }
}
