//! Unread, by person (SPEC section 6, decision 0271): people first, then
//! publications; each person once, with their places together, people by
//! their newest unread article (oldest, sorting oldest first); a page of 50
//! carries on from the person the last one ended in.

mod common;

use reqwest::{Client, StatusCode};
use serde_json::Value;

/// A made-up library on a fresh nine turtles, for its owner (reader 1).
struct Library {
    base: String,
    cookie: String,
    state: nine_turtles::AppState,
}

impl Library {
    async fn new() -> Self {
        let (base, state) = common::start_with_state(common::config()).await;
        let cookie = common::signed_in(&base).await;
        Self {
            base,
            cookie,
            state,
        }
    }

    /// Follows a made-up feed as `name`, a person or a publication (`kind`,
    /// with why; none for one not sorted yet), joined into `writer` if given.
    async fn follow(&self, feed: i64, name: &str, kind: Option<(&str, &str)>, writer: Option<i64>) {
        sqlx::query("INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (?, ?, ?, ?, 0)")
            .bind(feed)
            .bind(format!("https://site-{feed}.example/feed"))
            .bind(format!("site-{feed}.example/feed"))
            .bind(name)
            .execute(&self.state.db)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO subscriptions (person_id, feed_id, title, added_at, kind, kind_why, writer_id)
             VALUES (1, ?, ?, 0, ?, ?, ?)",
        )
        .bind(feed)
        .bind(name)
        .bind(kind.map(|(kind, _)| kind))
        .bind(kind.map(|(_, why)| why))
        .bind(writer)
        .execute(&self.state.db)
        .await
        .unwrap();
    }

    /// A person several places were joined into.
    async fn person(&self, writer: i64, name: &str) {
        sqlx::query("INSERT INTO writers (id, person_id, name, created_at) VALUES (?, 1, ?, 0)")
            .bind(writer)
            .bind(name)
            .execute(&self.state.db)
            .await
            .unwrap();
    }

    /// An article of `feed` published at `at`, unread unless `read`.
    async fn article(&self, feed: i64, title: &str, at: i64, read: bool) {
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO articles (feed_id, fingerprint, title, link, summary, received_at, sort_at)
             VALUES (?, ?, ?, ?, '', ?, ?) RETURNING id",
        )
        .bind(feed)
        .bind(format!("{feed}:{title}"))
        .bind(title)
        .bind(format!("https://site-{feed}.example/{at}"))
        .bind(at)
        .bind(at)
        .fetch_one(&self.state.db)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO entries (person_id, article_id, feed_id, sort_at, read) VALUES (1, ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(feed)
        .bind(at)
        .bind(read)
        .execute(&self.state.db)
        .await
        .unwrap();
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

    /// One page of Unread: its titles, and where the next starts.
    async fn page(&self, order: &str, after: Option<&str>) -> (Vec<String>, Option<String>) {
        let after = after.map_or(String::new(), |after| format!("&after={after}"));
        let page = self
            .get(&format!("/api/articles?view=unread&order={order}{after}"))
            .await;
        let titles = page["articles"]
            .as_array()
            .unwrap()
            .iter()
            .map(|article| article["title"].as_str().unwrap().to_owned())
            .collect();
        (titles, page["next"].as_str().map(str::to_owned))
    }
}

/// Ada (a blog and a podcast, joined), Bea (a place on its own, not sorted
/// yet, so a person, as the sidebar files her), Cy (a person); then a
/// publication, and one that could be either (with the publications until
/// the reader says, decision 0264). One more is unsubscribed from.
async fn library() -> Library {
    let library = Library::new().await;
    library.person(7, "Ada Byrne").await;
    library
        .follow(1, "Ada's blog", Some(("person", "reader")), Some(7))
        .await;
    library
        .follow(2, "Ada's podcast", Some(("person", "reader")), Some(7))
        .await;
    library.follow(3, "Bea Lund", None, None).await;
    library
        .follow(4, "Garden Letters", Some(("publication", "reader")), None)
        .await;
    library
        .follow(
            5,
            "Open Field",
            Some(("publication", "unsure-no-names")),
            None,
        )
        .await;
    library
        .follow(6, "Cy Moreau", Some(("person", "reader")), None)
        .await;
    library
        .follow(8, "Gone Away", Some(("person", "reader")), None)
        .await;
    sqlx::query("UPDATE subscriptions SET unsubscribed_at = 1 WHERE feed_id = 8")
        .execute(&library.state.db)
        .await
        .unwrap();
    for (feed, title, at, read) in [
        (1, "Ada 100", 100, false),
        (2, "Ada 95", 95, false),
        (1, "Ada 90", 90, false),
        (3, "Bea 110", 110, false),
        (3, "Bea 10", 10, false),
        (4, "Garden 200", 200, false),
        (4, "Garden 50", 50, false),
        (5, "Open 120", 120, false),
        (6, "Cy 80", 80, false),
        (6, "Cy 300, read", 300, true),
        (8, "Gone 500", 500, false),
    ] {
        library.article(feed, title, at, read).await;
    }
    library
}

#[tokio::test]
async fn people_come_first_each_once_by_their_newest_unread_then_publications() {
    let library = library().await;
    let (titles, next) = library.page("newest", None).await;
    assert_eq!(
        titles,
        [
            "Bea 110",
            "Bea 10",
            "Ada 100",
            "Ada 95",
            "Ada 90",
            "Cy 80",
            "Garden 200",
            "Garden 50",
            "Open 120"
        ]
    );
    assert_eq!(next, None);

    // Each article says whose it is and whether they're a publication, so
    // the screen can name each once; a joined person's places share one.
    let page = library.get("/api/articles?view=unread").await;
    let articles = page["articles"].as_array().unwrap();
    let whose = |index: usize| articles[index]["whose"].as_i64().unwrap();
    assert_eq!(whose(2), whose(3));
    assert_ne!(whose(1), whose(2));
    assert_eq!(articles[2]["feed_title"], "Ada Byrne");
    assert_eq!(articles[5]["publication"], false);
    assert_eq!(articles[6]["publication"], true);
    assert_eq!(articles[8]["publication"], true);
    // Every other list keeps its order by time, and says nothing of whose.
    let all = library.get("/api/articles?view=all").await;
    assert_eq!(all["articles"][0]["title"], "Cy 300, read");
    assert!(all["articles"][0].get("whose").is_none());
}

#[tokio::test]
async fn oldest_first_people_come_by_their_oldest_unread() {
    let library = library().await;
    let (titles, _) = library.page("oldest", None).await;
    assert_eq!(
        titles,
        [
            "Bea 10",
            "Bea 110",
            "Cy 80",
            "Ada 90",
            "Ada 95",
            "Ada 100",
            "Garden 50",
            "Garden 200",
            "Open 120"
        ]
    );
}

/// Dee, with 55 unread, the newest of all: her name carries on over the
/// 50 boundary, and the next page goes on from where she was.
async fn with_dee(library: &Library) {
    library
        .follow(9, "Dee Okafor", Some(("person", "reader")), None)
        .await;
    for number in 0..55 {
        library
            .article(9, &format!("Dee {number}"), 1000 + number, false)
            .await;
    }
}

#[tokio::test]
async fn a_person_who_crosses_a_page_carries_on_where_they_were() {
    let library = library().await;
    with_dee(&library).await;
    let (first, next) = library.page("newest", None).await;
    assert_eq!(first.len(), 50);
    assert_eq!(first[0], "Dee 54");
    assert_eq!(first[49], "Dee 5");
    let next = next.unwrap();

    // Reading the article that placed Dee, and new articles arriving, move
    // nobody on the next page: it lists what was there when the list loaded.
    sqlx::query("UPDATE entries SET read = 1 WHERE sort_at = 1054")
        .execute(&library.state.db)
        .await
        .unwrap();
    library.article(6, "Cy 5000, new", 5000, false).await;
    let (second, after) = library.page("newest", Some(&next)).await;
    assert_eq!(
        second,
        [
            "Dee 4",
            "Dee 3",
            "Dee 2",
            "Dee 1",
            "Dee 0",
            "Bea 110",
            "Bea 10",
            "Ada 100",
            "Ada 95",
            "Ada 90",
            "Cy 80",
            "Garden 200",
            "Garden 50",
            "Open 120"
        ]
    );
    assert_eq!(after, None);
}

#[tokio::test]
async fn oldest_first_a_person_who_crosses_a_page_carries_on_too() {
    let library = library().await;
    with_dee(&library).await;
    let (first, next) = library.page("oldest", None).await;
    // Dee's oldest unread is the newest of anyone's oldest: she comes last
    // of the people, and the page ends partway through her.
    assert_eq!(
        &first[..6],
        ["Bea 10", "Bea 110", "Cy 80", "Ada 90", "Ada 95", "Ada 100"]
    );
    assert_eq!(first[6], "Dee 0");
    assert_eq!(first[49], "Dee 43");
    let (second, after) = library.page("oldest", next.as_deref()).await;
    let mut expected: Vec<String> = (44..55).map(|number| format!("Dee {number}")).collect();
    expected.extend(["Garden 50", "Garden 200", "Open 120"].map(String::from));
    assert_eq!(second, expected);
    assert_eq!(after, None);
}

#[tokio::test]
async fn a_page_position_of_the_wrong_kind_is_refused() {
    let library = library().await;
    for query in [
        "view=unread&after=100:3",
        "view=all&after=100:3:0:110:3:9",
        "view=unread&after=1:2:3:4:5:6",
    ] {
        let response = Client::new()
            .get(format!("{}/api/articles?{query}", library.base))
            .header("cookie", &library.cookie)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{query}");
    }
}
