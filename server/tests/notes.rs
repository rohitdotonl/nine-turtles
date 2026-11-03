//! Notes and highlights (SPEC section 42, decision 0162), tested against a
//! real running nine turtles and a made-up publisher: highlighting, notes on
//! articles and people (with what Undo needs), the Notes list, search, the
//! export, the wall between readers, and what unsubscribing keeps or
//! removes as the reader chose.

mod common;

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// A made-up blog whose feed has 5 posts, one a day up to yesterday, about soup (the same as in collections.rs).
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
                nine_turtles::dates::rfc3339(now - day * 86_400)
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

async fn count(state: &nine_turtles::AppState, sql: &'static str, person: i64) -> i64 {
    sqlx::query_scalar(sql)
        .bind(person)
        .fetch_one(&state.db)
        .await
        .unwrap()
}

#[tokio::test]
async fn highlights_and_notes_are_kept_listed_found_and_exported() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (feed, ids) = follow(&base, &cookie, &publisher().await).await;

    // Highlight words in Soup 2, with a note.
    let (status, made) = send(
        &base,
        &cookie,
        &format!("/api/articles/{}/highlights", ids[1]),
        json!({ "quote": " A warm soup ", "before": "", "after": ", number 2.", "note": "Try with leeks" }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let highlight = made["highlight"]["id"].as_i64().unwrap();
    assert_eq!(made["highlight"]["quote"], "A warm soup");
    // Nothing to highlight is refused; so is an article the reader doesn't have.
    let (status, _) = send(
        &base,
        &cookie,
        &format!("/api/articles/{}/highlights", ids[1]),
        json!({ "quote": "  " }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = send(
        &base,
        &cookie,
        "/api/articles/9999/highlights",
        json!({ "quote": "x" }),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // A note on the whole of Soup 4; saving it again replaces it, and says what it was.
    let path = format!("/api/articles/{}/note", ids[3]);
    let (_, first) = send(&base, &cookie, &path, json!({ "note": "Grandma's" })).await;
    assert_eq!(first["was"], Value::Null);
    let (_, second) = send(
        &base,
        &cookie,
        &path,
        json!({ "note": "Grandma's, with barley" }),
    )
    .await;
    assert_eq!(second["was"], "Grandma's");

    // The article brings them with it.
    let (_, opened) = ask(&base, &cookie, &format!("/api/articles/{}", ids[1])).await;
    assert_eq!(opened["article"]["notes"][0]["note"], "Try with leeks");

    // The Notes list: both articles, newest first, with what to show under each.
    let (_, page) = ask(&base, &cookie, "/api/articles?view=notes").await;
    assert_eq!(titles(&page), ["Soup 2", "Soup 4"]);
    assert_eq!(page["articles"][0]["highlighted"], "A warm soup");
    assert_eq!(page["articles"][1]["noted"], "Grandma's, with barley");

    // Search finds the reader's own words, and says they're theirs.
    let (_, found) = ask(&base, &cookie, "/api/search?q=barley").await;
    assert_eq!(titles(&found), ["Soup 4"]);
    assert_eq!(found["articles"][0]["excerpt_from"], "note");
    let (_, found) = ask(&base, &cookie, "/api/search?notes=true").await;
    assert_eq!(titles(&found), ["Soup 2", "Soup 4"]);

    // A note on the person, shown with the sidebar's list.
    let (status, _) = send(
        &base,
        &cookie,
        &format!("/api/feeds/{feed}/note"),
        json!({ "note": "Met at the market." }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // The export holds all of it.
    let response = Client::new()
        .get(format!("{base}/api/notes/export"))
        .header("cookie", &cookie)
        .send()
        .await
        .unwrap();
    assert!(
        response.headers()[header::CONTENT_TYPE]
            .to_str()
            .unwrap()
            .starts_with("text/markdown")
    );
    let text = response.text().await.unwrap();
    assert!(
        text.contains("## Kitchen Notes\n\nMet at the market.\n"),
        "{text}"
    );
    assert!(
        text.contains("> A warm soup\n\nNote: Try with leeks"),
        "{text}"
    );
    assert!(text.contains("Your note: Grandma's, with barley"), "{text}");

    // Changing a highlight's note, then removing it, each answers what it was, for Undo.
    let (_, changed) = send(
        &base,
        &cookie,
        &format!("/api/highlights/{highlight}"),
        json!({ "note": "" }),
    )
    .await;
    assert_eq!(changed["was"]["note"], "Try with leeks");
    let (_, removed) = send(
        &base,
        &cookie,
        &format!("/api/highlights/{highlight}/delete"),
        json!({}),
    )
    .await;
    assert_eq!(removed["was"]["quote"], "A warm soup");
    let (_, page) = ask(&base, &cookie, "/api/articles?view=notes").await;
    assert_eq!(titles(&page), ["Soup 4"]);
}

#[tokio::test]
async fn another_reader_can_neither_see_nor_change_notes() {
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let address = publisher().await;
    let (feed, ids) = follow(&base, &cookie, &address).await;
    let (_, made) = send(
        &base,
        &cookie,
        &format!("/api/articles/{}/highlights", ids[0]),
        json!({ "quote": "soup" }),
    )
    .await;
    let highlight = made["highlight"]["id"].as_i64().unwrap();
    let (_, other) = common::another_reader(&state).await;
    follow(&base, &other, &address).await;

    let (_, page) = ask(&base, &other, "/api/articles?view=notes").await;
    assert_eq!(titles(&page), Vec::<String>::new());
    let (_, opened) = ask(&base, &other, &format!("/api/articles/{}", ids[0])).await;
    assert_eq!(opened["article"]["notes"], json!([]));
    for path in [
        format!("/api/highlights/{highlight}"),
        format!("/api/highlights/{highlight}/delete"),
    ] {
        let (status, _) = send(&base, &other, &path, json!({ "note": "mine" })).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
    }
    // Their own subscription's number is the same feed, but the note is theirs alone.
    send(
        &base,
        &other,
        &format!("/api/feeds/{feed}/note"),
        json!({ "note": "Theirs" }),
    )
    .await;
    let (_, mine) = ask(&base, &cookie, &format!("/api/articles/{}", ids[0])).await;
    assert_eq!(mine["article"]["notes"][0]["quote"], "soup");
    let text = Client::new()
        .get(format!("{base}/api/notes/export"))
        .header("cookie", &cookie)
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    assert!(!text.contains("Theirs"));
}

#[tokio::test]
async fn unsubscribing_keeps_what_was_marked_unless_asked_to_remove_it() {
    let (base, state) = common::start_with_state(common::config()).await;
    let (other_id, other) = common::another_reader(&state).await;
    let address = publisher().await;
    let (feed, ids) = follow(&base, &other, &address).await;
    send(
        &base,
        &other,
        &format!("/api/articles/{}/highlights", ids[1]),
        json!({ "quote": "soup" }),
    )
    .await;
    send(
        &base,
        &other,
        &format!("/api/feeds/{feed}/note"),
        json!({ "note": "Met at the market." }),
    )
    .await;
    send(
        &base,
        &other,
        "/api/articles/starred",
        json!({ "ids": [ids[2]], "starred": true }),
    )
    .await;
    let (_, kept) = ask(&base, &other, &format!("/api/feeds/{feed}/kept")).await;
    assert_eq!(kept, json!({ "starred": 1, "marked": 1, "note": true }));

    // Kept: the marked article and the note on the person stay.
    send(
        &base,
        &other,
        &format!("/api/feeds/{feed}/unsubscribe"),
        json!({}),
    )
    .await;
    nine_turtles::folders::clear_unsubscribed(&state.db, Some(other_id), i64::MAX)
        .await
        .unwrap();
    let (_, page) = ask(&base, &other, "/api/articles?view=notes").await;
    assert_eq!(titles(&page), ["Soup 2"]);
    assert_eq!(
        count(
            &state,
            "SELECT COUNT(*) FROM entries WHERE person_id = ?",
            other_id
        )
        .await,
        2
    );
    // The database itself refuses to delete an entry a note holds.
    let refused = sqlx::query("DELETE FROM entries WHERE person_id = ? AND article_id = ?")
        .bind(other_id)
        .bind(ids[1])
        .execute(&state.db)
        .await;
    assert!(refused.is_err());
    // Following again brings the note on the person back.
    let (again, _) = follow(&base, &other, &address).await;
    let note: Option<String> =
        sqlx::query_scalar("SELECT note FROM subscriptions WHERE person_id = ? AND feed_id = ?")
            .bind(other_id)
            .bind(again)
            .fetch_one(&state.db)
            .await
            .unwrap();
    assert_eq!(note.as_deref(), Some("Met at the market."));

    // Removed: unsubscribing with remove_kept, once cleared, leaves nothing.
    let (status, _) = send(
        &base,
        &other,
        &format!("/api/feeds/{again}/unsubscribe?remove_kept=true"),
        json!({}),
    )
    .await;
    assert!(status.is_success());
    // Undo first: still all there.
    send(
        &base,
        &other,
        &format!("/api/feeds/{again}/resubscribe"),
        json!({}),
    )
    .await;
    let (_, kept) = ask(&base, &other, &format!("/api/feeds/{again}/kept")).await;
    assert_eq!(kept["marked"], 1);
    send(
        &base,
        &other,
        &format!("/api/feeds/{again}/unsubscribe?remove_kept=true"),
        json!({}),
    )
    .await;
    nine_turtles::folders::clear_unsubscribed(&state.db, Some(other_id), i64::MAX)
        .await
        .unwrap();
    for sql in [
        "SELECT COUNT(*) FROM entries WHERE person_id = ?",
        "SELECT COUNT(*) FROM notes WHERE person_id = ?",
        "SELECT COUNT(*) FROM subscriptions WHERE person_id = ?",
    ] {
        assert_eq!(count(&state, sql, other_id).await, 0, "{sql}");
    }
}

#[tokio::test]
async fn deleting_the_reader_removes_their_notes() {
    let (base, state) = common::start_with_state(common::config()).await;
    let (other_id, other) = common::another_reader(&state).await;
    let (feed, ids) = follow(&base, &other, &publisher().await).await;
    send(
        &base,
        &other,
        &format!("/api/articles/{}/highlights", ids[0]),
        json!({ "quote": "soup" }),
    )
    .await;
    send(
        &base,
        &other,
        &format!("/api/feeds/{feed}/note"),
        json!({ "note": "Hello" }),
    )
    .await;
    nine_turtles::people::delete(&state.db, other_id)
        .await
        .unwrap();
    assert_eq!(
        count(
            &state,
            "SELECT COUNT(*) FROM notes WHERE person_id = ?",
            other_id
        )
        .await,
        0
    );
    assert_eq!(
        count(
            &state,
            "SELECT COUNT(*) FROM subscriptions WHERE person_id = ?",
            other_id
        )
        .await,
        0
    );
}
