//! The app password other feed readers sign in with (SPEC section 26).
//!
//! Reeder, NetNewsWire and similar apps sync through the Google Reader API
//! (`greader`). They never see the reader's own password: each reader gets an app
//! password that nine turtles makes in Settings, shows once and can turn
//! off at any time. It's 24 random letters and digits, so, like a signed-in
//! device's ticket, the database keeps only a scrambled copy (BLAKE2s), and
//! making a new one signs every app out. See docs/decisions/0070-other-apps.md.

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde_json::json;

use crate::{
    AppState,
    auth::{SignedIn, database_problem, scramble},
    log, now,
};

/// The letters and digits an app password is made of: no 0, 1, i, l or o,
/// which are easy to mistake for one another when typed on a phone.
const ALPHABET: &[u8] = b"abcdefghjkmnpqrstuvwxyz23456789";
/// 24 of them: about 119 bits, far beyond guessing.
const LENGTH: usize = 24;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/apps", get(status))
        .route("/api/apps/password", post(make_password))
        .route("/api/apps/off", post(turn_off))
}

/// Whether an app password exists, and since when.
async fn status(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let made: Result<Option<i64>, sqlx::Error> =
        sqlx::query_scalar("SELECT made_at FROM app_passwords WHERE person_id = ?")
            .bind(person)
            .fetch_optional(&state.db)
            .await;
    match made {
        Ok(made_at) => Json(json!({ "on": made_at.is_some(), "made_at": made_at })).into_response(),
        Err(error) => database_problem("reading the app password", &error),
    }
}

/// Makes a new app password, replacing any earlier one, and shows it this
/// once: only its scrambled copy is kept.
async fn make_password(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let password = match new_password() {
        Ok(password) => password,
        Err(error) => {
            log::problem(&format!("couldn't make an app password: {error}"));
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };
    let saved = sqlx::query(
        "INSERT INTO app_passwords (person_id, password_hash, made_at) VALUES (?, ?, ?)
         ON CONFLICT (person_id) DO UPDATE SET
             password_hash = excluded.password_hash, made_at = excluded.made_at",
    )
    .bind(person)
    .bind(hex(&scramble(&normalize(&password))))
    .bind(now())
    .execute(&state.db)
    .await;
    match saved {
        Ok(_) => (
            // Never kept by the browser or anything between.
            [(header::CACHE_CONTROL, "no-store")],
            Json(json!({ "password": password })),
        )
            .into_response(),
        Err(error) => database_problem("saving the app password", &error),
    }
}

/// Forgets the app password: every app is signed out. Nothing else changes.
async fn turn_off(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let deleted = sqlx::query("DELETE FROM app_passwords WHERE person_id = ?")
        .bind(person)
        .execute(&state.db)
        .await;
    match deleted {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("turning off the app password", &error),
    }
}

/// Whose current app password `password` is (as typed, with or without its
/// dashes): the reader's number, or `None` if it's nobody's.
pub async fn matches(state: &AppState, password: &str) -> Result<Option<i64>, sqlx::Error> {
    let password = normalize(password);
    if password.len() != LENGTH {
        return Ok(None);
    }
    sqlx::query_scalar("SELECT person_id FROM app_passwords WHERE password_hash = ?")
        .bind(hex(&scramble(&password)))
        .fetch_optional(&state.db)
        .await
}

/// The password without the dashes that group it, in small letters, so
/// it's accepted however an app or a person copied it.
pub fn normalize(password: &str) -> String {
    password
        .chars()
        .filter(|character| !matches!(character, '-' | ' '))
        .flat_map(char::to_lowercase)
        .collect()
}

/// A new app password, in groups of four for reading and typing:
/// `abcd-efgh-jkmn-pqrs-tuvw-xyz2`.
fn new_password() -> Result<String, getrandom::Error> {
    let mut letters = Vec::with_capacity(LENGTH);
    while letters.len() < LENGTH {
        let mut bytes = [0u8; 32];
        getrandom::fill(&mut bytes)?;
        // 248 is the largest multiple of 31 under 256: bytes at or above it
        // are skipped, so every letter is equally likely.
        let limit = u8::try_from(256 / ALPHABET.len() * ALPHABET.len()).unwrap_or(u8::MAX);
        letters.extend(
            bytes
                .iter()
                .filter(|byte| **byte < limit)
                .map(|byte| ALPHABET[usize::from(*byte) % ALPHABET.len()]),
        );
    }
    letters.truncate(LENGTH);
    Ok(letters
        .chunks(4)
        .map(|group| String::from_utf8_lossy(group).into_owned())
        .collect::<Vec<_>>()
        .join("-"))
}

fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write as _;
    bytes.iter().fold(String::new(), |mut text, byte| {
        let _ = write!(text, "{byte:02x}");
        text
    })
}

/// The app password an app sends with each request, if any: Google Reader
/// API apps send `Authorization: GoogleLogin auth=…`, a few send `Bearer …`.
pub fn from_headers(headers: &HeaderMap) -> Option<String> {
    let value = headers.get(header::AUTHORIZATION)?.to_str().ok()?.trim();
    let token = value
        .strip_prefix("GoogleLogin auth=")
        .or_else(|| value.strip_prefix("GoogleLogin  auth="))
        .or_else(|| value.strip_prefix("Bearer "))?;
    Some(token.trim().to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_passwords_are_long_random_grouped_and_unambiguous() {
        let first = new_password().unwrap();
        assert_eq!(first.len(), LENGTH + LENGTH / 4 - 1);
        assert_eq!(first.split('-').count(), LENGTH / 4);
        assert!(
            normalize(&first)
                .bytes()
                .all(|byte| ALPHABET.contains(&byte))
        );
        assert_ne!(first, new_password().unwrap());
    }

    #[test]
    fn dashes_spaces_and_capitals_dont_matter() {
        assert_eq!(normalize("ABCD-efgh jkmn"), "abcdefghjkmn");
    }

    #[test]
    fn the_password_is_read_from_either_kind_of_header() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            "GoogleLogin auth=abcd".parse().unwrap(),
        );
        assert_eq!(from_headers(&headers).as_deref(), Some("abcd"));
        headers.insert(header::AUTHORIZATION, "Bearer efgh".parse().unwrap());
        assert_eq!(from_headers(&headers).as_deref(), Some("efgh"));
        headers.insert(header::AUTHORIZATION, "Basic xyz".parse().unwrap());
        assert_eq!(from_headers(&headers), None);
    }
}
