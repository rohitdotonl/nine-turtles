//! Ask them for a feed (SPEC section 3, decision 0212): for a site with no
//! feed, nine turtles looks on its home page, and only if that shows no
//! address, the one contact page it links to; never the page pasted (an
//! article, say), not again within half an hour, and only a few times in
//! half an hour for one reader. Tested against a real
//! running nine turtles and a made-up site that counts its visitors.

mod common;

use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// A site with no feed: its address, and how many times its home page, its
/// contact page and an article it links to were visited.
async fn site() -> (String, [Arc<AtomicUsize>; 3]) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let counts = [(); 3].map(|()| Arc::new(AtomicUsize::new(0)));
    let [home, contact, article] = counts.clone();
    let page = |body: &'static str| ([(header::CONTENT_TYPE, "text/html")], body).into_response();
    let app = Router::new()
        .route(
            "/",
            get(move || async move {
                home.fetch_add(1, Ordering::SeqCst);
                page(r#"<a href="/notes/tea">Tea</a> <a href="/contact">Contact</a>"#)
            }),
        )
        .route(
            "/contact",
            get(move || async move {
                contact.fetch_add(1, Ordering::SeqCst);
                page(r#"<p>Write to me: <a href="mailto:june@june.example">june@june.example</a></p>"#)
            }),
        )
        .route(
            "/notes/tea",
            get(move || async move {
                article.fetch_add(1, Ordering::SeqCst);
                page("<p>Tea.</p>")
            }),
        );
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (base, counts)
}

async fn ask(base: &str, cookie: Option<&str>, site: &str) -> (StatusCode, Value) {
    let mut request = Client::new()
        .post(format!("{base}/api/sites/look-for-address"))
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body(json!({ "site": site }).to_string());
    if let Some(cookie) = cookie {
        request = request.header("cookie", cookie);
    }
    let response = request.send().await.unwrap();
    let status = response.status();
    let text = response.text().await.unwrap();
    (status, serde_json::from_str(&text).unwrap_or(Value::Null))
}

#[tokio::test]
async fn a_site_with_no_feed_gives_its_address_from_its_home_and_contact_pages_once() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (site, [home, contact, article]) = site().await;

    // Asked about an article's page: its site's home page, then its contact page, never the article.
    let (status, found) = ask(&base, Some(&cookie), &format!("{site}/notes/tea")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        found,
        json!({ "address": "june@june.example", "looked": true })
    );
    assert_eq!(home.load(Ordering::SeqCst), 1);
    assert_eq!(contact.load(Ordering::SeqCst), 1);
    assert_eq!(article.load(Ordering::SeqCst), 0);

    // Asked again: the same answer, and the site isn't visited again.
    let (_, again) = ask(&base, Some(&cookie), &format!("{site}/notes/tea")).await;
    assert_eq!(again, found);
    assert_eq!(home.load(Ordering::SeqCst), 1);
    assert_eq!(contact.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn only_a_signed_in_reader_can_ask_and_nonsense_is_not_looked_at() {
    let base = common::start(common::config()).await;
    let (status, _) = ask(&base, None, "example.com").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let cookie = common::signed_in(&base).await;
    let (status, answer) = ask(&base, Some(&cookie), "not an address").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(answer, json!({ "address": null, "looked": false }));
}

#[tokio::test]
async fn one_reader_asks_only_a_few_times_in_half_an_hour() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (site, [home, ..]) = site().await;
    for _ in 0..6 {
        ask(&base, Some(&cookie), "not an address").await;
    }
    let (status, answer) = ask(&base, Some(&cookie), &site).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(answer, json!({ "address": null, "looked": false }));
    assert_eq!(home.load(Ordering::SeqCst), 0);
}
