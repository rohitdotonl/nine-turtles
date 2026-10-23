//! Adding a feed and listing its articles (SPEC sections 3 and 6), tested
//! against a real running slowfeed and a made-up publisher's website.

mod common;

use std::sync::{Arc, Mutex};

use axum::{
    Router,
    extract::State,
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Redirect, Response},
    routing::get,
};
use reqwest::Client;
use serde_json::Value;

/// A made-up blog: a home page naming one feed, a page naming two, a page
/// naming none, a feed that moved, a long feed and a huge file.
async fn publisher() -> (String, Arc<Mutex<Vec<String>>>) {
    let visitors: Arc<Mutex<Vec<String>>> = Arc::default();

    let app = Router::new()
        .route(
            "/",
            get(|| async {
                html(r#"<html><head><link rel="alternate" type="application/rss+xml" title="Posts" href="/feed.xml"></head></html>"#)
            }),
        )
        .route("/feed.xml", get(|| async { xml(rss("Quiet Notes", 3)) }))
        .route("/long.xml", get(|| async { xml(rss("Long Feed", 120)) }))
        .route(
            "/two/",
            get(|| async {
                html(r#"<html><head>
                    <link rel="alternate" type="application/rss+xml" title="All posts" href="/feed.xml">
                    <link rel="alternate" type="application/atom+xml" title="Comments" href="/comments.atom">
                </head></html>"#)
            }),
        )
        .route("/plain/", get(|| async { html("<html><body>Just a page.</body></html>") }))
        .route("/comments.atom", get(atom))
        .route("/moved.xml", get(|| async { Redirect::permanent("/comments.atom") }))
        .route(
            "/huge.xml",
            get(|| async { xml("x".repeat(slowfeed::fetch::SIZE_LIMIT + 1)) }),
        )
        .fallback(|| async { StatusCode::NOT_FOUND })
        .layer(axum::middleware::from_fn_with_state(visitors.clone(), remember_visitor));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (format!("http://{address}"), visitors)
}

async fn remember_visitor(
    State(visitors): State<Arc<Mutex<Vec<String>>>>,
    headers: HeaderMap,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Response {
    let agent = headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_owned();
    visitors.lock().unwrap().push(agent);
    next.run(request).await
}

fn xml(body: String) -> impl IntoResponse {
    ([(header::CONTENT_TYPE, "application/rss+xml")], body)
}

fn html(body: &'static str) -> impl IntoResponse {
    ([(header::CONTENT_TYPE, "text/html")], body)
}

/// An RSS feed with `count` articles, a day apart, newest first, plus one
/// article listed twice (the same ID).
fn rss(title: &str, count: u32) -> String {
    let mut items = String::new();
    for number in (1..=count).rev() {
        items.push_str(&format!(
            "<item><title>Post {number}</title><link>https://quiet.example/{number}</link>\
             <guid>post-{number}</guid><pubDate>{}</pubDate></item>",
            date(number)
        ));
    }
    items.push_str(&format!(
        "<item><title>Post 1 again</title><guid>post-1</guid><pubDate>{}</pubDate></item>",
        date(1)
    ));
    format!(
        r#"<?xml version="1.0"?><rss version="2.0"><channel><title>{title}</title>
        <link>https://quiet.example/</link>{items}</channel></rss>"#
    )
}

/// Day `number` of 2026 (1 is 1 January), as an RSS date.
fn date(number: u32) -> String {
    // Only January to May are needed, so a small month table will do.
    let months = [
        ("Jan", 31),
        ("Feb", 28),
        ("Mar", 31),
        ("Apr", 30),
        ("May", 31),
    ];
    let mut day = number - 1;
    for (name, length) in months {
        if day < length {
            return format!("{:02} {name} 2026 12:00:00 GMT", day + 1);
        }
        day -= length;
    }
    unreachable!("dates past May aren't needed")
}

async fn atom() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/atom+xml")],
        r#"<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Comments</title>
        <id>urn:comments</id><updated>2026-02-01T00:00:00Z</updated>
        <entry><title>A comment</title><id>urn:c1</id><updated>2026-02-01T00:00:00Z</updated>
        <link href="https://quiet.example/c1"/></entry></feed>"#,
    )
}

struct Reader {
    base: String,
    cookie: String,
}

impl Reader {
    async fn new() -> Self {
        let base = common::start(common::config()).await;
        let cookie = common::signed_in(&base).await;
        Self { base, cookie }
    }

    async fn add(&self, address: &str) -> (StatusCode, Value) {
        let response = Client::new()
            .post(format!("{}/api/feeds", self.base))
            .header("cookie", &self.cookie)
            .header("sec-fetch-site", "same-origin")
            .header("content-type", "application/json")
            .body(serde_json::json!({ "address": address }).to_string())
            .send()
            .await
            .unwrap();
        let status = response.status();
        let text = response.text().await.unwrap();
        (status, serde_json::from_str(&text).unwrap_or(Value::Null))
    }

    async fn get(&self, path: &str) -> Value {
        let text = Client::new()
            .get(format!("{}{path}", self.base))
            .header("cookie", &self.cookie)
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap();
        serde_json::from_str(&text).unwrap()
    }

    async fn titles(&self, path: &str) -> Vec<String> {
        self.get(path).await["articles"]
            .as_array()
            .unwrap()
            .iter()
            .map(|article| article["title"].as_str().unwrap().to_owned())
            .collect()
    }
}

#[tokio::test]
async fn a_websites_home_page_finds_its_feed_and_the_articles_appear() {
    let (site, visitors) = publisher().await;
    let reader = Reader::new().await;

    let (status, body) = reader.add(&format!("{site}/")).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["feed"]["title"], "Quiet Notes");
    assert_eq!(body["feed"]["site_url"], "https://quiet.example/");

    let feeds = reader.get("/api/feeds").await;
    assert_eq!(feeds["feeds"].as_array().unwrap().len(), 1);
    // Newest first; the article listed twice is stored once.
    assert_eq!(
        reader.titles("/api/articles").await,
        ["Post 3", "Post 2", "Post 1"]
    );

    // slowfeed visited the home page and the feed, saying who it is.
    let visitors = visitors.lock().unwrap();
    assert_eq!(visitors.len(), 2);
    assert!(visitors.iter().all(|agent| agent.starts_with("slowfeed/")));
}

#[tokio::test]
async fn a_feed_address_works_directly_and_only_once() {
    let (site, _) = publisher().await;
    let reader = Reader::new().await;

    let (status, first) = reader.add(&format!("{site}/feed.xml")).await;
    assert_eq!(status, StatusCode::CREATED);
    let id = first["feed"]["id"].clone();

    // The same feed again, even written differently or found through the
    // home page, is "already followed", not a second copy.
    for again in [
        format!("{site}/feed.xml"),
        format!("{site}/feed.xml#top"),
        format!("{site}/"),
    ] {
        let (status, body) = reader.add(&again).await;
        assert_eq!(status, StatusCode::CONFLICT, "{again}");
        assert_eq!(body["error"], "already");
        assert_eq!(body["feed_id"], id);
    }
    assert_eq!(
        reader.get("/api/feeds").await["feeds"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn a_page_with_several_feeds_offers_a_choice() {
    let (site, _) = publisher().await;
    let reader = Reader::new().await;

    let (status, body) = reader.add(&format!("{site}/two/")).await;
    assert_eq!(status, StatusCode::OK);
    let choices = body["choices"].as_array().unwrap();
    assert_eq!(choices.len(), 2);
    assert_eq!(choices[0]["title"], "All posts");
    assert_eq!(choices[1]["title"], "Comments");

    let chosen = choices[1]["url"].as_str().unwrap();
    let (status, body) = reader.add(chosen).await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["feed"]["title"], "Comments");
}

#[tokio::test]
async fn problems_get_a_plain_reason_not_an_error_code() {
    let (site, _) = publisher().await;
    let reader = Reader::new().await;

    for (address, status, reason) in [
        (
            format!("{site}/plain/"),
            StatusCode::UNPROCESSABLE_ENTITY,
            "no-feed",
        ),
        (
            format!("{site}/gone.xml"),
            StatusCode::BAD_GATEWAY,
            "not-found",
        ),
        (
            format!("{site}/huge.xml"),
            StatusCode::BAD_GATEWAY,
            "too-big",
        ),
        (
            "not an address".to_owned(),
            StatusCode::BAD_REQUEST,
            "not-an-address",
        ),
        (
            "http://127.0.0.1:1/".to_owned(),
            StatusCode::BAD_GATEWAY,
            "unreachable",
        ),
    ] {
        let (got, body) = reader.add(&address).await;
        assert_eq!(got, status, "{address}: {body}");
        assert_eq!(body["error"], reason, "{address}");
    }
    assert!(
        reader.get("/api/feeds").await["feeds"]
            .as_array()
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn a_feed_that_moved_for_good_is_remembered_at_its_new_address() {
    let (site, _) = publisher().await;
    let reader = Reader::new().await;

    let (status, _) = reader.add(&format!("{site}/moved.xml")).await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, body) = reader.add(&format!("{site}/comments.atom")).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
}

#[tokio::test]
async fn the_list_shows_fifty_at_a_time_and_has_an_end() {
    let (site, _) = publisher().await;
    let reader = Reader::new().await;
    reader.add(&format!("{site}/long.xml")).await;
    let (_, other) = reader.add(&format!("{site}/comments.atom")).await;

    let mut seen = Vec::new();
    let mut path = "/api/articles".to_owned();
    let mut pages = 0;
    loop {
        let page = reader.get(&path).await;
        pages += 1;
        let articles = page["articles"].as_array().unwrap();
        assert!(articles.len() <= 50);
        seen.extend(
            articles
                .iter()
                .map(|article| article["title"].as_str().unwrap().to_owned()),
        );
        match page["older"].as_str() {
            Some(older) => path = format!("/api/articles?before={older}"),
            None => break,
        }
    }
    assert_eq!(pages, 3);
    assert_eq!(seen.len(), 121);
    assert_eq!(seen[0], "Post 120");
    assert_eq!(seen.last().unwrap(), "Post 1");
    assert!(seen.contains(&"A comment".to_owned()));

    // One feed's own list holds only its articles.
    let id = other["feed"]["id"].as_i64().unwrap();
    assert_eq!(
        reader.titles(&format!("/api/articles?feed={id}")).await,
        ["A comment"]
    );
}

#[tokio::test]
async fn private_addresses_are_refused_on_the_live_app() {
    let (site, visitors) = publisher().await;
    let mut config = common::config();
    config.local_feeds_allowed = false;
    let base = common::start(config).await;
    let reader = Reader {
        cookie: common::signed_in(&base).await,
        base,
    };

    for address in [
        format!("{site}/feed.xml"),
        "http://localhost/".to_owned(),
        "http://[::1]/".to_owned(),
    ] {
        let (status, body) = reader.add(&address).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{address}");
        assert_eq!(body["error"], "not-allowed");
    }
    assert!(visitors.lock().unwrap().is_empty());
}

#[tokio::test]
async fn without_signing_in_feeds_stay_private() {
    let base = common::start(common::config()).await;
    for path in ["/api/feeds", "/api/articles"] {
        let response = reqwest::get(format!("{base}{path}")).await.unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "{path}");
    }
    let response = Client::new()
        .post(format!("{base}/api/feeds"))
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body(r#"{"address":"https://example.com/"}"#)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
