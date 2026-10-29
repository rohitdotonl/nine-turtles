//! Syncing with other feed readers through the Google Reader API (SPEC
//! section 26), tested against a real running nine turtles and a made-up
//! publisher, the way Reeder and NetNewsWire talk to it.

mod common;

use axum::{Router, http::header, response::IntoResponse, routing::get};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

/// A made-up blog whose feed has 30 posts.
async fn publisher() -> String {
    let app = Router::new().route("/feed.xml", get(|| async { feed() }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}/feed.xml")
}

fn feed() -> impl IntoResponse {
    let mut items = String::new();
    for number in (1..=30).rev() {
        items.push_str(&format!(
            "<item><title>Post {number}</title><guid>post-{number}</guid>\
             <link>https://quiet.example/{number}</link>\
             <description>&lt;p&gt;Words of post {number}&lt;/p&gt;</description>\
             <pubDate>{number:02} Jan 2026 12:00:00 GMT</pubDate></item>"
        ));
    }
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(
            r#"<?xml version="1.0"?><rss version="2.0"><channel><title>Quiet Notes</title>
            <link>https://quiet.example/</link>{items}</channel></rss>"#
        ),
    )
}

/// A form as apps send it: `name=value&…`, with anything unusual escaped.
fn form(pairs: &[(&str, &str)]) -> String {
    let escape = |text: &str| {
        text.bytes()
            .map(|byte| match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' => {
                    char::from(byte).to_string()
                }
                _ => format!("%{byte:02X}"),
            })
            .collect::<String>()
    };
    pairs
        .iter()
        .map(|(name, value)| format!("{}={}", escape(name), escape(value)))
        .collect::<Vec<_>>()
        .join("&")
}

const API: &str = "/api/greader";
const READ: &str = "user/-/state/com.google/read";
const STARRED: &str = "user/-/state/com.google/starred";

struct Owner {
    base: String,
    cookie: String,
    feed: i64,
    state: nine_turtles::AppState,
}

impl Owner {
    /// Signed in on the web, following the made-up blog, with it in a folder.
    async fn new() -> Self {
        let (base, state) = common::start_with_state(common::config()).await;
        let cookie = common::signed_in(&base).await;
        let mut owner = Self {
            base,
            cookie,
            feed: 0,
            state,
        };
        let (status, added) = owner
            .post("/api/feeds", &json!({ "address": publisher().await }))
            .await;
        assert_eq!(status, StatusCode::CREATED);
        owner.feed = added["feed"]["id"].as_i64().unwrap();
        let (status, _) = owner
            .post(
                "/api/folders",
                &json!({ "name": "Essays", "feeds": [owner.feed] }),
            )
            .await;
        assert_eq!(status, StatusCode::CREATED);
        owner
    }

    async fn post(&self, path: &str, body: &Value) -> (StatusCode, Value) {
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

    async fn make_app_password(&self) -> String {
        let (status, made) = self.post("/api/apps/password", &json!({})).await;
        assert_eq!(status, StatusCode::OK);
        made["password"].as_str().unwrap().to_owned()
    }
}

/// An app such as Reeder: no cookie, no browser headers.
struct App {
    base: String,
    token: String,
}

impl App {
    async fn sign_in(base: &str, password: &str) -> Result<Self, StatusCode> {
        let response = Client::new()
            .post(format!("{base}{API}/accounts/ClientLogin"))
            .header("content-type", "application/x-www-form-urlencoded")
            .body(form(&[("Email", "owner"), ("Passwd", password)]))
            .send()
            .await
            .unwrap();
        if response.status() != StatusCode::OK {
            return Err(response.status());
        }
        let text = response.text().await.unwrap();
        let token = text
            .lines()
            .find_map(|line| line.strip_prefix("Auth="))
            .unwrap()
            .to_owned();
        Ok(Self {
            base: base.to_owned(),
            token,
        })
    }

    async fn get(&self, path: &str) -> Value {
        let response = Client::new()
            .get(format!("{}{API}/reader/api/0/{path}", self.base))
            .header("authorization", format!("GoogleLogin auth={}", self.token))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{path}");
        serde_json::from_str(&response.text().await.unwrap()).unwrap()
    }

    async fn post(&self, path: &str, form: &[(&str, &str)]) -> (StatusCode, String) {
        let response = Client::new()
            .post(format!("{}{API}/reader/api/0/{path}", self.base))
            .header("authorization", format!("GoogleLogin auth={}", self.token))
            .header("content-type", "application/x-www-form-urlencoded")
            .body(self::form(form))
            .send()
            .await
            .unwrap();
        (response.status(), response.text().await.unwrap())
    }

    async fn ids(&self, query: &str) -> Vec<String> {
        self.get(&format!("stream/items/ids?{query}")).await["itemRefs"]
            .as_array()
            .unwrap()
            .iter()
            .map(|item| item["id"].as_str().unwrap().to_owned())
            .collect()
    }
}

#[tokio::test]
async fn apps_sign_in_only_with_the_app_password() {
    let owner = Owner::new().await;

    // No app password yet: nothing gets in, not even the owner's own password.
    assert!(App::sign_in(&owner.base, "").await.is_err());
    assert_eq!(
        App::sign_in(&owner.base, common::PASSWORD).await.err(),
        Some(StatusCode::UNAUTHORIZED)
    );

    let password = owner.make_app_password().await;
    assert_eq!(password.len(), 29, "{password}");
    let app = App::sign_in(&owner.base, &password).await.unwrap();
    assert_eq!(app.get("user-info").await["userName"], "nine turtles");
    // Typed in capitals and without its dashes, it's still the password.
    let typed = password.replace('-', "").to_uppercase();
    assert!(App::sign_in(&owner.base, &typed).await.is_ok());
    // The owner's real password is never an app password.
    assert!(App::sign_in(&owner.base, common::PASSWORD).await.is_err());

    // Without the token, or with a wrong one, apps get "Unauthorized".
    let stranger = App {
        base: owner.base.clone(),
        token: "a".repeat(24),
    };
    let response = Client::new()
        .get(format!(
            "{}{API}/reader/api/0/subscription/list",
            owner.base
        ))
        .header(
            "authorization",
            format!("GoogleLogin auth={}", stranger.token),
        )
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    // The web sign-in cookie isn't enough either.
    let response = Client::new()
        .get(format!(
            "{}{API}/reader/api/0/subscription/list",
            owner.base
        ))
        .header("cookie", &owner.cookie)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    // And the app password opens nothing but the sync API.
    let response = Client::new()
        .get(format!("{}/api/feeds", owner.base))
        .header("authorization", format!("GoogleLogin auth={}", app.token))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    // Settings says it's on; a new password signs the old one out.
    let response = Client::new()
        .get(format!("{}/api/apps", owner.base))
        .header("cookie", &owner.cookie)
        .send()
        .await
        .unwrap();
    let status: Value = serde_json::from_str(&response.text().await.unwrap()).unwrap();
    assert_eq!(status["on"], true);
    let newer = owner.make_app_password().await;
    assert_ne!(newer, password);
    assert!(App::sign_in(&owner.base, &password).await.is_err());
    let newer_app = App::sign_in(&owner.base, &newer).await.unwrap();
    assert_eq!(newer_app.get("tag/list").await["tags"][0]["id"], STARRED);

    // Turning it off signs every app out.
    let (status, _) = owner.post("/api/apps/off", &json!({})).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let response = Client::new()
        .get(format!("{}{API}/reader/api/0/tag/list", owner.base))
        .header(
            "authorization",
            format!("GoogleLogin auth={}", newer_app.token),
        )
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    // Only a signed-in page can make an app password.
    let response = Client::new()
        .post(format!("{}/api/apps/password", owner.base))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn apps_see_feeds_folders_and_articles() {
    let owner = Owner::new().await;
    let app = App::sign_in(&owner.base, &owner.make_app_password().await)
        .await
        .unwrap();

    let list = app.get("subscription/list?output=json").await;
    let feed = &list["subscriptions"][0];
    assert_eq!(feed["id"], format!("feed/{}", owner.feed));
    assert_eq!(feed["title"], "Quiet Notes");
    assert_eq!(feed["htmlUrl"], "https://quiet.example/");
    assert_eq!(feed["categories"][0]["id"], "user/-/label/Essays");

    let tags = app.get("tag/list?output=json").await;
    assert_eq!(tags["tags"][1]["id"], "user/-/label/Essays");

    let counts = app.get("unread-count?output=json").await;
    let total = counts["unreadcounts"]
        .as_array()
        .unwrap()
        .iter()
        .find(|count| count["id"] == "user/-/state/com.google/reading-list")
        .unwrap();
    assert_eq!(total["count"], 30);

    // All 30 numbers in one go; page by page with a continuation.
    let all = app
        .ids("s=user/-/state/com.google/reading-list&xt=user/-/state/com.google/read&n=1000")
        .await;
    assert_eq!(all.len(), 30);
    let first = app
        .get("stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list?n=20")
        .await;
    assert_eq!(first["items"].as_array().unwrap().len(), 20);
    let continuation = first["continuation"].as_str().unwrap();
    let rest = app
        .get(&format!(
            "stream/contents?s=feed/{}&n=20&c={continuation}",
            owner.feed
        ))
        .await;
    assert_eq!(rest["items"].as_array().unwrap().len(), 10);
    assert!(rest.get("continuation").is_none());

    // A folder's list, and an unknown list, which is simply empty.
    assert_eq!(app.ids("s=user/1/label/Essays&n=100").await.len(), 30);
    assert!(app.ids("s=user/-/label/Nothing&n=100").await.is_empty());
    assert!(
        app.ids("s=user/-/state/com.google/broadcast")
            .await
            .is_empty()
    );

    // Items by number, in Google's long form, with the publisher's text and link.
    let long = format!(
        "tag:google.com,2005:reader/item/{:016x}",
        all[0].parse::<i64>().unwrap()
    );
    let (status, body) = app
        .post("stream/items/contents", &[("i", &long), ("i", &all[1])])
        .await;
    assert_eq!(status, StatusCode::OK);
    let items: Value = serde_json::from_str(&body).unwrap();
    let item = &items["items"][0];
    assert_eq!(item["id"], long);
    assert_eq!(item["title"], "Post 30");
    assert_eq!(item["alternate"][0]["href"], "https://quiet.example/30");
    assert_eq!(item["origin"]["title"], "Quiet Notes");
    assert!(
        item["summary"]["content"]
            .as_str()
            .unwrap()
            .contains("Words of post 30")
    );
    assert_eq!(items["items"].as_array().unwrap().len(), 2);

    // The same API answers at FreshRSS's address, for apps that expect it.
    let response = Client::new()
        .get(format!(
            "{}/api/greader.php/reader/api/0/user-info",
            owner.base
        ))
        .header("authorization", format!("GoogleLogin auth={}", app.token))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn apps_get_articles_without_trackers_even_old_ones() {
    let owner = Owner::new().await;
    let app = App::sign_in(&owner.base, &owner.make_app_password().await)
        .await
        .unwrap();
    // As if stored before trackers and tracking tags were taken out on
    // arrival (decision 0112).
    sqlx::query(
        "UPDATE articles SET link = link || '?utm_source=rss',
             content = '<p><a href=\"https://x.example/?utm_source=a&amp;id=2\">x</a>\
<img src=\"https://ad.doubleclick.net/p.gif\" width=\"1\" height=\"1\"></p>'
         WHERE link = 'https://quiet.example/30'",
    )
    .execute(&owner.state.db)
    .await
    .unwrap();

    let listed = app
        .get(&format!("stream/contents/feed%2F{}?n=1", owner.feed))
        .await;
    let item = &listed["items"][0];
    assert_eq!(item["alternate"][0]["href"], "https://quiet.example/30");
    assert_eq!(item["canonical"][0]["href"], "https://quiet.example/30");
    let content = item["summary"]["content"].as_str().unwrap();
    assert!(!content.contains("doubleclick"), "{content}");
    assert!(!content.contains("utm_source"), "{content}");
    assert!(content.contains("id=2"), "{content}");
}

#[tokio::test]
async fn read_and_starred_sync_both_ways() {
    let owner = Owner::new().await;
    let app = App::sign_in(&owner.base, &owner.make_app_password().await)
        .await
        .unwrap();
    let all = app.ids("n=1000").await;
    let (one, two) = (all[0].as_str(), all[1].as_str());

    // Read and starred in the app: nine turtles sees it.
    let (status, body) = app
        .post(
            "edit-tag",
            &[("i", one), ("i", two), ("a", READ), ("T", "token")],
        )
        .await;
    assert_eq!((status, body.as_str()), (StatusCode::OK, "OK"));
    app.post("edit-tag", &[("i", one), ("a", STARRED)]).await;
    assert_eq!(app.ids(&format!("xt={READ}&n=1000")).await.len(), 28);
    assert_eq!(app.ids(&format!("s={STARRED}")).await, vec![one.to_owned()]);
    let starred = Client::new()
        .get(format!("{}/api/articles?list=starred", owner.base))
        .header("cookie", &owner.cookie)
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    let starred: Value = serde_json::from_str(&starred).unwrap();
    assert_eq!(starred["articles"][0]["id"].to_string(), one);

    // Unread again in the app ("kept unread" is how some apps say it).
    app.post(
        "edit-tag",
        &[("i", two), ("a", "user/-/state/com.google/kept-unread")],
    )
    .await;
    app.post("edit-tag", &[("i", one), ("r", READ), ("r", STARRED)])
        .await;
    assert_eq!(app.ids(&format!("xt={READ}&n=1000")).await.len(), 30);
    assert!(app.ids(&format!("s={STARRED}")).await.is_empty());

    // Marked read in nine turtles: the app sees it.
    let number: i64 = one.parse().unwrap();
    let (status, _) = owner
        .post(
            "/api/articles/read",
            &json!({ "ids": [number], "read": true }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(app.ids(&format!("s={READ}")).await, vec![one.to_owned()]);
    let item = app
        .get(&format!("stream/contents/feed%2F{}?n=1", owner.feed))
        .await;
    assert!(
        item["items"][0]["categories"]
            .as_array()
            .unwrap()
            .contains(&json!(READ))
    );

    // "Mark all as read" never touches articles that arrived after the app looked.
    let (status, _) = app
        .post(
            "mark-all-as-read",
            &[("s", "user/-/label/Essays"), ("ts", "1000000")],
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(app.ids(&format!("xt={READ}&n=1000")).await.len(), 29);
    let now = format!("{}", nine_turtles::now() * 1_000_000);
    app.post(
        "mark-all-as-read",
        &[("s", &format!("feed/{}", owner.feed)), ("ts", &now)],
    )
    .await;
    assert!(app.ids(&format!("xt={READ}&n=1000")).await.is_empty());
}

#[tokio::test]
async fn apps_follow_unfollow_rename_and_file_feeds() {
    let owner = Owner::new().await;
    let app = App::sign_in(&owner.base, &owner.make_app_password().await)
        .await
        .unwrap();
    let feed = format!("feed/{}", owner.feed);
    let subscriptions = || async { app.get("subscription/list").await["subscriptions"].clone() };

    // Renamed, and moved from Essays into a new folder.
    let (status, body) = app
        .post(
            "subscription/edit",
            &[
                ("ac", "edit"),
                ("s", &feed),
                ("t", "  Quiet   notes "),
                ("a", "user/-/label/Reading"),
                ("r", "user/-/label/Essays"),
            ],
        )
        .await;
    assert_eq!((status, body.as_str()), (StatusCode::OK, "OK"));
    let list = subscriptions().await;
    assert_eq!(list[0]["title"], "Quiet notes");
    assert_eq!(
        list[0]["categories"],
        json!([{ "id": "user/-/label/Reading", "label": "Reading" }])
    );

    // Folders renamed and deleted; the feed stays followed.
    let (status, _) = app
        .post(
            "rename-tag",
            &[
                ("s", "user/-/label/Reading"),
                ("dest", "user/-/label/Later"),
            ],
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(subscriptions().await[0]["categories"][0]["label"], "Later");
    let (status, _) = app
        .post(
            "rename-tag",
            &[("s", "user/-/label/Nowhere"), ("dest", "user/-/label/Else")],
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = app
        .post("disable-tag", &[("s", "user/-/label/Later")])
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(subscriptions().await[0]["categories"], json!([]));
    assert_eq!(subscriptions().await.as_array().unwrap().len(), 1);

    // Unfollowed: gone from every list at once.
    let some = app.ids("n=3").await;
    app.post("edit-tag", &[("i", &some[0]), ("a", READ)]).await;
    let address = subscriptions().await[0]["url"].as_str().unwrap().to_owned();
    let (status, _) = app
        .post("subscription/edit", &[("ac", "unsubscribe"), ("s", &feed)])
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(subscriptions().await.as_array().unwrap().is_empty());
    assert!(app.ids("n=100").await.is_empty());
    assert!(app.ids(&format!("s={feed}&n=100")).await.is_empty());

    // Followed again from the app within ten minutes: back as it was.
    let (status, body) = app
        .post("subscription/quickadd", &[("quickadd", &address)])
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let added: Value = serde_json::from_str(&body).unwrap();
    assert_eq!(added["streamId"], feed);
    assert_eq!(app.ids("n=100").await.len(), 30);
    assert_eq!(app.ids(&format!("s={READ}")).await, vec![some[0].clone()]);

    // Following a feed already followed simply answers it.
    let (status, _) = app
        .post(
            "subscription/edit",
            &[("ac", "subscribe"), ("s", &format!("feed/{address}"))],
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(subscriptions().await.as_array().unwrap().len(), 1);

    // Unfollowed again, then followed again by its number: back as well.
    app.post("subscription/edit", &[("ac", "unsubscribe"), ("s", &feed)])
        .await;
    assert!(subscriptions().await.as_array().unwrap().is_empty());
    let (status, _) = app
        .post("subscription/edit", &[("ac", "subscribe"), ("s", &feed)])
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(app.ids(&format!("s={feed}&n=100")).await.len(), 30);
}

#[tokio::test]
async fn an_app_deleting_a_folder_leaves_its_rules_and_searches_as_the_screen_does() {
    let owner = Owner::new().await;
    let (status, made) = owner
        .post(
            "/api/folders",
            &json!({ "name": "Garden", "feeds": [owner.feed] }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let folder = made["folder"]["id"].as_i64().unwrap();
    let (status, _) = owner
        .post(
            "/api/rules",
            &json!({ "words": "laptop", "folder_id": folder, "action": "mute" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = owner
        .post(
            "/api/saved-searches",
            &json!({ "name": "Roses", "query": { "words": "roses", "scope": { "kind": "folder", "id": folder } } }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let app = App::sign_in(&owner.base, &owner.make_app_password().await)
        .await
        .unwrap();

    let (status, _) = app
        .post("disable-tag", &[("s", "user/-/label/Garden")])
        .await;
    assert_eq!(status, StatusCode::OK);

    // The rule stays, paused and saying so; the search looks in no folder.
    let rule = &owner.get("/api/rules").await["rules"][0];
    assert_eq!(rule["place_gone"], true);
    assert_eq!(rule["folder_id"], Value::Null);
    let search = &owner.get("/api/saved-searches").await["searches"][0];
    assert_eq!(search["query"]["scope"]["id"], 0);
}

#[tokio::test]
async fn an_app_unfollowing_keeps_earlier_ones_waiting_until_the_screen_unsubscribes() {
    let owner = Owner::new().await;
    let app = App::sign_in(&owner.base, &owner.make_app_password().await)
        .await
        .unwrap();
    let mut feeds = vec![owner.feed];
    for _ in 0..2 {
        let (status, added) = owner
            .post("/api/feeds", &json!({ "address": publisher().await }))
            .await;
        assert_eq!(status, StatusCode::CREATED);
        feeds.push(added["feed"]["id"].as_i64().unwrap());
    }
    let waiting = || async {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM subscriptions WHERE unsubscribed_at IS NOT NULL AND cleared = 0",
        )
        .fetch_one(&owner.state.db)
        .await
        .unwrap()
    };

    // Two unfollowed from the app: the second doesn't cut the first short.
    for feed in &feeds[..2] {
        let (status, _) = app
            .post(
                "subscription/edit",
                &[("ac", "unsubscribe"), ("s", &format!("feed/{feed}"))],
            )
            .await;
        assert_eq!(status, StatusCode::OK);
    }
    assert_eq!(waiting().await, 2);

    // Unsubscribing on the screen clears them first (its Undo covers only
    // the last action), so only its own feed waits.
    let (status, _) = owner
        .post(&format!("/api/feeds/{}/unsubscribe", feeds[2]), &json!({}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(waiting().await, 1);
}
