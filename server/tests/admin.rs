//! The owner's Readers page and the fair limits (SPEC sections 11, 15, 16
//! and 18, decision 0089), tested against a real running nine turtles: at
//! most 1,000 feeds per reader, feeds whose every follower is away checked
//! once a day, and the owner's page of readers, which never says which
//! feeds anyone follows.

mod common;

use axum::{Router, http::header, response::IntoResponse, routing::get};
use nine_turtles::{
    AppState, admin,
    checking::{self, DAY, HOUR},
};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

async fn send(
    base: &str,
    cookie: &str,
    path: &str,
    content_type: &str,
    body: String,
) -> (StatusCode, Value) {
    let response = Client::new()
        .post(format!("{base}{path}"))
        .header("cookie", cookie)
        .header("sec-fetch-site", "same-origin")
        .header("content-type", content_type)
        .body(body)
        .send()
        .await
        .unwrap();
    let status = response.status();
    (
        status,
        response
            .text()
            .await
            .unwrap()
            .parse()
            .unwrap_or(Value::Null),
    )
}

async fn fetch(base: &str, cookie: &str, path: &str) -> (StatusCode, Value) {
    let response = Client::new()
        .get(format!("{base}{path}"))
        .header("cookie", cookie)
        .send()
        .await
        .unwrap();
    let status = response.status();
    (
        status,
        response
            .text()
            .await
            .unwrap()
            .parse()
            .unwrap_or(Value::Null),
    )
}

/// An OPML file listing `count` made-up feeds, numbered from `from`.
fn opml(from: usize, count: usize) -> String {
    let outlines: String = (from..from + count)
        .map(|number| {
            format!(
                r#"<outline type="rss" text="Blog {number}" xmlUrl="https://blog-{number}.example/feed.xml"/>"#
            )
        })
        .collect();
    format!(r#"<?xml version="1.0"?><opml version="2.0"><head/><body>{outlines}</body></opml>"#)
}

async fn following(state: &AppState, person: i64) -> i64 {
    admin::following(&mut state.db.acquire().await.unwrap(), person)
        .await
        .unwrap()
}

/// A made-up publisher with one feed that posts every hour.
async fn publisher() -> String {
    async fn feed() -> impl IntoResponse {
        let now = nine_turtles::now();
        let items: String = (0..5)
            .map(|hours| {
                let date = rfc2822(now - hours * HOUR);
                format!("<item><title>Post {hours}</title><link>https://hourly.example/{hours}</link><pubDate>{date}</pubDate></item>")
            })
            .collect();
        (
            [(header::CONTENT_TYPE, "application/rss+xml")],
            format!(
                r#"<?xml version="1.0"?><rss version="2.0"><channel><title>Hourly</title>{items}</channel></rss>"#
            ),
        )
    }
    let app = Router::new().route("/feed.xml", get(feed));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}")
}

/// A date as feeds write it (RFC 2822), without a date library.
fn rfc2822(at: i64) -> String {
    const MONTHS: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    let days = at.div_euclid(86_400);
    let seconds = at.rem_euclid(86_400);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    format!(
        "{day:02} {} {year} {:02}:{:02}:{:02} GMT",
        MONTHS[usize::try_from(month - 1).unwrap()],
        seconds / 3600,
        seconds % 3600 / 60,
        seconds % 60
    )
}

#[tokio::test]
async fn only_the_owner_sees_the_readers_page_and_never_which_feeds() {
    let (base, state) = common::start_with_state(common::config()).await;
    let owner = common::signed_in(&base).await;
    let (reader, cookie) = common::another_reader(&state).await;
    let (status, _) = send(&base, &cookie, "/api/opml", "text/x-opml", opml(0, 3)).await;
    assert_eq!(status, StatusCode::OK);

    let (status, _) = fetch(&base, &cookie, "/api/admin").await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _) = fetch(&base, "", "/api/admin").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, page) = fetch(&base, &owner, "/api/admin").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(page["totals"]["readers"], 2);
    assert_eq!(page["totals"]["feeds"], 3);
    assert_eq!(page["most_feeds"], 1000);
    let readers = page["readers"].as_array().unwrap();
    // The owner first, then the newest.
    assert_eq!(readers[0]["owner"], true);
    assert_eq!(readers[1]["id"], reader);
    assert_eq!(readers[1]["feeds"], 3);
    assert_eq!(readers[1]["feeds_failing"], 0);
    // Not when anyone was last here, until the owner decides (decision 0089).
    assert!(readers[1].get("last_here").is_none());
    // How many, never which.
    let text = page.to_string();
    assert!(!text.contains("blog-0"), "{text}");
    assert!(!text.contains("Blog 0"), "{text}");
}

#[tokio::test]
async fn a_reader_follows_at_most_a_thousand_feeds() {
    let (base, state) = common::start_with_state(common::config()).await;
    let (reader, cookie) = common::another_reader(&state).await;

    // More than fit, in one file: nothing is imported.
    let (status, answer) = send(&base, &cookie, "/api/opml", "text/x-opml", opml(0, 1001)).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(answer["error"], "too-many");
    assert_eq!(answer["following"], 0);
    assert_eq!(answer["adding"], 1001);
    assert_eq!(following(&state, reader).await, 0);

    // Exactly as many as fit.
    let (status, answer) = send(&base, &cookie, "/api/opml", "text/x-opml", opml(0, 1000)).await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    assert_eq!(following(&state, reader).await, 1000);

    // The same file again adds nothing, so it's fine.
    let (status, answer) = send(&base, &cookie, "/api/opml", "text/x-opml", opml(0, 10)).await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    assert_eq!(answer["summary"]["already"], 10);

    // One more, from a file or the Add field, is refused, before anything
    // is fetched (this address would answer "unreachable").
    let (status, answer) = send(&base, &cookie, "/api/opml", "text/x-opml", opml(1000, 1)).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(answer["following"], 1000);
    let (status, answer) = send(
        &base,
        &cookie,
        "/api/feeds",
        "application/json",
        json!({ "address": "http://127.0.0.1:9/feed.xml" }).to_string(),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(answer["error"], "too-many");
    assert_eq!(following(&state, reader).await, 1000);

    // Another reader isn't limited by this one.
    let (other, other_cookie) = common::another_reader(&state).await;
    let (status, _) = send(&base, &other_cookie, "/api/opml", "text/x-opml", opml(0, 5)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(following(&state, other).await, 5);
}

/// When the feed is next due, in seconds from `now`.
async fn due_in(state: &AppState, feed: i64, now: i64) -> i64 {
    let next: i64 = sqlx::query_scalar("SELECT next_check_at FROM feeds WHERE id = ?")
        .bind(feed)
        .fetch_one(&state.db)
        .await
        .unwrap();
    next - now
}

/// Makes reader `person` look as if nine turtles last saw them `ago` seconds ago.
async fn last_seen(state: &AppState, person: i64, ago: i64) {
    let at = nine_turtles::now() - ago;
    for query in [
        "UPDATE people SET created_at = ?1 WHERE id = ?2",
        "UPDATE sessions SET last_used_at = ?1 WHERE person_id = ?2",
        "UPDATE person_settings SET value = CAST(?1 AS TEXT) WHERE person_id = ?2 AND name = 'here_at'",
    ] {
        sqlx::query(query)
            .bind(at)
            .bind(person)
            .execute(&state.db)
            .await
            .unwrap();
    }
}

#[tokio::test]
async fn feeds_whose_followers_are_all_away_are_checked_once_a_day_until_one_comes_back() {
    let (base, state) = common::start_with_state(common::config()).await;
    let site = publisher().await;
    let (reader, cookie) = common::another_reader(&state).await;
    let (status, answer) = send(
        &base,
        &cookie,
        "/api/feeds",
        "application/json",
        json!({ "address": format!("{site}/feed.xml") }).to_string(),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{answer}");
    let feed = answer["feed"]["id"].as_i64().unwrap();

    // While the reader is around, an hourly blog is checked often.
    let now = nine_turtles::now();
    checking::check(&state, feed, now).await.unwrap();
    assert!(due_in(&state, feed, now).await <= HOUR);

    // Away for a month: once a day.
    last_seen(&state, reader, 31 * DAY).await;
    checking::check(&state, feed, now).await.unwrap();
    assert!(due_in(&state, feed, now).await >= DAY - 1);
    let (_, page) = fetch(&base, &common::signed_in(&base).await, "/api/admin").await;
    assert_eq!(page["totals"]["feeds_resting"], 1);

    // Back: due again at once, unless checked in the last 30 minutes.
    sqlx::query("UPDATE feeds SET fetched_at = ? WHERE id = ?")
        .bind(now - HOUR)
        .bind(feed)
        .execute(&state.db)
        .await
        .unwrap();
    admin::here(&state.db, reader, now).await.unwrap();
    assert!(due_in(&state, feed, now).await <= 0);
    checking::check(&state, feed, now).await.unwrap();
    assert!(due_in(&state, feed, now).await <= HOUR);

    // Another follower who's around keeps it checked often, whoever is away.
    last_seen(&state, reader, 31 * DAY).await;
    let (_, other_cookie) = common::another_reader(&state).await;
    let (status, _) = send(
        &base,
        &other_cookie,
        "/api/feeds",
        "application/json",
        json!({ "address": format!("{site}/feed.xml") }).to_string(),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    checking::check(&state, feed, now).await.unwrap();
    assert!(due_in(&state, feed, now).await <= HOUR);
}

#[tokio::test]
async fn being_here_is_noted_once_a_day() {
    let (_, state) = common::start_with_state(common::config()).await;
    let (reader, _) = common::another_reader(&state).await;
    last_seen(&state, reader, 40 * DAY).await;
    let now = nine_turtles::now();
    // Noted once a day: a second note the same day changes nothing.
    admin::here(&state.db, reader, now).await.unwrap();
    admin::here(&state.db, reader, now + HOUR).await.unwrap();
    let noted: String = sqlx::query_scalar(
        "SELECT value FROM person_settings WHERE person_id = ? AND name = 'here_at'",
    )
    .bind(reader)
    .fetch_one(&state.db)
    .await
    .unwrap();
    assert_eq!(noted, now.to_string());
}

/// Reader `person` follows four made-up feeds by OPML (nothing is fetched),
/// each last fetched two hours ago and next due in a day: a working one, a
/// failing one, one a follower set to Daily, and one a WebSub hub delivers.
/// Answers their numbers in that order.
async fn resting_feeds(base: &str, cookie: &str, state: &AppState) -> [i64; 4] {
    let (status, _) = send(base, cookie, "/api/opml", "text/x-opml", opml(0, 4)).await;
    assert_eq!(status, StatusCode::OK);
    let now = nine_turtles::now();
    let ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM feeds ORDER BY id")
        .fetch_all(&state.db)
        .await
        .unwrap();
    sqlx::query("UPDATE feeds SET fetched_at = ?, next_check_at = ?")
        .bind(now - 2 * HOUR)
        .bind(now + DAY)
        .execute(&state.db)
        .await
        .unwrap();
    for (query, id) in [
        (
            "UPDATE feeds SET failures = 3, failing_since = unixepoch() WHERE id = ?",
            ids[1],
        ),
        (
            "UPDATE feeds SET check_at_most = 86400 WHERE id = ?",
            ids[2],
        ),
        (
            "INSERT INTO websub (feed_id, hub, topic, token, secret, asked_at, active_until)
             VALUES (?, 'https://hub.example/', 'https://blog.example/feed', 'token', 'secret',
                     unixepoch(), unixepoch() + 86400)",
            ids[3],
        ),
    ] {
        sqlx::query(query)
            .bind(id)
            .execute(&state.db)
            .await
            .unwrap();
    }
    [ids[0], ids[1], ids[2], ids[3]]
}

/// After a reader came back: only the working feed is due now, the Daily
/// one a day after its last fetch, and the failing and hub-delivered ones
/// keep their wait.
async fn only_the_working_feed_is_due(state: &AppState, feeds: [i64; 4]) {
    let now = nine_turtles::now();
    let [working, failing, daily, hub] = feeds;
    assert!(due_in(state, working, now).await <= 0);
    assert!(due_in(state, failing, now).await > DAY - 60);
    let daily_in = due_in(state, daily, now).await;
    assert!(
        (DAY - 2 * HOUR - 60..=DAY - 2 * HOUR + 60).contains(&daily_in),
        "{daily_in}"
    );
    assert!(due_in(state, hub, now).await > DAY - 60);
}

#[tokio::test]
async fn opening_nine_turtles_again_after_a_month_brings_the_feeds_back() {
    let (base, state) = common::start_with_state(common::config()).await;
    let (reader, cookie) = common::another_reader(&state).await;
    let feeds = resting_feeds(&base, &cookie, &state).await;
    last_seen(&state, reader, 40 * DAY).await;
    // The device opens nine turtles: its sign-in is renewed, and noted.
    let (status, _) = fetch(&base, &cookie, "/api/session").await;
    assert_eq!(status, StatusCode::OK);
    only_the_working_feed_is_due(&state, feeds).await;
}

#[tokio::test]
async fn signing_in_again_after_a_month_brings_the_feeds_back() {
    let (base, state) = common::start_with_state(common::config()).await;
    let (reader, cookie) = common::another_reader(&state).await;
    let feeds = resting_feeds(&base, &cookie, &state).await;
    last_seen(&state, reader, 40 * DAY).await;
    // A new device signs in (as signing in, signing up and a new password do).
    nine_turtles::auth::remember_device(&state.db, reader)
        .await
        .unwrap();
    only_the_working_feed_is_due(&state, feeds).await;
}

#[tokio::test]
async fn syncing_from_another_app_after_a_month_brings_the_feeds_back() {
    let (base, state) = common::start_with_state(common::config()).await;
    let (reader, cookie) = common::another_reader(&state).await;
    let feeds = resting_feeds(&base, &cookie, &state).await;
    let (status, made) = send(
        &base,
        &cookie,
        "/api/apps/password",
        "application/json",
        "{}".into(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let password = made["password"].as_str().unwrap().to_owned();
    last_seen(&state, reader, 40 * DAY).await;
    let response = Client::new()
        .get(format!("{base}/api/greader/reader/api/0/user-info"))
        .header("authorization", format!("GoogleLogin auth={password}"))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    only_the_working_feed_is_due(&state, feeds).await;
}
