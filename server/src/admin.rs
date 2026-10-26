//! The owner's Readers page and the fair limits (SPEC sections 11, 15 and
//! 18, decision 0090).
//!
//! - **The Readers page** (`GET /api/admin`, the owner only): how this nine
//!   turtles is doing (readers, feeds, articles, the database's size,
//!   sign-ups waiting for their email, backups, email, problems logged) and
//!   one line for each reader: their email, when they joined, how many feeds
//!   they follow, how many of those keep failing, and the day they were last
//!   here (the owner said yes, 26 October 2026; decision 0093). Never which
//!   feeds, nothing about what anyone reads.
//! - **At most `MOST_FEEDS` feeds per reader**, the owner too. Adding one
//!   more, from the Add field, the welcome, another app or an OPML file, is
//!   refused; Undo for unsubscribing always works.
//! - **Feeds nobody opens are checked once a day.** A reader is *away* when
//!   nine turtles hasn't seen them for `AWAY_AFTER`: no device of theirs
//!   opened it and no other app synced. A feed whose every follower is away
//!   is checked at most once a day (`checking`); when one of them comes back,
//!   their feeds that are working are checked again straight away (`here`),
//!   a few at a time as always.

use axum::{
    Json, Router,
    extract::State,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::Serialize;
use serde_json::json;
use sqlx::SqlitePool;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    checking::{DAY, KEEPS_FAILING, SHORTEST_WAIT},
    db, log, now, payments, people,
};

/// The most feeds one reader can follow.
pub const MOST_FEEDS: i64 = 1_000;
/// Not seen for this long, and a reader is away.
pub const AWAY_AFTER: i64 = 30 * DAY;
/// How long a feed whose every follower is away waits between checks.
pub const AWAY_WAIT: i64 = DAY;
/// The problems logged since nine turtles started, newest first, at most this many.
const PROBLEMS_SHOWN: usize = 10;

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/admin", get(overview))
}

/// When reader `person` (a column, or `?1`) was last here, in SQL: the
/// latest of when they joined, when one of their devices was last used,
/// and when they were last seen (`here`). Each device notes its use at
/// most once every 24 hours, so this is at most a day behind. (A macro, so every query
/// stays one fixed string.)
macro_rules! last_here {
    ($person:literal) => {
        concat!(
            "MAX((SELECT created_at FROM people WHERE id = ",
            $person,
            "),
                 COALESCE((SELECT MAX(last_used_at) FROM sessions WHERE person_id = ",
            $person,
            "), 0),
                 COALESCE((SELECT CAST(value AS INTEGER) FROM person_settings
                           WHERE person_id = ",
            $person,
            " AND name = 'here_at'), 0))"
        )
    };
}
pub(crate) use last_here;

/// SQL that is true when every follower of the feed `feeds.id` is away at
/// `$since` (a parameter: the time `AWAY_AFTER` ago).
macro_rules! everyone_away {
    ($since:literal) => {
        concat!(
            "NOT EXISTS (SELECT 1 FROM subscriptions AS follower
                         WHERE follower.feed_id = feeds.id AND follower.unsubscribed_at IS NULL
                             AND ",
            $crate::admin::last_here!("follower.person_id"),
            " > ",
            $since,
            ")"
        )
    };
}
pub(crate) use everyone_away;

/// Whether reader `person` may follow one more feed.
pub async fn room_for_one_more(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
) -> Result<bool, sqlx::Error> {
    Ok(following(connection, person).await? < MOST_FEEDS)
}

/// How many feeds reader `person` follows.
pub async fn following(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM subscriptions WHERE person_id = ? AND unsubscribed_at IS NULL",
    )
    .bind(person)
    .fetch_one(connection)
    .await
}

/// Reader `person` is here (signed in, a device of theirs opened nine
/// turtles, or another app synced), noted at most once a day. If they were
/// away, the feeds they follow that are working are due at once, unless a
/// follower asked for fewer checks (Edit feed), the feed was checked in the
/// last 30 minutes, or a WebSub hub delivers its new articles (its checks are
/// only the twice-a-day backup, decision 0069): the background checks then take them a few at a
/// time, as always.
pub async fn here(db: &SqlitePool, person: i64, now: i64) -> Result<(), sqlx::Error> {
    let noted: Option<String> = sqlx::query_scalar(
        "SELECT value FROM person_settings WHERE person_id = ? AND name = 'here_at'",
    )
    .bind(person)
    .fetch_optional(db)
    .await?;
    if noted
        .and_then(|value| value.parse::<i64>().ok())
        .is_some_and(|at| now - at < DAY)
    {
        return Ok(());
    }
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let last: i64 = sqlx::query_scalar(concat!("SELECT ", last_here!("?1")))
        .bind(person)
        .fetch_one(&mut *transaction)
        .await?;
    if last <= now - AWAY_AFTER {
        sqlx::query(
            "UPDATE feeds SET next_check_at = MIN(next_check_at,
                 MAX(COALESCE(fetched_at, 0) + MAX(check_at_most, ?2), ?3))
             WHERE next_check_at > ?3 AND failures = 0 AND unsubscribed_at IS NULL
                 AND id NOT IN (SELECT feed_id FROM websub WHERE active_until > ?3)
                 AND id IN (SELECT feed_id FROM subscriptions
                            WHERE person_id = ?1 AND unsubscribed_at IS NULL)",
        )
        .bind(person)
        .bind(SHORTEST_WAIT)
        .bind(now)
        .execute(&mut *transaction)
        .await?;
    }
    sqlx::query(
        "INSERT INTO person_settings (person_id, name, value) VALUES (?, 'here_at', ?)
         ON CONFLICT (person_id, name) DO UPDATE SET value = excluded.value",
    )
    .bind(person)
    .bind(now.to_string())
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await
}

/// `here`, with a problem only logged: being noted must never stop a
/// reader from signing in or syncing.
pub async fn note_here(db: &SqlitePool, person: i64) {
    if let Err(error) = here(db, person, now()).await {
        log::problem(&format!(
            "couldn't note that reader {person} is here: {error}"
        ));
    }
}

/// One reader as the owner's Readers page shows them.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Reader {
    pub id: i64,
    pub email: Option<String>,
    pub owner: bool,
    pub created_at: i64,
    /// How many feeds they follow (never which).
    pub feeds: i64,
    /// How many of those have failed for three days or more.
    pub feeds_failing: i64,
    /// When nine turtles last saw them (`last_here!`); noted at most once
    /// every 24 hours, so it can be up to a day behind.
    pub last_here: i64,
    /// Where they stand for paying (`payments::Standing`); none while
    /// payments are off.
    #[sqlx(skip)]
    pub plan: Option<crate::payments::Standing>,
}

/// Everyone with an account, the owner first, then the newest.
pub async fn readers(db: &SqlitePool, now: i64) -> Result<Vec<Reader>, sqlx::Error> {
    // `reader`, not `people`: `last_here!` reads `people` again inside.
    sqlx::query_as(concat!(
        "SELECT reader.id, reader.email, reader.owner, reader.created_at,
             (SELECT COUNT(*) FROM subscriptions
              WHERE person_id = reader.id AND unsubscribed_at IS NULL) AS feeds,
             (SELECT COUNT(*) FROM subscriptions JOIN feeds ON feeds.id = subscriptions.feed_id
              WHERE subscriptions.person_id = reader.id AND subscriptions.unsubscribed_at IS NULL
                  AND feeds.failing_since <= ?) AS feeds_failing, ",
        last_here!("reader.id"),
        " AS last_here
         FROM people AS reader ORDER BY reader.owner DESC, reader.created_at DESC, reader.id DESC"
    ))
    .bind(now - KEEPS_FAILING)
    .fetch_all(db)
    .await
}

/// How this nine turtles is doing, in counts.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Totals {
    pub readers: i64,
    /// Feeds someone follows, each counted once however many follow it.
    pub feeds: i64,
    /// Of those, the ones whose every follower is away.
    pub feeds_resting: i64,
    pub feeds_failing: i64,
    pub articles: i64,
    /// Open sign-ups whose emailed link hasn't been opened yet.
    pub sign_ups_waiting: i64,
}

pub async fn totals(db: &SqlitePool, now: i64) -> Result<Totals, sqlx::Error> {
    sqlx::query_as(concat!(
        "SELECT (SELECT COUNT(*) FROM people) AS readers,
             (SELECT COUNT(*) FROM feeds WHERE unsubscribed_at IS NULL) AS feeds,
             (SELECT COUNT(*) FROM feeds WHERE unsubscribed_at IS NULL AND ",
        everyone_away!("?1"),
        ") AS feeds_resting,
             (SELECT COUNT(*) FROM feeds WHERE unsubscribed_at IS NULL AND failing_since <= ?2)
                 AS feeds_failing,
             (SELECT COUNT(*) FROM articles) AS articles,
             (SELECT COUNT(*) FROM email_links
              WHERE purpose = 'sign-up' AND used = 0 AND expires_at > ?3) AS sign_ups_waiting"
    ))
    .bind(now - AWAY_AFTER)
    .bind(now - KEEPS_FAILING)
    .bind(now)
    .fetch_one(db)
    .await
}

/// The owner's Readers page: totals, how backups and email are set, the
/// problems logged since nine turtles started, and every reader.
async fn overview(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    people::owner_only(&state, person, async {
        let now = now();
        let found = match totals(&state.db, now).await {
            Ok(totals) => readers(&state.db, now)
                .await
                .map(|readers| (totals, readers)),
            Err(error) => Err(error),
        };
        let (totals, mut readers) = match found {
            Ok(found) => found,
            Err(error) => return database_problem("gathering the Readers page", &error),
        };
        if state.config.payments.is_some() {
            for reader in &mut readers {
                match payments::standing(&state, reader.id, now).await {
                    Ok(standing) => reader.plan = Some(standing),
                    Err(error) => return database_problem("reading a reader's plan", &error),
                }
            }
        }
        let latest_backup = state
            .latest_backup
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone();
        let mut problems = log::recent_problems();
        problems.reverse();
        problems.truncate(PROBLEMS_SHOWN);
        Json(json!({
            "totals": totals,
            "database_bytes": db::size_in_bytes(&state.config.data_dir),
            "backups": { "on": state.storage.is_some(), "latest_nightly": latest_backup },
            "email_sending": state.mailer.is_some(),
            "problems": problems,
            "readers": readers,
            "most_feeds": MOST_FEEDS,
            "away_after_days": AWAY_AFTER / DAY,
        }))
        .into_response()
    })
    .await
}
