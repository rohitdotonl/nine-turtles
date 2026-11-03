//! How new readers join (SPEC section 1, decision 0154, which replaced
//! decision 0115's "no email at sign-up").
//!
//! Anyone can sign up with an email and a password, with no invite. While
//! nine turtles can send email, nothing is made yet: the scrambled password
//! waits in a `sign-up` link (`email_links`), and a link goes to the
//! address. Only following it makes the account, marks its address
//! confirmed and signs that device in (`finish`, called by
//! `accounts::confirm`), so nobody can make an account with an address that
//! isn't theirs. Without the email settings (a nine turtles on someone's
//! own computer) the account is made at once, as before, with its address
//! not confirmed.
//!
//! At most `SIGN_UPS_PER_HOUR` sign-up tries are taken in any hour, for the
//! whole app, counting tries with an email that's already taken as well as
//! new accounts, and at most as many accounts are made: behind the host's
//! proxy nine turtles can't reliably tell one place from another. Sign-ups
//! go one at a time, because scrambling each password takes about 19 MB of
//! memory and so the hour's count can't be raced past. The emails
//! themselves keep to the limits every emailed link keeps (`accounts`).

use std::{
    collections::VecDeque,
    time::{Duration, Instant},
};

use axum::{
    Json, Router,
    extract::State,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
    routing::post,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::{SqliteConnection, SqlitePool};

use crate::{
    AppState,
    accounts::{
        CONFIRM_LIFETIME, EMAILS_PER_ADDRESS_PER_HOUR, Purpose, emailed_lately, emails_to_address,
        password_problem, tidy_links_in,
    },
    auth::{database_problem, new_token, remember_device, scramble, session_cookie},
    email::SIGN_OFF,
    log, now,
    people::{is_taken, plausible_email, too_many},
    refused,
};

/// New accounts allowed in any hour, for the whole app.
pub const SIGN_UPS_PER_HOUR: i64 = 20;

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/sign-up", post(sign_up))
}

#[derive(Deserialize)]
struct SignUp {
    email: String,
    password: String,
}

/// Signs up: emails a link that makes the account (202, `sent_to`), or,
/// without the email settings, makes it at once and signs this device in
/// (204). An address that already has an account is said to (decision
/// 0115 accepted that every sign-up page does).
async fn sign_up(State(state): State<AppState>, Json(form): Json<SignUp>) -> Response {
    let email = form.email.trim().to_owned();
    if !plausible_email(&email) {
        return refused(StatusCode::BAD_REQUEST, "email");
    }
    if let Some(refusal) = password_problem(&form.password) {
        return refusal;
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

    let Some(mailer) = state.mailer.clone() else {
        let made = make_account(&state.db, &email, &line, None).await;
        drop(tries);
        return match made {
            Ok(Ok(person)) => match remember_device(&state.db, person).await {
                Ok(Some(token)) => (
                    StatusCode::NO_CONTENT,
                    [(header::SET_COOKIE, session_cookie(&token))],
                )
                    .into_response(),
                Ok(None) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
                Err(error) => database_problem("signing in a new reader", &error),
            },
            Ok(Err(refusal)) => refusal,
            Err(error) => database_problem("making an account", &error),
        };
    };

    let taken: Result<bool, sqlx::Error> =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM people WHERE email = ? COLLATE NOCASE)")
            .bind(&email)
            .fetch_one(&state.db)
            .await;
    match taken {
        Ok(false) => {}
        Ok(true) => return refused(StatusCode::CONFLICT, "already"),
        Err(error) => return database_problem("finding a reader", &error),
    }
    let ticket = match wait_for_confirming(&state.db, &email, &line).await {
        Ok(Some(ticket)) => ticket,
        // Past the address's emails for the hour, or one went less than a
        // minute ago: answered the same, and nothing is sent.
        Ok(None) => return sent(&email),
        Err(error) => return database_problem("making an email link", &error),
    };
    drop(tries);
    let link = mailer.link(crate::accounts::CONFIRM_PAGE, &ticket);
    mailer.send_later(
        &email,
        "Confirm your email for nine turtles",
        format!(
            "Hello,\n\nTo finish signing up for nine turtles, open this link and press Confirm \
             email:\n\n{link}\n\nIt works once, for the next 24 hours. If you didn't sign up, \
             ignore this email and no account is made.{SIGN_OFF}"
        ),
        "a link to confirm a new account",
    );
    sent(&email)
}

fn sent(email: &str) -> Response {
    (StatusCode::ACCEPTED, Json(json!({ "sent_to": email }))).into_response()
}

/// Saves a waiting sign-up, behind SQLite's one writer at a time, keeping
/// to the limits every emailed link keeps: answers its ticket, or nothing
/// when the address has had its emails for the hour or a sign-up link less
/// than a minute ago. Only the newest link for an address works: those
/// before it are spent, so a second sign-up (with another password) can't
/// be finished by an older link.
async fn wait_for_confirming(
    db: &SqlitePool,
    email: &str,
    line: &str,
) -> Result<Option<String>, sqlx::Error> {
    let ticket = match new_token() {
        Ok(ticket) => ticket,
        Err(error) => {
            log::problem(&format!("couldn't make an email link: {error}"));
            return Err(sqlx::Error::Protocol("no random ticket".into()));
        }
    };
    let now = now();
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    tidy_links_in(&mut transaction, now).await?;
    let this_hour = emails_to_address(&mut transaction, email, now - 60 * 60).await?;
    let lately = emailed_lately(&mut transaction, Purpose::SignUp, email, now).await?;
    if this_hour >= EMAILS_PER_ADDRESS_PER_HOUR || lately {
        transaction.commit().await?;
        return Ok(None);
    }
    sqlx::query("UPDATE email_links SET used = 1 WHERE purpose = 'sign-up' AND email = ?")
        .bind(email)
        .execute(&mut *transaction)
        .await?;
    sqlx::query(
        "INSERT INTO email_links
             (purpose, person_id, email, password_hash, token_hash, created_at, expires_at)
         VALUES ('sign-up', NULL, ?, ?, ?, ?, ?)",
    )
    .bind(email)
    .bind(line)
    .bind(&scramble(&ticket)[..])
    .bind(now)
    .bind(now + CONFIRM_LIFETIME)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(ticket))
}

/// Makes the account a followed sign-up link was waiting for, inside the
/// transaction that spent the link, with its address confirmed. Answers the
/// new reader, or why not: "already" (the address has an account now: the
/// link stays spent) or "too-many" (the hour's accounts are made: the caller
/// rolls back, so the same link works later).
pub(crate) async fn finish(
    transaction: &mut SqliteConnection,
    email: &str,
    line: &str,
) -> Result<Result<i64, Response>, sqlx::Error> {
    let made = make_account(&mut *transaction, email, line, Some(now())).await?;
    if made.is_ok() {
        // Any other link waiting for this address can't make a second account.
        sqlx::query("UPDATE email_links SET used = 1 WHERE purpose = 'sign-up' AND email = ?")
            .bind(email)
            .execute(&mut *transaction)
            .await?;
    }
    Ok(made)
}

/// Makes a reader, unless the hour's accounts are made ("too-many") or the
/// address has one ("already"). The hour's count is checked as the account
/// is made, so two at once can't both slip past it.
async fn make_account<'c>(
    connection: impl sqlx::SqliteExecutor<'c>,
    email: &str,
    line: &str,
    confirmed_at: Option<i64>,
) -> Result<Result<i64, Response>, sqlx::Error> {
    let now = now();
    let made: Result<Option<i64>, sqlx::Error> = sqlx::query_scalar(
        "INSERT INTO people (owner, email, password_hash, created_at, email_confirmed_at)
         SELECT 0, ?, ?, ?, ?
         WHERE (SELECT COUNT(*) FROM people WHERE owner = 0 AND created_at > ?) < ?
         RETURNING id",
    )
    .bind(email)
    .bind(line)
    .bind(now)
    .bind(confirmed_at)
    .bind(now - 60 * 60)
    .bind(SIGN_UPS_PER_HOUR)
    .fetch_optional(connection)
    .await;
    match made {
        Ok(Some(person)) => Ok(Ok(person)),
        Ok(None) => Ok(Err(too_many())),
        Err(error) if is_taken(&error) => Ok(Err(refused(StatusCode::CONFLICT, "already"))),
        Err(error) => Err(error),
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

async fn recent_sign_ups(db: &SqlitePool, since: i64) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT COUNT(*) FROM people WHERE owner = 0 AND created_at > ?")
        .bind(since)
        .fetch_one(db)
        .await
}
