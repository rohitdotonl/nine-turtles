//! People and publications (SPEC section 36): joining places into one
//! person, their one list, a person or publication for each place, "This is
//! one person" on a folder, and Undo for each, tested against a real running
//! nine turtles and a made-up publisher. Alpha has a blog and a newsletter
//! on one website; Beta is someone else; the Gazette has several writers;
//! Tomas Berg signs every article of his blog, "Notes from Tomas".

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
    let (title, site, day) = match file {
        "alpha.xml" => ("Alpha's blog", "https://alpha.example/", 1),
        "alpha-news.xml" => ("Alpha's letters", "https://www.alpha.example/news", 2),
        "beta.xml" => ("Beta's notebook", "https://beta.example/", 3),
        "gamma.xml" => ("Gamma's pictures", "https://gamma.example/", 4),
        "gazette.xml" => ("The Gazette", "https://gazette.example/", 5),
        "tomas.xml" => ("Notes from Tomas", "https://tomas.example/", 6),
        _ => return StatusCode::NOT_FOUND.into_response(),
    };
    let items: String = (1..=3)
        .map(|number| {
            // The Gazette's articles each have a writer of their own; Tomas signs all of his.
            let by = match file {
                "gazette.xml" => format!("<dc:creator>Writer {number}</dc:creator>"),
                "tomas.xml" => "<dc:creator>Tomas Berg</dc:creator>".to_owned(),
                _ => String::new(),
            };
            format!(
                "<item><title>{title} {number}</title><guid>{file}-{number}</guid>{by}\
                 <pubDate>{number}{day} Jan 2026 12:00:00 GMT</pubDate></item>"
            )
        })
        .collect();
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(
            r#"<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>{title}</title>
            <link>{site}</link>{items}</channel></rss>"#
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
    async fn new() -> (Self, nine_turtles::AppState) {
        let (base, state) = common::start_with_state(common::config()).await;
        let cookie = common::signed_in(&base).await;
        let reader = Self {
            base,
            cookie,
            publisher: publisher().await,
        };
        (reader, state)
    }

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

    async fn get(&self, path: &str) -> Value {
        let response = Client::new()
            .get(format!("{}{path}", self.base))
            .header("cookie", &self.cookie)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{path}");
        serde_json::from_str(&response.text().await.unwrap()).unwrap()
    }

    /// The sidebar's people, as (name, their places' numbers).
    async fn people(&self) -> Vec<(String, Vec<i64>)> {
        let listed = self.get("/api/feeds").await;
        listed["people"]
            .as_array()
            .unwrap()
            .iter()
            .map(|person| {
                let id = person["id"].as_i64().unwrap();
                let places = listed["feeds"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .filter(|feed| feed["person"].as_i64() == Some(id))
                    .map(|feed| feed["id"].as_i64().unwrap())
                    .collect();
                (person["name"].as_str().unwrap().to_owned(), places)
            })
            .collect()
    }

    /// One followed feed, as the sidebar has it.
    async fn feed(&self, id: i64) -> Value {
        let listed = self.get("/api/feeds").await;
        listed["feeds"]
            .as_array()
            .unwrap()
            .iter()
            .find(|each| each["id"].as_i64() == Some(id))
            .unwrap()
            .clone()
    }

    /// One feed's folders, by number.
    async fn folders_of(&self, feed: i64) -> Vec<i64> {
        let listed = self.get("/api/feeds").await;
        let found = listed["feeds"]
            .as_array()
            .unwrap()
            .iter()
            .find(|each| each["id"].as_i64() == Some(feed))
            .unwrap()
            .clone();
        found["folders"]
            .as_array()
            .unwrap()
            .iter()
            .map(|id| id.as_i64().unwrap())
            .collect()
    }

    /// A list's articles, as (title, the name shown for who made it).
    async fn list(&self, query: &str) -> Vec<(String, String)> {
        self.get(&format!("/api/articles?{query}")).await["articles"]
            .as_array()
            .unwrap()
            .iter()
            .map(|article| {
                (
                    article["title"].as_str().unwrap().to_owned(),
                    article["feed_title"].as_str().unwrap().to_owned(),
                )
            })
            .collect()
    }
}

#[tokio::test]
async fn joined_places_are_one_person_with_one_list_until_undo() {
    let (reader, state) = Reader::new().await;
    let blog = reader.follow("alpha.xml").await;
    let letters = reader.follow("alpha-news.xml").await;
    let beta = reader.follow("beta.xml").await;
    let (status, made) = reader
        .post(
            "/api/folders",
            json!({ "name": "Friends", "feeds": [blog] }),
        )
        .await;
    assert!(status.is_success(), "{made}");
    let friends = made["folder"]["id"].as_i64().unwrap();

    // Places on their own: no people yet, and each place lists only its own.
    assert!(reader.people().await.is_empty());
    assert_eq!(reader.list(&format!("feed={blog}")).await.len(), 3);

    let (status, joined) = reader
        .post(
            "/api/writers/join",
            json!({ "feeds": [blog, letters], "name": "Alpha" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{joined}");
    assert_eq!(
        reader.people().await,
        [("Alpha".to_owned(), vec![blog, letters])]
    );
    // Both places are now in the folder either was in.
    assert_eq!(reader.folders_of(letters).await, [friends]);

    // Either place's list is the person's: all six, newest first, each
    // credited to the person.
    let listed = reader.list(&format!("feed={letters}")).await;
    assert_eq!(listed.len(), 6);
    assert!(listed.iter().all(|(_, who)| who == "Alpha"));
    assert_eq!(listed[0].0, "Alpha's letters 3");
    // Someone on their own is still credited by their own name.
    let all = reader.list("view=all").await;
    assert!(all.iter().any(|(_, who)| who == "Beta's notebook"));
    // Searching in a place looks in all of the person's places.
    let found = reader
        .get(&format!("/api/search?q=Alpha&feed={blog}"))
        .await;
    assert_eq!(found["articles"].as_array().unwrap().len(), 6, "{found}");
    // Marking the place's list read (an assistant's mark_feed_read) marks
    // the person's six, and nobody else's.
    let marked = nine_turtles::marks::whole_feed(&state.db, 1, blog)
        .await
        .unwrap();
    assert_eq!(marked, 6);
    assert_eq!(reader.list("view=unread").await.len(), 3);

    // Renaming the person (Edit person on any of their places) renames them everywhere.
    let (status, _) = reader
        .post(
            &format!("/api/feeds/{blog}"),
            json!({ "title": "Alpha Ray", "folders": [friends] }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(reader.people().await[0].0, "Alpha Ray");
    assert!(
        reader
            .list(&format!("feed={blog}"))
            .await
            .iter()
            .all(|(_, who)| who == "Alpha Ray")
    );

    // Undo: both places are on their own again, in their old folders.
    let (status, _) = reader
        .post(
            "/api/writers/put-back",
            json!({ "before": joined["before"] }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert!(reader.people().await.is_empty());
    assert_eq!(reader.folders_of(letters).await, Vec::<i64>::new());
    assert_eq!(reader.folders_of(blog).await, [friends]);
    assert_eq!(reader.list(&format!("feed={blog}")).await.len(), 3);
    assert_eq!(reader.list(&format!("feed={beta}")).await.len(), 3);
}

#[tokio::test]
async fn adding_another_place_to_a_person_and_separating_it_again() {
    let (reader, _state) = Reader::new().await;
    let blog = reader.follow("alpha.xml").await;
    let letters = reader.follow("alpha-news.xml").await;
    let beta = reader.follow("beta.xml").await;
    let (_, joined) = reader
        .post("/api/writers/join", json!({ "feeds": [blog, letters] }))
        .await;
    // With no name given, the person takes the first place's.
    assert_eq!(
        reader.people().await,
        [("Alpha's blog".to_owned(), vec![blog, letters])]
    );
    // Edit person on either place names the person and files all their places.
    let (_, made) = reader
        .post("/api/folders", json!({ "name": "Later", "feeds": [] }))
        .await;
    let later = made["folder"]["id"].as_i64().unwrap();
    let (status, _) = reader
        .post(
            &format!("/api/feeds/{letters}"),
            json!({ "title": "Alpha", "folders": [later] }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(reader.people().await[0].0, "Alpha");
    assert_eq!(reader.folders_of(blog).await, [later]);
    // Adding a third place joins the same person, whichever place is named.
    let (_, added) = reader
        .post("/api/writers/join", json!({ "feeds": [letters, beta] }))
        .await;
    assert_eq!(added["writer"], joined["writer"]);
    assert_eq!(reader.people().await[0].1, [blog, letters, beta]);

    // "Not the same person": Beta stands alone again; Undo puts it back.
    let (status, separated) = reader
        .post("/api/writers/separate", json!({ "feed": beta }))
        .await;
    assert_eq!(status, StatusCode::OK, "{separated}");
    assert_eq!(reader.people().await[0].1, [blog, letters]);
    reader
        .post(
            "/api/writers/put-back",
            json!({ "before": separated["before"] }),
        )
        .await;
    assert_eq!(reader.people().await[0].1, [blog, letters, beta]);

    // A person's last place can't be separated from nobody.
    reader
        .post("/api/writers/separate", json!({ "feed": beta }))
        .await;
    reader
        .post("/api/writers/separate", json!({ "feed": letters }))
        .await;
    let (status, _) = reader
        .post("/api/writers/separate", json!({ "feed": blog }))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    // Their one place still lists only its own articles, under their name.
    let listed = reader.list(&format!("feed={blog}")).await;
    assert_eq!(listed.len(), 3);
    assert!(listed.iter().all(|(_, who)| who == "Alpha"));
}

#[tokio::test]
async fn each_place_is_a_person_or_a_publication_and_the_reader_can_change_it() {
    let (reader, _state) = Reader::new().await;
    // Guessed as it's added: one blog of someone's own, and a paper with several writers.
    let (_, added) = reader
        .post(
            "/api/feeds",
            json!({ "address": format!("{}/gazette.xml", reader.publisher) }),
        )
        .await;
    assert_eq!(added["feed"]["kind"], "publication", "{added}");
    assert_eq!(added["feed"]["place"], "blog");
    let gazette = added["feed"]["id"].as_i64().unwrap();
    let blog = reader.follow("alpha.xml").await;
    assert_eq!(reader.feed(blog).await["kind"], "person");
    // The reader changes their minds, and corrects what kind of source it is, without touching its name or folders.
    let (status, _) = reader
        .post(
            &format!("/api/feeds/{gazette}"),
            json!({ "kind": "person", "place": "newsletter" }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let changed = reader.feed(gazette).await;
    assert_eq!(changed["kind"], "person");
    assert_eq!(changed["place"], "newsletter");
    assert_eq!(changed["title"], "The Gazette");
    // A place joined to someone is always a person's; taken out, it's guessed afresh.
    let (_, _) = reader
        .post(
            &format!("/api/feeds/{gazette}"),
            json!({ "kind": "publication" }),
        )
        .await;
    reader
        .post("/api/writers/join", json!({ "feeds": [blog, gazette] }))
        .await;
    assert_eq!(reader.feed(gazette).await["kind"], "person");
    reader
        .post("/api/writers/separate", json!({ "feed": gazette }))
        .await;
    assert_eq!(reader.feed(gazette).await["kind"], "publication");
}

#[tokio::test]
async fn a_person_whose_feed_names_one_author_is_called_by_that_name() {
    let (reader, _state) = Reader::new().await;
    let (_, added) = reader
        .post(
            "/api/feeds",
            json!({ "address": format!("{}/tomas.xml", reader.publisher) }),
        )
        .await;
    // Called by his name, with the blog's own title beside it for his page.
    assert_eq!(added["feed"]["kind"], "person", "{added}");
    assert_eq!(added["feed"]["title"], "Tomas Berg");
    assert_eq!(added["feed"]["site_title"], "Notes from Tomas");
    let tomas = added["feed"]["id"].as_i64().unwrap();
    let listed = reader.feed(tomas).await;
    assert_eq!(listed["title"], "Tomas Berg");
    assert_eq!(listed["site_title"], "Notes from Tomas");
    // A blog that signs nothing keeps its title; so does one with several writers.
    let blog = reader.follow("alpha.xml").await;
    assert_eq!(reader.feed(blog).await["title"], "Alpha's blog");
    let gazette = reader.follow("gazette.xml").await;
    assert_eq!(reader.feed(gazette).await["title"], "The Gazette");
    // A name the reader gives stays, the next time the sidebar loads too.
    reader
        .post(&format!("/api/feeds/{tomas}"), json!({ "title": "Tom" }))
        .await;
    assert_eq!(reader.feed(tomas).await["title"], "Tom");
}

#[tokio::test]
async fn joining_puts_every_source_in_the_folders_the_reader_chose() {
    let (reader, _state) = Reader::new().await;
    let blog = reader.follow("alpha.xml").await;
    let letters = reader.follow("alpha-news.xml").await;
    let (_, friends) = reader
        .post(
            "/api/folders",
            json!({ "name": "Friends", "feeds": [blog] }),
        )
        .await;
    let (_, news) = reader
        .post(
            "/api/folders",
            json!({ "name": "News", "feeds": [letters] }),
        )
        .await;
    let friends = friends["folder"]["id"].as_i64().unwrap();
    let news = news["folder"]["id"].as_i64().unwrap();
    let (status, joined) = reader
        .post(
            "/api/writers/join",
            json!({ "feeds": [blog, letters], "folders": [friends] }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{joined}");
    assert_eq!(reader.folders_of(blog).await, [friends]);
    assert_eq!(reader.folders_of(letters).await, [friends]);
    // Undo puts each back in its own folder.
    reader
        .post(
            "/api/writers/put-back",
            json!({ "before": joined["before"] }),
        )
        .await;
    assert_eq!(reader.folders_of(letters).await, [news]);
}

#[tokio::test]
async fn unsubscribing_from_a_person_leaves_every_source_and_undo_brings_them_back() {
    let (reader, _state) = Reader::new().await;
    let blog = reader.follow("alpha.xml").await;
    let letters = reader.follow("alpha-news.xml").await;
    let beta = reader.follow("beta.xml").await;
    reader
        .post(
            "/api/writers/join",
            json!({ "feeds": [blog, letters], "name": "Alpha" }),
        )
        .await;
    let (status, left) = reader
        .post("/api/writers/unsubscribe", json!({ "feed": letters }))
        .await;
    assert_eq!(status, StatusCode::OK, "{left}");
    assert_eq!(left["feeds"], json!([blog, letters]));
    let listed = reader.get("/api/feeds").await;
    let ids: Vec<i64> = listed["feeds"]
        .as_array()
        .unwrap()
        .iter()
        .map(|feed| feed["id"].as_i64().unwrap())
        .collect();
    assert_eq!(ids, [beta]);
    for feed in [blog, letters] {
        let (status, _) = reader
            .post(&format!("/api/feeds/{feed}/resubscribe"), json!({}))
            .await;
        assert_eq!(status, StatusCode::NO_CONTENT);
    }
    assert_eq!(
        reader.people().await,
        [("Alpha".to_owned(), vec![blog, letters])]
    );
}

#[tokio::test]
async fn a_folder_of_one_persons_places_becomes_that_person_with_undo() {
    let (reader, _state) = Reader::new().await;
    let blog = reader.follow("alpha.xml").await;
    let letters = reader.follow("alpha-news.xml").await;
    let (_, made) = reader
        .post(
            "/api/folders",
            json!({ "name": "Alpha", "feeds": [blog, letters] }),
        )
        .await;
    let folder = made["folder"]["id"].as_i64().unwrap();
    let (status, person) = reader
        .post(&format!("/api/folders/{folder}/person"), json!({}))
        .await;
    assert_eq!(status, StatusCode::OK, "{person}");
    assert_eq!(
        reader.people().await,
        [("Alpha".to_owned(), vec![blog, letters])]
    );
    // The folder is gone; its places are in no folder.
    let listed = reader.get("/api/feeds").await;
    assert!(listed["folders"].as_array().unwrap().is_empty());
    assert_eq!(reader.folders_of(blog).await, Vec::<i64>::new());

    // Undo, as the screen does it: the places on their own, then the folder.
    reader
        .post(
            "/api/writers/put-back",
            json!({ "before": person["before"] }),
        )
        .await;
    let (status, _) = reader
        .post(
            "/api/folders",
            json!({ "name": "Alpha", "feeds": [blog, letters], "rules": person["rules"], "searches": person["searches"] }),
        )
        .await;
    assert!(status.is_success());
    assert!(reader.people().await.is_empty());
    assert_eq!(reader.folders_of(blog).await.len(), 1);
    assert_eq!(reader.folders_of(letters).await.len(), 1);
}

#[tokio::test]
async fn another_reader_cannot_touch_someones_people() {
    let (reader, state) = Reader::new().await;
    let blog = reader.follow("alpha.xml").await;
    let letters = reader.follow("alpha-news.xml").await;
    let _ = reader
        .post("/api/writers/join", json!({ "feeds": [blog, letters] }))
        .await;
    let (_, cookie) = common::another_reader(&state).await;
    let other = Reader {
        base: reader.base.clone(),
        cookie,
        publisher: reader.publisher.clone(),
    };
    let (status, _) = other
        .post(
            &format!("/api/feeds/{blog}"),
            json!({ "title": "Mine", "folders": [] }),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = other
        .post("/api/writers/join", json!({ "feeds": [blog, letters] }))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = other
        .post("/api/writers/separate", json!({ "feed": blog }))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    // Putting back someone else's places changes nothing of theirs.
    let (status, _) = other
        .post(
            "/api/writers/put-back",
            json!({ "before": [{ "feed": blog, "writer": null, "folders": [] }] }),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(reader.people().await[0].1, [blog, letters]);
    assert!(other.people().await.is_empty());
}

#[tokio::test]
async fn undo_gives_people_back_the_names_and_places_a_join_took() {
    let (reader, _state) = Reader::new().await;
    let blog = reader.follow("alpha.xml").await;
    let letters = reader.follow("alpha-news.xml").await;
    let beta = reader.follow("beta.xml").await;
    let (status, _) = reader
        .post(
            "/api/writers/join",
            json!({ "feeds": [blog, letters], "name": "Alpha" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let (_, made) = reader
        .post(
            "/api/folders",
            json!({ "name": "Friends", "feeds": [letters, beta] }),
        )
        .await;
    let folder = made["folder"]["id"].as_i64().unwrap();

    // The folder takes Alpha in, under its own name.
    let (status, person) = reader
        .post(&format!("/api/folders/{folder}/person"), json!({}))
        .await;
    assert_eq!(status, StatusCode::OK, "{person}");
    assert_eq!(
        reader.people().await,
        [("Friends".to_owned(), vec![blog, letters, beta])]
    );

    // Undo: Alpha has their name and their two places again; Beta stands on its own.
    reader
        .post(
            "/api/writers/put-back",
            json!({ "before": person["before"] }),
        )
        .await;
    assert_eq!(
        reader.people().await,
        [("Alpha".to_owned(), vec![blog, letters])]
    );

    // A join that merges one person into another: Undo brings the merged one back by name.
    let gamma = reader.follow("gamma.xml").await;
    let (_, second) = reader
        .post(
            "/api/writers/join",
            json!({ "feeds": [beta, gamma], "name": "Beta" }),
        )
        .await;
    assert_eq!(reader.people().await.len(), 2, "{second}");
    let (_, merged) = reader
        .post("/api/writers/join", json!({ "feeds": [blog, beta] }))
        .await;
    assert_eq!(
        reader.people().await,
        [("Alpha".to_owned(), vec![blog, letters, beta, gamma])]
    );
    reader
        .post(
            "/api/writers/put-back",
            json!({ "before": merged["before"] }),
        )
        .await;
    assert_eq!(
        reader.people().await,
        [
            ("Alpha".to_owned(), vec![blog, letters]),
            ("Beta".to_owned(), vec![beta, gamma])
        ]
    );
}

#[tokio::test]
async fn an_imported_feed_is_guessed_once_it_has_been_fetched() {
    let (reader, state) = Reader::new().await;
    let file = format!(
        r#"<?xml version="1.0"?><opml version="2.0"><body>
        <outline type="rss" text="The Gazette" xmlUrl="{}/gazette.xml"/></body></opml>"#,
        reader.publisher
    );
    let response = Client::new()
        .post(format!("{}/api/opml", reader.base))
        .header("cookie", &reader.cookie)
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "text/x-opml")
        .body(file)
        .send()
        .await
        .unwrap();
    assert!(response.status().is_success(), "{}", response.status());
    let gazette: i64 = sqlx::query_scalar("SELECT id FROM feeds WHERE url LIKE '%gazette.xml'")
        .fetch_one(&state.db)
        .await
        .unwrap();
    // As if the sidebar loads before its first check (the import may already
    // have checked it): nothing is kept as a guess yet, so its writers, once
    // seen, make it a publication.
    sqlx::query("UPDATE feeds SET fetched_at = NULL WHERE id = ?")
        .bind(gazette)
        .execute(&state.db)
        .await
        .unwrap();
    sqlx::query("UPDATE subscriptions SET kind = NULL, place = NULL WHERE feed_id = ?")
        .bind(gazette)
        .execute(&state.db)
        .await
        .unwrap();
    sqlx::query("DELETE FROM articles WHERE feed_id = ?")
        .bind(gazette)
        .execute(&state.db)
        .await
        .unwrap();
    reader.get("/api/feeds").await;
    let kept: Option<String> =
        sqlx::query_scalar("SELECT kind FROM subscriptions WHERE feed_id = ?")
            .bind(gazette)
            .fetch_one(&state.db)
            .await
            .unwrap();
    assert_eq!(kept, None, "guessed before it was fetched");
    nine_turtles::checking::check(&state, gazette, nine_turtles::now())
        .await
        .unwrap();
    assert_eq!(reader.feed(gazette).await["kind"], "publication");
}

#[tokio::test]
async fn an_imported_person_is_named_after_their_first_check_unless_the_reader_named_them() {
    let (reader, state) = Reader::new().await;
    // One feed under its own title; the same kind of feed under a name the reader gave in another app.
    let file = format!(
        r#"<?xml version="1.0"?><opml version="2.0"><body>
        <outline type="rss" text="Notes from Tomas" xmlUrl="{0}/tomas.xml"/>
        <outline type="rss" text="My old friend" xmlUrl="{0}/tomas.xml?again"/></body></opml>"#,
        reader.publisher
    );
    let response = Client::new()
        .post(format!("{}/api/opml", reader.base))
        .header("cookie", &reader.cookie)
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "text/x-opml")
        .body(file)
        .send()
        .await
        .unwrap();
    assert!(response.status().is_success(), "{}", response.status());
    let feeds: Vec<i64> = sqlx::query_scalar("SELECT id FROM feeds ORDER BY id")
        .fetch_all(&state.db)
        .await
        .unwrap();
    for feed in &feeds {
        nine_turtles::checking::check(&state, *feed, nine_turtles::now())
            .await
            .unwrap();
    }
    let mut names = Vec::new();
    for feed in &feeds {
        let listed = reader.feed(*feed).await;
        // The publisher's own title, fresh from the check, never the reader's label.
        assert_eq!(listed["site_title"], "Notes from Tomas");
        names.push(listed["title"].as_str().unwrap().to_owned());
    }
    names.sort();
    assert_eq!(names, ["My old friend", "Tomas Berg"]);
}
