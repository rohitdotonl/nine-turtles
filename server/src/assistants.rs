//! Connecting a reader's own AI assistant (SPEC section 33, decision 0111):
//! signing it in, and the Settings that list and disconnect it. What it can
//! then do is in `mcp`.
//!
//! nine turtles runs no AI itself. Any assistant that speaks the open MCP
//! standard can connect, and signs in the standard way, with OAuth 2.1:
//!
//! 1. It finds out how (`/.well-known/oauth-protected-resource` and
//!    `/.well-known/oauth-authorization-server`), and registers itself
//!    (`/oauth/register`), giving its name and where to send the reader back.
//! 2. It opens `/oauth/authorize` in the reader's browser: the "Connect this
//!    assistant?" page (`web/src/lib/ConnectAssistant.svelte`), after
//!    signing in if needed. Approving sends the browser back with a
//!    one-time code.
//! 3. It swaps the code for tickets (`/oauth/token`), proving with PKCE
//!    that it's the program that asked: an access ticket for an hour, and a
//!    refresh ticket it swaps for new ones.
//!
//! An assistant that can't show that page uses an assistant key instead,
//! made in Settings and shown once. Every ticket, code and key is kept only
//! scrambled (BLAKE2s), as a signed-in device's is. Each connection is one
//! reader's, acts only for them, and goes when they disconnect it.

use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};

use axum::{
    Form, Json, Router,
    extract::{FromRequestParts, Path, State},
    http::{HeaderMap, HeaderValue, StatusCode, header, request::Parts},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;

use crate::{
    AppState,
    auth::{SignedIn, database_problem, new_token, scramble},
    encoding::{base64url, form_pairs},
    log, now,
};

/// An access ticket lasts an hour; the assistant then swaps its refresh ticket.
const ACCESS_FOR: i64 = 60 * 60;
/// A refresh ticket lasts 90 days, and each swap gives a new one: an
/// assistant used at least once a season stays connected.
const REFRESH_FOR: i64 = 90 * 24 * 60 * 60;
/// The code an approval sends back must be swapped within ten minutes.
const CODE_FOR: i64 = 10 * 60;
/// A registered assistant nobody connects is forgotten after a day.
const UNUSED_CLIENT_FOR: i64 = 24 * 60 * 60;
/// At most this many registered assistants are kept, so registering can't
/// fill the disk: past it, the oldest nobody connected goes to make room.
const MOST_CLIENTS: i64 = 2_000;
/// At most this many registrations an hour from one internet address, and
/// from everywhere together, so one stranger can't crowd out everyone else.
const REGISTRATIONS_AN_HOUR_EACH: u32 = 10;
const REGISTRATIONS_AN_HOUR: u32 = 300;
/// The longest name an assistant may give itself, in characters.
const LONGEST_NAME: usize = 80;
/// At most this many return addresses, each this long.
const MOST_REDIRECTS: usize = 5;
const LONGEST_ADDRESS: usize = 2_000;
/// Keys start so, so a reader (or a secret scanner) can tell one at a glance.
const KEY_PREFIX: &str = "nt_";

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/.well-known/oauth-protected-resource",
            get(protected_resource),
        )
        .route(
            "/.well-known/oauth-protected-resource/mcp",
            get(protected_resource),
        )
        .route(
            "/.well-known/oauth-authorization-server",
            get(authorization_server),
        )
        .route(
            "/.well-known/oauth-authorization-server/mcp",
            get(authorization_server),
        )
        .route("/oauth/register", post(register))
        .route("/oauth/token", post(token))
        .route("/api/oauth/request", get(request))
        .route("/api/oauth/approve", post(approve))
        .route("/api/oauth/deny", post(deny))
        .route("/api/assistants", get(list))
        .route("/api/assistants/key", post(make_key))
        .route("/api/assistants/{id}/disconnect", post(disconnect))
}

/// How often things happen, kept in memory: registrations, and each
/// reader's tool calls and feeds added (`mcp`). Forgotten when nine turtles
/// restarts, which is fine for limits this loose.
#[derive(Default)]
pub struct Limits {
    windows: Mutex<HashMap<Counted, (Instant, u32)>>,
}

/// What's counted, and for whom.
type Counted = (&'static str, i64);

impl Limits {
    /// Counts one more of `what` for `who` (a reader's number, or 0), and
    /// answers whether it's within `most` per `per`.
    pub fn allow(&self, what: &'static str, who: i64, most: u32, per: Duration) -> bool {
        let now = Instant::now();
        let mut windows = self
            .windows
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        // A few hundred readers at most, each with a few counts: tidied
        // only when it grows, so memory stays small.
        if windows.len() > 10_000 {
            windows
                .retain(|_, (start, _)| now.duration_since(*start) < Duration::from_secs(86_400));
        }
        let window = windows.entry((what, who)).or_insert((now, 0));
        if now.duration_since(window.0) >= per {
            *window = (now, 0);
        }
        window.1 += 1;
        window.1 <= most
    }
}

/// The address nine turtles answers at, as assistants must be told it: the
/// public address when it's set, otherwise the one the request came to.
pub fn base_url(state: &AppState, headers: &HeaderMap) -> String {
    if let Some(url) = &state.config.public_url {
        return url.as_str().trim_end_matches('/').to_owned();
    }
    let host = headers
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("localhost");
    let local = ["localhost", "127.0.0.1", "[::1]"]
        .iter()
        .any(|name| host == *name || host.starts_with(&format!("{name}:")));
    format!("{}://{host}", if local { "http" } else { "https" })
}

/// Tells an assistant that the MCP server needs signing in, and where.
async fn protected_resource(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let base = base_url(&state, &headers);
    Json(json!({
        "resource": format!("{base}/mcp"),
        "authorization_servers": [base],
        "bearer_methods_supported": ["header"],
        "resource_name": "nine turtles",
    }))
    .into_response()
}

/// How to sign in (RFC 8414): only what nine turtles offers.
async fn authorization_server(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let base = base_url(&state, &headers);
    Json(json!({
        "issuer": base,
        "authorization_endpoint": format!("{base}/oauth/authorize"),
        "token_endpoint": format!("{base}/oauth/token"),
        "registration_endpoint": format!("{base}/oauth/register"),
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "authorization_response_iss_parameter_supported": true,
    }))
    .into_response()
}

/// An OAuth error, as the standard writes one.
fn oauth_error(status: StatusCode, error: &str, description: &str) -> Response {
    (
        status,
        [(header::CACHE_CONTROL, "no-store")],
        Json(json!({ "error": error, "error_description": description })),
    )
        .into_response()
}

#[derive(Deserialize)]
struct Registration {
    #[serde(default)]
    redirect_uris: Vec<String>,
    #[serde(default)]
    client_name: Option<String>,
}

/// A name as an assistant gave it: spaces tidied, controls removed, cut
/// short. "An assistant" when it gave none.
fn clean_name(name: Option<&str>) -> String {
    let name: String = name
        .unwrap_or_default()
        .chars()
        .filter(|c| !c.is_control())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let name: String = name.chars().take(LONGEST_NAME).collect();
    if name.is_empty() {
        "An assistant".to_owned()
    } else {
        name
    }
}

/// A return address an assistant may register (OAuth 2.1 and RFC 8252):
/// https anywhere; http only to the computer it runs on, as desktop
/// assistants do; or an app's own kind of address (`cursor://…`), never
/// one a browser would run or open as a file. Never with a `#` part.
pub fn allowed_redirect(address: &str) -> bool {
    if address.len() > LONGEST_ADDRESS {
        return false;
    }
    let Ok(url) = Url::parse(address) else {
        return false;
    };
    if url.fragment().is_some() {
        return false;
    }
    match url.scheme() {
        "https" => url.host_str().is_some(),
        "http" => matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")),
        "javascript" | "data" | "file" | "vbscript" | "about" | "blob" | "ftp" | "ws" | "wss" => {
            false
        }
        _ => true,
    }
}

/// Dynamic client registration (RFC 7591): an assistant introduces itself.
/// Who is asking, as well as nine turtles can tell: the address the host's
/// proxy says the request came from (the last one it added), as a number
/// for `Limits`. Render's proxy adds it; it can't be faked from outside,
/// since anything a stranger adds comes before it. None with no proxy (on
/// a computer, in the checks): then only the limit for everyone applies.
fn asker(headers: &HeaderMap) -> Option<i64> {
    use std::hash::{Hash, Hasher};
    let address = headers
        .get_all("x-forwarded-for")
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        .map(str::trim)
        .next_back()
        .filter(|address| !address.is_empty())?;
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    address.hash(&mut hasher);
    Some(i64::from_ne_bytes(hasher.finish().to_ne_bytes()))
}

async fn register(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(form): Json<Registration>,
) -> Response {
    if form.redirect_uris.is_empty()
        || form.redirect_uris.len() > MOST_REDIRECTS
        || !form.redirect_uris.iter().all(|uri| allowed_redirect(uri))
    {
        return oauth_error(
            StatusCode::BAD_REQUEST,
            "invalid_redirect_uri",
            "Give one to five return addresses: https, http only to localhost, or an app's own.",
        );
    }
    let hour = Duration::from_secs(3_600);
    let limits = &state.assistant_limits;
    let each = asker(&headers)
        .is_none_or(|who| limits.allow("register-each", who, REGISTRATIONS_AN_HOUR_EACH, hour));
    if !each || !limits.allow("register", 0, REGISTRATIONS_AN_HOUR, hour) {
        return oauth_error(
            StatusCode::TOO_MANY_REQUESTS,
            "temporarily_unavailable",
            "Too many assistants registered this hour. Try again later.",
        );
    }
    let client_id = match new_token() {
        Ok(token) => format!("ntc_{}", &token[..32]),
        Err(error) => {
            log::problem(&format!("couldn't make an assistant's client id: {error}"));
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };
    let name = clean_name(form.client_name.as_deref());
    let at = now();
    let stored = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        sqlx::query(
            "DELETE FROM assistant_clients WHERE created_at <= ?
             AND id NOT IN (SELECT client_id FROM assistant_connections WHERE client_id IS NOT NULL)
             AND id NOT IN (SELECT client_id FROM assistant_codes)",
        )
        .bind(at - UNUSED_CLIENT_FOR)
        .execute(&mut *transaction)
        .await?;
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assistant_clients")
            .fetch_one(&mut *transaction)
            .await?;
        if count >= MOST_CLIENTS {
            let made_room = sqlx::query(
                "DELETE FROM assistant_clients WHERE id = (SELECT id FROM assistant_clients
                     WHERE id NOT IN (SELECT client_id FROM assistant_connections
                                      WHERE client_id IS NOT NULL)
                         AND id NOT IN (SELECT client_id FROM assistant_codes)
                     ORDER BY created_at, id LIMIT 1)",
            )
            .execute(&mut *transaction)
            .await?;
            if made_room.rows_affected() == 0 {
                return Ok(false);
            }
        }
        sqlx::query(
            "INSERT INTO assistant_clients (client_id, name, redirect_uris, created_at)
             VALUES (?, ?, ?, ?)",
        )
        .bind(&client_id)
        .bind(&name)
        .bind(serde_json::to_string(&form.redirect_uris).unwrap_or_else(|_| "[]".to_owned()))
        .bind(at)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok::<bool, sqlx::Error>(true)
    }
    .await;
    match stored {
        Ok(true) => (
            StatusCode::CREATED,
            [(header::CACHE_CONTROL, "no-store")],
            Json(json!({
                "client_id": client_id,
                "client_id_issued_at": at,
                "client_name": name,
                "redirect_uris": form.redirect_uris,
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
                "token_endpoint_auth_method": "none",
            })),
        )
            .into_response(),
        Ok(false) => oauth_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "temporarily_unavailable",
            "Too many assistants are waiting to connect. Try again tomorrow.",
        ),
        Err(error) => database_problem("registering an assistant", &error),
    }
}

/// What an assistant's link to the "Connect this assistant?" page asks,
/// once checked.
#[derive(Debug)]
struct Asked {
    /// The registered assistant's number in `assistant_clients`, and its name.
    client: i64,
    name: String,
    redirect: Url,
    challenge: String,
    state: Option<String>,
}

/// The parts of a query string, the first of each name.
fn query_pairs(query: &str) -> HashMap<String, String> {
    let mut pairs = HashMap::new();
    for (key, value) in form_pairs(query) {
        pairs.entry(key).or_insert(value);
    }
    pairs
}

/// A PKCE challenge as S256 makes one: 43 base64url characters (the
/// standard allows up to 128).
fn plausible_challenge(text: &str) -> bool {
    (43..=128).contains(&text.len())
        && text
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~'))
}

/// Checks the link's query string: a registered assistant, one of its own
/// return addresses, a code asked for with an S256 challenge. Answers why
/// not as a word the page turns into a sentence.
async fn checked(db: &SqlitePool, query: &str) -> Result<Result<Asked, &'static str>, sqlx::Error> {
    let pairs = query_pairs(query);
    let get = |name: &str| pairs.get(name).map(String::as_str);
    let Some(client_id) = get("client_id") else {
        return Ok(Err("unknown-client"));
    };
    let found: Option<(i64, String, String)> =
        sqlx::query_as("SELECT id, name, redirect_uris FROM assistant_clients WHERE client_id = ?")
            .bind(client_id)
            .fetch_optional(db)
            .await?;
    let Some((client, name, registered)) = found else {
        return Ok(Err("unknown-client"));
    };
    let registered: Vec<String> = serde_json::from_str(&registered).unwrap_or_default();
    // Without one named, its only registered address; never one it didn't register.
    let redirect = match get("redirect_uri") {
        Some(asked) if registered.iter().any(|uri| uri == asked) => asked,
        None if registered.len() == 1 => registered[0].as_str(),
        _ => return Ok(Err("bad-redirect")),
    };
    let Ok(redirect) = Url::parse(redirect) else {
        return Ok(Err("bad-redirect"));
    };
    let challenge = get("code_challenge").unwrap_or_default();
    let state = get("state");
    if get("response_type") != Some("code")
        || get("code_challenge_method") != Some("S256")
        || !plausible_challenge(challenge)
        || state.is_some_and(|state| state.len() > LONGEST_ADDRESS)
    {
        return Ok(Err("bad-request"));
    }
    Ok(Ok(Asked {
        client,
        name,
        redirect,
        challenge: challenge.to_owned(),
        state: state.map(str::to_owned),
    }))
}

fn refused(word: &str) -> Response {
    (StatusCode::BAD_REQUEST, Json(json!({ "error": word }))).into_response()
}

/// Where the reader's browser goes back to, with these parts added, and
/// who sent it (RFC 9207), so the assistant can't be fooled by another
/// server's answer.
fn back_to(asked: &Asked, issuer: &str, parts: &[(&str, &str)]) -> String {
    let mut url = asked.redirect.clone();
    {
        let mut query = url.query_pairs_mut();
        for (name, value) in parts {
            query.append_pair(name, value);
        }
        if let Some(state) = &asked.state {
            query.append_pair("state", state);
        }
        query.append_pair("iss", issuer);
    }
    url.into()
}

#[derive(Deserialize)]
struct RequestQuery {
    #[serde(default)]
    query: String,
}

/// What the "Connect this assistant?" page shows: the assistant's name and
/// the website it sends the reader back to. The page passes on its own
/// query string, as the assistant wrote it.
async fn request(
    SignedIn(_): SignedIn,
    State(state): State<AppState>,
    uri: axum::http::Uri,
) -> Response {
    match checked(&state.db, uri.query().unwrap_or_default()).await {
        Ok(Ok(asked)) => Json(json!({
            "client_name": asked.name,
            // An app's own kind of address (`com.example.app:/callback`)
            // has no website: its scheme names the app.
            "redirect_host": asked.redirect.host_str().unwrap_or(asked.redirect.scheme()),
        }))
        .into_response(),
        Ok(Err(word)) => refused(word),
        Err(error) => database_problem("reading an assistant's request", &error),
    }
}

/// The reader said yes: a one-time code goes back to the assistant.
async fn approve(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(form): Json<RequestQuery>,
) -> Response {
    let asked = match checked(&state.db, &form.query).await {
        Ok(Ok(asked)) => asked,
        Ok(Err(word)) => return refused(word),
        Err(error) => return database_problem("reading an assistant's request", &error),
    };
    let code = match new_token() {
        Ok(code) => code,
        Err(error) => {
            log::problem(&format!("couldn't make an assistant's code: {error}"));
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };
    let at = now();
    let stored = async {
        sqlx::query("DELETE FROM assistant_codes WHERE expires_at <= ?")
            .bind(at)
            .execute(&state.db)
            .await?;
        sqlx::query(
            "INSERT INTO assistant_codes (code_hash, person_id, client_id, redirect_uri,
                 code_challenge, expires_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&scramble(&code)[..])
        .bind(person)
        .bind(asked.client)
        .bind(asked.redirect.as_str())
        .bind(&asked.challenge)
        .bind(at + CODE_FOR)
        .execute(&state.db)
        .await
    }
    .await;
    if let Err(error) = stored {
        return database_problem("approving an assistant", &error);
    }
    let issuer = base_url(&state, &headers);
    Json(json!({ "redirect": back_to(&asked, &issuer, &[("code", &code)]) })).into_response()
}

/// The reader said no: the assistant is told so.
async fn deny(
    SignedIn(_): SignedIn,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(form): Json<RequestQuery>,
) -> Response {
    match checked(&state.db, &form.query).await {
        Ok(Ok(asked)) => {
            let issuer = base_url(&state, &headers);
            let redirect = back_to(&asked, &issuer, &[("error", "access_denied")]);
            Json(json!({ "redirect": redirect })).into_response()
        }
        Ok(Err(word)) => refused(word),
        Err(error) => database_problem("reading an assistant's request", &error),
    }
}

/// PKCE (RFC 7636): the secret the assistant kept matches the challenge it
/// sent before the reader approved.
pub fn verifier_matches(verifier: &str, challenge: &str) -> bool {
    plausible_challenge(verifier) && challenge_for(verifier) == challenge
}

/// The S256 challenge an assistant sends for its secret `verifier`.
pub fn challenge_for(verifier: &str) -> String {
    base64url(&Sha256::digest(verifier.as_bytes()))
}

/// New tickets for a connection: an access ticket and a refresh ticket.
async fn issue(db: &SqlitePool, connection: i64) -> Result<Option<Value>, sqlx::Error> {
    let (Ok(access), Ok(refresh)) = (new_token(), new_token()) else {
        log::problem("couldn't make an assistant's tickets");
        return Ok(None);
    };
    let at = now();
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    sqlx::query("DELETE FROM assistant_tokens WHERE expires_at <= ?")
        .bind(at)
        .execute(&mut *transaction)
        .await?;
    for (token, kind, lasts) in [
        (&access, "access", ACCESS_FOR),
        (&refresh, "refresh", REFRESH_FOR),
    ] {
        sqlx::query(
            "INSERT INTO assistant_tokens (token_hash, connection_id, kind, expires_at)
             VALUES (?, ?, ?, ?)",
        )
        .bind(&scramble(token)[..])
        .bind(connection)
        .bind(kind)
        .bind(at + lasts)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    Ok(Some(json!({
        "access_token": access,
        "token_type": "Bearer",
        "expires_in": ACCESS_FOR,
        "refresh_token": refresh,
    })))
}

/// The token endpoint: a code, or a refresh ticket, swapped for tickets.
///
/// An assistant names itself in the form (`client_id`), or, as some do,
/// with HTTP Basic sign-in (its id, a colon, and an empty secret).
async fn token(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(mut form): Form<HashMap<String, String>>,
) -> Response {
    if !form.contains_key("client_id")
        && let Some(client_id) = basic_client_id(&headers)
    {
        form.insert("client_id".to_owned(), client_id);
    }
    let get = |name: &str| form.get(name).map(String::as_str).unwrap_or_default();
    let swapped = match get("grant_type") {
        "authorization_code" => swap_code(&state.db, &form).await,
        "refresh_token" => swap_refresh(&state.db, get("refresh_token"), get("client_id")).await,
        _ => {
            return oauth_error(
                StatusCode::BAD_REQUEST,
                "unsupported_grant_type",
                "Only authorization_code and refresh_token.",
            );
        }
    };
    match swapped {
        Ok(Ok(tickets)) => (
            [
                (header::CACHE_CONTROL, HeaderValue::from_static("no-store")),
                (header::PRAGMA, HeaderValue::from_static("no-cache")),
            ],
            Json(tickets),
        )
            .into_response(),
        Ok(Err(description)) => oauth_error(StatusCode::BAD_REQUEST, "invalid_grant", description),
        Err(error) => database_problem("giving an assistant its tickets", &error),
    }
}

/// The client id in an `Authorization: Basic …` header, if there is one.
fn basic_client_id(headers: &HeaderMap) -> Option<String> {
    let value = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let encoded = value.trim().strip_prefix("Basic ")?;
    let decoded = String::from_utf8(crate::encoding::from_base64(encoded)?).ok()?;
    let id = decoded.split(':').next()?;
    // Percent-encoded, as RFC 6749 asks; client ids here never need it.
    query_pairs(&format!("id={id}")).remove("id")
}

/// The client's number in `assistant_clients`, from its public client id.
async fn client_number(db: &SqlitePool, client_id: &str) -> Result<Option<i64>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM assistant_clients WHERE client_id = ?")
        .bind(client_id)
        .fetch_optional(db)
        .await
}

async fn swap_code(
    db: &SqlitePool,
    form: &HashMap<String, String>,
) -> Result<Result<Value, &'static str>, sqlx::Error> {
    let get = |name: &str| form.get(name).map(String::as_str).unwrap_or_default();
    // Used once, whatever happens next.
    let found: Option<(i64, i64, String, String)> = sqlx::query_as(
        "DELETE FROM assistant_codes WHERE code_hash = ? AND expires_at > ?
         RETURNING person_id, client_id, redirect_uri, code_challenge",
    )
    .bind(&scramble(get("code"))[..])
    .bind(now())
    .fetch_optional(db)
    .await?;
    let Some((person, client, redirect, challenge)) = found else {
        return Ok(Err("That code isn't valid any more. Connect again."));
    };
    if client_number(db, get("client_id")).await? != Some(client) {
        return Ok(Err("The code belongs to another assistant."));
    }
    if form
        .get("redirect_uri")
        .is_some_and(|given| *given != redirect)
    {
        return Ok(Err("The return address doesn't match."));
    }
    if !verifier_matches(get("code_verifier"), &challenge) {
        return Ok(Err("The PKCE code_verifier doesn't match."));
    }
    // Connecting the same assistant again keeps one line for it in Settings.
    // One statement adds the line only if there's none yet, so two codes
    // swapped at the same moment can't both add one (survey A9.5).
    sqlx::query(
        "INSERT INTO assistant_connections (person_id, client_id, name, created_at)
         SELECT ?1, id, name, ?2 FROM assistant_clients WHERE id = ?3
             AND NOT EXISTS (SELECT 1 FROM assistant_connections
                             WHERE person_id = ?1 AND client_id = ?3)",
    )
    .bind(person)
    .bind(now())
    .bind(client)
    .execute(db)
    .await?;
    let connection: Option<i64> = sqlx::query_scalar(
        "SELECT MIN(id) FROM assistant_connections WHERE person_id = ? AND client_id = ?",
    )
    .bind(person)
    .bind(client)
    .fetch_one(db)
    .await?;
    let Some(connection) = connection else {
        return Ok(Err("That assistant isn't known any more. Connect again."));
    };
    Ok(issue(db, connection)
        .await?
        .ok_or("nine turtles couldn't make tickets just now. Try again."))
}

async fn swap_refresh(
    db: &SqlitePool,
    refresh: &str,
    client_id: &str,
) -> Result<Result<Value, &'static str>, sqlx::Error> {
    let found: Option<(i64, Option<i64>)> = sqlx::query_as(
        "DELETE FROM assistant_tokens WHERE token_hash = ? AND kind = 'refresh' AND expires_at > ?
         RETURNING connection_id,
             (SELECT client_id FROM assistant_connections WHERE id = connection_id)",
    )
    .bind(&scramble(refresh)[..])
    .bind(now())
    .fetch_optional(db)
    .await?;
    let Some((connection, client)) = found else {
        return Ok(Err(
            "That refresh ticket isn't valid any more. Connect again.",
        ));
    };
    // A client that names itself must be the one connected.
    if !client_id.is_empty() && client_number(db, client_id).await? != client {
        return Ok(Err("The refresh ticket belongs to another assistant."));
    }
    Ok(issue(db, connection)
        .await?
        .ok_or("nine turtles couldn't make tickets just now. Try again."))
}

/// Proof that a request comes from a connected assistant, and for whom:
/// the reader's number, and the connection's.
#[derive(Clone, Copy, Debug)]
pub struct Assistant {
    pub person: i64,
    pub connection: i64,
}

/// "Sign in first", with where to find out how (RFC 9728).
pub fn sign_in_first(state: &AppState, headers: &HeaderMap) -> Response {
    let metadata = format!(
        "Bearer resource_metadata=\"{}/.well-known/oauth-protected-resource/mcp\"",
        base_url(state, headers)
    );
    let mut response = (
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": "invalid_token", "error_description": "Connect this assistant first." })),
    )
        .into_response();
    if let Ok(value) = HeaderValue::from_str(&metadata) {
        response
            .headers_mut()
            .insert(header::WWW_AUTHENTICATE, value);
    }
    response
}

impl FromRequestParts<AppState> for Assistant {
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Response> {
        let token = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.trim().strip_prefix("Bearer "))
            .map(str::trim);
        let Some(token) = token else {
            return Err(sign_in_first(state, &parts.headers));
        };
        let at = now();
        let found: Result<Option<(i64, i64, Option<i64>)>, sqlx::Error> = sqlx::query_as(
            "SELECT assistant_connections.person_id, assistant_connections.id,
                    assistant_connections.last_used_at
             FROM assistant_tokens JOIN assistant_connections
                 ON assistant_connections.id = assistant_tokens.connection_id
             WHERE assistant_tokens.token_hash = ? AND assistant_tokens.kind IN ('access', 'key')
                 AND (assistant_tokens.expires_at IS NULL OR assistant_tokens.expires_at > ?)",
        )
        .bind(&scramble(token)[..])
        .bind(at)
        .fetch_optional(&state.db)
        .await;
        match found {
            Ok(Some((person, connection, last_used))) => {
                // Noted at most every ten minutes, so a busy assistant
                // doesn't write on every call.
                if last_used.is_none_or(|last| last < at - 600) {
                    let noted = sqlx::query(
                        "UPDATE assistant_connections SET last_used_at = ? WHERE id = ?",
                    )
                    .bind(at)
                    .bind(connection)
                    .execute(&state.db)
                    .await;
                    if let Err(error) = noted {
                        log::problem(&format!("couldn't note an assistant's use: {error}"));
                    }
                    crate::admin::note_here(&state.db, person).await;
                }
                Ok(Self { person, connection })
            }
            Ok(None) => Err(sign_in_first(state, &parts.headers)),
            Err(error) => Err(database_problem("checking an assistant's ticket", &error)),
        }
    }
}

#[derive(Serialize, sqlx::FromRow)]
struct Connected {
    id: i64,
    name: String,
    connected_at: i64,
    last_used_at: Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
struct Kept {
    feed_id: i64,
    title: String,
    unsubscribed_at: i64,
    kept_until: i64,
}

/// Settings: the reader's connected assistants, and the feeds an assistant
/// unsubscribed from that can still be brought back.
async fn list(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let listed = async {
        let assistants: Vec<Connected> = sqlx::query_as(
            "SELECT id, name, created_at AS connected_at, last_used_at
             FROM assistant_connections WHERE person_id = ? ORDER BY created_at, id",
        )
        .bind(person)
        .fetch_all(&state.db)
        .await?;
        let kept: Vec<Kept> = sqlx::query_as(
            "SELECT feed_id, title, unsubscribed_at, kept_until FROM subscriptions
             WHERE person_id = ? AND kept_until IS NOT NULL AND unsubscribed_at IS NOT NULL
                 AND cleared = 0
             ORDER BY unsubscribed_at DESC, feed_id",
        )
        .bind(person)
        .fetch_all(&state.db)
        .await?;
        Ok::<_, sqlx::Error>((assistants, kept))
    }
    .await;
    match listed {
        Ok((assistants, kept)) => {
            Json(json!({ "assistants": assistants, "unsubscribed": kept })).into_response()
        }
        Err(error) => database_problem("listing assistants", &error),
    }
}

/// Disconnects an assistant: its tickets stop working at once.
async fn disconnect(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let deleted = sqlx::query("DELETE FROM assistant_connections WHERE id = ? AND person_id = ?")
        .bind(id)
        .bind(person)
        .execute(&state.db)
        .await;
    match deleted {
        Ok(done) if done.rows_affected() == 0 => StatusCode::NOT_FOUND.into_response(),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("disconnecting an assistant", &error),
    }
}

#[derive(Deserialize)]
struct KeyForm {
    #[serde(default)]
    name: Option<String>,
}

/// Makes an assistant key, for an assistant that can't show the "Connect
/// this assistant?" page, and shows it this once.
async fn make_key(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<KeyForm>,
) -> Response {
    let key = match new_token() {
        Ok(token) => format!("{KEY_PREFIX}{token}"),
        Err(error) => {
            log::problem(&format!("couldn't make an assistant key: {error}"));
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };
    let name = match form.name.as_deref().map(str::trim) {
        Some(name) if !name.is_empty() => clean_name(Some(name)),
        _ => "Assistant key".to_owned(),
    };
    let at = now();
    let made = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO assistant_connections (person_id, client_id, name, created_at)
             VALUES (?, NULL, ?, ?) RETURNING id",
        )
        .bind(person)
        .bind(&name)
        .bind(at)
        .fetch_one(&mut *transaction)
        .await?;
        sqlx::query(
            "INSERT INTO assistant_tokens (token_hash, connection_id, kind, expires_at)
             VALUES (?, ?, 'key', NULL)",
        )
        .bind(&scramble(&key)[..])
        .bind(id)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok::<i64, sqlx::Error>(id)
    }
    .await;
    match made {
        Ok(id) => (
            StatusCode::CREATED,
            [(header::CACHE_CONTROL, "no-store")],
            Json(json!({
                "key": key,
                "assistant": Connected { id, name, connected_at: at, last_used_at: None },
            })),
        )
            .into_response(),
        Err(error) => database_problem("making an assistant key", &error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_matches_the_standards_example() {
        // RFC 7636, appendix B.
        assert!(verifier_matches(
            "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        ));
        assert!(!verifier_matches(
            "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXl",
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        ));
    }

    #[test]
    fn return_addresses_are_https_or_this_computer() {
        assert!(allowed_redirect("https://claude.ai/api/mcp/auth_callback"));
        assert!(allowed_redirect(
            "https://chatgpt.com/connector_platform_oauth_redirect"
        ));
        assert!(allowed_redirect("http://localhost:33418/callback"));
        assert!(allowed_redirect("http://127.0.0.1:6274/oauth/callback"));
        assert!(!allowed_redirect("http://example.com/callback"));
        assert!(!allowed_redirect("https://example.com/callback#part"));
        assert!(!allowed_redirect("javascript:alert(1)"));
        assert!(allowed_redirect(
            "cursor://anysphere.cursor-retrieval/oauth/callback"
        ));
        assert!(!allowed_redirect("data:text/html,hello"));
        assert!(!allowed_redirect("file:///etc/passwd"));
    }

    #[test]
    fn a_client_id_can_come_in_basic_sign_in() {
        let mut headers = HeaderMap::new();
        // "ntc_abc:" in base64.
        headers.insert(
            header::AUTHORIZATION,
            HeaderValue::from_static("Basic bnRjX2FiYzo="),
        );
        assert_eq!(basic_client_id(&headers).as_deref(), Some("ntc_abc"));
        headers.insert(
            header::AUTHORIZATION,
            HeaderValue::from_static("Bearer xyz"),
        );
        assert_eq!(basic_client_id(&headers), None);
    }

    #[test]
    fn names_are_plain_and_short() {
        assert_eq!(clean_name(Some("  Claude\n ")), "Claude");
        assert_eq!(clean_name(None), "An assistant");
        assert_eq!(
            clean_name(Some(&"x".repeat(500))).chars().count(),
            LONGEST_NAME
        );
    }

    #[test]
    fn limits_count_within_their_window() {
        let limits = Limits::default();
        let minute = Duration::from_secs(60);
        assert!(limits.allow("call", 1, 2, minute));
        assert!(limits.allow("call", 1, 2, minute));
        assert!(!limits.allow("call", 1, 2, minute));
        assert!(limits.allow("call", 2, 2, minute));
    }
}
