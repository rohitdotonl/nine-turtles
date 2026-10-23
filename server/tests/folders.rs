//! Folders, editing feeds, unsubscribing with undo, and OPML import and
//! export (SPEC sections 15 and 16), tested against a real running slowfeed
//! and a made-up publisher with three small blogs.

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
use slowfeed::{AppState, checking, folders};

/// Three made-up blogs, `/alpha.xml`, `/beta.xml` and `/gamma.xml`, each
/// with three posts. Answers the publisher's address.
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
    let Some(name) = file.strip_suffix(".xml") else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let title = format!("{}{} blog", name[..1].to_uppercase(), &name[1..]);
    let items: String = (1..=3)
        .rev()
        .map(|number| {
            format!(
                "<item><title>{title} post {number}</title><guid>{name}-{number}</guid>\
                 <pubDate>0{number} Jan 2026 12:00:00 GMT</pubDate></item>"
            )
        })
        .collect();
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(
            r#"<?xml version="1.0"?><rss version="2.0"><channel><title>{title}</title>
            <link>https://{name}.example/</link>{items}</channel></rss>"#
        ),
    )
        .into_response()
}

struct Reader {
    base: String,
    cookie: String,
    state: AppState,
    publisher: String,
}

impl Reader {
    async fn new() -> Self {
        let (base, state) = common::start_with_state(common::config()).await;
        let cookie = common::signed_in(&base).await;
        Self {
            base,
            cookie,
            state,
            publisher: publisher().await,
        }
    }

    /// Follows one of the made-up blogs; answers its number.
    async fn follow(&self, name: &str) -> i64 {
        let (status, added) = self
            .post(
                "/api/feeds",
                json!({ "address": format!("{}/{name}.xml", self.publisher) }),
            )
            .await;
        assert_eq!(status, StatusCode::CREATED, "{added}");
        added["feed"]["id"].as_i64().unwrap()
    }

    async fn send(&self, path: &str, content_type: &str, body: String) -> (StatusCode, Value) {
        let response = Client::new()
            .post(format!("{}{path}", self.base))
            .header("cookie", &self.cookie)
            .header("sec-fetch-site", "same-origin")
            .header("content-type", content_type)
            .body(body)
            .send()
            .await
            .unwrap();
        let status = response.status();
        let text = response.text().await.unwrap();
        (status, serde_json::from_str(&text).unwrap_or(Value::Null))
    }

    async fn post(&self, path: &str, body: Value) -> (StatusCode, Value) {
        self.send(path, "application/json", body.to_string()).await
    }

    async fn get_text(&self, path: &str) -> reqwest::Response {
        let response = Client::new()
            .get(format!("{}{path}", self.base))
            .header("cookie", &self.cookie)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{path}");
        response
    }

    async fn get(&self, path: &str) -> Value {
        let text = self.get_text(path).await.text().await.unwrap();
        serde_json::from_str(&text).unwrap()
    }

    /// The sidebar: (feed title, unread, folder names), and folder names.
    async fn sidebar(&self) -> (Vec<(String, i64, Vec<String>)>, Vec<String>) {
        let listed = self.get("/api/feeds").await;
        let folders: Vec<(i64, String)> = listed["folders"]
            .as_array()
            .unwrap()
            .iter()
            .map(|folder| {
                (
                    folder["id"].as_i64().unwrap(),
                    folder["name"].as_str().unwrap().to_owned(),
                )
            })
            .collect();
        let name = |id: i64| folders.iter().find(|f| f.0 == id).unwrap().1.clone();
        let feeds = listed["feeds"]
            .as_array()
            .unwrap()
            .iter()
            .map(|feed| {
                let mut inside: Vec<String> = feed["folders"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|id| name(id.as_i64().unwrap()))
                    .collect();
                inside.sort();
                (
                    feed["title"].as_str().unwrap().to_owned(),
                    feed["unread"].as_i64().unwrap(),
                    inside,
                )
            })
            .collect();
        (feeds, folders.into_iter().map(|f| f.1).collect())
    }

    async fn folder_id(&self, name: &str) -> i64 {
        let listed = self.get("/api/feeds").await;
        listed["folders"]
            .as_array()
            .unwrap()
            .iter()
            .find(|folder| folder["name"] == name)
            .unwrap()["id"]
            .as_i64()
            .unwrap()
    }

    /// The titles in a list.
    async fn titles(&self, query: &str) -> Vec<String> {
        self.get(&format!("/api/articles?{query}")).await["articles"]
            .as_array()
            .unwrap()
            .iter()
            .map(|article| article["title"].as_str().unwrap().to_owned())
            .collect()
    }

    async fn article_ids(&self, query: &str) -> Vec<i64> {
        self.get(&format!("/api/articles?{query}")).await["articles"]
            .as_array()
            .unwrap()
            .iter()
            .map(|article| article["id"].as_i64().unwrap())
            .collect()
    }
}

fn row(title: &str, unread: i64, folders: &[&str]) -> (String, i64, Vec<String>) {
    (
        title.to_owned(),
        unread,
        folders.iter().map(|name| (*name).to_owned()).collect(),
    )
}

#[tokio::test]
async fn a_feed_in_two_folders_appears_in_both_and_folders_can_be_renamed_and_deleted() {
    let reader = Reader::new().await;
    let alpha = reader.follow("alpha").await;
    let beta = reader.follow("beta").await;

    // "Edit feed": a new name, and a new folder.
    let (status, _) = reader
        .post(
            &format!("/api/feeds/{alpha}"),
            json!({ "title": "  Alpha   renamed ", "folders": [], "new_folder": "Tech" }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let tech = reader.folder_id("Tech").await;
    // A second folder, made from "Edit feed" on the other feed, then Alpha
    // joins it too.
    reader
        .post(
            &format!("/api/feeds/{beta}"),
            json!({ "title": "Beta blog", "folders": [tech], "new_folder": "news" }),
        )
        .await;
    let news = reader.folder_id("news").await;
    reader
        .post(
            &format!("/api/feeds/{alpha}"),
            json!({ "title": "Alpha renamed", "folders": [tech, news] }),
        )
        .await;
    assert_eq!(
        reader.sidebar().await,
        (
            vec![
                row("Alpha renamed", 3, &["Tech", "news"]),
                row("Beta blog", 3, &["Tech", "news"]),
            ],
            // A to Z, whatever the capital letters.
            vec!["news".to_owned(), "Tech".to_owned()],
        )
    );

    // A folder lists its feeds' articles, newest first, each once.
    let in_tech = reader.titles(&format!("folder={tech}")).await;
    assert_eq!(in_tech.len(), 6);
    // Both blogs posted at the same moments; the later arrival comes first.
    assert_eq!(in_tech[..2], ["Beta blog post 3", "Alpha blog post 3"]);
    assert_eq!(
        reader.titles(&format!("folder={tech}&order=oldest")).await[0],
        "Alpha blog post 1"
    );
    let since = reader.get("/api/articles?view=all").await["latest"]
        .as_i64()
        .unwrap();
    let waiting = reader
        .get(&format!(
            "/api/articles/new?folder={tech}&since={}",
            since - 1
        ))
        .await;
    assert_eq!(waiting["new"], true);

    // A name can't be used twice, even in other capitals.
    let (status, answer) = reader
        .post(&format!("/api/folders/{news}"), json!({ "name": "TECH" }))
        .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(answer["folder_id"], tech);
    let (status, answer) = reader.post("/api/folders", json!({ "name": "tech" })).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(answer["folder_id"], tech);
    let (status, _) = reader
        .post(&format!("/api/folders/{news}"), json!({ "name": "   " }))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // Renamed: its new place in the alphabet.
    let (status, _) = reader
        .post(
            &format!("/api/folders/{news}"),
            json!({ "name": "World news" }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(
        reader.sidebar().await.1,
        ["Tech".to_owned(), "World news".to_owned()]
    );

    // Deleted: its feeds stay, in their other folder.
    let (status, _) = reader
        .post(&format!("/api/folders/{tech}/delete"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(
        reader.sidebar().await.0,
        [
            row("Alpha renamed", 3, &["World news"]),
            row("Beta blog", 3, &["World news"]),
        ]
    );
    // Undo: the folder again, with the same feeds.
    let (status, created) = reader
        .post(
            "/api/folders",
            json!({ "name": "Tech", "feeds": [alpha, beta] }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(created["folder"]["name"], "Tech");
    assert_eq!(
        reader.sidebar().await.0,
        [
            row("Alpha renamed", 3, &["Tech", "World news"]),
            row("Beta blog", 3, &["Tech", "World news"]),
        ]
    );
}

#[tokio::test]
async fn unsubscribing_hides_a_feed_undo_brings_it_back_and_stars_are_kept() {
    let reader = Reader::new().await;
    let alpha = reader.follow("alpha").await;
    reader.follow("beta").await;
    reader
        .post(
            &format!("/api/feeds/{alpha}"),
            json!({ "title": "Alpha blog", "folders": [], "new_folder": "Tech" }),
        )
        .await;
    let tech = reader.folder_id("Tech").await;
    let alpha_articles = reader.article_ids(&format!("feed={alpha}")).await;
    let (starred, read) = (alpha_articles[0], alpha_articles[1]);
    reader
        .post(
            "/api/articles/starred",
            json!({ "ids": [starred], "starred": true }),
        )
        .await;
    reader
        .post("/api/articles/read", json!({ "ids": [read], "read": true }))
        .await;

    // Unsubscribed: gone from the sidebar, Unread, All and its folder.
    let (status, _) = reader
        .post(&format!("/api/feeds/{alpha}/unsubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(reader.sidebar().await.0, [row("Beta blog", 3, &[])]);
    assert!(
        reader
            .titles("view=all")
            .await
            .iter()
            .all(|t| t.starts_with("Beta"))
    );
    assert!(
        reader
            .titles("view=unread")
            .await
            .iter()
            .all(|t| t.starts_with("Beta"))
    );
    assert!(reader.titles(&format!("folder={tech}")).await.is_empty());
    assert_eq!(reader.titles("view=starred").await, ["Alpha blog post 3"]);
    // And no longer checked in the background.
    let due: Vec<i64> = sqlx::query_scalar(checking::DUE)
        .bind(i64::MAX)
        .bind(100)
        .fetch_all(&reader.state.db)
        .await
        .unwrap();
    assert!(!due.contains(&alpha));

    // Undo: back whole, with its folder, star and read history.
    let (status, _) = reader
        .post(&format!("/api/feeds/{alpha}/resubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(
        reader.sidebar().await.0,
        [row("Alpha blog", 2, &["Tech"]), row("Beta blog", 3, &[])]
    );
    assert_eq!(reader.titles(&format!("folder={tech}")).await.len(), 3);

    // Unsubscribed again, and then (minutes later) cleared for good.
    reader
        .post(&format!("/api/feeds/{alpha}/unsubscribe"), json!({}))
        .await;
    let cleared = folders::clear_unsubscribed(&reader.state.db, i64::MAX)
        .await
        .unwrap();
    assert_eq!(cleared, 1);
    let (status, answer) = reader
        .post(&format!("/api/feeds/{alpha}/resubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(answer["error"], "too-late");
    // The starred article stays, readable, with its feed's name.
    assert_eq!(reader.titles("view=starred").await, ["Alpha blog post 3"]);
    let article = reader.get(&format!("/api/articles/{starred}")).await;
    assert_eq!(article["article"]["feed_title"], "Alpha blog");
    // And the starred export still has it, credited to its feed.
    let export = reader.get("/api/starred/export").await;
    assert_eq!(export["items"].as_array().unwrap().len(), 1);
    assert_eq!(export["items"][0]["title"], "Alpha blog post 3");
    assert_eq!(export["items"][0]["_slowfeed"]["feed_title"], "Alpha blog");
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM articles WHERE feed_id = ?")
        .bind(alpha)
        .fetch_one(&reader.state.db)
        .await
        .unwrap();
    assert_eq!(left, 1);
    // The folder itself stays, empty.
    assert_eq!(reader.sidebar().await.1, ["Tech".to_owned()]);

    // Following it again starts afresh: the starred article is joined by
    // the others, unread again, and no copy is made.
    assert_eq!(reader.follow("alpha").await, alpha);
    assert_eq!(
        reader.sidebar().await.0,
        [row("Alpha blog", 3, &[]), row("Beta blog", 3, &[])]
    );
    let titles = reader.titles(&format!("feed={alpha}")).await;
    assert_eq!(titles.len(), 3);
    assert_eq!(reader.titles("view=starred").await, ["Alpha blog post 3"]);
}

#[tokio::test]
async fn a_feed_unsubscribed_with_no_stars_is_removed_entirely() {
    let reader = Reader::new().await;
    let gamma = reader.follow("gamma").await;
    reader
        .post(&format!("/api/feeds/{gamma}/unsubscribe"), json!({}))
        .await;
    // Unsubscribing from another feed ends the first one's undo.
    let beta = reader.follow("beta").await;
    reader
        .post(&format!("/api/feeds/{beta}/unsubscribe"), json!({}))
        .await;
    let (status, _) = reader
        .post(&format!("/api/feeds/{gamma}/resubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::CONFLICT);
    let lines: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM feeds WHERE id = ?")
        .bind(gamma)
        .fetch_one(&reader.state.db)
        .await
        .unwrap();
    assert_eq!(lines, 0);
    // The second can still be undone.
    let (status, _) = reader
        .post(&format!("/api/feeds/{beta}/resubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn importing_opml_follows_each_feed_once_in_all_its_folders() {
    let reader = Reader::new().await;
    reader.follow("beta").await;
    let site = &reader.publisher;
    let file = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Made-up feeds</title></head>
  <body>
    <outline text="Tech">
      <outline type="rss" text="Alpha" xmlUrl="{site}/alpha.xml"/>
      <outline type="rss" text="Beta, already followed" xmlUrl="{site}/beta.xml"/>
    </outline>
    <outline text="Favourites">
      <outline type="rss" text="Alpha again" xmlUrl="{site}/alpha.xml#again"/>
      <outline type="rss" text="Broken" xmlUrl="not an address"/>
    </outline>
    <outline type="rss" text="Gamma" xmlUrl="{site}/gamma.xml" htmlUrl="https://gamma.example/"/>
  </body>
</opml>"#
    );
    let (status, answer) = reader.send("/api/opml", "text/x-opml", file.clone()).await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    assert_eq!(
        answer["summary"],
        json!({ "added": 2, "already": 1, "folders_added": 2, "unreadable": ["Broken"] })
    );
    // Listed straight away, with the file's names, before any fetching.
    assert_eq!(
        reader.sidebar().await.0,
        [
            row("Alpha", 0, &["Favourites", "Tech"]),
            row("Beta blog", 3, &["Tech"]),
            row("Gamma", 0, &[]),
        ]
    );

    // Background checking fetches them, a few at a time.
    let now = slowfeed::now();
    checking::round(&reader.state, now).await.unwrap();
    assert_eq!(
        reader.sidebar().await.0,
        [
            row("Alpha", 3, &["Favourites", "Tech"]),
            row("Beta blog", 3, &["Tech"]),
            row("Gamma", 3, &[]),
        ]
    );

    // Importing the same file again adds nothing.
    let (_, again) = reader.send("/api/opml", "text/x-opml", file).await;
    assert_eq!(again["summary"]["added"], 0);
    assert_eq!(again["summary"]["already"], 3);
    assert_eq!(again["summary"]["folders_added"], 0);

    // Not an OPML file: said plainly.
    let (status, answer) = reader
        .send("/api/opml", "text/plain", "hello".to_owned())
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(answer["error"], "not-opml");

    // Export: every feed, under each of its folders, as a download.
    let response = reader.get_text("/api/opml").await;
    assert!(
        response.headers()["content-disposition"]
            .to_str()
            .unwrap()
            .starts_with("attachment")
    );
    let exported = response.text().await.unwrap();
    let listed: Vec<_> = slowfeed::subscriptions::read(&exported)
        .unwrap()
        .into_iter()
        .map(|entry| (entry.name.unwrap(), entry.folder))
        .collect();
    let line = |name: &str, folder: Option<&str>| (name.to_owned(), folder.map(str::to_owned));
    assert_eq!(
        listed,
        [
            line("Alpha", Some("Favourites")),
            line("Alpha", Some("Tech")),
            line("Beta blog", Some("Tech")),
            line("Gamma", None),
        ]
    );
    // And it reads back into a fresh slowfeed the same.
    let fresh = Reader::new().await;
    let (_, answer) = fresh.send("/api/opml", "text/x-opml", exported).await;
    assert_eq!(answer["summary"]["added"], 3);
    assert_eq!(
        fresh.sidebar().await.0,
        [
            row("Alpha", 0, &["Favourites", "Tech"]),
            row("Beta blog", 0, &["Tech"]),
            row("Gamma", 0, &[]),
        ]
    );
}

#[tokio::test]
async fn background_rounds_clear_an_unsubscribed_feed_only_after_ten_minutes_and_never_after_undo()
{
    let reader = Reader::new().await;
    let alpha = reader.follow("alpha").await;
    let beta = reader.follow("beta").await;
    let feed_lines = async |id: i64| -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM feeds WHERE id = ?")
            .bind(id)
            .fetch_one(&reader.state.db)
            .await
            .unwrap()
    };
    reader
        .post(&format!("/api/feeds/{alpha}/unsubscribe"), json!({}))
        .await;
    let now = slowfeed::now();

    // Nine minutes later: still there, so Undo would still work.
    checking::round(&reader.state, now + 9 * 60).await.unwrap();
    assert_eq!(feed_lines(alpha).await, 1);
    // Eleven minutes later: gone for good (nothing starred kept it).
    checking::round(&reader.state, now + 11 * 60).await.unwrap();
    assert_eq!(feed_lines(alpha).await, 0);

    // Undo that arrives before the clean-up wins: clearing then leaves the
    // feed alone, even though it was listed as waiting.
    reader
        .post(&format!("/api/feeds/{beta}/unsubscribe"), json!({}))
        .await;
    reader
        .post(&format!("/api/feeds/{beta}/resubscribe"), json!({}))
        .await;
    let mut transaction = reader.state.db.begin().await.unwrap();
    assert!(!folders::clear(&mut transaction, beta).await.unwrap());
    transaction.commit().await.unwrap();
    assert_eq!(reader.titles(&format!("feed={beta}")).await.len(), 3);
}

#[tokio::test]
async fn article_numbers_freed_by_unsubscribing_are_never_given_again() {
    let reader = Reader::new().await;
    reader.follow("alpha").await;
    // The newest articles, with the highest numbers, belong to Beta.
    let beta = reader.follow("beta").await;
    let latest = reader.get("/api/articles?view=all").await["latest"]
        .as_i64()
        .unwrap();
    reader
        .post(&format!("/api/feeds/{beta}/unsubscribe"), json!({}))
        .await;
    folders::clear_unsubscribed(&reader.state.db, i64::MAX)
        .await
        .unwrap();
    // A list loaded now remembers `latest` from before; Gamma's articles
    // arrive after it and must count as new.
    let gamma = reader.follow("gamma").await;
    let numbers = reader.article_ids(&format!("feed={gamma}")).await;
    assert!(
        numbers.iter().all(|&id| id > latest),
        "{numbers:?} vs {latest}"
    );
    let waiting = reader
        .get(&format!("/api/articles/new?view=all&since={latest}"))
        .await;
    assert_eq!(waiting["new"], true);
}
