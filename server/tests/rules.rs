//! Hiding articles about… (SPEC section 27), tested against a real running nine
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
async fn a_rule_keeps_new_matching_articles_out_of_every_list_but_search_and_hidden() {
    let reader = Reader::new().await;
    reader.write("1", "A quiet post", "Jane Doe", "Words.");
    let blog = reader.follow("blog.xml").await;

    let (status, made) = reader
        .post("/api/rules", json!({ "words": "Sponsored" }))
        .await;
    assert_eq!(status, StatusCode::OK, "{made}");
    assert_eq!(made["ids"], json!([]));

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
    // Hidden counts as read.
    assert_eq!(reader.unread_count(blog).await, 2);

    let muted = reader.get("/api/muted").await;
    assert_eq!(muted["count"], 1);
    assert_eq!(muted["articles"][0]["title"], "SPONSORED: a new laptop");
    assert_eq!(muted["articles"][0]["muted"], true);
    assert_eq!(reader.get("/api/rules").await["muted"], 1);

    // Search still finds it, saying it's hidden.
    let found = reader.get("/api/search?q=laptop").await;
    assert_eq!(found["articles"][0]["title"], "SPONSORED: a new laptop");
    assert_eq!(found["articles"][0]["muted"], true);

    // Unhiding brings it back, unread.
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
async fn a_rule_from_one_person_covers_all_their_places_and_nobody_else() {
    let reader = Reader::new().await;
    reader.write("1", "My garden", "Jane Doe", "A giveaway inside.");
    let blog = reader.follow("blog.xml").await;
    let other = reader.follow("other.xml").await;
    let pond = {
        // A third place, its own person, with the same posts.
        let posts = reader.posts.clone();
        let app = Router::new().route(
            "/pond.xml",
            get(move || async move { feed("Pond", &posts) }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        let (status, added) = reader
            .post(
                "/api/feeds",
                json!({ "address": format!("http://{address}/pond.xml") }),
            )
            .await;
        assert_eq!(status, StatusCode::CREATED, "{added}");
        added["feed"]["id"].as_i64().unwrap()
    };
    // Blog and Other are one person.
    let (status, joined) = reader
        .post(
            "/api/writers/join",
            json!({ "feeds": [blog, other], "name": "Alpha" }),
        )
        .await;
    assert!(status.is_success(), "{joined}");

    // From Alpha, by their Other: it covers Blog too, not Pond.
    let (status, made) = reader
        .post("/api/rules", json!({ "words": "garden", "feed_id": other }))
        .await;
    assert_eq!(status, StatusCode::OK, "{made}");
    assert_eq!(made["ids"].as_array().unwrap().len(), 2);
    assert_eq!(reader.unread_count(blog).await, 0);
    assert_eq!(reader.unread_count(other).await, 0);
    assert_eq!(reader.unread_count(pond).await, 1);

    // New ones too, in every one of their places.
    reader.write("2", "Garden, again", "Jane Doe", "Words.");
    reader.check(blog).await;
    reader.check(other).await;
    reader.check(pond).await;
    assert_eq!(reader.unread_count(blog).await, 0);
    assert_eq!(reader.unread_count(pond).await, 2);
    assert_eq!(reader.get("/api/muted").await["count"], 4);
}

#[tokio::test]
async fn a_paused_rule_does_nothing_and_old_kinds_of_rule_are_kept_but_never_shown_or_run() {
    let reader = Reader::new().await;
    let blog = reader.follow("blog.xml").await;
    // Paused before the switch went (decision 0201): listed, never run.
    let (_, paused) = reader
        .post("/api/rules", json!({ "words": "laptop", "paused": true }))
        .await;
    assert!(paused["id"].is_i64(), "{paused}");
    // Rules from before (an author, a star, a folder), as the structure
    // change leaves them.
    sqlx::query(
        "INSERT INTO rules (id, person_id, words, author, feed_id, folder_id, action, created_at)
         VALUES (90, 1, '', 'Jane Doe', NULL, NULL, 'mute', 1),
                (91, 1, 'garden', '', NULL, NULL, 'star', 1),
                (92, 1, 'giveaway', '', ?, NULL, 'read', 1)",
    )
    .bind(blog)
    .execute(&reader.state.db)
    .await
    .unwrap();
    let listed = reader.get("/api/rules").await;
    assert_eq!(listed["rules"].as_array().unwrap().len(), 1);
    assert_eq!(listed["rules"][0]["paused"], true);

    reader.write(
        "1",
        "My garden",
        "Jane Doe",
        "A big giveaway inside, and a laptop.",
    );
    reader.check(blog).await;
    assert_eq!(reader.unread_count(blog).await, 1);
    assert_eq!(reader.titles("/api/articles?view=starred").await.len(), 0);
    assert_eq!(reader.get("/api/muted").await["count"], 0);
    // Still there, as they were.
    let kept: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rules WHERE id >= 90")
        .fetch_one(&reader.state.db)
        .await
        .unwrap();
    assert_eq!(kept, 3);
}

#[tokio::test]
async fn a_new_rule_hides_what_already_matches_at_once_and_can_be_undone() {
    let reader = Reader::new().await;
    reader.write("1", "Crypto news", "A", "Words.");
    reader.write("2", "Weekly notes", "A", "Mostly about crypto.");
    reader.write("3", "Gardening", "A", "Soil.");
    let blog = reader.follow("blog.xml").await;

    let (_, made) = reader
        .post("/api/rules", json!({ "words": "crypto" }))
        .await;
    // What's already here and unread is hidden at once (decision 0201).
    let applied = made;
    assert_eq!(applied["ids"].as_array().unwrap().len(), 2);
    assert_eq!(
        reader.titles("/api/articles?view=unread").await,
        ["Gardening"]
    );

    // Undo: the screen unhides exactly those.
    reader
        .post(
            "/api/articles/muted",
            json!({ "ids": applied["ids"], "muted": false }),
        )
        .await;
    assert_eq!(reader.unread_count(blog).await, 3);
}

#[tokio::test]
async fn rules_are_checked_and_deleted() {
    let reader = Reader::new().await;
    let blog = reader.follow("blog.xml").await;

    for refused in [
        json!({ "words": "" }),
        json!({ "words": "  !!  " }),
        json!({ "words": "x".repeat(201) }),
        json!({ "words": "x", "feed_id": 999 }),
        json!({ "words": "x", "days": 3 }),
    ] {
        let (status, _) = reader.post("/api/rules", refused.clone()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{refused}");
    }

    let (_, made) = reader
        .post(
            "/api/rules",
            json!({ "words": "  open   web ", "feed_id": blog }),
        )
        .await;
    let id = made["id"].as_i64().unwrap();
    let listed = reader.get("/api/rules").await;
    assert_eq!(listed["rules"][0]["words"], "open web");
    assert_eq!(listed["rules"][0]["feed_id"], blog);

    assert_eq!(listed["rules"][0]["until"], Value::Null);

    let (status, _) = reader
        .post(&format!("/api/rules/{id}/delete"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(reader.get("/api/rules").await["rules"], json!([]));
}

#[tokio::test]
async fn deleting_a_folder_leaves_rules_alone() {
    let reader = Reader::new().await;
    let blog = reader.follow("blog.xml").await;
    let (_, folder) = reader
        .post("/api/folders", json!({ "name": "Tech", "feeds": [blog] }))
        .await;
    let folder = folder["folder"]["id"].as_i64().unwrap();
    reader
        .post("/api/rules", json!({ "words": "laptop", "feed_id": blog }))
        .await;
    reader
        .post(&format!("/api/folders/{folder}/delete"), json!({}))
        .await;

    let rule = &reader.get("/api/rules").await["rules"][0];
    assert_eq!(rule["place_gone"], false);
    reader.write("1", "A laptop", "A", "Words.");
    reader.check(blog).await;
    assert_eq!(reader.unread_count(blog).await, 0);
}

#[tokio::test]
async fn marking_a_hidden_article_unread_unhides_it() {
    let reader = Reader::new().await;
    reader
        .post("/api/rules", json!({ "words": "laptop" }))
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

#[tokio::test]
async fn leaving_one_of_someones_places_keeps_their_rule_on_the_others() {
    let reader = Reader::new().await;
    let blog = reader.follow("blog.xml").await;
    let other = reader.follow("other.xml").await;
    reader
        .post(
            "/api/writers/join",
            json!({ "feeds": [blog, other], "name": "Alpha" }),
        )
        .await;
    reader
        .post("/api/rules", json!({ "words": "garden", "feed_id": blog }))
        .await;
    let (status, _) = reader
        .post(&format!("/api/feeds/{blog}/unsubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    nine_turtles::folders::clear_unsubscribed(&reader.state.db, None, i64::MAX)
        .await
        .unwrap();

    // Still for Alpha, by the place left; once nobody's left, it says so.
    let rule = &reader.get("/api/rules").await["rules"][0];
    assert_eq!(rule["feed_id"], other);
    assert_eq!(rule["place_gone"], false);
    reader
        .post(&format!("/api/feeds/{other}/unsubscribe"), json!({}))
        .await;
    nine_turtles::folders::clear_unsubscribed(&reader.state.db, None, i64::MAX)
        .await
        .unwrap();
    let rule = &reader.get("/api/rules").await["rules"][0];
    assert_eq!(rule["feed_id"], Value::Null);
    assert_eq!(rule["place_gone"], true);
}

#[tokio::test]
async fn a_word_hidden_for_a_while_stops_and_leaves_the_list_when_its_time_is_up() {
    let reader = Reader::new().await;
    let blog = reader.follow("blog.xml").await;
    let (status, made) = reader
        .post("/api/rules", json!({ "words": "election", "days": 7 }))
        .await;
    assert_eq!(status, StatusCode::OK, "{made}");
    let id = made["id"].as_i64().unwrap();
    let until = reader.get("/api/rules").await["rules"][0]["until"]
        .as_i64()
        .unwrap();
    let week = until - nine_turtles::now();
    assert!((7 * 86_400 - 60..=7 * 86_400).contains(&week), "{week}");

    // While it lasts, it hides.
    reader.write("1", "Election night", "Jane Doe", "Words.");
    reader.check(blog).await;
    assert_eq!(reader.unread_count(blog).await, 0);

    // Once its week is over it hides nothing new and isn't listed; what it
    // hid stays hidden.
    sqlx::query("UPDATE rules SET until = 1 WHERE id = ?")
        .bind(id)
        .execute(&reader.state.db)
        .await
        .unwrap();
    assert_eq!(reader.get("/api/rules").await["rules"], json!([]));
    reader.write("2", "Election, after", "Jane Doe", "Words.");
    reader.check(blog).await;
    assert_eq!(reader.unread_count(blog).await, 1);
    assert_eq!(reader.get("/api/muted").await["count"], 1);
}

#[tokio::test]
async fn undo_brings_a_removed_word_back_as_it_was_hiding_nothing_more() {
    let reader = Reader::new().await;
    reader.write("1", "Crypto news", "A", "Words.");
    let blog = reader.follow("blog.xml").await;
    // A paused word made again, and any word Undo restores, hide nothing
    // already here (decision 0201).
    for word in [
        json!({ "words": "crypto", "paused": true }),
        json!({ "words": "crypto", "restore": true }),
    ] {
        let (status, made) = reader.post("/api/rules", word).await;
        assert_eq!(status, StatusCode::OK, "{made}");
        assert_eq!(made["ids"], json!([]));
        assert_eq!(reader.unread_count(blog).await, 1);
    }
    // A word whose time is already up isn't made.
    let (status, refused) = reader
        .post("/api/rules", json!({ "words": "crypto", "until": 1 }))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(refused["error"], "gone");
    let kept: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rules WHERE until = 1")
        .fetch_one(&reader.state.db)
        .await
        .unwrap();
    assert_eq!(kept, 0);
}
