//! Each reader's things are theirs alone (decision 0086): two readers share
//! one running nine turtles, and the second tries on purpose to see, change
//! or delete what belongs to the first, by number, through every door the
//! screen and other apps use. Every try finds nothing, or leaves the first
//! reader's things exactly as they were.
//!
//! So far this covers settings, the app password, folders, saved searches
//! and rules. Feeds, articles, read marks and stars get their own walls in
//! the next structure change.

mod common;

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// A made-up blog with three posts, one about tomatoes.
async fn publisher() -> String {
    let app = Router::new().route("/feed.xml", get(|| async { feed() }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}/feed.xml")
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
    let (owner, other, _, feed) = two_readers().await;
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
