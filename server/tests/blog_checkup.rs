//! The website's blog checkup (SPEC section 43), tested against a real
//! running nine turtles and made-up blogs, with nobody signed in.

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

/// A made-up blog. Its home page names its feed and links a contact page;
/// with `address_at_home`, the home page shows the writer's address too.
/// It notes every address visited.
async fn blog(address_at_home: bool) -> (String, Arc<Mutex<Vec<String>>>) {
    let visited: Arc<Mutex<Vec<String>>> = Arc::default();
    let home = if address_at_home {
        r#"<html><head><meta name="generator" content="WordPress 6.8">
            <link rel="alternate" type="application/rss+xml" href="/feed.xml"></head>
            <body><a href="/2026/tea">Tea</a> <a href="/contact/">Contact</a>
            <p>Write to hal@hal.example</p></body></html>"#
    } else {
        r#"<html><head><meta name="generator" content="WordPress 6.8">
            <link rel="alternate" type="application/rss+xml" href="/feed.xml"></head>
            <body><a href="/2026/tea">Tea</a> <a href="/contact/">Contact</a></body></html>"#
    };
    let app = Router::new()
        .route("/", get(move || async move { html(home) }))
        .route(
            "/contact/",
            get(|| async { html(r#"<p><a href="mailto:hal@hal.example">Email me</a></p>"#) }),
        )
        .route("/feed.xml", get(|| async { feed() }))
        .fallback(|| async { StatusCode::NOT_FOUND })
        .layer(axum::middleware::from_fn_with_state(
            visited.clone(),
            note_visit,
        ));
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

/// Two posts by Hal, with no address anywhere in the feed.
fn feed() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        r#"<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <channel><title>Notes</title><link>/</link>
        <item><title>Tea</title><link>/2026/tea</link><guid>1</guid><dc:creator>Hal Berg</dc:creator>
        <pubDate>02 Jan 2026 09:00:00 GMT</pubDate></item>
        <item><title>Rain</title><link>/2026/rain</link><guid>2</guid><dc:creator>Hal Berg</dc:creator>
        <pubDate>01 Jan 2026 09:00:00 GMT</pubDate></item>
        </channel></rss>"#,
    )
}

async fn check(base: &str, address: &str) -> (StatusCode, Option<String>, Value) {
    let mut url = reqwest::Url::parse(&format!("{base}/api/checkup")).unwrap();
    url.query_pairs_mut().append_pair("address", address);
    let response = reqwest::Client::new().get(url).send().await.unwrap();
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
async fn a_blog_with_only_a_contact_page_is_enough_and_each_page_is_visited_once() {
    let base = common::start(common::config()).await;
    let (site, visited) = blog(false).await;

    let (status, allowed, body) = check(&base, &format!("{site}/")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(allowed.as_deref(), Some("https://nineturtles.app"));
    assert_eq!(body["feed"]["title"], "Notes");
    assert_eq!(body["feed"]["posts"], 2);
    assert_eq!(body["name"], "Hal Berg");
    assert_eq!(body["email_in_feed"], Value::Null);
    assert_eq!(body["reply_in_posts"], Value::Null);
    assert_eq!(body["contact_page"], format!("{site}/contact/"));
    assert_eq!(body["address_on_site"], "hal@hal.example");
    assert_eq!(body["platform"], "wordpress");
    // The page given was the home page: fetched once, never an article.
    assert_eq!(*visited.lock().unwrap(), ["/", "/feed.xml", "/contact/"]);

    // Asked again: remembered, so the blog isn't visited again.
    let (status, _, again) = check(&base, &format!("{site}/")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(again, body);
    assert_eq!(visited.lock().unwrap().len(), 3);
}

#[tokio::test]
async fn an_address_on_the_home_page_means_the_contact_page_is_not_fetched() {
    let base = common::start(common::config()).await;
    let (site, visited) = blog(true).await;

    let (status, _, body) = check(&base, &format!("{site}/")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["contact_page"], format!("{site}/contact/"));
    assert_eq!(body["address_on_site"], "hal@hal.example");
    assert_eq!(*visited.lock().unwrap(), ["/", "/feed.xml"]);
}

#[tokio::test]
async fn something_that_isnt_an_address_is_refused() {
    let base = common::start(common::config()).await;
    let (status, _, body) = check(&base, "not an address").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "not-an-address");
}
