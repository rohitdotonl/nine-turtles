//! Pick up where you left off (SPEC section 7, decision 0175), tested against
//! a real running nine turtles and a made-up publisher.

mod common;

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, Method, StatusCode};
use serde_json::{Value, json};

/// A made-up blog with two posts, the first signed by its author.
async fn publisher() -> String {
    let app = Router::new().route("/feed.xml", get(|| async { feed() }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}/feed.xml")
}

fn feed() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/atom+xml")],
        r#"<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
        <title>Quiet Notes</title><id>quiet</id><updated>2026-01-02T00:00:00Z</updated>
        <entry><title>The long walk home</title><id>walk</id><updated>2026-01-02T00:00:00Z</updated>
            <author><name>Ana</name></author><content type="html">&lt;p&gt;One.&lt;/p&gt;</content></entry>
        <entry><title>Unsigned</title><id>unsigned</id><updated>2026-01-01T00:00:00Z</updated>
            <content type="html">&lt;p&gt;Two.&lt;/p&gt;</content></entry>
        </feed>"#,
    )
}

async fn call(
    method: Method,
    base: &str,
    cookie: &str,
    path: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut request = Client::new()
        .request(method, format!("{base}{path}"))
        .header("cookie", cookie)
        .header("sec-fetch-site", "same-origin");
    if let Some(body) = body {
        request = request
            .header("content-type", "application/json")
            .body(body.to_string());
    }
    let response = request.send().await.unwrap();
    let status = response.status();
    let text = response.text().await.unwrap();
    (status, serde_json::from_str(&text).unwrap_or(Value::Null))
}

async fn offer(base: &str, cookie: &str) -> Value {
    let (status, offer) = call(Method::GET, base, cookie, "/api/resume", None).await;
    assert_eq!(status, StatusCode::OK);
    offer
}

#[tokio::test]
async fn the_last_article_left_partway_is_offered_on_every_device_until_let_go() {
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (status, added) = call(
        Method::POST,
        &base,
        &cookie,
        "/api/feeds",
        Some(json!({ "address": publisher().await })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let feed = added["feed"]["id"].as_i64().unwrap();
    let (_, page) = call(
        Method::GET,
        &base,
        &cookie,
        &format!("/api/articles?feed={feed}"),
        None,
    )
    .await;
    let walk = page["articles"][0]["id"].as_i64().unwrap();
    let unsigned = page["articles"][1]["id"].as_i64().unwrap();

    // Nothing to offer yet.
    assert_eq!(offer(&base, &cookie).await, Value::Null);

    // Left part of the way through: offered, with its writer and the place.
    let keep =
        |id: i64, block: u32, within: f64| json!({ "id": id, "block": block, "within": within });
    let (status, _) = call(
        Method::PUT,
        &base,
        &cookie,
        "/api/resume",
        Some(keep(walk, 3, 0.5)),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let offered = offer(&base, &cookie).await;
    assert_eq!(offered["article"]["title"], "The long walk home");
    assert_eq!(offered["writer"], "Ana");
    // The writer is the offer's own; a person's article in it carries none of its own (the core path, point 4).
    assert!(offered["article"].get("writer").is_none(), "{offered}");
    assert_eq!(offered["block"], 3);
    assert_eq!(offered["within"], 0.5);

    // Only one is kept: the latest. An unsigned one has no writer.
    call(
        Method::PUT,
        &base,
        &cookie,
        "/api/resume",
        Some(keep(unsigned, 1, 0.0)),
    )
    .await;
    let offered = offer(&base, &cookie).await;
    assert_eq!(offered["article"]["title"], "Unsigned");
    assert_eq!(offered["writer"], Value::Null);

    // Letting go of another article (a device that's behind) changes nothing; of this one, it goes.
    call(
        Method::DELETE,
        &base,
        &cookie,
        &format!("/api/resume?id={walk}"),
        None,
    )
    .await;
    assert_eq!(offer(&base, &cookie).await["article"]["id"], unsigned);
    let (status, _) = call(
        Method::DELETE,
        &base,
        &cookie,
        &format!("/api/resume?id={unsigned}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(offer(&base, &cookie).await, Value::Null);

    // A place past the end of a block is refused, and another reader can't keep a place in an article that isn't theirs.
    let (status, _) = call(
        Method::PUT,
        &base,
        &cookie,
        "/api/resume",
        Some(keep(walk, 0, 2.0)),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    let (_, other) = common::another_reader(&state).await;
    let (status, _) = call(
        Method::PUT,
        &base,
        &other,
        "/api/resume",
        Some(keep(walk, 1, 0.5)),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(offer(&base, &other).await, Value::Null);

    // A hidden article isn't offered.
    call(
        Method::PUT,
        &base,
        &cookie,
        "/api/resume",
        Some(keep(walk, 3, 0.5)),
    )
    .await;
    sqlx::query("UPDATE entries SET muted = 1 WHERE article_id = ?")
        .bind(walk)
        .execute(&state.db)
        .await
        .unwrap();
    assert_eq!(offer(&base, &cookie).await, Value::Null);
    sqlx::query("UPDATE entries SET muted = 0 WHERE article_id = ?")
        .bind(walk)
        .execute(&state.db)
        .await
        .unwrap();
    assert_eq!(offer(&base, &cookie).await["article"]["id"], walk);

    // Once the feed is left, its article isn't offered any more.
    call(
        Method::PUT,
        &base,
        &cookie,
        "/api/resume",
        Some(keep(walk, 3, 0.5)),
    )
    .await;
    sqlx::query("UPDATE subscriptions SET unsubscribed_at = unixepoch() WHERE feed_id = ?")
        .bind(feed)
        .execute(&state.db)
        .await
        .unwrap();
    assert_eq!(offer(&base, &cookie).await, Value::Null);
}
