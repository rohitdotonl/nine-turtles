//! Signing in and out, staying signed in, and the wait after wrong passwords
//! (SPEC section 1), tested against a real running nine turtles.

mod common;

use common::{DIAGNOSTICS_KEY, OWNER_EMAIL, PASSWORD};
use nine_turtles::config::PasswordSetting;
use reqwest::{Client, Response, StatusCode};

/// Signs in as the owner, with their email and `password`.
async fn sign_in(base: &str, password: &str) -> Response {
    sign_in_with(base, Some(OWNER_EMAIL), password).await
}

async fn sign_in_with(base: &str, email: Option<&str>, password: &str) -> Response {
    let body = match email {
        Some(email) => serde_json::json!({ "email": email, "password": password }),
        None => serde_json::json!({ "password": password }),
    };
    Client::new()
        .post(format!("{base}/api/sign-in"))
        .header("content-type", "application/json")
        .header("sec-fetch-site", "same-origin")
        .body(body.to_string())
        .send()
        .await
        .unwrap()
}

/// The `name=value` part of the sign-in cookie, as a browser would send it back.
fn cookie_from(response: &Response) -> String {
    let set_cookie = response.headers()["set-cookie"].to_str().unwrap();
    set_cookie.split(';').next().unwrap().to_owned()
}

async fn session(base: &str, cookie: Option<&str>) -> String {
    let mut request = Client::new().get(format!("{base}/api/session"));
    if let Some(cookie) = cookie {
        request = request.header("cookie", cookie);
    }
    request.send().await.unwrap().text().await.unwrap()
}

#[tokio::test]
async fn the_right_password_signs_this_device_in_for_a_year() {
    let base = common::start(common::config()).await;
    let response = sign_in(&base, PASSWORD).await;

    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    let set_cookie = response.headers()["set-cookie"].to_str().unwrap();
    for part in [
        "Max-Age=31536000",
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
        "Path=/",
    ] {
        assert!(set_cookie.contains(part), "{set_cookie} lacks {part}");
    }

    let cookie = cookie_from(&response);
    let answer = session(&base, Some(&cookie)).await;
    assert!(answer.contains(r#""signed_in":true"#), "{answer}");
    assert!(answer.contains(nine_turtles::VERSION));
}

#[tokio::test]
async fn the_password_alone_signs_nobody_in() {
    let base = common::start(common::config()).await;
    for email in [None, Some(""), Some("   ")] {
        let response = sign_in_with(&base, email, PASSWORD).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert!(response.headers().get("set-cookie").is_none());
        assert_eq!(
            response.text().await.unwrap(),
            r#"{"error":"email-needed"}"#
        );
    }
}

#[tokio::test]
async fn the_owners_first_sign_in_saves_their_email() {
    let base = common::start(common::config()).await;
    // A new nine turtles: the owner has no email yet, so the first sign-in
    // with the owner's password and an email nobody has makes it theirs.
    let first = sign_in_with(&base, Some("Me@Example.com"), PASSWORD).await;
    assert_eq!(first.status(), StatusCode::NO_CONTENT);
    let cookie = cookie_from(&first);
    let answer = session(&base, Some(&cookie)).await;
    assert!(answer.contains(r#""owner":true"#), "{answer}");
    assert!(answer.contains(r#""email":"Me@Example.com""#), "{answer}");

    // From then on it's that email, in any letters, and no other.
    assert_eq!(
        sign_in_with(&base, Some("me@example.com"), PASSWORD)
            .await
            .status(),
        StatusCode::NO_CONTENT
    );
    let other = sign_in_with(&base, Some(OWNER_EMAIL), PASSWORD).await;
    assert_eq!(other.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(other.text().await.unwrap(), r#"{"error":"wrong-password"}"#);
}

#[tokio::test]
async fn a_wrong_first_sign_in_saves_nothing() {
    let base = common::start(common::config()).await;
    let wrong = sign_in_with(&base, Some("stranger@example.com"), "a guess").await;
    assert_eq!(wrong.status(), StatusCode::UNAUTHORIZED);
    // The owner's email is still theirs to choose.
    assert_eq!(
        sign_in(&base, PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );
}

#[tokio::test]
async fn new_emails_each_try_cant_guess_the_owners_first_password() {
    let base = common::start(common::config()).await;
    // Before the owner has an email, every try with a new email is a try
    // at the owner's password, and counts for the owner too.
    for n in 0..4 {
        let email = format!("guess{n}@example.com");
        assert_eq!(
            sign_in_with(&base, Some(&email), "guess").await.status(),
            StatusCode::UNAUTHORIZED
        );
    }
    assert_eq!(
        sign_in_with(&base, Some("guess4@example.com"), "guess")
            .await
            .status(),
        StatusCode::TOO_MANY_REQUESTS
    );
    assert_eq!(
        sign_in_with(&base, Some("guess5@example.com"), PASSWORD)
            .await
            .status(),
        StatusCode::TOO_MANY_REQUESTS
    );
}

#[tokio::test]
async fn the_owners_first_email_has_to_look_like_one() {
    let base = common::start(common::config()).await;
    let typo = sign_in_with(&base, Some("rohit"), PASSWORD).await;
    assert_eq!(typo.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(
        sign_in(&base, PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );
}

#[tokio::test]
async fn without_signing_in_nothing_is_revealed() {
    let base = common::start(common::config()).await;
    // Only what the sign-in page needs: whether to offer "Forgot your
    // password?" and "Sign up" (decision 0088), and where passkeys work
    // (decision 0109).
    const SIGNED_OUT: &str =
        r#"{"email_sending":false,"passkeys":"http://localhost","signed_in":false}"#;
    assert_eq!(session(&base, None).await, SIGNED_OUT);

    let made_up = format!("nine_turtles_session={}", "0".repeat(64));
    assert_eq!(session(&base, Some(&made_up)).await, SIGNED_OUT);
}

#[tokio::test]
async fn a_wrong_password_is_refused() {
    let base = common::start(common::config()).await;
    let response = sign_in(&base, "not the password").await;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert!(response.headers().get("set-cookie").is_none());
    assert_eq!(
        response.text().await.unwrap(),
        r#"{"error":"wrong-password"}"#
    );
}

#[tokio::test]
async fn after_five_wrong_passwords_even_the_right_one_has_to_wait() {
    let base = common::start(common::config()).await;
    for _ in 0..4 {
        assert_eq!(
            sign_in(&base, "guess").await.status(),
            StatusCode::UNAUTHORIZED
        );
    }
    let fifth = sign_in(&base, "guess").await;
    assert_eq!(fifth.status(), StatusCode::TOO_MANY_REQUESTS);
    // A minute from the fifth try, less the moment its password check took
    // (slow on purpose, and slower still on a busy test computer).
    let wait: u64 = fifth.headers()["retry-after"]
        .to_str()
        .unwrap()
        .parse()
        .unwrap();
    assert!((55..=60).contains(&wait), "retry-after was {wait}");

    let right = sign_in(&base, PASSWORD).await;
    assert_eq!(right.status(), StatusCode::TOO_MANY_REQUESTS);
    assert!(right.headers().get("set-cookie").is_none());
}

#[tokio::test]
async fn signing_out_ends_this_device_only() {
    let base = common::start(common::config()).await;
    let laptop = cookie_from(&sign_in(&base, PASSWORD).await);
    let phone = cookie_from(&sign_in(&base, PASSWORD).await);

    let response = Client::new()
        .post(format!("{base}/api/sign-out"))
        .header("cookie", &laptop)
        .header("sec-fetch-site", "same-origin")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    assert!(
        response.headers()["set-cookie"]
            .to_str()
            .unwrap()
            .contains("Max-Age=0")
    );

    assert!(
        session(&base, Some(&laptop))
            .await
            .contains(r#""signed_in":false"#)
    );
    assert!(
        session(&base, Some(&phone))
            .await
            .contains(r#""signed_in":true"#)
    );
}

#[tokio::test]
async fn sign_ins_survive_a_restart() {
    let config = common::config();
    let first = common::start(config.clone()).await;
    let cookie = cookie_from(&sign_in(&first, PASSWORD).await);

    let second = common::start(config).await;
    assert!(
        session(&second, Some(&cookie))
            .await
            .contains(r#""signed_in":true"#)
    );
}

#[tokio::test]
async fn without_a_password_setting_nobody_can_sign_in() {
    for (setting, error) in [
        (PasswordSetting::Missing, "password-missing"),
        (PasswordSetting::Invalid, "password-invalid"),
    ] {
        let mut config = common::config();
        config.password = setting;
        let base = common::start(config).await;

        let response = sign_in(&base, "anything at all").await;
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert!(response.text().await.unwrap().contains(error));
    }
}

#[tokio::test]
async fn other_websites_cant_sign_in_or_out() {
    let base = common::start(common::config()).await;
    for path in ["/api/sign-in", "/api/sign-out"] {
        let response = Client::new()
            .post(format!("{base}{path}"))
            .header("content-type", "application/json")
            .header("sec-fetch-site", "cross-site")
            .body(format!(r#"{{"password":"{PASSWORD}"}}"#))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN, "{path}");
    }
}

#[tokio::test]
async fn every_page_carries_the_browser_security_rules() {
    let base = common::start(common::config()).await;
    for path in ["/", "/status", "/api/session"] {
        let response = reqwest::get(format!("{base}{path}")).await.unwrap();
        let headers = response.headers();
        assert_eq!(
            headers["content-security-policy"],
            nine_turtles::security::CONTENT_SECURITY_POLICY,
            "{path}"
        );
        assert_eq!(headers["x-content-type-options"], "nosniff", "{path}");
        assert_eq!(headers["x-frame-options"], "DENY", "{path}");
    }
}

#[tokio::test]
async fn the_status_page_is_public_and_says_only_that_nine_turtles_runs() {
    let base = common::start(common::config()).await;
    let response = reqwest::get(format!("{base}/status")).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.text().await.unwrap(),
        format!(
            "nine turtles is running\nversion {}\n",
            nine_turtles::VERSION
        )
    );
}

#[tokio::test]
async fn diagnostics_need_the_key() {
    let base = common::start(common::config()).await;
    let get = |key: Option<&'static str>| {
        let mut request = Client::new().get(format!("{base}/diagnostics"));
        if let Some(key) = key {
            request = request.header("authorization", format!("Bearer {key}"));
        }
        request.send()
    };

    assert_eq!(get(None).await.unwrap().status(), StatusCode::UNAUTHORIZED);
    assert_eq!(
        get(Some("wrong-key")).await.unwrap().status(),
        StatusCode::UNAUTHORIZED
    );

    let response = get(Some(DIAGNOSTICS_KEY)).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = response.text().await.unwrap();
    for field in [
        r#""password_setting":"set""#,
        r#""signed_in_devices":0"#,
        r#""database_bytes":"#,
        r#""uptime_seconds":"#,
        r#""recent_problems":"#,
        r#""backups":{"latest_nightly":null,"on":false}"#,
    ] {
        assert!(body.contains(field), "{body} lacks {field}");
    }
}

#[tokio::test]
async fn without_a_key_setting_diagnostics_are_switched_off() {
    let mut config = common::config();
    config.diagnostics_key = None;
    let base = common::start(config).await;

    let response = Client::new()
        .get(format!("{base}/diagnostics"))
        .header("authorization", "Bearer ")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
