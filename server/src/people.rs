//! The readers of one nine turtles, and how new ones join (SPEC sections 1
//! and 18, decision 0087).
//!
//! The owner (reader 1) sees who has an account (their email and when they
//! joined, never anything they read), sets the email they sign in with, and
//! chooses whether anyone may sign up:
//!
//! - **Closed** (the default): nobody can.
//! - **Invite link**: anyone with the current invite link can. The link
//!   carries a long random ticket, of which only a scrambled copy (BLAKE2s)
//!   is kept in `settings`, as for signed-in devices. It works for several
//!   sign-ups until the owner makes a new one or closes sign-up.
//! - **Open**: anyone can, once they follow the link emailed to them
//!   (decision 0088). Only while nine turtles can send email; without the
//!   email settings the server refuses it whatever it's sent.
//!
//! However sign-up is set, at most `SIGN_UPS_PER_HOUR` sign-up tries are
//! taken in any hour, for the whole app, counting tries with an email that's
//! already taken as well as new accounts and Open sign-ups waiting for their
//! link; at most as many accounts are made, also when those links are
//! followed: behind the host's proxy nine turtles can't reliably tell one
//! place from another. Sign-ups go one at a time, and so do the links
//! followed (`accounts::confirm`), because scrambling each password takes
//! about 19 MB of memory and so the hour's count can't be raced past.
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
    auth::{
        Account, SignedIn, ask_password, database_problem, new_token, remember_device, scramble,
        session_cookie,
    },
    config::PasswordSetting,
    log, now,
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
        .route("/api/people/me/email", post(set_email))
        .route("/api/sign-up", post(sign_up))
        .route("/api/sign-up/settings", get(sign_up_settings))
        .route("/api/sign-up/switch", post(switch))
        .route("/api/sign-up/invite", post(make_invite))
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
/// emailed link to their address (an Open sign-up's has no reader number).
pub async fn delete(db: &SqlitePool, person: i64) -> Result<(), sqlx::Error> {
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let owner: Option<bool> = sqlx::query_scalar("SELECT owner FROM people WHERE id = ?")
        .bind(person)
        .fetch_optional(&mut *transaction)
        .await?;
    if owner != Some(false) {
        return Ok(());
    }
    // An Open sign-up's links have no reader number yet, but hold their
    // email (and, until confirmed, a password scramble): they go too, as
    // does any other link to their address.
    sqlx::query(
        "DELETE FROM email_links
         WHERE email = (SELECT email FROM people WHERE id = ?) COLLATE NOCASE",
    )
    .bind(person)
    .execute(&mut *transaction)
    .await?;
    // Nothing of theirs is kept now: no star, and no collection, holds an entry back.
    sqlx::query("DELETE FROM collection_articles WHERE person_id = ?")
        .bind(person)
        .execute(&mut *transaction)
        .await?;
    sqlx::query("UPDATE entries SET starred = 0 WHERE person_id = ?")
        .bind(person)
        .execute(&mut *transaction)
        .await?;
    let followed: Vec<i64> = sqlx::query_scalar(
        "UPDATE subscriptions SET unsubscribed_at = COALESCE(unsubscribed_at, unixepoch()), cleared = 0
         WHERE person_id = ? RETURNING feed_id",
    )
    .bind(person)
    .fetch_all(&mut *transaction)
    .await?;
    for feed in followed {
        crate::folders::clear(&mut transaction, person, feed).await?;
    }
    for (_, deleting) in PER_READER_TABLES {
        sqlx::query(*deleting)
            .bind(person)
            .execute(&mut *transaction)
            .await?;
    }
    // Their newsletter feeds, whose articles have just gone (decision 0091).
    sqlx::query(
        "DELETE FROM feeds WHERE newsletter_of = ?1
         AND NOT EXISTS (SELECT 1 FROM articles WHERE feed_id = feeds.id)",
    )
    .bind(person)
    .execute(&mut *transaction)
    .await?;
    sqlx::query("DELETE FROM people WHERE id = ? AND owner = 0")
        .bind(person)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await
}

/// Whether anyone may sign up without an invite: sign-up is Open and nine
/// turtles can send the email that confirms an address.
pub async fn open_for_anyone(state: &AppState) -> Result<bool, sqlx::Error> {
    Ok(state.mailer.is_some() && load(&state.db).await?.mode == "open")
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
struct Email {
    email: String,
    #[serde(default)]
    password: String,
}

/// The owner's own email, to sign in with and to get "Forgot your
/// password?" links at. Their current password is asked for (decision
/// 0088), checked as their password-only sign-in checks it (the same count
/// of wrong tries and the same line), so a device left signed in as the
/// owner can't send the owner's password links somewhere else.
async fn set_email(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Email>,
) -> Response {
    owner_only(&state, person, async {
        let email = form.email.trim();
        if !plausible_email(email) {
            return refused(StatusCode::BAD_REQUEST, "email");
        }
        let own: Result<Option<Option<String>>, sqlx::Error> =
            sqlx::query_scalar("SELECT password_hash FROM people WHERE id = ?")
                .bind(person)
                .fetch_optional(&state.db)
                .await;
        let stored = match own {
            Ok(own) => own.flatten().or(match &state.config.password {
                PasswordSetting::Set(line) => Some(line.clone()),
                _ => None,
            }),
            Err(error) => return database_problem("finding the owner", &error),
        };
        let password = form.password.clone();
        if let Some(refusal) = ask_password(&state, &Account::Owner, password, stored).await {
            return refusal;
        }
        let saved = sqlx::query("UPDATE people SET email = ? WHERE id = ?")
            .bind(email)
            .bind(person)
            .execute(&state.db)
            .await;
        match saved {
            Ok(_) => Json(json!({ "email": email })).into_response(),
            Err(error) if is_taken(&error) => refused(StatusCode::CONFLICT, "already"),
            Err(error) => database_problem("saving the owner's email", &error),
        }
    })
    .await
}

/// What sign-up is set to, as the owner sees it in Settings.
async fn sign_up_settings(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    owner_only(&state, person, async {
        match load(&state.db).await {
            Ok(settings) => Json(json!({
                "sign_up": settings.mode,
                "invite_made_at": settings.invite_made_at,
                // Open needs confirmation emails (decision 0088).
                "open_available": state.mailer.is_some(),
            }))
            .into_response(),
            Err(error) => database_problem("reading the sign-up setting", &error),
        }
    })
    .await
}

#[derive(Deserialize)]
struct Switch {
    sign_up: String,
}

/// Closed, Invite link or Open. Closing forgets the invite link, so it
/// never works again; Invite link and Open keep any link already made (it
/// works again if Invite link is chosen later). Open is refused while nine
/// turtles can't send email.
async fn switch(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Switch>,
) -> Response {
    owner_only(&state, person, async {
        let saved = match form.sign_up.as_str() {
            "closed" => close(&state.db).await,
            "invite" => save(&state.db, &[("sign_up", "invite")]).await,
            "open" if state.mailer.is_none() => {
                return refused(StatusCode::BAD_REQUEST, "open-needs-email");
            }
            "open" => save(&state.db, &[("sign_up", "open")]).await,
            _ => return refused(StatusCode::BAD_REQUEST, "sign-up"),
        };
        match saved {
            Ok(()) => StatusCode::NO_CONTENT.into_response(),
            Err(error) => database_problem("saving the sign-up setting", &error),
        }
    })
    .await
}

/// Makes a new invite link's ticket, replacing any earlier one (which stops
/// working), sets sign-up to Invite link, and shows the ticket this once.
async fn make_invite(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    owner_only(&state, person, async {
        let ticket = match new_token() {
            Ok(ticket) => ticket,
            Err(error) => {
                log::problem(&format!("couldn't make an invite link: {error}"));
                return StatusCode::INTERNAL_SERVER_ERROR.into_response();
            }
        };
        let made_at = now().to_string();
        let saved = save(
            &state.db,
            &[
                ("sign_up", "invite"),
                ("sign_up_invite", &hex(&scramble(&ticket))),
                ("sign_up_invite_made_at", &made_at),
            ],
        )
        .await;
        match saved {
            Ok(()) => (
                // Never kept by the browser or anything between.
                [(header::CACHE_CONTROL, "no-store")],
                Json(json!({ "invite": ticket })),
            )
                .into_response(),
            Err(error) => database_problem("saving the invite link", &error),
        }
    })
    .await
}

#[derive(Deserialize)]
struct SignUp {
    email: String,
    password: String,
    #[serde(default)]
    invite: String,
}

/// Makes an account with an email and a password. With the current invite
/// link, while sign-up is set to it, the account is made at once and this
/// device signed in (the owner knows whom they invited). While sign-up is
/// Open, a link is emailed instead, and the account is made only when it's
/// followed (`accounts::confirm`).
async fn sign_up(State(state): State<AppState>, Json(form): Json<SignUp>) -> Response {
    let settings = match load(&state.db).await {
        Ok(settings) => settings,
        Err(error) => return database_problem("reading the sign-up setting", &error),
    };
    // Closed, Open (not yet), no link made, or a wrong or replaced one: all
    // the same answer.
    let invited = settings.mode == "invite"
        && settings
            .invite
            .is_some_and(|stored| stored == hex(&scramble(form.invite.trim())));
    let open = settings.mode == "open" && state.mailer.is_some();
    if !invited && !open {
        return refused(StatusCode::FORBIDDEN, "closed");
    }

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

    if open {
        return sign_up_by_email(&state, &email, form.password, hour_ago).await;
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

/// Open sign-up: the email gets a link that makes the account. The answer
/// is the same whether or not the address already has an account, or has
/// had its hour's share of emails, so nobody learns which addresses are
/// here. At most `SIGN_UPS_PER_HOUR` such links go out in an hour, for the
/// whole app, as with accounts.
async fn sign_up_by_email(
    state: &AppState,
    email: &str,
    password: String,
    hour_ago: i64,
) -> Response {
    let links: Result<i64, sqlx::Error> = sqlx::query_scalar(
        "SELECT COUNT(*) FROM email_links WHERE purpose = 'sign-up' AND created_at > ?",
    )
    .bind(hour_ago)
    .fetch_one(&state.db)
    .await;
    match links {
        Ok(count) if count >= SIGN_UPS_PER_HOUR => return too_many(),
        Ok(_) => {}
        Err(error) => return database_problem("counting sign-ups", &error),
    }
    let checked = (StatusCode::ACCEPTED, Json(json!({ "confirm": email }))).into_response();
    // The password is scrambled whether or not the address is taken (still
    // one sign-up at a time), so the time taken doesn't tell either.
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
    let taken: Result<bool, sqlx::Error> =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM people WHERE email = ? COLLATE NOCASE)")
            .bind(email)
            .fetch_one(&state.db)
            .await;
    match taken {
        // The scramble is dropped: nothing waits for an address that has an account.
        Ok(true) => checked,
        Ok(false) => match crate::accounts::send_sign_up_link(state, email, &line).await {
            Ok(_) => checked,
            Err(error) => database_problem("making a sign-up link", &error),
        },
        Err(error) => database_problem("making an account", &error),
    }
}

/// Sign-up as stored: the mode ("closed" unless set), and the invite link's
/// scrambled ticket and when it was made, if there is one.
struct SignUpSettings {
    mode: String,
    invite: Option<String>,
    invite_made_at: Option<i64>,
}

async fn load(db: &SqlitePool) -> Result<SignUpSettings, sqlx::Error> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT name, value FROM settings
         WHERE name IN ('sign_up', 'sign_up_invite', 'sign_up_invite_made_at')",
    )
    .fetch_all(db)
    .await?;
    let value = |name: &str| {
        rows.iter()
            .find(|(each, _)| each == name)
            .map(|(_, value)| value.clone())
    };
    Ok(SignUpSettings {
        mode: value("sign_up")
            .filter(|mode| mode == "invite" || mode == "open")
            .unwrap_or_else(|| "closed".to_owned()),
        invite: value("sign_up_invite"),
        invite_made_at: value("sign_up_invite_made_at").and_then(|made| made.parse().ok()),
    })
}

async fn save(db: &SqlitePool, values: &[(&str, &str)]) -> Result<(), sqlx::Error> {
    let mut transaction = db.begin().await?;
    for (name, value) in values {
        sqlx::query(
            "INSERT INTO settings (name, value) VALUES (?, ?)
             ON CONFLICT (name) DO UPDATE SET value = excluded.value",
        )
        .bind(name)
        .bind(value)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await
}

/// Closed, and the invite link forgotten.
async fn close(db: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM settings WHERE name IN ('sign_up', 'sign_up_invite', 'sign_up_invite_made_at')",
    )
    .execute(db)
    .await
    .map(|_| ())
}

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

pub(crate) fn refused(status: StatusCode, error: &str) -> Response {
    (status, Json(json!({ "error": error }))).into_response()
}

pub(crate) fn too_many() -> Response {
    refused(StatusCode::TOO_MANY_REQUESTS, "too-many")
}

pub(crate) fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write as _;
    bytes.iter().fold(String::new(), |mut text, byte| {
        let _ = write!(text, "{byte:02x}");
        text
    })
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
