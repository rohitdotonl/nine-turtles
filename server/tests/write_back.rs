//! Writing back (SPEC section 37, decision 0147): the address a feed gives
//! arrives with the sidebar's list, the reader's own wins and stays with
//! every place of the person, and it's the reader's alone. Tested against a
//! real running nine turtles and a made-up publisher: Alpha's blog names her
//! address, her letters don't, and Beta's notebook names none.

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

fn feed(file: &str) -> Response {
    let (title, editor) = match file {
        "alpha.xml" => (
            "Alpha's blog",
            "<managingEditor>alpha@alpha.example (Alpha)</managingEditor>",
        ),
        "alpha-news.xml" => ("Alpha's letters", ""),
        "beta.xml" => (
            "Beta's notebook",
            "<webMaster>host@host.example</webMaster>",
        ),
        _ => return StatusCode::NOT_FOUND.into_response(),
    };
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(
            r#"<?xml version="1.0"?><rss version="2.0"><channel><title>{title}</title>
            <link>https://alpha.example/</link>{editor}
            <item><title>{title} 1</title><guid>{file}-1</guid></item></channel></rss>"#
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
    async fn follow(&self, file: &str) -> i64 {
        let (status, added) = self
            .post(
                "/api/feeds",
                json!({ "address": format!("{}/{file}", self.publisher) }),
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

    /// Each followed place's (address the reader typed, address the feed gives).
    async fn addresses(&self, feed: i64) -> (Value, Value) {
        let response = Client::new()
            .get(format!("{}/api/feeds", self.base))
            .header("cookie", &self.cookie)
            .send()
            .await
            .unwrap();
        let listed: Value = serde_json::from_str(&response.text().await.unwrap()).unwrap();
        let place = listed["feeds"]
            .as_array()
            .unwrap()
            .iter()
            .find(|place| place["id"] == feed)
            .unwrap()
            .clone();
        (place["write_to"].clone(), place["email"].clone())
    }
}

#[tokio::test]
async fn the_feeds_address_arrives_and_the_readers_own_stays_with_the_person() {
    let (base, state) = common::start_with_state(common::config()).await;
    let reader = Reader {
        cookie: common::signed_in(&base).await,
        base,
        publisher: publisher().await,
    };
    let blog = reader.follow("alpha.xml").await;
    let letters = reader.follow("alpha-news.xml").await;
    let beta = reader.follow("beta.xml").await;

    // The editor's address arrives with the place; a webmaster's never does.
    assert_eq!(
        reader.addresses(blog).await,
        (Value::Null, json!("alpha@alpha.example"))
    );
    assert_eq!(reader.addresses(beta).await, (Value::Null, Value::Null));

    // Typed once for a person, it's kept on every place of theirs.
    let (status, joined) = reader
        .post("/api/writers/join", json!({ "feeds": [blog, letters] }))
        .await;
    assert_eq!(status, StatusCode::OK, "{joined}");
    let (status, _) = reader
        .post(
            &format!("/api/feeds/{letters}/write-to"),
            json!({ "address": " mailto:Alpha@Letters.Example " }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    for place in [blog, letters] {
        assert_eq!(
            reader.addresses(place).await.0,
            json!("Alpha@letters.example")
        );
    }
    assert_eq!(reader.addresses(beta).await.0, Value::Null);

    // Something that isn't one address is refused, and nothing changes.
    let (status, refusal) = reader
        .post(
            &format!("/api/feeds/{beta}/write-to"),
            json!({ "address": "beta@example.org, gamma@example.org" }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(refusal["error"], "not-an-address");
    assert_eq!(reader.addresses(beta).await.0, Value::Null);

    // Emptied, the reader's own goes and the feed's is used again.
    let (status, _) = reader
        .post(
            &format!("/api/feeds/{blog}/write-to"),
            json!({ "address": "" }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(
        reader.addresses(blog).await,
        (Value::Null, json!("alpha@alpha.example"))
    );
    assert_eq!(reader.addresses(letters).await.0, Value::Null);

    // Another reader can't keep an address on someone else's people.
    let (_, cookie) = common::another_reader(&state).await;
    let other = Reader {
        base: reader.base.clone(),
        cookie,
        publisher: reader.publisher.clone(),
    };
    let (status, _) = other
        .post(
            &format!("/api/feeds/{blog}/write-to"),
            json!({ "address": "someone@else.example" }),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(reader.addresses(blog).await.0, Value::Null);
}

#[tokio::test]
async fn a_place_that_leaves_its_person_leaves_their_address_until_undo() {
    let (base, _state) = common::start_with_state(common::config()).await;
    let reader = Reader {
        cookie: common::signed_in(&base).await,
        base,
        publisher: publisher().await,
    };
    let blog = reader.follow("alpha.xml").await;
    let letters = reader.follow("alpha-news.xml").await;
    let _ = reader
        .post("/api/writers/join", json!({ "feeds": [blog, letters] }))
        .await;
    let (status, _) = reader
        .post(
            &format!("/api/feeds/{blog}/write-to"),
            json!({ "address": "alpha@home.example" }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    // "… isn't the same person": the address was the person's, so it stays with them.
    let (status, separated) = reader
        .post("/api/writers/separate", json!({ "feed": letters }))
        .await;
    assert_eq!(status, StatusCode::OK, "{separated}");
    assert_eq!(reader.addresses(letters).await.0, Value::Null);
    assert_eq!(reader.addresses(blog).await.0, json!("alpha@home.example"));

    // Undo brings it back with the person.
    let (status, _) = reader
        .post(
            "/api/writers/put-back",
            json!({ "before": separated["before"] }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(
        reader.addresses(letters).await.0,
        json!("alpha@home.example")
    );
}
