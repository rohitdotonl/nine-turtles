//! Posts with no title (SPEC section 6, decision 0196): the list is sent
//! the post's opening words, as plain text, to show once instead of a
//! title, and no line of its text under it. Tested against a real running
//! nine turtles and a made-up feed.

mod common;

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// A made-up blog: one short post with no title, its words in HTML, and
/// one post with a title.
async fn blog() -> String {
    let app = Router::new().route("/feed.xml", get(|| async { feed() }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}/feed.xml")
}

fn feed() -> impl IntoResponse {
    let now = nine_turtles::now();
    let date = |days: i64| nine_turtles::dates::rfc3339(now - days * 86_400);
    let long = format!("{} kingfisher", "walking ".repeat(60));
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(
            r#"<?xml version="1.0"?>
<rss version="2.0"><channel><title>Mira</title><link>https://mira.example/</link>
<item><guid>note</guid><link>https://mira.example/note</link><pubDate>{}</pubDate>
<description>&lt;p&gt;Saw the &lt;em&gt;first&lt;/em&gt; heron&lt;/p&gt;&lt;p&gt;of the year.&lt;/p&gt;</description></item>
<item><guid>long</guid><link>https://mira.example/long</link><pubDate>{}</pubDate>
<description>{long}</description></item>
<item><title>A titled post</title><guid>titled</guid><link>https://mira.example/titled</link>
<pubDate>{}</pubDate><description>Saw a heron again.</description></item>
</channel></rss>"#,
            date(1),
            date(2),
            date(3)
        ),
    )
}

async fn ask(base: &str, cookie: &str, path: &str) -> Value {
    let response = Client::new()
        .get(format!("{base}{path}"))
        .header("cookie", cookie)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK, "{path}");
    serde_json::from_str(&response.text().await.unwrap()).unwrap()
}

#[tokio::test]
async fn an_untitled_post_is_listed_by_its_opening_words_once() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let response = Client::new()
        .post(format!("{base}/api/feeds"))
        .header("cookie", &cookie)
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body(json!({ "address": blog().await }).to_string())
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let page = ask(&base, &cookie, "/api/articles?view=all").await;
    let articles = page["articles"].as_array().unwrap();
    let by_link = |end: &str| {
        articles
            .iter()
            .find(|article| article["link"].as_str().unwrap().ends_with(end))
            .unwrap()
            .clone()
    };
    // Its words as plain text, each paragraph's kept apart from the next.
    let note = by_link("/note");
    assert_eq!(note["title"], "");
    assert_eq!(note["opening"], "Saw the first heron of the year.");
    // A long post sends only what two lines can show.
    let long = by_link("/long")["opening"].as_str().unwrap().to_owned();
    assert_eq!(long.chars().count(), 200);
    // A titled post is sent its title alone.
    assert!(by_link("/titled").get("opening").is_none());

    // Read on its own (and kept on the device for reading offline), it says the same.
    let id = note["id"].as_i64().unwrap();
    let full = ask(&base, &cookie, &format!("/api/articles/{id}")).await;
    assert_eq!(
        full["article"]["opening"],
        "Saw the first heron of the year."
    );

    // Searching finds it by its words, and shows no line of its text under
    // the opening when the opening already shows the searched word.
    let found = ask(&base, &cookie, "/api/search?q=heron").await;
    let results = found["articles"].as_array().unwrap();
    let untitled = results.iter().find(|result| result["id"] == id).unwrap();
    assert_eq!(untitled["opening"], "Saw the first heron of the year.");
    assert_eq!(untitled["excerpt"], Value::Null);
    let titled = results
        .iter()
        .find(|result| result["title"] == "A titled post")
        .unwrap();
    assert!(titled["excerpt"].is_array());
    // A word found only past the opening gets its line, to say why it was found.
    let found = ask(&base, &cookie, "/api/search?q=kingfisher").await;
    let deep = &found["articles"][0];
    assert_eq!(deep["opening"].as_str().unwrap().chars().count(), 200);
    assert!(deep["excerpt"].is_array());
}
