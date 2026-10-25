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
//! - **Open**: anyone can. Not yet: it waits for confirmation emails, so
//!   the server refuses it whatever it's sent.
//!
//! However sign-up is set, at most `SIGN_UPS_PER_HOUR` new accounts are made
//! in any hour, for the whole app: behind the host's proxy nine turtles
//! can't reliably tell one place from another.

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
    auth::{SignedIn, database_problem, new_token, remember_device, scramble, session_cookie},
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
async fn is_owner(db: &SqlitePool, person: i64) -> Result<bool, sqlx::Error> {
    let owner: Option<bool> = sqlx::query_scalar("SELECT owner FROM people WHERE id = ?")
        .bind(person)
        .fetch_optional(db)
        .await?;
    Ok(owner == Some(true))
}

/// Runs `then` only for the owner; anyone else gets 403.
async fn owner_only<F>(state: &AppState, person: i64, then: F) -> Response
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
}

/// The owner's own email, to sign in with (their password stays the one in
/// NINE_TURTLES_PASSWORD_HASH).
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
                // Open waits for confirmation emails (decision 0087).
                "open_available": false,
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

/// Closed or Invite link. Closing forgets the invite link, so it never
/// works again; choosing Invite link keeps any link already made. Open is
/// refused until confirmation emails work.
async fn switch(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Switch>,
) -> Response {
    owner_only(&state, person, async {
        let saved = match form.sign_up.as_str() {
            "closed" => close(&state.db).await,
            "invite" => save(&state.db, &[("sign_up", "invite")]).await,
            "open" => return refused(StatusCode::BAD_REQUEST, "open-not-yet"),
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

/// Makes an account with an email and a password, and signs this device in
/// for it. Only with the current invite link, while sign-up is set to it.
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
    if !invited {
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
    let hour_ago = now() - 60 * 60;
    match recent_sign_ups(&state.db, hour_ago).await {
        Ok(count) if count >= SIGN_UPS_PER_HOUR => return too_many(),
        Ok(_) => {}
        Err(error) => return database_problem("counting sign-ups", &error),
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
            .filter(|mode| mode == "invite")
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

async fn recent_sign_ups(db: &SqlitePool, since: i64) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT COUNT(*) FROM people WHERE owner = 0 AND created_at > ?")
        .bind(since)
        .fetch_one(db)
        .await
}

/// One @ with something on each side, no spaces, at most 254 characters.
/// Whether it really reaches someone is for confirmation emails, later.
pub fn plausible_email(email: &str) -> bool {
    let mut parts = email.split('@');
    let (Some(name), Some(place), None) = (parts.next(), parts.next(), parts.next()) else {
        return false;
    };
    email.len() <= EMAIL_MAXIMUM
        && !name.is_empty()
        && !place.is_empty()
        && !email
            .chars()
            .any(|character| character.is_whitespace() || character.is_control())
}

fn is_taken(error: &sqlx::Error) -> bool {
    error
        .as_database_error()
        .is_some_and(|error| error.is_unique_violation())
}

fn refused(status: StatusCode, error: &str) -> Response {
    (status, Json(json!({ "error": error }))).into_response()
}

fn too_many() -> Response {
    refused(StatusCode::TOO_MANY_REQUESTS, "too-many")
}

fn hex(bytes: &[u8]) -> String {
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
    fn plausible_emails_have_one_at_with_text_each_side_and_no_spaces() {
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
        ] {
            assert!(!plausible_email(bad), "{bad}");
        }
        assert!(!plausible_email(&format!(
            "{}@example.com",
            "a".repeat(250)
        )));
    }
}
