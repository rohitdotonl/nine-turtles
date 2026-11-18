//! Pinned (SPEC section 5, decision 0310): a reader pins someone to the top
//! of Home from their page. A person's pin is on every place of theirs, at
//! most nine rows are pinned, and pins are each reader's own. Tested against a
//! real running nine turtles and a made-up publisher with a feed at any name.

mod common;

use axum::{
    Router,
    extract::Path,
    http::header,
    response::{IntoResponse, Response},
    routing::get,
};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

async fn publisher() -> String {
    let app = Router::new().route(
        "/{name}",
        get(|Path(name): Path<String>| async move { feed(&name) }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}")
}

fn feed(name: &str) -> Response {
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(
            r#"<?xml version="1.0"?><rss version="2.0"><channel><title>Notes {name}</title>
            <link>https://{name}.example/</link>
            <item><title>{name} 1</title><guid>{name}-1</guid></item></channel></rss>"#
        ),
    )
        .into_response()
}

struct Reader {
    base: String,
    cookie: String,
    publisher: String,
}

impl Reader {
    async fn follow(&self, name: &str) -> i64 {
        let (status, added) = self
            .post(
                "/api/feeds",
                json!({ "address": format!("{}/{name}", self.publisher) }),
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

    async fn pin(&self, feed: i64, pinned: bool) -> (StatusCode, Value) {
        self.post(
            &format!("/api/feeds/{feed}/pin"),
            json!({ "pinned": pinned }),
        )
        .await
    }

    /// The places pinned, as the sidebar gets them: (place, when pinned).
    async fn pinned(&self) -> Vec<(i64, i64)> {
        let response = Client::new()
            .get(format!("{}/api/feeds", self.base))
            .header("cookie", &self.cookie)
            .send()
            .await
            .unwrap();
        let listed: Value = serde_json::from_str(&response.text().await.unwrap()).unwrap();
        let mut pinned: Vec<(i64, i64)> = listed["feeds"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|place| Some((place["id"].as_i64()?, place["pinned_at"].as_i64()?)))
            .collect();
        pinned.sort_unstable();
        pinned
    }
}

#[tokio::test]
async fn a_pin_is_on_every_place_of_the_person_and_nine_is_the_most() {
    let (base, state) = common::start_with_state(common::config()).await;
    let reader = Reader {
        cookie: common::signed_in(&base).await,
        base,
        publisher: publisher().await,
    };
    let blog = reader.follow("alpha").await;
    let letters = reader.follow("alpha-letters").await;
    let (status, joined) = reader
        .post("/api/writers/join", json!({ "feeds": [blog, letters] }))
        .await;
    assert_eq!(status, StatusCode::OK, "{joined}");

    // Nothing is pinned until the reader pins someone.
    assert!(reader.pinned().await.is_empty());

    // Pinned from one place, the person is pinned on both.
    assert_eq!(reader.pin(letters, true).await.0, StatusCode::NO_CONTENT);
    let pinned = reader.pinned().await;
    assert_eq!(
        pinned.iter().map(|(place, _)| *place).collect::<Vec<_>>(),
        [blog, letters]
    );
    // Pinned again, they keep their place in the order.
    assert_eq!(reader.pin(blog, true).await.0, StatusCode::NO_CONTENT);
    assert_eq!(reader.pinned().await, pinned);

    // Eight more rows fill Pinned; the person's two places count as one.
    for name in ["b", "c", "d", "e", "f", "g", "h", "i"] {
        let feed = reader.follow(name).await;
        assert_eq!(reader.pin(feed, true).await.0, StatusCode::NO_CONTENT);
    }
    let tenth = reader.follow("j").await;
    let (status, refusal) = reader.pin(tenth, true).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(refusal["error"], "full");
    assert_eq!(reader.pinned().await.len(), 10);

    // Unpinned from either place, the person leaves Pinned, and there's room again.
    assert_eq!(reader.pin(blog, false).await.0, StatusCode::NO_CONTENT);
    let left: Vec<i64> = reader
        .pinned()
        .await
        .iter()
        .map(|(place, _)| *place)
        .collect();
    assert!(!left.contains(&blog) && !left.contains(&letters));
    assert_eq!(reader.pin(tenth, true).await.0, StatusCode::NO_CONTENT);

    // Pins are the reader's own: another can't pin or unpin someone they don't follow.
    let (_, cookie) = common::another_reader(&state).await;
    let other = Reader {
        base: reader.base.clone(),
        cookie,
        publisher: reader.publisher.clone(),
    };
    assert_eq!(other.pin(tenth, false).await.0, StatusCode::NOT_FOUND);
    assert!(
        reader
            .pinned()
            .await
            .iter()
            .any(|(place, _)| *place == tenth)
    );
    assert!(other.pinned().await.is_empty());
}
