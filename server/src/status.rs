//! The public status page and the key-protected diagnostics page, which the
//! host and the daily check (docs/operations/daily-check.md) look at.

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
    routing::get,
};
use blake2::{Blake2s256, Digest};
use serde_json::json;

use crate::{AppState, auth, checking, db, log, now};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/status", get(status))
        .route("/diagnostics", get(diagnostics))
}

/// Public: says only that nine turtles is running, and which version. Render
/// checks it to know the app started properly.
async fn status() -> Response {
    (
        [(header::CACHE_CONTROL, "no-store")],
        format!("nine turtles is running\nversion {}\n", crate::VERSION),
    )
        .into_response()
}

/// The answer to give unless the request shows `key` in an `Authorization:
/// Bearer <key>` header (never in the address, where it would end up in
/// logs): "not found" when the key isn't set, as if the page didn't exist,
/// otherwise "unauthorized". None when the key is right. Used by the
/// diagnostics page and the owner report (`owner_report`).
pub(crate) fn key_refused(headers: &HeaderMap, key: Option<&str>) -> Option<Response> {
    let Some(key) = key else {
        return Some(StatusCode::NOT_FOUND.into_response());
    };
    let given = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or_default();
    // Comparing scrambled copies takes the same time however much of the key
    // was right, so the key can't be guessed one character at a time.
    if Blake2s256::digest(given.trim().as_bytes()) != Blake2s256::digest(key.as_bytes()) {
        return Some(
            (
                StatusCode::UNAUTHORIZED,
                [(header::WWW_AUTHENTICATE, "Bearer")],
            )
                .into_response(),
        );
    }
    None
}

/// Needs the read-only diagnostics key (`key_refused`). Shows how nine turtles
/// is doing, never anything the reader has read or subscribed to.
async fn diagnostics(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some(refused) = key_refused(&headers, state.config.diagnostics_key.as_deref()) {
        return refused;
    }

    let devices = match auth::signed_in_devices(&state).await {
        Ok(count) => json!(count),
        Err(error) => {
            log::problem(&format!(
                "the diagnostics page couldn't read the database: {error}"
            ));
            json!(null)
        }
    };
    let feeds = match checking::health(&state.db, now()).await {
        Ok(health) => json!(health),
        Err(error) => {
            log::problem(&format!(
                "the diagnostics page couldn't count the feeds: {error}"
            ));
            json!(null)
        }
    };
    let last_round = state.last_round.load(std::sync::atomic::Ordering::Relaxed);
    let latest_backup = state
        .latest_backup
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone();
    (
        [(header::CACHE_CONTROL, "no-store")],
        Json(json!({
            "version": crate::VERSION,
            "started_at": state.started_at,
            "uptime_seconds": now() - state.started_at,
            "password_setting": state.config.password.describe(),
            "database_bytes": db::size_in_bytes(&state.config.data_dir),
            "signed_in_devices": devices,
            "wrong_passwords_since_start": state.wrong_passwords.load(std::sync::atomic::Ordering::Relaxed),
            "recent_problems": log::recent_problems(),
            // Counts only, never which feeds (the reader's subscriptions are theirs).
            "feeds": feeds,
            "background_checks_last_round_at": (last_round > 0).then_some(last_round),
            // Whether backups are on, and the newest nightly copy, such as
            // "nightly/2026-10-25.sqlite" (null until the first is stored).
            "backups": {
                "on": state.storage.is_some(),
                "latest_nightly": latest_backup,
            },
            // Whether newsletter emails are accepted (decision 0091).
            "newsletters": {
                "on": state.config.newsletter_secret.is_some(),
            },
        })),
    )
        .into_response()
}
