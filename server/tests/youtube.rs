//! YouTube as a first-class citizen (SPEC section 38, decision 0144),
//! tested against a real running nine turtles: Shorts and live streams are
//! left out unless a reader switches them on, YouTube subscriptions come in
//! from Google Takeout's file, and a video keeps where you stopped. Nothing
//! here reaches YouTube: the channel is made up and stored directly.

mod common;

use nine_turtles::feed::{ParsedArticle, VideoKind};
use reqwest::{Client, StatusCode, Url};
use serde_json::{Value, json};

const CHANNEL_FEED: &str =
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv";

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

async fn ask(base: &str, cookie: &str, path: &str) -> Value {
    let response = Client::new()
        .get(format!("{base}{path}"))
        .header("cookie", cookie)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    serde_json::from_str(&response.text().await.unwrap()).unwrap()
}

fn video(fingerprint: &str, id: &str, kind: Option<VideoKind>) -> ParsedArticle {
    ParsedArticle {
        fingerprint: fingerprint.to_owned(),
        title: fingerprint.to_owned(),
        link: Some(format!("https://www.youtube.com/watch?v={id}")),
        author: None,
        content: None,
        summary: None,
        language: None,
        published_at: None,
        episode: None,
        video_kind: kind,
    }
}

/// A made-up channel, followed by `people`, with the videos given stored.
async fn channel(state: &nine_turtles::AppState, people: &[i64], videos: &[ParsedArticle]) -> i64 {
    let url = Url::parse(CHANNEL_FEED).unwrap();
    let feed: i64 = sqlx::query_scalar(
        "INSERT INTO feeds (url, url_key, title, added_at) VALUES (?, ?, 'Walks', 1) RETURNING id",
    )
    .bind(CHANNEL_FEED)
    .bind(nine_turtles::feed::normalize(&url))
    .fetch_one(&state.db)
    .await
    .unwrap();
    let mut transaction = state.db.begin().await.unwrap();
    for person in people {
        nine_turtles::feeds::subscribe(&mut transaction, *person, feed, "Walks", 1)
            .await
            .unwrap();
    }
    nine_turtles::feeds::store_articles(&mut transaction, feed, videos, nine_turtles::now())
        .await
        .unwrap();
    transaction.commit().await.unwrap();
    feed
}

/// The titles of a feed's articles a reader sees, A to Z.
async fn seen(base: &str, cookie: &str, feed: i64) -> Vec<(String, bool)> {
    let page = ask(base, cookie, &format!("/api/articles?feed={feed}")).await;
    let mut titles: Vec<(String, bool)> = page["articles"]
        .as_array()
        .unwrap()
        .iter()
        .map(|article| {
            (
                article["title"].as_str().unwrap().to_owned(),
                article["read"].as_bool().unwrap(),
            )
        })
        .collect();
    titles.sort();
    titles
}

#[tokio::test]
async fn shorts_and_live_streams_are_left_out_until_a_reader_switches_them_on() {
    let (base, state) = common::start_with_state(common::config()).await;
    let owner = common::signed_in(&base).await;
    let (other, other_cookie) = common::another_reader(&state).await;
    let feed = channel(
        &state,
        &[1, other],
        &[
            video("long", "aaaaaaaaaaa", None),
            video("short", "bbbbbbbbbbb", Some(VideoKind::Short)),
            video("live", "ccccccccccc", Some(VideoKind::Live)),
        ],
    )
    .await;

    let unread = |title: &str| (title.to_owned(), false);
    assert_eq!(seen(&base, &owner, feed).await, [unread("long")]);
    assert_eq!(seen(&base, &other_cookie, feed).await, [unread("long")]);
    let feeds = ask(&base, &owner, "/api/feeds").await;
    let listed = &feeds["feeds"][0];
    assert_eq!(listed["sorts_videos"], true);
    assert_eq!(listed["shorts"], false);
    assert_eq!(listed["live_streams"], false);

    // The owner switches Shorts on: the one already stored joins their list,
    // read, and the next one arrives unread. The other reader sees neither.
    let (status, _) = send(
        &base,
        &owner,
        &format!("/api/feeds/{feed}"),
        json!({ "title": "Walks", "folders": [], "shorts": true }),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(
        seen(&base, &owner, feed).await,
        [unread("long"), ("short".to_owned(), true)]
    );
    let mut transaction = state.db.begin().await.unwrap();
    nine_turtles::feeds::store_articles(
        &mut transaction,
        feed,
        &[video("short 2", "ddddddddddd", Some(VideoKind::Short))],
        nine_turtles::now(),
    )
    .await
    .unwrap();
    transaction.commit().await.unwrap();
    assert_eq!(
        seen(&base, &owner, feed).await,
        [
            unread("long"),
            ("short".to_owned(), true),
            unread("short 2")
        ]
    );
    assert_eq!(seen(&base, &other_cookie, feed).await, [unread("long")]);
    let feeds = ask(&base, &owner, "/api/feeds").await;
    assert_eq!(feeds["feeds"][0]["shorts"], true);
    assert_eq!(feeds["feeds"][0]["live_streams"], false);

    // Switched off again: new Shorts are left out, the ones here stay.
    send(
        &base,
        &owner,
        &format!("/api/feeds/{feed}"),
        json!({ "title": "Walks", "folders": [], "shorts": false }),
    )
    .await;
    let mut transaction = state.db.begin().await.unwrap();
    nine_turtles::feeds::store_articles(
        &mut transaction,
        feed,
        &[video("short 3", "eeeeeeeeeee", Some(VideoKind::Short))],
        nine_turtles::now(),
    )
    .await
    .unwrap();
    transaction.commit().await.unwrap();
    assert_eq!(seen(&base, &owner, feed).await.len(), 3);

    // The reading area knows a Short, for its tall player.
    let page = ask(&base, &owner, &format!("/api/articles?feed={feed}")).await;
    let short = page["articles"]
        .as_array()
        .unwrap()
        .iter()
        .find(|article| article["title"] == "short")
        .unwrap()["id"]
        .as_i64()
        .unwrap();
    let article = ask(&base, &owner, &format!("/api/articles/{short}")).await;
    assert_eq!(article["article"]["video_kind"], "short");
}

#[tokio::test]
async fn a_video_keeps_where_you_stopped_on_any_device() {
    let (base, state) = common::start_with_state(common::config()).await;
    let owner = common::signed_in(&base).await;
    let feed = channel(&state, &[1], &[video("long", "aaaaaaaaaaa", None)]).await;
    let page = ask(&base, &owner, &format!("/api/articles?feed={feed}")).await;
    let id = page["articles"][0]["id"].as_i64().unwrap();

    let (status, _) = send(
        &base,
        &owner,
        &format!("/api/episodes/{id}/progress"),
        json!({ "position": 240.0, "duration": 600.0 }),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let kept = ask(&base, &owner, &format!("/api/episodes/{id}/progress")).await;
    assert_eq!(kept["progress"]["position"], 240.0);
    assert_eq!(kept["progress"]["finished"], false);
}

#[tokio::test]
async fn youtube_subscriptions_come_in_from_google_takeout() {
    let (base, _) = common::start_with_state(common::config()).await;
    let owner = common::signed_in(&base).await;
    let file = "Channel Id,Channel Url,Channel Title\n\
        UCabcdefghijklmnopqrstuv,http://www.youtube.com/channel/UCabcdefghijklmnopqrstuv,Walks\n\
        UCzyxwvutsrqponmlkjihgfe,http://www.youtube.com/channel/UCzyxwvutsrqponmlkjihgfe,\"Maps, mostly\"\n";
    let response = Client::new()
        .post(format!("{base}/api/opml"))
        .header("cookie", &owner)
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "text/csv")
        .body(file)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let answer: Value = serde_json::from_str(&response.text().await.unwrap()).unwrap();
    assert_eq!(answer["summary"]["added"], 2);

    let feeds = ask(&base, &owner, "/api/feeds").await;
    let mut names: Vec<(String, String, bool)> = feeds["feeds"]
        .as_array()
        .unwrap()
        .iter()
        .map(|feed| {
            (
                feed["title"].as_str().unwrap().to_owned(),
                feed["place"].as_str().unwrap().to_owned(),
                feed["sorts_videos"].as_bool().unwrap(),
            )
        })
        .collect();
    names.sort();
    assert_eq!(
        names,
        [
            ("Maps, mostly".to_owned(), "video".to_owned(), true),
            ("Walks".to_owned(), "video".to_owned(), true)
        ]
    );
}
