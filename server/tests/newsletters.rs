//! The address newsletter emails are posted to (SPEC section 28, decision
//! 0091): off without the secret, refused with a wrong one; with the right
//! one, each email to a reader's address is kept under its sender's feed,
//! the reader's alone.

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

fn on() -> nine_turtles::config::Config {
    let mut config = common::config();
    config.newsletter_secret = Some(SECRET.to_owned());
    config
}

async fn post_to(base: &str, to: &str, body: Vec<u8>) -> reqwest::Response {
    reqwest::Client::new()
        .post(format!("{base}/newsletters/incoming"))
        .header("content-type", "message/rfc822")
        .header("x-nine-turtles-to", to)
        .bearer_auth(SECRET)
        .body(body)
        .send()
        .await
        .unwrap()
}

async fn json(response: reqwest::Response) -> serde_json::Value {
    serde_json::from_slice(&response.bytes().await.unwrap()).unwrap()
}

async fn get(base: &str, cookie: &str, path: &str) -> serde_json::Value {
    json(
        reqwest::Client::new()
            .get(format!("{base}{path}"))
            .header("cookie", cookie)
            .send()
            .await
            .unwrap(),
    )
    .await
}

async fn post_api(
    base: &str,
    cookie: &str,
    path: &str,
    body: serde_json::Value,
) -> reqwest::Response {
    reqwest::Client::new()
        .post(format!("{base}{path}"))
        .header("cookie", cookie)
        .header("content-type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .unwrap()
}

/// The reader's newsletter address, as Settings shows it.
async fn address(base: &str, cookie: &str) -> String {
    let answer = get(base, cookie, "/api/newsletters").await;
    assert_eq!(answer["on"], true);
    answer["address"].as_str().unwrap().to_owned()
}

/// A made-up email from `from`, with its own Message-ID.
fn letter(from: &str, id: &str, subject: &str) -> Vec<u8> {
    format!(
        "From: {from}\r\nTo: someone@example.com\r\nSubject: {subject}\r\nMessage-ID: <{id}>\r\n\
         Date: Sun, 25 Oct 2026 07:00:00 +0000\r\nContent-Type: text/html\r\n\r\n<p>{subject}</p>\r\n"
    )
    .into_bytes()
}

async fn count(state: &nine_turtles::AppState, sql: &'static str) -> i64 {
    sqlx::query_scalar(sql).fetch_one(&state.db).await.unwrap()
}

#[tokio::test]
async fn an_email_to_a_readers_address_becomes_an_article_of_its_senders_feed() {
    let (base, state) = common::start_with_state(on()).await;
    let cookie = common::signed_in(&base).await;
    let to = address(&base, &cookie).await;
    assert!(
        to.starts_with("turtle-") && to.ends_with("@in.nineturtles.app"),
        "{to}"
    );
    // The same address every time Settings opens.
    assert_eq!(address(&base, &cookie).await, to);

    let response = post_to(&base, &to, email()).await;
    assert_eq!(response.status(), 200);
    assert_eq!(json(response).await["kept"], true);

    let feeds = get(&base, &cookie, "/api/feeds").await;
    let feeds = feeds["feeds"].as_array().unwrap();
    assert_eq!(feeds.len(), 1, "{feeds:?}");
    assert_eq!(feeds[0]["title"], "The slow garden");
    let feed = feeds[0]["id"].as_i64().unwrap();
    let articles = get(&base, &cookie, &format!("/api/articles?feed={feed}")).await;
    let articles = articles["articles"].as_array().unwrap();
    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0]["title"], "Why I stopped mowing the lawn");

    // The same email again is still one article; another from the same
    // newsletter joins the same feed.
    post_to(&base, &to, email()).await;
    let from = "\"The slow garden\" <slowgarden@substack.example.com>\r\nList-Id: <slowgarden.substack.example.com>";
    assert_eq!(
        post_to(&base, &to, letter(from, "2@x", "Second"))
            .await
            .status(),
        200
    );
    assert_eq!(count(&state, "SELECT COUNT(*) FROM feeds").await, 1);
    assert_eq!(count(&state, "SELECT COUNT(*) FROM articles").await, 2);

    // A newsletter is never fetched.
    let due: Vec<i64> = sqlx::query_scalar(nine_turtles::checking::DUE)
        .bind(i64::MAX)
        .bind(100)
        .fetch_all(&state.db)
        .await
        .unwrap();
    assert!(due.is_empty());
    // And it isn't in the OPML file, which lists web feeds.
    let opml = reqwest::Client::new()
        .get(format!("{base}/api/opml"))
        .header("cookie", &cookie)
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    assert!(!opml.contains("slow garden"), "{opml}");
}

#[tokio::test]
async fn a_label_after_a_plus_still_reaches_the_reader_and_the_emails_own_to_works_too() {
    let (base, state) = common::start_with_state(on()).await;
    let cookie = common::signed_in(&base).await;
    let to = address(&base, &cookie).await;
    let (name, domain) = to.split_once('@').unwrap();
    let labelled = format!("{name}+garden@{domain}");
    assert_eq!(post_to(&base, &labelled, email()).await.status(), 200);

    // Without the forwarder's word, the email's own To is read.
    let raw = String::from_utf8(letter("News <news@example.com>", "3@x", "Hello"))
        .unwrap()
        .replace("someone@example.com", &to.to_uppercase());
    let response = reqwest::Client::new()
        .post(format!("{base}/newsletters/incoming"))
        .bearer_auth(SECRET)
        .body(raw)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    assert_eq!(count(&state, "SELECT COUNT(*) FROM feeds").await, 2);
}

#[tokio::test]
async fn an_address_nobody_has_or_one_replaced_is_refused_and_undo_brings_it_back() {
    let (base, state) = common::start_with_state(on()).await;
    let cookie = common::signed_in(&base).await;
    let old = address(&base, &cookie).await;
    assert_eq!(
        post_to(&base, "turtle-nobody23@in.nineturtles.app", email())
            .await
            .status(),
        404
    );

    let answer = json(
        post_api(
            &base,
            &cookie,
            "/api/newsletters/new-address",
            serde_json::json!({}),
        )
        .await,
    )
    .await;
    let new = answer["address"].as_str().unwrap().to_owned();
    assert_ne!(new, old);
    assert_eq!(address(&base, &cookie).await, new);
    assert_eq!(post_to(&base, &old, email()).await.status(), 410);
    assert_eq!(post_to(&base, &new, email()).await.status(), 200);

    let previous = answer["previous"].as_str().unwrap();
    let undone = post_api(
        &base,
        &cookie,
        "/api/newsletters/undo-new-address",
        serde_json::json!({ "previous": previous }),
    )
    .await;
    assert_eq!(undone.status(), 200);
    assert_eq!(address(&base, &cookie).await, old);
    assert_eq!(
        post_to(&base, &old, letter("A <a@example.com>", "4@x", "Back"))
            .await
            .status(),
        200
    );
    assert_eq!(post_to(&base, &new, email()).await.status(), 410);
    assert_eq!(
        count(
            &state,
            "SELECT COUNT(*) FROM newsletter_addresses WHERE retired_at IS NULL"
        )
        .await,
        1
    );

    // Another reader can't bring back someone else's address.
    let (_, other) = common::another_reader(&state).await;
    let refused = post_api(
        &base,
        &other,
        "/api/newsletters/undo-new-address",
        serde_json::json!({ "previous": new.split('@').next().unwrap() }),
    )
    .await;
    assert_eq!(refused.status(), 409);
}

#[tokio::test]
async fn two_readers_on_the_same_list_get_separate_feeds_and_never_see_each_others() {
    let (base, state) = common::start_with_state(on()).await;
    let owner = common::signed_in(&base).await;
    let (_, other) = common::another_reader(&state).await;
    let mine = address(&base, &owner).await;
    let theirs = address(&base, &other).await;
    assert_ne!(mine, theirs);
    post_to(&base, &mine, email()).await;
    post_to(&base, &theirs, email()).await;
    // Two feeds, two copies of the article: each reader's copy is their own.
    assert_eq!(count(&state, "SELECT COUNT(*) FROM feeds").await, 2);
    assert_eq!(count(&state, "SELECT COUNT(*) FROM articles").await, 2);
    for cookie in [&owner, &other] {
        let feeds = get(&base, cookie, "/api/feeds").await;
        assert_eq!(feeds["feeds"].as_array().unwrap().len(), 1);
    }
    let shared = count(
        &state,
        "SELECT COUNT(*) FROM feeds JOIN subscriptions ON subscriptions.feed_id = feeds.id
         WHERE subscriptions.person_id != feeds.newsletter_of",
    )
    .await;
    assert_eq!(shared, 0);
}

#[tokio::test]
async fn after_unsubscribing_a_senders_emails_stay_away() {
    let (base, state) = common::start_with_state(on()).await;
    let cookie = common::signed_in(&base).await;
    let to = address(&base, &cookie).await;
    post_to(&base, &to, email()).await;
    let feed = count(&state, "SELECT id FROM feeds").await;
    let response = post_api(
        &base,
        &cookie,
        &format!("/api/feeds/{feed}/unsubscribe"),
        serde_json::json!({}),
    )
    .await;
    assert!(response.status().is_success(), "{}", response.status());
    // Even once Undo has passed and the articles are gone.
    nine_turtles::folders::clear_unsubscribed(&state.db, None, i64::MAX)
        .await
        .unwrap();
    assert_eq!(count(&state, "SELECT COUNT(*) FROM articles").await, 0);

    let from = "\"The slow garden\" <slowgarden@substack.example.com>\r\nList-Id: <slowgarden.substack.example.com>";
    let response = post_to(&base, &to, letter(from, "5@x", "Again")).await;
    assert_eq!(response.status(), 200);
    assert_eq!(json(response).await["kept"], false);
    assert_eq!(count(&state, "SELECT COUNT(*) FROM articles").await, 0);
}

#[tokio::test]
async fn a_deleted_readers_newsletters_and_address_go_with_them() {
    let (base, state) = common::start_with_state(on()).await;
    let (person, cookie) = common::another_reader(&state).await;
    let to = address(&base, &cookie).await;
    post_to(&base, &to, email()).await;
    nine_turtles::people::delete(&state.db, person)
        .await
        .unwrap();
    assert_eq!(count(&state, "SELECT COUNT(*) FROM feeds").await, 0);
    assert_eq!(count(&state, "SELECT COUNT(*) FROM articles").await, 0);
    assert_eq!(
        count(&state, "SELECT COUNT(*) FROM newsletter_addresses").await,
        0
    );
    assert_eq!(post_to(&base, &to, email()).await.status(), 404);
}

#[tokio::test]
async fn a_reader_who_gets_too_many_emails_in_a_day_is_refused_more() {
    let (base, state) = common::start_with_state(on()).await;
    let cookie = common::signed_in(&base).await;
    let to = address(&base, &cookie).await;
    post_to(&base, &to, email()).await;
    // Pretend the day's other emails arrived already.
    let feed = count(&state, "SELECT id FROM feeds").await;
    for n in 1..nine_turtles::newsletters::DAILY_LIMIT {
        sqlx::query(
            "INSERT INTO articles (feed_id, fingerprint, title, received_at, sort_at)
             VALUES (?, ?, 'x', unixepoch(), unixepoch())",
        )
        .bind(feed)
        .bind(format!("n{n}"))
        .execute(&state.db)
        .await
        .unwrap();
    }
    let response = post_to(&base, &to, letter("A <a@example.com>", "6@x", "One more")).await;
    assert_eq!(response.status(), 429);
}

#[tokio::test]
async fn without_the_secret_settings_shows_no_newsletters() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let answer = get(&base, &cookie, "/api/newsletters").await;
    assert_eq!(answer["on"], false);
    assert_eq!(answer["address"], serde_json::Value::Null);
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
