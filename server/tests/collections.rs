//! What's left of collections (decision 0174): their export, tested against
//! a real running nine turtles and a made-up publisher. Collections are no
//! longer made or shown; the database keeps those a reader had, unused, so
//! Settings › Your data can still download them.

mod common;

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// A made-up blog whose feed has 5 posts, one a day up to yesterday, about soup.
async fn publisher() -> String {
    let app = Router::new().route("/feed.xml", get(|| async { feed() }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}/feed.xml")
}

fn feed() -> impl IntoResponse {
    let now = nine_turtles::now();
    let items: String = (1..=5)
        .map(|day| {
            format!(
                "<entry><title>Soup {day}</title><id>soup-{day}</id>\
                 <link href=\"https://kitchen.example/soup-{day}\"/>\
                 <content type=\"html\">A warm soup, number {day}.</content>\
                 <updated>{}</updated></entry>",
                nine_turtles::dates::rfc3339(now - day * 86_400)
            )
        })
        .collect();
    (
        [(header::CONTENT_TYPE, "application/atom+xml")],
        format!(
            r#"<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
            <title>Kitchen Notes</title><id>kitchen</id><updated>2026-01-01T00:00:00Z</updated>{items}</feed>"#
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

/// Follows the made-up blog; answers the feed's number and its articles' numbers, newest first.
async fn follow(base: &str, cookie: &str, address: &str) -> (i64, Vec<i64>) {
    let (status, added) = send(base, cookie, "/api/feeds", json!({ "address": address })).await;
    assert_eq!(status, StatusCode::CREATED);
    let feed = added["feed"]["id"].as_i64().unwrap();
    let (_, page) = ask(base, cookie, &format!("/api/articles?feed={feed}")).await;
    let ids = page["articles"]
        .as_array()
        .unwrap()
        .iter()
        .map(|article| article["id"].as_i64().unwrap())
        .collect();
    (feed, ids)
}

/// Gives reader `person` a collection named `name` holding `articles`, as
/// the database still keeps them.
async fn shelve(db: &sqlx::SqlitePool, person: i64, name: &str, articles: &[i64]) {
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO collections (person_id, name, created_at) VALUES (?, ?, 0) RETURNING id",
    )
    .bind(person)
    .bind(name)
    .fetch_one(db)
    .await
    .unwrap();
    for article in articles {
        sqlx::query(
            "INSERT INTO collection_articles (collection_id, person_id, article_id, added_at)
             VALUES (?, ?, ?, 0)",
        )
        .bind(id)
        .bind(person)
        .bind(article)
        .execute(db)
        .await
        .unwrap();
    }
}

#[tokio::test]
async fn the_export_still_lists_every_collected_article_with_its_collections() {
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let address = publisher().await;
    let (_, ids) = follow(&base, &cookie, &address).await;
    shelve(&state.db, 1, "Recipes", &[ids[0]]).await;
    shelve(&state.db, 1, "Cited", &[ids[1]]).await;
    shelve(&state.db, 1, "Someday", &[]).await;

    let (status, export) = ask(&base, &cookie, "/api/collections/export").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(export["version"], "https://jsonfeed.org/version/1.1");
    assert_eq!(
        export["_nine_turtles"]["collections"],
        json!(["Cited", "Recipes", "Someday"])
    );
    let items = export["items"].as_array().unwrap();
    assert_eq!(items.len(), 2);
    assert_eq!(items[0]["title"], "Soup 1");
    assert_eq!(items[0]["tags"], json!(["Recipes"]));
    assert_eq!(items[0]["url"], "https://kitchen.example/soup-1");
    assert_eq!(items[0]["_nine_turtles"]["feed_title"], "Kitchen Notes");
    assert_eq!(items[1]["tags"], json!(["Cited"]));

    // Another reader's export holds nothing of mine.
    let (_, other) = common::another_reader(&state).await;
    let (status, theirs) = ask(&base, &other, "/api/collections/export").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(theirs["items"], json!([]));
    assert_eq!(theirs["_nine_turtles"]["collections"], json!([]));
}

#[tokio::test]
async fn collections_saved_searches_and_recently_read_are_gone() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    for path in ["/api/collections", "/api/saved-searches"] {
        let (status, _) = ask(&base, &cookie, path).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
        let (status, _) = send(&base, &cookie, path, json!({ "name": "Soup" })).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
    }
    // Nothing notes what was opened any more (only another address answers it).
    let (status, _) = send(&base, &cookie, "/api/articles/opened", json!({ "id": 1 })).await;
    assert_eq!(status, StatusCode::METHOD_NOT_ALLOWED);
}
