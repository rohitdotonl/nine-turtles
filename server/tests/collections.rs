//! Collections (SPEC section 34, decision 0108), tested against a real
//! running nine turtles and a made-up publisher: making, renaming and
//! deleting them (with what Undo needs), putting articles on them, their
//! list and search, the export, the wall between readers, and that an
//! article on one is kept when its feed is left and when its reader goes.

mod common;

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// A made-up blog whose feed has 5 posts, one a day up to yesterday, about soup.
async fn publisher() -> String {
    let app = Router::new().route("/feed.xml", get(|| async { feed() }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}/feed.xml")
}

fn feed() -> impl IntoResponse {
    let now = nine_turtles::now();
    let items: String = (1..=5)
        .map(|day| {
            format!(
                "<entry><title>Soup {day}</title><id>soup-{day}</id>\
                 <link href=\"https://kitchen.example/soup-{day}\"/>\
                 <content type=\"html\">A warm soup, number {day}.</content>\
                 <updated>{}</updated></entry>",
                nine_turtles::starred::rfc3339(now - day * 86_400)
            )
        })
        .collect();
    (
        [(header::CONTENT_TYPE, "application/atom+xml")],
        format!(
            r#"<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
            <title>Kitchen Notes</title><id>kitchen</id><updated>2026-01-01T00:00:00Z</updated>{items}</feed>"#
        ),
    )
}

async fn send(base: &str, cookie: &str, path: &str, body: Value) -> (StatusCode, Value) {
    let response = Client::new()
        .post(format!("{base}{path}"))
        .header("cookie", cookie)
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

async fn ask(base: &str, cookie: &str, path: &str) -> (StatusCode, Value) {
    let response = Client::new()
        .get(format!("{base}{path}"))
        .header("cookie", cookie)
        .send()
        .await
        .unwrap();
    let status = response.status();
    let text = response.text().await.unwrap();
    (status, serde_json::from_str(&text).unwrap_or(Value::Null))
}

fn titles(page: &Value) -> Vec<String> {
    page["articles"]
        .as_array()
        .unwrap()
        .iter()
        .map(|article| article["title"].as_str().unwrap().to_owned())
        .collect()
}

/// Follows the made-up blog; answers the feed's number and its articles' numbers, newest first.
async fn follow(base: &str, cookie: &str, address: &str) -> (i64, Vec<i64>) {
    let (status, added) = send(base, cookie, "/api/feeds", json!({ "address": address })).await;
    assert_eq!(status, StatusCode::CREATED);
    let feed = added["feed"]["id"].as_i64().unwrap();
    let (_, page) = ask(base, cookie, &format!("/api/articles?feed={feed}")).await;
    let ids = page["articles"]
        .as_array()
        .unwrap()
        .iter()
        .map(|article| article["id"].as_i64().unwrap())
        .collect();
    (feed, ids)
}

async fn make(base: &str, cookie: &str, name: &str) -> i64 {
    let (status, made) = send(base, cookie, "/api/collections", json!({ "name": name })).await;
    assert_eq!(status, StatusCode::CREATED);
    made["collection"]["id"].as_i64().unwrap()
}

async fn names(base: &str, cookie: &str) -> Vec<String> {
    let (status, listed) = ask(base, cookie, "/api/collections").await;
    assert_eq!(status, StatusCode::OK);
    listed["collections"]
        .as_array()
        .unwrap()
        .iter()
        .map(|each| each["name"].as_str().unwrap().to_owned())
        .collect()
}

#[tokio::test]
async fn collections_hold_articles_and_go_without_touching_them() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (_, ids) = follow(&base, &cookie, &publisher().await).await;
    assert_eq!(ids.len(), 5);

    let recipes = make(&base, &cookie, "  Recipes ").await;
    let cite = make(&base, &cookie, "to cite").await;
    // A to Z, whatever the capitals; names are tidied and unique.
    assert_eq!(names(&base, &cookie).await, ["Recipes", "to cite"]);
    let (status, refused) = send(
        &base,
        &cookie,
        "/api/collections",
        json!({ "name": "RECIPES" }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(refused["error"], "already");
    let (status, refused) = send(&base, &cookie, "/api/collections", json!({ "name": "  " })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(refused["error"], "no-name");

    // Soup 1 (the newest) and Soup 3 on Recipes; Soup 3 on To cite too.
    for (article, chosen) in [(ids[0], json!([recipes])), (ids[2], json!([recipes, cite]))] {
        let (status, _) = send(
            &base,
            &cookie,
            &format!("/api/articles/{article}/collections"),
            json!({ "collections": chosen }),
        )
        .await;
        assert_eq!(status, StatusCode::NO_CONTENT);
    }
    let (_, on) = ask(
        &base,
        &cookie,
        &format!("/api/articles/{}/collections", ids[2]),
    )
    .await;
    assert_eq!(on["collections"], json!([recipes, cite]));

    // Its list, in the reader's sort order by the article's date.
    let (_, page) = ask(
        &base,
        &cookie,
        &format!("/api/articles?collection={recipes}"),
    )
    .await;
    assert_eq!(titles(&page), ["Soup 1", "Soup 3"]);
    assert_eq!(page["next"], Value::Null);
    let (_, page) = ask(
        &base,
        &cookie,
        &format!("/api/articles?collection={recipes}&order=oldest"),
    )
    .await;
    assert_eq!(titles(&page), ["Soup 3", "Soup 1"]);
    // Nothing ever arrives on a collection by itself.
    let (_, new) = ask(
        &base,
        &cookie,
        &format!("/api/articles/new?collection={recipes}&since=0"),
    )
    .await;
    assert_eq!(new["new"], false);

    // Saving the sheet with only To cite ticked takes Soup 3 off Recipes.
    send(
        &base,
        &cookie,
        &format!("/api/articles/{}/collections", ids[2]),
        json!({ "collections": [cite] }),
    )
    .await;
    let (_, page) = ask(
        &base,
        &cookie,
        &format!("/api/articles?collection={recipes}"),
    )
    .await;
    assert_eq!(titles(&page), ["Soup 1"]);

    // Search: only what's in the collection, words or not.
    let (_, found) = ask(
        &base,
        &cookie,
        &format!("/api/search?q=soup&collection={cite}"),
    )
    .await;
    assert_eq!(titles(&found), ["Soup 3"]);
    let (_, found) = ask(&base, &cookie, &format!("/api/search?collection={recipes}")).await;
    assert_eq!(titles(&found), ["Soup 1"]);

    // Renaming.
    let (status, _) = send(
        &base,
        &cookie,
        &format!("/api/collections/{cite}"),
        json!({ "name": "Recipes" }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    let (status, _) = send(
        &base,
        &cookie,
        &format!("/api/collections/{cite}"),
        json!({ "name": "Cited" }),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(names(&base, &cookie).await, ["Cited", "Recipes"]);

    // The export: every collected article, its collections as its tags, every name listed.
    let empty = make(&base, &cookie, "Someday").await;
    let (status, export) = ask(&base, &cookie, "/api/collections/export").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(export["version"], "https://jsonfeed.org/version/1.1");
    assert_eq!(
        export["_nine_turtles"]["collections"],
        json!(["Cited", "Recipes", "Someday"])
    );
    let items = export["items"].as_array().unwrap();
    assert_eq!(items.len(), 2);
    assert_eq!(items[0]["title"], "Soup 1");
    assert_eq!(items[0]["tags"], json!(["Recipes"]));
    assert_eq!(items[0]["url"], "https://kitchen.example/soup-1");
    assert_eq!(items[0]["_nine_turtles"]["feed_title"], "Kitchen Notes");
    assert_eq!(items[1]["tags"], json!(["Cited"]));

    // Deleting removes only the collection, and answers what was on it for Undo.
    let (status, deleted) = send(
        &base,
        &cookie,
        &format!("/api/collections/{recipes}/delete"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(deleted["articles"], json!([ids[0]]));
    assert_eq!(names(&base, &cookie).await, ["Cited", "Someday"]);
    let (_, all) = ask(&base, &cookie, "/api/articles?view=all").await;
    assert_eq!(titles(&all).len(), 5);
    let (status, _) = send(
        &base,
        &cookie,
        &format!("/api/collections/{recipes}/delete"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    // Undo: made again with the same articles.
    let (status, back) = send(
        &base,
        &cookie,
        "/api/collections",
        json!({ "name": "Recipes", "articles": deleted["articles"] }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let again = back["collection"]["id"].as_i64().unwrap();
    let (_, page) = ask(&base, &cookie, &format!("/api/articles?collection={again}")).await;
    assert_eq!(titles(&page), ["Soup 1"]);
    let _ = empty;
}

#[tokio::test]
async fn another_reader_can_neither_see_nor_change_collections() {
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let address = publisher().await;
    let (_, ids) = follow(&base, &cookie, &address).await;
    let mine = make(&base, &cookie, "Recipes").await;
    send(
        &base,
        &cookie,
        &format!("/api/articles/{}/collections", ids[0]),
        json!({ "collections": [mine] }),
    )
    .await;

    let (_, other) = common::another_reader(&state).await;
    // The same name is theirs to use.
    assert!(names(&base, &other).await.is_empty());
    let theirs = make(&base, &other, "Recipes").await;
    // Mine can't be seen, listed, searched, renamed or deleted by number.
    let (_, page) = ask(&base, &other, &format!("/api/articles?collection={mine}")).await;
    assert!(titles(&page).is_empty());
    let (_, found) = ask(&base, &other, &format!("/api/search?collection={mine}")).await;
    assert!(titles(&found).is_empty());
    let (status, _) = send(
        &base,
        &other,
        &format!("/api/collections/{mine}"),
        json!({ "name": "Mine now" }),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = send(
        &base,
        &other,
        &format!("/api/collections/{mine}/delete"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    // An article they don't have can't go on anything of theirs, nor its collections be read.
    let (status, _) = send(
        &base,
        &other,
        &format!("/api/articles/{}/collections", ids[0]),
        json!({ "collections": [theirs] }),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = ask(
        &base,
        &other,
        &format!("/api/articles/{}/collections", ids[0]),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    // Following the same feed, they still can't put an article on my collection,
    // nor take mine off it, and their export holds nothing of mine.
    follow(&base, &other, &address).await;
    let (status, _) = send(
        &base,
        &other,
        &format!("/api/articles/{}/collections", ids[0]),
        json!({ "collections": [mine] }),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (_, on) = ask(
        &base,
        &other,
        &format!("/api/articles/{}/collections", ids[0]),
    )
    .await;
    assert_eq!(on["collections"], json!([]));
    let (_, export) = ask(&base, &other, "/api/collections/export").await;
    assert_eq!(export["items"], json!([]));
    assert_eq!(export["_nine_turtles"]["collections"], json!(["Recipes"]));

    // Mine is as it was.
    let (_, page) = ask(&base, &cookie, &format!("/api/articles?collection={mine}")).await;
    assert_eq!(titles(&page), ["Soup 1"]);
    assert_eq!(names(&base, &cookie).await, ["Recipes"]);
}

#[tokio::test]
async fn leaving_a_feed_keeps_its_collected_articles_and_deleting_the_reader_removes_all() {
    let (base, state) = common::start_with_state(common::config()).await;
    let (other_id, other) = common::another_reader(&state).await;
    let (feed, ids) = follow(&base, &other, &publisher().await).await;
    let shelf = make(&base, &other, "To cite").await;
    send(
        &base,
        &other,
        &format!("/api/articles/{}/collections", ids[1]),
        json!({ "collections": [shelf] }),
    )
    .await;

    let (status, _) = send(
        &base,
        &other,
        &format!("/api/feeds/{feed}/unsubscribe"),
        json!({}),
    )
    .await;
    assert!(status.is_success());
    // Cleared for good, as ten minutes later.
    nine_turtles::folders::clear_unsubscribed(&state.db, Some(other_id), i64::MAX)
        .await
        .unwrap();
    // Only the collected article is left, still in its collection and in search.
    let (_, page) = ask(&base, &other, &format!("/api/articles?collection={shelf}")).await;
    assert_eq!(titles(&page), ["Soup 2"]);
    let (_, found) = ask(&base, &other, "/api/search?q=soup").await;
    assert_eq!(titles(&found), ["Soup 2"]);
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM entries WHERE person_id = ?")
        .bind(other_id)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(left, 1);
    // The database itself refuses to delete an entry a collection holds.
    let refused = sqlx::query("DELETE FROM entries WHERE person_id = ?")
        .bind(other_id)
        .execute(&state.db)
        .await;
    assert!(refused.is_err());

    // Deleting the reader takes everything of theirs, collections included.
    nine_turtles::people::delete(&state.db, other_id)
        .await
        .unwrap();
    for (table, sql) in [
        (
            "collections",
            "SELECT COUNT(*) FROM collections WHERE person_id = ?",
        ),
        (
            "collection_articles",
            "SELECT COUNT(*) FROM collection_articles WHERE person_id = ?",
        ),
        (
            "entries",
            "SELECT COUNT(*) FROM entries WHERE person_id = ?",
        ),
    ] {
        let count: i64 = sqlx::query_scalar(sql)
            .bind(other_id)
            .fetch_one(&state.db)
            .await
            .unwrap();
        assert_eq!(count, 0, "{table}");
    }
    let articles: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM articles")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(articles, 0);
}
