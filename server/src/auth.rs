//! Signing in and out, and remembering signed-in devices (SPEC section 1).
//!
//! Each device gets a long random ticket in a cookie the page's scripts can't
//! read. The database keeps only a scrambled copy of it (BLAKE2s), so a
//! stolen copy of the database can't be used to sign in. Wrong passwords are
//! slowed down for each account on its own, wherever the guesses come from:
//! each email address. See docs/decisions/0010-sign-in.md,
//! 0087-sign-in-by-email.md and 0116-email-for-everyone.md.
//!
//! Each signed-in device belongs to one reader (decision 0086). Every reader,
//! the owner too, signs in with their email address and password (decision
//! 0116); the password alone no longer signs anyone in.

use std::{
    collections::HashMap,
    fmt::Write as _,
    sync::OnceLock,
    time::{Duration, Instant},
};

use tokio::sync::Semaphore;

use axum::{
    Json, Router,
    extract::{FromRequestParts, State},
    http::{HeaderMap, HeaderValue, StatusCode, header, request::Parts},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use blake2::{Blake2s256, Digest};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;

use crate::{AppState, config::PasswordSetting, log, now};

/// The owner's number in `people`: the one reader whose password is the one
/// set as NINE_TURTLES_PASSWORD_HASH (until they choose their own).
pub const OWNER: i64 = 1;

const COOKIE: &str = "nine_turtles_session";
/// The cookie's name before the rename: still accepted, so nobody is signed out by it.
const OLD_COOKIE: &str = "slowfeed_session";
/// A device stays signed in for a year after it was last used.
const SESSION_LIFETIME: i64 = 365 * 24 * 60 * 60;
/// How often a device's year is renewed. Daily is plenty, and keeps the
/// database from being written on every page load.
const RENEW_AFTER: i64 = 24 * 60 * 60;

/// Wrong passwords allowed in a row before nine turtles makes you wait.
const FREE_TRIES: u32 = 5;
const FIRST_WAIT: Duration = Duration::from_secs(60);
const LONGEST_WAIT: Duration = Duration::from_secs(60 * 60);
/// After this long with no wrong password (counted from the end of any
/// wait), earlier wrong tries are forgotten and the five free tries return.
const FORGET_AFTER: Duration = Duration::from_secs(60 * 60);
/// At most this many accounts' wrong tries are remembered at once, so a
/// stranger typing made-up email addresses can't fill the server's memory.
/// When it's full, what would be forgotten anyway goes first, then the
/// account quiet the longest; one that has to wait goes only if all do.
pub const MOST_ACCOUNTS_REMEMBERED: usize = 4096;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/session", get(session))
        .route("/api/sign-in", post(sign_in))
        .route("/api/sign-out", post(sign_out))
}

/// Proof that a request comes from a signed-in device, and whose it is: the
/// reader's number in `people`. A handler that takes it never runs for anyone
/// else: they get 401 "not signed in". Everything a handler reads or changes
/// for the reader is limited to this number (decision 0086).
#[derive(Clone, Copy, Debug)]
pub struct SignedIn(pub i64);

impl FromRequestParts<AppState> for SignedIn {
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Response> {
        let Some(token) = cookie_token(&parts.headers) else {
            return Err(StatusCode::UNAUTHORIZED.into_response());
        };
        let found: Result<Option<i64>, sqlx::Error> = sqlx::query_scalar(
            "SELECT person_id FROM sessions WHERE token_hash = ? AND expires_at > ?",
        )
        .bind(&scramble(&token)[..])
        .bind(now())
        .fetch_optional(&state.db)
        .await;
        match found {
            Ok(Some(person)) => Ok(Self(person)),
            Ok(None) => Err(StatusCode::UNAUTHORIZED.into_response()),
            Err(error) => Err(database_problem("checking a sign-in", &error)),
        }
    }
}

/// Counts wrong passwords in a row and decides how long to wait.
#[derive(Debug, Default)]
pub struct Limiter {
    wrong_in_a_row: u32,
    last_wrong: Option<Instant>,
    locked_until: Option<Instant>,
}

impl Limiter {
    /// How long until the next try is allowed, if one has to wait.
    pub fn wait(&self, now: Instant) -> Option<Duration> {
        self.locked_until
            .and_then(|until| until.checked_duration_since(now))
            .filter(|wait| !wait.is_zero())
    }

    /// After the free tries, each wrong password doubles the wait: one
    /// minute, two, four… up to an hour.
    pub fn wrong(&mut self, now: Instant) {
        let quiet_since = self.last_wrong.max(self.locked_until);
        if quiet_since.is_some_and(|since| now.saturating_duration_since(since) >= FORGET_AFTER) {
            *self = Self::default();
        }
        self.last_wrong = Some(now);
        self.wrong_in_a_row = self.wrong_in_a_row.saturating_add(1);
        if self.wrong_in_a_row >= FREE_TRIES {
            let doublings = (self.wrong_in_a_row - FREE_TRIES).min(10);
            let wait = FIRST_WAIT.saturating_mul(1 << doublings).min(LONGEST_WAIT);
            self.locked_until = Some(now + wait);
        }
    }

    pub fn right(&mut self) {
        *self = Self::default();
    }

    /// When this account last had a wrong try or a wait ended.
    fn quiet_since(&self) -> Option<Instant> {
        self.last_wrong.max(self.locked_until)
    }

    /// Whether everything about this account would be forgotten anyway.
    fn forgotten(&self, now: Instant) -> bool {
        self.quiet_since()
            .is_none_or(|since| now.saturating_duration_since(since) >= FORGET_AFTER)
    }
}

/// Whose wrong tries a sign-in counts towards.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum Account {
    /// The owner while they have no email yet, when they confirm their
    /// password in Settings (their email, or a passkey).
    Owner,
    /// An email address, in small letters, whether or not anyone has it,
    /// the owner's own email too (so it can't be told apart from others).
    Email(String),
}

impl Account {
    /// The account an email names before anything is looked up: the email
    /// address in small letters, as the database compares them, or the
    /// owner (with no email yet) if none.
    pub fn named(email: Option<&str>) -> Self {
        match email.map(str::trim).filter(|email| !email.is_empty()) {
            Some(email) => Self::Email(email.to_ascii_lowercase()),
            None => Self::Owner,
        }
    }
}

/// How many password checks (argon2, about 19 MB each) may run at once, so
/// a flood of sign-in tries can't use up the server's memory. An owner with
/// no email yet confirming their password in Settings has a place of their
/// own: guesses at emails never queue in front of it. Every sign-in, the
/// owner's too, waits on the shared line, so its timing gives nothing away.
#[derive(Debug)]
pub struct PasswordChecks {
    /// The owner's checks while they have no email, one at a time.
    pub owner: Semaphore,
    /// Every sign-in by email, the owner's email and emails nobody has too.
    pub others: Semaphore,
}

/// Password checks at once for everyone but the owner.
pub const OTHERS_CHECKS_AT_ONCE: usize = 2;

impl Default for PasswordChecks {
    fn default() -> Self {
        Self {
            owner: Semaphore::new(1),
            others: Semaphore::new(OTHERS_CHECKS_AT_ONCE),
        }
    }
}

impl PasswordChecks {
    /// Where a check of `account`'s password waits its turn.
    pub(crate) fn line_for(&self, account: &Account) -> &Semaphore {
        match account {
            Account::Owner => &self.owner,
            Account::Email(_) => &self.others,
        }
    }
}

/// Wrong tries for each account separately, so a stranger guessing one
/// email address never makes anyone else wait. Only accounts with wrong
/// tries are remembered, and at most `MOST_ACCOUNTS_REMEMBERED` of them.
#[derive(Debug, Default)]
pub struct Limiters {
    accounts: HashMap<Account, Limiter>,
}

impl Limiters {
    pub fn wait(&self, account: &Account, now: Instant) -> Option<Duration> {
        self.accounts
            .get(account)
            .and_then(|limiter| limiter.wait(now))
    }

    pub fn wrong(&mut self, account: Account, now: Instant) {
        if !self.accounts.contains_key(&account) && self.accounts.len() >= MOST_ACCOUNTS_REMEMBERED
        {
            self.make_room(now);
        }
        self.accounts.entry(account).or_default().wrong(now);
    }

    pub fn right(&mut self, account: &Account) {
        self.accounts.remove(account);
    }

    /// How many accounts' wrong tries are remembered.
    pub fn remembered(&self) -> usize {
        self.accounts.len()
    }

    fn make_room(&mut self, now: Instant) {
        self.accounts.retain(|_, limiter| !limiter.forgotten(now));
        if self.accounts.len() < MOST_ACCOUNTS_REMEMBERED {
            return;
        }
        let oldest = self
            .accounts
            .iter()
            .min_by_key(|(_, limiter)| (limiter.wait(now).is_some(), limiter.quiet_since()))
            .map(|(account, _)| account.clone());
        if let Some(oldest) = oldest {
            self.accounts.remove(&oldest);
        }
    }
}

/// A scrambled line no password was ever chosen for. A sign-in with an
/// email nobody has is checked against it, so it takes as long as a real
/// one and the time taken doesn't tell a stranger which emails exist.
fn nobodys_password() -> &'static str {
    static LINE: OnceLock<String> = OnceLock::new();
    LINE.get_or_init(|| crate::password::hash("nobody chose this password").unwrap_or_default())
}

/// Whether this device is signed in, and (if so) the version for Status.
async fn session(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let Some(token) = cookie_token(&headers) else {
        return signed_out(&state).await;
    };
    let hash = scramble(&token);
    let now = now();

    // Whose device, when it was last used, owner or not, and their email.
    type Found = (i64, i64, bool, Option<String>);
    let found: Result<Option<Found>, sqlx::Error> = sqlx::query_as(
        "SELECT sessions.person_id, sessions.last_used_at, people.owner, people.email
         FROM sessions JOIN people ON people.id = sessions.person_id
         WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
    )
    .bind(&hash[..])
    .bind(now)
    .fetch_optional(&state.db)
    .await;
    let (person, last_used, owner, email) = match found {
        Ok(Some(found)) => found,
        Ok(None) => return signed_out(&state).await,
        Err(error) => return database_problem("checking a sign-in", &error),
    };

    // Whether this is the owner (who alone sees Settings › Readers), the
    // email they sign in with, if they have one, and whether nine turtles can
    // send email (to change that email, decision 0088).
    let body = Json(json!({
        "signed_in": true,
        "version": crate::VERSION,
        "owner": owner,
        "email": email,
        "email_sending": state.mailer.is_some(),
        "passkeys": state.passkeys.origin(),
    }));
    if now - last_used < RENEW_AFTER {
        return body.into_response();
    }
    // Used again after a day or more: another year from today, and the
    // reader is noted as here (`admin::here`).
    crate::admin::note_here(&state.db, person).await;
    let renewed =
        sqlx::query("UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE token_hash = ?")
            .bind(now)
            .bind(now + SESSION_LIFETIME)
            .bind(&hash[..])
            .execute(&state.db)
            .await;
    match renewed {
        Ok(_) => ([(header::SET_COOKIE, session_cookie(&token))], body).into_response(),
        Err(error) => database_problem("renewing a sign-in", &error),
    }
}

#[derive(Deserialize)]
struct SignIn {
    #[serde(default)]
    email: String,
    password: String,
}

/// Signs this device in with an email address and password, for the reader
/// who has that email, the owner too (decision 0116). A wrong password and
/// an email nobody has get the same answer, in about the same time.
///
/// On a brand-new nine turtles the owner has no email yet. Then the first
/// sign-in with an email nobody has and the owner's password (the one set
/// as NINE_TURTLES_PASSWORD_HASH) signs in as the owner and saves that email
/// as theirs, so from then on they sign in with it like everyone else.
async fn sign_in(State(state): State<AppState>, Json(form): Json<SignIn>) -> Response {
    let owners_line = match &state.config.password {
        PasswordSetting::Set(stored) => Some(stored.clone()),
        _ => None,
    };
    let email = form.email.trim().to_owned();
    if email.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "email-needed" })),
        )
            .into_response();
    }

    // A password this long can never match, so it's refused at once, before
    // it's counted or waits for a check, with the same answer as any wrong
    // password (whatever the email, so it tells nothing).
    if form.password.len() > crate::password::MAXIMUM_LENGTH {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "wrong-password" })),
        )
            .into_response();
    }

    // Whose sign-in this would be, and the scrambled line to check against.
    // Every sign-in is counted under its email and checked on the shared
    // line whoever has it, the owner too, so neither the answer nor the time
    // taken tells a stranger which email is the owner's.
    let account = Account::named(Some(&email));
    let found: Result<Option<(i64, bool, Option<String>)>, sqlx::Error> = sqlx::query_as(
        "SELECT id, owner, password_hash FROM people WHERE email = ? COLLATE NOCASE",
    )
    .bind(&email)
    .fetch_optional(&state.db)
    .await;
    let (person, stored, claims_owner) = match found {
        // The owner uses NINE_TURTLES_PASSWORD_HASH unless they have a
        // password of their own (set by a password link, decision 0088).
        Ok(Some((person, owner, own_line))) => {
            let stored = if owner {
                own_line.or(owners_line)
            } else {
                own_line
            };
            (Some(person), stored, false)
        }
        // Nobody has this email. If the owner has none yet, it may be theirs.
        Ok(None) => match owner_without_email(&state.db).await {
            Ok(Some(own_line)) => {
                if own_line.is_none() && owners_line.is_none() {
                    return (
                        StatusCode::SERVICE_UNAVAILABLE,
                        Json(json!({
                            "error": format!("password-{}", state.config.password.describe())
                        })),
                    )
                        .into_response();
                }
                (Some(OWNER), own_line.or(owners_line), true)
            }
            Ok(None) => (None, None, false),
            Err(error) => return database_problem("finding the owner", &error),
        },
        Err(error) => return database_problem("finding a reader", &error),
    };

    // The lock is held only to check and record the count, never during the
    // password check, so one account's guesses never hold up anyone else.
    // The try counts as wrong from the start (and is forgotten if it turns
    // out right), so tries sent together can't race past the limit.
    {
        let mut limiters = state.limiter.lock().await;
        if let Some(wait) = limiters.wait(&account, Instant::now()) {
            return wait_response(wait);
        }
        limiters.wrong(account.clone(), Instant::now());
    }

    let someones = stored.is_some();
    let line = stored.clone();
    let matched = {
        // Only closed if the app is stopping.
        let Ok(_turn) = state.password_checks.line_for(&account).acquire().await else {
            return StatusCode::SERVICE_UNAVAILABLE.into_response();
        };
        let password = form.password;
        tokio::task::spawn_blocking(move || {
            let stored = line.unwrap_or_else(|| nobodys_password().to_owned());
            crate::password::matches(&password, &stored)
        })
        .await
        .unwrap_or(false)
    };

    let mut limiters = state.limiter.lock().await;
    let Some(person) = person.filter(|_| someones && matched) else {
        state
            .wrong_passwords
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        if let Some(wait) = limiters.wait(&account, Instant::now()) {
            // Counted on the diagnostics page, not kept as a "problem", so
            // a patient guesser can't push real problems out of view.
            log::info(&format!(
                "several wrong passwords in a row for one account; \
                 its sign-in is paused for {} seconds",
                wait.as_secs()
            ));
            return wait_response(wait);
        }
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "wrong-password" })),
        )
            .into_response();
    };
    limiters.right(&account);
    drop(limiters);

    if claims_owner {
        let saved = sqlx::query("UPDATE people SET email = ? WHERE id = ? AND email IS NULL")
            .bind(&email)
            .bind(OWNER)
            .execute(&state.db)
            .await;
        match saved {
            Ok(_) => log::info("the owner signed in for the first time and saved their email"),
            // Someone signed up with this email a moment ago: it's theirs.
            Err(error) if crate::people::is_taken(&error) => {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(json!({ "error": "wrong-password" })),
                )
                    .into_response();
            }
            Err(error) => return database_problem("saving the owner's email", &error),
        }
    }

    match remember_device(&state.db, person).await {
        Ok(Some(token)) => (
            StatusCode::NO_CONTENT,
            [(header::SET_COOKIE, session_cookie(&token))],
        )
            .into_response(),
        Ok(None) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        Err(error) => database_problem("saving a sign-in", &error),
    }
}

/// Sign-in's count, for the other places a password is checked
/// (`accounts.rs`): checks the count for `account` and, unless it has to
/// wait, records this try as wrong before any password is checked (forgotten with
/// `Limiters::right` if it turns out right), so tries sent together can't
/// race past the limit. The lock is held only for this. Answers how long to
/// wait, if this try has to.
pub(crate) async fn count_try(state: &AppState, account: &Account) -> Option<Duration> {
    let mut limiters = state.limiter.lock().await;
    if let Some(wait) = limiters.wait(account, Instant::now()) {
        return Some(wait);
    }
    limiters.wrong(account.clone(), Instant::now());
    None
}

/// Checks `password` against `stored` (or, with none, a line nobody chose,
/// so it takes as long), waiting its turn in `account`'s line of the
/// bounded password checks. `None` only if the app is stopping.
pub(crate) async fn check_password(
    state: &AppState,
    account: &Account,
    password: String,
    stored: Option<String>,
) -> Option<bool> {
    let _turn = state
        .password_checks
        .line_for(account)
        .acquire()
        .await
        .ok()?;
    let matched = tokio::task::spawn_blocking(move || {
        let stored = stored.unwrap_or_else(|| nobodys_password().to_owned());
        crate::password::matches(&password, &stored)
    })
    .await
    .unwrap_or(false);
    Some(matched)
}

/// Asks for `account`'s password before a change that could hand the
/// account to someone else (a new email: decision 0088), checked as
/// sign-in checks it: a password too long to match refused at once, the
/// same count of wrong tries (`count_try`), and the same bounded line
/// (`check_password`), against `stored` or, with none, a line nobody chose.
/// Answers the refusal to send back if the password isn't the one, or none.
pub(crate) async fn ask_password(
    state: &AppState,
    account: &Account,
    password: String,
    stored: Option<String>,
) -> Option<Response> {
    let wrong = || {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "wrong-password" })),
        )
            .into_response()
    };
    if password.len() > crate::password::MAXIMUM_LENGTH {
        return Some(wrong());
    }
    if let Some(wait) = count_try(state, account).await {
        return Some(wait_response(wait));
    }
    let someones = stored.is_some();
    let Some(matched) = check_password(state, account, password, stored).await else {
        return Some(StatusCode::SERVICE_UNAVAILABLE.into_response());
    };
    let mut limiters = state.limiter.lock().await;
    if !(someones && matched) {
        if let Some(wait) = limiters.wait(account, Instant::now()) {
            return Some(wait_response(wait));
        }
        return Some(wrong());
    }
    limiters.right(account);
    None
}

/// While the owner has no email yet (a brand-new nine turtles), their own
/// scrambled password if they have one (`Some(None)` if not); `None` once
/// they have an email.
async fn owner_without_email(db: &SqlitePool) -> Result<Option<Option<String>>, sqlx::Error> {
    sqlx::query_scalar("SELECT password_hash FROM people WHERE id = ? AND email IS NULL")
        .bind(OWNER)
        .fetch_optional(db)
        .await
}

/// Where `settings` keeps a fingerprint (BLAKE2s) of the
/// NINE_TURTLES_PASSWORD_HASH in force when the owner last set a password
/// of their own with an emailed link.
pub const OWNER_PASSWORD_FROM: &str = "owner_password_from";

/// The fingerprint of NINE_TURTLES_PASSWORD_HASH kept in
/// `OWNER_PASSWORD_FROM`: never the line itself.
pub(crate) fn setting_fingerprint(setting: &PasswordSetting) -> String {
    match setting {
        PasswordSetting::Set(line) => crate::people::hex(&scramble(line)),
        PasswordSetting::Missing | PasswordSetting::Invalid => "none".to_owned(),
    }
}

/// The owner's way back that needs no email (decision 0088): a password the
/// owner set with an emailed link replaces NINE_TURTLES_PASSWORD_HASH only
/// while that setting stays the one in force when they set it. Once the
/// owner (on the host) puts a new line in NINE_TURTLES_PASSWORD_HASH, it
/// wins again: on start, their own password is forgotten and every device
/// signed in as them is signed out, as a new password does. A setting
/// that's missing or not a real line changes nothing, so nobody is locked
/// out by a slip. Answers whether the owner's own password was forgotten.
pub async fn owner_password_follows_setting(
    db: &SqlitePool,
    setting: &PasswordSetting,
) -> Result<bool, sqlx::Error> {
    if !matches!(setting, PasswordSetting::Set(_)) {
        return Ok(false);
    }
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let own: Option<Option<String>> =
        sqlx::query_scalar("SELECT password_hash FROM people WHERE id = ?")
            .bind(OWNER)
            .fetch_optional(&mut *transaction)
            .await?;
    if own.flatten().is_none() {
        return Ok(false);
    }
    let from: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE name = ?")
        .bind(OWNER_PASSWORD_FROM)
        .fetch_optional(&mut *transaction)
        .await?;
    if from.as_deref() == Some(setting_fingerprint(setting).as_str()) {
        return Ok(false);
    }
    sqlx::query("UPDATE people SET password_hash = NULL WHERE id = ?")
        .bind(OWNER)
        .execute(&mut *transaction)
        .await?;
    sqlx::query("DELETE FROM settings WHERE name = ?")
        .bind(OWNER_PASSWORD_FROM)
        .execute(&mut *transaction)
        .await?;
    sqlx::query("DELETE FROM sessions WHERE person_id = ?")
        .bind(OWNER)
        .execute(&mut *transaction)
        .await?;
    // A password link or sign-in link sent before stops working too, so
    // nobody who reached the owner's email can come back in with it.
    sqlx::query(
        "UPDATE email_links SET used = 1
         WHERE person_id = ? AND purpose IN ('reset', 'sign-in')",
    )
    .bind(OWNER)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    log::info(
        "NINE_TURTLES_PASSWORD_HASH has changed, so it's the owner's password again; \
         the one set by email is forgotten and the owner's devices are signed out",
    );
    Ok(true)
}

/// Signs a new device in for reader `person`: answers the ticket for its
/// cookie, or `None` if no random ticket could be made (said in the log).
/// Devices whose year ran out are tidied away first.
pub async fn remember_device(db: &SqlitePool, person: i64) -> Result<Option<String>, sqlx::Error> {
    let token = match new_token() {
        Ok(token) => token,
        Err(error) => {
            log::problem(&format!("couldn't make a sign-in ticket: {error}"));
            return Ok(None);
        }
    };
    // Noted before this device's sign-in counts as being here, so a reader
    // back after a long time finds their feeds checked (`admin::here`).
    crate::admin::note_here(db, person).await;
    let now = now();
    sqlx::query("DELETE FROM sessions WHERE expires_at <= ?")
        .bind(now)
        .execute(db)
        .await?;
    sqlx::query(
        "INSERT INTO sessions (person_id, token_hash, created_at, last_used_at, expires_at)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(person)
    .bind(&scramble(&token)[..])
    .bind(now)
    .bind(now)
    .bind(now + SESSION_LIFETIME)
    .execute(db)
    .await?;
    Ok(Some(token))
}

/// Signs out this device only. Other devices stay signed in.
async fn sign_out(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some(token) = cookie_token(&headers) {
        let deleted = sqlx::query("DELETE FROM sessions WHERE token_hash = ?")
            .bind(&scramble(&token)[..])
            .execute(&state.db)
            .await;
        if let Err(error) = deleted {
            return database_problem("signing out", &error);
        }
    }
    (
        StatusCode::NO_CONTENT,
        [(
            header::SET_COOKIE,
            HeaderValue::from_static(
                "nine_turtles_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict",
            ),
        )],
    )
        .into_response()
}

pub async fn signed_in_devices(state: &AppState) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT COUNT(*) FROM sessions WHERE expires_at > ?")
        .bind(now())
        .fetch_one(&state.db)
        .await
}

/// Not signed in: and whether the sign-in page may offer "Forgot your
/// password?" (nine turtles can send email). "Sign up" is always offered.
async fn signed_out(state: &AppState) -> Response {
    Json(json!({
        "signed_in": false,
        "email_sending": state.mailer.is_some(),
        "passkeys": state.passkeys.origin(),
    }))
    .into_response()
}

pub(crate) fn wait_response(wait: Duration) -> Response {
    // Rounded up, so "try again in a minute" never comes a second early.
    let seconds = (wait.as_secs() + u64::from(wait.subsec_nanos() > 0)).max(1);
    (
        StatusCode::TOO_MANY_REQUESTS,
        [(header::RETRY_AFTER, seconds.to_string())],
        Json(json!({ "error": "wait", "wait_seconds": seconds })),
    )
        .into_response()
}

pub fn database_problem(doing: &str, error: &sqlx::Error) -> Response {
    log::problem(&format!("database error while {doing}: {error}"));
    StatusCode::INTERNAL_SERVER_ERROR.into_response()
}

pub(crate) fn session_cookie(token: &str) -> HeaderValue {
    let cookie = format!(
        "{COOKIE}={token}; Path=/; Max-Age={SESSION_LIFETIME}; HttpOnly; Secure; SameSite=Strict"
    );
    HeaderValue::from_str(&cookie).unwrap_or_else(|_| HeaderValue::from_static(""))
}

fn cookie_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(name, _)| *name == COOKIE || *name == OLD_COOKIE)
        .map(|(_, value)| value.to_owned())
        .filter(|value| value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit()))
}

/// 32 random bytes from the operating system, written as 64 hex characters.
pub(crate) fn new_token() -> Result<String, getrandom::Error> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes)?;
    Ok(bytes
        .iter()
        .fold(String::with_capacity(64), |mut text, byte| {
            let _ = write!(text, "{byte:02x}");
            text
        }))
}

pub(crate) fn scramble(token: &str) -> [u8; 32] {
    Blake2s256::digest(token.as_bytes()).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_account_counts_its_own_wrong_tries() {
        let start = Instant::now();
        let mut limiters = Limiters::default();
        let stranger = Account::named(Some("Someone@Example.com"));
        assert_eq!(stranger, Account::named(Some("  someone@example.com ")));
        for _ in 0..5 {
            limiters.wrong(stranger.clone(), start);
        }
        assert!(limiters.wait(&stranger, start).is_some());
        assert_eq!(limiters.wait(&Account::Owner, start), None);
        assert_eq!(Account::named(Some("  ")), Account::Owner);

        limiters.right(&stranger);
        assert_eq!(limiters.wait(&stranger, start), None);
        assert_eq!(limiters.remembered(), 0);
    }

    #[test]
    fn only_so_many_accounts_are_remembered_and_waiting_ones_are_kept() {
        let start = Instant::now();
        let mut limiters = Limiters::default();
        for _ in 0..5 {
            limiters.wrong(Account::Owner, start);
        }
        for number in 0..MOST_ACCOUNTS_REMEMBERED + 100 {
            limiters.wrong(Account::Email(format!("{number}@example.com")), start);
        }
        assert_eq!(limiters.remembered(), MOST_ACCOUNTS_REMEMBERED);
        // The one account that has to wait is never the one forgotten.
        assert!(limiters.wait(&Account::Owner, start).is_some());

        // An hour later, everything quiet is forgotten to make room.
        let later = start + FORGET_AFTER + LONGEST_WAIT;
        limiters.wrong(Account::Email("new@example.com".to_owned()), later);
        assert_eq!(limiters.remembered(), 1);
    }

    #[test]
    fn five_wrong_tries_are_free_then_the_wait_doubles_up_to_an_hour() {
        let start = Instant::now();
        let mut limiter = Limiter::default();
        for _ in 0..4 {
            limiter.wrong(start);
            assert_eq!(limiter.wait(start), None);
        }
        let expected = [1, 2, 4, 8, 16, 32, 60, 60, 60];
        for minutes in expected {
            limiter.wrong(start);
            assert_eq!(limiter.wait(start), Some(Duration::from_secs(minutes * 60)));
        }
    }

    #[test]
    fn the_wait_runs_out_and_the_right_password_resets_the_count() {
        let start = Instant::now();
        let mut limiter = Limiter::default();
        for _ in 0..5 {
            limiter.wrong(start);
        }
        assert!(limiter.wait(start + Duration::from_secs(59)).is_some());
        assert_eq!(limiter.wait(start + Duration::from_secs(60)), None);

        limiter.right();
        limiter.wrong(start);
        assert_eq!(limiter.wait(start), None);
    }

    #[test]
    fn an_hour_without_wrong_passwords_brings_back_the_free_tries() {
        let start = Instant::now();
        let mut limiter = Limiter::default();
        for _ in 0..4 {
            limiter.wrong(start);
        }
        // Long after those four, one typo doesn't make the owner wait.
        let later = start + Duration::from_secs(61 * 60);
        limiter.wrong(later);
        assert_eq!(limiter.wait(later), None);

        // After a wait, the quiet hour counts from when the wait ended.
        for _ in 0..4 {
            limiter.wrong(later);
        }
        assert_eq!(limiter.wait(later), Some(Duration::from_secs(60)));
        let just_before = later + Duration::from_secs(60 + 59 * 60);
        limiter.wrong(just_before);
        assert!(limiter.wait(just_before).is_some());
        let quiet = just_before + Duration::from_secs(2 * 60 + 60 * 60);
        limiter.wrong(quiet);
        assert_eq!(limiter.wait(quiet), None);
    }

    #[test]
    fn tickets_are_long_random_and_different() {
        let first = new_token().unwrap();
        assert_eq!(first.len(), 64);
        assert_ne!(first, new_token().unwrap());
    }

    #[test]
    fn only_a_well_formed_ticket_is_read_from_the_cookie() {
        let token = "ab".repeat(32);
        let mut headers = HeaderMap::new();
        headers.insert(
            header::COOKIE,
            HeaderValue::from_str(&format!("theme=dark; nine_turtles_session={token}")).unwrap(),
        );
        assert_eq!(cookie_token(&headers), Some(token));

        headers.insert(
            header::COOKIE,
            HeaderValue::from_static("nine_turtles_session=short"),
        );
        assert_eq!(cookie_token(&headers), None);
    }
}
