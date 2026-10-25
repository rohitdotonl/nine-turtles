//! Tidying many feeds at once (SPEC section 15, "Your feeds"): when each
//! feed last posted, and moving or unsubscribing from several feeds in one
//! go, each with one Undo, tested against a real running nine turtles and a
//! made-up publisher.

mod common;

use axum::{
    Router,
    extract::Path,
    http::header,
    response::{IntoResponse, Response},
    routing::get,
};
use nine_turtles::AppState;
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// Made-up blogs at `/{name}-{year}.xml`, each with one post on 1 January
/// of that year. Answers the publisher's address.
async fn publisher() -> String {
    let app = Router::new().route(
        "/{file}",
        get(|Path(file): Path<String>| async move { feed(&file) }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}")
}

fn feed(file: &str) -> Response {
    let Some((name, year)) = file
        .strip_suffix(".xml")
        .and_then(|stem| stem.split_once('-'))
    else {
        return StatusCode::NOT_FOUND.into_response();
    };
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(
            r#"<?xml version="1.0"?><rss version="2.0"><channel><title>{name}</title>
            <link>https://{name}.example/</link><item><title>{name} post</title>
            <guid>{name}-1</guid><pubDate>01 Jan {year} 12:00:00 GMT</pubDate></item>
            </channel></rss>"#
        ),
    )
        .into_response()
}

struct Reader {
    base: String,
    cookie: String,
    state: AppState,
    publisher: String,
}

impl Reader {
    async fn new() -> Self {
        let (base, state) = common::start_with_state(common::config()).await;
        let cookie = common::signed_in(&base).await;
        Self {
            base,
            cookie,
            state,
            publisher: publisher().await,
        }
    }

    async fn follow(&self, file: &str) -> i64 {
        let (status, added) = self
            .post(
                "/api/feeds",
                json!({ "address": format!("{}/{file}.xml", self.publisher) }),
            )
            .await;
        assert_eq!(status, StatusCode::CREATED, "{added}");
        added["feed"]["id"].as_i64().unwrap()
    }

    async fn post(&self, path: &str, body: Value) -> (StatusCode, Value) {
        let response = Client::new()
            .post(format!("{}{path}", self.base))
            .header("cookie", &self.cookie)
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

    async fn get(&self, path: &str) -> Value {
        let response = Client::new()
            .get(format!("{}{path}", self.base))
            .header("cookie", &self.cookie)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{path}");
        serde_json::from_str(&response.text().await.unwrap()).unwrap()
    }

    /// Your feeds: (title, folder names), A to Z.
    async fn feeds(&self) -> Vec<(String, Vec<String>)> {
        let listed = self.get("/api/tidy/feeds").await;
        let folders = listed["folders"].as_array().unwrap().clone();
        let name = |id: &Value| {
            folders.iter().find(|folder| folder["id"] == *id).unwrap()["name"]
                .as_str()
                .unwrap()
                .to_owned()
        };
        listed["feeds"]
            .as_array()
            .unwrap()
            .iter()
            .map(|feed| {
                let mut inside: Vec<String> = feed["folders"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(name)
                    .collect();
                inside.sort();
                (feed["title"].as_str().unwrap().to_owned(), inside)
            })
            .collect()
    }
}

fn row(title: &str, folders: &[&str]) -> (String, Vec<String>) {
    (
        title.to_owned(),
        folders.iter().map(|name| (*name).to_owned()).collect(),
    )
}

#[tokio::test]
async fn each_feed_says_when_it_last_posted() {
    let reader = Reader::new().await;
    let quiet = reader.follow("quiet-2020").await;
    let busy = reader.follow("busy-2026").await;
    let listed = reader.get("/api/tidy/feeds").await;
    let last_posted = |id: i64| {
        listed["feeds"]
            .as_array()
            .unwrap()
            .iter()
            .find(|feed| feed["id"] == id)
            .unwrap()["last_posted"]
            .as_i64()
    };
    // 1 January 2020 and 2026, at noon.
    assert_eq!(last_posted(quiet), Some(1_577_880_000));
    assert_eq!(last_posted(busy), Some(1_767_268_800));
    assert!(listed["feeds"][0]["added_at"].as_i64().unwrap() > 1_767_268_800);
}

#[tokio::test]
async fn several_feeds_move_to_one_folder_and_undo_puts_them_back() {
    let reader = Reader::new().await;
    let alpha = reader.follow("alpha-2026").await;
    let beta = reader.follow("beta-2026").await;
    let gamma = reader.follow("gamma-2026").await;
    let (_, made) = reader
        .post(
            "/api/folders",
            json!({ "name": "News", "feeds": [alpha, gamma] }),
        )
        .await;
    let news = made["folder"]["id"].as_i64().unwrap();
    let (_, made) = reader
        .post("/api/folders", json!({ "name": "Tech", "feeds": [alpha] }))
        .await;
    let tech = made["folder"]["id"].as_i64().unwrap();

    // Alpha and Beta move to a new folder, leaving the ones they were in.
    let (status, moved) = reader
        .post(
            "/api/tidy/move",
            json!({ "feeds": [alpha, beta], "new_folder": " Later " }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{moved}");
    assert_eq!(moved["created"], true);
    assert_eq!(
        reader.feeds().await,
        [
            row("alpha", &["Later"]),
            row("beta", &["Later"]),
            row("gamma", &["News"])
        ]
    );

    // Undo: each goes back to exactly where it was.
    let (status, _) = reader
        .post(
            "/api/tidy/restore",
            json!({ "feeds": [
                { "id": alpha, "folders": [news, tech] },
                { "id": beta, "folders": [] },
            ] }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(
        reader.feeds().await,
        [
            row("alpha", &["News", "Tech"]),
            row("beta", &[]),
            row("gamma", &["News"])
        ]
    );

    // Moving to no folder takes them out of every one; an unknown folder is refused.
    let (status, _) = reader
        .post("/api/tidy/move", json!({ "feeds": [alpha, gamma] }))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        reader.feeds().await,
        [row("alpha", &[]), row("beta", &[]), row("gamma", &[])]
    );
    let (status, _) = reader
        .post("/api/tidy/move", json!({ "feeds": [alpha], "folder": 999 }))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = reader.post("/api/tidy/move", json!({ "feeds": [] })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn several_feeds_are_unsubscribed_at_once_and_one_undo_brings_them_all_back() {
    let reader = Reader::new().await;
    let alpha = reader.follow("alpha-2020").await;
    let beta = reader.follow("beta-2020").await;
    reader.follow("gamma-2026").await;
    reader
        .post(
            "/api/folders",
            json!({ "name": "Old", "feeds": [alpha, beta] }),
        )
        .await;
    // Read Alpha's post, to see its read history survive.
    let alpha_post: i64 = sqlx::query_scalar("SELECT id FROM articles WHERE feed_id = ?")
        .bind(alpha)
        .fetch_one(&reader.state.db)
        .await
        .unwrap();
    reader
        .post(
            "/api/articles/read",
            json!({ "ids": [alpha_post], "read": true }),
        )
        .await;

    let (status, answer) = reader
        .post("/api/tidy/unsubscribe", json!({ "feeds": [alpha, beta] }))
        .await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    assert_eq!(answer["unsubscribed"], 2);
    assert_eq!(reader.feeds().await, [row("gamma", &[])]);

    let (status, answer) = reader
        .post("/api/tidy/resubscribe", json!({ "feeds": [alpha, beta] }))
        .await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    assert_eq!(answer["resubscribed"], 2);
    assert_eq!(
        reader.feeds().await,
        [
            row("alpha", &["Old"]),
            row("beta", &["Old"]),
            row("gamma", &[])
        ]
    );
    let read: i64 = sqlx::query_scalar("SELECT read FROM articles WHERE id = ?")
        .bind(alpha_post)
        .fetch_one(&reader.state.db)
        .await
        .unwrap();
    assert_eq!(read, 1);

    // Once cleared for good, it's too late.
    reader
        .post("/api/tidy/unsubscribe", json!({ "feeds": [alpha, beta] }))
        .await;
    nine_turtles::folders::clear_unsubscribed(&reader.state.db, i64::MAX)
        .await
        .unwrap();
    let (status, answer) = reader
        .post("/api/tidy/resubscribe", json!({ "feeds": [alpha, beta] }))
        .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(answer["error"], "too-late");
}

#[tokio::test]
async fn starred_articles_outlive_unsubscribing_from_several_feeds() {
    let reader = Reader::new().await;
    let alpha = reader.follow("alpha-2020").await;
    let beta = reader.follow("beta-2020").await;
    let post: i64 = sqlx::query_scalar("SELECT id FROM articles WHERE feed_id = ?")
        .bind(alpha)
        .fetch_one(&reader.state.db)
        .await
        .unwrap();
    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [post], "starred": true }),
        )
        .await;
    reader
        .post("/api/tidy/unsubscribe", json!({ "feeds": [alpha, beta] }))
        .await;
    nine_turtles::folders::clear_unsubscribed(&reader.state.db, i64::MAX)
        .await
        .unwrap();
    let left: Vec<(i64, i64)> = sqlx::query_as("SELECT id, feed_id FROM articles ORDER BY id")
        .fetch_all(&reader.state.db)
        .await
        .unwrap();
    assert_eq!(left, [(post, alpha)]);
}

#[tokio::test]
async fn moving_to_a_folder_named_like_one_that_exists_uses_it() {
    let reader = Reader::new().await;
    let alpha = reader.follow("alpha-2026").await;
    let (_, made) = reader
        .post("/api/folders", json!({ "name": "News", "feeds": [] }))
        .await;
    let (_, moved) = reader
        .post(
            "/api/tidy/move",
            json!({ "feeds": [alpha], "new_folder": "news" }),
        )
        .await;
    // Not made just now, so Undo leaves it be.
    assert_eq!(moved["folder"], made["folder"]["id"]);
    assert_eq!(moved["created"], false);
    assert_eq!(reader.feeds().await, [row("alpha", &["News"])]);
}
