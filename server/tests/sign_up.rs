//! Signing up confirms the address first (SPEC section 1, decision 0154):
//! the account is made only when the link emailed to it is followed, tested
//! against a real running nine turtles whose emails land in an outbox.

mod common;

use common::{emails_to, newest_link, signed_in, start_with_mail, start_with_state};
use reqwest::{Client, Response, StatusCode};
use serde_json::{Value, json};

const PASSWORD: &str = "slow mornings, long reads";
const OTHER_PASSWORD: &str = "a new page every morning";

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

async fn sign_up(base: &str, email: &str, password: &str) -> Response {
    post(
        base,
        "/api/sign-up",
        None,
        json!({ "email": email, "password": password }),
    )
    .await
}

async fn sign_in(base: &str, email: &str, password: &str) -> Response {
    post(
        base,
        "/api/sign-in",
        None,
        json!({ "email": email, "password": password }),
    )
    .await
}

/// Follows a sign-up's link, typing `password`.
async fn finish(base: &str, ticket: &str, password: &str) -> Response {
    post(
        base,
        "/api/sign-up/finish",
        None,
        json!({ "ticket": ticket, "password": password }),
    )
    .await
}

async fn session(base: &str, cookie: &str) -> Value {
    let response = Client::new()
        .get(format!("{base}/api/session"))
        .header("cookie", cookie)
        .send()
        .await
        .unwrap();
    json_of(response).await
}

async fn json_of(response: Response) -> Value {
    response
        .text()
        .await
        .unwrap_or_default()
        .parse()
        .unwrap_or(Value::Null)
}

fn cookie_from(response: &Response) -> String {
    let set_cookie = response.headers()["set-cookie"].to_str().unwrap();
    set_cookie.split(';').next().unwrap().to_owned()
}

async fn error_of(response: Response) -> String {
    let body = json_of(response).await;
    body["error"].as_str().unwrap_or_default().to_owned()
}

async fn a_minute_passes(db: &sqlx::SqlitePool) {
    sqlx::query("UPDATE email_links SET created_at = created_at - 61")
        .execute(db)
        .await
        .unwrap();
}

#[tokio::test]
async fn the_account_is_made_only_when_the_emailed_link_is_followed() {
    let (base, _, outbox) = start_with_mail(common::config()).await;
    let email = "mira@example.com";

    let asked = sign_up(&base, email, PASSWORD).await;
    assert_eq!(asked.status(), StatusCode::ACCEPTED);
    // Nobody is signed in yet: the only cookie is the sign-up's own secret (decision 0193).
    for cookie in asked.headers().get_all("set-cookie") {
        assert!(
            cookie
                .to_str()
                .unwrap()
                .starts_with("nine_turtles_sign_up=")
        );
    }
    let body = json_of(asked).await;
    assert_eq!(body["sent_to"], email);

    // Nothing is made yet: the password signs nobody in.
    assert_eq!(
        sign_in(&base, email, PASSWORD).await.status(),
        StatusCode::UNAUTHORIZED
    );

    let sent = emails_to(&outbox, email);
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0].subject, "Confirm your email for nine turtles");
    assert!(sent[0].body.contains("24 hours"));
    // Every link email opens and ends the same way (decision 0200).
    assert!(
        sent[0]
            .body
            .contains("Someone, hopefully you, asked to sign up")
    );
    assert!(
        sent[0]
            .body
            .contains("If you didn't ask, ignore this email")
    );
    let (page, ticket) = newest_link(&outbox, email);
    assert_eq!(page, "/finish-sign-up");

    // A wrong password makes nothing, and the link keeps working.
    let wrong = finish(&base, &ticket, OTHER_PASSWORD).await;
    assert_eq!(wrong.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(error_of(wrong).await, "wrong-password");

    // With the password chosen at sign-up, it makes the account, confirmed,
    // and signs this device in.
    let made = finish(&base, &ticket, PASSWORD).await;
    assert_eq!(made.status(), StatusCode::OK);
    let cookie = cookie_from(&made);
    let body = json_of(made).await;
    assert_eq!(body["done"], "signed-up");
    let now = session(&base, &cookie).await;
    assert_eq!(now["signed_in"], true);
    assert_eq!(now["owner"], false);
    assert_eq!(now["email"], email);
    assert_eq!(now["email_confirmed"], true);
    assert_eq!(
        sign_in(&base, email, PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );

    // The link works once.
    let again = finish(&base, &ticket, PASSWORD).await;
    assert_eq!(again.status(), StatusCode::GONE);
    assert_eq!(error_of(again).await, "expired");
}

#[tokio::test]
async fn a_strangers_later_sign_up_cant_hand_over_the_strangers_password() {
    let (base, state, outbox) = start_with_mail(common::config()).await;
    let email = "sam@example.com";

    // The address's owner signs up; a minute later a stranger signs up
    // with the same address and a password of their own.
    assert_eq!(
        sign_up(&base, email, PASSWORD).await.status(),
        StatusCode::ACCEPTED
    );
    let (_, first) = newest_link(&outbox, email);
    a_minute_passes(&state.db).await;
    assert_eq!(
        sign_up(&base, email, OTHER_PASSWORD).await.status(),
        StatusCode::ACCEPTED
    );
    let (_, second) = newest_link(&outbox, email);
    assert_ne!(first, second);

    // The owner opens the newest email (the stranger's) and types their own
    // password: the account is theirs, with their password.
    assert_eq!(
        finish(&base, &second, PASSWORD).await.status(),
        StatusCode::OK
    );
    assert_eq!(
        sign_in(&base, email, OTHER_PASSWORD).await.status(),
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        sign_in(&base, email, PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );
    // Every other waiting link for the address is spent.
    assert_eq!(
        finish(&base, &first, PASSWORD).await.status(),
        StatusCode::GONE
    );
}

#[tokio::test]
async fn when_the_hours_accounts_are_made_the_same_link_works_later() {
    let (base, state, outbox) = start_with_mail(common::config()).await;
    let email = "later@example.com";
    sign_up(&base, email, PASSWORD).await;
    let (_, ticket) = newest_link(&outbox, email);
    // The hour's accounts made.
    for number in 0..nine_turtles::sign_up::SIGN_UPS_PER_HOUR {
        sqlx::query("INSERT INTO people (owner, email, created_at) VALUES (0, ?, ?)")
            .bind(format!("someone{number}@example.com"))
            .bind(nine_turtles::now())
            .execute(&state.db)
            .await
            .unwrap();
    }
    let full = finish(&base, &ticket, PASSWORD).await;
    assert_eq!(full.status(), StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(error_of(full).await, "too-many");
    // An hour on, the same link makes the account.
    sqlx::query("UPDATE people SET created_at = created_at - 3601 WHERE owner = 0")
        .execute(&state.db)
        .await
        .unwrap();
    assert_eq!(
        finish(&base, &ticket, PASSWORD).await.status(),
        StatusCode::OK
    );
}

#[tokio::test]
async fn an_address_with_an_account_is_answered_as_any_other_and_emailed_to_say_so() {
    let (base, state, outbox) = start_with_mail(common::config()).await;
    signed_in(&base).await;
    // Answered exactly as a new address is (decision 0195).
    let taken = sign_up(&base, common::OWNER_EMAIL, PASSWORD).await;
    let new = sign_up(&base, "new@example.com", PASSWORD).await;
    assert_eq!(taken.status(), StatusCode::ACCEPTED);
    assert_eq!(taken.status(), new.status());
    assert_eq!(
        taken.headers().get("set-cookie").is_some(),
        new.headers().get("set-cookie").is_some()
    );
    assert_eq!(json_of(taken).await["sent_to"], common::OWNER_EMAIL);

    // The address gets a note, with no link in it, and nothing changes.
    let sent = emails_to(&outbox, common::OWNER_EMAIL);
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0].subject, "You already have a nine turtles account");
    assert!(sent[0].body.contains("Forgot?"));
    assert!(!sent[0].body.contains("ticket="));
    assert_eq!(
        sign_in(&base, common::OWNER_EMAIL, PASSWORD).await.status(),
        StatusCode::UNAUTHORIZED
    );

    // It keeps the address's limits: one a minute, three an hour.
    sign_up(&base, common::OWNER_EMAIL, PASSWORD).await;
    assert_eq!(emails_to(&outbox, common::OWNER_EMAIL).len(), 1);
    for _ in 0..4 {
        a_minute_passes(&state.db).await;
        assert_eq!(
            sign_up(&base, common::OWNER_EMAIL, PASSWORD).await.status(),
            StatusCode::ACCEPTED
        );
    }
    assert_eq!(emails_to(&outbox, common::OWNER_EMAIL).len(), 3);
}

#[tokio::test]
async fn a_link_for_an_address_that_got_an_account_meanwhile_makes_nothing() {
    let (base, state, outbox) = start_with_mail(common::config()).await;
    let email = "kai@example.com";
    sign_up(&base, email, PASSWORD).await;
    let (_, ticket) = newest_link(&outbox, email);
    // Someone else's account takes the address first (as a changed email might).
    sqlx::query("INSERT INTO people (owner, email, created_at) VALUES (0, ?, 0)")
        .bind(email)
        .execute(&state.db)
        .await
        .unwrap();
    let late = finish(&base, &ticket, PASSWORD).await;
    assert_eq!(late.status(), StatusCode::CONFLICT);
    assert_eq!(error_of(late).await, "already");
    // The late link's password never signs in.
    assert_eq!(
        sign_in(&base, email, PASSWORD).await.status(),
        StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn sign_up_emails_keep_to_three_an_address_in_an_hour() {
    let (base, state, outbox) = start_with_mail(common::config()).await;
    let email = "flood@example.com";
    for _ in 0..5 {
        assert_eq!(
            sign_up(&base, email, PASSWORD).await.status(),
            StatusCode::ACCEPTED
        );
        a_minute_passes(&state.db).await;
    }
    assert_eq!(emails_to(&outbox, email).len(), 3);
}

#[tokio::test]
async fn pressing_sign_up_twice_sends_one_email() {
    let (base, _, outbox) = start_with_mail(common::config()).await;
    let email = "twice@example.com";
    for _ in 0..2 {
        assert_eq!(
            sign_up(&base, email, PASSWORD).await.status(),
            StatusCode::ACCEPTED
        );
    }
    assert_eq!(emails_to(&outbox, email).len(), 1);
}

#[tokio::test]
async fn without_email_the_account_is_made_at_once_unconfirmed() {
    let (base, _) = start_with_state(common::config()).await;
    let made = sign_up(&base, "local@example.com", PASSWORD).await;
    assert_eq!(made.status(), StatusCode::NO_CONTENT);
    let now = session(&base, &cookie_from(&made)).await;
    assert_eq!(now["signed_in"], true);
    assert_eq!(now["email_confirmed"], false);
}

#[tokio::test]
async fn a_sign_in_link_confirms_an_address_from_before() {
    let (base, state, outbox) = start_with_mail(common::config()).await;
    let email = "early@example.com";
    // A reader who signed up before addresses were confirmed.
    let line = nine_turtles::password::hash(PASSWORD).unwrap();
    sqlx::query("INSERT INTO people (owner, email, password_hash, created_at) VALUES (0, ?, ?, 0)")
        .bind(email)
        .bind(&line)
        .execute(&state.db)
        .await
        .unwrap();
    let signed = sign_in(&base, email, PASSWORD).await;
    let cookie = cookie_from(&signed);
    assert_eq!(session(&base, &cookie).await["email_confirmed"], false);

    post(&base, "/api/sign-in/link", None, json!({ "email": email })).await;
    let (_, ticket) = newest_link(&outbox, email);
    let used = post(
        &base,
        "/api/sign-in/link/use",
        None,
        json!({ "ticket": ticket }),
    )
    .await;
    assert_eq!(used.status(), StatusCode::OK);
    assert_eq!(session(&base, &cookie).await["email_confirmed"], true);
}

#[tokio::test]
async fn following_a_changed_address_link_confirms_it() {
    let (base, _, outbox) = start_with_mail(common::config()).await;
    let owner = signed_in(&base).await;
    let changed = post(
        &base,
        "/api/people/me/email/change",
        Some(&owner),
        json!({ "email": "moved@example.com", "password": common::PASSWORD }),
    )
    .await;
    assert_eq!(changed.status(), StatusCode::ACCEPTED);
    assert_eq!(session(&base, &owner).await["email_confirmed"], false);
    let (_, ticket) = newest_link(&outbox, "moved@example.com");
    let confirmed = post(
        &base,
        "/api/email/confirm",
        None,
        json!({ "ticket": ticket }),
    )
    .await;
    assert_eq!(confirmed.status(), StatusCode::OK);
    assert_eq!(session(&base, &owner).await["email_confirmed"], true);
}

#[tokio::test]
async fn signing_up_again_within_the_minute_keeps_the_new_password_for_the_link_sent() {
    let (base, _, outbox) = start_with_mail(common::config()).await;
    let email = "retyped@example.com";
    sign_up(&base, email, PASSWORD).await;
    // Back to the form, a new password, at once: no second email, the same answer.
    let again = sign_up(&base, email, OTHER_PASSWORD).await;
    assert_eq!(again.status(), StatusCode::ACCEPTED);
    assert_eq!(emails_to(&outbox, email).len(), 1);
    // The one link sent finishes it with the newer password.
    let (_, ticket) = newest_link(&outbox, email);
    assert_eq!(
        finish(&base, &ticket, OTHER_PASSWORD).await.status(),
        StatusCode::OK
    );
    assert_eq!(
        sign_in(&base, email, OTHER_PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );
}

#[tokio::test]
async fn wrong_passwords_on_the_link_are_slowed_down_as_sign_in_does() {
    let (base, _, outbox) = start_with_mail(common::config()).await;
    let email = "guess@example.com";
    sign_up(&base, email, PASSWORD).await;
    let (_, ticket) = newest_link(&outbox, email);
    // A password too long to be anyone's is refused at once.
    let long = finish(&base, &ticket, &"a".repeat(2000)).await;
    assert_eq!(long.status(), StatusCode::UNAUTHORIZED);
    let mut last = StatusCode::OK;
    for _ in 0..6 {
        last = finish(&base, &ticket, "not the password at all")
            .await
            .status();
    }
    assert_eq!(last, StatusCode::TOO_MANY_REQUESTS);
    let waiting = finish(&base, &ticket, PASSWORD).await;
    assert_eq!(waiting.status(), StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(error_of(waiting).await, "wait");
}

/// The sign-up secret the browser that pressed Sign up keeps (decision 0193).
fn sign_up_cookie(response: &Response) -> String {
    response
        .headers()
        .get_all("set-cookie")
        .iter()
        .map(|value| value.to_str().unwrap())
        .find(|value| value.starts_with("nine_turtles_sign_up="))
        .expect("a sign-up secret")
        .split(';')
        .next()
        .unwrap()
        .to_owned()
}

async fn check(base: &str, ticket: &str, cookie: Option<&str>) -> Response {
    post(
        base,
        "/api/sign-up/check",
        cookie,
        json!({ "ticket": ticket }),
    )
    .await
}

#[tokio::test]
async fn the_browser_that_signed_up_confirms_without_the_password() {
    let (base, _, outbox) = start_with_mail(common::config()).await;
    let email = "same@example.com";
    let asked = sign_up(&base, email, PASSWORD).await;
    assert_eq!(asked.status(), StatusCode::ACCEPTED);
    let browser = sign_up_cookie(&asked);
    let header = asked.headers()["set-cookie"].to_str().unwrap().to_owned();
    for part in ["HttpOnly", "Secure", "SameSite=Lax", "Path=/api/sign-up"] {
        assert!(header.contains(part), "{part}");
    }
    let (_, ticket) = newest_link(&outbox, email);

    // Asking uses nothing up: this browser needs no password, any other does.
    let here = json_of(check(&base, &ticket, Some(&browser)).await).await;
    assert_eq!(here["same_browser"], true);
    let elsewhere = json_of(check(&base, &ticket, None).await).await;
    assert_eq!(elsewhere["same_browser"], false);

    // Elsewhere, an empty password is asked for; nothing is counted or made.
    let without = post(
        &base,
        "/api/sign-up/finish",
        None,
        json!({ "ticket": ticket, "password": "" }),
    )
    .await;
    assert_eq!(without.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(error_of(without).await, "password-needed");

    // Here, one press makes the account, signs in, and forgets the secret.
    let made = post(
        &base,
        "/api/sign-up/finish",
        Some(&browser),
        json!({ "ticket": ticket }),
    )
    .await;
    assert_eq!(made.status(), StatusCode::OK);
    let cookies: Vec<String> = made
        .headers()
        .get_all("set-cookie")
        .iter()
        .map(|value| value.to_str().unwrap().to_owned())
        .collect();
    assert!(
        cookies
            .iter()
            .any(|cookie| cookie.starts_with("nine_turtles_sign_up=;")
                && cookie.contains("Max-Age=0"))
    );
    let session_cookie = cookie_from(&made);
    let now = session(&base, &session_cookie).await;
    assert_eq!(now["signed_in"], true);
    assert_eq!(now["email_confirmed"], true);
    assert_eq!(
        sign_in(&base, email, PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );
    // The link works once, from here too.
    assert_eq!(
        check(&base, &ticket, Some(&browser)).await.status(),
        StatusCode::GONE
    );
}

#[tokio::test]
async fn a_strangers_browser_secret_never_finishes_someone_elses_link() {
    let (base, state, outbox) = start_with_mail(common::config()).await;
    let email = "owner@example.com";
    // The address's owner signs up; a minute later a stranger signs up with the same
    // address, from their own browser, and keeps that browser's secret.
    assert_eq!(
        sign_up(&base, email, PASSWORD).await.status(),
        StatusCode::ACCEPTED
    );
    let (_, owners) = newest_link(&outbox, email);
    a_minute_passes(&state.db).await;
    let strangers = sign_up(&base, email, OTHER_PASSWORD).await;
    let stranger = sign_up_cookie(&strangers);
    // The stranger never gets the email, so has no ticket: a made-up one does nothing.
    let guessed = post(
        &base,
        "/api/sign-up/finish",
        Some(&stranger),
        json!({ "ticket": "0".repeat(64) }),
    )
    .await;
    assert_eq!(guessed.status(), StatusCode::GONE);
    // The owner's browser holds no secret of the stranger's: they're asked their password.
    assert_eq!(
        json_of(check(&base, &owners, None).await).await["same_browser"],
        false
    );
    assert_eq!(
        finish(&base, &owners, PASSWORD).await.status(),
        StatusCode::OK
    );
    assert_eq!(
        sign_in(&base, email, OTHER_PASSWORD).await.status(),
        StatusCode::UNAUTHORIZED
    );

    // A secret from another address's sign-up never stands in for this one's password.
    let other = sign_up(&base, "else@example.com", PASSWORD).await;
    let other_secret = sign_up_cookie(&other);
    assert_eq!(
        sign_up(&base, "third@example.com", PASSWORD).await.status(),
        StatusCode::ACCEPTED
    );
    let (_, third) = newest_link(&outbox, "third@example.com");
    let crossed = post(
        &base,
        "/api/sign-up/finish",
        Some(&other_secret),
        json!({ "ticket": third }),
    )
    .await;
    assert_eq!(error_of(crossed).await, "password-needed");
}

#[tokio::test]
async fn a_browser_keeps_one_secret_for_all_its_sign_ups() {
    let (base, _, outbox) = start_with_mail(common::config()).await;
    // A mistyped address first, then "Use another email" and the right one, from one browser.
    let first = sign_up(&base, "mistyped@example.com", PASSWORD).await;
    let browser = sign_up_cookie(&first);
    let second = post(
        &base,
        "/api/sign-up",
        Some(&browser),
        json!({ "email": "right@example.com", "password": PASSWORD }),
    )
    .await;
    assert_eq!(sign_up_cookie(&second), browser);
    // Either link needs only one press in this browser.
    for email in ["mistyped@example.com", "right@example.com"] {
        let (_, ticket) = newest_link(&outbox, email);
        let here = json_of(check(&base, &ticket, Some(&browser)).await).await;
        assert_eq!(here["same_browser"], true, "{email}");
    }
}
