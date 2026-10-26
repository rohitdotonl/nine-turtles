//! The address newsletter emails are posted to (SPEC section 28, decision
//! 0091): off without the secret, refused with a wrong one, and, with the
//! right one, each email is read and described but not kept yet.

mod common;

const SECRET: &str = "a-made-up-newsletter-secret-of-forty-chars";

fn email() -> Vec<u8> {
    std::fs::read(format!(
        "{}/tests/emails/substack-style.eml",
        env!("CARGO_MANIFEST_DIR")
    ))
    .unwrap()
}

async fn post(base: &str, secret: Option<&str>, body: Vec<u8>) -> reqwest::Response {
    let mut request = reqwest::Client::new()
        .post(format!("{base}/newsletters/incoming"))
        .header("content-type", "message/rfc822")
        .body(body);
    if let Some(secret) = secret {
        request = request.bearer_auth(secret);
    }
    request.send().await.unwrap()
}

#[tokio::test]
async fn without_the_secret_the_address_doesnt_exist() {
    let base = common::start(common::config()).await;
    assert_eq!(post(&base, Some(SECRET), email()).await.status(), 404);
}

#[tokio::test]
async fn a_wrong_or_missing_secret_is_refused() {
    let mut config = common::config();
    config.newsletter_secret = Some(SECRET.to_owned());
    let base = common::start(config).await;
    assert_eq!(post(&base, None, email()).await.status(), 401);
    assert_eq!(post(&base, Some("guess"), email()).await.status(), 401);
    let almost = &SECRET[..SECRET.len() - 1];
    assert_eq!(post(&base, Some(almost), email()).await.status(), 401);
}

#[tokio::test]
async fn an_email_is_read_and_described_but_not_kept_yet() {
    let mut config = common::config();
    config.newsletter_secret = Some(SECRET.to_owned());
    let (base, state) = common::start_with_state(config).await;

    let response = post(&base, Some(SECRET), email()).await;
    assert_eq!(response.status(), 202);
    let answer: serde_json::Value =
        serde_json::from_slice(&response.bytes().await.unwrap()).unwrap();
    assert_eq!(answer["kept"], false);
    assert_eq!(
        answer["feed"]["key"],
        "list:slowgarden.substack.example.com"
    );
    assert_eq!(answer["feed"]["title"], "The slow garden");
    assert_eq!(answer["article"]["title"], "Why I stopped mowing the lawn");
    assert!(answer["article"]["content_bytes"].as_u64().unwrap() > 300);

    // Nothing was stored: no feed, no article.
    let feeds: i64 = sqlx::query_scalar("SELECT count(*) FROM feeds")
        .fetch_one(&state.db)
        .await
        .unwrap();
    let articles: i64 = sqlx::query_scalar("SELECT count(*) FROM articles")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!((feeds, articles), (0, 0));
}

#[tokio::test]
async fn something_that_isnt_an_email_or_is_too_big_is_refused() {
    let mut config = common::config();
    config.newsletter_secret = Some(SECRET.to_owned());
    let base = common::start(config).await;
    let not_an_email = b"Subject: no sender\r\n\r\nHello\r\n".to_vec();
    assert_eq!(post(&base, Some(SECRET), not_an_email).await.status(), 422);
    let huge = vec![b'a'; nine_turtles::newsletters::EMAIL_SIZE_LIMIT + 1];
    assert_eq!(post(&base, Some(SECRET), huge).await.status(), 413);
}

#[tokio::test]
async fn the_diagnostics_page_says_whether_newsletters_are_on() {
    let mut config = common::config();
    config.newsletter_secret = Some(SECRET.to_owned());
    let base = common::start(config).await;
    let page = reqwest::Client::new()
        .get(format!("{base}/diagnostics"))
        .bearer_auth(common::DIAGNOSTICS_KEY)
        .send()
        .await
        .unwrap()
        .bytes()
        .await
        .unwrap();
    let page: serde_json::Value = serde_json::from_slice(&page).unwrap();
    assert_eq!(page["newsletters"]["on"], true);
    // The secret itself is never shown.
    assert!(!page.to_string().contains(SECRET));
}
