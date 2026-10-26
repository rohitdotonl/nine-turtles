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
//! **Each reader's own address** (part two): `turtle-…@in.nineturtles.app`,
//! shown in Settings › Newsletters with Copy and New address. The forwarder
//! says who the email was delivered to (`X-Nine-Turtles-To`); otherwise the
//! email's own To, Cc and Delivered-To are tried. A `+label` after the name
//! still reaches the reader. The first email from a sender makes a feed for
//! it, the reader's alone (decision 0091); each email is an article.
//!
//! **Answers:** 200 when kept (or when the reader unsubscribed from that
//! sender, so it's dropped on purpose); 404 for an address nobody has and
//! 410 for one replaced by New address (the forwarder bounces both); 429
//! when a reader has had `DAILY_LIMIT` emails in a day; 401, 413 and 422 as
//! before. Anything but 200 is passed on to `FORWARD_TO` by the forwarder,
//! except 404 and 410.

use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use blake2::{Blake2s256, Digest};
use serde::Deserialize;
use serde_json::json;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::{store_articles, subscribe},
    log, newsletter, now,
};

/// The biggest email nine turtles reads: 10 MB, room for a long newsletter
/// with its pictures attached. Cloudflare's own limit is 25 MB.
pub const EMAIL_SIZE_LIMIT: usize = 10 * 1024 * 1024;

/// The shortest secret nine turtles accepts, so it can't be guessed.
pub const SHORTEST_SECRET: usize = 32;

/// The most emails one reader's address takes in a day, so the address
/// can't be used to fill the disk. Real newsletters come nowhere near it.
pub const DAILY_LIMIT: i64 = 200;

/// Where newsletter addresses are, after the @, unless
/// `NINE_TURTLES_NEWSLETTER_DOMAIN` says otherwise.
pub const DOMAIN: &str = "in.nineturtles.app";

/// How long Undo after New address can bring the old address back.
const UNDO_FOR: i64 = 60 * 60;

/// The letters an address is made of: no 0, 1, i, l or o, easy to mistake
/// for one another when read aloud or typed.
const ALPHABET: &[u8] = b"abcdefghjkmnpqrstuvwxyz23456789";
/// After `turtle-`: 8 of them, about 40 bits, so addresses can't be guessed.
const LENGTH: usize = 8;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/newsletters/incoming",
            post(incoming).layer(DefaultBodyLimit::max(EMAIL_SIZE_LIMIT)),
        )
        .route("/api/newsletters", get(address))
        .route("/api/newsletters/new-address", post(new_address))
        .route("/api/newsletters/undo-new-address", post(undo_new_address))
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

    let candidates: Vec<String> = headers
        .get("x-nine-turtles-to")
        .and_then(|value| value.to_str().ok())
        .into_iter()
        .flat_map(|value| value.split(','))
        .map(|address| address.trim().to_lowercase())
        .chain(email.recipients.iter().cloned())
        .collect();
    let person = match whose(&state.db, &candidates).await {
        Ok(Whose::Reader(person)) => person,
        Ok(Whose::Retired) => {
            return (
                StatusCode::GONE,
                "This address was replaced and no longer takes email.",
            )
                .into_response();
        }
        Ok(Whose::Nobody) => {
            return (StatusCode::NOT_FOUND, "There is no such address here.").into_response();
        }
        Err(error) => return database_problem("finding whose newsletter address it is", &error),
    };
    let now = now();
    match file(&state.db, person, &email, now).await {
        // Only the newsletter's name in the log, never the reader or their address.
        Ok(Filed::Kept) => {
            log::info(&format!(
                "a newsletter email from {:?} was kept",
                email.sender.title
            ));
            Json(json!({ "kept": true })).into_response()
        }
        Ok(Filed::Unsubscribed) => {
            Json(json!({ "kept": false, "why": "unsubscribed" })).into_response()
        }
        Ok(Filed::TooMany) => {
            log::problem("a reader's newsletter address had more than its daily emails");
            (
                StatusCode::TOO_MANY_REQUESTS,
                "This address has had too many emails today.",
            )
                .into_response()
        }
        Err(error) => database_problem("keeping a newsletter email", &error),
    }
}

enum Whose {
    Reader(i64),
    /// Only an address New address replaced.
    Retired,
    Nobody,
}

/// Whose address, of the ones an email was delivered to, is a reader's
/// current one. `name+label@…` counts as `name@…`.
async fn whose(db: &sqlx::SqlitePool, candidates: &[String]) -> Result<Whose, sqlx::Error> {
    let mut retired = false;
    for candidate in candidates {
        let Some((local, _domain)) = candidate.rsplit_once('@') else {
            continue;
        };
        let name = local.split('+').next().unwrap_or_default();
        if name.is_empty() {
            continue;
        }
        let found: Option<(i64, Option<i64>)> =
            sqlx::query_as("SELECT person_id, retired_at FROM newsletter_addresses WHERE name = ?")
                .bind(name)
                .fetch_optional(db)
                .await?;
        match found {
            Some((person, None)) => return Ok(Whose::Reader(person)),
            Some((_, Some(_))) => retired = true,
            None => {}
        }
    }
    Ok(if retired {
        Whose::Retired
    } else {
        Whose::Nobody
    })
}

enum Filed {
    Kept,
    /// The reader unsubscribed from this sender: dropped on purpose.
    Unsubscribed,
    TooMany,
}

/// Files an email under its sender's feed for this reader, making the feed
/// (and the reader's subscription) with the sender's first email. A
/// newsletter feed is the reader's alone: its address in nine turtles is
/// `newsletter:<reader>:<sender key>`, so no two readers ever share one.
async fn file(
    db: &sqlx::SqlitePool,
    person: i64,
    email: &newsletter::Newsletter,
    now: i64,
) -> Result<Filed, sqlx::Error> {
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM articles JOIN feeds ON feeds.id = articles.feed_id
         WHERE feeds.newsletter_of = ? AND articles.received_at > ?",
    )
    .bind(person)
    .bind(now - 24 * 60 * 60)
    .fetch_one(&mut *transaction)
    .await?;
    if today >= DAILY_LIMIT {
        return Ok(Filed::TooMany);
    }
    let url = format!("newsletter:{person}:{}", email.sender.key);
    let known: Option<(i64, Option<i64>)> =
        sqlx::query_as("SELECT id, unsubscribed_at FROM feeds WHERE url_key = ?")
            .bind(&url)
            .fetch_optional(&mut *transaction)
            .await?;
    let feed = match known {
        // Nobody follows it any more: the reader unsubscribed.
        Some((_, Some(_))) => return Ok(Filed::Unsubscribed),
        Some((id, None)) => id,
        None => {
            let id: i64 = sqlx::query_scalar(
                "INSERT INTO feeds (url, url_key, title, site_url, language, added_at, fetched_at,
                     next_check_at, newsletter_of)
                 VALUES (?1, ?1, ?2, ?3, ?4, ?5, ?5, ?6, ?7) RETURNING id",
            )
            .bind(&url)
            .bind(&email.sender.title)
            .bind(&email.sender.site_url)
            .bind(&email.article.language)
            .bind(now)
            // Never due: a newsletter is never fetched.
            .bind(i64::MAX)
            .bind(person)
            .fetch_one(&mut *transaction)
            .await?;
            subscribe(&mut transaction, person, id, &email.sender.title, now).await?;
            id
        }
    };
    store_articles(
        &mut transaction,
        feed,
        std::slice::from_ref(&email.article),
        now,
    )
    .await?;
    transaction.commit().await?;
    Ok(Filed::Kept)
}

/// The domain newsletter addresses are at.
fn domain(state: &AppState) -> &str {
    state.config.newsletter_domain.as_deref().unwrap_or(DOMAIN)
}

/// A new address name: `turtle-` and 8 random letters and digits.
fn new_name() -> Result<String, getrandom::Error> {
    let mut letters = Vec::with_capacity(LENGTH);
    // 248 is the largest multiple of 31 under 256: bytes at or above it
    // are skipped, so every letter is equally likely.
    let limit = u8::try_from(256 / ALPHABET.len() * ALPHABET.len()).unwrap_or(u8::MAX);
    while letters.len() < LENGTH {
        let mut bytes = [0u8; 16];
        getrandom::fill(&mut bytes)?;
        letters.extend(
            bytes
                .iter()
                .filter(|byte| **byte < limit)
                .map(|byte| char::from(ALPHABET[usize::from(*byte) % ALPHABET.len()])),
        );
    }
    letters.truncate(LENGTH);
    Ok(format!(
        "turtle-{}",
        letters.into_iter().collect::<String>()
    ))
}

/// Gives the reader a new current address, retiring the one they had.
async fn replace(db: &sqlx::SqlitePool, person: i64, now: i64) -> Result<String, Box<Response>> {
    let name = new_name().map_err(|error| {
        log::problem(&format!("couldn't make a newsletter address: {error}"));
        Box::new(StatusCode::INTERNAL_SERVER_ERROR.into_response())
    })?;
    let saved: Result<(), sqlx::Error> = async {
        let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
        sqlx::query(
            "UPDATE newsletter_addresses SET retired_at = ? WHERE person_id = ? AND retired_at IS NULL",
        )
        .bind(now)
        .bind(person)
        .execute(&mut *transaction)
        .await?;
        sqlx::query("INSERT INTO newsletter_addresses (name, person_id, created_at) VALUES (?, ?, ?)")
            .bind(&name)
            .bind(person)
            .bind(now)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await
    }
    .await;
    saved
        .map(|()| name)
        .map_err(|error| Box::new(database_problem("making a newsletter address", &error)))
}

/// Whether newsletters are on, and the reader's address (made the first
/// time they look).
async fn address(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    if state.config.newsletter_secret.is_none() {
        return Json(json!({ "on": false, "address": null })).into_response();
    }
    let current: Result<Option<String>, sqlx::Error> = sqlx::query_scalar(
        "SELECT name FROM newsletter_addresses WHERE person_id = ? AND retired_at IS NULL",
    )
    .bind(person)
    .fetch_optional(&state.db)
    .await;
    let name = match current {
        Ok(Some(name)) => name,
        Ok(None) => match replace(&state.db, person, now()).await {
            Ok(name) => name,
            Err(response) => return *response,
        },
        Err(error) => return database_problem("reading a newsletter address", &error),
    };
    Json(json!({ "on": true, "address": format!("{name}@{}", domain(&state)) })).into_response()
}

/// New address: the old one stops taking email; Undo can bring it back
/// for an hour.
async fn new_address(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    if state.config.newsletter_secret.is_none() {
        return StatusCode::NOT_FOUND.into_response();
    }
    let previous: Result<Option<String>, sqlx::Error> = sqlx::query_scalar(
        "SELECT name FROM newsletter_addresses WHERE person_id = ? AND retired_at IS NULL",
    )
    .bind(person)
    .fetch_optional(&state.db)
    .await;
    let previous = match previous {
        Ok(previous) => previous,
        Err(error) => return database_problem("reading a newsletter address", &error),
    };
    match replace(&state.db, person, now()).await {
        Ok(name) => Json(json!({
            "address": format!("{name}@{}", domain(&state)),
            "previous": previous,
        }))
        .into_response(),
        Err(response) => *response,
    }
}

#[derive(Deserialize)]
struct Undo {
    /// The address name New address replaced.
    previous: String,
}

/// Undo after New address: the replaced address is current again, and the
/// new one, never handed out, is retired.
async fn undo_new_address(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(undo): Json<Undo>,
) -> Response {
    let now = now();
    let restored: Result<bool, sqlx::Error> = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let retired_at: Option<i64> = sqlx::query_scalar(
            "SELECT retired_at FROM newsletter_addresses
             WHERE name = ? AND person_id = ? AND retired_at IS NOT NULL",
        )
        .bind(&undo.previous)
        .bind(person)
        .fetch_optional(&mut *transaction)
        .await?;
        if retired_at.is_none_or(|at| at < now - UNDO_FOR) {
            return Ok(false);
        }
        sqlx::query(
            "UPDATE newsletter_addresses SET retired_at = ? WHERE person_id = ? AND retired_at IS NULL",
        )
        .bind(now)
        .bind(person)
        .execute(&mut *transaction)
        .await?;
        sqlx::query("UPDATE newsletter_addresses SET retired_at = NULL WHERE name = ?")
            .bind(&undo.previous)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(true)
    }
    .await;
    match restored {
        Ok(true) => Json(json!({
            "address": format!("{}@{}", undo.previous, domain(&state)),
        }))
        .into_response(),
        Ok(false) => (StatusCode::CONFLICT, Json(json!({ "error": "too-late" }))).into_response(),
        Err(error) => database_problem("bringing back a newsletter address", &error),
    }
}
