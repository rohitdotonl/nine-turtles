//! Where newsletter emails arrive (SPEC section 28, decision 0091).
//!
//! nine turtles can't receive email itself. A mail service (Cloudflare Email
//! Routing, with the small forwarder in `cloudflare/newsletter-worker/`)
//! receives it and posts each email, whole and unchanged, to
//! `/newsletters/incoming`, with the shared secret
//! `NINE_TURTLES_NEWSLETTER_SECRET` as its key. Any other mail service that
//! can post an email to a web address works the same way.
//!
//! **Off by default:** without the secret, the address answers "not found",
//! as if it didn't exist.
//!
//! **Not kept yet (part one):** with the secret set, each email is read and
//! cleaned exactly as it will be stored (`newsletter::parse`), and the answer
//! says what it would become, but nothing is stored: giving each reader
//! their own address waits for many readers to be finished. The answer is
//! "202 Accepted", which the forwarder takes to mean "not kept", so it can
//! pass the email on to an ordinary inbox and nothing is lost. Once emails
//! are kept, the answer becomes "200 OK".

use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
    routing::post,
};
use blake2::{Blake2s256, Digest};
use serde_json::json;

use crate::{AppState, log, newsletter};

/// The biggest email nine turtles reads: 10 MB, room for a long newsletter
/// with its pictures attached. Cloudflare's own limit is 25 MB.
pub const EMAIL_SIZE_LIMIT: usize = 10 * 1024 * 1024;

/// The shortest secret nine turtles accepts, so it can't be guessed.
pub const SHORTEST_SECRET: usize = 32;

pub fn routes() -> Router<AppState> {
    Router::new().route(
        "/newsletters/incoming",
        post(incoming).layer(DefaultBodyLimit::max(EMAIL_SIZE_LIMIT)),
    )
}

async fn incoming(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    let Some(secret) = &state.config.newsletter_secret else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let given = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or_default();
    // Comparing scrambled copies takes the same time however much of the
    // secret was right, so it can't be guessed one character at a time.
    if Blake2s256::digest(given.trim().as_bytes()) != Blake2s256::digest(secret.as_bytes()) {
        log::problem("an email was posted to /newsletters/incoming without the right secret");
        return (
            StatusCode::UNAUTHORIZED,
            [(header::WWW_AUTHENTICATE, "Bearer")],
        )
            .into_response();
    }

    let Some(email) = newsletter::parse(&body) else {
        log::problem(
            "an email arrived that nine turtles couldn't read (no sender, or not an email)",
        );
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            "nine turtles couldn't read this email: it names no sender, or isn't an email.",
        )
            .into_response();
    };

    // Only the newsletter's name in the log, never the reader's address.
    log::info(&format!(
        "a newsletter email from {:?} was read; not kept yet (newsletters part one)",
        email.sender.title
    ));
    (
        StatusCode::ACCEPTED,
        Json(json!({
            "kept": false,
            "feed": {
                "key": email.sender.key,
                "title": email.sender.title,
                "site_url": email.sender.site_url,
            },
            "article": {
                "title": email.article.title,
                "link": email.article.link,
                "published_at": email.article.published_at,
                "content_bytes": email.article.content.as_ref().map_or(0, String::len),
            },
        })),
    )
        .into_response()
}
