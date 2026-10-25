//! Each reader's things are theirs alone (decision 0086): two readers share
//! one running nine turtles, and the second tries on purpose to see, change
//! or delete what belongs to the first, by number, through every door the
//! screen and other apps use. Every try finds nothing, or leaves the first
//! reader's things exactly as they were.
//!
//! This covers settings, the app password, folders, saved searches and
//! rules (structure change 11), and following feeds, each feed's name and
//! settings, and the read, starred and muted marks (structure change 12).
//! A feed both readers follow is stored and fetched once.

mod common;

use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// A made-up blog with three posts about tomatoes, at `/feed.xml` (and the
/// same feed at `/moved.xml`). Answers its address, and a count of the
/// times it was asked.
async fn counted_publisher() -> (String, Arc<AtomicUsize>) {
    let asked = Arc::new(AtomicUsize::new(0));
    let counter = asked.clone();
    let app = Router::new()
        .route(
            "/feed.xml",
            get(move || {
                counter.fetch_add(1, Ordering::SeqCst);
                async { feed() }
            }),
        )
        .route("/moved.xml", get(|| async { feed() }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (format!("http://{address}/feed.xml"), asked)
}

async fn publisher() -> String {
    counted_publisher().await.0
}

fn feed() -> impl IntoResponse {
    let items: String = (1..=3)
        .rev()
        .map(|number| {
            format!(
                "<item><title>Post {number} about tomatoes</title><guid>post-{number}</guid>\
                 <pubDate>0{number} Jan 2026 12:00:00 GMT</pubDate></item>"
            )
        })
        .collect();
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(
            r#"<?xml version="1.0"?><rss version="2.0"><channel><title>Garden notes</title>
            <link>https://garden.example/</link>{items}</channel></rss>"#
        ),
    )
}

/// One reader's browser.
struct Reader {
    base: String,
    cookie: String,
}

impl Reader {
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

    async fn get_text(&self, path: &str) -> String {
        let response = Client::new()
            .get(format!("{}{path}", self.base))
            .header("cookie", &self.cookie)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{path}");
        response.text().await.unwrap()
    }

    async fn get(&self, path: &str) -> Value {
        serde_json::from_str(&self.get_text(path).await).unwrap()
    }

    async fn status_of(&self, path: &str) -> StatusCode {
        Client::new()
            .get(format!("{}{path}", self.base))
            .header("cookie", &self.cookie)
            .send()
            .await
            .unwrap()
            .status()
    }

    /// Follows the feed at this address; answers its number.
    async fn follow(&self, address: &str) -> i64 {
        let (status, added) = self.post("/api/feeds", json!({ "address": address })).await;
        assert_eq!(status, StatusCode::CREATED, "{added}");
        added["feed"]["id"].as_i64().unwrap()
    }

    /// Every article in a list, as (number, read, starred, muted).
    async fn marks(&self, list: &str) -> Vec<(i64, bool, bool, bool)> {
        self.get(&format!("/api/articles?{list}")).await["articles"]
            .as_array()
            .unwrap()
            .iter()
            .map(|article| {
                (
                    article["id"].as_i64().unwrap(),
                    article["read"].as_bool().unwrap(),
                    article["starred"].as_bool().unwrap(),
                    article["muted"].as_bool().unwrap(),
                )
            })
            .collect()
    }

    /// The numbers of the articles in a list, newest first.
    async fn ids(&self, list: &str) -> Vec<i64> {
        self.marks(list).await.iter().map(|marks| marks.0).collect()
    }

    /// A fresh app password, and the app that uses it.
    async fn app(&self) -> App {
        let (status, made) = self.post("/api/apps/password", json!({})).await;
        assert_eq!(status, StatusCode::OK);
        App {
            base: self.base.clone(),
            password: made["password"].as_str().unwrap().to_owned(),
        }
    }
}

/// Another feed reader, signed in with a reader's app password.
struct App {
    base: String,
    password: String,
}

impl App {
    async fn get(&self, path: &str) -> Value {
        let response = Client::new()
            .get(format!("{}/api/greader/reader/api/0/{path}", self.base))
            .header(
                "authorization",
                format!("GoogleLogin auth={}", self.password),
            )
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{path}");
        serde_json::from_str(&response.text().await.unwrap()).unwrap()
    }

    async fn post(&self, path: &str, body: &str) -> StatusCode {
        Client::new()
            .post(format!("{}/api/greader/reader/api/0/{path}", self.base))
            .header(
                "authorization",
                format!("GoogleLogin auth={}", self.password),
            )
            .header("content-type", "application/x-www-form-urlencoded")
            .body(body.to_owned())
            .send()
            .await
            .unwrap()
            .status()
    }

    /// A list's articles, as (number, categories), from `stream/contents`.
    async fn stream(&self, stream: &str) -> Vec<(i64, Vec<String>)> {
        items(
            &self
                .get(&format!("stream/contents/{stream}?output=json"))
                .await,
        )
    }
}

/// The articles in an app's answer, as (number, categories).
fn items(answer: &Value) -> Vec<(i64, Vec<String>)> {
    answer["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| {
            let id = item["id"].as_str().unwrap();
            let hex = id.rsplit('/').next().unwrap();
            let categories = item["categories"]
                .as_array()
                .unwrap()
                .iter()
                .map(|category| category.as_str().unwrap().to_owned())
                .collect();
            (i64::from_str_radix(hex, 16).unwrap(), categories)
        })
        .collect()
}

/// The address a feed is stored under.
async fn address_of(state: &nine_turtles::AppState, feed: i64) -> String {
    sqlx::query_scalar("SELECT url FROM feeds WHERE id = ?")
        .bind(feed)
        .fetch_one(&state.db)
        .await
        .unwrap()
}

async fn count(state: &nine_turtles::AppState, sql: &str) -> i64 {
    sqlx::query_scalar(sqlx::AssertSqlSafe(sql.to_owned()))
        .fetch_one(&state.db)
        .await
        .unwrap()
}

/// The owner (who signs in with the password) and a second reader, on one
/// nine turtles, with the owner following the made-up blog.
async fn two_readers() -> (Reader, Reader, nine_turtles::AppState, i64) {
    let (base, state) = common::start_with_state(common::config()).await;
    let owner = Reader {
        cookie: common::signed_in(&base).await,
        base: base.clone(),
    };
    let (number, cookie) = common::another_reader(&state).await;
    assert_eq!(number, 2);
    let other = Reader { base, cookie };
    let (status, added) = owner
        .post("/api/feeds", json!({ "address": publisher().await }))
        .await;
    assert_eq!(status, StatusCode::CREATED, "{added}");
    let feed = added["feed"]["id"].as_i64().unwrap();
    (owner, other, state, feed)
}

#[tokio::test]
async fn settings_are_each_readers_own() {
    let (owner, other, _, _) = two_readers().await;
    let (status, _) = owner
        .post(
            "/api/settings",
            json!({ "sort": "oldest", "mode": "river" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    assert_eq!(
        other.get("/api/settings").await,
        json!({ "sort": "newest", "mode": "inbox" })
    );
    let (_, changed) = other
        .post("/api/settings", json!({ "sort": "newest" }))
        .await;
    assert_eq!(changed, json!({ "sort": "newest", "mode": "inbox" }));
    assert_eq!(
        owner.get("/api/settings").await,
        json!({ "sort": "oldest", "mode": "river" })
    );
}

#[tokio::test]
async fn folders_stay_with_the_reader_who_made_them() {
    let (owner, other, state, feed) = two_readers().await;
    let (status, made) = owner
        .post("/api/folders", json!({ "name": "Garden" }))
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let folder = made["folder"]["id"].as_i64().unwrap();
    let (status, _) = owner
        .post(
            &format!("/api/feeds/{feed}"),
            json!({ "title": "Garden notes", "folders": [folder] }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    // The second reader sees none of the owner's folders, or which feed is
    // in them, anywhere they're listed.
    assert_eq!(other.get("/api/feeds").await["folders"], json!([]));
    assert_eq!(other.get("/api/tidy/feeds").await["folders"], json!([]));
    for feed in other.get("/api/feeds").await["feeds"].as_array().unwrap() {
        assert_eq!(feed["folders"], json!([]));
    }
    assert!(!other.get_text("/api/opml").await.contains("Garden\""));
    // The folder's list and a search inside it find nothing for them.
    let listed = other.get(&format!("/api/articles?folder={folder}")).await;
    assert_eq!(listed["articles"], json!([]));
    let found = other
        .get(&format!("/api/search?q=tomatoes&folder={folder}"))
        .await;
    assert_eq!(found["articles"], json!([]));
    let since = listed["latest"].as_i64().unwrap() - 10;
    let new = other
        .get(&format!("/api/articles/new?folder={folder}&since={since}"))
        .await;
    assert_eq!(new["new"], json!(false));

    // They follow the same feed: still none of the owner's folders.
    other.follow(&address_of(&state, feed).await).await;
    assert_eq!(
        other.get("/api/feeds").await["feeds"][0]["folders"],
        json!([])
    );

    // They can make a folder with the same name: it's a different folder.
    let (status, theirs) = other
        .post("/api/folders", json!({ "name": "garden" }))
        .await;
    assert_eq!(status, StatusCode::CREATED, "{theirs}");
    assert_ne!(theirs["folder"]["id"].as_i64().unwrap(), folder);

    // Renaming or deleting the owner's folder by its number does nothing.
    let (status, _) = other
        .post(&format!("/api/folders/{folder}"), json!({ "name": "Mine" }))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = other
        .post(&format!("/api/folders/{folder}/delete"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    // Filing a feed in it, or moving feeds to it, doesn't either; and their
    // own filing never takes the feed out of the owner's folder.
    let (status, _) = other
        .post(
            &format!("/api/feeds/{feed}"),
            json!({ "title": "Garden notes", "folders": [folder] }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, _) = other
        .post(
            "/api/tidy/move",
            json!({ "feeds": [feed], "folder": folder }),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = other
        .post("/api/tidy/move", json!({ "feeds": [feed] }))
        .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = other
        .post(
            "/api/tidy/restore",
            json!({ "feeds": [{ "id": feed, "folders": [folder] }] }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(
        other.get("/api/feeds").await["feeds"][0]["folders"],
        json!([])
    );

    let mine = owner.get("/api/feeds").await;
    assert_eq!(mine["folders"], json!([{ "id": folder, "name": "Garden" }]));
    assert_eq!(mine["feeds"][0]["folders"], json!([folder]));
    assert_eq!(
        owner.get(&format!("/api/articles?folder={folder}")).await["articles"]
            .as_array()
            .unwrap()
            .len(),
        3
    );
}

#[tokio::test]
async fn saved_searches_stay_with_the_reader_who_saved_them() {
    let (owner, other, _, _) = two_readers().await;
    let (status, saved) = owner
        .post(
            "/api/saved-searches",
            json!({ "name": "Tomatoes", "query": { "q": "tomatoes" } }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let id = saved["search"]["id"].as_i64().unwrap();

    assert_eq!(
        other.get("/api/saved-searches").await["searches"],
        json!([])
    );
    let (status, _) = other
        .post(
            &format!("/api/saved-searches/{id}"),
            json!({ "name": "Mine now", "query": {} }),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = other
        .post(&format!("/api/saved-searches/{id}/delete"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    // The same name is free for them.
    let (status, _) = other
        .post(
            "/api/saved-searches",
            json!({ "name": "tomatoes", "query": {} }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);

    let mine = owner.get("/api/saved-searches").await["searches"].clone();
    assert_eq!(
        mine,
        json!([{ "id": id, "name": "Tomatoes", "query": { "q": "tomatoes" } }])
    );
}

#[tokio::test]
async fn rules_stay_with_the_reader_who_made_them() {
    let (owner, other, _, _) = two_readers().await;
    let (status, made) = owner
        .post(
            "/api/rules",
            json!({ "words": "tomatoes", "action": "star" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{made}");
    let id = made["id"].as_i64().unwrap();
    let (status, folder) = owner
        .post("/api/folders", json!({ "name": "Garden" }))
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let folder = folder["folder"]["id"].as_i64().unwrap();

    assert_eq!(other.get("/api/rules").await["rules"], json!([]));
    let edit = json!({ "words": "potatoes", "action": "mute" });
    let (status, _) = other.post(&format!("/api/rules/{id}"), edit).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = other
        .post(
            &format!("/api/rules/{id}/paused"),
            json!({ "paused": true }),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = other
        .post(&format!("/api/rules/{id}/apply"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = other
        .post(&format!("/api/rules/{id}/delete"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    // A rule can't be pointed at someone else's folder.
    let (status, refused) = other
        .post(
            "/api/rules",
            json!({ "words": "potatoes", "action": "mute", "folder_id": folder }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(refused["error"], "no-place");

    let mine = owner.get("/api/rules").await["rules"].clone();
    assert_eq!(mine.as_array().unwrap().len(), 1);
    assert_eq!(mine[0]["words"], "tomatoes");
    assert_eq!(mine[0]["action"], "star");
    assert_eq!(mine[0]["paused"], false);
}

#[tokio::test]
async fn an_app_password_says_whose_it_is() {
    let (owner, other, _, _) = two_readers().await;
    let (status, made) = owner.post("/api/apps/password", json!({})).await;
    assert_eq!(status, StatusCode::OK);
    let password = made["password"].as_str().unwrap().to_owned();
    let (status, _) = owner
        .post("/api/folders", json!({ "name": "Garden" }))
        .await;
    assert_eq!(status, StatusCode::CREATED);

    // The second reader has none, and turning theirs off leaves the owner's.
    assert_eq!(other.get("/api/apps").await["on"], json!(false));
    let (status, _) = other.post("/api/apps/off", json!({})).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(owner.get("/api/apps").await["on"], json!(true));

    // An app with the owner's password sees the owner's folders; one with
    // the second reader's sees only theirs.
    let (status, theirs) = other.post("/api/apps/password", json!({})).await;
    assert_eq!(status, StatusCode::OK);
    let theirs = theirs["password"].as_str().unwrap().to_owned();
    assert_ne!(theirs, password);
    let tags = |password: String| {
        let base = owner.base.clone();
        async move {
            let response = Client::new()
                .get(format!(
                    "{base}/api/greader/reader/api/0/tag/list?output=json"
                ))
                .header("authorization", format!("GoogleLogin auth={password}"))
                .send()
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK);
            serde_json::from_str::<Value>(&response.text().await.unwrap()).unwrap()["tags"].clone()
        }
    };
    let owners = tags(password.clone()).await;
    assert!(owners.to_string().contains("label/Garden"), "{owners}");
    let others = tags(theirs.clone()).await;
    assert!(!others.to_string().contains("Garden"), "{others}");

    // Through the app, the second reader can't rename or remove the
    // owner's folder either.
    for (path, body) in [
        ("rename-tag", "s=user/-/label/Garden&dest=user/-/label/Mine"),
        ("disable-tag", "s=user/-/label/Garden"),
    ] {
        Client::new()
            .post(format!("{}/api/greader/reader/api/0/{path}", owner.base))
            .header("authorization", format!("GoogleLogin auth={theirs}"))
            .header("content-type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .unwrap();
    }
    assert_eq!(
        owner.get("/api/feeds").await["folders"][0]["name"],
        json!("Garden")
    );
}

#[tokio::test]
async fn signing_out_signs_out_only_that_device() {
    let (owner, other, state, _) = two_readers().await;
    let (status, _) = other.post("/api/sign-out", json!({})).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(owner.get("/api/session").await["signed_in"], json!(true));
    assert_eq!(other.get("/api/session").await["signed_in"], json!(false));
    let owners: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sessions WHERE person_id = 1")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(owners, 1);
}

#[tokio::test]
async fn deleting_a_folder_from_an_app_pauses_its_rules_as_the_screen_does() {
    let (owner, _, _, _) = two_readers().await;
    let (status, folder) = owner
        .post("/api/folders", json!({ "name": "Garden" }))
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let folder = folder["folder"]["id"].as_i64().unwrap();
    let (status, _) = owner
        .post(
            "/api/rules",
            json!({ "words": "tomatoes", "action": "star", "folder_id": folder }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = owner
        .post(
            "/api/saved-searches",
            json!({ "name": "In the garden", "query": { "scope": { "kind": "folder", "id": folder } } }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);

    let password = made_for(&owner).await;
    let response = Client::new()
        .post(format!(
            "{}/api/greader/reader/api/0/disable-tag",
            owner.base
        ))
        .header("authorization", format!("GoogleLogin auth={password}"))
        .header("content-type", "application/x-www-form-urlencoded")
        .body("s=user/-/label/Garden")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    assert_eq!(owner.get("/api/feeds").await["folders"], json!([]));
    let rules = owner.get("/api/rules").await["rules"].clone();
    assert_eq!(rules[0]["place_gone"], json!(true));
    assert_eq!(rules[0]["folder_id"], Value::Null);
    let searches = owner.get("/api/saved-searches").await["searches"].clone();
    assert_eq!(searches[0]["query"]["scope"]["id"], json!(0));
}

/// A fresh app password for this reader.
async fn made_for(reader: &Reader) -> String {
    let (status, made) = reader.post("/api/apps/password", json!({})).await;
    assert_eq!(status, StatusCode::OK);
    made["password"].as_str().unwrap().to_owned()
}

/// Two readers who both follow the made-up blog. Answers them, nine
/// turtles' insides, the feed's number and the count of the publisher's
/// answers.
async fn two_followers() -> (
    Reader,
    Reader,
    nine_turtles::AppState,
    i64,
    Arc<AtomicUsize>,
) {
    let (base, state) = common::start_with_state(common::config()).await;
    let owner = Reader {
        cookie: common::signed_in(&base).await,
        base: base.clone(),
    };
    let (_, cookie) = common::another_reader(&state).await;
    let other = Reader { base, cookie };
    let (address, asked) = counted_publisher().await;
    let feed = owner.follow(&address).await;
    assert_eq!(other.follow(&address).await, feed);
    (owner, other, state, feed, asked)
}

#[tokio::test]
async fn a_feed_two_readers_follow_is_stored_and_fetched_once() {
    let (owner, other, state, feed, asked) = two_followers().await;
    // One feed, one copy of each article, and an entry of their own for
    // each reader.
    assert_eq!(count(&state, "SELECT COUNT(*) FROM feeds").await, 1);
    assert_eq!(count(&state, "SELECT COUNT(*) FROM articles").await, 3);
    assert_eq!(
        count(&state, "SELECT COUNT(*) FROM entries WHERE person_id = 1").await,
        3
    );
    assert_eq!(
        count(&state, "SELECT COUNT(*) FROM entries WHERE person_id = 2").await,
        3
    );
    // Both see the three posts, unread: the publisher still lists them.
    assert_eq!(
        owner.ids("view=unread").await,
        other.ids("view=unread").await
    );
    assert_eq!(other.get("/api/feeds").await["feeds"][0]["unread"], 3);
    // Following it again is "already", for each of them.
    let (status, _) = other
        .post(
            "/api/feeds",
            json!({ "address": address_of(&state, feed).await }),
        )
        .await;
    assert_eq!(status, StatusCode::CONFLICT);

    // When it's due, background checking asks the publisher once, for both.
    let before = asked.load(Ordering::SeqCst);
    sqlx::query("UPDATE feeds SET next_check_at = 0, etag = NULL, last_modified = NULL")
        .execute(&state.db)
        .await
        .unwrap();
    nine_turtles::checking::round(&state, nine_turtles::now())
        .await
        .unwrap();
    assert_eq!(asked.load(Ordering::SeqCst), before + 1);
    assert_eq!(count(&state, "SELECT COUNT(*) FROM articles").await, 3);

    // A new article reaches both, unread for each, and still once.
    let new = nine_turtles::feed::ParsedArticle {
        fingerprint: "post-4".to_owned(),
        title: "Post 4 about potatoes".to_owned(),
        link: None,
        author: None,
        content: None,
        summary: None,
        language: None,
        published_at: None,
    };
    let mut transaction = state.db.begin().await.unwrap();
    nine_turtles::feeds::store_articles(&mut transaction, feed, &[new], nine_turtles::now())
        .await
        .unwrap();
    transaction.commit().await.unwrap();
    assert_eq!(count(&state, "SELECT COUNT(*) FROM articles").await, 4);
    assert_eq!(owner.ids("view=unread").await.len(), 4);
    assert_eq!(other.ids("view=unread").await.len(), 4);
}

#[tokio::test]
async fn each_reader_marks_names_and_sets_up_a_shared_feed_alone() {
    let (owner, other, state, feed, _) = two_followers().await;
    let ids = owner.ids("view=all").await;
    let (first, second, third) = (ids[0], ids[1], ids[2]);

    // The owner reads one and stars another; the other reader stars the
    // third and mutes the first.
    let mark = |reader: &Reader, path: &'static str, body: Value| {
        let (base, cookie) = (reader.base.clone(), reader.cookie.clone());
        async move {
            let reader = Reader { base, cookie };
            let (status, answer) = reader.post(path, body).await;
            assert_eq!(status, StatusCode::OK, "{answer}");
            answer["marked"].as_i64().unwrap()
        }
    };
    mark(
        &owner,
        "/api/articles/read",
        json!({ "ids": [first], "read": true }),
    )
    .await;
    mark(
        &owner,
        "/api/articles/starred",
        json!({ "ids": [second], "starred": true }),
    )
    .await;
    mark(
        &other,
        "/api/articles/starred",
        json!({ "ids": [third], "starred": true }),
    )
    .await;
    mark(
        &other,
        "/api/articles/muted",
        json!({ "ids": [first], "muted": true }),
    )
    .await;

    assert_eq!(
        owner.marks("view=all").await,
        [
            (first, true, false, false),
            (second, false, true, false),
            (third, false, false, false)
        ]
    );
    // The other reader's muted article leaves their lists, not the owner's.
    assert_eq!(
        other.marks("view=all").await,
        [(second, false, false, false), (third, false, true, false)]
    );
    assert_eq!(owner.ids("view=unread").await, [second, third]);
    assert_eq!(other.ids("view=unread").await, [second, third]);
    assert_eq!(owner.ids("view=starred").await, [second]);
    assert_eq!(other.ids("view=starred").await, [third]);
    assert_eq!(owner.get("/api/feeds").await["feeds"][0]["unread"], 2);
    assert_eq!(other.get("/api/feeds").await["feeds"][0]["unread"], 2);
    assert_eq!(owner.get("/api/muted").await["count"], 0);
    assert_eq!(other.get("/api/muted").await["count"], 1);
    assert_eq!(other.get("/api/rules").await["muted"], 1);
    assert_eq!(owner.get("/api/rules").await["muted"], 0);

    // Each reads the article with their own marks.
    let read = owner.get(&format!("/api/articles/{first}")).await;
    assert_eq!(read["article"]["read"], true);
    let read = other.get(&format!("/api/articles/{second}")).await;
    assert_eq!(read["article"]["read"], false);
    assert_eq!(read["article"]["starred"], false);

    // The other reader renames the feed and sets it up their way.
    let (status, _) = other
        .post(
            &format!("/api/feeds/{feed}"),
            json!({ "title": "Their garden", "folders": [], "river": true,
                    "check": "daily", "open_on_site": true }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let mine = &owner.get("/api/feeds").await["feeds"][0];
    assert_eq!(mine["title"], "Garden notes");
    assert_eq!(mine["river"], false);
    assert_eq!(mine["check_at_most"], 0);
    assert_eq!(mine["open_on_site"], false);
    let theirs = &other.get("/api/feeds").await["feeds"][0];
    assert_eq!(theirs["title"], "Their garden");
    assert_eq!(theirs["river"], true);
    assert_eq!(theirs["check_at_most"], 86_400);
    // The feed is checked as often as the owner allows: its own rhythm.
    assert_eq!(count(&state, "SELECT check_at_most FROM feeds").await, 0);
    // Each list says each reader's name for it.
    assert_eq!(
        owner.get("/api/articles?view=all").await["articles"][0]["feed_title"],
        "Garden notes"
    );
    assert_eq!(
        other.get("/api/articles?view=all").await["articles"][0]["feed_title"],
        "Their garden"
    );
    // A feed that flows past leaves only their Unread.
    assert_eq!(owner.ids("view=unread").await, [second, third]);
    assert!(other.ids("view=unread").await.is_empty());

    // Search, the starred export, OPML and the tidy page are each theirs.
    let found = other.get("/api/search?q=tomatoes&starred=true").await["articles"].clone();
    assert_eq!(found.as_array().unwrap().len(), 1);
    assert_eq!(found[0]["id"], third);
    assert_eq!(found[0]["feed_title"], "Their garden");
    let found = owner.get("/api/search?q=tomatoes&unread=true").await["articles"].clone();
    assert_eq!(found.as_array().unwrap().len(), 2);
    assert!(
        other.get("/api/search?q=tomatoes&unread=true").await["articles"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    let export = owner.get("/api/starred/export").await;
    assert_eq!(export["items"].as_array().unwrap().len(), 1);
    assert_eq!(export["items"][0]["title"], "Post 2 about tomatoes");
    let export = other.get("/api/starred/export").await;
    assert_eq!(export["items"].as_array().unwrap().len(), 1);
    assert_eq!(
        export["items"][0]["_nine_turtles"]["feed_title"],
        "Their garden"
    );
    assert!(other.get_text("/api/opml").await.contains("Their garden"));
    assert!(!owner.get_text("/api/opml").await.contains("Their garden"));
    assert_eq!(
        other.get("/api/tidy/feeds").await["feeds"][0]["title"],
        "Their garden"
    );
    assert_eq!(
        owner.get("/api/tidy/feeds").await["feeds"][0]["title"],
        "Garden notes"
    );
}

#[tokio::test]
async fn a_reader_sees_and_changes_nothing_of_a_feed_they_dont_follow() {
    let (owner, other, state, feed) = two_readers().await;
    let ids = owner.ids("view=all").await;
    assert_eq!(ids.len(), 3);
    let (_, made) = owner
        .post(
            "/api/articles/starred",
            json!({ "ids": [ids[0]], "starred": true }),
        )
        .await;
    assert_eq!(made["marked"], 1);
    // The feed is failing, so the owner's health page lists it.
    sqlx::query("UPDATE feeds SET failures = 3, failing_since = 1, problem = 'unreachable'")
        .execute(&state.db)
        .await
        .unwrap();
    assert_eq!(
        owner.get("/api/health").await["feeds"]
            .as_array()
            .unwrap()
            .len(),
        1
    );

    // Every list, count and page is empty for the other reader.
    assert_eq!(other.get("/api/feeds").await["feeds"], json!([]));
    for list in [
        "view=all",
        "view=unread",
        "view=starred",
        &format!("feed={feed}"),
    ] {
        assert!(other.ids(list).await.is_empty(), "{list}");
        let new = other
            .get(&format!("/api/articles/new?{list}&since=0"))
            .await;
        assert_eq!(new["new"], false, "{list}");
    }
    assert_eq!(other.get("/api/muted").await["articles"], json!([]));
    assert_eq!(
        other.get("/api/search?q=tomatoes").await["articles"],
        json!([])
    );
    assert_eq!(other.get("/api/starred/export").await["items"], json!([]));
    assert!(!other.get_text("/api/opml").await.contains("Garden notes"));
    assert_eq!(other.get("/api/tidy/feeds").await["feeds"], json!([]));
    assert_eq!(other.get("/api/health").await["feeds"], json!([]));
    for id in &ids {
        assert_eq!(
            other.status_of(&format!("/api/articles/{id}")).await,
            StatusCode::NOT_FOUND
        );
    }

    // Marking the owner's articles by number changes nothing.
    for (path, body) in [
        ("/api/articles/read", json!({ "ids": ids, "read": true })),
        (
            "/api/articles/starred",
            json!({ "ids": ids, "starred": false }),
        ),
        ("/api/articles/muted", json!({ "ids": ids, "muted": true })),
    ] {
        let (status, answer) = other.post(path, body).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(answer["marked"], 0, "{path}");
    }
    // Nor do editing, unsubscribing, Undo or the health page's buttons.
    let (status, _) = other
        .post(
            &format!("/api/feeds/{feed}"),
            json!({ "title": "Mine", "folders": [], "river": true }),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = other
        .post(&format!("/api/feeds/{feed}/unsubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = other
        .post(&format!("/api/feeds/{feed}/resubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::CONFLICT);
    let (status, _) = other
        .post("/api/tidy/unsubscribe", json!({ "feeds": [feed] }))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    for action in ["retry", "find"] {
        let (status, _) = other
            .post(&format!("/api/health/{feed}/{action}"), json!({}))
            .await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{action}");
    }
    let (status, _) = other
        .post(
            &format!("/api/health/{feed}/address"),
            json!({ "url": address_of(&state, feed).await }),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, refused) = other
        .post(
            "/api/rules",
            json!({ "words": "tomatoes", "action": "mute", "feed_id": feed }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(refused["error"], "no-place");

    // Through an app with their password, likewise.
    let app = other.app().await;
    assert_eq!(
        app.get("subscription/list?output=json").await["subscriptions"],
        json!([])
    );
    let counts = app.get("unread-count?output=json").await;
    assert_eq!(counts["max"], 0);
    assert!(
        app.stream("user/-/state/com.google/reading-list")
            .await
            .is_empty()
    );
    assert!(app.stream(&format!("feed/{feed}")).await.is_empty());
    assert!(
        app.stream("user/-/state/com.google/starred")
            .await
            .is_empty()
    );
    let refs = app.get("stream/items/ids?output=json&n=100").await;
    assert_eq!(refs["itemRefs"], json!([]));
    let named: String = ids.iter().map(|id| format!("&i={id}")).collect();
    let contents = app
        .get(&format!("stream/items/contents?output=json{named}"))
        .await;
    assert!(items(&contents).is_empty());
    for body in [
        format!("a=user/-/state/com.google/read{named}"),
        format!("r=user/-/state/com.google/starred{named}"),
    ] {
        assert_eq!(app.post("edit-tag", &body).await, StatusCode::OK);
    }
    assert_eq!(
        app.post("mark-all-as-read", "s=user/-/state/com.google/reading-list")
            .await,
        StatusCode::OK
    );
    assert_eq!(
        app.post(
            "subscription/edit",
            &format!("ac=edit&s=feed/{feed}&t=Mine&a=user/-/label/Theirs")
        )
        .await,
        StatusCode::OK
    );
    assert_eq!(
        app.post(
            "subscription/edit",
            &format!("ac=unsubscribe&s=feed/{feed}")
        )
        .await,
        StatusCode::OK
    );

    // The owner's feed, marks and name are exactly as they were.
    let mine = &owner.get("/api/feeds").await["feeds"][0];
    assert_eq!(mine["title"], "Garden notes");
    assert_eq!(mine["unread"], 3);
    assert_eq!(mine["folders"], json!([]));
    assert_eq!(mine["river"], false);
    assert_eq!(
        owner.marks("view=all").await,
        [
            (ids[0], false, true, false),
            (ids[1], false, false, false),
            (ids[2], false, false, false)
        ]
    );
    assert_eq!(count(&state, "SELECT COUNT(*) FROM feed_folders").await, 0);
    assert_eq!(
        count(
            &state,
            "SELECT COUNT(*) FROM feeds WHERE unsubscribed_at IS NULL"
        )
        .await,
        1
    );
}

#[tokio::test]
async fn unsubscribing_removes_only_that_readers_marks_and_the_last_keeps_only_stars() {
    let (owner, other, state, feed, _) = two_followers().await;
    let ids = owner.ids("view=all").await;
    owner
        .post(
            "/api/articles/starred",
            json!({ "ids": [ids[0]], "starred": true }),
        )
        .await;
    owner
        .post(
            "/api/articles/read",
            json!({ "ids": [ids[1]], "read": true }),
        )
        .await;
    other
        .post(
            "/api/articles/starred",
            json!({ "ids": [ids[2]], "starred": true }),
        )
        .await;
    let owners_marks = owner.marks("view=all").await;

    // The other reader leaves: gone from their lists only. The feed is
    // still checked, for the owner.
    let (status, _) = other
        .post(&format!("/api/feeds/{feed}/unsubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(other.get("/api/feeds").await["feeds"], json!([]));
    assert!(other.ids("view=all").await.is_empty());
    assert_eq!(owner.marks("view=all").await, owners_marks);
    assert_eq!(
        count(
            &state,
            "SELECT COUNT(*) FROM feeds WHERE unsubscribed_at IS NULL"
        )
        .await,
        1
    );
    // Undo brings theirs back whole; then they leave for good.
    let (status, _) = other
        .post(&format!("/api/feeds/{feed}/resubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(other.ids("view=starred").await, [ids[2]]);
    other
        .post(&format!("/api/feeds/{feed}/unsubscribe"), json!({}))
        .await;
    // The owner unsubscribing from something else doesn't clear the other
    // reader's feed early.
    nine_turtles::folders::clear_unsubscribed(&state.db, Some(1), i64::MAX)
        .await
        .unwrap();
    assert_eq!(
        count(
            &state,
            "SELECT COUNT(*) FROM subscriptions WHERE cleared = 1"
        )
        .await,
        0
    );
    nine_turtles::folders::clear_unsubscribed(&state.db, None, i64::MAX)
        .await
        .unwrap();
    // Only their star is left of theirs; every article stays for the owner.
    assert_eq!(
        count(&state, "SELECT COUNT(*) FROM entries WHERE person_id = 2").await,
        1
    );
    assert_eq!(other.ids("view=starred").await, [ids[2]]);
    assert_eq!(
        other.get("/api/articles?view=starred").await["articles"][0]["feed_title"],
        "Garden notes"
    );
    assert_eq!(count(&state, "SELECT COUNT(*) FROM articles").await, 3);
    assert_eq!(owner.marks("view=all").await, owners_marks);
    let (status, _) = other
        .post(&format!("/api/feeds/{feed}/resubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::CONFLICT);

    // The last follower leaves: only the articles someone starred stay,
    // each for the reader who starred it.
    owner
        .post(&format!("/api/feeds/{feed}/unsubscribe"), json!({}))
        .await;
    assert_eq!(
        count(
            &state,
            "SELECT COUNT(*) FROM feeds WHERE unsubscribed_at IS NULL"
        )
        .await,
        0
    );
    nine_turtles::folders::clear_unsubscribed(&state.db, None, i64::MAX)
        .await
        .unwrap();
    assert_eq!(count(&state, "SELECT COUNT(*) FROM articles").await, 2);
    assert_eq!(owner.ids("view=starred").await, [ids[0]]);
    assert_eq!(other.ids("view=starred").await, [ids[2]]);
    assert_eq!(count(&state, "SELECT COUNT(*) FROM feeds").await, 1);

    // Following it again starts the owner afresh, star kept.
    let again = owner.follow(&address_of(&state, feed).await).await;
    assert_eq!(again, feed);
    assert_eq!(owner.ids("view=all").await.len(), 3);
    assert_eq!(owner.ids("view=starred").await, [ids[0]]);
    assert_eq!(other.ids("view=all").await, Vec::<i64>::new());
}

#[tokio::test]
async fn each_readers_rules_act_only_on_their_own_marks() {
    let (owner, other, state, feed, _) = two_followers().await;
    // The owner's folder holds the feed; the other reader's doesn't.
    let (_, garden) = owner
        .post("/api/folders", json!({ "name": "Garden" }))
        .await;
    let garden = garden["folder"]["id"].as_i64().unwrap();
    owner
        .post(
            &format!("/api/feeds/{feed}"),
            json!({ "title": "Garden notes", "folders": [garden] }),
        )
        .await;
    let (_, theirs) = other
        .post("/api/folders", json!({ "name": "Elsewhere" }))
        .await;
    let theirs = theirs["folder"]["id"].as_i64().unwrap();
    for (reader, rule) in [
        // Fires: the feed is in the owner's Garden.
        (
            &owner,
            json!({ "words": "tomatoes", "action": "mute", "folder_id": garden }),
        ),
        // Paused: never fires, and never stops the other reader's.
        (
            &owner,
            json!({ "words": "potatoes", "action": "star", "paused": true }),
        ),
        // Never fires: the feed isn't in their Elsewhere.
        (
            &other,
            json!({ "words": "tomatoes", "action": "mute", "folder_id": theirs }),
        ),
        (&other, json!({ "words": "potatoes", "action": "star" })),
    ] {
        let (status, made) = reader.post("/api/rules", rule).await;
        assert_eq!(status, StatusCode::OK, "{made}");
    }

    let new = nine_turtles::feed::ParsedArticle {
        fingerprint: "post-4".to_owned(),
        title: "Post 4 about tomatoes and potatoes".to_owned(),
        link: None,
        author: None,
        content: None,
        summary: None,
        language: None,
        published_at: None,
    };
    let mut transaction = state.db.begin().await.unwrap();
    nine_turtles::feeds::store_articles(&mut transaction, feed, &[new], nine_turtles::now())
        .await
        .unwrap();
    transaction.commit().await.unwrap();
    let id: i64 = count(
        &state,
        "SELECT id FROM articles WHERE fingerprint = 'post-4'",
    )
    .await;
    let marks = |person: i64| {
        sqlx::query_as::<_, (bool, bool, bool)>(
            "SELECT read, starred, muted FROM entries WHERE person_id = ? AND article_id = ?",
        )
        .bind(person)
        .bind(id)
        .fetch_one(&state.db)
    };
    // The owner's is muted (so read), not starred; the other reader's is
    // starred, unread and not muted.
    assert_eq!(marks(1).await.unwrap(), (true, false, true));
    assert_eq!(marks(2).await.unwrap(), (false, true, false));

    // Applying a rule to what's there now changes only its reader's marks.
    let rules = owner.get("/api/rules").await["rules"].clone();
    let mute = rules[0]["id"].as_i64().unwrap();
    other
        .post("/api/articles/read", json!({ "ids": [id], "read": false }))
        .await;
    let (status, applied) = owner
        .post(&format!("/api/rules/{mute}/apply"), json!({}))
        .await;
    assert_eq!(status, StatusCode::OK, "{applied}");
    assert_eq!(applied["ids"].as_array().unwrap().len(), 3);
    assert_eq!(other.get("/api/muted").await["count"], 0);
    assert_eq!(other.ids("view=unread").await.len(), 4);
}

#[tokio::test]
async fn apps_see_and_change_only_their_readers_feeds_and_marks() {
    let (owner, other, state, feed, _) = two_followers().await;
    let (owners_app, others_app) = (owner.app().await, other.app().await);
    let ids = owner.ids("view=all").await;

    // Filing and renaming through the app is each reader's own.
    assert_eq!(
        owners_app
            .post(
                "subscription/edit",
                &format!("ac=edit&s=feed/{feed}&a=user/-/label/Garden")
            )
            .await,
        StatusCode::OK
    );
    assert_eq!(
        others_app
            .post(
                "subscription/edit",
                &format!("ac=edit&s=feed/{feed}&t=Theirs&a=user/-/label/Elsewhere")
            )
            .await,
        StatusCode::OK
    );
    assert_eq!(
        others_app
            .post(
                "subscription/edit",
                &format!("ac=edit&s=feed/{feed}&r=user/-/label/Garden")
            )
            .await,
        StatusCode::OK
    );
    let mine = owners_app.get("subscription/list?output=json").await["subscriptions"].clone();
    assert_eq!(mine[0]["title"], "Garden notes");
    assert_eq!(mine[0]["categories"][0]["label"], "Garden");
    let theirs = others_app.get("subscription/list?output=json").await["subscriptions"].clone();
    assert_eq!(theirs[0]["title"], "Theirs");
    assert_eq!(theirs[0]["categories"][0]["label"], "Elsewhere");
    assert_eq!(theirs[0]["categories"].as_array().unwrap().len(), 1);

    // A folder's stream holds the feed only for the reader whose folder it is.
    assert_eq!(owners_app.stream("user/-/label/Garden").await.len(), 3);
    assert!(others_app.stream("user/-/label/Garden").await.is_empty());
    assert_eq!(others_app.stream("user/-/label/Elsewhere").await.len(), 3);

    // Marks through the app are the reader's own.
    assert_eq!(
        others_app
            .post(
                "edit-tag",
                &format!("i={}&a=user/-/state/com.google/starred", ids[0])
            )
            .await,
        StatusCode::OK
    );
    assert_eq!(
        others_app
            .post("mark-all-as-read", "s=user/-/label/Elsewhere")
            .await,
        StatusCode::OK
    );
    let others = others_app.stream(&format!("feed/{feed}")).await;
    assert!(
        others
            .iter()
            .all(|(_, tags)| tags.iter().any(|tag| tag.ends_with("/read")))
    );
    assert!(others[0].1.iter().any(|tag| tag.ends_with("/starred")));
    let owners = owners_app.stream(&format!("feed/{feed}")).await;
    assert!(owners.iter().all(|(_, tags)| {
        !tags
            .iter()
            .any(|tag| tag.ends_with("/read") || tag.ends_with("/starred"))
    }));
    let counts = owners_app.get("unread-count?output=json").await;
    assert_eq!(counts["max"], 3);
    assert_eq!(others_app.get("unread-count?output=json").await["max"], 0);
    let named: String = ids.iter().map(|id| format!("&i={id}")).collect();
    let contents = items(
        &owners_app
            .get(&format!("stream/items/contents?output=json{named}"))
            .await,
    );
    assert_eq!(contents.len(), 3);
    assert!(
        contents
            .iter()
            .all(|(_, tags)| !tags.iter().any(|tag| tag.ends_with("/read")))
    );
    assert_eq!(owner.get("/api/feeds").await["feeds"][0]["unread"], 3);
    let user = others_app.get("user-info?output=json").await;
    assert_eq!(user["userId"], "2");

    // Unfollowing through the app leaves the owner's feed.
    assert_eq!(
        others_app
            .post(
                "subscription/edit",
                &format!("ac=unsubscribe&s=feed/{feed}")
            )
            .await,
        StatusCode::OK
    );
    assert_eq!(
        others_app.get("subscription/list?output=json").await["subscriptions"],
        json!([])
    );
    assert_eq!(
        owner.get("/api/feeds").await["feeds"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        count(
            &state,
            "SELECT COUNT(*) FROM feeds WHERE unsubscribed_at IS NULL"
        )
        .await,
        1
    );
}

#[tokio::test]
async fn a_second_reader_imports_opml_without_a_second_copy_of_a_shared_feed() {
    let (owner, other, state, feed) = two_readers().await;
    let ids = owner.ids("view=all").await;
    owner
        .post(
            "/api/articles/read",
            json!({ "ids": [ids[0]], "read": true }),
        )
        .await;
    let address = address_of(&state, feed).await;
    let opml = format!(
        r#"<?xml version="1.0"?><opml version="2.0"><body>
        <outline text="Reading"><outline text="Shared blog" xmlUrl="{address}"/>
        <outline text="Only mine" xmlUrl="https://only-mine.example/feed"/></outline>
        </body></opml>"#
    );
    let response = Client::new()
        .post(format!("{}/api/opml", other.base))
        .header("cookie", &other.cookie)
        .header("sec-fetch-site", "same-origin")
        .body(opml)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let summary: Value = serde_json::from_str(&response.text().await.unwrap()).unwrap();
    assert_eq!(summary["summary"]["added"], 2);

    // One copy of the shared feed; the other reader has it, by their name,
    // in their folder, its articles so far read.
    assert_eq!(count(&state, "SELECT COUNT(*) FROM feeds").await, 2);
    assert_eq!(count(&state, "SELECT COUNT(*) FROM articles").await, 3);
    let theirs = other.get("/api/feeds").await;
    let names: Vec<&str> = theirs["feeds"]
        .as_array()
        .unwrap()
        .iter()
        .map(|feed| feed["title"].as_str().unwrap())
        .collect();
    assert_eq!(names, ["Only mine", "Shared blog"]);
    assert_eq!(theirs["feeds"][1]["id"], feed);
    assert_eq!(theirs["feeds"][1]["unread"], 0);
    assert_eq!(theirs["folders"][0]["name"], "Reading");
    assert_eq!(other.ids("view=all").await, ids);
    // The owner's marks, names, folders and export are as they were.
    let mine = owner.get("/api/feeds").await;
    assert_eq!(mine["feeds"].as_array().unwrap().len(), 1);
    assert_eq!(mine["feeds"][0]["title"], "Garden notes");
    assert_eq!(mine["feeds"][0]["unread"], 2);
    assert_eq!(mine["folders"], json!([]));
    let opml = owner.get_text("/api/opml").await;
    assert!(
        !opml.contains("only-mine") && !opml.contains("Reading"),
        "{opml}"
    );
}

/// An older post the publisher no longer lists, stored for a feed as if it
/// had been listed before, with an unread entry for each of its followers.
/// Answers its number.
async fn an_older_post(state: &nine_turtles::AppState, feed: i64) -> i64 {
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
         VALUES ((SELECT MAX(id) + 1 FROM articles), ?, 'id:post-0', 'Post 0 about tomatoes',
                 1, 1)
         RETURNING id",
    )
    .bind(feed)
    .fetch_one(&state.db)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO entries (person_id, article_id, feed_id, sort_at)
         SELECT person_id, ?, feed_id, 1 FROM subscriptions WHERE feed_id = ?",
    )
    .bind(id)
    .bind(feed)
    .execute(&state.db)
    .await
    .unwrap();
    id
}

/// Marks articles for a reader through the screen's own requests.
async fn mark(reader: &Reader, what: &str, ids: &[i64]) {
    let mut body = json!({ "ids": ids });
    body[what] = json!(true);
    let (status, answer) = reader.post(&format!("/api/articles/{what}"), body).await;
    assert_eq!(status, StatusCode::OK, "{answer}");
}

/// Every article in a list, as (title, read, starred), newest first.
async fn marks_by_title(reader: &Reader, list: &str) -> Vec<(String, bool, bool)> {
    reader.get(&format!("/api/articles?{list}")).await["articles"]
        .as_array()
        .unwrap()
        .iter()
        .map(|article| {
            (
                article["title"].as_str().unwrap().to_owned(),
                article["read"].as_bool().unwrap(),
                article["starred"].as_bool().unwrap(),
            )
        })
        .collect()
}

#[tokio::test]
async fn a_new_address_for_a_shared_feed_moves_only_the_reader_who_chose_it() {
    let (owner, other, state, feed, _) = two_followers().await;
    let older = an_older_post(&state, feed).await;
    let posts = other.ids(&format!("feed={feed}")).await;
    let (third, second, first) = (posts[0], posts[1], posts[2]);
    assert_eq!(posts[3], older);

    // The other reader has read the third post and the older one (no longer
    // listed at either address), starred the second and muted the first; the
    // owner starred the first.
    mark(&other, "read", &[third, older]).await;
    mark(&other, "starred", &[second]).await;
    mark(&other, "muted", &[first]).await;
    mark(&owner, "starred", &[first]).await;
    // They set the feed up their way: a name, a folder, settings, a rule
    // and a saved search for it.
    let (status, made) = other
        .post("/api/folders", json!({ "name": "Garden" }))
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let folder = made["folder"]["id"].as_i64().unwrap();
    let (status, _) = other
        .post(
            &format!("/api/feeds/{feed}"),
            json!({ "title": "Their garden", "folders": [folder], "river": true,
                    "check": "daily", "open_on_site": true }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, made) = other
        .post(
            "/api/rules",
            json!({ "words": "potatoes", "feed_id": feed, "action": "mute" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{made}");
    let (status, _) = other
        .post(
            "/api/saved-searches",
            json!({ "name": "Garden tomatoes",
                    "query": { "words": "tomatoes", "scope": { "kind": "feed", "id": feed } } }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let owners_before = owner.marks(&format!("feed={feed}")).await;

    let old_address = address_of(&state, feed).await;
    let new_address = old_address.replace("/feed.xml", "/moved.xml");
    let (status, moved) = other
        .post(
            &format!("/api/health/{feed}/address"),
            json!({ "url": new_address }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{moved}");
    let new_feed = moved["feed"]["id"].as_i64().unwrap();
    assert_ne!(new_feed, feed);
    // The owner's feed keeps its address; the other reader follows the new one.
    assert_eq!(address_of(&state, feed).await, old_address);
    assert_eq!(owner.get("/api/feeds").await["feeds"][0]["id"], feed);
    let theirs = other.get("/api/feeds").await["feeds"].clone();
    assert_eq!(theirs.as_array().unwrap().len(), 1);
    let theirs = &theirs[0];
    assert_eq!(theirs["id"], new_feed);
    // Their name, settings and folder came along.
    assert_eq!(theirs["title"], "Their garden");
    assert_eq!(theirs["river"], true);
    assert_eq!(theirs["check_at_most"], 86_400);
    assert_eq!(theirs["open_on_site"], true);
    assert_eq!(theirs["folders"], json!([folder]));
    let listed = other.get(&format!("/api/articles?folder={folder}")).await;
    assert_eq!(listed["articles"].as_array().unwrap().len(), 3);
    // So did their rule and saved search.
    assert_eq!(
        other.get("/api/rules").await["rules"][0]["feed_id"],
        new_feed
    );
    assert_eq!(
        other.get("/api/saved-searches").await["searches"][0]["query"]["scope"]["id"],
        new_feed
    );

    // Every article they had is in the new feed's list with its marks: the
    // three posts the new address lists too (its copies, with the old marks)
    // and the older post only the old address had.
    let expected = [
        ("Post 3 about tomatoes", true, false),
        ("Post 2 about tomatoes", false, true),
        ("Post 0 about tomatoes", true, false),
    ]
    .map(|(title, read, starred)| (title.to_owned(), read, starred))
    .to_vec();
    let list = format!("feed={new_feed}");
    assert_eq!(marks_by_title(&other, &list).await, expected);
    let muted = other.get("/api/muted").await;
    assert_eq!(muted["count"], 1);
    assert_eq!(muted["articles"][0]["title"], "Post 1 about tomatoes");
    assert_eq!(muted["articles"][0]["feed_id"], new_feed);
    // The older post opens, under the feed they follow now.
    let opened = other.get(&format!("/api/articles/{older}")).await;
    assert_eq!(opened["article"]["feed_id"], new_feed);
    assert_eq!(opened["article"]["feed_title"], "Their garden");
    assert_eq!(opened["article"]["read"], true);
    // Nothing of theirs waits to be cleared, so the tidy-up, however late,
    // takes nothing.
    nine_turtles::folders::clear_unsubscribed(&state.db, None, i64::MAX)
        .await
        .unwrap();
    assert_eq!(marks_by_title(&other, &list).await, expected);
    assert_eq!(other.get("/api/muted").await["count"], 1);
    assert_eq!(
        count(
            &state,
            "SELECT COUNT(*) FROM subscriptions WHERE person_id = 2"
        )
        .await,
        1
    );

    // The owner is untouched: the same four articles, the same marks.
    assert_eq!(owner.marks(&format!("feed={feed}")).await, owners_before);
    assert_eq!(owners_before.len(), 4);
    assert_eq!(
        owner.get("/api/feeds").await["feeds"][0]["title"],
        "Garden notes"
    );
    assert_eq!(owner.get("/api/muted").await["count"], 0);
    // The older post is stored once, still under the old feed, for both.
    assert_eq!(
        count(
            &state,
            &format!("SELECT COUNT(*) FROM entries WHERE article_id = {older}")
        )
        .await,
        2
    );
}

#[tokio::test]
async fn moving_to_an_address_someone_else_follows_keeps_everything_and_lets_go_of_the_rest() {
    // The owner follows the blog at its old address, alone; the other
    // reader follows it at the new one.
    let (base, state) = common::start_with_state(common::config()).await;
    let owner = Reader {
        cookie: common::signed_in(&base).await,
        base: base.clone(),
    };
    let (_, cookie) = common::another_reader(&state).await;
    let other = Reader { base, cookie };
    let address = publisher().await;
    let new_address = address.replace("/feed.xml", "/moved.xml");
    let feed = owner.follow(&address).await;
    let new_feed = other.follow(&new_address).await;
    let older = an_older_post(&state, feed).await;
    let posts = owner.ids(&format!("feed={feed}")).await;
    mark(&owner, "starred", &[posts[0], older]).await;
    mark(&owner, "read", &[posts[1]]).await;
    let theirs_before = other.marks(&format!("feed={new_feed}")).await;

    let (status, moved) = owner
        .post(
            &format!("/api/health/{feed}/address"),
            json!({ "url": new_address }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{moved}");
    assert_eq!(moved["feed"]["id"], new_feed);
    let expected = [
        ("Post 3 about tomatoes", false, true),
        ("Post 2 about tomatoes", true, false),
        ("Post 1 about tomatoes", false, false),
        ("Post 0 about tomatoes", false, true),
    ]
    .map(|(title, read, starred)| (title.to_owned(), read, starred))
    .to_vec();
    let list = format!("feed={new_feed}");
    assert_eq!(marks_by_title(&owner, &list).await, expected);
    // Nobody follows the old address now: its copies of the three posts
    // went (everyone's are the new address's), but the older post stays,
    // and so does the old feed's line under it, no longer checked.
    let articles_of_old = format!("SELECT COUNT(*) FROM articles WHERE feed_id = {feed}");
    assert_eq!(count(&state, &articles_of_old).await, 1);
    assert_eq!(
        count(
            &state,
            &format!(
                "SELECT COUNT(*) FROM feeds WHERE id = {feed} AND unsubscribed_at IS NOT NULL"
            )
        )
        .await,
        1
    );
    nine_turtles::folders::clear_unsubscribed(&state.db, None, i64::MAX)
        .await
        .unwrap();
    assert_eq!(marks_by_title(&owner, &list).await, expected);
    // The other reader's feed is just as it was.
    assert_eq!(other.marks(&list).await, theirs_before);

    // If the owner later unsubscribes from the new address, the usual
    // tidy-up takes their unstarred articles, and the older post too once
    // it's no longer starred; the other reader keeps all of theirs.
    let (status, _) = owner
        .post(
            "/api/articles/starred",
            json!({ "ids": [older], "starred": false }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = owner
        .post(&format!("/api/feeds/{new_feed}/unsubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    nine_turtles::folders::clear_unsubscribed(&state.db, None, i64::MAX)
        .await
        .unwrap();
    assert_eq!(count(&state, &articles_of_old).await, 0);
    assert_eq!(
        count(
            &state,
            &format!("SELECT COUNT(*) FROM feeds WHERE id = {feed}")
        )
        .await,
        0
    );
    assert_eq!(owner.ids("view=starred").await.len(), 1);
    assert_eq!(other.marks(&list).await, theirs_before);
}
