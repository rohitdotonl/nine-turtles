//! How new readers join (SPEC section 1, decision 0154, which replaced
//! decision 0115's "no email at sign-up").
//!
//! Anyone can sign up with an email and a password, with no invite. While
//! nine turtles can send email, nothing is made yet: the scrambled password
//! waits in a `sign-up` link (`email_links`), and a link goes to the
//! address. Only following it and typing the password chosen at sign-up
//! makes the account, marks its address confirmed and signs that device in
//! (`finish_sign_up`). In the browser that signed up, the password isn't
//! asked again (decision 0193): Sign up leaves a random secret in that
//! browser's cookie (`browser`), and the link plus that secret is proof
//! enough. The link proves the address is theirs; the password
//! says which waiting sign-up is theirs, so a stranger who signs up with
//! the same address can't hand them an account with the stranger's
//! password. Without the email settings (a nine turtles on someone's
//! own computer) the account is made at once, as before, with its address
//! not confirmed.
//!
//! Sign-up never tells whether an address has an account (decision 0195,
//! which replaced decision 0115's accepted give-away): an address that has
//! one gets the same "Check your email" answer, and an email saying so
//! instead of a link, within the same limits. Only without the email
//! settings, where nothing can be sent, does sign-up still say it.
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
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
    routing::post,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::{SqliteConnection, SqlitePool};

mod browser;

use crate::{
    AppState,
    accounts::{
        CONFIRM_LIFETIME, EMAILS_PER_ADDRESS_PER_HOUR, Purpose, emailed_lately, emails_to_address,
        password_problem, signed_in_as, tidy_links_in,
    },
    auth::{
        Account, check_password, count_try, database_problem, new_token, remember_device, scramble,
        session_cookie, wait_response,
    },
    email::SIGN_OFF,
    log, now,
    people::{is_taken, plausible_email, too_many},
    refused,
};

/// New accounts allowed in any hour, for the whole app.
/// Generous, so a busy day isn't turned away (decision 0195): an account is
/// made only once its emailed link is followed, and each address keeps its
/// own email limits.
pub const SIGN_UPS_PER_HOUR: i64 = 100;
/// Finishing a sign-up checks the password against at most this many of
/// the address's waiting sign-ups, the newest, so one wrong try costs at
/// most this many checks on sign-in's shared line.
pub const WAITING_PER_ADDRESS: i64 = 3;

/// The page a sign-up's link opens.
pub const FINISH_PAGE: &str = "/finish-sign-up";

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/sign-up", post(sign_up))
        .route("/api/sign-up/finish", post(finish_sign_up))
        .route("/api/sign-up/check", post(check_link))
}

#[derive(Deserialize)]
struct SignUp {
    email: String,
    password: String,
    /// "How did you hear about nine turtles?" (decision 0155): one of
    /// `HEARD_ABOUT`, or nothing when the reader chose not to say.
    #[serde(default)]
    heard_about: Option<String>,
}

/// The answers "How did you hear about nine turtles?" offers, as they're
/// kept: a blog, a friend, a search, an AI assistant, Reddit, somewhere
/// else. Only their totals are ever shown (the owner report). A waiting
/// sign-up keeps the answer with its link until the account is made.
pub const HEARD_ABOUT: &[&str] = &["blog", "friend", "search", "ai", "reddit", "other"];

/// Signs up: emails a link that makes the account (202, `sent_to`), or,
/// without the email settings, makes it at once and signs this device in
/// (204). An address that already has an account is answered the same as a
/// new one, cookie and all, and is emailed to say so (decision 0195); only
/// without the email settings, where nothing can be sent, is it said on the page.
async fn sign_up(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(form): Json<SignUp>,
) -> Response {
    let email = form.email.trim().to_owned();
    if !plausible_email(&email) {
        return refused(StatusCode::BAD_REQUEST, "email");
    }
    if let Some(refusal) = password_problem(&form.password) {
        return refusal;
    }
    // An answer the page doesn't offer is kept as no answer, never refused:
    // the question is optional, so it never stands between anyone and an account.
    let heard_about = form
        .heard_about
        .filter(|answer| HEARD_ABOUT.contains(&answer.as_str()));
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
        let made = make_account(&state.db, &email, &line, None, heard_about.as_deref()).await;
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
    let taken = match taken {
        Ok(taken) => taken,
        Err(error) => return database_problem("finding a reader", &error),
    };
    // A browser keeps one secret for all its sign-ups, so a link sent before
    // "Use another email" still needs only one press here. Given to a taken
    // address's browser too, so the answers can't be told apart.
    let Some(secret) = browser::secret_in(&headers).or_else(browser::new_secret) else {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };
    if taken {
        // The same work and the same answer as for a new address, so neither
        // tells: an email instead of a link, within the address's limits.
        let emailed = match note_already(&state.db, &email).await {
            Ok(emailed) => emailed,
            Err(error) => return database_problem("making an email link", &error),
        };
        drop(tries);
        if emailed {
            send_already(&mailer, &email);
        }
        return sent(&email, &secret);
    }
    let waiting = wait_for_confirming(&state.db, &email, &line, heard_about.as_deref(), &secret);
    let ticket = match waiting.await {
        Ok(Some(ticket)) => ticket,
        // Past the address's emails for the hour, or one went less than a
        // minute ago: kept, but not emailed. The link already sent works
        // with this password, or from this browser, too, so the answer is the same.
        Ok(None) => return sent(&email, &secret),
        Err(error) => return database_problem("making an email link", &error),
    };
    drop(tries);
    let link = mailer.link(FINISH_PAGE, &ticket);
    mailer.send_later(
        &email,
        "Confirm your email for nine turtles",
        format!(
            "Hello,\n\nTo finish signing up for nine turtles, open this link and type the \
             password you chose (in the browser you signed up in, it won't ask):\n\n{link}\n\nIt works once, for the next 24 hours. If you didn't sign up, \
             ignore this email and no account is made.{SIGN_OFF}"
        ),
        "a link to confirm a new account",
    );
    sent(&email, &secret)
}

/// The email an address with an account gets when someone signs up with it:
/// no link, nothing to undo, only where to go.
fn send_already(mailer: &crate::email::Mailer, email: &str) {
    let home = mailer.home();
    mailer.send_later(
        email,
        "You already have a nine turtles account",
        format!(
            "Hello,\n\nSomeone, hopefully you, tried to sign up for nine turtles with this email. \
             You already have an account, so nothing new was made. To sign in, go to:\n\n\
             {home}\n\nand type your password, or press Forgot? there if you've lost it. \
             If it wasn't you, ignore this email: nothing has changed.{SIGN_OFF}"
        ),
        "a note that an account already exists",
    );
}

/// The link is on its way; this browser keeps the secret that lets its
/// link finish without the password.
fn sent(email: &str, secret: &str) -> Response {
    (
        StatusCode::ACCEPTED,
        [(header::SET_COOKIE, browser::cookie(secret))],
        Json(json!({ "sent_to": email })),
    )
        .into_response()
}

/// Saves a waiting sign-up, behind SQLite's one writer at a time, keeping
/// to the limits every emailed link keeps: answers its ticket to email, or
/// nothing when the address has had its emails for the hour or a sign-up
/// link less than a minute ago (then it's kept with `emailed = 0`, so a link
/// already sent finishes it). Which waiting sign-up a link finishes is
/// decided by the password typed (`finish_sign_up`).
async fn wait_for_confirming(
    db: &SqlitePool,
    email: &str,
    line: &str,
    heard_about: Option<&str>,
    secret: &str,
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
    let emailed = this_hour < EMAILS_PER_ADDRESS_PER_HOUR && !lately;
    sqlx::query(
        "INSERT INTO email_links
             (purpose, person_id, email, password_hash, token_hash, created_at, expires_at, emailed,
              heard_about, browser_hash)
         VALUES ('sign-up', NULL, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(email)
    .bind(line)
    .bind(&scramble(&ticket)[..])
    .bind(now)
    .bind(now + CONFIRM_LIFETIME)
    .bind(emailed)
    .bind(heard_about)
    .bind(&scramble(secret)[..])
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(emailed.then_some(ticket))
}

/// Counts a sign-up with an address that has an account as one of the
/// address's emails, as `wait_for_confirming` counts a link, in the same
/// steps: answers whether to email it (not past the hour's emails, nor
/// within a minute of the last sign-up email). Its line is saved either way
/// (`emailed` says whether it went), keeps no password and is spent at
/// once, so it can never finish a sign-up.
async fn note_already(db: &SqlitePool, email: &str) -> Result<bool, sqlx::Error> {
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
    let emailed = this_hour < EMAILS_PER_ADDRESS_PER_HOUR && !lately;
    sqlx::query(
        "INSERT INTO email_links
             (purpose, person_id, email, password_hash, token_hash, created_at, expires_at,
              used, emailed)
         VALUES ('sign-up', NULL, ?, '', ?, ?, ?, 1, ?)",
    )
    .bind(email)
    .bind(&scramble(&ticket)[..])
    .bind(now)
    .bind(now + CONFIRM_LIFETIME)
    .bind(emailed)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(emailed)
}

#[derive(Deserialize)]
struct Finish {
    ticket: String,
    /// Empty in the browser that signed up: its cookie stands in for it.
    #[serde(default)]
    password: String,
}

#[derive(Deserialize)]
struct Check {
    ticket: String,
}

/// The address's newest waiting sign-ups (`WAITING_PER_ADDRESS`), the ones
/// a link can finish, newest first, each with its browser's scrambled
/// secret, if it has one: the password picks among these, or the browser's
/// secret does (`browser::waiting`).
async fn newest_waiting(db: &SqlitePool, email: &str) -> Result<Vec<WaitingHere>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, password_hash, heard_about, browser_hash FROM email_links
         WHERE purpose = 'sign-up' AND email = ? AND used = 0 AND expires_at > ?
         ORDER BY created_at DESC, id DESC LIMIT ?",
    )
    .bind(email)
    .bind(now())
    .bind(WAITING_PER_ADDRESS)
    .fetch_all(db)
    .await
}

/// The address a sign-up's link was sent to, while the link still works.
async fn link_email(db: &SqlitePool, ticket: &str) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT email FROM email_links
         WHERE token_hash = ? AND purpose = 'sign-up' AND used = 0 AND expires_at > ?",
    )
    .bind(&scramble(ticket.trim())[..])
    .bind(now())
    .fetch_optional(db)
    .await
}

/// Asks, without using the link up, whether it still works and whether
/// this is the browser that signed up (then the page asks no password):
/// `{ "same_browser": bool }`, or 410 "expired".
async fn check_link(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(form): Json<Check>,
) -> Response {
    let email = match link_email(&state.db, &form.ticket).await {
        Ok(Some(email)) => email,
        Ok(None) => return refused(StatusCode::GONE, "expired"),
        Err(error) => return database_problem("finding a sign-up link", &error),
    };
    match browser::waiting(&state.db, &email, &headers).await {
        Ok(found) => Json(json!({ "same_browser": found.is_some() })).into_response(),
        Err(error) => database_problem("finding a sign-up link", &error),
    }
}

/// A waiting sign-up: its line in `email_links`, the scrambled password and
/// the answer to "How did you hear about nine turtles?".
type Waiting = (i64, String, Option<String>);
/// A waiting sign-up, with its browser's scrambled secret, if it has one.
type WaitingHere = (i64, String, Option<String>, Option<Vec<u8>>);

/// Follows a sign-up's link with the password chosen at sign-up: makes the
/// account, its address confirmed, and signs this device in. The ticket
/// shows the address is the reader's; the password picks which of the
/// address's waiting sign-ups is theirs (there can be a stranger's too).
/// The password is checked as sign-in checks it: the same bounded line and
/// the same count of wrong tries for the address.
async fn finish_sign_up(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(form): Json<Finish>,
) -> Response {
    let email = match link_email(&state.db, &form.ticket).await {
        Ok(Some(email)) => email,
        Ok(None) => return refused(StatusCode::GONE, "expired"),
        Err(error) => return database_problem("finding a sign-up link", &error),
    };
    // The browser that signed up: its secret picks the waiting sign-up, as
    // the password would, and no password is asked or counted.
    if form.password.is_empty() {
        return match browser::waiting(&state.db, &email, &headers).await {
            Ok(Some(chosen)) => make_from_link(&state, &email, chosen).await,
            Ok(None) => refused(StatusCode::UNAUTHORIZED, "password-needed"),
            Err(error) => database_problem("finding a sign-up link", &error),
        };
    }
    let account = Account::named(Some(&email));
    let wrong = || refused(StatusCode::UNAUTHORIZED, "wrong-password");
    if form.password.len() > crate::password::MAXIMUM_LENGTH {
        return wrong();
    }
    if let Some(wait) = count_try(&state, &account).await {
        return wait_response(wait);
    }
    let waiting = match newest_waiting(&state.db, &email).await {
        Ok(waiting) => waiting,
        Err(error) => return database_problem("finding a sign-up link", &error),
    };
    let mut chosen = None;
    for (id, line, heard_about, _) in waiting {
        match check_password(&state, &account, form.password.clone(), Some(line.clone())).await {
            Some(true) => {
                chosen = Some((id, line, heard_about));
                break;
            }
            Some(false) => {}
            None => return StatusCode::SERVICE_UNAVAILABLE.into_response(),
        }
    }
    let mut limiters = state.limiter.lock().await;
    let Some((id, line, heard_about)) = chosen else {
        if let Some(wait) = limiters.wait(&account, std::time::Instant::now()) {
            return wait_response(wait);
        }
        return wrong();
    };
    limiters.right(&account);
    drop(limiters);
    make_from_link(&state, &email, (id, line, heard_about)).await
}

/// Makes the account a chosen waiting sign-up was for, spending its link,
/// and signs this device in (forgetting the browser's sign-up secret).
async fn make_from_link(
    state: &AppState,
    email: &str,
    (id, line, heard_about): Waiting,
) -> Response {
    let mut transaction = match state.db.begin().await {
        Ok(transaction) => transaction,
        Err(error) => return database_problem("making an account", &error),
    };
    let claimed = sqlx::query("UPDATE email_links SET used = 1 WHERE id = ? AND used = 0")
        .bind(id)
        .execute(&mut *transaction)
        .await;
    match claimed {
        Ok(done) if done.rows_affected() == 1 => {}
        Ok(_) => return refused(StatusCode::GONE, "expired"),
        Err(error) => return database_problem("making an account", &error),
    }
    match finish(&mut transaction, email, &line, heard_about.as_deref()).await {
        Ok(Ok(person)) => match transaction.commit().await {
            Ok(()) => {
                let mut signed_in =
                    signed_in_as(&state.db, person, json!({ "done": "signed-up" })).await;
                signed_in
                    .headers_mut()
                    .append(header::SET_COOKIE, browser::forget());
                signed_in
            }
            Err(error) => database_problem("making an account", &error),
        },
        // The address has an account now: the link stays spent.
        Ok(Err(refusal)) if refusal.status() == StatusCode::CONFLICT => {
            match transaction.commit().await {
                Ok(()) => refusal,
                Err(error) => database_problem("making an account", &error),
            }
        }
        // The hour's accounts are made: nothing is kept (the transaction is
        // dropped, so it's undone), and the same link works later.
        Ok(Err(refusal)) => refusal,
        Err(error) => database_problem("making an account", &error),
    }
}

/// Makes the account a waiting sign-up was for, inside the transaction that
/// spent its link, with its address confirmed. Answers the new reader, or
/// why not: "already" (the address has an account now) or "too-many" (the
/// hour's accounts are made: the caller drops the transaction, so the same
/// link works later).
async fn finish(
    transaction: &mut SqliteConnection,
    email: &str,
    line: &str,
    heard_about: Option<&str>,
) -> Result<Result<i64, Response>, sqlx::Error> {
    let made = make_account(&mut *transaction, email, line, Some(now()), heard_about).await?;
    if made.is_ok() {
        // Any other link waiting for this address can't make a second account,
        // and no copy of an answer is left behind once the account holds it.
        sqlx::query(
            "UPDATE email_links SET used = 1, heard_about = NULL
             WHERE purpose = 'sign-up' AND email = ?",
        )
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
    heard_about: Option<&str>,
) -> Result<Result<i64, Response>, sqlx::Error> {
    let now = now();
    let made: Result<Option<i64>, sqlx::Error> = sqlx::query_scalar(
        "INSERT INTO people (owner, email, password_hash, created_at, email_confirmed_at, heard_about)
         SELECT 0, ?, ?, ?, ?, ?
         WHERE (SELECT COUNT(*) FROM people WHERE owner = 0 AND created_at > ?) < ?
         RETURNING id",
    )
    .bind(email)
    .bind(line)
    .bind(now)
    .bind(confirmed_at)
    .bind(heard_about)
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
