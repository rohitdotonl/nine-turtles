//! The feed health page (SPEC section 17), tested against a real nine
//! turtles and a made-up publisher whose feeds break when a test says so.

mod common;

use std::sync::{Arc, Mutex};

use axum::{
    Router,
    extract::State,
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
};
use nine_turtles::{
    AppState,
    checking::{self, DAY, HOUR},
};
use reqwest::Client;
use serde_json::{Value, json};

#[derive(Default)]
struct Site {
    /// /old.xml answers "not found".
    old_gone: bool,
    /// /busy.xml asks nine turtles to wait an hour.
    busy: bool,
    /// Every path asked for.
    asked: Vec<String>,
}

type Shared = Arc<Mutex<Site>>;

async fn publisher() -> (String, Shared) {
    let site: Shared = Arc::default();
    let app = Router::new().fallback(serve).with_state(site.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (format!("http://{address}"), site)
}

async fn serve(State(site): State<Shared>, uri: Uri) -> Response {
    let mut site = site.lock().unwrap();
    let path = uri.path().to_owned();
    site.asked.push(path.clone());
    match path.as_str() {
        // The home page names the feed's new address, and one already followed.
        "/" => (
            [(header::CONTENT_TYPE, "text/html")],
            r#"<html><head><title>A blog</title>
            <link rel="alternate" type="application/rss+xml" title="New home" href="/new.xml">
            <link rel="alternate" type="application/rss+xml" title="Other" href="/other.xml">
            </head><body>Hello</body></html>"#,
        )
            .into_response(),
        "/old.xml" if site.old_gone => StatusCode::NOT_FOUND.into_response(),
        "/busy.xml" if site.busy => (
            StatusCode::TOO_MANY_REQUESTS,
            [(header::RETRY_AFTER, "3600")],
        )
            .into_response(),
        "/old.xml" | "/new.xml" => rss("Old name", &["one", "two", "three"]),
        // The same posts under other IDs (`v1-one`, `v2-one`): only their
        // links say they're the same.
        "/v1.xml" | "/v2.xml" => rss_with_ids("Versions", &["one", "two", "three"], &path[1..4]),
        "/other.xml" | "/busy.xml" => rss("Other", &["a"]),
        _ => StatusCode::NOT_FOUND.into_response(),
    }
}

/// A feed whose `link` is left out, so Find new address visits the feed's own home page.
fn rss(title: &str, posts: &[&str]) -> Response {
    rss_with_ids(title, posts, "")
}

/// The same, each post's ID starting with `id_start`.
fn rss_with_ids(title: &str, posts: &[&str], id_start: &str) -> Response {
    let items: String = posts
        .iter()
        .map(|post| {
            format!(
                "<item><title>{post}</title><link>https://blog.example/{post}</link>\
                 <guid>{id_start}{post}</guid><description>Words.</description></item>"
            )
        })
        .collect();
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(r#"<?xml version="1.0"?><rss version="2.0"><channel><title>{title}</title>{items}</channel></rss>"#),
    )
        .into_response()
}

struct Reader {
    base: String,
    cookie: String,
    state: AppState,
    site: String,
    published: Shared,
}

impl Reader {
    async fn new() -> Self {
        let (base, state) = common::start_with_state(common::config()).await;
        let cookie = common::signed_in(&base).await;
        let (site, published) = publisher().await;
        Self {
            base,
            cookie,
            state,
            site,
            published,
        }
    }

    async fn follow(&self, path: &str) -> i64 {
        let (status, added) = self
            .post(
                "/api/feeds",
                json!({ "address": format!("{}{path}", self.site) }),
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

    /// The listed feeds, as (id, state, problem).
    async fn listed(&self) -> Vec<(i64, String, String)> {
        self.get("/api/health").await["feeds"]
            .as_array()
            .unwrap()
            .iter()
            .map(|feed| {
                (
                    feed["id"].as_i64().unwrap(),
                    feed["state"].as_str().unwrap().to_owned(),
                    feed["problem"].as_str().unwrap_or_default().to_owned(),
                )
            })
            .collect()
    }

    /// When the library says a feed began failing: only while the health
    /// page lists it, so its list can say so (decision 0106).
    async fn failing_since(&self, id: i64) -> Option<i64> {
        let library = self.get("/api/feeds").await;
        let feed = library["feeds"]
            .as_array()
            .unwrap()
            .iter()
            .find(|feed| feed["id"].as_i64() == Some(id))
            .unwrap()
            .clone();
        feed["failing_since"].as_i64()
    }

    /// Checks one feed as background checking would, at `at`.
    async fn check(&self, id: i64, at: i64) {
        checking::check(&self.state, id, at).await.unwrap();
    }

    async fn execute(&self, sql: &'static str, id: i64, value: i64) {
        sqlx::query(sql)
            .bind(value)
            .bind(id)
            .execute(&self.state.db)
            .await
            .unwrap();
    }

    fn change(&self, change: impl FnOnce(&mut Site)) {
        change(&mut self.published.lock().unwrap());
    }
}

#[tokio::test]
async fn broken_feeds_are_listed_worst_first_and_retry_checks_now() {
    let reader = Reader::new().await;
    let old = reader.follow("/old.xml").await;
    let other = reader.follow("/other.xml").await;
    // Everything works: nothing to list.
    assert!(reader.listed().await.is_empty());

    reader.change(|site| site.old_gone = true);
    let now = nine_turtles::now();
    // One failure is usually a blip: not listed yet.
    reader.check(old, now).await;
    assert!(reader.listed().await.is_empty());
    assert_eq!(reader.failing_since(old).await, None);
    reader.check(old, now + HOUR).await;
    assert_eq!(
        reader.listed().await,
        [(old, "trouble".to_owned(), "not-found".to_owned())]
    );
    // Its list says so too, from when its failures began.
    assert_eq!(reader.failing_since(old).await, Some(now));
    assert_eq!(reader.failing_since(other).await, None);

    // Another feed failing for longer comes first while both are having
    // trouble; once the first has been "not found" for a week, it's dead,
    // and dead comes first.
    reader
        .execute(
            "UPDATE feeds SET failures = 5, failing_since = ?, problem = 'unreachable' WHERE id = ?",
            other,
            now - 2 * DAY,
        )
        .await;
    let order: Vec<i64> = reader.listed().await.iter().map(|feed| feed.0).collect();
    assert_eq!(order, [other, old]);
    reader
        .execute(
            "UPDATE feeds SET failing_since = ? WHERE id = ?",
            old,
            now - 8 * DAY,
        )
        .await;
    reader
        .execute(
            "UPDATE feeds SET missing_since = ? WHERE id = ?",
            old,
            now - 8 * DAY,
        )
        .await;
    assert_eq!(
        reader.listed().await,
        [
            (old, "dead".to_owned(), "not-found".to_owned()),
            (other, "trouble".to_owned(), "unreachable".to_owned()),
        ]
    );

    // Retry while it's still gone: checked again at once, still dead.
    let asked = reader.published.lock().unwrap().asked.len();
    let (status, answer) = reader
        .post(&format!("/api/health/{old}/retry"), json!({}))
        .await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    assert_eq!(answer["feed"]["state"], "dead");
    assert_eq!(reader.published.lock().unwrap().asked.len(), asked + 1);

    // Back again: Retry says it's working, and the page no longer lists it.
    reader.change(|site| site.old_gone = false);
    let (_, answer) = reader
        .post(&format!("/api/health/{old}/retry"), json!({}))
        .await;
    assert_eq!(answer["feed"]["state"], "working");
    assert_eq!(
        reader.listed().await,
        [(other, "trouble".to_owned(), "unreachable".to_owned())]
    );
    assert_eq!(reader.failing_since(old).await, None);

    // A feed that isn't followed can't be retried.
    let (status, _) = reader.post("/api/health/999/retry", json!({})).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn find_new_address_offers_the_sites_feeds_and_moving_keeps_everything() {
    let reader = Reader::new().await;
    let old = reader.follow("/old.xml").await;
    reader.follow("/other.xml").await;
    // The reader renames the feed and reads an article.
    let (status, _) = reader
        .post(
            &format!("/api/feeds/{old}"),
            json!({ "title": "My blog", "folders": [], "new_folder": "Reading" }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let articles = reader.get(&format!("/api/articles?feed={old}")).await;
    let first = articles["articles"][0]["id"].as_i64().unwrap();
    let (status, _) = reader
        .post(
            "/api/articles/read",
            json!({ "ids": [first], "read": true }),
        )
        .await;
    assert!(status.is_success(), "{status}");
    let second = articles["articles"][1]["id"].as_i64().unwrap();
    let (status, _) = reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [second], "starred": true }),
        )
        .await;
    assert!(status.is_success(), "{status}");

    reader.change(|site| site.old_gone = true);
    let now = nine_turtles::now();
    reader.check(old, now).await;
    reader.check(old, now + HOUR).await;

    // The feed names no site, so its own home page is visited, once. The
    // feed already followed isn't offered.
    let (status, found) = reader
        .post(&format!("/api/health/{old}/find"), json!({}))
        .await;
    assert_eq!(status, StatusCode::OK, "{found}");
    let new_home = format!("{}/new.xml", reader.site);
    assert_eq!(
        found["choices"],
        json!([{ "title": "New home", "url": new_home }])
    );

    let (status, moved) = reader
        .post(
            &format!("/api/health/{old}/address"),
            json!({ "url": new_home }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{moved}");
    assert_eq!(moved["feed"]["state"], "working");
    assert_eq!(moved["feed"]["url"], new_home);
    // Same name, same articles, the read one still read.
    assert_eq!(moved["feed"]["title"], "My blog");
    let articles = reader.get(&format!("/api/articles?feed={old}")).await;
    let articles = articles["articles"].as_array().unwrap();
    assert_eq!(articles.len(), 3);
    let read: Vec<bool> = articles
        .iter()
        .filter(|article| article["id"] == first)
        .map(|article| article["read"].as_bool().unwrap())
        .collect();
    assert_eq!(read, [true]);
    let starred: Vec<i64> = reader.get("/api/articles?view=starred").await["articles"]
        .as_array()
        .unwrap()
        .iter()
        .map(|article| article["id"].as_i64().unwrap())
        .collect();
    assert_eq!(starred, [second]);
    let library = reader.get("/api/feeds").await;
    let moved_feed = library["feeds"]
        .as_array()
        .unwrap()
        .iter()
        .find(|feed| feed["id"] == old)
        .unwrap()
        .clone();
    assert_eq!(moved_feed["folders"].as_array().unwrap().len(), 1);
    assert!(reader.listed().await.is_empty());

    // An address that's already followed, or that isn't a feed, is refused.
    let (status, refused) = reader
        .post(
            &format!("/api/health/{old}/address"),
            json!({ "url": format!("{}/other.xml", reader.site) }),
        )
        .await;
    assert_eq!(
        (status, refused["error"].as_str()),
        (StatusCode::CONFLICT, Some("already"))
    );
    let (status, refused) = reader
        .post(
            &format!("/api/health/{old}/address"),
            json!({ "url": format!("{}/", reader.site) }),
        )
        .await;
    assert_eq!(refused["error"], "no-feed", "{status}");
}

#[tokio::test]
async fn moving_matches_posts_by_their_link_without_tracking_tags() {
    let reader = Reader::new().await;
    let old = reader.follow("/v1.xml").await;
    // Someone else follows it too, so the reader moves to a feed of its own
    // and their marks are carried over to its articles.
    let (_, cookie) = common::another_reader(&reader.state).await;
    let response = Client::new()
        .post(format!("{}/api/feeds", reader.base))
        .header("cookie", cookie)
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body(json!({ "address": format!("{}/v1.xml", reader.site) }).to_string())
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let articles = reader.get(&format!("/api/articles?feed={old}")).await;
    let two = articles["articles"]
        .as_array()
        .unwrap()
        .iter()
        .find(|article| article["title"] == "two")
        .unwrap()["id"]
        .as_i64()
        .unwrap();
    let (status, _) = reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [two], "starred": true }),
        )
        .await;
    assert!(status.is_success(), "{status}");
    // As if stored before tracking tags were taken off on arrival (decision 0112).
    sqlx::query("UPDATE articles SET link = link || '?utm_source=rss' WHERE feed_id = ?")
        .bind(old)
        .execute(&reader.state.db)
        .await
        .unwrap();

    let (status, moved) = reader
        .post(
            &format!("/api/health/{old}/address"),
            json!({ "url": format!("{}/v2.xml", reader.site) }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{moved}");
    let new = moved["feed"]["id"].as_i64().unwrap();
    assert_ne!(new, old);
    // Each post once, the star carried over to its new copy.
    let articles = reader.get(&format!("/api/articles?feed={new}")).await;
    assert_eq!(
        articles["articles"].as_array().unwrap().len(),
        3,
        "{articles}"
    );
    let starred = reader.get("/api/articles?view=starred").await;
    let starred = starred["articles"].as_array().unwrap();
    assert_eq!(starred.len(), 1, "{starred:?}");
    assert_eq!(starred[0]["title"], "two");
    assert_ne!(starred[0]["id"], two);
    assert_eq!(starred[0]["link"], "https://blog.example/two");
}

#[tokio::test]
async fn retry_waits_when_the_publisher_asked_to_slow_down() {
    let reader = Reader::new().await;
    let busy = reader.follow("/busy.xml").await;
    reader.change(|site| site.busy = true);
    let now = nine_turtles::now();
    reader.check(busy, now).await;
    reader.check(busy, now).await;
    assert_eq!(
        reader.listed().await,
        [(busy, "trouble".to_owned(), "slow-down".to_owned())]
    );
    let asked = reader.published.lock().unwrap().asked.len();
    let (status, answer) = reader
        .post(&format!("/api/health/{busy}/retry"), json!({}))
        .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(answer["error"], "asked-to-wait");
    assert!(answer["until"].as_i64().unwrap() >= now + HOUR);
    // The publisher wasn't asked again.
    assert_eq!(reader.published.lock().unwrap().asked.len(), asked);
}

#[tokio::test]
async fn an_address_kept_for_its_stars_is_refused_rather_than_merged() {
    let reader = Reader::new().await;
    let old = reader.follow("/old.xml").await;
    // Followed once, a star kept, then unsubscribed from and cleared for good.
    let earlier = reader.follow("/other.xml").await;
    let articles = reader.get(&format!("/api/articles?feed={earlier}")).await;
    let star = articles["articles"][0]["id"].as_i64().unwrap();
    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [star], "starred": true }),
        )
        .await;
    let (status, _) = reader
        .post(&format!("/api/feeds/{earlier}/unsubscribe"), json!({}))
        .await;
    assert!(status.is_success(), "{status}");
    nine_turtles::folders::clear_unsubscribed(&reader.state.db, None, nine_turtles::now() + 1)
        .await
        .unwrap();

    let (status, refused) = reader
        .post(
            &format!("/api/health/{old}/address"),
            json!({ "url": format!("{}/other.xml", reader.site) }),
        )
        .await;
    assert_eq!(
        (status, refused["error"].as_str()),
        (StatusCode::CONFLICT, Some("kept-stars"))
    );
    // The star is still there.
    let starred = reader.get("/api/articles?view=starred").await;
    assert_eq!(starred["articles"][0]["id"], star);
}
