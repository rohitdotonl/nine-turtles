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
    /// nine turtles' insides, for running a background round by hand.
    state: nine_turtles::AppState,
}

impl Reader {
    /// A signed-in reader following the made-up blog.
    async fn new() -> Self {
        let (base, state) = common::start_with_state(common::config()).await;
        let cookie = common::signed_in(&base).await;
        let mut reader = Self {
            base,
            cookie,
            feed: 0,
            state,
        };
        let (status, added) = reader
            .post("/api/feeds", json!({ "address": publisher().await }))
            .await;
        assert_eq!(status, StatusCode::CREATED);
        // Only the newest five arrive unread (decision 0194); these tests
        // start from all 120 unread, as if every one were new since.
        assert_eq!(added["feed"]["unread"], 5);
        reader.feed = added["feed"]["id"].as_i64().unwrap();
        sqlx::query("UPDATE entries SET read = 0 WHERE feed_id = ?")
            .bind(reader.feed)
            .execute(&reader.state.db)
            .await
            .unwrap();
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
    // Settings says "Nothing starred yet" instead of offering an empty file (SPEC section 18).
    assert_eq!(reader.get("/api/feeds").await["starred"], false);

    let all = reader.list("view=all").await;
    let ids = [all[3].1, all[60].1, all[110].1];
    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": ids, "starred": true }),
        )
        .await;
    assert_eq!(reader.get("/api/feeds").await["starred"], true);

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
    assert_eq!(item["_nine_turtles"]["feed_title"], "Quiet Notes");
    assert_eq!(
        item["_nine_turtles"]["home_page_url"],
        "https://quiet.example/"
    );

    // An article stored before trackers and tracking tags were taken out on
    // arrival (decision 0112) leaves without them, as on screen.
    sqlx::query(
        "UPDATE articles SET link = 'https://quiet.example/117?utm_source=rss',
             content = '<p><a href=\"https://x.example/?utm_source=a&amp;id=2\">x</a>\
<img src=\"https://ad.doubleclick.net/p.gif\" width=\"1\" height=\"1\"></p>'
         WHERE id = ?",
    )
    .bind(ids[0])
    .execute(&reader.state.db)
    .await
    .unwrap();
    let file = reader.get("/api/starred/export").await;
    let item = &file["items"][0];
    assert_eq!(item["url"], "https://quiet.example/117");
    let content = item["content_html"].as_str().unwrap();
    assert!(!content.contains("doubleclick"), "{content}");
    assert!(!content.contains("utm_source"), "{content}");
    assert!(content.contains("id=2"), "{content}");

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
        json!({ "sort": "newest", "unread": true })
    );

    let (status, _) = reader
        .post("/api/settings", json!({ "sort": "oldest" }))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        reader.get("/api/settings").await,
        json!({ "sort": "oldest", "unread": true })
    );

    // Another device, signed in separately, sees the same.
    let other = Client::new()
        .get(format!("{}/api/settings", reader.base))
        .header("cookie", common::signed_in(&reader.base).await)
        .send()
        .await
        .unwrap();
    let other: Value = serde_json::from_str(&other.text().await.unwrap()).unwrap();
    assert_eq!(other, json!({ "sort": "oldest", "unread": true }));

    let (status, _) = reader
        .post("/api/settings", json!({ "sort": "sideways" }))
        .await;
    assert!(status.is_client_error());
    assert_eq!(
        reader.get("/api/settings").await,
        json!({ "sort": "oldest", "unread": true })
    );
}

#[tokio::test]
async fn unread_on_or_off_is_saved_on_its_own_and_keeps_read_state() {
    let reader = Reader::new().await;
    let id = reader.list("view=all").await[0].1;

    let (status, body) = reader
        .post("/api/settings", json!({ "unread": false }))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({ "sort": "newest", "unread": false }));

    // Changing the sort order alone leaves Unread as it was.
    reader
        .post("/api/settings", json!({ "sort": "oldest" }))
        .await;
    assert_eq!(
        reader.get("/api/settings").await,
        json!({ "sort": "oldest", "unread": false })
    );

    // Read state is still recorded quietly with Unread off, and shows again
    // once it's back on.
    let (status, _) = reader
        .post("/api/articles/read", json!({ "ids": [id], "read": true }))
        .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = reader
        .post("/api/settings", json!({ "unread": true }))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(
        !reader
            .list("view=unread")
            .await
            .iter()
            .any(|article| article.1 == id)
    );

    // A sidebar list can't be hidden any more (decision 0187): asking is ignored.
    let (status, _) = reader
        .post("/api/settings", json!({ "hidden": ["notes"] }))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(reader.get("/api/settings").await.get("hidden").is_none());

    let (status, _) = reader
        .post("/api/settings", json!({ "unread": "sideways" }))
        .await;
    assert!(status.is_client_error());
    assert_eq!(
        reader.get("/api/settings").await,
        json!({ "sort": "oldest", "unread": true })
    );
}

#[tokio::test]
async fn marks_need_sign_in_come_only_from_nine_turtles_and_have_a_limit() {
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

#[tokio::test]
async fn a_tab_from_before_saving_settings_now_gone_changes_nothing() {
    let reader = Reader::new().await;
    // There are no counts to hide (decision 0148), and unread no longer
    // lets go by itself (decision 0171): a tab from before still saves, and
    // nothing changes.
    for gone in [json!({ "counts": "hidden" }), json!({ "let_go": "week" })] {
        let (status, body) = reader.post("/api/settings", gone).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body, json!({ "sort": "newest", "unread": true }));
    }
    let kept: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM person_settings WHERE name LIKE 'let_go%'")
            .fetch_one(&reader.state.db)
            .await
            .unwrap();
    assert_eq!(kept, 0);
    assert_eq!(reader.list("view=unread").await.len(), 120);
}

/// Milliseconds since 1970, as a device's clock says.
fn ms_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

#[tokio::test]
async fn a_mark_made_offline_and_sent_late_never_overrides_a_later_one() {
    let reader = Reader::new().await;
    let all = reader.list("view=all").await;
    let (_, id) = all[0].clone();

    // The phone, offline at 10:00, marks it read and stars it. The laptop,
    // online at 11:00, marks it unread and takes the star off.
    let ten = ms_now() - 2 * 3_600_000;
    let eleven = ms_now() - 3_600_000;
    reader
        .post(
            "/api/articles/read",
            json!({ "ids": [id], "read": false, "at": eleven }),
        )
        .await;
    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [id], "starred": false, "at": eleven }),
        )
        .await;
    // At noon the phone is back online and sends its 10:00 marks: too old.
    let (status, answer) = reader
        .post(
            "/api/articles/read",
            json!({ "ids": [id], "read": true, "at": ten }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(answer["marked"], 0);
    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [id], "starred": true, "at": ten }),
        )
        .await;
    assert_eq!(
        reader.get(&format!("/api/articles/{id}")).await["article"]["read"],
        false
    );
    assert_eq!(
        reader.get(&format!("/api/articles/{id}")).await["article"]["starred"],
        false
    );

    // A mark made just now (no time given) wins over both.
    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [id], "starred": true }),
        )
        .await;
    assert_eq!(
        reader.get(&format!("/api/articles/{id}")).await["article"]["starred"],
        true
    );
    // A device whose clock runs a day fast counts as now, not tomorrow, so
    // the next ordinary mark still wins.
    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [id], "starred": false, "at": ms_now() + 86_400_000 }),
        )
        .await;
    assert_eq!(
        reader.get(&format!("/api/articles/{id}")).await["article"]["starred"],
        false
    );
    tokio::time::sleep(std::time::Duration::from_millis(5)).await;
    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [id], "starred": true }),
        )
        .await;
    assert_eq!(
        reader.get(&format!("/api/articles/{id}")).await["article"]["starred"],
        true
    );
}

#[tokio::test]
async fn several_articles_come_in_one_answer_for_reading_offline() {
    let reader = Reader::new().await;
    let all = reader.list("view=all").await;
    let wanted: Vec<String> = all[..3].iter().map(|(_, id)| id.to_string()).collect();
    // One that isn't the reader's is left out.
    let asked = format!("{},999999", wanted.join(","));
    let answer = reader
        .get(&format!("/api/articles/several?ids={asked}"))
        .await;
    let mut titles: Vec<&str> = answer["articles"]
        .as_array()
        .unwrap()
        .iter()
        .map(|article| article["title"].as_str().unwrap())
        .collect();
    titles.sort_unstable();
    assert_eq!(titles, ["Post 118", "Post 119", "Post 120"]);

    // At most 50 at once, and only numbers.
    let many: Vec<String> = (1..=51).map(|n| n.to_string()).collect();
    let too_many = Client::new()
        .get(format!(
            "{}/api/articles/several?ids={}",
            reader.base,
            many.join(",")
        ))
        .header("cookie", &reader.cookie)
        .send()
        .await
        .unwrap();
    assert_eq!(too_many.status(), StatusCode::PAYLOAD_TOO_LARGE);
    let not_numbers = Client::new()
        .get(format!("{}/api/articles/several?ids=1,two", reader.base))
        .header("cookie", &reader.cookie)
        .send()
        .await
        .unwrap();
    assert_eq!(not_numbers.status(), StatusCode::BAD_REQUEST);
    // Signed out: nothing.
    let signed_out = Client::new()
        .get(format!("{}/api/articles/several?ids=1", reader.base))
        .send()
        .await
        .unwrap();
    assert_eq!(signed_out.status(), StatusCode::UNAUTHORIZED);
}
