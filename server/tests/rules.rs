//! Rules and mutes (SPEC section 27), tested against a real running nine
//! turtles and a made-up blog whose posts the test writes as it goes.

mod common;

use std::sync::{Arc, Mutex};

use axum::{Router, http::header, response::IntoResponse, routing::get};
use nine_turtles::{AppState, checking, now};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// The made-up blog's posts: (id, title, author, text).
type Posts = Arc<Mutex<Vec<(String, String, String, String)>>>;

/// A blog at `/blog.xml` (and its twin at `/other.xml`) that lists `posts`.
async fn publisher(posts: Posts) -> String {
    let app = Router::new()
        .route(
            "/blog.xml",
            get({
                let posts = posts.clone();
                move || async move { feed("Blog", &posts) }
            }),
        )
        .route(
            "/other.xml",
            get(move || async move { feed("Other", &posts) }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}")
}

fn feed(title: &str, posts: &Posts) -> axum::response::Response {
    let items: String = posts
        .lock()
        .unwrap()
        .iter()
        .map(|(id, title, author, text)| {
            format!(
                "<item><title>{title}</title><guid>{id}</guid><dc:creator>{author}</dc:creator>\
                 <description>{text}</description></item>"
            )
        })
        .collect();
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(
            r#"<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
            <channel><title>{title}</title><link>https://blog.example/</link>{items}</channel></rss>"#
        ),
    )
        .into_response()
}

struct Reader {
    base: String,
    cookie: String,
    state: AppState,
    publisher: String,
    posts: Posts,
}

impl Reader {
    async fn new() -> Self {
        let (base, state) = common::start_with_state(common::config()).await;
        let cookie = common::signed_in(&base).await;
        let posts = Posts::default();
        Self {
            base,
            cookie,
            state,
            publisher: publisher(posts.clone()).await,
            posts,
        }
    }

    fn write(&self, id: &str, title: &str, author: &str, text: &str) {
        self.posts.lock().unwrap().push((
            id.to_owned(),
            title.to_owned(),
            author.to_owned(),
            text.to_owned(),
        ));
    }

    async fn follow(&self, file: &str) -> i64 {
        let (status, added) = self
            .post(
                "/api/feeds",
                json!({ "address": format!("{}/{file}", self.publisher) }),
            )
            .await;
        assert_eq!(status, StatusCode::CREATED, "{added}");
        added["feed"]["id"].as_i64().unwrap()
    }

    async fn check(&self, feed: i64) {
        checking::check(&self.state, feed, now()).await.unwrap();
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

    /// The titles a list shows, in order.
    async fn titles(&self, path: &str) -> Vec<String> {
        self.get(path).await["articles"]
            .as_array()
            .unwrap()
            .iter()
            .map(|article| article["title"].as_str().unwrap().to_owned())
            .collect()
    }

    async fn unread_count(&self, feed: i64) -> i64 {
        self.get("/api/feeds").await["feeds"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["id"] == feed)
            .unwrap()["unread"]
            .as_i64()
            .unwrap()
    }
}

#[tokio::test]
async fn a_mute_rule_keeps_new_matching_articles_out_of_every_list_but_search_and_muted() {
    let reader = Reader::new().await;
    reader.write("1", "A quiet post", "Jane Doe", "Words.");
    let blog = reader.follow("blog.xml").await;

    let (status, made) = reader
        .post(
            "/api/rules",
            json!({ "words": "Sponsored", "title_only": true, "action": "mute" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{made}");
    assert_eq!(made["matching"], 0);

    reader.write("2", "SPONSORED: a new laptop", "Ad Team", "Buy it.");
    reader.write("3", "Unsponsored thoughts", "Jane Doe", "Mine.");
    reader.check(blog).await;

    let everywhere = ["/api/articles?view=unread", "/api/articles?view=all"];
    for list in everywhere
        .into_iter()
        .map(String::from)
        .chain([format!("/api/articles?feed={blog}")])
    {
        let titles = reader.titles(&list).await;
        assert!(
            !titles.iter().any(|t| t.starts_with("SPONSORED")),
            "{list}: {titles:?}"
        );
        assert!(
            titles.contains(&"Unsponsored thoughts".to_owned()),
            "{list}"
        );
    }
    // Muted counts as read.
    assert_eq!(reader.unread_count(blog).await, 2);

    let muted = reader.get("/api/muted").await;
    assert_eq!(muted["count"], 1);
    assert_eq!(muted["articles"][0]["title"], "SPONSORED: a new laptop");
    assert_eq!(muted["articles"][0]["muted"], true);
    assert_eq!(reader.get("/api/rules").await["muted"], 1);

    // Search still finds it, saying it's muted.
    let found = reader.get("/api/search?q=laptop").await;
    assert_eq!(found["articles"][0]["title"], "SPONSORED: a new laptop");
    assert_eq!(found["articles"][0]["muted"], true);

    // Unmuting brings it back, unread.
    let id = muted["articles"][0]["id"].as_i64().unwrap();
    let (status, _) = reader
        .post(
            "/api/articles/muted",
            json!({ "ids": [id], "muted": false }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(
        reader
            .titles("/api/articles?view=unread")
            .await
            .contains(&"SPONSORED: a new laptop".to_owned())
    );
    assert_eq!(reader.unread_count(blog).await, 3);
    assert_eq!(reader.get("/api/muted").await["count"], 0);
}

#[tokio::test]
async fn star_and_read_rules_and_an_author_and_a_place() {
    let reader = Reader::new().await;
    let blog = reader.follow("blog.xml").await;
    let other = reader.follow("other.xml").await;
    let (_, folder) = reader
        .post(
            "/api/folders",
            json!({ "name": "Friends", "feeds": [blog] }),
        )
        .await;
    let folder = folder["folder"]["id"].as_i64().unwrap();

    reader
        .post(
            "/api/rules",
            json!({ "author": "jane doe", "folder_id": folder, "action": "star" }),
        )
        .await;
    reader
        .post(
            "/api/rules",
            json!({ "words": "giveaway", "feed_id": other, "action": "read" }),
        )
        .await;
    // A paused rule does nothing.
    let (_, paused) = reader
        .post("/api/rules", json!({ "words": "laptop", "action": "mute" }))
        .await;
    let paused = paused["id"].as_i64().unwrap();
    let (status, _) = reader
        .post(
            &format!("/api/rules/{paused}/paused"),
            json!({ "paused": true }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    reader.write(
        "1",
        "My garden",
        "Jane Doe",
        "A big giveaway inside, and a laptop.",
    );
    reader.check(blog).await;
    reader.check(other).await;

    // Starred only in the folder's feed; read only in the other feed.
    let starred = reader.titles("/api/articles?view=starred").await;
    assert_eq!(starred, ["My garden"]);
    let unread: Vec<Value> = reader.get("/api/articles?view=unread").await["articles"]
        .as_array()
        .unwrap()
        .clone();
    assert_eq!(unread.len(), 1);
    assert_eq!(unread[0]["feed_id"], blog);
    assert_eq!(
        reader.titles(&format!("/api/articles?feed={other}")).await,
        ["My garden"]
    );
    assert_eq!(reader.get("/api/muted").await["count"], 0);
}

#[tokio::test]
async fn a_new_rule_can_be_applied_to_what_already_matches_and_undone() {
    let reader = Reader::new().await;
    reader.write("1", "Crypto news", "A", "Words.");
    reader.write(
        "2",
        "Weekly notes",
        "A",
        "Mostly about crypto.",
    );
    reader.write("3", "Gardening", "A", "Soil.");
    let blog = reader.follow("blog.xml").await;

    let (_, made) = reader
        .post("/api/rules", json!({ "words": "crypto", "action": "mute" }))
        .await;
    // Rules act on what arrives; what's already here waits to be asked.
    assert_eq!(made["matching"], 2);
    assert_eq!(reader.unread_count(blog).await, 3);

    let id = made["id"].as_i64().unwrap();
    let (status, applied) = reader
        .post(&format!("/api/rules/{id}/apply"), json!({}))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(applied["action"], "mute");
    assert_eq!(applied["ids"].as_array().unwrap().len(), 2);
    assert_eq!(
        reader.titles("/api/articles?view=unread").await,
        ["Gardening"]
    );

    // Undo: the screen unmutes exactly those.
    reader
        .post(
            "/api/articles/muted",
            json!({ "ids": applied["ids"], "muted": false }),
        )
        .await;
    assert_eq!(reader.unread_count(blog).await, 3);
}

#[tokio::test]
async fn rules_are_checked_edited_and_deleted() {
    let reader = Reader::new().await;
    let blog = reader.follow("blog.xml").await;

    for refused in [
        json!({ "action": "mute" }),
        json!({ "words": "  !!  ", "action": "mute" }),
        json!({ "words": "x".repeat(201), "action": "mute" }),
        json!({ "words": "x", "feed_id": 999, "action": "mute" }),
    ] {
        let (status, _) = reader.post("/api/rules", refused.clone()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{refused}");
    }

    let (_, made) = reader
        .post(
            "/api/rules",
            json!({ "words": "  open   web ", "feed_id": blog, "action": "read" }),
        )
        .await;
    let id = made["id"].as_i64().unwrap();
    let listed = reader.get("/api/rules").await;
    assert_eq!(listed["rules"][0]["words"], "open web");
    assert_eq!(listed["rules"][0]["feed_id"], blog);

    let (status, _) = reader
        .post(
            &format!("/api/rules/{id}"),
            json!({ "words": "closed web", "action": "star" }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let listed = reader.get("/api/rules").await;
    assert_eq!(listed["rules"][0]["words"], "closed web");
    assert_eq!(listed["rules"][0]["feed_id"], Value::Null);
    assert_eq!(listed["rules"][0]["action"], "star");

    let (status, _) = reader
        .post(&format!("/api/rules/{id}/delete"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(reader.get("/api/rules").await["rules"], json!([]));
}

#[tokio::test]
async fn a_rule_whose_folder_goes_stays_and_matches_nothing() {
    let reader = Reader::new().await;
    let blog = reader.follow("blog.xml").await;
    let (_, folder) = reader
        .post("/api/folders", json!({ "name": "Tech", "feeds": [blog] }))
        .await;
    let folder = folder["folder"]["id"].as_i64().unwrap();
    reader
        .post(
            "/api/rules",
            json!({ "words": "laptop", "folder_id": folder, "action": "mute" }),
        )
        .await;
    reader
        .post(&format!("/api/folders/{folder}/delete"), json!({}))
        .await;

    let rule = &reader.get("/api/rules").await["rules"][0];
    assert_eq!(rule["place_gone"], true);
    assert_eq!(rule["folder_id"], Value::Null);

    reader.write("1", "A laptop", "A", "Words.");
    reader.check(blog).await;
    assert_eq!(reader.unread_count(blog).await, 1);
}

#[tokio::test]
async fn marking_a_muted_article_unread_unmutes_it() {
    let reader = Reader::new().await;
    reader
        .post("/api/rules", json!({ "words": "laptop", "action": "mute" }))
        .await;
    reader.write("1", "A laptop", "A", "Words.");
    let blog = reader.follow("blog.xml").await;
    // A rule acts on a new feed's first articles too.
    assert_eq!(reader.unread_count(blog).await, 0);
    let id = reader.get("/api/muted").await["articles"][0]["id"]
        .as_i64()
        .unwrap();

    reader
        .post("/api/articles/read", json!({ "ids": [id], "read": false }))
        .await;
    assert_eq!(reader.unread_count(blog).await, 1);
    assert_eq!(reader.get("/api/muted").await["count"], 0);
}
