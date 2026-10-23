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

/// Public: says only that slowfeed is running, and which version. Render
/// checks it to know the app started properly.
async fn status() -> Response {
    (
        [(header::CACHE_CONTROL, "no-store")],
        format!("slowfeed is running\nversion {}\n", crate::VERSION),
    )
        .into_response()
}

/// Needs the read-only key in an `Authorization: Bearer <key>` header (never
/// in the address, where it would end up in logs). Shows how slowfeed is
/// doing, never anything the reader has read or subscribed to.
async fn diagnostics(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let Some(key) = &state.config.diagnostics_key else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let given = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or_default();
    // Comparing scrambled copies takes the same time however much of the key
    // was right, so the key can't be guessed one character at a time.
    if Blake2s256::digest(given.trim().as_bytes()) != Blake2s256::digest(key.as_bytes()) {
        return (
            StatusCode::UNAUTHORIZED,
            [(header::WWW_AUTHENTICATE, "Bearer")],
        )
            .into_response();
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
        })),
    )
        .into_response()
}
