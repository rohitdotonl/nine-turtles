//! Saved searches (SPEC section 14): saving a search under a name, listing
//! them alphabetically, renaming and changing one, and deleting it, tested
//! against a real running nine turtles.

mod common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

struct Reader {
    base: String,
    cookie: String,
}

impl Reader {
    async fn new() -> Self {
        let base = common::start(common::config()).await;
        let cookie = common::signed_in(&base).await;
        Self { base, cookie }
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

    /// The saved searches' names, in the order the sidebar lists them.
    async fn names(&self) -> Vec<String> {
        self.searches()
            .await
            .iter()
            .map(|search| search["name"].as_str().unwrap().to_owned())
            .collect()
    }

    async fn searches(&self) -> Vec<Value> {
        let response = Client::new()
            .get(format!("{}/api/saved-searches", self.base))
            .header("cookie", &self.cookie)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let listed: Value = serde_json::from_str(&response.text().await.unwrap()).unwrap();
        listed["searches"].as_array().unwrap().clone()
    }
}

fn climate() -> Value {
    json!({ "words": "\"climate\"", "scope": { "kind": "folder", "id": 2 }, "unread": true,
            "starred": false, "after": "2026-10-01", "before": "" })
}

#[tokio::test]
async fn searches_are_saved_listed_alphabetically_changed_and_deleted() {
    let reader = Reader::new().await;
    assert!(reader.searches().await.is_empty());

    let (status, saved) = reader
        .post(
            "/api/saved-searches",
            json!({ "name": "  Climate   news ", "query": climate() }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED, "{saved}");
    assert_eq!(saved["search"]["name"], "Climate news");
    let climate_id = saved["search"]["id"].as_i64().unwrap();
    let (status, _) = reader
        .post(
            "/api/saved-searches",
            json!({ "name": "apple", "query": { "words": "apple" } }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);

    // Alphabetically, whatever the capitals; what it searches comes back as it was saved.
    assert_eq!(reader.names().await, ["apple", "Climate news"]);
    assert_eq!(reader.searches().await[1]["query"], climate());

    // Two can't share a name, whatever its capitals.
    let (status, refused) = reader
        .post(
            "/api/saved-searches",
            json!({ "name": "CLIMATE NEWS", "query": {} }),
        )
        .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(refused["error"], "already");

    // Renamed, and searching for something else.
    let (status, _) = reader
        .post(
            &format!("/api/saved-searches/{climate_id}"),
            json!({ "name": "Weather", "query": { "words": "rain" } }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(reader.names().await, ["apple", "Weather"]);
    assert_eq!(
        reader.searches().await[1]["query"],
        json!({ "words": "rain" })
    );
    let (status, _) = reader
        .post(
            &format!("/api/saved-searches/{climate_id}"),
            json!({ "name": "Apple", "query": {} }),
        )
        .await;
    assert_eq!(status, StatusCode::CONFLICT);

    // Deleted: only the search goes.
    let (status, _) = reader
        .post(
            &format!("/api/saved-searches/{climate_id}/delete"),
            json!({}),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(reader.names().await, ["apple"]);
    let (status, _) = reader
        .post(
            &format!("/api/saved-searches/{climate_id}/delete"),
            json!({}),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = reader
        .post(
            &format!("/api/saved-searches/{climate_id}"),
            json!({ "name": "Gone", "query": {} }),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn a_search_needs_a_name_and_a_small_query() {
    let reader = Reader::new().await;
    let (status, refused) = reader
        .post("/api/saved-searches", json!({ "name": "   ", "query": {} }))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(refused["error"], "no-name");

    let huge = "word ".repeat(1000);
    let (status, refused) = reader
        .post(
            "/api/saved-searches",
            json!({ "name": "Huge", "query": { "words": huge } }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(refused["error"], "too-large");

    // What it searches is always a JSON object.
    let (status, _) = reader
        .post(
            "/api/saved-searches",
            json!({ "name": "List", "query": ["words"] }),
        )
        .await;
    assert!(status.is_client_error());
    assert!(reader.searches().await.is_empty());
}

#[tokio::test]
async fn saved_searches_need_signing_in() {
    let base = common::start(common::config()).await;
    let response = Client::new()
        .get(format!("{base}/api/saved-searches"))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn a_search_in_a_deleted_folder_never_moves_to_a_new_folder_with_its_number() {
    let reader = Reader::new().await;
    let (_, made) = reader
        .post("/api/folders", json!({ "name": "Old", "feeds": [] }))
        .await;
    let folder = made["folder"]["id"].as_i64().unwrap();
    let query = json!({ "words": "rain", "scope": { "kind": "folder", "id": folder } });
    reader
        .post(
            "/api/saved-searches",
            json!({ "name": "In old", "query": query }),
        )
        .await;
    let (status, _) = reader
        .post(&format!("/api/folders/{folder}/delete"), json!({}))
        .await;
    assert_eq!(status, StatusCode::OK);
    // SQLite may give a new folder the same number; the saved search now looks in none.
    let (_, made) = reader
        .post("/api/folders", json!({ "name": "New", "feeds": [] }))
        .await;
    assert_eq!(made["folder"]["id"].as_i64().unwrap(), folder);
    let saved = &reader.searches().await[0];
    assert_eq!(
        saved["query"]["scope"],
        json!({ "kind": "folder", "id": 0 })
    );
    assert_eq!(saved["query"]["words"], "rain");
}

#[tokio::test]
async fn undo_after_deleting_a_folder_puts_its_saved_searches_back_in_it() {
    let reader = Reader::new().await;
    let (_, made) = reader
        .post("/api/folders", json!({ "name": "Garden", "feeds": [] }))
        .await;
    let folder = made["folder"]["id"].as_i64().unwrap();
    reader
        .post(
            "/api/saved-searches",
            json!({ "name": "Roses", "query": { "words": "roses", "scope": { "kind": "folder", "id": folder } } }),
        )
        .await;
    let (status, deleted) = reader
        .post(&format!("/api/folders/{folder}/delete"), json!({}))
        .await;
    assert_eq!(status, StatusCode::OK);
    let searches = deleted["searches"].clone();
    assert_eq!(searches.as_array().map(Vec::len), Some(1));

    // Undo: the folder is made again with what the delete answered.
    let (status, made) = reader
        .post(
            "/api/folders",
            json!({ "name": "Garden", "feeds": [], "searches": searches }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let again = made["folder"]["id"].as_i64().unwrap();
    assert_eq!(
        reader.searches().await[0]["query"]["scope"],
        json!({ "kind": "folder", "id": again })
    );
}
