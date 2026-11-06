//! The signed-in reader's own password (SPEC section 18, decision 0200):
//! asked for before anything that could hand the account to someone else
//! or can't be undone (a new email, a passkey, deleting the account or its
//! data), and changed in Settings › Account with the current one. Checked
//! as sign-in checks it (`auth::ask_password`): the same count of wrong
//! tries for the reader's email and the same bounded line.
//!
//! A new password, here or after Forgot?'s link (`accounts::reset`), is
//! stored the same way (`store_new`, `after_new`): every other device is
//! signed out and every unused password or sign-in link stops working.

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqliteConnection;

use crate::{
    AppState,
    accounts::{password_problem, signed_in_as},
    auth::{
        Account, OWNER, OWNER_PASSWORD_FROM, SignedIn, ask_password, database_problem,
        setting_fingerprint,
    },
    config::PasswordSetting,
    log,
};

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/people/me/password", post(change))
}

/// A reader's email, own scrambled password, and whether they're the owner.
type SigningIn = (Option<String>, Option<String>, bool);

/// Checks that `password` is the signed-in reader's own: answers their
/// email (none for an owner who hasn't saved one), or the refusal to send
/// back ("password-needed", "wrong-password", a wait).
pub(crate) async fn confirm(
    state: &AppState,
    person: i64,
    password: String,
) -> Result<Option<String>, Box<Response>> {
    let found: Result<Option<SigningIn>, sqlx::Error> =
        sqlx::query_as("SELECT email, password_hash, owner FROM people WHERE id = ?")
            .bind(person)
            .fetch_optional(&state.db)
            .await;
    let (email, own_line, owner) = match found {
        Ok(Some(found)) => found,
        Ok(None) => return Err(Box::new(StatusCode::UNAUTHORIZED.into_response())),
        Err(error) => return Err(Box::new(database_problem("finding a reader", &error))),
    };
    if password.is_empty() {
        return Err(Box::new(crate::refused(
            StatusCode::BAD_REQUEST,
            "password-needed",
        )));
    }
    // Counted where this reader's sign-in counts: under their email, or for
    // an owner with none yet, the owner's own count. A reader with no email
    // has no count of their own; this can't be anyone's email.
    let account = match email.as_deref() {
        Some(email) => Account::named(Some(email)),
        None if owner => Account::Owner,
        None => Account::Email(format!("reader {person}")),
    };
    let stored = own_line.or(match &state.config.password {
        PasswordSetting::Set(line) if owner => Some(line.clone()),
        _ => None,
    });
    match ask_password(state, &account, password, stored).await {
        Some(refusal) => Err(Box::new(refusal)),
        None => Ok(email),
    }
}

/// Stores `line` (a scrambled password) as `person`'s, inside the caller's
/// transaction: every password or sign-in link of theirs not yet used stops
/// working and every device signed in as them is signed out (the caller
/// signs this one in again). Answers their email.
pub(crate) async fn store_new(
    transaction: &mut SqliteConnection,
    state: &AppState,
    person: i64,
    line: &str,
) -> Result<Option<String>, sqlx::Error> {
    let email: Option<String> =
        sqlx::query_scalar("UPDATE people SET password_hash = ? WHERE id = ? RETURNING email")
            .bind(line)
            .bind(person)
            .fetch_optional(&mut *transaction)
            .await?
            .flatten();
    sqlx::query(
        "UPDATE email_links SET used = 1
         WHERE person_id = ? AND purpose IN ('reset', 'sign-in')",
    )
    .bind(person)
    .execute(&mut *transaction)
    .await?;
    sqlx::query("DELETE FROM sessions WHERE person_id = ?")
        .bind(person)
        .execute(&mut *transaction)
        .await?;
    // The owner's own password lasts only while NINE_TURTLES_PASSWORD_HASH
    // stays as it is now (`auth::owner_password_follows_setting`).
    if person == OWNER {
        sqlx::query(
            "INSERT INTO settings (name, value) VALUES (?, ?)
             ON CONFLICT (name) DO UPDATE SET value = excluded.value",
        )
        .bind(OWNER_PASSWORD_FROM)
        .bind(setting_fingerprint(&state.config.password))
        .execute(&mut *transaction)
        .await?;
    }
    Ok(email)
}

/// Once a new password is stored: any offer to choose one after a sign-in
/// link ends, and earlier wrong tries are forgotten (the owner has a count
/// of their own for while they have no email).
pub(crate) async fn after_new(state: &AppState, person: i64, email: Option<&str>) {
    state.password_choices.end_for(person);
    let mut limiters = state.limiter.lock().await;
    if email.is_some() {
        limiters.right(&Account::named(email));
    }
    if person == OWNER {
        limiters.right(&Account::Owner);
    }
}

/// Scrambles a new password on the shared line, as a sign-in is checked.
pub(crate) async fn scramble_new(
    state: &AppState,
    account: &Account,
    password: String,
) -> Result<String, Box<Response>> {
    let scrambled = {
        // Only closed if the app is stopping.
        let Ok(_turn) = state.password_checks.line_for(account).acquire().await else {
            return Err(Box::new(StatusCode::SERVICE_UNAVAILABLE.into_response()));
        };
        tokio::task::spawn_blocking(move || crate::password::hash(&password)).await
    };
    match scrambled {
        Ok(Ok(line)) => Ok(line),
        Ok(Err(error)) => {
            log::problem(&error);
            Err(Box::new(StatusCode::INTERNAL_SERVER_ERROR.into_response()))
        }
        Err(error) => {
            log::problem(&format!("couldn't scramble a new password: {error}"));
            Err(Box::new(StatusCode::INTERNAL_SERVER_ERROR.into_response()))
        }
    }
}

#[derive(Deserialize)]
struct Change {
    current: String,
    password: String,
}

/// Settings › Account › Change password…: the current password, then the
/// new one. Every other device is signed out; this one stays signed in.
async fn change(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Change>,
) -> Response {
    if let Some(problem) = password_problem(&form.password) {
        return problem;
    }
    let email = match confirm(&state, person, form.current).await {
        Ok(email) => email,
        Err(refusal) => return *refusal,
    };
    let account = Account::Email(format!("reader {person}"));
    let line = match scramble_new(&state, &account, form.password).await {
        Ok(line) => line,
        Err(refusal) => return *refusal,
    };
    let stored = async {
        let mut transaction = state.db.begin().await?;
        let email = store_new(&mut transaction, &state, person, &line).await?;
        transaction.commit().await?;
        Ok::<_, sqlx::Error>(email)
    }
    .await;
    if let Err(error) = stored {
        return database_problem("setting a new password", &error);
    }
    after_new(&state, person, email.as_deref()).await;
    signed_in_as(&state.db, person, json!({ "done": "changed" })).await
}
