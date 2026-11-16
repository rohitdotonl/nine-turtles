//! Pictures of people and publications (SPEC section 36, decision 0283),
//! tested against a real running nine turtles and a made-up publisher: the
//! feed's own picture is kept, a reader's chosen picture is kept, shown and
//! taken off, only real pictures are kept, and other readers never see it.

mod common;

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// A made-up blog whose RSS feed names its picture.
async fn publisher() -> String {
    let app = Router::new().route("/feed.xml", get(|| async { feed() }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}/feed.xml")
}

fn feed() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        String::from(
            r#"<?xml version="1.0"?><rss version="2.0"><channel>
            <title>Mara Quill</title><link>https://quill.example/</link>
            <image><url>https://quill.example/mara.jpg</url><title>Mara Quill</title><link>https://quill.example/</link></image>
            <item><title>On ink</title><guid>ink</guid><link>https://quill.example/ink</link>
            <description>Ink, slowly.</description></item>
            </channel></rss>"#,
        ),
    )
}

/// A tiny JPEG's first bytes: enough for nine turtles to know what it is.
const JPEG: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 0, 16, b'J', b'F', b'I', b'F', 0, 1];

async fn post(
    base: &str,
    cookie: &str,
    path: &str,
    body: Vec<u8>,
    kind: &str,
) -> reqwest::Response {
    Client::new()
        .post(format!("{base}{path}"))
        .header("cookie", cookie)
        .header("sec-fetch-site", "same-origin")
        .header("content-type", kind)
        .body(body)
        .send()
        .await
        .unwrap()
}

async fn get_from(base: &str, cookie: &str, path: &str) -> reqwest::Response {
    Client::new()
        .get(format!("{base}{path}"))
        .header("cookie", cookie)
        .send()
        .await
        .unwrap()
}

async fn their_feed(base: &str, cookie: &str, feed: i64) -> Value {
    let feeds: Value = get_from(base, cookie, "/api/feeds")
        .await
        .text()
        .await
        .map(|text| serde_json::from_str(&text).unwrap())
        .unwrap();
    feeds["feeds"]
        .as_array()
        .unwrap()
        .iter()
        .find(|each| each["id"] == feed)
        .unwrap()
        .clone()
}

#[tokio::test]
async fn a_chosen_picture_is_kept_shown_and_taken_off() {
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let address = publisher().await;
    let added = post(
        &base,
        &cookie,
        "/api/feeds",
        json!({ "address": address }).to_string().into_bytes(),
        "application/json",
    )
    .await;
    assert_eq!(added.status(), StatusCode::CREATED);
    let added: Value = added
        .text()
        .await
        .map(|text| serde_json::from_str(&text).unwrap())
        .unwrap();
    let feed = added["feed"]["id"].as_i64().unwrap();

    // The feed's own picture comes with it, and no picture is chosen yet.
    assert_eq!(
        added["feed"]["picture_url"],
        "https://quill.example/mara.jpg"
    );
    let row = their_feed(&base, &cookie, feed).await;
    assert_eq!(row["picture_url"], "https://quill.example/mara.jpg");
    assert_eq!(row["picture_chosen"], Value::Null);
    let path = format!("/api/feeds/{feed}/picture");
    assert_eq!(
        get_from(&base, &cookie, &path).await.status(),
        StatusCode::NOT_FOUND
    );

    // Something that isn't a picture is refused, whatever it says it is.
    let svg = post(
        &base,
        &cookie,
        &path,
        b"<svg xmlns=\"http://www.w3.org/2000/svg\"/>".to_vec(),
        "image/jpeg",
    )
    .await;
    assert_eq!(svg.status(), StatusCode::UNSUPPORTED_MEDIA_TYPE);
    // So is one far too big.
    let mut huge = JPEG.to_vec();
    huge.resize(nine_turtles::pictures::LARGEST + 1, 0);
    assert_eq!(
        post(&base, &cookie, &path, huge, "image/jpeg")
            .await
            .status(),
        StatusCode::PAYLOAD_TOO_LARGE
    );

    // A picture is kept, and shown as what it really is.
    let chosen = post(
        &base,
        &cookie,
        &path,
        JPEG.to_vec(),
        "application/octet-stream",
    )
    .await;
    assert_eq!(chosen.status(), StatusCode::OK);
    let at = serde_json::from_str::<Value>(&chosen.text().await.unwrap()).unwrap()["chosen"]
        .as_i64()
        .unwrap();
    assert_eq!(their_feed(&base, &cookie, feed).await["picture_chosen"], at);
    let shown = get_from(&base, &cookie, &path).await;
    assert_eq!(shown.status(), StatusCode::OK);
    assert_eq!(shown.headers()["content-type"], "image/jpeg");
    assert_eq!(shown.bytes().await.unwrap().as_ref(), JPEG);

    // Another reader can't see it, nor choose one for a place they don't follow.
    let (_, other) = common::another_reader(&state).await;
    assert_eq!(
        get_from(&base, &other, &path).await.status(),
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        post(&base, &other, &path, JPEG.to_vec(), "image/jpeg")
            .await
            .status(),
        StatusCode::NOT_FOUND
    );

    // Reset takes it off; the feed's own picture is still there.
    let reset = post(
        &base,
        &cookie,
        &format!("{path}/delete"),
        Vec::new(),
        "application/json",
    )
    .await;
    assert_eq!(reset.status(), StatusCode::NO_CONTENT);
    assert_eq!(
        get_from(&base, &cookie, &path).await.status(),
        StatusCode::NOT_FOUND
    );
    let row = their_feed(&base, &cookie, feed).await;
    assert_eq!(row["picture_chosen"], Value::Null);
    assert_eq!(row["picture_url"], "https://quill.example/mara.jpg");
}
