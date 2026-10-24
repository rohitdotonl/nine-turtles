//! Signing in and out, and remembering signed-in devices (SPEC section 1).
//!
//! Each device gets a long random ticket in a cookie the page's scripts can't
//! read. The database keeps only a scrambled copy of it (BLAKE2s), so a
//! stolen copy of the database can't be used to sign in. Wrong passwords are
//! slowed down for everyone at once: there's only one password, so guesses
//! from many places count together. See docs/decisions/0010-sign-in.md.

use std::{
    fmt::Write as _,
    time::{Duration, Instant},
};

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

use crate::{AppState, config::PasswordSetting, log, now};

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

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/session", get(session))
        .route("/api/sign-in", post(sign_in))
        .route("/api/sign-out", post(sign_out))
}

/// Proof that a request comes from a signed-in device. A handler that takes
/// it never runs for anyone else: they get 401 "not signed in".
pub struct SignedIn;

impl FromRequestParts<AppState> for SignedIn {
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Response> {
        let Some(token) = cookie_token(&parts.headers) else {
            return Err(StatusCode::UNAUTHORIZED.into_response());
        };
        let found: Result<Option<i64>, sqlx::Error> =
            sqlx::query_scalar("SELECT id FROM sessions WHERE token_hash = ? AND expires_at > ?")
                .bind(&scramble(&token)[..])
                .bind(now())
                .fetch_optional(&state.db)
                .await;
        match found {
            Ok(Some(_)) => Ok(Self),
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
}

/// Whether this device is signed in, and (if so) the version for Status.
async fn session(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let Some(token) = cookie_token(&headers) else {
        return signed_out();
    };
    let hash = scramble(&token);
    let now = now();

    let found: Result<Option<i64>, sqlx::Error> = sqlx::query_scalar(
        "SELECT last_used_at FROM sessions WHERE token_hash = ? AND expires_at > ?",
    )
    .bind(&hash[..])
    .bind(now)
    .fetch_optional(&state.db)
    .await;
    let last_used = match found {
        Ok(Some(last_used)) => last_used,
        Ok(None) => return signed_out(),
        Err(error) => return database_problem("checking a sign-in", &error),
    };

    let body = Json(json!({ "signed_in": true, "version": crate::VERSION }));
    if now - last_used < RENEW_AFTER {
        return body.into_response();
    }
    // Used again after a day or more: another year from today.
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
    password: String,
}

async fn sign_in(State(state): State<AppState>, Json(form): Json<SignIn>) -> Response {
    let stored = match &state.config.password {
        PasswordSetting::Set(stored) => stored.clone(),
        missing_or_invalid => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({ "error": format!("password-{}", missing_or_invalid.describe()) })),
            )
                .into_response();
        }
    };

    // Held until this try is decided, so tries can't race past the limit.
    let mut limiter = state.limiter.lock().await;
    if let Some(wait) = limiter.wait(Instant::now()) {
        return wait_response(wait);
    }

    let password = form.password;
    let right = tokio::task::spawn_blocking(move || crate::password::matches(&password, &stored))
        .await
        .unwrap_or(false);

    if !right {
        limiter.wrong(Instant::now());
        state
            .wrong_passwords
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        if let Some(wait) = limiter.wait(Instant::now()) {
            // Counted on the diagnostics page, not kept as a "problem", so
            // a patient guesser can't push real problems out of view.
            log::info(&format!(
                "several wrong passwords in a row; sign-in paused for {} seconds",
                wait.as_secs()
            ));
            return wait_response(wait);
        }
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "wrong-password" })),
        )
            .into_response();
    }
    limiter.right();
    drop(limiter);

    let token = match new_token() {
        Ok(token) => token,
        Err(error) => {
            log::problem(&format!("couldn't make a sign-in ticket: {error}"));
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };
    let now = now();
    // Tidy away devices whose year ran out, then remember this one.
    let stored = async {
        sqlx::query("DELETE FROM sessions WHERE expires_at <= ?")
            .bind(now)
            .execute(&state.db)
            .await?;
        sqlx::query(
            "INSERT INTO sessions (token_hash, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?)",
        )
        .bind(&scramble(&token)[..])
        .bind(now)
        .bind(now)
        .bind(now + SESSION_LIFETIME)
        .execute(&state.db)
        .await
    }
    .await;
    match stored {
        Ok(_) => (
            StatusCode::NO_CONTENT,
            [(header::SET_COOKIE, session_cookie(&token))],
        )
            .into_response(),
        Err(error) => database_problem("saving a sign-in", &error),
    }
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

fn signed_out() -> Response {
    Json(json!({ "signed_in": false })).into_response()
}

fn wait_response(wait: Duration) -> Response {
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

fn session_cookie(token: &str) -> HeaderValue {
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
fn new_token() -> Result<String, getrandom::Error> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes)?;
    Ok(bytes
        .iter()
        .fold(String::with_capacity(64), |mut text, byte| {
            let _ = write!(text, "{byte:02x}");
            text
        }))
}

fn scramble(token: &str) -> [u8; 32] {
    Blake2s256::digest(token.as_bytes()).into()
}

#[cfg(test)]
mod tests {
    use super::*;

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
