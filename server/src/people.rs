//! The readers of one nine turtles, and how new ones join (SPEC sections 1
//! and 18, decisions 0087 and 0115).
//!
//! The owner (reader 1) sees who has an account (their email and when they
//! joined, never anything they read) and sets the email they sign in with.
//! Sign-up is always open: anyone can make an account with an email and a
//! password, at once, with no email sent and no invite (decision 0115).
//!
//! At most `SIGN_UPS_PER_HOUR` sign-up tries are taken in any hour, for the
//! whole app, counting tries with an email that's already taken as well as
//! new accounts, and at most as many accounts are made: behind the host's
//! proxy nine turtles can't reliably tell one place from another. Sign-ups
//! go one at a time, because scrambling each password takes about 19 MB of
//! memory and so the hour's count can't be raced past.
//!
//! A reader's account is deleted by `delete`, which names every table that
//! holds a reader's things.

use std::{
    collections::VecDeque,
    time::{Duration, Instant},
};

use axum::{
    Json, Router,
    extract::State,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;

use crate::{
    AppState,
    auth::{SignedIn, database_problem, remember_device, session_cookie},
    log, now, refused,
};

/// A new reader's password: at least this many characters, the same as the
/// owner's (`nine-turtles set-password`).
pub const READER_PASSWORD_MINIMUM: usize = crate::password::MINIMUM_LENGTH;
/// The longest an email address can be (the internet's own rule).
pub const EMAIL_MAXIMUM: usize = 254;
/// New accounts allowed in any hour, for the whole app.
pub const SIGN_UPS_PER_HOUR: i64 = 20;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/people", get(list))
        .route("/api/sign-up", post(sign_up))
}

/// One reader as the owner sees them: number, email, owner or not, joined.
type Person = (i64, Option<String>, bool, i64);

/// Whether reader `person` is the owner.
pub(crate) async fn is_owner(db: &SqlitePool, person: i64) -> Result<bool, sqlx::Error> {
    let owner: Option<bool> = sqlx::query_scalar("SELECT owner FROM people WHERE id = ?")
        .bind(person)
        .fetch_optional(db)
        .await?;
    Ok(owner == Some(true))
}

/// Runs `then` only for the owner; anyone else gets 403.
pub(crate) async fn owner_only<F>(state: &AppState, person: i64, then: F) -> Response
where
    F: Future<Output = Response>,
{
    match is_owner(&state.db, person).await {
        Ok(true) => then.await,
        Ok(false) => (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "owner-only" })),
        )
            .into_response(),
        Err(error) => database_problem("checking who's the owner", &error),
    }
}

/// Every table with a `person_id` column (everything that is one reader's),
/// and how its lines for one reader are deleted.
///
/// **Every per-reader table must be listed here**, so deleting an account
/// leaves nothing of theirs behind. A test
/// (`server/tests/accounts.rs`) fails when a table with a `person_id`
/// column is missing. Most of these would go anyway (`ON DELETE CASCADE`),
/// but the list says so on purpose rather than trusting each table to.
/// Tables that hang off these (a folder's `feed_folders` pairs) go with them.
/// Entries come before subscriptions, which they point at.
pub const PER_READER_TABLES: &[(&str, &str)] = &[
    // A collection's lines point at entries, so they go first (`delete`
    // empties them before anything else, too).
    (
        "collection_articles",
        "DELETE FROM collection_articles WHERE person_id = ?",
    ),
    ("collections", "DELETE FROM collections WHERE person_id = ?"),
    // Where they stopped in episodes, and their Up Next (decision 0113):
    // they'd go with the entries anyway, but are named, like every table
    // with a reader's lines.
    (
        "episode_progress",
        "DELETE FROM episode_progress WHERE person_id = ?",
    ),
    ("up_next", "DELETE FROM up_next WHERE person_id = ?"),
    ("entries", "DELETE FROM entries WHERE person_id = ?"),
    (
        "subscriptions",
        "DELETE FROM subscriptions WHERE person_id = ?",
    ),
    ("rules", "DELETE FROM rules WHERE person_id = ?"),
    (
        "newsletter_addresses",
        "DELETE FROM newsletter_addresses WHERE person_id = ?",
    ),
    (
        "saved_searches",
        "DELETE FROM saved_searches WHERE person_id = ?",
    ),
    ("folders", "DELETE FROM folders WHERE person_id = ?"),
    (
        "app_passwords",
        "DELETE FROM app_passwords WHERE person_id = ?",
    ),
    (
        "person_settings",
        "DELETE FROM person_settings WHERE person_id = ?",
    ),
    ("email_links", "DELETE FROM email_links WHERE person_id = ?"),
    ("sessions", "DELETE FROM sessions WHERE person_id = ?"),
    // Their connected assistants, whose tickets go with them.
    (
        "assistant_connections",
        "DELETE FROM assistant_connections WHERE person_id = ?",
    ),
    (
        "assistant_codes",
        "DELETE FROM assistant_codes WHERE person_id = ?",
    ),
    ("passkeys", "DELETE FROM passkeys WHERE person_id = ?"),
    // The record of their plan; Dodo's own subscription is cancelled first
    // (`payments::cancel_before_deleting`).
    ("plans", "DELETE FROM plans WHERE person_id = ?"),
];

/// Deletes reader `person` and everything that is theirs, in one step:
/// all or nothing. Never the owner (`people.owner = 1`): for them, nothing
/// happens. First each feed they follow is let go as unsubscribing lets it
/// go (`folders::clear`), their stars included, so a feed nobody else
/// follows stops being checked and its articles nobody has go too; then
/// every table in `PER_READER_TABLES` is emptied of their lines, and every
/// emailed link to their address.
pub async fn delete(db: &SqlitePool, person: i64) -> Result<(), sqlx::Error> {
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let owner: Option<bool> = sqlx::query_scalar("SELECT owner FROM people WHERE id = ?")
        .bind(person)
        .fetch_optional(&mut *transaction)
        .await?;
    if owner != Some(false) {
        return Ok(());
    }
    // Every link to their address goes, other readers' spent tries to
    // change to it too.
    sqlx::query(
        "DELETE FROM email_links
         WHERE email = (SELECT email FROM people WHERE id = ?) COLLATE NOCASE",
    )
    .bind(person)
    .execute(&mut *transaction)
    .await?;
    let_go(&mut transaction, person, false).await?;
    sqlx::query("DELETE FROM people WHERE id = ? AND owner = 0")
        .bind(person)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await
}

/// The tables "Delete my data" empties of a reader's lines (decision 0117):
/// what they follow, read and keep. Their account stays (`ACCOUNT_TABLES`).
///
/// **Every table in `PER_READER_TABLES` is in exactly one of `DATA_TABLES`
/// and `ACCOUNT_TABLES`**, so a new table is a choice, not an accident; a
/// test (`server/tests/accounts.rs`) fails otherwise.
pub const DATA_TABLES: &[&str] = &[
    "collection_articles",
    "collections",
    "episode_progress",
    "up_next",
    "entries",
    "subscriptions",
    "rules",
    "saved_searches",
    "folders",
];

/// The tables "Delete my data" leaves alone: the account itself, with its
/// sign-in, settings, plan and newsletter address (decision 0117).
pub const ACCOUNT_TABLES: &[&str] = &[
    "newsletter_addresses",
    "app_passwords",
    "person_settings",
    "email_links",
    "sessions",
    "assistant_connections",
    "assistant_codes",
    "passkeys",
    "plans",
];

/// Empties reader `person`'s account, in one step: all or nothing. Every
/// feed they follow is let go as unsubscribing lets it go, stars and
/// collections included, then the `DATA_TABLES` are emptied of their lines.
/// They stay signed in, with everything else of their account. Works for
/// the owner too (decision 0117).
pub async fn delete_data(db: &SqlitePool, person: i64) -> Result<(), sqlx::Error> {
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let_go(&mut transaction, person, true).await?;
    transaction.commit().await
}

/// What deleting an account and deleting one's data share: lets go of
/// every feed reader `person` follows, then empties the tables of theirs in
/// `PER_READER_TABLES`, only the `DATA_TABLES` when `keep_account`.
async fn let_go(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    keep_account: bool,
) -> Result<(), sqlx::Error> {
    // Their newsletters they still follow. One they stopped keeps its feed's
    // line while their account stays, so the sender stays away and its
    // one-click unsubscribe can still go out (decision 0091).
    let newsletters: Vec<i64> = sqlx::query_scalar(
        "SELECT feeds.id FROM feeds
             JOIN subscriptions ON subscriptions.feed_id = feeds.id AND subscriptions.person_id = ?1
         WHERE feeds.newsletter_of = ?1 AND (?2 = 0 OR subscriptions.unsubscribed_at IS NULL)",
    )
    .bind(person)
    .bind(keep_account)
    .fetch_all(&mut *connection)
    .await?;
    // Nothing of theirs is kept now: no star, and no collection, holds an entry back.
    sqlx::query("DELETE FROM collection_articles WHERE person_id = ?")
        .bind(person)
        .execute(&mut *connection)
        .await?;
    sqlx::query("UPDATE entries SET starred = 0 WHERE person_id = ?")
        .bind(person)
        .execute(&mut *connection)
        .await?;
    let followed: Vec<i64> = sqlx::query_scalar(
        "UPDATE subscriptions SET unsubscribed_at = COALESCE(unsubscribed_at, unixepoch()), cleared = 0
         WHERE person_id = ? RETURNING feed_id",
    )
    .bind(person)
    .fetch_all(&mut *connection)
    .await?;
    for feed in followed {
        crate::folders::clear(&mut *connection, person, feed).await?;
    }
    for (table, deleting) in PER_READER_TABLES {
        if keep_account && !DATA_TABLES.contains(table) {
            continue;
        }
        sqlx::query(*deleting)
            .bind(person)
            .execute(&mut *connection)
            .await?;
    }
    // Their newsletter feeds, whose articles have just gone (decision 0091):
    // every one when the account goes too.
    if !keep_account {
        sqlx::query(
            "DELETE FROM feeds WHERE newsletter_of = ?1
             AND NOT EXISTS (SELECT 1 FROM articles WHERE feed_id = feeds.id)",
        )
        .bind(person)
        .execute(&mut *connection)
        .await?;
        return Ok(());
    }
    for feed in newsletters {
        sqlx::query(
            "DELETE FROM feeds WHERE id = ?
             AND NOT EXISTS (SELECT 1 FROM articles WHERE feed_id = feeds.id)",
        )
        .bind(feed)
        .execute(&mut *connection)
        .await?;
    }
    Ok(())
}

/// Everyone with an account: number, email, whether they're the owner, and
/// when they joined. Nothing about what anyone reads.
async fn list(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    owner_only(&state, person, async {
        let people: Result<Vec<Person>, sqlx::Error> =
            sqlx::query_as("SELECT id, email, owner, created_at FROM people ORDER BY id")
                .fetch_all(&state.db)
                .await;
        match people {
            Ok(people) => Json(json!({
                "people": people
                    .into_iter()
                    .map(|(id, email, owner, created_at)| json!({
                        "id": id, "email": email, "owner": owner, "created_at": created_at,
                    }))
                    .collect::<Vec<_>>(),
            }))
            .into_response(),
            Err(error) => database_problem("listing readers", &error),
        }
    })
    .await
}

#[derive(Deserialize)]
struct SignUp {
    email: String,
    password: String,
}

/// Makes an account with an email and a password, at once, and signs this
/// device in. No email is sent and no invite is needed (decision 0115).
async fn sign_up(State(state): State<AppState>, Json(form): Json<SignUp>) -> Response {
    let email = form.email.trim().to_owned();
    if !plausible_email(&email) {
        return refused(StatusCode::BAD_REQUEST, "email");
    }
    if form.password.chars().count() < READER_PASSWORD_MINIMUM {
        return refused(StatusCode::BAD_REQUEST, "password-short");
    }
    if form.password.len() > crate::password::MAXIMUM_LENGTH {
        return refused(StatusCode::BAD_REQUEST, "password-long");
    }
    // One sign-up at a time: each scramble takes about 19 MB of memory, so
    // many at once could use up the server's. Held until this one is
    // decided, so the hour's count below can't be raced past either.
    let mut tries = state.sign_ups.lock().await;
    let hour_ago = now() - 60 * 60;
    match recent_sign_ups(&state.db, hour_ago).await {
        Ok(count) if count >= SIGN_UPS_PER_HOUR => return too_many(),
        Ok(_) => {}
        Err(error) => return database_problem("counting sign-ups", &error),
    }
    // Every try that gets this far counts, even one whose email turns out
    // to be taken, so nobody can make the server scramble endlessly.
    if !tries.try_one(Instant::now()) {
        return too_many();
    }

    let password = form.password;
    let line = match tokio::task::spawn_blocking(move || crate::password::hash(&password)).await {
        Ok(Ok(line)) => line,
        Ok(Err(error)) => {
            log::problem(&error);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
        Err(error) => {
            log::problem(&format!(
                "couldn't scramble a new reader's password: {error}"
            ));
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    // The hour's count is checked again as the account is made, so two
    // sign-ups at once can't both slip past it.
    let made: Result<Option<i64>, sqlx::Error> = sqlx::query_scalar(
        "INSERT INTO people (owner, email, password_hash, created_at)
         SELECT 0, ?, ?, ?
         WHERE (SELECT COUNT(*) FROM people WHERE owner = 0 AND created_at > ?) < ?
         RETURNING id",
    )
    .bind(&email)
    .bind(&line)
    .bind(now())
    .bind(hour_ago)
    .bind(SIGN_UPS_PER_HOUR)
    .fetch_optional(&state.db)
    .await;
    let person = match made {
        Ok(Some(person)) => person,
        Ok(None) => return too_many(),
        Err(error) if is_taken(&error) => return refused(StatusCode::CONFLICT, "already"),
        Err(error) => return database_problem("making an account", &error),
    };
    drop(tries);

    match remember_device(&state.db, person).await {
        Ok(Some(token)) => (
            StatusCode::NO_CONTENT,
            [(header::SET_COOKIE, session_cookie(&token))],
        )
            .into_response(),
        Ok(None) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        Err(error) => database_problem("signing in a new reader", &error),
    }
}

/// The sign-up tries of the last hour that got as far as scrambling a
/// password, made or not, kept in memory. With the accounts made in the
/// last hour (in the database, so a restart doesn't forget them), it keeps
/// sign-up to `SIGN_UPS_PER_HOUR` in any hour.
#[derive(Debug, Default)]
pub struct SignUpTries {
    recent: VecDeque<Instant>,
}

impl SignUpTries {
    /// Counts a try at `now`, or answers false (and counts nothing) if the
    /// hour's tries are used up.
    pub fn try_one(&mut self, now: Instant) -> bool {
        while self
            .recent
            .front()
            .is_some_and(|tried| now.saturating_duration_since(*tried) >= HOUR)
        {
            self.recent.pop_front();
        }
        if self.recent.len() >= SIGN_UPS_PER_HOUR as usize {
            return false;
        }
        self.recent.push_back(now);
        true
    }
}

const HOUR: Duration = Duration::from_secs(60 * 60);

pub(crate) async fn recent_sign_ups(db: &SqlitePool, since: i64) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT COUNT(*) FROM people WHERE owner = 0 AND created_at > ?")
        .bind(since)
        .fetch_one(db)
        .await
}

/// A bare address: one @ with something on each side, at most 254
/// characters, and nothing that could make it more than an address (no
/// name before it, no `<` `>`, quotes, commas, semicolons, colons,
/// brackets, backslashes, spaces or control characters), so
/// `mira <someone@example.com>` can't stand in
/// for `someone@example.com` and dodge the hour's count for it. It must also
/// be an address email can go to (`email::address`). Whether it really
/// reaches someone is for the confirmation email.
pub fn plausible_email(email: &str) -> bool {
    let mut parts = email.split('@');
    let (Some(name), Some(place), None) = (parts.next(), parts.next(), parts.next()) else {
        return false;
    };
    email.len() <= EMAIL_MAXIMUM
        && !name.is_empty()
        && !place.is_empty()
        && !email.chars().any(|character| {
            character.is_whitespace()
                || character.is_control()
                || matches!(
                    character,
                    '<' | '>' | '"' | ',' | ';' | ':' | '(' | ')' | '[' | ']' | '\\'
                )
        })
        && crate::email::address(email).is_some()
}

pub(crate) fn is_taken(error: &sqlx::Error) -> bool {
    error
        .as_database_error()
        .is_some_and(|error| error.is_unique_violation())
}

pub(crate) fn too_many() -> Response {
    refused(StatusCode::TOO_MANY_REQUESTS, "too-many")
}

#[cfg(test)]
mod tests {
    use super::plausible_email;

    #[test]
    fn plausible_emails_are_bare_addresses_with_one_at_and_no_spaces() {
        for good in ["rohit@example.com", "a@b", "first.last+feeds@example.co.in"] {
            assert!(plausible_email(good), "{good}");
        }
        for bad in [
            "",
            "rohit",
            "@example.com",
            "rohit@",
            "ro hit@example.com",
            "a@b@c",
            "tab\t@example.com",
            // A name before the address, or anything that could make one.
            "evil<victim@example.com>",
            "<victim@example.com>",
            "victim@example.com>",
            "\"evil\"@example.com",
            "a,victim@example.com",
            "a;victim@example.com",
            "evil(victim)@example.com",
            "victim@[127.0.0.1]",
            "line\nbreak@example.com",
        ] {
            assert!(!plausible_email(bad), "{bad}");
        }
        assert!(!plausible_email(&format!(
            "{}@example.com",
            "a".repeat(250)
        )));
    }
}
