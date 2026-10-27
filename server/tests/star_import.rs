//! Bringing stars over from another feed reader (SPEC section 23, decision
//! 0098), tested against a real running nine turtles and a made-up blog.

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
    // Brought over read (Unread holds only the blog's own three posts), and
    // no new feed shows in the sidebar.
    assert_eq!(
        reader.titles("view=unread").await,
        ["Alpha post 3", "Alpha post 2", "Alpha post 1"]
    );
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
async fn a_star_finds_its_article_by_the_link_without_tracking_tags() {
    let (base, state) = common::start_with_state(common::config()).await;
    let reader = Reader {
        cookie: common::signed_in(&base).await,
        base,
    };
    let alpha = blog().await;
    reader.follow(&alpha).await;
    // As if stored before tracking tags and trackers were taken out on
    // arrival (decision 0112).
    sqlx::query(
        "UPDATE articles SET link = link || '?utm_source=rss',
             content = '<p><a href=\"https://x.example/?utm_source=a&amp;id=2\">x</a>\
<img src=\"https://ad.doubleclick.net/p.gif\"><img src=\"https://alpha.example/a.png\"></p>'
         WHERE link = 'https://alpha.example/1'",
    )
    .execute(&state.db)
    .await
    .unwrap();

    // Another app's star of the same post, under its own ID and with its
    // own tracking tag: only the link says it's the same.
    let file = json!({
        "items": [{
            "title": "Alpha 1 as another app saw it",
            "alternate": [{ "href": "https://alpha.example/1?fbclid=abc" }],
            "origin": { "streamId": format!("feed/{alpha}"), "title": "Alpha" }
        }]
    });
    let (status, answer) = reader.send("/api/starred/import", file.to_string()).await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    assert_eq!(
        answer["summary"],
        json!({ "starred": 1, "already": 0, "unreadable": 0 })
    );
    assert_eq!(reader.titles("view=starred").await, ["Alpha post 1"]);

    // Shown, the older article loses its tags and trackers too.
    let starred = reader.get("/api/articles?view=starred").await;
    assert_eq!(starred["articles"][0]["link"], "https://alpha.example/1");
    let id = starred["articles"][0]["id"].as_i64().unwrap();
    let article = &reader.get(&format!("/api/articles/{id}")).await["article"];
    assert_eq!(article["link"], "https://alpha.example/1");
    let content = article["content"].as_str().unwrap();
    assert!(
        content.contains(r#"href="https://x.example/?id=2""#),
        "{content}"
    );
    assert!(!content.contains("doubleclick"), "{content}");
    assert!(content.contains(r#"loading="lazy""#), "{content}");
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
    // Each star keeps the real address and name of the feed it came from.
    let file: Value = serde_json::from_str(&exported).unwrap();
    let sources: Vec<(String, String)> = file["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| {
            let source = &item["_nine_turtles"];
            (
                source["feed_title"].as_str().unwrap().to_owned(),
                source["feed_url"].as_str().unwrap().to_owned(),
            )
        })
        .collect();
    assert_eq!(
        sources,
        [
            ("Alpha blog".to_owned(), alpha.clone()),
            (
                "Beta journal".to_owned(),
                "https://beta.example/feed.xml".to_owned()
            ),
            ("Alpha".to_owned(), alpha.clone()),
        ]
    );
    assert!(!exported.contains("imported:"), "{exported}");

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

/// The article titles in Starred with the name of the feed each is credited to.
async fn credited(reader: &Reader) -> Vec<(String, String)> {
    reader.get("/api/articles?view=starred").await["articles"]
        .as_array()
        .unwrap()
        .iter()
        .map(|article| {
            (
                article["title"].as_str().unwrap().to_owned(),
                article["feed_title"].as_str().unwrap().to_owned(),
            )
        })
        .collect()
}

#[tokio::test]
async fn stars_without_a_feed_address_keep_their_own_feeds_name() {
    let (base, state) = common::start_with_state(common::config()).await;
    let reader = Reader {
        cookie: common::signed_in(&base).await,
        base: base.clone(),
    };
    // Inoreader gives some items a label instead of a feed's address; a flat
    // list may name the feed, or nothing.
    let file = json!({ "items": [
        { "title": "From B", "published": 1_700_000_300,
          "alternate": [{ "href": "https://b.example/1" }],
          "origin": { "streamId": "user/1/label/Reading", "title": "Bee blog" } },
        { "title": "From C", "published": 1_700_000_200,
          "alternate": [{ "href": "https://c.example/1" }],
          "origin": { "streamId": "user/1/label/Reading", "title": "Cee blog" } },
        { "title": "From nowhere", "published": 1_700_000_100,
          "url": "https://d.example/1" }
    ]})
    .to_string();
    let (_, answer) = reader.send("/api/starred/import", file).await;
    assert_eq!(answer["summary"]["starred"], 3, "{answer}");
    let line = |title: &str, feed: &str| (title.to_owned(), feed.to_owned());
    assert_eq!(
        credited(&reader).await,
        [
            line("From B", "Bee blog"),
            line("From C", "Cee blog"),
            line("From nowhere", "Imported stars"),
        ]
    );
    // Its export says no feed address, and comes back into a fresh nine
    // turtles credited the same.
    let exported = Client::new()
        .get(format!("{base}/api/starred/export"))
        .header("cookie", &reader.cookie)
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    assert!(!exported.contains("imported:"), "{exported}");
    let fresh = {
        let base = common::start(common::config()).await;
        Reader {
            cookie: common::signed_in(&base).await,
            base,
        }
    };
    let (_, answer) = fresh.send("/api/starred/import", exported).await;
    assert_eq!(answer["summary"]["starred"], 3, "{answer}");
    assert_eq!(credited(&fresh).await, credited(&reader).await);

    // Deleting an account takes its imported feeds and articles with it.
    let (person, cookie) = common::another_reader(&state).await;
    let other = Reader { base, cookie };
    let mine = json!([{ "title": "Mine", "url": "https://e.example/1",
                        "feed_url": "https://e.example/feed" }]);
    let (_, answer) = other.send("/api/starred/import", mine.to_string()).await;
    assert_eq!(answer["summary"]["starred"], 1, "{answer}");
    let theirs = format!("imported:{person}:%");
    let count = |sql: &'static str| {
        let state = state.clone();
        let theirs = theirs.clone();
        async move {
            sqlx::query_scalar::<_, i64>(sql)
                .bind(theirs)
                .fetch_one(&state.db)
                .await
                .unwrap()
        }
    };
    let feeds = "SELECT COUNT(*) FROM feeds WHERE url_key LIKE ?";
    let articles = "SELECT COUNT(*) FROM articles JOIN feeds ON feeds.id = articles.feed_id
                    WHERE feeds.url_key LIKE ?";
    assert_eq!(count(feeds).await, 1);
    nine_turtles::people::delete(&state.db, person)
        .await
        .unwrap();
    assert_eq!(count(feeds).await, 0);
    assert_eq!(count(articles).await, 0);
}

#[tokio::test]
async fn files_and_readers_have_limits() {
    let (base, state) = common::start_with_state(common::config()).await;
    let reader = Reader {
        cookie: common::signed_in(&base).await,
        base,
    };
    let stars = |from: usize, count: usize| -> Vec<Value> {
        (from..from + count)
            .map(|number| {
                json!({ "title": format!("Post {number}"),
                                  "url": format!("https://many.example/{number}") })
            })
            .collect()
    };
    // More than one file may bring: refused, nothing kept.
    let (status, _) = reader
        .send(
            "/api/starred/import",
            Value::Array(stars(0, nine_turtles::star_import::MOST_STARS + 1)).to_string(),
        )
        .await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    assert!(reader.titles("view=starred").await.is_empty());

    // More than one reader may keep, over two files: the second imports
    // nothing and says so.
    let half = usize::try_from(nine_turtles::star_import::MOST_KEPT / 2).unwrap() + 1;
    let first = Value::Array(stars(0, half)).to_string();
    let (status, answer) = reader.send("/api/starred/import", first).await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    let second = Value::Array(stars(half, half)).to_string();
    let (status, answer) = reader.send("/api/starred/import", second).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(answer["error"], "too-much");
    let kept: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM entries WHERE starred = 1")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(kept, i64::try_from(half).unwrap());
}
