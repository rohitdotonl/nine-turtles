//! Looking on a writer's site for their address (SPEC section 37, decision
//! 0168): when Write back knows no address, nine turtles visits the writer's
//! home page and one contact page it links to, once, and never again for
//! that writer, whoever asks. Tested against a real running nine turtles and
//! a made-up publisher that counts its visitors.

mod common;

use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// The publisher's address, how many of Hal's and Ivy's pages were visited,
/// and how many asks for pages it doesn't have ("not found").
async fn publisher() -> (String, Arc<AtomicUsize>, Arc<AtomicUsize>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let visits = Arc::new(AtomicUsize::new(0));
    let rss = |name: &str, base: &str| {
        (
            [(header::CONTENT_TYPE, "application/rss+xml")],
            format!(
                r#"<?xml version="1.0"?><rss version="2.0"><channel><title>{name}'s notes</title>
                <link>{base}/{name}/</link><item><title>Tea</title><link>{base}/{name}/tea</link>
                <guid>{name}-1</guid></item></channel></rss>"#
            ),
        )
            .into_response()
    };
    let page = |body: &'static str| ([(header::CONTENT_TYPE, "text/html")], body).into_response();
    let (hal, ivy, count, again) = (base.clone(), base.clone(), visits.clone(), visits.clone());
    let more = visits.clone();
    let missing = Arc::new(AtomicUsize::new(0));
    let lost = missing.clone();
    let (gone, hal2) = (base.clone(), base.clone());
    let app = Router::new()
        .route("/gone.xml", get(move || async move { rss("gone", &gone) }))
        .route("/hal2.xml", get(move || async move { rss("hal2", &hal2) }))
        // Nothing listens at port 9 on this computer: a site that doesn't answer.
        .route(
            "/down.xml",
            get(move || async move { rss("down", "http://127.0.0.1:9") }),
        )
        .fallback(move || async move {
            lost.fetch_add(1, Ordering::SeqCst);
            StatusCode::NOT_FOUND
        })
        .route("/hal.xml", get(move || async move { rss("hal", &hal) }))
        .route("/ivy.xml", get(move || async move { rss("ivy", &ivy) }))
        .route(
            "/hal/",
            get(move || async move {
                count.fetch_add(1, Ordering::SeqCst);
                page(r#"<a href="/hal/tea">Tea</a> <a href="/hal/contact">Contact</a>"#)
            }),
        )
        .route(
            "/hal/contact",
            get(move || async move {
                again.fetch_add(1, Ordering::SeqCst);
                page(r#"<p>Write to me: <a href="mailto:hal@hal.example">hal@hal.example</a></p>"#)
            }),
        )
        .route(
            "/ivy/",
            get(move || async move {
                more.fetch_add(1, Ordering::SeqCst);
                page("<p>No address here.</p>")
            }),
        );
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (base, visits, missing)
}

async fn post(base: &str, cookie: &str, path: &str, body: Value) -> (StatusCode, Value) {
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

async fn follow(base: &str, cookie: &str, address: String) -> i64 {
    let (status, added) = post(base, cookie, "/api/feeds", json!({ "address": address })).await;
    assert_eq!(status, StatusCode::CREATED, "{added}");
    added["feed"]["id"].as_i64().unwrap()
}

#[tokio::test]
async fn the_writers_site_is_visited_once_and_its_address_kept_for_everyone() {
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (publisher, visits, missing) = publisher().await;
    let hal = follow(&base, &cookie, format!("{publisher}/hal.xml")).await;
    let look = format!("/api/feeds/{hal}/look-for-address");

    // The home page names no address, so its contact page is read: two pages.
    let (status, found) = post(&base, &cookie, &look, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{found}");
    assert_eq!(
        found,
        json!({ "address": "hal@hal.example", "looked": true })
    );
    assert_eq!(visits.load(Ordering::SeqCst), 2);

    // Never twice for the same writer, whoever asks.
    let (_, again) = post(&base, &cookie, &look, json!({})).await;
    assert_eq!(again["address"], "hal@hal.example");
    let (_, other) = common::another_reader(&state).await;
    let theirs = follow(&base, &other, format!("{publisher}/hal.xml")).await;
    assert_eq!(theirs, hal);
    let (_, also) = post(&base, &other, &look, json!({})).await;
    assert_eq!(also["address"], "hal@hal.example");
    assert_eq!(visits.load(Ordering::SeqCst), 2);

    // Finding it keeps nothing for the reader: they check it and press Write back.
    let listed = Client::new()
        .get(format!("{base}/api/feeds"))
        .header("cookie", &cookie)
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    let listed: Value = serde_json::from_str(&listed).unwrap();
    let place = listed["feeds"]
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["id"] == hal)
        .unwrap()
        .clone();
    assert_eq!(place["write_to"], Value::Null);

    // A site giving none is looked on once too, and says so.
    let ivy = follow(&base, &cookie, format!("{publisher}/ivy.xml")).await;
    let look = format!("/api/feeds/{ivy}/look-for-address");
    let (_, none) = post(&base, &cookie, &look, json!({})).await;
    assert_eq!(none["address"], Value::Null);
    let (_, still) = post(&base, &cookie, &look, json!({})).await;
    assert_eq!(still["address"], Value::Null);
    assert_eq!(visits.load(Ordering::SeqCst), 3);

    // Another place joined to Hal is answered from what his site gave, with no visit.
    let hal2 = follow(&base, &cookie, format!("{publisher}/hal2.xml")).await;
    let (status, joined) = post(
        &base,
        &cookie,
        "/api/writers/join",
        json!({ "feeds": [hal, hal2] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{joined}");
    let (_, theirs) = post(
        &base,
        &cookie,
        &format!("/api/feeds/{hal2}/look-for-address"),
        json!({}),
    )
    .await;
    assert_eq!(theirs["address"], "hal@hal.example");
    let before = missing.load(Ordering::SeqCst);

    // A site answering "not found" was looked on: asked once, never again.
    let gone = follow(&base, &cookie, format!("{publisher}/gone.xml")).await;
    let look = format!("/api/feeds/{gone}/look-for-address");
    for _ in 0..2 {
        let (_, answer) = post(&base, &cookie, &look, json!({})).await;
        assert_eq!(answer, json!({ "address": null, "looked": true }));
    }
    assert_eq!(missing.load(Ordering::SeqCst), before + 1);

    // A site that doesn't answer isn't counted: nine turtles says it didn't look, and may try again.
    let down = follow(&base, &cookie, format!("{publisher}/down.xml")).await;
    let look = format!("/api/feeds/{down}/look-for-address");
    for _ in 0..2 {
        let (_, answer) = post(&base, &cookie, &look, json!({})).await;
        assert_eq!(answer, json!({ "address": null, "looked": false }));
    }
    let looked: Option<i64> = sqlx::query_scalar("SELECT site_looked_at FROM feeds WHERE id = ?")
        .bind(down)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(looked, None);

    // Only for places the reader follows.
    let (status, _) = post(
        &base,
        &cookie,
        "/api/feeds/999999/look-for-address",
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}
