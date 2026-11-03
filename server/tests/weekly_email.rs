//! The weekly email (SPEC section 39, decision 0150): off until the reader
//! turns it on; then, when it's due, one plain email naming the people with
//! something unread, never a count, never twice for the same morning, and
//! nothing at all when there's nothing new. Its stop link turns it off
//! signed out, in one press.

mod common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

const WEEK: i64 = 7 * 86_400;

async fn post(base: &str, cookie: Option<&str>, path: &str, body: Value) -> (StatusCode, Value) {
    let mut request = Client::new()
        .post(format!("{base}{path}"))
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body(body.to_string());
    if let Some(cookie) = cookie {
        request = request.header("cookie", cookie);
    }
    let response = request.send().await.unwrap();
    let status = response.status();
    let text = response.text().await.unwrap();
    (status, serde_json::from_str(&text).unwrap_or(Value::Null))
}

async fn often(base: &str, cookie: &str) -> String {
    let text = Client::new()
        .get(format!("{base}/api/weekly-email"))
        .header("cookie", cookie)
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    let answer: Value = serde_json::from_str(&text).unwrap();
    answer["often"].as_str().unwrap().to_owned()
}

/// A place reader `person` follows, called `name`.
async fn follows(db: &sqlx::SqlitePool, person: i64, name: &str) -> i64 {
    let feed: i64 = sqlx::query_scalar(
        "INSERT INTO feeds (url, url_key, title, added_at) VALUES (?, ?, ?, 0) RETURNING id",
    )
    .bind(format!("https://{name}.example/feed"))
    .bind(format!("{name}.example/feed"))
    .bind(name)
    .fetch_one(db)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (?, ?, ?, 0)",
    )
    .bind(person)
    .bind(feed)
    .bind(name)
    .execute(db)
    .await
    .unwrap();
    feed
}

/// An article arriving in `feed` at `at`, for reader `person`.
async fn arrives(db: &sqlx::SqlitePool, person: i64, feed: i64, title: &str, at: i64, read: bool) {
    let article: i64 = sqlx::query_scalar(
        "INSERT INTO articles (feed_id, fingerprint, title, link, summary, received_at, sort_at)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(feed)
    .bind(title)
    .bind(title)
    .bind(format!(
        "https://writer.example/{}",
        title.replace(' ', "-")
    ))
    .bind(format!(
        "<p>The first line of {title}.</p><p>The second.</p>"
    ))
    .bind(at)
    .bind(at)
    .fetch_one(db)
    .await
    .unwrap();
    sqlx::query("INSERT INTO entries (person_id, article_id, feed_id, sort_at, read) VALUES (?, ?, ?, ?, ?)")
        .bind(person)
        .bind(article)
        .bind(feed)
        .bind(at)
        .bind(read)
        .execute(db)
        .await
        .unwrap();
}

/// Chooses how often, as Settings does; answers the server's answer.
async fn choose(base: &str, cookie: &str, often: &str) -> Value {
    let (status, answer) = post(
        base,
        Some(cookie),
        "/api/weekly-email",
        json!({ "often": often, "offset": 60 }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    answer
}

/// Presses the button on a stop or Start page, signed out.
async fn press(base: &str, which: &str, ticket: &str) -> StatusCode {
    post(
        base,
        None,
        &format!("/api/weekly-email/{which}"),
        json!({ "ticket": ticket }),
    )
    .await
    .0
}

async fn send(state: &nine_turtles::AppState, at: i64) -> usize {
    let mailer = state.mailer.clone().unwrap();
    nine_turtles::weekly::send_due(&state.db, &mailer, at)
        .await
        .unwrap()
}

#[tokio::test]
async fn the_weekly_email_names_the_people_with_something_new_and_stops_in_one_press() {
    let (base, state, outbox) = common::start_with_mail(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let db = &state.db;
    let mail = || common::emails_to(&outbox, common::OWNER_EMAIL);

    // Off until the reader turns it on.
    assert_eq!(often(&base, &cookie).await, "off");
    let at = nine_turtles::now() + 8 * 86_400;
    let alpha = follows(db, 1, "Alpha").await;
    arrives(db, 1, alpha, "On walking", at - 86_400, false).await;
    assert_eq!(send(&state, at).await, 0);

    let answer = choose(&base, &cookie, "weekly").await;
    assert_eq!(answer["waiting"], true, "{answer}");
    assert_eq!(often(&base, &cookie).await, "weekly");
    // Nothing goes to an address until its Start link is pressed: sign-up never checks one.
    assert_eq!(send(&state, at).await, 0);
    assert_eq!(mail().len(), 1);
    assert_eq!(mail()[0].subject, "Start your weekly email");
    // Off and on again sends no second Start email within the hour.
    choose(&base, &cookie, "off").await;
    choose(&base, &cookie, "weekly").await;
    assert_eq!(mail().len(), 1);
    let (page, start) = common::newest_link(&outbox, common::OWNER_EMAIL);
    assert_eq!(page, "/weekly-email/start");
    assert_eq!(
        press(&base, "start", "not-a-ticket").await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(press(&base, "start", &start).await, StatusCode::OK);
    // Once only.
    assert_eq!(press(&base, "start", &start).await, StatusCode::NOT_FOUND);
    assert_eq!(choose(&base, &cookie, "weekly").await["waiting"], false);
    assert_eq!(mail().len(), 1);

    // Beta wrote three things, one already read; Gamma nothing new but a muted one.
    let beta = follows(db, 1, "Beta").await;
    arrives(db, 1, beta, "First", at - 3 * 86_400, false).await;
    arrives(db, 1, beta, "Second", at - 2 * 86_400, false).await;
    arrives(db, 1, beta, "Seen already", at - 2 * 86_400, true).await;
    let gamma = follows(db, 1, "Gamma").await;
    arrives(db, 1, gamma, "Last month", at - 5 * WEEK, false).await;
    arrives(db, 1, gamma, "Muted one", at - 86_400, false).await;
    sqlx::query("UPDATE entries SET muted = 1 WHERE article_id = (SELECT id FROM articles WHERE title = 'Muted one')")
        .execute(db)
        .await
        .unwrap();
    // A place no longer followed stays out.
    let epsilon = follows(db, 1, "Epsilon").await;
    arrives(db, 1, epsilon, "Let go", at - 86_400, false).await;
    sqlx::query("UPDATE subscriptions SET unsubscribed_at = 1 WHERE feed_id = ?")
        .bind(epsilon)
        .execute(db)
        .await
        .unwrap();
    // Another reader's places never show.
    let (other, _) = common::another_reader(&state).await;
    let delta = follows(db, other, "Delta").await;
    arrives(db, other, delta, "Not yours", at - 86_400, false).await;

    assert_eq!(send(&state, at).await, 1);
    let sent = mail();
    assert_eq!(sent.len(), 2);
    assert_eq!(sent[1].subject, "New from the people you read");
    let body = &sent[1].body;
    for expected in [
        "Here's what the people you read wrote this week.",
        "Alpha\n\n  On walking\n  The first line of On walking.\n  https://writer.example/On-walking\n",
        "Beta\n\n  Second\n",
        "  First\n",
        "Rohit\nnine turtles\n",
    ] {
        assert!(body.contains(expected), "{expected:?} in {body}");
    }
    for unexpected in [
        "Seen already",
        "Gamma",
        "Muted one",
        "Epsilon",
        "Let go",
        "Delta",
        "Not yours",
        "The second.",
    ] {
        assert!(!body.contains(unexpected), "{unexpected:?} in {body}");
    }
    assert!(
        body.find("Alpha").unwrap() < body.find("Beta").unwrap(),
        "by name: {body}"
    );

    // Never twice for the same morning, and nothing when nothing is new.
    assert_eq!(send(&state, at + 60).await, 0);
    assert_eq!(send(&state, at + WEEK).await, 0);
    assert_eq!(mail().len(), 2);

    // The stop link works signed out, from any device, and only for its own ticket.
    let stop = body
        .lines()
        .find(|line| line.contains("/weekly-email#ticket="))
        .unwrap();
    assert!(
        stop.starts_with(&format!("{base}/weekly-email#ticket=")),
        "{stop}"
    );
    let ticket = stop.split("#ticket=").nth(1).unwrap().to_owned();
    assert_eq!(
        press(&base, "stop", "not-a-ticket").await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(often(&base, &cookie).await, "weekly");
    assert_eq!(press(&base, "stop", &ticket).await, StatusCode::OK);
    assert_eq!(often(&base, &cookie).await, "off");
    // Turned on again (no new Start needed), the spent link says so rather than claim to stop it.
    assert_eq!(choose(&base, &cookie, "weekly").await["waiting"], false);
    assert_eq!(press(&base, "stop", &ticket).await, StatusCode::NOT_FOUND);
    assert_eq!(often(&base, &cookie).await, "weekly");
    choose(&base, &cookie, "off").await;
    arrives(db, 1, alpha, "After", at + 2 * WEEK - 86_400, false).await;
    assert_eq!(send(&state, at + 2 * WEEK).await, 0);
}

#[tokio::test]
async fn it_needs_email_to_be_turned_on_and_turns_off_from_settings() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (status, answer) = post(
        &base,
        Some(&cookie),
        "/api/weekly-email",
        json!({ "often": "twice" }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(answer["error"], "no-email");

    let (base, state, _) = common::start_with_mail(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (_, no_address) = common::another_reader(&state).await;
    let (status, answer) = post(
        &base,
        Some(&no_address),
        "/api/weekly-email",
        json!({ "often": "weekly" }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(answer["error"], "no-address");

    choose(&base, &cookie, "twice").await;
    assert_eq!(often(&base, &cookie).await, "twice");
    choose(&base, &cookie, "off").await;
    assert_eq!(often(&base, &cookie).await, "off");
    // Only the Start email's own rows are kept, so Off and on can't send another within the hour.
    let mut left: Vec<String> =
        sqlx::query_scalar("SELECT name FROM person_settings WHERE name LIKE 'weekly%'")
            .fetch_all(&state.db)
            .await
            .unwrap();
    left.sort();
    assert_eq!(left, ["weekly_start", "weekly_start_at", "weekly_start_to"]);
}

#[tokio::test]
async fn a_changed_email_waits_for_start_again_and_is_asked_only_once() {
    let (base, state, outbox) = common::start_with_mail(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let at = nine_turtles::now() + 8 * 86_400;
    let alpha = follows(&state.db, 1, "Alpha").await;
    arrives(&state.db, 1, alpha, "On walking", at - 86_400, false).await;
    choose(&base, &cookie, "weekly").await;
    let (_, first) = common::newest_link(&outbox, common::OWNER_EMAIL);

    // The address changes (as a confirmed change of email does) before Start is pressed.
    let moved = "moved@example.com";
    sqlx::query("UPDATE people SET email = ? WHERE id = 1")
        .bind(moved)
        .execute(&state.db)
        .await
        .unwrap();
    assert_eq!(choose(&base, &cookie, "weekly").await["waiting"], true);
    // The old address's link can't start it for the new one.
    assert_eq!(press(&base, "start", &first).await, StatusCode::NOT_FOUND);
    // The background round asks the new address once, and nothing else goes there.
    assert_eq!(send(&state, at).await, 0);
    assert_eq!(send(&state, at + 60).await, 0);
    let asked = common::emails_to(&outbox, moved);
    assert_eq!(asked.len(), 1, "{asked:?}");
    assert_eq!(asked[0].subject, "Start your weekly email");
    // Off and on again within the week sends no second one to the same address.
    choose(&base, &cookie, "off").await;
    choose(&base, &cookie, "weekly").await;
    assert_eq!(common::emails_to(&outbox, moved).len(), 1);

    let (_, second) = common::newest_link(&outbox, moved);
    assert_eq!(press(&base, "start", &second).await, StatusCode::OK);
    arrives(&state.db, 1, alpha, "Later", at + WEEK - 86_400, false).await;
    assert_eq!(send(&state, at + WEEK).await, 1);
    assert_eq!(
        common::emails_to(&outbox, moved).last().unwrap().subject,
        "New from the people you read"
    );
}
