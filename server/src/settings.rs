//! Each reader's settings shared across their devices (SPEC section 18): the
//! sort order, the reading mode, inbox or river (SPEC section 10), whether
//! unread counts show, and when unread lets go by itself (`unread`, decision
//! 0097), the keys the reader chose for shortcuts (`keys`, decision 0110),
//! and which lists the sidebar shows (`hidden`, decision 0105). Reader
//! controls such as the theme belong to each device and stay in its browser.

use axum::{
    Json, Router,
    extract::State,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::BTreeMap;

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

/// Whether the sidebar shows unread counts (in inbox mode): shown, the
/// default, or hidden, keeping the Unread view without the numbers.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum Counts {
    #[default]
    Shown,
    Hidden,
}

/// How long unread waits before it lets go by itself: never (the default),
/// a week, two weeks or a month (`unread::waits_for`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
enum LetGo {
    #[default]
    Never,
    Week,
    TwoWeeks,
    Month,
}

impl LetGo {
    const fn stored(self) -> &'static str {
        match self {
            Self::Never => "never",
            Self::Week => "week",
            Self::TwoWeeks => "two-weeks",
            Self::Month => "month",
        }
    }
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
}

impl Hideable {
    const EVERY: [Self; 4] = [Self::Starred, Self::All, Self::Recent, Self::Searches];

    const fn stored(self) -> &'static str {
        match self {
            Self::Starred => "starred",
            Self::All => "all",
            Self::Recent => "recent",
            Self::Searches => "searches",
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
    mode: Mode,
    counts: Counts,
    let_go: LetGo,
    /// The shortcuts given another key, by the shortcut's name ("star"), each
    /// with its key as the cheat sheet prints it ("x", "Shift+X"), or "" for
    /// none. Only changed shortcuts are here; the rest keep their own keys.
    keys: Keys,
    /// The lists the sidebar leaves out; none by default.
    hidden: Vec<Hideable>,
}

/// The reader's own keys (decision 0110). The browser decides what each name
/// and key means; here they're only checked for size, so a later version's
/// names come through untouched.
type Keys = BTreeMap<String, String>;

/// No more than this many changed keys: there are about forty shortcuts.
const MOST_KEYS: usize = 100;

/// Whether chosen keys are of a sensible size: short names of lowercase
/// letters and dashes, each key a few characters at most.
fn keys_fit(keys: &Keys) -> bool {
    keys.len() <= MOST_KEYS
        && keys.iter().all(|(name, key)| {
            (1..=40).contains(&name.len())
                && name
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte == b'-')
                && key.chars().count() <= 20
                && !key.chars().any(char::is_control)
        })
}

/// A change: only the settings named are saved, so a tab from before river
/// mode that changes the sort order leaves the mode as it was.
#[derive(Deserialize)]
struct Change {
    sort: Option<Order>,
    mode: Option<Mode>,
    counts: Option<Counts>,
    let_go: Option<LetGo>,
    /// All the reader's chosen keys at once; `{}` puts every key back.
    keys: Option<Keys>,
    hidden: Option<Vec<Hideable>>,
}

async fn load(db: &SqlitePool, person: i64) -> Result<Settings, sqlx::Error> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT name, value FROM person_settings
         WHERE person_id = ? AND name IN ('sort', 'mode', 'counts', 'let_go', 'keys', 'hidden')",
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
    let mode = match value("mode") {
        Some("river") => Mode::River,
        _ => Mode::Inbox,
    };
    let counts = match value("counts") {
        Some("hidden") => Counts::Hidden,
        _ => Counts::Shown,
    };
    let let_go = match value("let_go") {
        Some("week") => LetGo::Week,
        Some("two-weeks") => LetGo::TwoWeeks,
        Some("month") => LetGo::Month,
        _ => LetGo::Never,
    };
    let keys = value("keys")
        .and_then(|saved| serde_json::from_str::<Keys>(saved).ok())
        .filter(keys_fit)
        .unwrap_or_default();
    let hidden = hidden_from(value("hidden"));
    Ok(Settings {
        sort,
        mode,
        counts,
        let_go,
        keys,
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
    if change.keys.as_ref().is_some_and(|keys| !keys_fit(keys)) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            "Those keys can't be saved.",
        )
            .into_response();
    }
    let keys = change
        .keys
        .map(|keys| serde_json::to_string(&keys).unwrap_or_else(|_| "{}".to_owned()));
    let sort = change.sort.map(|sort| match sort {
        Order::Newest => "newest",
        Order::Oldest => "oldest",
    });
    let mode = change.mode.map(|mode| match mode {
        Mode::Inbox => "inbox",
        Mode::River => "river",
    });
    let counts = change.counts.map(|counts| match counts {
        Counts::Shown => "shown",
        Counts::Hidden => "hidden",
    });
    let let_go = change.let_go.map(LetGo::stored);
    let hidden = change.hidden.as_deref().map(hidden_stored);
    let saved = async {
        let mut transaction = state.db.begin().await?;
        for (name, value) in [
            ("sort", sort),
            ("mode", mode),
            ("counts", counts),
            ("let_go", let_go),
            ("keys", keys.as_deref()),
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
        // When the wait was chosen: nothing lets go until it has stood a
        // minute (`unread::let_go`), so passing a shorter one on the way
        // with the arrow keys marks nothing.
        if let_go.is_some() {
            sqlx::query(
                "INSERT INTO person_settings (person_id, name, value) VALUES (?, 'let_go_at', ?)
                 ON CONFLICT (person_id, name) DO UPDATE SET value = excluded.value",
            )
            .bind(person)
            .bind(crate::now().to_string())
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
