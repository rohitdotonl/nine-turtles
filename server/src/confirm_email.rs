//! Following a link that confirms an address (SPEC sections 1 and 18,
//! decisions 0088 and 0154): a new account's, which makes the account, or a
//! changed one's, which moves the reader to it. The page a link opens is
//! `CONFIRM_PAGE` (`/confirm-email`); the links are made in `sign_up` and
//! `accounts`.

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
};
use serde::Deserialize;
use serde_json::json;

use crate::{
    AppState,
    accounts::signed_in_as,
    auth::{database_problem, scramble},
    email::SIGN_OFF,
    now,
    people::is_taken,
    refused,
};

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/email/confirm", post(confirm))
}

#[derive(Deserialize)]
struct Confirm {
    ticket: String,
}

/// A followed confirmation link: whose it is (none for a sign-up), the
/// address, and a sign-up's scrambled password.
type Claimed = (Option<i64>, String, Option<String>);

/// Follows a link that confirms an address. A sign-up's makes the account,
/// with its address confirmed, and signs this device in (decision 0154). A
/// changed address's moves the reader to it now, and the old address is told.
async fn confirm(State(state): State<AppState>, Json(form): Json<Confirm>) -> Response {
    let hash = scramble(form.ticket.trim());
    let mut transaction = match state.db.begin().await {
        Ok(transaction) => transaction,
        Err(error) => return database_problem("confirming an email", &error),
    };
    let claimed: Result<Option<Claimed>, sqlx::Error> = sqlx::query_as(
        "UPDATE email_links SET used = 1
             WHERE token_hash = ? AND purpose IN ('change', 'sign-up') AND used = 0
                 AND expires_at > ?
             RETURNING person_id, email, password_hash",
    )
    .bind(&hash[..])
    .bind(now())
    .fetch_optional(&mut *transaction)
    .await;
    let (person, email) = match claimed {
        Ok(Some((Some(person), email, _))) => (person, email),
        Ok(Some((None, email, Some(line)))) => {
            return match crate::sign_up::finish(&mut transaction, &email, &line).await {
                Ok(Ok(person)) => match transaction.commit().await {
                    Ok(()) => signed_in_as(&state.db, person, json!({ "done": "signed-up" })).await,
                    Err(error) => database_problem("making an account", &error),
                },
                // The address has an account now: the link stays spent.
                Ok(Err(refusal)) if refusal.status() == StatusCode::CONFLICT => {
                    match transaction.commit().await {
                        Ok(()) => refusal,
                        Err(error) => database_problem("making an account", &error),
                    }
                }
                // The hour's accounts are made: nothing is kept, so the link works later.
                Ok(Err(refusal)) => refusal,
                Err(error) => database_problem("making an account", &error),
            };
        }
        Ok(_) => return refused(StatusCode::GONE, "expired"),
        Err(error) => return database_problem("confirming an email", &error),
    };
    let old: Result<Option<Option<String>>, sqlx::Error> =
        sqlx::query_scalar("SELECT email FROM people WHERE id = ?")
            .bind(person)
            .fetch_optional(&mut *transaction)
            .await;
    let old = match old {
        Ok(Some(old)) => old,
        Ok(None) => return refused(StatusCode::GONE, "expired"),
        Err(error) => return database_problem("changing an email", &error),
    };
    let changed = sqlx::query("UPDATE people SET email = ?, email_confirmed_at = ? WHERE id = ?")
        .bind(&email)
        .bind(now())
        .bind(person)
        .execute(&mut *transaction)
        .await;
    match changed {
        Ok(_) => {}
        Err(error) if is_taken(&error) => {
            return match transaction.commit().await {
                Ok(()) => refused(StatusCode::CONFLICT, "already"),
                Err(error) => database_problem("changing an email", &error),
            };
        }
        Err(error) => return database_problem("changing an email", &error),
    }
    if let Err(error) = transaction.commit().await {
        return database_problem("changing an email", &error);
    }
    if let (Some(mailer), Some(old)) = (
        &state.mailer,
        old.filter(|old| !old.eq_ignore_ascii_case(&email)),
    ) {
        mailer.send_later(
            &old,
            "Your nine turtles email was changed",
            format!(
                "Hello,\n\nThe nine turtles account that used this address now signs in with \
                 {email}. Emails about it go there from now on.\n\nIf you didn't make this change, someone \
                 may know your password. Reply to this email and I'll help you get your account back.{SIGN_OFF}"
            ),
            "a note that an email changed",
        );
    }
    Json(json!({ "done": "changed", "email": email })).into_response()
}
