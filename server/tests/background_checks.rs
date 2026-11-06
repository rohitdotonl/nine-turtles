//! Checking feeds in the background, politely (SPEC sections 11 and 13),
//! tested against a real nine turtles and a made-up publisher whose feeds change
//! when a test says so. Each test runs background checking itself, at times
//! of its choosing, so nothing waits for a real clock.

mod common;

use std::sync::{Arc, Mutex};

use axum::{
    Router,
    extract::State,
    http::{HeaderMap, StatusCode, Uri, header},
    response::{IntoResponse, Redirect, Response},
};
use nine_turtles::{
    AppState,
    checking::{self, DAY, HOUR, MINUTE, SHORTEST_WAIT},
};
use reqwest::Client;
use serde_json::{Value, json};

/// What the made-up publisher serves, and every request it was sent.
#[derive(Default)]
struct Site {
    /// When the test started. Post 3 was published one gap before, post 4
    /// at this time, and so on.
    started: i64,
    /// How many articles the growing feeds have.
    articles: u32,
    /// The publisher has edited the newest article.
    edited: bool,
    /// What /flaky.xml answers instead of its feed, with a Retry-After.
    trouble: Option<(StatusCode, Option<String>)>,
    /// /moving.xml has moved to /new-home.xml for good.
    moved: bool,
    /// Requests being answered right now, and the most there ever were.
    answering: u32,
    most_at_once: u32,
    requests: Vec<Request>,
}

#[derive(Clone, Debug)]
struct Request {
    path: String,
    agent: String,
    if_none_match: Option<String>,
    if_modified_since: Option<String>,
}

type Shared = Arc<Mutex<Site>>;

const LAST_MODIFIED: &str = "Wed, 21 Oct 2026 07:28:00 GMT";

async fn publisher() -> (String, Shared) {
    let site: Shared = Arc::new(Mutex::new(Site {
        started: nine_turtles::now(),
        articles: 3,
        ..Site::default()
    }));
    let app = Router::new().fallback(serve).with_state(site.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (format!("http://{address}"), site)
}

async fn serve(State(site): State<Shared>, uri: Uri, headers: HeaderMap) -> Response {
    let text = |name| {
        headers
            .get(name)
            .and_then(|value: &header::HeaderValue| value.to_str().ok())
            .map(str::to_owned)
    };
    // Each answer takes a moment, so overlapping requests would show.
    {
        let mut site = site.lock().unwrap();
        site.answering += 1;
        site.most_at_once = site.most_at_once.max(site.answering);
    }
    tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    let mut site = site.lock().unwrap();
    site.answering -= 1;
    let path = uri.path().to_owned();
    site.requests.push(Request {
        path: path.clone(),
        agent: text(header::USER_AGENT).unwrap_or_default(),
        if_none_match: text(header::IF_NONE_MATCH),
        if_modified_since: text(header::IF_MODIFIED_SINCE),
    });

    if path == "/flaky.xml"
        && let Some((status, retry_after)) = site.trouble.clone()
    {
        let mut response = status.into_response();
        if let Some(wait) = retry_after {
            response
                .headers_mut()
                .insert(header::RETRY_AFTER, wait.parse().unwrap());
        }
        return response;
    }
    if path == "/moving.xml" && site.moved {
        return Redirect::permanent("/new-home.xml").into_response();
    }
    if path == "/daily.xml" {
        return rss(&site, "Daily", 3, DAY, None);
    }
    if path == "/cached.xml" {
        // "The same for three hours", on a feed that posts hourly.
        let mut response = rss(&site, "Cached", site.articles, HOUR, None);
        response.headers_mut().insert(
            header::CACHE_CONTROL,
            "public, max-age=10800".parse().unwrap(),
        );
        return response;
    }
    let known = path.starts_with("/many/")
        || ["/grow.xml", "/flaky.xml", "/moving.xml", "/new-home.xml"].contains(&path.as_str());
    if !known {
        return StatusCode::NOT_FOUND.into_response();
    }
    let etag = format!("\"v{}-{}\"", site.articles, site.edited);
    if text(header::IF_NONE_MATCH).as_deref() == Some(etag.as_str()) {
        return StatusCode::NOT_MODIFIED.into_response();
    }
    rss(&site, "Growing", site.articles, HOUR, Some(etag))
}

/// A feed of `count` articles, one every `gap` seconds, newest first.
fn rss(site: &Site, title: &str, count: u32, gap: i64, etag: Option<String>) -> Response {
    let mut items = String::new();
    for number in (1..=count).rev() {
        let at = site.started + (i64::from(number) - 4) * gap;
        let (name, words) = if number == count && site.edited {
            (format!("Post {number}, corrected"), "Better words.")
        } else {
            (format!("Post {number}"), "Words.")
        };
        items.push_str(&format!(
            "<item><title>{name}</title><link>https://growing.example/{number}</link>\
             <guid>post-{number}</guid><pubDate>{}</pubDate>\
             <description>&lt;p&gt;{words}&lt;/p&gt;</description></item>",
            rfc2822(at)
        ));
    }
    let body = format!(
        r#"<?xml version="1.0"?><rss version="2.0"><channel><title>{title}</title>
        <link>https://growing.example/</link>{items}</channel></rss>"#
    );
    let mut response = ([(header::CONTENT_TYPE, "application/rss+xml")], body).into_response();
    if let Some(etag) = etag {
        let headers = response.headers_mut();
        headers.insert(header::ETAG, etag.parse().unwrap());
        headers.insert(header::LAST_MODIFIED, LAST_MODIFIED.parse().unwrap());
    }
    response
}

/// Seconds since 1970 as an RSS date (Howard Hinnant's calendar method).
fn rfc2822(at: i64) -> String {
    const MONTHS: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    let days = at.div_euclid(86_400);
    let seconds = at.rem_euclid(86_400);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    format!(
        "{day:02} {} {year} {:02}:{:02}:{:02} GMT",
        MONTHS[usize::try_from(month - 1).unwrap()],
        seconds / 3600,
        seconds % 3600 / 60,
        seconds % 60
    )
}

struct Reader {
    base: String,
    cookie: String,
    state: AppState,
    site: String,
    published: Shared,
}

impl Reader {
    async fn new() -> Self {
        let (base, state) = common::start_with_state(common::config()).await;
        let cookie = common::signed_in(&base).await;
        let (site, published) = publisher().await;
        Self {
            base,
            cookie,
            state,
            site,
            published,
        }
    }

    /// Follows one of the publisher's feeds; returns its ID.
    async fn follow(&self, path: &str) -> i64 {
        let (status, added) = self
            .post(
                "/api/feeds",
                json!({ "address": format!("{}{path}", self.site) }),
            )
            .await;
        assert_eq!(status, StatusCode::CREATED, "{added}");
        added["feed"]["id"].as_i64().unwrap()
    }

    async fn post(&self, path: &str, body: Value) -> (StatusCode, Value) {
        self.send(&self.cookie, path, "application/json", body.to_string())
            .await
    }

    /// Sends `body` to `path` as the reader signed in with `cookie`.
    async fn send(
        &self,
        cookie: &str,
        path: &str,
        content_type: &str,
        body: String,
    ) -> (StatusCode, Value) {
        let response = Client::new()
            .post(format!("{}{path}", self.base))
            .header("cookie", cookie)
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

    async fn titles(&self, query: &str) -> Vec<String> {
        self.get(&format!("/api/articles?{query}")).await["articles"]
            .as_array()
            .unwrap()
            .iter()
            .map(|article| article["title"].as_str().unwrap().to_owned())
            .collect()
    }

    /// Runs one round of background checking as if it were `at`.
    async fn round(&self, at: i64) -> usize {
        checking::round(&self.state, at).await.unwrap()
    }

    async fn feed_column(&self, id: i64, column: &str) -> Option<i64> {
        sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
            "SELECT {column} FROM feeds WHERE id = ?"
        )))
        .bind(id)
        .fetch_one(&self.state.db)
        .await
        .unwrap()
    }

    fn requests(&self) -> Vec<Request> {
        self.published.lock().unwrap().requests.clone()
    }

    fn change(&self, change: impl FnOnce(&mut Site)) {
        change(&mut self.published.lock().unwrap());
    }
}

#[tokio::test]
async fn an_unchanged_feed_is_asked_politely_and_costs_almost_nothing() {
    let reader = Reader::new().await;
    let feed = reader.follow("/grow.xml").await;
    let asked_before = reader.requests().len();

    let later = nine_turtles::now() + DAY;
    assert_eq!(reader.round(later).await, 1);
    let requests = reader.requests();
    let check = &requests[asked_before];
    assert_eq!(check.path, "/grow.xml");
    assert!(check.agent.starts_with("nine-turtles/"), "{}", check.agent);
    // "This is what I have": the publisher answers "nothing new" in a few bytes.
    assert_eq!(check.if_none_match.as_deref(), Some("\"v3-false\""));
    assert_eq!(check.if_modified_since.as_deref(), Some(LAST_MODIFIED));
    assert_eq!(reader.titles("").await.len(), 3);
    assert_eq!(reader.feed_column(feed, "fetched_at").await, Some(later));
    assert_eq!(reader.feed_column(feed, "failures").await, Some(0));
    // Only the feed file was ever fetched, never an article's page.
    assert!(requests.iter().all(|request| request.path == "/grow.xml"));
}

#[tokio::test]
async fn new_articles_arrive_on_their_own_and_the_list_waits_to_be_asked() {
    let reader = Reader::new().await;
    let feed = reader.follow("/grow.xml").await;
    let other = reader.follow("/daily.xml").await;
    let latest = reader.get("/api/articles?view=unread").await["latest"]
        .as_i64()
        .unwrap();
    let waiting = |query: String| {
        let reader = &reader;
        async move {
            reader
                .get(&format!("/api/articles/new?since={latest}&{query}"))
                .await["new"]
                .clone()
        }
    };
    assert_eq!(waiting("view=unread".into()).await, false);

    reader.change(|site| site.articles = 5);
    reader.round(nine_turtles::now() + DAY).await;

    // The list on screen can say "New items", without a number.
    assert_eq!(waiting("view=unread".into()).await, true);
    assert_eq!(waiting("view=all".into()).await, true);
    assert_eq!(waiting(format!("feed={feed}")).await, true);
    assert_eq!(waiting(format!("feed={other}")).await, false);
    assert_eq!(waiting("view=starred".into()).await, false);
    // Loading the list again (the reader pressed r) shows them.
    let fresh = reader.get(&format!("/api/articles?feed={feed}")).await;
    let titles: Vec<&str> = fresh["articles"]
        .as_array()
        .unwrap()
        .iter()
        .map(|article| article["title"].as_str().unwrap())
        .collect();
    assert_eq!(titles, ["Post 5", "Post 4", "Post 3", "Post 2", "Post 1"]);
    assert!(fresh["latest"].as_i64().unwrap() > latest);
    let feeds = reader.get("/api/feeds").await;
    let unread = feeds["feeds"]
        .as_array()
        .unwrap()
        .iter()
        .find(|each| each["id"] == feed)
        .unwrap()["unread"]
        .clone();
    assert_eq!(unread, 5);
}

#[tokio::test]
async fn following_someone_brings_only_their_newest_five_into_unread() {
    let reader = Reader::new().await;
    reader.change(|site| {
        site.articles = 12;
        site.started -= DAY;
    });
    let feed = reader.follow("/grow.xml").await;
    assert_eq!(
        reader.titles("view=unread").await,
        ["Post 12", "Post 11", "Post 10", "Post 9", "Post 8"]
    );
    // The older ones are kept in their own list, already read.
    assert_eq!(reader.titles(&format!("feed={feed}")).await.len(), 12);

    // Everything they post afterwards arrives unread, however much.
    reader.change(|site| site.articles = 20);
    reader.round(nine_turtles::now() + DAY).await;
    assert_eq!(reader.titles("view=unread").await.len(), 13);
}

#[tokio::test]
async fn a_muted_post_does_not_take_one_of_the_five() {
    let reader = Reader::new().await;
    reader.change(|site| {
        site.articles = 12;
        site.started -= DAY;
    });
    let (status, made) = reader
        .post("/api/rules", json!({ "words": "Post 12" }))
        .await;
    assert_eq!(status, StatusCode::OK, "{made}");
    reader.follow("/grow.xml").await;
    assert_eq!(
        reader.titles("view=unread").await,
        ["Post 11", "Post 10", "Post 9", "Post 8", "Post 7"]
    );
}

#[tokio::test]
async fn another_readers_import_leaves_a_reader_waiting_for_undo_as_they_were() {
    let reader = Reader::new().await;
    reader.change(|site| site.started -= DAY);
    let feed = reader.follow("/many/kept.xml").await;
    // Seven more arrive, all unread: ten in all.
    reader.change(|site| site.articles = 10);
    reader.round(nine_turtles::now() + DAY).await;
    assert_eq!(reader.titles("view=unread").await.len(), 10);
    let (status, _) = reader
        .post(&format!("/api/feeds/{feed}/unsubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    // Someone else brings the same feed in from a file, and it's checked.
    let (_, other) = common::another_reader(&reader.state).await;
    let file = format!(
        r#"<?xml version="1.0"?><opml version="2.0"><body>
        <outline text="Kept" type="rss" xmlUrl="{}/many/kept.xml"/></body></opml>"#,
        reader.site
    );
    let (status, _) = reader.send(&other, "/api/opml", "text/x-opml", file).await;
    assert_eq!(status, StatusCode::OK);
    reader.round(nine_turtles::now() + MINUTE).await;

    // Undo brings the first reader's feed back whole, all ten unread.
    let (status, _) = reader
        .post(&format!("/api/feeds/{feed}/resubscribe"), json!({}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(reader.titles("view=unread").await.len(), 10);
}

#[tokio::test]
async fn a_file_of_feeds_brings_only_each_ones_newest_five_into_unread() {
    let reader = Reader::new().await;
    reader.change(|site| {
        site.articles = 12;
        site.started -= DAY;
    });
    // Another reader already follows one of the file's feeds, so it's stored.
    let (_, other) = common::another_reader(&reader.state).await;
    let address = |name: &str| format!("{}/many/{name}.xml", reader.site);
    let body = json!({ "address": address("shared") }).to_string();
    let (status, _) = reader
        .send(&other, "/api/feeds", "application/json", body)
        .await;
    assert_eq!(status, StatusCode::CREATED);

    let file = format!(
        r#"<?xml version="1.0"?><opml version="2.0"><head><title>Mine</title></head><body>
        <outline text="Shared" type="rss" xmlUrl="{}"/>
        <outline text="New" type="rss" xmlUrl="{}"/></body></opml>"#,
        address("shared"),
        address("new")
    );
    let (status, answer) = reader
        .send(&reader.cookie, "/api/opml", "text/x-opml", file)
        .await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    // The stored one straight away; the new one at its first check.
    assert_eq!(reader.titles("view=unread").await.len(), 5);
    reader.round(nine_turtles::now() + MINUTE).await;
    let feeds = reader.get("/api/feeds").await;
    let unread: Vec<i64> = feeds["feeds"]
        .as_array()
        .unwrap()
        .iter()
        .map(|feed| feed["unread"].as_i64().unwrap())
        .collect();
    assert_eq!(unread, [5, 5]);
    assert_eq!(reader.titles("view=all").await.len(), 24);
}

#[tokio::test]
async fn each_feed_is_checked_on_its_own_rhythm_never_more_than_hourly() {
    let reader = Reader::new().await;
    let hourly = reader.follow("/grow.xml").await;
    let daily = reader.follow("/daily.xml").await;
    let added = nine_turtles::now();

    // An article every hour: every hour. Every day: about twice a day.
    assert_eq!(
        reader.feed_column(hourly, "check_every").await,
        Some(SHORTEST_WAIT)
    );
    assert_eq!(
        reader.feed_column(daily, "check_every").await,
        Some(12 * HOUR)
    );
    let next_daily = reader.feed_column(daily, "next_check_at").await.unwrap();
    assert!(
        (added + 10 * HOUR..=added + 14 * HOUR).contains(&next_daily),
        "{next_daily}"
    );

    // Ten minutes later, nothing is due.
    let asked = reader.requests().len();
    assert_eq!(reader.round(added + 10 * MINUTE).await, 0);
    assert_eq!(reader.requests().len(), asked);
    // An hour later (and the nudge of up to a tenth), only the hourly feed is.
    let hour_on = added + HOUR + 7 * MINUTE;
    assert_eq!(reader.round(hour_on).await, 1);
    assert_eq!(reader.requests().last().unwrap().path, "/grow.xml");
    // And the round just done doesn't make it due again at once.
    assert_eq!(reader.round(hour_on + MINUTE).await, 0);
}

#[tokio::test]
async fn a_publisher_who_says_how_long_its_feed_stays_the_same_is_believed() {
    let reader = Reader::new().await;
    let cached = reader.follow("/cached.xml").await;
    // An hourly feed would be asked again within the hour; this one said
    // three hours, so it waits three.
    let at = nine_turtles::now() + HOUR + 7 * MINUTE;
    assert_eq!(reader.round(at).await, 1);
    let next = reader.feed_column(cached, "next_check_at").await.unwrap();
    assert!(next >= at + 3 * HOUR, "{}", next - at);
    assert!(next <= at + 3 * HOUR + 20 * MINUTE, "{}", next - at);
}

#[tokio::test]
async fn checks_are_spread_out_never_all_at_once() {
    let reader = Reader::new().await;
    for number in 0..25 {
        reader.follow(&format!("/many/{number}.xml")).await;
    }
    let later = nine_turtles::now() + DAY;
    // At most 20 feeds in a round; the rest wait for the next one.
    assert_eq!(reader.round(later).await, 20);
    assert_eq!(reader.round(later).await, 5);
    assert_eq!(reader.round(later).await, 0);
    // They're all on one site, so they took turns: one request at a time.
    assert_eq!(reader.published.lock().unwrap().most_at_once, 1);
    // Feeds added together drift apart.
    let times: std::collections::HashSet<i64> =
        sqlx::query_scalar("SELECT next_check_at FROM feeds")
            .fetch_all(&reader.state.db)
            .await
            .unwrap()
            .into_iter()
            .collect();
    assert!(times.len() > 1, "{times:?}");
}

#[tokio::test]
async fn a_publisher_who_asks_to_slow_down_gets_the_wait_they_asked_for() {
    let reader = Reader::new().await;
    let feed = reader.follow("/flaky.xml").await;

    let first = nine_turtles::now() + DAY;
    reader.change(|site| {
        site.trouble = Some((StatusCode::TOO_MANY_REQUESTS, Some((3 * DAY).to_string())));
    });
    reader.round(first).await;
    assert_eq!(
        reader.feed_column(feed, "next_check_at").await,
        Some(first + 3 * DAY)
    );

    // Asked for a month: a week at most, so a mistake can't silence a feed for good.
    reader.change(|site| {
        site.trouble = Some((
            StatusCode::SERVICE_UNAVAILABLE,
            Some((30 * DAY).to_string()),
        ));
    });
    let second = first + 3 * DAY;
    reader.round(second).await;
    assert_eq!(
        reader.feed_column(feed, "next_check_at").await,
        Some(second + 7 * DAY)
    );
}

#[tokio::test]
async fn a_failing_feed_is_tried_less_and_less_and_never_holds_up_the_others() {
    let reader = Reader::new().await;
    let flaky = reader.follow("/flaky.xml").await;
    let working = reader.follow("/many/1.xml").await;
    reader.change(|site| site.trouble = Some((StatusCode::INTERNAL_SERVER_ERROR, None)));

    // Each failure in a row doubles the wait (from the feed's hour), up to a day.
    let mut at = nine_turtles::now() + DAY;
    let mut waits = Vec::new();
    for _ in 0..7 {
        reader.round(at).await;
        let next = reader.feed_column(flaky, "next_check_at").await.unwrap();
        waits.push(next - at);
        at = next;
    }
    assert_eq!(
        waits,
        [2 * HOUR, 4 * HOUR, 8 * HOUR, 16 * HOUR, DAY, DAY, DAY]
    );
    assert_eq!(reader.feed_column(flaky, "failures").await, Some(7));
    // The working feed was checked all along.
    assert_eq!(reader.feed_column(working, "failures").await, Some(0));
    assert!(reader.feed_column(working, "fetched_at").await.unwrap() > nine_turtles::now());

    // It's counted, never named: three days of failing is "keeps failing".
    let started = reader.feed_column(flaky, "failing_since").await.unwrap();
    let health = checking::health(&reader.state.db, started + 3 * DAY)
        .await
        .unwrap();
    assert_eq!(
        (
            health.feeds_followed,
            health.feeds_failing,
            health.feeds_failing_for_days,
            health.feeds_dead
        ),
        (2, 1, 1, 0)
    );
    let health = checking::health(&reader.state.db, started + 21 * DAY)
        .await
        .unwrap();
    assert_eq!(health.feeds_dead, 1);

    // Working again: everything is forgiven.
    reader.change(|site| site.trouble = None);
    reader.round(at).await;
    assert_eq!(reader.feed_column(flaky, "failures").await, Some(0));
    assert_eq!(reader.feed_column(flaky, "failing_since").await, None);
}

#[tokio::test]
async fn a_feed_not_found_for_a_week_counts_as_dead_and_is_still_checked_daily() {
    let reader = Reader::new().await;
    let feed = reader.follow("/flaky.xml").await;
    reader.change(|site| site.trouble = Some((StatusCode::NOT_FOUND, None)));
    let mut at = nine_turtles::now() + DAY;
    let first = at;
    while at < first + 8 * DAY {
        reader.round(at).await;
        at = reader.feed_column(feed, "next_check_at").await.unwrap();
    }
    assert_eq!(reader.feed_column(feed, "missing_since").await, Some(first));
    let health = checking::health(&reader.state.db, first + 7 * DAY)
        .await
        .unwrap();
    assert_eq!(health.feeds_dead, 1);

    // The diagnostics page counts it, and names no feed.
    let diagnostics = Client::new()
        .get(format!("{}/diagnostics", reader.base))
        .bearer_auth(common::DIAGNOSTICS_KEY)
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    let diagnostics: Value = serde_json::from_str(&diagnostics).unwrap();
    assert_eq!(diagnostics["feeds"]["feeds_followed"], 1);
    assert_eq!(diagnostics["feeds"]["feeds_failing"], 1);
    let text = diagnostics.to_string();
    assert!(
        !text.contains("flaky") && !text.contains("Growing"),
        "{text}"
    );
}

#[tokio::test]
async fn a_feed_that_moved_for_good_is_remembered_at_its_new_address() {
    let reader = Reader::new().await;
    let feed = reader.follow("/moving.xml").await;
    reader.change(|site| site.moved = true);
    let at = nine_turtles::now() + DAY;
    reader.round(at).await;
    let url: String = sqlx::query_scalar("SELECT url FROM feeds WHERE id = ?")
        .bind(feed)
        .fetch_one(&reader.state.db)
        .await
        .unwrap();
    assert_eq!(url, format!("{}/new-home.xml", reader.site));

    let asked = reader.requests().len();
    reader.round(at + DAY).await;
    let paths: Vec<String> = reader.requests()[asked..]
        .iter()
        .map(|request| request.path.clone())
        .collect();
    assert_eq!(paths, ["/new-home.xml"]);
}

#[tokio::test]
async fn an_edited_article_gets_the_new_words_quietly_and_stays_read() {
    let reader = Reader::new().await;
    let feed = reader.follow("/grow.xml").await;
    let before = reader.get(&format!("/api/articles?feed={feed}")).await;
    let newest = before["articles"][0]["id"].as_i64().unwrap();
    let (status, _) = reader
        .post(
            "/api/articles/read",
            json!({ "ids": [newest], "read": true }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    reader.change(|site| site.edited = true);
    reader.round(nine_turtles::now() + DAY).await;

    let after = reader.get(&format!("/api/articles?feed={feed}")).await;
    assert_eq!(after["articles"][0]["id"], newest);
    assert_eq!(after["articles"][0]["title"], "Post 3, corrected");
    assert_eq!(after["articles"][0]["read"], true);
    assert_eq!(after["articles"][0]["at"], before["articles"][0]["at"]);
    let article = reader.get(&format!("/api/articles/{newest}")).await;
    assert_eq!(article["article"]["summary"], "<p>Better words.</p>");
    // An edit isn't a new article.
    let latest = before["latest"].as_i64().unwrap();
    assert_eq!(
        reader
            .get(&format!("/api/articles/new?since={latest}&view=all"))
            .await["new"],
        false
    );
}
