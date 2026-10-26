//! Bringing stars over from another feed reader (SPEC section 23, decision
//! 0095), tested against a real running nine turtles and a made-up blog.

mod common;

use axum::{Router, http::header, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// A made-up blog at `/alpha.xml` with three posts; answers its feed's address.
async fn blog() -> String {
    let items: String = (1..=3)
        .rev()
        .map(|number| {
            format!(
                "<item><title>Alpha post {number}</title><guid>alpha-{number}</guid>\
                 <link>https://alpha.example/{number}</link>\
                 <pubDate>0{number} Jan 2026 12:00:00 GMT</pubDate></item>"
            )
        })
        .collect();
    let body = format!(
        r#"<?xml version="1.0"?><rss version="2.0"><channel><title>Alpha blog</title>
        <link>https://alpha.example/</link>{items}</channel></rss>"#
    );
    let app = Router::new().route(
        "/alpha.xml",
        get(move || async move { ([(header::CONTENT_TYPE, "application/rss+xml")], body) }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}/alpha.xml")
}

struct Reader {
    base: String,
    cookie: String,
}

impl Reader {
    async fn send(&self, path: &str, body: String) -> (StatusCode, Value) {
        let response = Client::new()
            .post(format!("{}{path}", self.base))
            .header("cookie", &self.cookie)
            .header("sec-fetch-site", "same-origin")
            .header("content-type", "application/json")
            .body(body)
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

    async fn titles(&self, query: &str) -> Vec<String> {
        self.get(&format!("/api/articles?{query}")).await["articles"]
            .as_array()
            .unwrap()
            .iter()
            .map(|article| article["title"].as_str().unwrap().to_owned())
            .collect()
    }

    async fn feeds(&self) -> Vec<String> {
        self.get("/api/feeds").await["feeds"]
            .as_array()
            .unwrap()
            .iter()
            .map(|feed| feed["title"].as_str().unwrap().to_owned())
            .collect()
    }

    async fn follow(&self, address: &str) {
        let (status, added) = self
            .send("/api/feeds", json!({ "address": address }).to_string())
            .await;
        assert_eq!(status, StatusCode::CREATED, "{added}");
    }
}

/// An Inoreader-style export: one star of a post the reader's feed already
/// has (Feedly's `originId` names it), one from a blog they don't follow,
/// one claiming to be from their blog but not stored, and one with no link.
fn export(alpha: &str) -> String {
    json!({
        "id": "user/1/state/com.google/starred",
        "items": [
            {
                "id": "tag:google.com,2005:reader/item/1",
                "originId": "alpha-2",
                "title": "Alpha post 2 as the other app saw it",
                "alternate": [{ "href": "https://alpha.example/2" }],
                "origin": { "streamId": format!("feed/{alpha}"), "title": "Alpha" }
            },
            {
                "id": "tag:google.com,2005:reader/item/2",
                "title": "Walking &amp; reading",
                "published": 1_700_000_000,
                "author": "Bea",
                "alternate": [{ "href": "https://beta.example/walking" }],
                "content": { "content": "<p>Slowly.<script>alert(1)</script></p>" },
                "origin": {
                    "streamId": "feed/https://beta.example/feed.xml",
                    "title": "Beta journal",
                    "htmlUrl": "https://beta.example/"
                }
            },
            {
                "id": "tag:google.com,2005:reader/item/3",
                "title": "An old Alpha post",
                "published": 1_600_000_000,
                "alternate": [{ "href": "https://alpha.example/old" }],
                "summary": { "content": "From long ago." },
                "origin": { "streamId": format!("feed/{alpha}"), "title": "Alpha" }
            },
            { "id": "tag:google.com,2005:reader/item/4", "title": "No link" }
        ]
    })
    .to_string()
}

#[tokio::test]
async fn stars_from_another_app_land_in_starred_with_their_originals() {
    let (base, state) = common::start_with_state(common::config()).await;
    let reader = Reader {
        cookie: common::signed_in(&base).await,
        base: base.clone(),
    };
    let alpha = blog().await;
    reader.follow(&alpha).await;

    let (status, answer) = reader.send("/api/starred/import", export(&alpha)).await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    assert_eq!(
        answer["summary"],
        json!({ "starred": 3, "already": 0, "unreadable": 1 })
    );

    // All three are in Starred, newest first; the post the feed already had
    // is starred as the publisher sent it.
    assert_eq!(
        reader.titles("view=starred").await,
        ["Alpha post 2", "Walking & reading", "An old Alpha post"]
    );
    // Brought over read, and no new feed shows in the sidebar.
    assert_eq!(reader.titles("view=unread").await.len(), 3);
    assert_eq!(reader.feeds().await, ["Alpha blog"]);

    // An imported article: cleaned, credited, and linked to its original.
    let starred = reader.get("/api/articles?view=starred").await;
    let walking = starred["articles"][1]["id"].as_i64().unwrap();
    let article = &reader.get(&format!("/api/articles/{walking}")).await["article"];
    assert_eq!(article["link"], "https://beta.example/walking");
    assert_eq!(article["feed_title"], "Beta journal");
    assert_eq!(article["site_url"], "https://beta.example/");
    assert_eq!(article["author"], "Bea");
    assert_eq!(article["content"], "<p>Slowly.</p>");
    assert_eq!(article["at"], 1_700_000_000);
    assert_eq!(article["starred"], true);
    assert_eq!(article["read"], true);

    // Search finds it.
    let found = reader.get("/api/search?q=walking").await;
    assert_eq!(found["articles"][0]["id"], walking, "{found}");

    // The same file again stars nothing new.
    let (_, again) = reader.send("/api/starred/import", export(&alpha)).await;
    assert_eq!(
        again["summary"],
        json!({ "starred": 0, "already": 3, "unreadable": 1 })
    );
    assert_eq!(reader.titles("view=starred").await.len(), 3);

    // Another reader of the same blog sees only what the publisher sent: one
    // reader's file never adds to another's lists.
    let (_, cookie) = common::another_reader(&state).await;
    let other = Reader { base, cookie };
    other.follow(&alpha).await;
    assert_eq!(
        other.titles("").await,
        ["Alpha post 3", "Alpha post 2", "Alpha post 1"]
    );
    assert!(other.titles("view=starred").await.is_empty());

    // Not a file of stars: said plainly.
    let (status, answer) = reader
        .send("/api/starred/import", "<opml/>".to_owned())
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(answer["error"], "not-stars");
}

#[tokio::test]
async fn nine_turtles_starred_export_comes_back_into_a_fresh_one() {
    let alpha = blog().await;
    let first = {
        let base = common::start(common::config()).await;
        Reader {
            cookie: common::signed_in(&base).await,
            base,
        }
    };
    first.follow(&alpha).await;
    let (_, answer) = first.send("/api/starred/import", export(&alpha)).await;
    assert_eq!(answer["summary"]["starred"], 3);
    let response = Client::new()
        .get(format!("{}/api/starred/export", first.base))
        .header("cookie", &first.cookie)
        .send()
        .await
        .unwrap();
    let exported = response.text().await.unwrap();

    let fresh = {
        let base = common::start(common::config()).await;
        Reader {
            cookie: common::signed_in(&base).await,
            base,
        }
    };
    let (status, answer) = fresh.send("/api/starred/import", exported).await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    assert_eq!(
        answer["summary"],
        json!({ "starred": 3, "already": 0, "unreadable": 0 })
    );
    assert_eq!(
        fresh.titles("view=starred").await,
        ["Alpha post 2", "Walking & reading", "An old Alpha post"]
    );
    // Following the blog afterwards works as ever, and Starred stays as it was.
    fresh.follow(&alpha).await;
    assert_eq!(fresh.feeds().await, ["Alpha blog"]);
    assert_eq!(fresh.titles("view=starred").await.len(), 3);
}
