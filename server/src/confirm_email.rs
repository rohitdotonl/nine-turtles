//! Following a link that confirms a changed address (SPEC section 18,
//! decisions 0088 and 0154): the reader moves to it, and it counts as
//! confirmed. The page the link opens is `CONFIRM_PAGE` (`/confirm-email`);
//! the link is made in `accounts`. (A new account's link is `sign_up`'s.)

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

/// Follows a link that confirms a changed address: the reader's email
/// changes now, confirmed, and the old address is told.
async fn confirm(State(state): State<AppState>, Json(form): Json<Confirm>) -> Response {
    let hash = scramble(form.ticket.trim());
    let mut transaction = match state.db.begin().await {
        Ok(transaction) => transaction,
        Err(error) => return database_problem("confirming an email", &error),
    };
    let claimed: Result<Option<(i64, String)>, sqlx::Error> = sqlx::query_as(
        "UPDATE email_links SET used = 1
             WHERE token_hash = ? AND purpose = 'change' AND used = 0 AND expires_at > ?
             RETURNING person_id, email",
    )
    .bind(&hash[..])
    .bind(now())
    .fetch_optional(&mut *transaction)
    .await;
    let (person, email) = match claimed {
        Ok(Some(claimed)) => claimed,
        Ok(None) => return refused(StatusCode::GONE, "expired"),
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
