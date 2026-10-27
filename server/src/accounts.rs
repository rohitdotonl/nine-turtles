//! What email makes possible for a reader's account (SPEC sections 1 and
//! 18, decisions 0088, 0096 and 0121): signing in by a link instead of a
//! password (what the sign-in page's "Forgot?" sends), then choosing a new
//! password if the reader wishes; setting a new password from an emailed
//! password link (sent by the older "Forgot your password?", whose links and
//! route still work); moving to a new email address, and deleting an account.
//!
//! Every link is sent by email (`email`), carries a long random ticket of
//! which only a BLAKE2s scramble is kept (`email_links`, structure change
//! 14), works once, and expires: a day to confirm a new address, an hour for a
//! new password, 15 minutes to sign in. At most `EMAILS_PER_ADDRESS_PER_HOUR`
//! links go to any one address in an hour, so nine turtles can't be used to
//! flood someone's inbox, and at most one password link (or sign-in link, or
//! change of email) a minute (`EMAIL_GAP`), so pressing Send link twice sends
//! one email.
//!
//! A link's ticket comes after the `#` (`/reset-password#ticket=…`), the
//! part of an address no browser sends to a server, so it never reaches a
//! log; the page reads it and sends it in the body of a POST. Every password checked or scrambled here
//! waits its turn in sign-in's bounded lines (`AppState.password_checks`),
//! and a password checked counts towards sign-in's wrong tries.

use axum::{
    Json, Router,
    extract::State,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
    routing::post,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;

use crate::{
    AppState,
    auth::{
        Account, OWNER, OWNER_PASSWORD_FROM, SignedIn, ask_password, database_problem, new_token,
        remember_device, scramble, session_cookie, setting_fingerprint,
    },
    config::PasswordSetting,
    email::SIGN_OFF,
    log, now,
    people::{self, is_taken, plausible_email, refused, too_many},
};

/// A link to confirm an address (a new account's, or a changed one) works this long.
pub const CONFIRM_LIFETIME: i64 = 24 * 60 * 60;
/// A link to set a new password works this long.
pub const RESET_LIFETIME: i64 = 60 * 60;
/// A link to sign in works this long.
pub const SIGN_IN_LIFETIME: i64 = 15 * 60;
/// At most this many links go to one address in any hour.
pub const EMAILS_PER_ADDRESS_PER_HOUR: i64 = 3;
/// A password link (or a sign-in link, or a change of email's) of one kind
/// goes to one address at most once
/// in this many seconds: a second press of Send link within it is answered
/// the same, and sends nothing.
pub const EMAIL_GAP: i64 = 60;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/password/forgot", post(forgot))
        .route("/api/password/reset", post(reset))
        .route("/api/sign-in/link", post(ask_sign_in_link))
        .route("/api/sign-in/link/use", post(use_sign_in_link))
        .route("/api/email/confirm", post(confirm))
        .route("/api/people/me/email/change", post(change_email))
        .route("/api/people/me/delete", post(delete_me))
        .route("/api/people/me/data/delete", post(delete_my_data))
}

/// What a link is for (`email_links.purpose`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Purpose {
    Reset,
    Change,
    SignIn,
}

impl Purpose {
    fn stored(self) -> &'static str {
        match self {
            Self::Reset => "reset",
            Self::Change => "change",
            Self::SignIn => "sign-in",
        }
    }
}

/// How many emails went to `email` (however it's capitalised) in the last
/// hour. Read inside the transaction that saves a link, so requests sent
/// together can't race past the hour's share.
async fn emails_to_address(
    transaction: &mut sqlx::SqliteConnection,
    email: &str,
    hour_ago: i64,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM email_links
         WHERE email = ? COLLATE NOCASE AND emailed = 1 AND created_at > ?",
    )
    .bind(email)
    .bind(hour_ago)
    .fetch_one(&mut *transaction)
    .await
}

/// Whether a link for `purpose` was emailed to `email` within the last
/// `EMAIL_GAP` seconds.
async fn emailed_lately(
    transaction: &mut sqlx::SqliteConnection,
    purpose: Purpose,
    email: &str,
    now: i64,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM email_links
         WHERE email = ? COLLATE NOCASE AND purpose = ? AND emailed = 1 AND created_at > ?)",
    )
    .bind(email)
    .bind(purpose.stored())
    .bind(now - EMAIL_GAP)
    .fetch_one(&mut *transaction)
    .await
}

/// How many times reader `person` asked to change their email in the last
/// hour, whether or not an email went.
async fn changes_tried(
    transaction: &mut sqlx::SqliteConnection,
    person: Option<i64>,
    hour_ago: i64,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM email_links
         WHERE person_id = ? AND purpose = 'change' AND created_at > ?",
    )
    .bind(person)
    .bind(hour_ago)
    .fetch_one(&mut *transaction)
    .await
}

/// What `make_link` made.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Made {
    /// A link to email, with its ticket.
    Link(String),
    /// Nothing to send: the address had its hour's share of emails, or a
    /// password link within the last minute, or the try was only counted
    /// (`email_to` false).
    Nothing,
    /// The reader has asked to change their email too often this hour.
    TooMany,
    /// No random ticket could be made (said in the log).
    NoTicket,
}

/// Saves a new link, counted and saved in one step behind SQLite's one
/// writer at a time (`BEGIN IMMEDIATE`), so requests sent together can't
/// race past the hour's share: at most `EMAILS_PER_ADDRESS_PER_HOUR`
/// emails to one address (one password link a minute), and as many tries to change one reader's email.
///
/// For a changed email, every try is counted towards the reader's share,
/// whether or not it's emailed: one that isn't (`email_to` false, for an
/// address another reader has, or one past its hour's emails) is kept spent
/// at once and never counts towards the address's emails. So the answer
/// never tells whether an address is taken. Links past their time are
/// tidied away first; every link lives at least an hour, as long as the
/// counts look back.
pub(crate) async fn make_link(
    db: &SqlitePool,
    purpose: Purpose,
    person: Option<i64>,
    email: &str,
    password_hash: Option<&str>,
    email_to: bool,
) -> Result<Made, sqlx::Error> {
    let ticket = match new_token() {
        Ok(ticket) => ticket,
        Err(error) => {
            log::problem(&format!("couldn't make an email link: {error}"));
            return Ok(Made::NoTicket);
        }
    };
    let now = now();
    let hour_ago = now - 60 * 60;
    let lifetime = match purpose {
        Purpose::Reset => RESET_LIFETIME,
        Purpose::SignIn => SIGN_IN_LIFETIME,
        Purpose::Change => CONFIRM_LIFETIME,
    };
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    tidy_links_in(&mut transaction, now).await?;
    if purpose == Purpose::Change
        && changes_tried(&mut transaction, person, hour_ago).await? >= EMAILS_PER_ADDRESS_PER_HOUR
    {
        transaction.commit().await?;
        return Ok(Made::TooMany);
    }
    // Both counts are always read, as `make_no_link` reads them, so the
    // work done doesn't depend on which limit was reached.
    let this_hour = emails_to_address(&mut transaction, email, hour_ago).await?;
    let lately = emailed_lately(&mut transaction, purpose, email, now).await?;
    let emailed = this_hour < EMAILS_PER_ADDRESS_PER_HOUR && !lately && email_to;
    if !emailed && purpose != Purpose::Change {
        transaction.commit().await?;
        return Ok(Made::Nothing);
    }
    sqlx::query(
        "INSERT INTO email_links
             (purpose, person_id, email, password_hash, token_hash, created_at, expires_at,
              used, emailed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(purpose.stored())
    .bind(person)
    .bind(email)
    .bind(password_hash)
    .bind(&scramble(&ticket)[..])
    .bind(now)
    .bind(now + lifetime)
    .bind(!emailed)
    .bind(emailed)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(if emailed {
        Made::Link(ticket)
    } else {
        Made::Nothing
    })
}

/// The same work as `make_link`, for an address with no account ("Forgot
/// your password?", "Email me a sign-in link"), so the time taken doesn't
/// tell: the tidy, the count, and a write that saves nothing.
async fn make_no_link(db: &SqlitePool, purpose: Purpose, email: &str) -> Result<(), sqlx::Error> {
    let now = now();
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    tidy_links_in(&mut transaction, now).await?;
    emails_to_address(&mut transaction, email, now - 60 * 60).await?;
    emailed_lately(&mut transaction, purpose, email, now).await?;
    sqlx::query(
        "INSERT INTO email_links
             (purpose, person_id, email, password_hash, token_hash, created_at, expires_at)
         SELECT 'reset', 0, ?, NULL, ?, ?, ? WHERE 0",
    )
    .bind(email)
    .bind(&scramble(email)[..])
    .bind(now)
    .bind(now + RESET_LIFETIME)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await
}

/// Deletes links past their time, once the hour the counts look back has
/// passed too (a sign-in link stops working after 15 minutes, but still
/// counts towards its address's emails for the hour). Run with every new link and every round of background
/// checking (`checking::round`), so on a quiet nine turtles too a used
/// link's email doesn't stay past its day.
pub async fn tidy_links(db: &SqlitePool, now: i64) -> Result<(), sqlx::Error> {
    let mut connection = db.acquire().await?;
    tidy_links_in(&mut connection, now).await
}

async fn tidy_links_in(
    connection: &mut sqlx::SqliteConnection,
    now: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM email_links WHERE expires_at <= ? AND created_at <= ?")
        .bind(now)
        .bind(now - 60 * 60)
        .execute(&mut *connection)
        .await
        .map(|_| ())
}

/// Without the email settings, what needs email says so.
fn no_email() -> Response {
    refused(StatusCode::SERVICE_UNAVAILABLE, "no-email")
}

#[derive(Deserialize)]
struct Forgot {
    email: String,
}

/// "Forgot your password?": always the same answer, whether or not the
/// address has an account, and in about the same time (the email is sent
/// behind the answer). A link valid for an hour goes to an address that
/// has one, at most `EMAILS_PER_ADDRESS_PER_HOUR` times an hour.
async fn forgot(State(state): State<AppState>, Json(form): Json<Forgot>) -> Response {
    let Some(mailer) = &state.mailer else {
        return no_email();
    };
    let email = form.email.trim();
    if !plausible_email(email) {
        return refused(StatusCode::BAD_REQUEST, "email");
    }
    let found: Result<Option<(i64, String)>, sqlx::Error> =
        sqlx::query_as("SELECT id, email FROM people WHERE email = ? COLLATE NOCASE")
            .bind(email)
            .fetch_optional(&state.db)
            .await;
    let (person, address) = match found {
        Ok(Some(found)) => found,
        // The same database work as for an address that has an account.
        Ok(None) => {
            return match make_no_link(&state.db, Purpose::Reset, email).await {
                Ok(()) => asked(),
                Err(error) => database_problem("making a password link", &error),
            };
        }
        Err(error) => return database_problem("finding a reader", &error),
    };
    let made = make_link(
        &state.db,
        Purpose::Reset,
        Some(person),
        &address,
        None,
        true,
    )
    .await;
    let ticket = match made {
        Ok(Made::Link(ticket)) => ticket,
        Ok(Made::Nothing | Made::TooMany | Made::NoTicket) => return asked(),
        Err(error) => return database_problem("making a password link", &error),
    };
    let link = mailer.link("/reset-password", &ticket);
    mailer.send_later(
        &address,
        "A new password for nine turtles",
        format!(
            "Hello,\n\nSomeone, hopefully you, asked to set a new password for the nine turtles \
             account with this email. To choose one, open this link:\n\n{link}\n\n\
             It works once, for the next hour. A new password signs out your other devices. \
             If you didn't ask, ignore this email: your password stays as it is.{SIGN_OFF}"
        ),
        "a password link",
    );
    asked()
}

/// The one answer "Forgot your password?" ever gives.
fn asked() -> Response {
    (StatusCode::ACCEPTED, Json(json!({ "asked": true }))).into_response()
}

#[derive(Deserialize)]
struct Reset {
    ticket: String,
    password: String,
}

/// Sets a new password from a password link: once, within the hour. Every
/// device signed in as that reader is signed out (and this one signed in),
/// and their app password stops working.
async fn reset(State(state): State<AppState>, Json(form): Json<Reset>) -> Response {
    if let Some(problem) = password_problem(&form.password) {
        return problem;
    }
    let hash = scramble(form.ticket.trim());
    // The link is looked up before the password is scrambled, so made-up
    // tickets cost the server nothing; it's used up only below, with the
    // password, so a failed scramble leaves it to try again.
    let found: Result<Option<i64>, sqlx::Error> = sqlx::query_scalar(
        "SELECT people.id FROM email_links
         JOIN people ON people.id = email_links.person_id
         WHERE email_links.token_hash = ? AND email_links.purpose = 'reset'
           AND email_links.used = 0 AND email_links.expires_at > ?
           AND people.email = email_links.email COLLATE NOCASE",
    )
    .bind(&hash[..])
    .bind(now())
    .fetch_optional(&state.db)
    .await;
    let found = match found {
        Ok(Some(person)) => Some(person),
        Ok(None) => None,
        Err(error) => return database_problem("finding a password link", &error),
    };
    // Not an emailed link: perhaps the choice offered after a sign-in
    // link (decision 0121), while the reader keeps the address it went to.
    let chosen = match found {
        Some(_) => None,
        None => match state.password_choices.peek(&hash, now()) {
            Some((person, email)) => match still_has(&state.db, person, &email).await {
                Ok(true) => Some(person),
                Ok(false) => None,
                Err(error) => return database_problem("finding a reader", &error),
            },
            None => None,
        },
    };
    // Scrambled on the shared line, as a sign-in is checked; the owner's
    // own line is kept for their confirmations while they have no email.
    let (account, waiting_for) = match found.or(chosen) {
        Some(person) => (Account::Email(format!("reader {person}")), person),
        None => return refused(StatusCode::GONE, "expired"),
    };
    let password = form.password;
    let scrambled = {
        // Only closed if the app is stopping.
        let Ok(_turn) = state.password_checks.line_for(&account).acquire().await else {
            return StatusCode::SERVICE_UNAVAILABLE.into_response();
        };
        tokio::task::spawn_blocking(move || crate::password::hash(&password)).await
    };
    let line = match scrambled {
        Ok(Ok(line)) => line,
        Ok(Err(error)) => {
            log::problem(&error);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
        Err(error) => {
            log::problem(&format!("couldn't scramble a new password: {error}"));
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let changed = async {
        let mut transaction = state.db.begin().await?;
        let claimed: Option<i64> = if chosen.is_some() {
            // Spent here, once, whatever happens next.
            match state.password_choices.take(&hash, now()) {
                Some((person, email)) if still_has(&mut *transaction, person, &email).await? => {
                    Some(person)
                }
                _ => None,
            }
        } else {
            sqlx::query_scalar(
            "UPDATE email_links SET used = 1
             WHERE token_hash = ? AND purpose = 'reset' AND used = 0 AND expires_at > ?
               -- Sent to an address the reader has since moved away from:
               -- whoever reads that inbox now mustn't get in.
               AND EXISTS (SELECT 1 FROM people
                           WHERE people.id = email_links.person_id
                             AND people.email = email_links.email COLLATE NOCASE)
             RETURNING person_id",
        )
        .bind(&hash[..])
        .bind(now())
        .fetch_optional(&mut *transaction)
        .await?
        };
        let Some(person) = claimed.filter(|person| *person == waiting_for) else {
            return Ok::<_, sqlx::Error>(None);
        };
        let email: Option<String> =
            sqlx::query_scalar("UPDATE people SET password_hash = ? WHERE id = ? RETURNING email")
                .bind(&line)
                .bind(person)
                .fetch_optional(&mut *transaction)
                .await?
                .flatten();
        // Any other password link or sign-in link for them stops working,
        // every device signed in as them is signed out, and their app
        // password (for other feed reader apps) stops working too.
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
        sqlx::query("DELETE FROM app_passwords WHERE person_id = ?")
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
        transaction.commit().await?;
        Ok(Some((person, email)))
    }
    .await;
    let (person, email) = match changed {
        Ok(Some(changed)) => changed,
        Ok(None) => return refused(StatusCode::GONE, "expired"),
        Err(error) => return database_problem("setting a new password", &error),
    };
    // Any other offer to choose a password, after a sign-in link, ends too.
    state.password_choices.end_for(person);

    // Earlier wrong tries for this account are forgotten: it has a new
    // password. The owner has a count of their own for while they have no email.
    let mut limiters = state.limiter.lock().await;
    if email.is_some() {
        limiters.right(&Account::named(email.as_deref()));
    }
    if person == OWNER {
        limiters.right(&Account::Owner);
    }
    drop(limiters);
    signed_in_as(&state.db, person, json!({ "done": "reset" })).await
}

#[derive(Deserialize)]
struct AskSignIn {
    email: String,
}

/// "Forgot?" on the sign-in page (decision 0121; "Email me a sign-in link"
/// before it, decision 0096): answered as "Forgot your password?" is,
/// always the same and in about the same time, whether or not the address
/// has an account. A link valid for 15 minutes goes to an address that has
/// one, within the same limits as a password link.
async fn ask_sign_in_link(State(state): State<AppState>, Json(form): Json<AskSignIn>) -> Response {
    let Some(mailer) = &state.mailer else {
        return no_email();
    };
    let email = form.email.trim();
    if !plausible_email(email) {
        return refused(StatusCode::BAD_REQUEST, "email");
    }
    let found: Result<Option<(i64, String)>, sqlx::Error> =
        sqlx::query_as("SELECT id, email FROM people WHERE email = ? COLLATE NOCASE")
            .bind(email)
            .fetch_optional(&state.db)
            .await;
    let (person, address) = match found {
        Ok(Some(found)) => found,
        Ok(None) => {
            return match make_no_link(&state.db, Purpose::SignIn, email).await {
                Ok(()) => asked(),
                Err(error) => database_problem("making a sign-in link", &error),
            };
        }
        Err(error) => return database_problem("finding a reader", &error),
    };
    let made = make_link(
        &state.db,
        Purpose::SignIn,
        Some(person),
        &address,
        None,
        true,
    )
    .await;
    let ticket = match made {
        Ok(Made::Link(ticket)) => ticket,
        Ok(Made::Nothing | Made::TooMany | Made::NoTicket) => return asked(),
        Err(error) => return database_problem("making a sign-in link", &error),
    };
    let link = mailer.link("/sign-in-link", &ticket);
    mailer.send_later(
        &address,
        "Sign in to nine turtles",
        format!(
            "Hello,\n\nSomeone, hopefully you, asked to sign in to nine turtles with this email. \
             To sign in, open this link on the device you want to read on:\n\n{link}\n\n\
             It works once, for the next 15 minutes. Once you're in, you can choose a new \
             password if you like; until then, your password stays as it is. \
             If you didn't ask, ignore this email: nobody can sign in without it.{SIGN_OFF}"
        ),
        "a sign-in link",
    );
    asked()
}

#[derive(Deserialize)]
struct UseSignIn {
    ticket: String,
}

/// Signs this device in from a sign-in link: once, within 15 minutes, and
/// only while the reader still has the address it went to (a changed email
/// leaves earlier links behind). Nothing else changes: the password stays,
/// and other devices stay signed in.
///
/// This is the link "Forgot?" on the sign-in page sends (decision 0121), so
/// the answer also carries a ticket for choosing a new password, if the
/// reader wishes (`PasswordChoices`): held only by the page that used the
/// link, and spent by `/api/password/reset` as an emailed password link is.
async fn use_sign_in_link(State(state): State<AppState>, Json(form): Json<UseSignIn>) -> Response {
    let hash = scramble(form.ticket.trim());
    let claimed: Result<Option<(i64, String)>, sqlx::Error> = sqlx::query_as(
        "UPDATE email_links SET used = 1
         WHERE token_hash = ? AND purpose = 'sign-in' AND used = 0 AND expires_at > ?
           AND EXISTS (SELECT 1 FROM people
                       WHERE people.id = email_links.person_id
                         AND people.email = email_links.email COLLATE NOCASE)
         RETURNING person_id, email",
    )
    .bind(&hash[..])
    .bind(now())
    .fetch_optional(&state.db)
    .await;
    let (person, email) = match claimed {
        Ok(Some(claimed)) => claimed,
        Ok(None) => return refused(StatusCode::GONE, "expired"),
        Err(error) => return database_problem("using a sign-in link", &error),
    };
    let body = match state.password_choices.offer(person, &email, now()) {
        Some(ticket) => json!({ "done": "signed-in", "password_ticket": ticket }),
        // Signed in all the same, with no choice of a new password here.
        None => json!({ "done": "signed-in" }),
    };
    signed_in_as(&state.db, person, body).await
}

/// After a sign-in link, the reader may choose a new password (decision
/// 0121). Each offer is a random ticket (only its BLAKE2s scramble is kept)
/// for one reader and the address the link went to, kept here in memory,
/// never in the database: it works once, for the hour a password link
/// works, and only while the reader still has that address. Restarting nine
/// turtles forgets every offer; "Forgot?" sends a new link.
#[derive(Default)]
pub struct PasswordChoices {
    waiting: std::sync::Mutex<std::collections::HashMap<[u8; 32], Choice>>,
}

struct Choice {
    person: i64,
    email: String,
    expires_at: i64,
}

impl PasswordChoices {
    /// A new ticket for `person`, or `None` if no random one could be made
    /// (said in the log).
    fn offer(&self, person: i64, email: &str, now: i64) -> Option<String> {
        let ticket = match new_token() {
            Ok(ticket) => ticket,
            Err(error) => {
                log::problem(&format!("couldn't make a ticket to choose a password: {error}"));
                return None;
            }
        };
        let mut waiting = self.waiting.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        waiting.retain(|_, choice| choice.expires_at > now);
        waiting.insert(
            scramble(&ticket),
            Choice {
                person,
                email: email.to_owned(),
                expires_at: now + RESET_LIFETIME,
            },
        );
        Some(ticket)
    }

    /// Whose ticket `hash` is and the address it's tied to, while it works.
    fn peek(&self, hash: &[u8; 32], now: i64) -> Option<(i64, String)> {
        let waiting = self.waiting.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        waiting
            .get(hash)
            .filter(|choice| choice.expires_at > now)
            .map(|choice| (choice.person, choice.email.clone()))
    }

    /// Spends ticket `hash`, answering whose it was, once only.
    fn take(&self, hash: &[u8; 32], now: i64) -> Option<(i64, String)> {
        let mut waiting = self.waiting.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        waiting
            .remove(hash)
            .filter(|choice| choice.expires_at > now)
            .map(|choice| (choice.person, choice.email))
    }

    /// Every offer for `person` stops working (a new password was set).
    fn end_for(&self, person: i64) {
        let mut waiting = self.waiting.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        waiting.retain(|_, choice| choice.person != person);
    }
}

/// Whether reader `person` still has the address `email` (however it's
/// capitalised).
async fn still_has<'c>(
    connection: impl sqlx::SqliteExecutor<'c>,
    person: i64,
    email: &str,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM people WHERE id = ? AND email = ? COLLATE NOCASE)",
    )
    .bind(person)
    .bind(email)
    .fetch_one(connection)
    .await
}

/// Signs this device in for `person` and answers `body` with its cookie.
async fn signed_in_as(db: &SqlitePool, person: i64, body: serde_json::Value) -> Response {
    match remember_device(db, person).await {
        Ok(Some(token)) => (
            StatusCode::OK,
            [(header::SET_COOKIE, session_cookie(&token))],
            Json(body),
        )
            .into_response(),
        Ok(None) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        Err(error) => database_problem("signing a device in", &error),
    }
}

/// A new password's length, as sign-up checks it.
pub(crate) fn password_problem(password: &str) -> Option<Response> {
    if password.chars().count() < people::READER_PASSWORD_MINIMUM {
        return Some(refused(StatusCode::BAD_REQUEST, "password-short"));
    }
    if password.len() > crate::password::MAXIMUM_LENGTH {
        return Some(refused(StatusCode::BAD_REQUEST, "password-long"));
    }
    None
}

/// A reader's email, own scrambled password, and whether they're the owner.
type SigningIn = (Option<String>, Option<String>, bool);

#[derive(Deserialize)]
struct Confirm {
    ticket: String,
}

/// Follows a link that confirms a changed address: the reader's email
/// changes now, and the old address is told. (Links that once confirmed an
/// Open sign-up, before decision 0115, no longer work.)
async fn confirm(State(state): State<AppState>, Json(form): Json<Confirm>) -> Response {
    let hash = scramble(form.ticket.trim());
    let mut transaction = match state.db.begin().await {
        Ok(transaction) => transaction,
        Err(error) => return database_problem("confirming an email", &error),
    };
    let claimed: Result<Option<(Option<i64>, String)>, sqlx::Error> = sqlx::query_as(
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
    let Some(person) = person else {
        return refused(StatusCode::GONE, "expired");
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
    let changed = sqlx::query("UPDATE people SET email = ? WHERE id = ?")
        .bind(&email)
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
                 {email}. Emails about it go there from now on.\n\nIf you didn't make this change, \
                 someone may know your password: tell whoever runs this nine turtles.{SIGN_OFF}"
            ),
            "a note that an email changed",
        );
    }
    Json(json!({ "done": "changed", "email": email })).into_response()
}

#[derive(Deserialize)]
struct ChangeEmail {
    email: String,
    password: String,
}

/// A reader asks to move to a new address. Their password is asked for, so
/// a device left signed in can't hand the account to someone else. Nothing
/// changes until the link sent to the new address is followed.
async fn change_email(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<ChangeEmail>,
) -> Response {
    let Some(mailer) = state.mailer.clone() else {
        return no_email();
    };
    let email = form.email.trim().to_owned();
    if !plausible_email(&email) {
        return refused(StatusCode::BAD_REQUEST, "email");
    }
    let found: Result<Option<SigningIn>, sqlx::Error> =
        sqlx::query_as("SELECT email, password_hash, owner FROM people WHERE id = ?")
            .bind(person)
            .fetch_optional(&state.db)
            .await;
    let (current, own_line, owner) = match found {
        Ok(Some(found)) => found,
        Ok(None) => return StatusCode::UNAUTHORIZED.into_response(),
        Err(error) => return database_problem("finding a reader", &error),
    };
    if current
        .as_deref()
        .is_some_and(|current| current.eq_ignore_ascii_case(&email))
    {
        return refused(StatusCode::BAD_REQUEST, "same");
    }

    // The password, checked as a sign-in by email checks it: the same count
    // of wrong tries (under the reader's email, the owner's too) and the
    // same bounded line for the check itself.
    let account = match current.as_deref() {
        Some(current) => Account::named(Some(current)),
        // A reader with no email has no sign-in count of their own; this
        // can't be anyone's email, so it never meets another's count.
        None => Account::Email(format!("reader {person}")),
    };
    let stored = own_line.or(match &state.config.password {
        PasswordSetting::Set(line) if owner => Some(line.clone()),
        _ => None,
    });
    if let Some(refusal) = ask_password(&state, &account, form.password, stored).await {
        return refusal;
    }

    let sent = (StatusCode::ACCEPTED, Json(json!({ "sent_to": email }))).into_response();
    // An address another reader has gets nothing, but the try counts
    // towards the reader's hour all the same, with the same database work
    // and the same answer, so no reader learns who else is here. An address
    // that's had its hour's emails gets nothing either, answered the same.
    let taken: Result<bool, sqlx::Error> =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM people WHERE email = ? COLLATE NOCASE)")
            .bind(&email)
            .fetch_one(&state.db)
            .await;
    let taken = match taken {
        Ok(taken) => taken,
        Err(error) => return database_problem("finding a reader", &error),
    };
    let made = make_link(
        &state.db,
        Purpose::Change,
        Some(person),
        &email,
        None,
        !taken,
    )
    .await;
    let ticket = match made {
        Ok(Made::Link(ticket)) => ticket,
        Ok(Made::Nothing) => return sent,
        Ok(Made::TooMany) => return too_many(),
        Ok(Made::NoTicket) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        Err(error) => return database_problem("making an email link", &error),
    };
    let link = mailer.link("/confirm-email", &ticket);
    mailer.send_later(
        &email,
        "Confirm your new email for nine turtles",
        format!(
            "Hello,\n\nTo use this address for your nine turtles account, open this link:\n\n\
             {link}\n\nIt works once, for the next 24 hours. Until then, your account keeps its \
             old email. If you didn't ask for this, ignore this email.{SIGN_OFF}"
        ),
        "a link to confirm a new email",
    );
    sent
}

/// Deletes the signed-in reader's account and everything that is theirs,
/// at once and for good (the owner's choice, decision 0088: one "Are you
/// sure?" in the page, no waiting period). The owner's own account can't
/// be deleted here: nine turtles needs its owner.
async fn delete_me(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    match people::is_owner(&state.db, person).await {
        Ok(true) => return refused(StatusCode::FORBIDDEN, "owner"),
        Ok(false) => {}
        Err(error) => return database_problem("checking who's the owner", &error),
    }
    // A plan that would charge again is cancelled first; if Dodo can't be
    // reached, nothing is deleted, so nobody pays for an account that's gone.
    if let Err(detail) = crate::payments::cancel_before_deleting(&state, person).await {
        log::problem(&format!(
            "Dodo Payments: couldn't cancel a subscription before deleting its account: {detail}"
        ));
        return refused(StatusCode::BAD_GATEWAY, "plan");
    }
    match people::delete(&state.db, person).await {
        Ok(()) => {
            log::info("a reader deleted their account");
            (StatusCode::NO_CONTENT, crate::auth::signed_out_cookies()).into_response()
        }
        Err(error) => database_problem("deleting an account", &error),
    }
}

/// Empties the signed-in reader's account, the owner's too, at once and for
/// good (decision 0117: one "Are you sure?" in the page, no undo). Their
/// feeds, folders, articles, stars, collections, saved searches and rules
/// go; they stay signed in, with their email, password and plan.
async fn delete_my_data(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    match people::delete_data(&state.db, person).await {
        Ok(()) => {
            log::info("a reader deleted their data");
            StatusCode::NO_CONTENT.into_response()
        }
        Err(error) => database_problem("deleting a reader's data", &error),
    }
}
