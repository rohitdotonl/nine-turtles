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

async fn confirm(base: &str, ticket: &str) -> Response {
    post(
        base,
        "/api/email/confirm",
        None,
        json!({ "ticket": ticket }),
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
    assert!(asked.headers().get("set-cookie").is_none());
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
    assert!(sent[0].body.contains("If you didn't sign up"));
    let (page, ticket) = newest_link(&outbox, email);
    assert_eq!(page, "/confirm-email");

    // Following it makes the account, confirmed, and signs this device in.
    let made = confirm(&base, &ticket).await;
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
    let again = confirm(&base, &ticket).await;
    assert_eq!(again.status(), StatusCode::GONE);
    assert_eq!(error_of(again).await, "expired");
}

#[tokio::test]
async fn only_the_newest_link_for_an_address_makes_the_account() {
    let (base, state, outbox) = start_with_mail(common::config()).await;
    let email = "sam@example.com";

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

    assert_eq!(confirm(&base, &first).await.status(), StatusCode::GONE);
    assert_eq!(confirm(&base, &second).await.status(), StatusCode::OK);
    // The password is the one the newest sign-up chose.
    assert_eq!(
        sign_in(&base, email, PASSWORD).await.status(),
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        sign_in(&base, email, OTHER_PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );
}

#[tokio::test]
async fn an_address_with_an_account_is_said_and_gets_nothing() {
    let (base, _, outbox) = start_with_mail(common::config()).await;
    signed_in(&base).await;
    let taken = sign_up(&base, common::OWNER_EMAIL, PASSWORD).await;
    assert_eq!(taken.status(), StatusCode::CONFLICT);
    assert_eq!(error_of(taken).await, "already");
    assert!(emails_to(&outbox, common::OWNER_EMAIL).is_empty());
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
    let late = confirm(&base, &ticket).await;
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
