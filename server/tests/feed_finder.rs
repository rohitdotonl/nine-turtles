//! The website's feed finder (SPEC section 30), tested against a real
//! running nine turtles and a made-up publisher's website, with nobody
//! signed in.

mod common;

use std::sync::{Arc, Mutex};

use axum::{
    Router,
    extract::State,
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
    routing::get,
};
use serde_json::Value;

/// A made-up blog: a page naming two feeds, a page naming none, and a feed.
/// It notes every address visited.
async fn publisher() -> (String, Arc<Mutex<Vec<String>>>) {
    let visited: Arc<Mutex<Vec<String>>> = Arc::default();
    let app = Router::new()
        .route(
            "/",
            get(|| async {
                html(r#"<html><head>
                    <link rel="alternate" type="application/rss+xml" title="All posts" href="/feed.xml">
                    <link rel="alternate" type="application/atom+xml" title="Comments" href="/comments.atom">
                </head><body><a href="/post/1">A post</a></body></html>"#)
            }),
        )
        .route("/plain/", get(|| async { html("<html><body>Just a page.</body></html>") }))
        .route("/feed.xml", get(|| async { feed() }))
        .fallback(|| async { StatusCode::NOT_FOUND })
        .layer(axum::middleware::from_fn_with_state(visited.clone(), note_visit));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (format!("http://{address}"), visited)
}

async fn note_visit(
    State(visited): State<Arc<Mutex<Vec<String>>>>,
    uri: Uri,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Response {
    visited.lock().unwrap().push(uri.path().to_owned());
    next.run(request).await
}

fn html(body: &'static str) -> impl IntoResponse {
    ([(header::CONTENT_TYPE, "text/html")], body)
}

/// Seven posts, oldest first, one with a `javascript:` link.
fn feed() -> impl IntoResponse {
    let mut items = String::new();
    for day in 1..=7 {
        let link = if day == 7 {
            "javascript:alert(1)".to_owned()
        } else {
            format!("https://quiet.example/{day}")
        };
        items.push_str(&format!(
            "<item><title>Post {day}</title><link>{link}</link><guid>post-{day}</guid>\
             <pubDate>0{day} Jan 2026 09:00:00 GMT</pubDate></item>"
        ));
    }
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(
            r#"<?xml version="1.0"?><rss version="2.0"><channel><title>Quiet Notes</title>
            <link>https://quiet.example/</link>{items}</channel></rss>"#
        ),
    )
}

async fn find(base: &str, address: &str) -> (StatusCode, Option<String>, Value) {
    let mut url = reqwest::Url::parse(&format!("{base}/api/find-feeds")).unwrap();
    url.query_pairs_mut().append_pair("address", address);
    let response = reqwest::Client::new()
        .get(url)
        .header(header::ORIGIN, "https://nineturtles.app")
        .send()
        .await
        .unwrap();
    let status = response.status();
    let allowed = response
        .headers()
        .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
        .map(|value| value.to_str().unwrap().to_owned());
    (
        status,
        allowed,
        serde_json::from_slice(&response.bytes().await.unwrap()).unwrap(),
    )
}

#[tokio::test]
async fn a_page_gives_its_feeds_and_the_newest_titles_of_the_first() {
    let base = common::start(common::config()).await;
    let (site, visited) = publisher().await;

    let (status, allowed, body) = find(&base, &format!("{site}/")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(allowed.as_deref(), Some("https://nineturtles.app"));
    let feeds: Vec<(&str, &str)> = body["feeds"]
        .as_array()
        .unwrap()
        .iter()
        .map(|feed| {
            (
                feed["title"].as_str().unwrap(),
                feed["url"].as_str().unwrap(),
            )
        })
        .collect();
    assert_eq!(
        feeds,
        [
            ("All posts", format!("{site}/feed.xml").as_str()),
            ("Comments", format!("{site}/comments.atom").as_str()),
        ]
    );
    let preview = &body["preview"];
    assert_eq!(preview["title"], "Quiet Notes");
    assert_eq!(preview["site"], "https://quiet.example/");
    let titles: Vec<&str> = preview["articles"]
        .as_array()
        .unwrap()
        .iter()
        .map(|article| article["title"].as_str().unwrap())
        .collect();
    assert_eq!(titles, ["Post 7", "Post 6", "Post 5", "Post 4", "Post 3"]);
    // A link that isn't a web address is left out.
    assert_eq!(preview["articles"][0]["link"], Value::Null);
    assert_eq!(preview["articles"][1]["link"], "https://quiet.example/6");

    // Only the page given and its first feed were fetched: never the
    // second feed, a post, or a guessed address.
    assert_eq!(*visited.lock().unwrap(), ["/", "/feed.xml"]);

    // Asked again, the answer is remembered: the publisher isn't visited.
    let (status, _, again) = find(&base, &format!("{site}/")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(again, body);
    assert_eq!(visited.lock().unwrap().len(), 2);
}

#[tokio::test]
async fn a_feed_address_is_its_own_answer() {
    let base = common::start(common::config()).await;
    let (site, visited) = publisher().await;

    let (status, _, body) = find(&base, &format!("{site}/feed.xml")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["feeds"][0]["title"], "Quiet Notes");
    assert_eq!(body["feeds"][0]["url"], format!("{site}/feed.xml"));
    assert_eq!(body["preview"]["articles"].as_array().unwrap().len(), 5);
    assert_eq!(*visited.lock().unwrap(), ["/feed.xml"]);
}

#[tokio::test]
async fn problems_are_answered_in_words_the_website_knows() {
    let base = common::start(common::config()).await;
    let (site, visited) = publisher().await;

    let (status, allowed, body) = find(&base, &format!("{site}/plain/")).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(allowed.as_deref(), Some("https://nineturtles.app"));
    assert_eq!(body["error"], "no-feed");
    // Nothing else on the site was tried.
    assert_eq!(*visited.lock().unwrap(), ["/plain/"]);

    let (status, _, body) = find(&base, &format!("{site}/gone/")).await;
    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert_eq!(body["error"], "not-found");
    // A failure is remembered for a while too: asking again doesn't visit.
    let (_, _, again) = find(&base, &format!("{site}/gone/")).await;
    assert_eq!(again["error"], "not-found");
    assert_eq!(*visited.lock().unwrap(), ["/plain/", "/gone/"]);

    let (status, _, body) = find(&base, "not an address").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "not-an-address");
}

#[tokio::test]
async fn private_addresses_are_refused() {
    let mut config = common::config();
    config.local_feeds_allowed = false;
    let base = common::start(config).await;

    let (status, _, body) = find(&base, "http://127.0.0.1:9/").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "not-allowed");
}
