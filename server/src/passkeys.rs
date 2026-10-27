//! Passkey sign-in (SPEC sections 1 and 18, decision 0109): a reader adds a
//! passkey in Settings › Passkeys, after typing their password, and can then
//! sign in with their fingerprint, face or device PIN instead. Passwords keep
//! working as before; removing a passkey never locks anyone out.
//!
//! The checking is done by the webauthn-rs library. Each step of adding a
//! passkey or signing in with one is a "ceremony": nine turtles hands the
//! browser a random challenge and keeps what it needs to check the answer
//! here, in memory, for five minutes and for one use only. A passkey that
//! signs in is found by its own number; the random number it carries for
//! its reader (`user_handle`) must match too. Only the passkey's public half
//! is stored. Its signature counter is checked by the library, which refuses
//! a passkey whose counter goes backwards (a sign it was copied).
//!
//! A passkey belongs to the site it was made on (its "relying party"):
//! `NINE_TURTLES_PUBLIC_URL` when it's set, otherwise `localhost` on any
//! port, for trying nine turtles out on one's own computer. Anywhere else
//! (such as the Render address) the page hides passkeys.

use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};

use axum::{
    Json, Router,
    extract::{Path, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::{Value, json};
use webauthn_rs::prelude::{
    CredentialID, DiscoverableAuthentication, DiscoverableKey, Passkey, PasskeyRegistration,
    PublicKeyCredential, RegisterPublicKeyCredential, Url, Uuid, Webauthn, WebauthnBuilder,
};

use crate::{
    AppState,
    auth::{
        Account, SignedIn, ask_password, database_problem, new_token, remember_device,
        session_cookie,
    },
    config::PasswordSetting,
    log, now,
};

/// How long the browser has to answer a challenge.
pub const CEREMONY_LIFETIME: Duration = Duration::from_secs(5 * 60);
/// At most this many sign-in challenges wait for an answer at once, for the
/// whole app, so nobody can fill the server's memory by opening sign-in
/// pages. When it's full, the oldest gives way to the newest. Adding a
/// passkey keeps its own challenges, one per signed-in reader, so nobody
/// signed out can push those out.
pub const MOST_SIGN_INS: usize = 1000;
/// How long Undo can bring a removed passkey back, in seconds.
pub const UNDO_FOR: i64 = 10 * 60;
/// At most this many passkeys for each reader.
pub const MOST_PASSKEYS: i64 = 20;
/// The longest name a reader can give a passkey, in characters.
pub const LONGEST_NAME: usize = 100;

/// The site's passkey checker and the challenges waiting for an answer.
pub struct Passkeys {
    /// `None` when the public address can't carry passkeys (an IP address).
    webauthn: Option<Webauthn>,
    /// The address passkeys work at, for the page to compare with its own:
    /// `http://localhost` means any port.
    origin: Option<String>,
    ceremonies: Mutex<Ceremonies>,
}

impl Passkeys {
    pub fn new(public_url: Option<&reqwest::Url>) -> Self {
        let made = relying_party(public_url);
        if made.is_none() {
            log::info(
                "passkeys are off: NINE_TURTLES_PUBLIC_URL must be a name such as \
                 https://app.nineturtles.app, not a numeric address",
            );
        }
        let (webauthn, origin) = made.unzip();
        Self {
            webauthn,
            origin,
            ceremonies: Mutex::default(),
        }
    }

    /// The address passkeys work at, if they're on.
    pub fn origin(&self) -> Option<&str> {
        self.origin.as_deref()
    }

    fn begin(&self, step: Step) -> Option<String> {
        let ticket = new_token().ok()?;
        self.ceremonies
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .begin(ticket.clone(), step, Instant::now());
        Some(ticket)
    }

    fn take(&self, ticket: &str) -> Option<Step> {
        self.ceremonies
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .take(ticket, Instant::now())
    }
}

/// The passkey checker for `public_url`'s site, and its address.
fn relying_party(public_url: Option<&reqwest::Url>) -> Option<(Webauthn, String)> {
    let (origin, any_port) = match public_url {
        Some(url) => (url.origin().ascii_serialization(), false),
        None => ("http://localhost".to_owned(), true),
    };
    let parsed = Url::parse(&origin).ok()?;
    let id = parsed.domain()?.to_owned();
    let webauthn = WebauthnBuilder::new(&id, &parsed)
        .ok()?
        .rp_name("nine turtles")
        .allow_any_port(any_port)
        .timeout(CEREMONY_LIFETIME)
        .build()
        .ok()?;
    Some((webauthn, origin))
}

/// What a challenge was for, and what's needed to check its answer.
pub enum Step {
    Adding {
        person: i64,
        handle: Uuid,
        registration: PasskeyRegistration,
    },
    SigningIn(DiscoverableAuthentication),
}

struct Ceremony {
    step: Step,
    until: Instant,
}

/// The challenges waiting for an answer, each under a random ticket the
/// page sends back with the answer: sign-ins (open to anyone) and adding a
/// passkey (signed-in readers only) apart, so one can't crowd out the other.
#[derive(Default)]
pub struct Ceremonies {
    signing_in: HashMap<String, Ceremony>,
    adding: HashMap<String, Ceremony>,
}

impl Ceremonies {
    /// Keeps `step` under `ticket` until `CEREMONY_LIFETIME` from `now`. A
    /// reader adding a passkey has only their newest challenge. When
    /// `MOST_SIGN_INS` sign-ins are waiting, the oldest is forgotten (its
    /// answer then says "That took too long"), so the newest always works.
    pub fn begin(&mut self, ticket: String, step: Step, now: Instant) {
        self.signing_in.retain(|_, ceremony| ceremony.until > now);
        self.adding.retain(|_, ceremony| ceremony.until > now);
        let pool = match &step {
            Step::Adding { person, .. } => {
                self.adding.retain(|_, ceremony| {
                    !matches!(&ceremony.step, Step::Adding { person: theirs, .. } if theirs == person)
                });
                &mut self.adding
            }
            Step::SigningIn(_) => {
                while self.signing_in.len() >= MOST_SIGN_INS {
                    let oldest = self
                        .signing_in
                        .iter()
                        .min_by_key(|(_, ceremony)| ceremony.until)
                        .map(|(ticket, _)| ticket.clone());
                    match oldest {
                        Some(oldest) => self.signing_in.remove(&oldest),
                        None => break,
                    };
                }
                &mut self.signing_in
            }
        };
        pool.insert(
            ticket,
            Ceremony {
                step,
                until: now + CEREMONY_LIFETIME,
            },
        );
    }

    /// The challenge kept under `ticket`, used up: a second answer to the
    /// same challenge finds nothing. `None` once it has run out.
    pub fn take(&mut self, ticket: &str, now: Instant) -> Option<Step> {
        self.signing_in
            .remove(ticket)
            .or_else(|| self.adding.remove(ticket))
            .filter(|ceremony| ceremony.until > now)
            .map(|ceremony| ceremony.step)
    }

    /// How many sign-in and adding challenges are waiting.
    pub fn waiting(&self) -> (usize, usize) {
        (self.signing_in.len(), self.adding.len())
    }
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/passkeys", get(list))
        .route("/api/passkeys/add", post(add_start))
        .route("/api/passkeys/add/finish", post(add_finish))
        .route("/api/passkeys/{id}/name", post(rename))
        .route("/api/passkeys/{id}/remove", post(remove))
        .route("/api/passkeys/{id}/undo", post(undo_remove))
        .route("/api/sign-in/passkey", post(sign_in_start))
        .route("/api/sign-in/passkey/finish", post(sign_in_finish))
}

fn refused(status: StatusCode, error: &str) -> Response {
    (status, Json(json!({ "error": error }))).into_response()
}

fn checker(state: &AppState) -> Result<&Webauthn, Box<Response>> {
    state
        .passkeys
        .webauthn
        .as_ref()
        .ok_or_else(|| Box::new(refused(StatusCode::SERVICE_UNAVAILABLE, "off")))
}

/// A passkey as listed: number, name, added, last used.
type Listed = (i64, Option<String>, i64, Option<i64>);
/// A reader as their password is checked: email, own password, owner or not.
type SigningIn = (Option<String>, Option<String>, bool);
/// A reader's passkey when adding another: number, handle, removed.
type Existing = (Vec<u8>, String, Option<i64>);

/// Deletes for good the reader's passkeys removed longer ago than Undo reaches.
async fn clear_removed(state: &AppState, person: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM passkeys WHERE person_id = ? AND removed_at <= ?")
        .bind(person)
        .bind(now() - UNDO_FOR)
        .execute(&state.db)
        .await
        .map(|_| ())
}

/// The reader's passkeys, oldest first: their number, name (`null` for
/// "Passkey added <the day>"), and when they were added and last used.
async fn list(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    if let Err(error) = clear_removed(&state, person).await {
        return database_problem("clearing removed passkeys", &error);
    }
    let found: Result<Vec<Listed>, sqlx::Error> = sqlx::query_as(
        "SELECT id, name, created_at, last_used_at FROM passkeys
             WHERE person_id = ? AND removed_at IS NULL ORDER BY created_at, id",
    )
    .bind(person)
    .fetch_all(&state.db)
    .await;
    match found {
        Ok(rows) => Json(json!({
            "passkeys": rows
                .into_iter()
                .map(|(id, name, created_at, last_used_at)| json!({
                    "id": id,
                    "name": name,
                    "created_at": created_at,
                    "last_used_at": last_used_at,
                }))
                .collect::<Vec<_>>(),
        }))
        .into_response(),
        Err(error) => database_problem("listing passkeys", &error),
    }
}

#[derive(Deserialize)]
struct AddStart {
    #[serde(default)]
    password: String,
}

/// Adding a passkey, first step: the reader's password (checked as sign-in
/// checks it, with the same waits), then the challenge for their device.
async fn add_start(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<AddStart>,
) -> Response {
    let webauthn = match checker(&state) {
        Ok(webauthn) => webauthn,
        Err(refusal) => return *refusal,
    };
    let found: Result<Option<SigningIn>, sqlx::Error> =
        sqlx::query_as("SELECT email, password_hash, owner FROM people WHERE id = ?")
            .bind(person)
            .fetch_optional(&state.db)
            .await;
    let (email, own_line, owner) = match found {
        Ok(Some(found)) => found,
        Ok(None) => return StatusCode::UNAUTHORIZED.into_response(),
        Err(error) => return database_problem("finding a reader", &error),
    };

    // Counted where this reader's sign-in counts: under their email, or for
    // an owner with none yet, the owner's own count (as `change_email`).
    let account = match email.as_deref() {
        Some(email) => Account::named(Some(email)),
        None if owner => Account::Owner,
        None => Account::Email(format!("reader {person}")),
    };
    let stored = own_line.or(match &state.config.password {
        PasswordSetting::Set(line) if owner => Some(line.clone()),
        _ => None,
    });
    if form.password.is_empty() {
        return refused(StatusCode::BAD_REQUEST, "password-needed");
    }
    if let Some(refusal) = ask_password(&state, &account, form.password, stored).await {
        return refusal;
    }

    if let Err(error) = clear_removed(&state, person).await {
        return database_problem("clearing removed passkeys", &error);
    }
    let existing: Result<Vec<Existing>, sqlx::Error> = sqlx::query_as(
        "SELECT credential_id, user_handle, removed_at FROM passkeys WHERE person_id = ?",
    )
    .bind(person)
    .fetch_all(&state.db)
    .await;
    let existing = match existing {
        Ok(existing) => existing,
        Err(error) => return database_problem("finding passkeys", &error),
    };
    let kept = existing.iter().filter(|(_, _, removed)| removed.is_none());
    if i64::try_from(kept.count()).unwrap_or(i64::MAX) >= MOST_PASSKEYS {
        return refused(StatusCode::CONFLICT, "too-many");
    }
    let handle = match existing
        .iter()
        .find_map(|(_, handle, _)| Uuid::parse_str(handle).ok())
    {
        Some(handle) => handle,
        None => {
            let mut bytes = [0u8; 16];
            if getrandom::fill(&mut bytes).is_err() {
                return StatusCode::INTERNAL_SERVER_ERROR.into_response();
            }
            Uuid::from_bytes(bytes)
        }
    };
    // The same device can't add a second passkey for the same reader. A
    // removed one (still within Undo) doesn't count: that device can add a
    // passkey again at once.
    let exclude: Vec<CredentialID> = existing
        .into_iter()
        .filter(|(_, _, removed)| removed.is_none())
        .map(|(id, _, _)| CredentialID::from(id))
        .collect();
    // What the device shows beside the passkey: the reader's email.
    let user_name = email.as_deref().unwrap_or("nine turtles");
    let (options, registration) =
        match webauthn.start_passkey_registration(handle, user_name, user_name, Some(exclude)) {
            Ok(started) => started,
            Err(error) => {
                log::problem(&format!("couldn't start adding a passkey: {error}"));
                return StatusCode::INTERNAL_SERVER_ERROR.into_response();
            }
        };
    let mut options = match serde_json::to_value(options) {
        Ok(options) => options,
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };
    // A passkey the device keeps itself ("discoverable"), so it can sign in
    // without an email typed first. Every passkey app keeps them this way.
    if let Some(Value::Object(selection)) = options.pointer_mut("/publicKey/authenticatorSelection")
    {
        selection.insert("residentKey".to_owned(), json!("required"));
        selection.insert("requireResidentKey".to_owned(), json!(true));
    }
    let step = Step::Adding {
        person,
        handle,
        registration,
    };
    match state.passkeys.begin(step) {
        Some(ticket) => Json(json!({ "ceremony": ticket, "options": options })).into_response(),
        None => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

#[derive(Deserialize)]
struct AddFinish {
    ceremony: String,
    credential: RegisterPublicKeyCredential,
}

/// Adding a passkey, second step: the device's answer, checked against the
/// challenge it was given; the passkey's public half is kept.
async fn add_finish(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<AddFinish>,
) -> Response {
    let webauthn = match checker(&state) {
        Ok(webauthn) => webauthn,
        Err(refusal) => return *refusal,
    };
    let Some(Step::Adding {
        person: theirs,
        handle,
        registration,
    }) = state.passkeys.take(&form.ceremony)
    else {
        return refused(StatusCode::GONE, "expired");
    };
    if theirs != person {
        return refused(StatusCode::GONE, "expired");
    }
    let passkey = match webauthn.finish_passkey_registration(&form.credential, &registration) {
        Ok(passkey) => passkey,
        Err(error) => {
            log::info(&format!("a new passkey didn't check out: {error}"));
            return refused(StatusCode::BAD_REQUEST, "refused");
        }
    };
    let Ok(stored) = serde_json::to_string(&passkey) else {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };
    // The same passkey added again after the reader removed it takes the
    // removed one's place (its Undo then finds nothing).
    let replaced = sqlx::query(
        "DELETE FROM passkeys WHERE person_id = ? AND credential_id = ? AND removed_at IS NOT NULL",
    )
    .bind(person)
    .bind(passkey.cred_id().as_ref())
    .execute(&state.db)
    .await;
    if let Err(error) = replaced {
        return database_problem("replacing a removed passkey", &error);
    }
    let added: Result<(i64, i64), sqlx::Error> = sqlx::query_as(
        "INSERT INTO passkeys (person_id, credential_id, user_handle, passkey, created_at)
         VALUES (?, ?, ?, ?, ?) RETURNING id, created_at",
    )
    .bind(person)
    .bind(passkey.cred_id().as_ref())
    .bind(handle.to_string())
    .bind(stored)
    .bind(now())
    .fetch_one(&state.db)
    .await;
    match added {
        Ok((id, created_at)) => (
            StatusCode::CREATED,
            Json(json!({
                "id": id,
                "name": null,
                "created_at": created_at,
                "last_used_at": null,
            })),
        )
            .into_response(),
        Err(sqlx::Error::Database(error)) if error.is_unique_violation() => {
            refused(StatusCode::CONFLICT, "already")
        }
        Err(error) => database_problem("saving a passkey", &error),
    }
}

#[derive(Deserialize)]
struct Rename {
    #[serde(default)]
    name: String,
}

/// A passkey's new name; an empty one means "Passkey added <the day>" again.
async fn rename(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<Rename>,
) -> Response {
    let name = form.name.trim();
    if name.chars().count() > LONGEST_NAME {
        return refused(StatusCode::BAD_REQUEST, "name-long");
    }
    let changed = sqlx::query(
        "UPDATE passkeys SET name = ? WHERE id = ? AND person_id = ? AND removed_at IS NULL",
    )
    .bind((!name.is_empty()).then_some(name))
    .bind(id)
    .bind(person)
    .execute(&state.db)
    .await;
    match changed {
        Ok(done) if done.rows_affected() == 1 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("naming a passkey", &error),
    }
}

/// Removes a passkey: it stops signing in at once, and Undo can bring it
/// back for `UNDO_FOR`. The reader's password is untouched.
async fn remove(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    if let Err(error) = clear_removed(&state, person).await {
        return database_problem("clearing removed passkeys", &error);
    }
    let removed = sqlx::query(
        "UPDATE passkeys SET removed_at = ? WHERE id = ? AND person_id = ? AND removed_at IS NULL",
    )
    .bind(now())
    .bind(id)
    .bind(person)
    .execute(&state.db)
    .await;
    match removed {
        Ok(done) if done.rows_affected() == 1 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("removing a passkey", &error),
    }
}

/// Undo for removing a passkey, while it's still kept.
async fn undo_remove(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let back = sqlx::query(
        "UPDATE passkeys SET removed_at = NULL WHERE id = ? AND person_id = ? AND removed_at > ?",
    )
    .bind(id)
    .bind(person)
    .bind(now() - UNDO_FOR)
    .execute(&state.db)
    .await;
    match back {
        Ok(done) if done.rows_affected() == 1 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => refused(StatusCode::GONE, "expired"),
        Err(error) => database_problem("bringing a passkey back", &error),
    }
}

/// Signing in with a passkey, first step: a challenge any of this site's
/// passkeys can answer, so no email is needed. The page asks the browser
/// with it, either from the button or from the email field's suggestions.
async fn sign_in_start(State(state): State<AppState>) -> Response {
    let webauthn = match checker(&state) {
        Ok(webauthn) => webauthn,
        Err(refusal) => return *refusal,
    };
    let (options, authentication) = match webauthn.start_discoverable_authentication() {
        Ok(started) => started,
        Err(error) => {
            log::problem(&format!("couldn't start a passkey sign-in: {error}"));
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };
    let Ok(mut options) = serde_json::to_value(options) else {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };
    // The page chooses: the browser's own sheet for the button, or the email
    // field's suggestions ("conditional").
    if let Value::Object(fields) = &mut options {
        fields.remove("mediation");
    }
    match state.passkeys.begin(Step::SigningIn(authentication)) {
        Some(ticket) => Json(json!({ "ceremony": ticket, "options": options })).into_response(),
        None => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

#[derive(Deserialize)]
struct SignInFinish {
    ceremony: String,
    credential: PublicKeyCredential,
}

/// Signing in with a passkey, second step: the passkey is found by its own
/// number, its reader's number must match, and its signature must answer
/// this challenge. Then the device is signed in exactly as by password.
/// A passkey can't be guessed, so a refusal never makes anyone wait.
async fn sign_in_finish(State(state): State<AppState>, Json(form): Json<SignInFinish>) -> Response {
    let webauthn = match checker(&state) {
        Ok(webauthn) => webauthn,
        Err(refusal) => return *refusal,
    };
    let Some(Step::SigningIn(authentication)) = state.passkeys.take(&form.ceremony) else {
        return refused(StatusCode::UNAUTHORIZED, "expired");
    };
    let not_known = || refused(StatusCode::UNAUTHORIZED, "passkey");
    let Ok((handle, credential_id)) =
        webauthn.identify_discoverable_authentication(&form.credential)
    else {
        return not_known();
    };
    let found: Result<Option<(i64, i64, String, String)>, sqlx::Error> = sqlx::query_as(
        "SELECT id, person_id, user_handle, passkey FROM passkeys
         WHERE credential_id = ? AND removed_at IS NULL",
    )
    .bind(credential_id)
    .fetch_optional(&state.db)
    .await;
    let (id, person, their_handle, stored) = match found {
        Ok(Some(found)) => found,
        Ok(None) => return not_known(),
        Err(error) => return database_problem("finding a passkey", &error),
    };
    if Uuid::parse_str(&their_handle).ok() != Some(handle) {
        return not_known();
    }
    let Ok(mut passkey) = serde_json::from_str::<Passkey>(&stored) else {
        log::problem("a stored passkey couldn't be read");
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };
    let result = match webauthn.finish_discoverable_authentication(
        &form.credential,
        authentication,
        &[DiscoverableKey::from(&passkey)],
    ) {
        Ok(result) => result,
        Err(error) => {
            // Counted as information, not a problem, so nobody can push
            // real problems out of view by sending bad answers.
            log::info(&format!("a passkey sign-in didn't check out: {error}"));
            return not_known();
        }
    };
    passkey.update_credential(&result);
    let Ok(stored) = serde_json::to_string(&passkey) else {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };
    let used = sqlx::query("UPDATE passkeys SET passkey = ?, last_used_at = ? WHERE id = ?")
        .bind(stored)
        .bind(now())
        .bind(id)
        .execute(&state.db)
        .await;
    if let Err(error) = used {
        return database_problem("noting a passkey's use", &error);
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

#[cfg(test)]
mod tests {
    use super::*;

    fn signing_in() -> Step {
        let webauthn = relying_party(None).unwrap().0;
        Step::SigningIn(webauthn.start_discoverable_authentication().unwrap().1)
    }

    #[test]
    fn a_challenge_is_used_once_and_runs_out() {
        let start = Instant::now();
        let mut ceremonies = Ceremonies::default();
        ceremonies.begin("one".to_owned(), signing_in(), start);
        assert!(ceremonies.take("one", start).is_some());
        assert!(ceremonies.take("one", start).is_none());

        ceremonies.begin("two".to_owned(), signing_in(), start);
        assert!(ceremonies.take("two", start + CEREMONY_LIFETIME).is_none());
    }

    fn adding(person: i64) -> Step {
        let webauthn = relying_party(None).unwrap().0;
        let handle = Uuid::from_bytes([7; 16]);
        let (_, registration) = webauthn
            .start_passkey_registration(handle, "reader", "reader", None)
            .unwrap();
        Step::Adding {
            person,
            handle,
            registration,
        }
    }

    #[test]
    fn a_full_sign_in_pool_forgets_its_oldest_and_never_touches_adding() {
        let start = Instant::now();
        let mut ceremonies = Ceremonies::default();
        ceremonies.begin("adding".to_owned(), adding(1), start);
        for number in 0..MOST_SIGN_INS {
            let when = start + Duration::from_millis(u64::try_from(number).unwrap());
            ceremonies.begin(number.to_string(), signing_in(), when);
        }
        assert_eq!(ceremonies.waiting(), (MOST_SIGN_INS, 1));
        // One more: the oldest sign-in gives way, the newest works.
        let now = start + Duration::from_secs(2);
        ceremonies.begin("one more".to_owned(), signing_in(), now);
        assert_eq!(ceremonies.waiting(), (MOST_SIGN_INS, 1));
        assert!(ceremonies.take("0", now).is_none());
        assert!(ceremonies.take("1", now).is_some());
        assert!(ceremonies.take("one more", now).is_some());
        // The reader adding a passkey was never pushed out.
        assert!(matches!(
            ceremonies.take("adding", now),
            Some(Step::Adding { person: 1, .. })
        ));
    }

    #[test]
    fn a_reader_adding_a_passkey_has_only_their_newest_challenge() {
        let start = Instant::now();
        let mut ceremonies = Ceremonies::default();
        ceremonies.begin("first".to_owned(), adding(1), start);
        ceremonies.begin("someone else".to_owned(), adding(2), start);
        ceremonies.begin("second".to_owned(), adding(1), start);
        assert_eq!(ceremonies.waiting(), (0, 2));
        assert!(ceremonies.take("first", start).is_none());
        assert!(ceremonies.take("second", start).is_some());
        // Once they've run out, they're gone.
        let later = start + CEREMONY_LIFETIME;
        ceremonies.begin("third".to_owned(), signing_in(), later);
        assert_eq!(ceremonies.waiting(), (1, 0));
    }

    #[test]
    fn passkeys_belong_to_the_public_address_or_localhost() {
        let public = reqwest::Url::parse("https://app.nineturtles.app/").unwrap();
        assert_eq!(
            relying_party(Some(&public)).unwrap().1,
            "https://app.nineturtles.app"
        );
        assert_eq!(relying_party(None).unwrap().1, "http://localhost");
        // A numeric address can't carry passkeys, so they're off.
        let numeric = reqwest::Url::parse("http://127.0.0.1:8080").unwrap();
        assert!(relying_party(Some(&numeric)).is_none());
    }
}
