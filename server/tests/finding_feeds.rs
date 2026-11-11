//! Finding a feed in a few more places, and choosing among a site's several
//! (SPEC section 3, decision 0165), tested against a real running nine
//! turtles and made-up publishers' websites that write down every address
//! asked for.

mod common;

use std::sync::{Arc, Mutex};

use axum::{
    Router,
    extract::State,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
    routing::get,
};
use reqwest::Client;
use serde_json::Value;

type Visits = Arc<Mutex<Vec<String>>>;

/// Serves `routes` (address, kind, body), anything else "not found", and
/// writes down each address asked for, in order.
async fn site(routes: &[(&'static str, &'static str, String)]) -> (String, Visits) {
    let visits: Visits = Arc::default();
    let mut app = Router::new();
    for (path, kind, body) in routes {
        let (kind, body) = (*kind, body.clone());
        app = app.route(
            path,
            get(move || async move {
                if kind == SLOW_DOWN {
                    return StatusCode::TOO_MANY_REQUESTS.into_response();
                }
                ([(header::CONTENT_TYPE, kind)], body).into_response()
            }),
        );
    }
    let app = app
        .fallback(|| async { StatusCode::NOT_FOUND })
        .layer(axum::middleware::from_fn_with_state(visits.clone(), visit));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (format!("http://{address}"), visits)
}

async fn visit(
    State(visits): State<Visits>,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Response {
    visits.lock().unwrap().push(request.uri().path().to_owned());
    next.run(request).await
}

const HTML: &str = "text/html";
const RSS: &str = "application/rss+xml";
const ATOM: &str = "application/atom+xml";
/// Not a kind: the site answers "too many requests, slow down".
const SLOW_DOWN: &str = "slow down";

fn page(links: &str) -> String {
    format!("<html><head><title>A page</title>{links}</head><body>Hello.</body></html>")
}

fn link(title: &str, href: &str) -> String {
    format!(r#"<link rel="alternate" type="application/rss+xml" title="{title}" href="{href}">"#)
}

/// A feed called `title` whose posts are `posts` (name, days ago). Two
/// feeds with the same posts are one feed in two formats.
fn feed(title: &str, posts: &[(&str, i64)]) -> String {
    let now = nine_turtles::now();
    let entries: String = posts
        .iter()
        .map(|(name, days)| {
            let date = nine_turtles::dates::rfc3339(now - days * 86_400);
            format!(
                r#"<entry><title>{name}</title><id>urn:{title}:{name}</id><updated>{date}</updated>
                <link href="https://maralind.example/{name}"/></entry>"#
            )
        })
        .collect();
    format!(
        r#"<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>{title}</title>
        <id>urn:{title}</id><updated>2026-01-01T00:00:00Z</updated>{entries}</feed>"#
    )
}

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

    async fn add(&self, address: &str) -> (StatusCode, Value) {
        let response = Client::new()
            .post(format!("{}/api/feeds", self.base))
            .header("cookie", &self.cookie)
            .header("sec-fetch-site", "same-origin")
            .header("content-type", "application/json")
            .body(serde_json::json!({ "address": address }).to_string())
            .send()
            .await
            .unwrap();
        let status = response.status();
        let text = response.text().await.unwrap();
        (status, serde_json::from_str(&text).unwrap_or(Value::Null))
    }
}

const POSTS: &[(&str, i64)] = &[
    ("river", 1),
    ("letters", 4),
    ("march", 8),
    ("frost", 11),
    ("hills", 15),
    ("tide", 18),
    ("swallows", 22),
    ("estuary", 25),
];

#[tokio::test]
async fn a_blog_inside_a_site_finds_its_own_feed_under_its_page_first() {
    let (base, visits) = site(&[
        ("/@mara/", HTML, page("")),
        ("/@mara/feed", RSS, feed("Mara Lind", POSTS)),
        ("/", HTML, page(&link("Everyone", "/all.xml"))),
    ])
    .await;
    let reader = Reader::new().await;
    let (status, body) = reader.add(&format!("{base}/@mara/")).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["feed"]["title"], "Mara Lind");
    assert_eq!(*visits.lock().unwrap(), ["/@mara/", "/@mara/feed"]);
}

#[tokio::test]
async fn a_page_naming_nothing_tries_the_home_page_then_the_usual_addresses() {
    let (base, visits) = site(&[
        ("/about/", HTML, page("")),
        ("/", HTML, page("")),
        ("/rss.xml", RSS, feed("Mara Lind", POSTS)),
    ])
    .await;
    let reader = Reader::new().await;
    let (status, body) = reader.add(&format!("{base}/about/")).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(
        *visits.lock().unwrap(),
        [
            "/about/",
            "/about/feed",
            "/",
            "/feed",
            "/feed.xml",
            "/rss",
            "/rss.xml"
        ]
    );
}

#[tokio::test]
async fn the_home_page_names_the_feed() {
    let (base, _) = site(&[
        ("/about.html", HTML, page("")),
        ("/", HTML, page(&link("Posts", "/posts.xml"))),
        ("/posts.xml", RSS, feed("Mara Lind", POSTS)),
    ])
    .await;
    let reader = Reader::new().await;
    let (status, body) = reader.add(&format!("{base}/about.html")).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["feed"]["title"], "Mara Lind");
}

#[tokio::test]
async fn nothing_anywhere_says_so_after_ten_addresses_at_most() {
    let (base, visits) = site(&[("/about/", HTML, page("")), ("/", HTML, page(""))]).await;
    let reader = Reader::new().await;
    let (status, body) = reader.add(&format!("{base}/about/")).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["error"], "no-feed");
    let visits = visits.lock().unwrap();
    assert!(visits.len() <= 11, "{visits:?}");
    assert_eq!(visits.iter().filter(|path| *path == "/about/").count(), 1);
}

#[tokio::test]
async fn several_feeds_say_what_they_posted_last() {
    let links = [
        link("Posts", "/feed"),
        link("Posts (Atom)", "/atom"),
        link("Notes", "/notes.xml"),
        link("Old podcast", "/gone.xml"),
    ]
    .concat();
    let notes: Vec<(&str, i64)> = vec![("swifts", 0), ("dillard", 1), ("library", 2), ("rain", 3)];
    let (base, visits) = site(&[
        ("/", HTML, page(&links)),
        ("/feed", RSS, feed("Mara Lind", POSTS)),
        ("/atom", ATOM, feed("Mara Lind", POSTS)),
        ("/notes.xml", RSS, feed("Notes", &notes)),
    ])
    .await;
    let reader = Reader::new().await;
    let (status, body) = reader.add(&base).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let choices = body["choices"].as_array().unwrap();
    // The Atom repeat and the feed that isn't there are left out.
    let titles: Vec<&str> = choices
        .iter()
        .map(|choice| choice["title"].as_str().unwrap())
        .collect();
    assert_eq!(titles, ["Posts", "Notes"]);
    assert_eq!(choices[0]["latest"], "river");
    assert_eq!(choices[1]["latest"], "swifts");
    assert!(
        choices[1]["place"]
            .as_str()
            .unwrap()
            .ends_with("/notes.xml")
    );
    assert!(!choices[1]["place"].as_str().unwrap().contains("://"));

    // Following the chosen one uses the look just taken: the publisher
    // isn't asked again.
    let asked = visits.lock().unwrap().len();
    let (status, body) = reader.add(choices[1]["url"].as_str().unwrap()).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["feed"]["title"], "Notes");
    assert_eq!(visits.lock().unwrap().len(), asked);
}

#[tokio::test]
async fn a_site_left_with_one_feed_follows_it_without_asking() {
    let links = [link("Posts", "/feed"), link("Posts (Atom)", "/atom")].concat();
    let (base, visits) = site(&[
        ("/", HTML, page(&links)),
        ("/feed", RSS, feed("Mara Lind", POSTS)),
        ("/atom", ATOM, feed("Mara Lind", POSTS)),
    ])
    .await;
    let reader = Reader::new().await;
    let (status, body) = reader.add(&base).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["feed"]["title"], "Mara Lind");
    assert_eq!(*visits.lock().unwrap(), ["/", "/feed", "/atom"]);
}

#[tokio::test]
async fn a_site_that_asks_to_slow_down_isnt_asked_again_or_called_feedless() {
    let (base, visits) = site(&[
        ("/about/", HTML, page("")),
        ("/about/feed", SLOW_DOWN, String::new()),
        ("/feed", RSS, feed("Mara Lind", POSTS)),
    ])
    .await;
    let reader = Reader::new().await;
    let (status, body) = reader.add(&format!("{base}/about/")).await;
    assert_eq!(status, StatusCode::BAD_GATEWAY, "{body}");
    assert_eq!(*visits.lock().unwrap(), ["/about/", "/about/feed"]);
}

#[tokio::test]
async fn a_blogs_comments_feed_isnt_offered_beside_its_posts() {
    // Decision 0261: a WordPress blog names both; nobody follows a blog for its comments.
    let links = [
        link("Mara Lind » Feed", "/feed/"),
        link("Mara Lind » Comments Feed", "/comments/feed/"),
    ]
    .concat();
    let (base, visits) = site(&[
        ("/", HTML, page(&links)),
        ("/feed/", RSS, feed("Mara Lind", POSTS)),
    ])
    .await;
    let reader = Reader::new().await;
    let (status, body) = reader.add(&base).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(*visits.lock().unwrap(), ["/", "/feed/"]);
}

#[tokio::test]
async fn a_usual_address_too_big_to_read_is_said_as_that_not_as_no_feed() {
    // Decision 0261: over the size limit, the feed is there; "no feed" would send the reader to ask for one.
    let huge = "x".repeat(11 * 1024 * 1024);
    let (base, _) = site(&[("/", HTML, page("")), ("/atom.xml", ATOM, huge)]).await;
    let reader = Reader::new().await;
    let (status, body) = reader.add(&base).await;
    assert_ne!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["error"], "too-big", "{body}");
}
