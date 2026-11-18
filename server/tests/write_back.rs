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
        let place = self.place(feed).await;
        (place["write_to"].clone(), place["email"].clone())
    }

    /// A followed place, as the sidebar gets it.
    async fn place(&self, feed: i64) -> Value {
        let response = Client::new()
            .get(format!("{}/api/feeds", self.base))
            .header("cookie", &self.cookie)
            .send()
            .await
            .unwrap();
        let listed: Value = serde_json::from_str(&response.text().await.unwrap()).unwrap();
        listed["feeds"]
            .as_array()
            .unwrap()
            .iter()
            .find(|place| place["id"] == feed)
            .unwrap()
            .clone()
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

#[tokio::test]
async fn write_back_is_switched_off_and_its_way_chosen_for_the_whole_person() {
    let (base, _state) = common::start_with_state(common::config()).await;
    let reader = Reader {
        cookie: common::signed_in(&base).await,
        base,
        publisher: publisher().await,
    };
    let blog = reader.follow("alpha.xml").await;
    let letters = reader.follow("alpha-news.xml").await;
    let beta = reader.follow("beta.xml").await;
    let _ = reader
        .post("/api/writers/join", json!({ "feeds": [blog, letters] }))
        .await;
    let way = async |feed| reader.place(feed).await["write_back_way"].clone();

    // The way chosen on one place is the person's: every place of theirs has it, no one else.
    let (status, _) = reader
        .post(
            &format!("/api/feeds/{letters}"),
            json!({ "write_back_way": "comment" }),
        )
        .await;
    assert!(status.is_success(), "{status}");
    assert_eq!(way(blog).await, json!("comment"));
    assert_eq!(way(letters).await, json!("comment"));
    assert_eq!(way(beta).await, Value::Null);

    // A way nine turtles doesn't know is refused, and nothing changes; email is the plain one.
    let (status, _) = reader
        .post(
            &format!("/api/feeds/{blog}"),
            json!({ "write_back_way": "fax" }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(way(blog).await, json!("comment"));
    let _ = reader
        .post(
            &format!("/api/feeds/{blog}"),
            json!({ "write_back_way": "copy" }),
        )
        .await;
    assert_eq!(way(letters).await, json!("copy"));

    // Switched off for the person: every place of theirs, and the way chosen stays for when it's back on.
    let _ = reader
        .post(
            &format!("/api/feeds/{blog}"),
            json!({ "write_back": false }),
        )
        .await;
    for place in [blog, letters] {
        assert_eq!(reader.place(place).await["write_back_off"], json!(true));
    }
    assert_eq!(reader.place(beta).await["write_back_off"], json!(false));
    let _ = reader
        .post(
            &format!("/api/feeds/{letters}"),
            json!({ "write_back": true }),
        )
        .await;
    assert_eq!(reader.place(blog).await["write_back_off"], json!(false));
    assert_eq!(way(blog).await, json!("copy"));

    // A source that leaves the person starts afresh; Undo gives it back the person's switch and way.
    let _ = reader
        .post(
            &format!("/api/feeds/{blog}"),
            json!({ "write_back": false }),
        )
        .await;
    let (status, separated) = reader
        .post("/api/writers/separate", json!({ "feed": letters }))
        .await;
    assert_eq!(status, StatusCode::OK, "{separated}");
    assert_eq!(way(letters).await, Value::Null);
    assert_eq!(reader.place(letters).await["write_back_off"], json!(false));
    assert_eq!(way(blog).await, json!("copy"));
    let (status, _) = reader
        .post(
            "/api/writers/put-back",
            json!({ "before": separated["before"] }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(way(letters).await, json!("copy"));
    assert_eq!(reader.place(letters).await["write_back_off"], json!(true));
    let _ = reader
        .post(&format!("/api/feeds/{blog}"), json!({ "write_back": true }))
        .await;

    // Back to email: nothing kept.
    let _ = reader
        .post(
            &format!("/api/feeds/{blog}"),
            json!({ "write_back_way": "email" }),
        )
        .await;
    assert_eq!(way(letters).await, Value::Null);
}

#[tokio::test]
async fn replies_started_are_listed_on_the_persons_page_and_are_the_readers_alone() {
    let (base, state) = common::start_with_state(common::config()).await;
    let reader = Reader {
        cookie: common::signed_in(&base).await,
        base: base.clone(),
        publisher: publisher().await,
    };
    let blog = reader.follow("alpha.xml").await;
    let letters = reader.follow("alpha-news.xml").await;
    let beta = reader.follow("beta.xml").await;
    let get = async |cookie: &str, path: String| {
        let response = Client::new()
            .get(format!("{base}{path}"))
            .header("cookie", cookie)
            .send()
            .await
            .unwrap();
        serde_json::from_str::<Value>(&response.text().await.unwrap()).unwrap()
    };
    let first = async |feed: i64| {
        get(&reader.cookie, format!("/api/articles?feed={feed}")).await["articles"][0]["id"]
            .as_i64()
            .unwrap()
    };
    let (on_blog, on_letters) = (first(blog).await, first(letters).await);
    // Alpha's two places are one person.
    let _ = reader
        .post("/api/writers/join", json!({ "feeds": [blog, letters] }))
        .await;
    let listed = async |cookie: &str, feed: i64| {
        get(cookie, format!("/api/feeds/{feed}/replies")).await["replies"]
            .as_array()
            .unwrap()
            .iter()
            .map(|reply| {
                (
                    reply["article"]["id"].as_i64().unwrap(),
                    reply["started_at"].as_i64().unwrap(),
                )
            })
            .collect::<Vec<_>>()
    };

    // A way back pressed on an article of each of Alpha's places: both are on Alpha's page, from either place, and not on Beta's.
    for article in [on_blog, on_letters, on_blog] {
        let (status, _) = reader
            .post(&format!("/api/articles/{article}/reply-started"), json!({}))
            .await;
        assert_eq!(status, StatusCode::NO_CONTENT);
    }
    let alpha = listed(&reader.cookie, letters).await;
    assert_eq!(alpha.len(), 2, "one line per article: {alpha:?}");
    assert_eq!(listed(&reader.cookie, blog).await, alpha);
    assert!(listed(&reader.cookie, beta).await.is_empty());

    // Removed, it's gone; Undo brings it back with the day it had, never a day later than now.
    let day = alpha.iter().find(|(id, _)| *id == on_blog).unwrap().1;
    let (status, _) = reader
        .post(
            &format!("/api/articles/{on_blog}/reply-started/delete"),
            json!({}),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(listed(&reader.cookie, blog).await.len(), 1);
    let _ = reader
        .post(
            &format!("/api/articles/{on_blog}/reply-started"),
            json!({ "at": day - 86_400 }),
        )
        .await;
    assert!(
        listed(&reader.cookie, blog)
            .await
            .contains(&(on_blog, day - 86_400))
    );

    // An article the reader doesn't have is refused.
    let (status, _) = reader
        .post("/api/articles/99999/reply-started", json!({}))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // Another reader who follows Alpha sees none of these, and can't note one on an article they don't have.
    let (_, other) = common::another_reader(&state).await;
    let theirs = Reader {
        cookie: other.clone(),
        base: base.clone(),
        publisher: reader.publisher.clone(),
    };
    let their_blog = theirs.follow("alpha.xml").await;
    assert!(listed(&other, their_blog).await.is_empty());
    let (status, _) = theirs
        .post(
            &format!("/api/articles/{on_letters}/reply-started"),
            json!({}),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "they don't follow Alpha's letters"
    );
    // Nor can they remove the first reader's line.
    let _ = theirs
        .post(
            &format!("/api/articles/{on_blog}/reply-started/delete"),
            json!({}),
        )
        .await;
    assert!(
        listed(&reader.cookie, blog)
            .await
            .contains(&(on_blog, day - 86_400))
    );

    // Switched off in Settings: the list is hidden and nothing new is noted; back on, what was kept is back.
    let _ = reader
        .post("/api/settings", json!({ "replies": false }))
        .await;
    assert_eq!(
        get(&reader.cookie, "/api/settings".to_owned()).await["replies"],
        json!(false)
    );
    assert!(listed(&reader.cookie, blog).await.is_empty());
    let _ = reader
        .post(
            &format!("/api/articles/{on_letters}/reply-started/delete"),
            json!({}),
        )
        .await;
    let _ = reader
        .post(
            &format!("/api/articles/{on_letters}/reply-started"),
            json!({}),
        )
        .await;
    let _ = reader
        .post("/api/settings", json!({ "replies": true }))
        .await;
    assert_eq!(
        listed(&reader.cookie, blog).await,
        vec![(on_blog, day - 86_400)]
    );
}
