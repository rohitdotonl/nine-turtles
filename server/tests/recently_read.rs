//! Recently read, lists hidden from the sidebar, and how often a feed posts
//! (SPEC sections 5, 15, 17 and 18; decision 0105), tested against a real
//! running nine turtles and a made-up publisher.

mod common;

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// A made-up blog whose feed has 60 posts, one a day up to yesterday.
async fn publisher() -> String {
    let app = Router::new().route("/feed.xml", get(|| async { feed() }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}/feed.xml")
}

fn feed() -> impl IntoResponse {
    let now = nine_turtles::now();
    let items: String = (1..=60)
        .map(|day| {
            format!(
                "<entry><title>Post {day}</title><id>post-{day}</id>\
                 <updated>{}</updated></entry>",
                nine_turtles::starred::rfc3339(now - day * 86_400)
            )
        })
        .collect();
    (
        [(header::CONTENT_TYPE, "application/atom+xml")],
        format!(
            r#"<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
            <title>Quiet Notes</title><id>quiet</id><updated>2026-01-01T00:00:00Z</updated>{items}</feed>"#
        ),
    )
}

async fn send(base: &str, cookie: &str, path: &str, body: Value) -> (StatusCode, Value) {
    let response = Client::new()
        .post(format!("{base}{path}"))
        .header("cookie", cookie)
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .unwrap();
    let status = response.status();
    let text = response.text().await.unwrap();
    (status, serde_json::from_str(&text).unwrap_or(Value::Null))
}

async fn ask(base: &str, cookie: &str, path: &str) -> (StatusCode, Value) {
    let response = Client::new()
        .get(format!("{base}{path}"))
        .header("cookie", cookie)
        .send()
        .await
        .unwrap();
    let status = response.status();
    let text = response.text().await.unwrap();
    (status, serde_json::from_str(&text).unwrap_or(Value::Null))
}

/// The titles in Recently read, in order.
async fn recent(base: &str, cookie: &str) -> Vec<String> {
    let (status, page) = ask(base, cookie, "/api/articles?view=recent").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(page["next"], Value::Null);
    page["articles"]
        .as_array()
        .unwrap()
        .iter()
        .map(|article| article["title"].as_str().unwrap().to_owned())
        .collect()
}

/// Every article's number in a feed, newest first.
async fn ids(base: &str, cookie: &str, feed: i64) -> Vec<i64> {
    let mut found = Vec::new();
    let mut path = format!("/api/articles?feed={feed}");
    loop {
        let (_, page) = ask(base, cookie, &path).await;
        for article in page["articles"].as_array().unwrap() {
            found.push(article["id"].as_i64().unwrap());
        }
        match page["next"].as_str() {
            Some(next) => path = format!("/api/articles?feed={feed}&after={next}"),
            None => return found,
        }
    }
}

#[tokio::test]
async fn recently_read_lists_the_last_50_opened_newest_opened_first_for_their_reader_alone() {
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (status, added) = send(
        &base,
        &cookie,
        "/api/feeds",
        json!({ "address": publisher().await }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let feed = added["feed"]["id"].as_i64().unwrap();
    let ids = ids(&base, &cookie, feed).await;
    assert_eq!(ids.len(), 60);

    assert!(recent(&base, &cookie).await.is_empty());

    // Opened in this order: Post 1, then Post 2, then Post 1 again (already read).
    for index in [0, 1, 0] {
        let (status, _) = send(
            &base,
            &cookie,
            "/api/articles/opened",
            json!({ "id": ids[index] }),
        )
        .await;
        assert_eq!(status, StatusCode::NO_CONTENT);
        // Times are in milliseconds: keep each opening apart.
        tokio::time::sleep(std::time::Duration::from_millis(3)).await;
    }
    assert_eq!(recent(&base, &cookie).await, ["Post 1", "Post 2"]);

    // Opening is no mark: nothing changes in Unread or Starred.
    let (_, unread) = ask(&base, &cookie, "/api/articles?view=unread").await;
    assert_eq!(unread["articles"].as_array().unwrap().len(), 50);
    let (_, starred) = ask(&base, &cookie, "/api/articles?view=starred").await;
    assert!(starred["articles"].as_array().unwrap().is_empty());
    // And there's never anything "new" in it.
    let (_, new) = ask(&base, &cookie, "/api/articles/new?view=recent&since=0").await;
    assert_eq!(new["new"], false);

    // Another reader of the same feed sees none of it, and can't add to it.
    let (_, other) = common::another_reader(&state).await;
    let (status, _) = send(
        &base,
        &other,
        "/api/feeds",
        json!({ "address": publisher_of(&state, feed).await }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert!(recent(&base, &other).await.is_empty());
    // Their own opening is theirs alone.
    send(
        &base,
        &other,
        "/api/articles/opened",
        json!({ "id": ids[5] }),
    )
    .await;
    assert_eq!(recent(&base, &other).await, ["Post 6"]);
    assert_eq!(recent(&base, &cookie).await, ["Post 1", "Post 2"]);

    // Opening every article keeps only the latest 50, so the first ones go.
    for id in ids.iter().rev() {
        send(&base, &cookie, "/api/articles/opened", json!({ "id": id })).await;
        tokio::time::sleep(std::time::Duration::from_millis(2)).await;
    }
    let listed = recent(&base, &cookie).await;
    assert_eq!(listed.len(), 50);
    assert_eq!(listed[0], "Post 1");
    assert_eq!(listed[49], "Post 50");
    let kept: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM entries WHERE person_id = 1 AND opened_at IS NOT NULL",
    )
    .fetch_one(&state.db)
    .await
    .unwrap();
    assert_eq!(kept, 50);

    // A muted article isn't listed, so it keeps no place: opening Post 60
    // again after muting Post 1 still leaves 50 to show.
    let (status, _) = send(
        &base,
        &cookie,
        "/api/articles/muted",
        json!({ "ids": [ids[0]], "muted": true }),
    )
    .await;
    assert!(status.is_success());
    send(
        &base,
        &cookie,
        "/api/articles/opened",
        json!({ "id": ids[59] }),
    )
    .await;
    let listed = recent(&base, &cookie).await;
    assert_eq!(listed.len(), 50);
    assert_eq!(listed[0], "Post 60");
    assert_eq!(listed[1], "Post 2");
    assert_eq!(listed[49], "Post 50");

    // Leaving the feed takes its articles out of the list.
    let (status, _) = send(
        &base,
        &cookie,
        &format!("/api/feeds/{feed}/unsubscribe"),
        json!({}),
    )
    .await;
    assert!(status.is_success());
    assert!(recent(&base, &cookie).await.is_empty());
}

/// The address the feed is fetched from.
async fn publisher_of(state: &nine_turtles::AppState, feed: i64) -> String {
    sqlx::query_scalar("SELECT url FROM feeds WHERE id = ?")
        .bind(feed)
        .fetch_one(&state.db)
        .await
        .unwrap()
}

#[tokio::test]
async fn hidden_lists_follow_the_reader_and_only_them() {
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (_, settings) = ask(&base, &cookie, "/api/settings").await;
    assert_eq!(settings["hidden"], json!([]));

    let (status, saved) = send(
        &base,
        &cookie,
        "/api/settings",
        json!({ "hidden": ["searches", "recent"] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(saved["hidden"], json!(["recent", "searches"]));
    // Saving another setting leaves them as they are.
    send(&base, &cookie, "/api/settings", json!({ "sort": "oldest" })).await;
    let (_, settings) = ask(&base, &cookie, "/api/settings").await;
    assert_eq!(settings["hidden"], json!(["recent", "searches"]));

    // Unread can't be hidden.
    let (status, _) = send(
        &base,
        &cookie,
        "/api/settings",
        json!({ "hidden": ["unread"] }),
    )
    .await;
    assert!(status.is_client_error());

    let (_, other) = common::another_reader(&state).await;
    let (_, theirs) = ask(&base, &other, "/api/settings").await;
    assert_eq!(theirs["hidden"], json!([]));
}

#[tokio::test]
async fn how_often_a_feed_posts_is_said_in_words_to_its_readers_only() {
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (_, added) = send(
        &base,
        &cookie,
        "/api/feeds",
        json!({ "address": publisher().await }),
    )
    .await;
    let feed = added["feed"]["id"].as_i64().unwrap();

    let (status, answer) = ask(&base, &cookie, &format!("/api/feeds/{feed}/frequency")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(answer["words"], "Posts about once a day");

    let (_, other) = common::another_reader(&state).await;
    let (status, _) = ask(&base, &other, &format!("/api/feeds/{feed}/frequency")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn how_often_a_feed_posts_shows_on_feed_health_even_once_cleaned_up() {
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (_, added) = send(
        &base,
        &cookie,
        "/api/feeds",
        json!({ "address": publisher().await }),
    )
    .await;
    let feed = added["feed"]["id"].as_i64().unwrap();
    let now = nine_turtles::now();

    // It stops working: listed on Feed health, with how often it posts.
    sqlx::query("UPDATE feeds SET failures = ?, failing_since = ? WHERE id = ?")
        .bind(nine_turtles::health::LISTED_AFTER)
        .bind(now - 10 * 86_400)
        .bind(feed)
        .execute(&state.db)
        .await
        .unwrap();
    let (status, health) = ask(&base, &cookie, "/api/health").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(health["feeds"][0]["id"], feed);
    assert_eq!(health["feeds"][0]["frequency"], "Posts about once a day");

    // Years later the yearly clean-up has emptied it: it doesn't say "Too
    // new to tell", but that nothing came for over a year.
    sqlx::query("UPDATE feeds SET added_at = ? WHERE id = ?")
        .bind(now - 900 * 86_400)
        .bind(feed)
        .execute(&state.db)
        .await
        .unwrap();
    nine_turtles::cleanup::run(&state.db, now + 2 * nine_turtles::cleanup::KEPT_FOR)
        .await
        .unwrap();
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM articles WHERE feed_id = ?")
        .bind(feed)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(left, 0);
    let (_, health) = ask(&base, &cookie, "/api/health").await;
    assert_eq!(
        health["feeds"][0]["frequency"],
        "Hasn't posted in over a year"
    );
    let (_, answer) = ask(&base, &cookie, &format!("/api/feeds/{feed}/frequency")).await;
    assert_eq!(answer["words"], "Hasn't posted in over a year");
}
