//! Passkey sign-in (SPEC sections 1 and 18, decision 0109), tested against a
//! real running nine turtles with the webauthn-rs project's own software
//! passkey standing in for a phone or a laptop's fingerprint reader.

mod common;

use common::{PASSWORD, another_reader, signed_in, start_with_state};
use reqwest::{Client, Response, StatusCode};
use serde_json::{Value, json};
use webauthn_authenticator_rs::{WebauthnAuthenticator, softpasskey::SoftPasskey};
use webauthn_rs::prelude::{
    CreationChallengeResponse, PublicKeyCredential, RequestChallengeResponse, Url,
};

/// Without NINE_TURTLES_PUBLIC_URL, passkeys belong to localhost, any port.
const ORIGIN: &str = "http://localhost:4318";

async fn post(base: &str, path: &str, cookie: Option<&str>, body: Value) -> Response {
    let mut request = Client::new()
        .post(format!("{base}{path}"))
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body(body.to_string());
    if let Some(cookie) = cookie {
        request = request.header("cookie", cookie);
    }
    request.send().await.unwrap()
}

async fn get(base: &str, path: &str, cookie: &str) -> Value {
    Client::new()
        .get(format!("{base}{path}"))
        .header("cookie", cookie)
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap()
        .parse()
        .unwrap()
}

async fn error_of(response: Response) -> String {
    let body: Value = response.text().await.unwrap().parse().unwrap();
    body["error"].as_str().unwrap_or_default().to_owned()
}

fn cookie_from(response: &Response) -> String {
    let set_cookie = response.headers()["set-cookie"].to_str().unwrap();
    set_cookie.split(';').next().unwrap().to_owned()
}

/// A device with one software passkey in it.
fn device() -> WebauthnAuthenticator<SoftPasskey> {
    WebauthnAuthenticator::new(SoftPasskey::new(true))
}

/// What a passkey added: its number (base64url) and the reader's handle,
/// as the device keeps them.
struct Added {
    credential_id: String,
    handle: String,
}

/// Adds a passkey for whoever `cookie` signs in, as Settings does: the
/// password, then the device's answer. Answers the finishing response.
async fn add(
    base: &str,
    cookie: &str,
    password: &str,
    device: &mut WebauthnAuthenticator<SoftPasskey>,
) -> (Response, Option<Added>) {
    let started = post(
        base,
        "/api/passkeys/add",
        Some(cookie),
        json!({ "password": password }),
    )
    .await;
    if started.status() != StatusCode::OK {
        return (started, None);
    }
    let started: Value = started.text().await.unwrap().parse().unwrap();
    let mut options = started["options"].clone();
    // nine turtles asks for a passkey the device keeps itself; the software
    // one can't, so the test asks it for an ordinary one.
    assert_eq!(
        options["publicKey"]["authenticatorSelection"]["residentKey"],
        "required"
    );
    options["publicKey"]["authenticatorSelection"]["residentKey"] = json!("discouraged");
    options["publicKey"]["authenticatorSelection"]["requireResidentKey"] = json!(false);
    let handle = options["publicKey"]["user"]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let options: CreationChallengeResponse = serde_json::from_value(options).unwrap();
    let credential = device
        .do_registration(Url::parse(ORIGIN).unwrap(), options)
        .unwrap();
    let credential = serde_json::to_value(&credential).unwrap();
    let credential_id = credential["id"].as_str().unwrap().to_owned();
    let finished = post(
        base,
        "/api/passkeys/add/finish",
        Some(cookie),
        json!({ "ceremony": started["ceremony"], "credential": credential }),
    )
    .await;
    (
        finished,
        Some(Added {
            credential_id,
            handle,
        }),
    )
}

/// The device's answer to a passkey sign-in, and the challenge's ticket.
async fn answer(
    base: &str,
    device: &mut WebauthnAuthenticator<SoftPasskey>,
    added: &Added,
) -> Value {
    let started: Value = post(base, "/api/sign-in/passkey", None, json!({}))
        .await
        .text()
        .await
        .unwrap()
        .parse()
        .unwrap();
    let mut options = started["options"].clone();
    // Any of the site's passkeys may answer (no email needed). A real
    // device finds its own; the software one is shown which.
    assert_eq!(options["publicKey"]["allowCredentials"], json!([]));
    options["publicKey"]["allowCredentials"] =
        json!([{ "type": "public-key", "id": added.credential_id }]);
    let options: RequestChallengeResponse = serde_json::from_value(options).unwrap();
    let credential: PublicKeyCredential = device
        .do_authentication(Url::parse(ORIGIN).unwrap(), options)
        .unwrap();
    let mut credential = serde_json::to_value(&credential).unwrap();
    // A real passkey hands back its reader's handle; the software one doesn't keep it.
    credential["response"]["userHandle"] = json!(added.handle);
    json!({ "ceremony": started["ceremony"], "credential": credential })
}

#[tokio::test]
async fn a_reader_adds_a_passkey_and_signs_in_with_it() {
    let (base, _state) = start_with_state(common::config()).await;
    let owner = signed_in(&base).await;

    // Passkeys are offered here, at localhost.
    let session = get(&base, "/api/session", &owner).await;
    assert_eq!(session["passkeys"], "http://localhost");

    let mut phone = device();
    let (finished, added) = add(&base, &owner, PASSWORD, &mut phone).await;
    assert_eq!(finished.status(), StatusCode::CREATED);
    let added = added.unwrap();
    let listed = get(&base, "/api/passkeys", &owner).await;
    let passkeys = listed["passkeys"].as_array().unwrap();
    assert_eq!(passkeys.len(), 1);
    assert_eq!(passkeys[0]["name"], Value::Null);
    assert_eq!(passkeys[0]["last_used_at"], Value::Null);

    // Signed out, the passkey signs this device in as the owner.
    let finish = answer(&base, &mut phone, &added).await;
    let signed = post(&base, "/api/sign-in/passkey/finish", None, finish.clone()).await;
    assert_eq!(signed.status(), StatusCode::NO_CONTENT);
    let cookie = cookie_from(&signed);
    let session = get(&base, "/api/session", &cookie).await;
    assert_eq!(session["signed_in"], true);
    assert_eq!(session["owner"], true);
    let listed = get(&base, "/api/passkeys", &owner).await;
    assert!(listed["passkeys"][0]["last_used_at"].is_i64());

    // The same answer again is refused: each challenge works once.
    let again = post(&base, "/api/sign-in/passkey/finish", None, finish).await;
    assert_eq!(again.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(error_of(again).await, "expired");

    // A made-up challenge ticket is refused the same way.
    let mut made_up = answer(&base, &mut phone, &added).await;
    made_up["ceremony"] = json!("0".repeat(64));
    let refused = post(&base, "/api/sign-in/passkey/finish", None, made_up).await;
    assert_eq!(error_of(refused).await, "expired");

    // The password still works.
    assert_ne!(signed_in(&base).await, "");
}

#[tokio::test]
async fn adding_a_passkey_needs_the_password() {
    let (base, _state) = start_with_state(common::config()).await;
    let owner = signed_in(&base).await;
    let refused = post(&base, "/api/passkeys/add", Some(&owner), json!({})).await;
    assert_eq!(refused.status(), StatusCode::BAD_REQUEST);
    assert_eq!(error_of(refused).await, "password-needed");
    let (wrong, _) = add(&base, &owner, "not the password", &mut device()).await;
    assert_eq!(wrong.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(error_of(wrong).await, "wrong-password");
    // Not signed in: nothing at all.
    let stranger = post(
        &base,
        "/api/passkeys/add",
        None,
        json!({ "password": PASSWORD }),
    )
    .await;
    assert_eq!(stranger.status(), StatusCode::UNAUTHORIZED);
    let listed = get(&base, "/api/passkeys", &owner).await;
    assert_eq!(listed["passkeys"], json!([]));
}

#[tokio::test]
async fn a_removed_passkey_stops_signing_in_until_undo_and_the_name_can_change() {
    let (base, _state) = start_with_state(common::config()).await;
    let owner = signed_in(&base).await;
    let mut laptop = device();
    let (finished, added) = add(&base, &owner, PASSWORD, &mut laptop).await;
    let id = finished.text().await.unwrap().parse::<Value>().unwrap()["id"]
        .as_i64()
        .unwrap();
    let added = added.unwrap();

    let named = post(
        &base,
        &format!("/api/passkeys/{id}/name"),
        Some(&owner),
        json!({ "name": "  Laptop  " }),
    )
    .await;
    assert_eq!(named.status(), StatusCode::NO_CONTENT);
    let listed = get(&base, "/api/passkeys", &owner).await;
    assert_eq!(listed["passkeys"][0]["name"], "Laptop");
    let too_long = post(
        &base,
        &format!("/api/passkeys/{id}/name"),
        Some(&owner),
        json!({ "name": "x".repeat(101) }),
    )
    .await;
    assert_eq!(error_of(too_long).await, "name-long");

    let removed = post(
        &base,
        &format!("/api/passkeys/{id}/remove"),
        Some(&owner),
        json!({}),
    )
    .await;
    assert_eq!(removed.status(), StatusCode::NO_CONTENT);
    assert_eq!(
        get(&base, "/api/passkeys", &owner).await["passkeys"],
        json!([])
    );
    let finish = answer(&base, &mut laptop, &added).await;
    let refused = post(&base, "/api/sign-in/passkey/finish", None, finish).await;
    assert_eq!(refused.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(error_of(refused).await, "passkey");

    let undone = post(
        &base,
        &format!("/api/passkeys/{id}/undo"),
        Some(&owner),
        json!({}),
    )
    .await;
    assert_eq!(undone.status(), StatusCode::NO_CONTENT);
    let finish = answer(&base, &mut laptop, &added).await;
    let signed = post(&base, "/api/sign-in/passkey/finish", None, finish).await;
    assert_eq!(signed.status(), StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn each_readers_passkeys_are_theirs_alone() {
    let (base, state) = start_with_state(common::config()).await;
    let owner = signed_in(&base).await;
    let mut phone = device();
    let (finished, added) = add(&base, &owner, PASSWORD, &mut phone).await;
    let id = finished.text().await.unwrap().parse::<Value>().unwrap()["id"]
        .as_i64()
        .unwrap();
    let added = added.unwrap();

    let (reader, theirs) = another_reader(&state).await;
    // They see none of the owner's passkeys, and can't name, remove or bring one back.
    assert_eq!(
        get(&base, "/api/passkeys", &theirs).await["passkeys"],
        json!([])
    );
    for action in ["name", "remove", "undo"] {
        let response = post(
            &base,
            &format!("/api/passkeys/{id}/{action}"),
            Some(&theirs),
            json!({ "name": "Mine now" }),
        )
        .await;
        assert!(
            matches!(response.status(), StatusCode::NOT_FOUND | StatusCode::GONE),
            "{action}: {}",
            response.status()
        );
    }
    assert_eq!(
        get(&base, "/api/passkeys", &owner).await["passkeys"][0]["name"],
        Value::Null
    );

    // A challenge to add a passkey is only for whoever asked for it: the
    // other reader can't finish the owner's.
    let started: Value = post(
        &base,
        "/api/passkeys/add",
        Some(&owner),
        json!({ "password": PASSWORD }),
    )
    .await
    .text()
    .await
    .unwrap()
    .parse()
    .unwrap();
    let finished = post(
        &base,
        "/api/passkeys/add/finish",
        Some(&theirs),
        json!({ "ceremony": started["ceremony"], "credential": {
            "id": "AAAA", "rawId": "AAAA", "type": "public-key",
            "response": { "attestationObject": "AAAA", "clientDataJSON": "AAAA" },
            "extensions": {}
        } }),
    )
    .await;
    assert_eq!(finished.status(), StatusCode::GONE);

    // The owner's passkey, answered with another reader's handle, signs nobody in.
    let mut finish = answer(&base, &mut phone, &added).await;
    finish["credential"]["response"]["userHandle"] = json!("AAAAAAAAAAAAAAAAAAAAAA");
    let refused = post(&base, "/api/sign-in/passkey/finish", None, finish).await;
    assert_eq!(refused.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(error_of(refused).await, "passkey");

    // Deleting the other reader's account leaves the owner's passkey alone.
    nine_turtles::people::delete(&state.db, reader)
        .await
        .unwrap();
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM passkeys WHERE person_id = 1")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(count, 1);
}
