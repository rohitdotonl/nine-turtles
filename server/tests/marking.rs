//! Read, unread, star and the sort order (SPEC sections 8, 9 and 18), tested
//! against a real running nine turtles and a made-up publisher.

mod common;

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// A made-up blog whose feed has 120 posts, a day apart.
async fn publisher() -> String {
    let app = Router::new().route("/feed.xml", get(|| async { feed(120) }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}/feed.xml")
}

fn feed(count: i64) -> impl IntoResponse {
    let mut items = String::new();
    for number in (1..=count).rev() {
        // Day `number` after 1 January 2026, at noon.
        let at = 1_767_268_800 + number * 86_400;
        items.push_str(&format!(
            "<item><title>Post {number}</title><guid>post-{number}</guid>\
             <pubDate>{}</pubDate></item>",
            rfc2822(at)
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

/// A time as RSS writes it. Only 2026 is needed.
fn rfc2822(at: i64) -> String {
    let months = [
        ("Jan", 31),
        ("Feb", 28),
        ("Mar", 31),
        ("Apr", 30),
        ("May", 31),
        ("Jun", 30),
    ];
    let mut day = (at - 1_767_225_600) / 86_400;
    for (name, length) in months {
        if day < length {
            return format!("{:02} {name} 2026 12:00:00 GMT", day + 1);
        }
        day -= length;
    }
    unreachable!("only the first half of 2026 is needed")
}

struct Reader {
    base: String,
    cookie: String,
    feed: i64,
}

impl Reader {
    /// A signed-in reader following the made-up blog.
    async fn new() -> Self {
        let base = common::start(common::config()).await;
        let cookie = common::signed_in(&base).await;
        let mut reader = Self {
            base,
            cookie,
            feed: 0,
        };
        let (status, added) = reader
            .post("/api/feeds", json!({ "address": publisher().await }))
            .await;
        assert_eq!(status, StatusCode::CREATED);
        assert_eq!(added["feed"]["unread"], 120);
        reader.feed = added["feed"]["id"].as_i64().unwrap();
        reader
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

    /// Every article in a list, page after page, as (title, id).
    async fn list(&self, query: &str) -> Vec<(String, i64)> {
        let mut seen = Vec::new();
        let mut path = format!("/api/articles?{query}");
        loop {
            let page = self.get(&path).await;
            for article in page["articles"].as_array().unwrap() {
                seen.push((
                    article["title"].as_str().unwrap().to_owned(),
                    article["id"].as_i64().unwrap(),
                ));
            }
            match page["next"].as_str() {
                Some(next) => path = format!("/api/articles?{query}&after={next}"),
                None => return seen,
            }
        }
    }

    async fn unread_count(&self) -> i64 {
        self.get("/api/feeds").await["feeds"][0]["unread"]
            .as_i64()
            .unwrap()
    }
}

fn ids(list: &[(String, i64)]) -> Vec<i64> {
    list.iter().map(|(_, id)| *id).collect()
}

#[tokio::test]
async fn marking_read_and_unread_changes_the_unread_view_and_the_count() {
    let reader = Reader::new().await;
    let all = reader.list("view=all").await;
    assert_eq!(all.len(), 120);
    assert_eq!(reader.list("view=unread").await.len(), 120);

    // Shown in the reading area: read.
    let (newest, newest_id) = all[0].clone();
    assert_eq!(newest, "Post 120");
    let (status, answer) = reader
        .post(
            "/api/articles/read",
            json!({ "ids": [newest_id], "read": true }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(answer["marked"], 1);
    assert_eq!(reader.unread_count().await, 119);
    let article = reader.get(&format!("/api/articles/{newest_id}")).await;
    assert_eq!(article["article"]["read"], true);
    let unread = reader.list("view=unread").await;
    assert_eq!(unread[0].0, "Post 119");
    // A feed's own list still shows it, marked read.
    let feed = reader
        .get(&format!("/api/articles?feed={}", reader.feed))
        .await;
    assert_eq!(feed["articles"][0]["read"], true);
    assert_eq!(feed["articles"][1]["read"], false);

    // `m`: unread again.
    reader
        .post(
            "/api/articles/read",
            json!({ "ids": [newest_id], "read": false }),
        )
        .await;
    assert_eq!(reader.unread_count().await, 120);
    assert_eq!(reader.list("view=unread").await[0].0, "Post 120");
}

#[tokio::test]
async fn mark_all_as_read_touches_only_the_articles_named_and_undo_brings_them_back() {
    let reader = Reader::new().await;
    // The first page on screen: 50 articles. The other 70 aren't shown, as
    // if they had arrived in the background.
    let page = reader.get("/api/articles?view=unread").await;
    let shown: Vec<i64> = page["articles"]
        .as_array()
        .unwrap()
        .iter()
        .map(|article| article["id"].as_i64().unwrap())
        .collect();
    assert_eq!(shown.len(), 50);

    reader
        .post("/api/articles/read", json!({ "ids": shown, "read": true }))
        .await;
    assert_eq!(reader.unread_count().await, 70);
    let unread = reader.list("view=unread").await;
    assert_eq!(unread.len(), 70);
    assert!(ids(&unread).iter().all(|id| !shown.contains(id)));

    // Undo: the same articles, unread again.
    reader
        .post("/api/articles/read", json!({ "ids": shown, "read": false }))
        .await;
    assert_eq!(reader.unread_count().await, 120);
}

#[tokio::test]
async fn starred_articles_appear_in_starred_and_leave_when_unstarred() {
    let reader = Reader::new().await;
    assert!(reader.list("view=starred").await.is_empty());
    let all = reader.list("view=all").await;
    let (title, id) = all[5].clone();

    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [id], "starred": true }),
        )
        .await;
    assert_eq!(reader.list("view=starred").await, [(title, id)]);
    let article = reader.get(&format!("/api/articles/{id}")).await;
    assert_eq!(article["article"]["starred"], true);
    // Starring doesn't change whether it's read.
    assert_eq!(article["article"]["read"], false);

    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [id], "starred": false }),
        )
        .await;
    assert!(reader.list("view=starred").await.is_empty());
}

#[tokio::test]
async fn the_starred_export_is_a_json_feed_of_every_starred_article() {
    let reader = Reader::new().await;
    let empty = reader.get("/api/starred/export").await;
    assert_eq!(empty["version"], "https://jsonfeed.org/version/1.1");
    assert_eq!(empty["items"], json!([]));

    let all = reader.list("view=all").await;
    let ids = [all[3].1, all[60].1, all[110].1];
    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": ids, "starred": true }),
        )
        .await;

    let response = Client::new()
        .get(format!("{}/api/starred/export", reader.base))
        .header("cookie", &reader.cookie)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers()["content-type"],
        "application/feed+json; charset=utf-8"
    );
    assert!(
        response.headers()["content-disposition"]
            .to_str()
            .unwrap()
            .starts_with("attachment")
    );
    let file: Value = serde_json::from_str(&response.text().await.unwrap()).unwrap();
    let titles: Vec<&str> = file["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item["title"].as_str().unwrap())
        .collect();
    // Every starred article, newest first, and no others.
    assert_eq!(titles, ["Post 117", "Post 60", "Post 10"]);
    let item = &file["items"][0];
    assert_eq!(item["date_published"], "2026-04-28T12:00:00Z");
    assert!(item["id"].as_str().unwrap().contains("#id:post-117"));
    assert_eq!(item["_slowfeed"]["feed_title"], "Quiet Notes");
    assert_eq!(item["_slowfeed"]["home_page_url"], "https://quiet.example/");

    // Not signed in: nothing.
    let response = Client::new()
        .get(format!("{}/api/starred/export", reader.base))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn oldest_first_lists_the_same_articles_the_other_way_round() {
    let reader = Reader::new().await;
    let newest = reader.list("view=all").await;
    let mut oldest = reader.list("view=all&order=oldest").await;
    assert_eq!(oldest[0].0, "Post 1");
    oldest.reverse();
    assert_eq!(oldest, newest);

    let feed = reader
        .list(&format!("feed={}&order=oldest", reader.feed))
        .await;
    assert_eq!(feed.len(), 120);
    assert_eq!(feed[0].0, "Post 1");
}

#[tokio::test]
async fn the_sort_order_is_saved_for_every_device() {
    let reader = Reader::new().await;
    assert_eq!(
        reader.get("/api/settings").await,
        json!({ "sort": "newest" })
    );

    let (status, _) = reader
        .post("/api/settings", json!({ "sort": "oldest" }))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        reader.get("/api/settings").await,
        json!({ "sort": "oldest" })
    );

    // Another device, signed in separately, sees the same.
    let other = Client::new()
        .get(format!("{}/api/settings", reader.base))
        .header("cookie", common::signed_in(&reader.base).await)
        .send()
        .await
        .unwrap();
    let other: Value = serde_json::from_str(&other.text().await.unwrap()).unwrap();
    assert_eq!(other, json!({ "sort": "oldest" }));

    let (status, _) = reader
        .post("/api/settings", json!({ "sort": "sideways" }))
        .await;
    assert!(status.is_client_error());
    assert_eq!(
        reader.get("/api/settings").await,
        json!({ "sort": "oldest" })
    );
}

#[tokio::test]
async fn marks_need_sign_in_come_only_from_slowfeed_and_have_a_limit() {
    let reader = Reader::new().await;
    let id = reader.list("view=all").await[0].1;
    let mark = json!({ "ids": [id], "read": true }).to_string();

    // Not signed in.
    let response = Client::new()
        .post(format!("{}/api/articles/read", reader.base))
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body(mark.clone())
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    // Signed in, but sent by another website.
    let response = Client::new()
        .post(format!("{}/api/articles/read", reader.base))
        .header("cookie", &reader.cookie)
        .header("sec-fetch-site", "cross-site")
        .header("content-type", "application/json")
        .body(mark)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    assert_eq!(reader.unread_count().await, 120);

    // More articles than any screen shows: refused, nothing changed.
    let too_many: Vec<i64> = (1..=10_001).collect();
    let (status, _) = reader
        .post(
            "/api/articles/read",
            json!({ "ids": too_many, "read": true }),
        )
        .await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(reader.unread_count().await, 120);
}
