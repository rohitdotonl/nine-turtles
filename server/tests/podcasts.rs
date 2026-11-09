//! Podcasts (SPEC section 35, decision 0113): episodes found in a feed,
//! and where each reader stopped in each, tested against a
//! real running nine turtles and a made-up podcast. nine turtles keeps only
//! the publisher's address for each audio file and never fetches it.

mod common;

use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// A made-up podcast: three episodes and one plain post. Its audio files
/// are served too, and every request for one is counted: nine turtles must
/// never ask for one.
async fn podcast(audio_asked: Arc<AtomicUsize>) -> String {
    let app = Router::new()
        .route("/feed.xml", get(|| async { feed() }))
        .route(
            "/audio/{name}",
            get(move || {
                let audio_asked = audio_asked.clone();
                async move {
                    audio_asked.fetch_add(1, Ordering::SeqCst);
                    ([(header::CONTENT_TYPE, "audio/mpeg")], vec![0u8; 16])
                }
            }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}/feed.xml")
}

fn feed() -> impl IntoResponse {
    let now = nine_turtles::now();
    let date = |days: i64| nine_turtles::dates::rfc3339(now - days * 86_400);
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(
            r#"<?xml version="1.0"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
<title>Slow Radio</title><link>https://radio.example/</link>
<itunes:image href="https://radio.example/show.jpg"/>
<item><title>Episode 1</title><guid>ep-1</guid><pubDate>{}</pubDate>
<description>Notes for one</description>
<enclosure url="/audio/1.mp3" length="1000" type="audio/mpeg"/>
<itunes:duration>30:00</itunes:duration></item>
<item><title>Episode 2</title><guid>ep-2</guid><pubDate>{}</pubDate>
<enclosure url="/audio/2.mp3" type="audio/mpeg"/></item>
<item><title>Episode 3</title><guid>ep-3</guid><pubDate>{}</pubDate>
<enclosure url="javascript:alert(1)" type="audio/mpeg"/></item>
<item><title>A post</title><guid>post</guid><pubDate>{}</pubDate>
<description>Just words</description></item>
</channel></rss>"#,
            date(1),
            date(2),
            date(3),
            date(4)
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

/// The feed's articles as the list gives them, newest first, by title.
async fn listed(base: &str, cookie: &str, feed: i64) -> Vec<Value> {
    let (status, page) = ask(base, cookie, &format!("/api/articles?feed={feed}")).await;
    assert_eq!(status, StatusCode::OK);
    page["articles"].as_array().unwrap().clone()
}

fn id_of(articles: &[Value], title: &str) -> i64 {
    articles
        .iter()
        .find(|article| article["title"] == title)
        .unwrap_or_else(|| panic!("{title} isn't listed"))["id"]
        .as_i64()
        .unwrap()
}

#[tokio::test]
async fn episodes_are_found_and_only_their_address_is_kept() {
    let (base, _) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let asked = Arc::new(AtomicUsize::new(0));
    let address = podcast(asked.clone()).await;
    let (status, added) = send(&base, &cookie, "/api/feeds", json!({ "address": address })).await;
    assert_eq!(status, StatusCode::CREATED);
    let feed = added["feed"]["id"].as_i64().unwrap();

    let articles = listed(&base, &cookie, feed).await;
    let by_title = |title: &str| {
        articles
            .iter()
            .find(|article| article["title"] == title)
            .unwrap()
            .clone()
    };
    assert_eq!(by_title("Episode 1")["episode"], true);
    assert_eq!(by_title("Episode 1")["episode_seconds"], 1800);
    assert_eq!(by_title("Episode 2")["episode"], true);
    assert_eq!(by_title("Episode 2")["episode_seconds"], Value::Null);
    // An address that isn't on the web is no episode; nor is a plain post.
    assert_eq!(by_title("Episode 3")["episode"], false);
    assert_eq!(by_title("A post")["episode"], false);

    let first = id_of(&articles, "Episode 1");
    let (status, read) = ask(&base, &cookie, &format!("/api/articles/{first}")).await;
    assert_eq!(status, StatusCode::OK);
    let article = &read["article"];
    let audio = address.replace("feed.xml", "audio/1.mp3");
    assert_eq!(article["episode_url"], audio.as_str());
    assert_eq!(article["episode_type"], "audio/mpeg");
    assert_eq!(article["episode_bytes"], 1000);
    assert_eq!(article["episode_seconds"], 1800);
    assert_eq!(article["episode_artwork"], "https://radio.example/show.jpg");
    assert!(
        article["content"]
            .as_str()
            .unwrap()
            .contains("Notes for one")
    );

    // nine turtles itself never asked for an audio file.
    assert_eq!(asked.load(Ordering::SeqCst), 0);
}

#[tokio::test]
async fn where_a_reader_stopped_is_theirs_and_the_latest_save_wins() {
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let address = podcast(Arc::new(AtomicUsize::new(0))).await;
    let (_, added) = send(&base, &cookie, "/api/feeds", json!({ "address": address })).await;
    let feed = added["feed"]["id"].as_i64().unwrap();
    let articles = listed(&base, &cookie, feed).await;
    let first = id_of(&articles, "Episode 1");
    let post = id_of(&articles, "A post");
    let path = format!("/api/episodes/{first}/progress");

    let (status, none) = ask(&base, &cookie, &path).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(none["progress"], Value::Null);

    let (status, _) = send(
        &base,
        &cookie,
        &path,
        json!({ "position": 125.5, "duration": 1800.0, "at": 2_000 }),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (_, saved) = ask(&base, &cookie, &path).await;
    assert_eq!(
        saved["progress"],
        json!({ "position": 125.5, "duration": 1800.0, "finished": false, "saved_at": 2_000 })
    );

    // A save made earlier, arriving late from another device, changes nothing.
    send(
        &base,
        &cookie,
        &path,
        json!({ "position": 10.0, "duration": 1800.0, "at": 1_000 }),
    )
    .await;
    let (_, kept) = ask(&base, &cookie, &path).await;
    assert_eq!(kept["progress"]["position"], 125.5);

    // Played to the end.
    send(
        &base,
        &cookie,
        &path,
        json!({ "position": 1795.0, "duration": 1800.0, "finished": true }),
    )
    .await;
    let (_, done) = ask(&base, &cookie, &path).await;
    assert_eq!(done["progress"]["finished"], true);

    // Nonsense is refused; a plain post has no place to keep.
    let (status, _) = send(&base, &cookie, &path, json!({ "position": -3.0 })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = send(
        &base,
        &cookie,
        &format!("/api/episodes/{post}/progress"),
        json!({ "position": 3.0 }),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // Another reader, who doesn't follow the podcast, can neither see nor set it.
    let (_, other) = common::another_reader(&state).await;
    let (_, theirs) = ask(&base, &other, &path).await;
    assert_eq!(theirs["progress"], Value::Null);
    let (status, _) = send(&base, &other, &path, json!({ "position": 3.0 })).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    // Once they follow it, their place is their own.
    send(&base, &other, "/api/feeds", json!({ "address": address })).await;
    let (_, theirs) = ask(&base, &other, &path).await;
    assert_eq!(theirs["progress"], Value::Null);
    send(&base, &other, &path, json!({ "position": 3.0 })).await;
    let (_, mine) = ask(&base, &cookie, &path).await;
    assert_eq!(mine["progress"]["position"], 1795.0);

    // Leaving the podcast takes its places with it, once its articles go.
    send(
        &base,
        &cookie,
        &format!("/api/feeds/{feed}/unsubscribe"),
        json!({}),
    )
    .await;
    nine_turtles::folders::clear_unsubscribed(&state.db, None, i64::MAX)
        .await
        .unwrap();
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM episode_progress WHERE person_id = 1")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(left, 0);
}

#[tokio::test]
async fn up_next_is_gone() {
    // Removed in step 5 of the owner's review: you play the episode you opened.
    let (base, _) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (status, _) = ask(&base, &cookie, "/api/up-next").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = ask(&base, &cookie, "/api/articles?view=upnext").await;
    assert!(status.is_client_error());
}
