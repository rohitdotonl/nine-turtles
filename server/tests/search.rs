//! Search (SPEC section 14), tested against a real running slowfeed and two
//! made-up publishers: one writing in English, one in Hindi.

mod common;

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// Noon on day `day` of January 2026.
fn day(day: i64) -> i64 {
    1_767_225_600 + (day - 1) * 86_400 + 43_200
}

fn rss(title: &str, items: &[(&str, &str, &str, i64)]) -> impl IntoResponse + use<> {
    let mut xml = String::new();
    for (guid, item_title, body, on) in items {
        let date = format!("{:02} Jan 2026 12:00:00 GMT", on);
        // The body is HTML, written inside the feed as text.
        let body = body
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;");
        xml.push_str(&format!(
            "<item><title>{item_title}</title><guid>{guid}</guid><pubDate>{date}</pubDate>\
             <description>{body}</description></item>"
        ));
    }
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(
            r#"<?xml version="1.0"?><rss version="2.0"><channel><title>{title}</title>{xml}</channel></rss>"#
        ),
    )
}

async fn publishers() -> (String, String) {
    let app = Router::new()
        .route(
            "/garden.xml",
            get(|| async {
                rss(
                    "Garden Notes",
                    &[
                        ("g1", "Tomatoes in October", "<p>Late <b>gardening</b> notes.</p>", 3),
                        ("g2", "A quiet morning", "<p>The tomatoes ripened at last.</p>", 5),
                        ("g3", "Compost", "<p>Leaves, coffee and <a href=\"https://github.example/\">patience</a>.</p>", 7),
                        ("g4", "Café visits", "<p>Reading by the window.</p>", 9),
                    ],
                )
            }),
        )
        .route(
            "/kavita.xml",
            get(|| async {
                rss(
                    "हिंदी कविता",
                    &[
                        ("k1", "पुस्तकालय", "<p>शहर के पुराने पुस्तकालय में नई किताबें आई हैं।</p>", 4),
                        ("k2", "बारिश", "<p>आज मौसम बहुत सुहावना है।</p>", 6),
                    ],
                )
            }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (
        format!("http://{address}/garden.xml"),
        format!("http://{address}/kavita.xml"),
    )
}

struct Reader {
    base: String,
    cookie: String,
    state: slowfeed::AppState,
    garden: i64,
    kavita: i64,
}

impl Reader {
    async fn new() -> Self {
        let (base, state) = common::start_with_state(common::config()).await;
        let cookie = common::signed_in(&base).await;
        let mut reader = Self {
            base,
            cookie,
            state,
            garden: 0,
            kavita: 0,
        };
        let (garden, kavita) = publishers().await;
        reader.garden = reader.follow(&garden).await;
        reader.kavita = reader.follow(&kavita).await;
        reader
    }

    async fn follow(&self, address: &str) -> i64 {
        let (status, added) = self.post("/api/feeds", json!({ "address": address })).await;
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

    async fn search(&self, query: &[(&str, &str)]) -> (StatusCode, Value) {
        let address =
            reqwest::Url::parse_with_params(&format!("{}/api/search", self.base), query).unwrap();
        let response = Client::new()
            .get(address)
            .header("cookie", &self.cookie)
            .send()
            .await
            .unwrap();
        let status = response.status();
        let text = response.text().await.unwrap();
        (status, serde_json::from_str(&text).unwrap_or(Value::Null))
    }

    /// The titles found, in order.
    async fn titles(&self, query: &[(&str, &str)]) -> Vec<String> {
        let (status, body) = self.search(query).await;
        assert_eq!(status, StatusCode::OK, "{body}");
        body["articles"]
            .as_array()
            .unwrap()
            .iter()
            .map(|article| article["title"].as_str().unwrap().to_owned())
            .collect()
    }
}

#[tokio::test]
async fn words_are_found_in_titles_and_text_titles_first() {
    let reader = Reader::new().await;
    // "Tomatoes in October" has the word in its title, so it comes first,
    // though "A quiet morning" (the word only in its text) is newer.
    assert_eq!(
        reader.titles(&[("q", "tomatoes")]).await,
        ["Tomatoes in October", "A quiet morning"]
    );
    // A word finds longer words it starts, and words in bold are words too.
    assert_eq!(
        reader.titles(&[("q", "garden")]).await,
        ["Tomatoes in October"]
    );
    // Every word must appear.
    assert_eq!(
        reader.titles(&[("q", "tomatoes ripened")]).await,
        ["A quiet morning"]
    );
    // Words split by tags stay apart; tags and link addresses aren't words.
    assert!(reader.titles(&[("q", "github")]).await.is_empty());
    assert!(reader.titles(&[("q", "href")]).await.is_empty());
    // "cafe" finds "Café", and capitals don't matter.
    assert_eq!(reader.titles(&[("q", "CAFE")]).await, ["Café visits"]);
    // Quoted words are found together.
    assert_eq!(reader.titles(&[("q", "\"coffee and\"")]).await, ["Compost"]);
    assert!(reader.titles(&[("q", "\"and coffee\"")]).await.is_empty());
    // FTS5's own syntax is just words, never an error.
    assert!(
        reader
            .titles(&[("q", "NEAR(tomatoes OR *")])
            .await
            .is_empty()
    );
    // Nothing to search for finds nothing.
    assert!(reader.titles(&[("q", "  ")]).await.is_empty());
}

#[tokio::test]
async fn hindi_words_are_found_whole() {
    let reader = Reader::new().await;
    assert_eq!(reader.titles(&[("q", "किताबें")]).await, ["पुस्तकालय"]);
    assert_eq!(reader.titles(&[("q", "पुस्तकालय")]).await, ["पुस्तकालय"]);
    assert_eq!(reader.titles(&[("q", "मौसम")]).await, ["बारिश"]);
    // A word's beginning finds it, as in English; a piece from its middle,
    // after a vowel sign, doesn't: the word wasn't cut there.
    assert_eq!(reader.titles(&[("q", "किता")]).await, ["पुस्तकालय"]);
    assert!(reader.titles(&[("q", "ताबें")]).await.is_empty());
}

#[tokio::test]
async fn filters_narrow_the_results() {
    let reader = Reader::new().await;
    let garden = reader.garden.to_string();
    let kavita = reader.kavita.to_string();

    // One feed.
    assert_eq!(
        reader.titles(&[("q", "पुस्तकालय"), ("feed", &garden)]).await,
        Vec::<String>::new()
    );
    assert_eq!(
        reader.titles(&[("q", "पुस्तकालय"), ("feed", &kavita)]).await,
        ["पुस्तकालय"]
    );

    // One folder.
    let (status, _) = reader
        .post(
            "/api/folders",
            json!({ "name": "Poems", "feeds": [reader.kavita] }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let folder: i64 = sqlx::query_scalar("SELECT id FROM folders WHERE name = 'Poems'")
        .fetch_one(&reader.state.db)
        .await
        .unwrap();
    let folder = folder.to_string();
    assert_eq!(
        reader.titles(&[("folder", &folder)]).await,
        ["बारिश", "पुस्तकालय"]
    );
    assert!(
        reader
            .titles(&[("q", "tomatoes"), ("folder", &folder)])
            .await
            .is_empty()
    );

    // Starred only: filters alone, with no words, list everything that matches them.
    let compost: i64 = sqlx::query_scalar("SELECT id FROM articles WHERE title = 'Compost'")
        .fetch_one(&reader.state.db)
        .await
        .unwrap();
    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [compost], "starred": true }),
        )
        .await;
    assert_eq!(reader.titles(&[("starred", "true")]).await, ["Compost"]);

    // Unread only.
    let morning: i64 =
        sqlx::query_scalar("SELECT id FROM articles WHERE title = 'A quiet morning'")
            .fetch_one(&reader.state.db)
            .await
            .unwrap();
    reader
        .post(
            "/api/articles/read",
            json!({ "ids": [morning], "read": true }),
        )
        .await;
    assert_eq!(
        reader
            .titles(&[("q", "tomatoes"), ("unread", "true")])
            .await,
        ["Tomatoes in October"]
    );

    // A date range: from the start of 4 January, up to (not including) 7 January.
    let since = (day(4) - 43_200).to_string();
    let until = (day(7) - 43_200).to_string();
    assert_eq!(
        reader.titles(&[("since", &since), ("until", &until)]).await,
        ["बारिश", "A quiet morning", "पुस्तकालय"]
    );
    // Oldest first, when the reader's sort order says so.
    assert_eq!(
        reader
            .titles(&[("since", &since), ("until", &until), ("order", "oldest")])
            .await,
        ["पुस्तकालय", "A quiet morning", "बारिश"]
    );
}

#[tokio::test]
async fn results_come_fifty_at_a_time() {
    let reader = Reader::new().await;
    // 120 more articles mentioning tomatoes, 60 of them in the title.
    let mut connection = reader.state.db.acquire().await.unwrap();
    let articles: Vec<slowfeed::feed::ParsedArticle> = (0..120)
        .map(|number| slowfeed::feed::ParsedArticle {
            fingerprint: format!("extra-{number}"),
            title: if number % 2 == 0 {
                format!("Tomatoes {number}")
            } else {
                format!("Note {number}")
            },
            link: None,
            author: None,
            content: Some("<p>More tomatoes.</p>".to_owned()),
            summary: None,
            language: None,
            published_at: Some(day(10) + number),
        })
        .collect();
    slowfeed::feeds::store_articles(&mut connection, reader.garden, &articles, day(20))
        .await
        .unwrap();
    drop(connection);

    let mut seen: Vec<String> = Vec::new();
    let mut after: Option<String> = None;
    loop {
        let mut query = vec![("q", "tomatoes".to_owned())];
        if let Some(after) = &after {
            query.push(("after", after.clone()));
        }
        let query: Vec<(&str, &str)> = query
            .iter()
            .map(|(key, value)| (*key, value.as_str()))
            .collect();
        let (status, body) = reader.search(&query).await;
        assert_eq!(status, StatusCode::OK);
        let page = body["articles"].as_array().unwrap();
        assert!(page.len() <= 50);
        seen.extend(
            page.iter()
                .map(|article| article["title"].as_str().unwrap().to_owned()),
        );
        match body["next"].as_str() {
            Some(next) => after = Some(next.to_owned()),
            None => break,
        }
    }
    // Every result once: the 61 with the word in the title first, newest first.
    assert_eq!(seen.len(), 122);
    let mut unique = seen.clone();
    unique.sort();
    unique.dedup();
    assert_eq!(unique.len(), 122);
    assert_eq!(seen[0], "Tomatoes 118");
    assert_eq!(seen[59], "Tomatoes 0");
    assert_eq!(seen[60], "Tomatoes in October");
    assert_eq!(seen[61], "Note 119");
    assert_eq!(seen[121], "A quiet morning");

    // A page position that isn't one is refused.
    let (status, _) = reader.search(&[("q", "tomatoes"), ("after", "1:2")]).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn the_index_follows_edits_deletions_and_earlier_articles() {
    let reader = Reader::new().await;
    let db = &reader.state.db;

    // A publisher's edit replaces the article's words.
    let edited = slowfeed::feed::ParsedArticle {
        fingerprint: "id:g4".to_owned(),
        title: "Café visits".to_owned(),
        link: None,
        author: None,
        content: None,
        summary: Some("<p>Writing by the door.</p>".to_owned()),
        language: None,
        published_at: Some(day(9)),
    };
    let mut connection = db.acquire().await.unwrap();
    slowfeed::feeds::store_articles(&mut connection, reader.garden, &[edited], day(20))
        .await
        .unwrap();
    drop(connection);
    assert!(reader.titles(&[("q", "window")]).await.is_empty());
    assert_eq!(reader.titles(&[("q", "door")]).await, ["Café visits"]);

    // A deleted article leaves the index.
    sqlx::query("DELETE FROM articles WHERE title = 'Compost'")
        .execute(db)
        .await
        .unwrap();
    assert!(reader.titles(&[("q", "coffee")]).await.is_empty());
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM articles_search")
        .fetch_one(db)
        .await
        .unwrap();
    assert_eq!(left, 5);

    // An article stored before search existed is added when slowfeed starts.
    sqlx::query(
        "INSERT INTO articles (feed_id, fingerprint, title, content, received_at, sort_at)
         VALUES (?, 'old', 'An older post', '<p>Pumpkins.</p>', 1, 1)",
    )
    .bind(reader.garden)
    .execute(db)
    .await
    .unwrap();
    assert!(reader.titles(&[("q", "pumpkins")]).await.is_empty());
    assert_eq!(slowfeed::search::index_missing(db).await.unwrap(), 1);
    assert_eq!(reader.titles(&[("q", "pumpkins")]).await, ["An older post"]);
    assert_eq!(slowfeed::search::index_missing(db).await.unwrap(), 0);
}

#[tokio::test]
async fn unsubscribed_feeds_keep_only_their_starred_articles_in_search() {
    let reader = Reader::new().await;
    let compost: i64 = sqlx::query_scalar("SELECT id FROM articles WHERE title = 'Compost'")
        .fetch_one(&reader.state.db)
        .await
        .unwrap();
    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [compost], "starred": true }),
        )
        .await;
    let (status, _) = reader
        .post(
            &format!("/api/feeds/{}/unsubscribe", reader.garden),
            json!({}),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert!(reader.titles(&[("q", "tomatoes")]).await.is_empty());
    assert_eq!(reader.titles(&[("q", "coffee")]).await, ["Compost"]);
}

#[tokio::test]
async fn search_needs_signing_in() {
    let base = common::start(common::config()).await;
    let response = Client::new()
        .get(format!("{base}/api/search?q=tomatoes"))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn the_search_table_uses_the_tested_word_splitting() {
    let db = slowfeed::db::open(&common::config().data_dir)
        .await
        .unwrap();
    let sql: String =
        sqlx::query_scalar("SELECT sql FROM sqlite_master WHERE name = 'articles_search'")
            .fetch_one(&db)
            .await
            .unwrap();
    assert!(
        sql.contains(&format!(
            "tokenize = \"{}\"",
            slowfeed::search::FTS5_TOKENIZER
        )),
        "{sql}"
    );
}
