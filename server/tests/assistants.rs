//! A reader's own AI assistant connected over MCP (SPEC section 33,
//! decision 0111), tested against a real running nine turtles and a made-up
//! publisher, the way any assistant that follows the standard talks to it:
//! finding out how to sign in, registering, the reader approving it,
//! swapping the code for tickets, and then calling tools.

mod common;

use axum::{Router, http::header, response::IntoResponse, routing::get};
use nine_turtles::assistants::challenge_for;
use reqwest::{Client, StatusCode, Url};
use serde_json::{Value, json};

/// A made-up blog whose feed has 5 posts, one by Ada.
async fn publisher(name: &'static str) -> String {
    let app = Router::new().route("/feed.xml", get(move || async move { feed(name) }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}/feed.xml")
}

fn feed(name: &str) -> impl IntoResponse {
    let mut items = String::new();
    for number in (1..=5).rev() {
        let author = if number == 3 {
            "<author>ada@quiet.example (Ada Lovelace)</author>"
        } else {
            ""
        };
        items.push_str(&format!(
            "<item><title>{name} post {number}</title><guid>{name}-{number}</guid>\
             <link>https://quiet.example/{number}</link>{author}\
             <description>&lt;p&gt;Words about gardens {number}&lt;/p&gt;&lt;p&gt;Second part&lt;/p&gt;</description>\
             <pubDate>{number:02} Jan 2026 12:00:00 GMT</pubDate></item>"
        ));
    }
    (
        [(header::CONTENT_TYPE, "application/rss+xml")],
        format!(
            r#"<?xml version="1.0"?><rss version="2.0"><channel><title>{name}</title>
            <link>https://quiet.example/</link>{items}</channel></rss>"#
        ),
    )
}

/// A response's body as JSON (null if it isn't).
async fn read(response: reqwest::Response) -> Value {
    serde_json::from_slice(&response.bytes().await.unwrap()).unwrap_or(Value::Null)
}

trait ThenRead {
    async fn then_read(self) -> Value;
}

impl ThenRead for reqwest::Response {
    async fn then_read(self) -> Value {
        read(self).await
    }
}

/// A form as `name=value&…`.
fn encoded(pairs: &[(&str, &str)]) -> String {
    let mut url = Url::parse("http://x/").unwrap();
    url.query_pairs_mut().extend_pairs(pairs);
    url.query().unwrap_or_default().to_owned()
}

const REDIRECT: &str = "https://assistant.example/callback";
const VERIFIER: &str = "a-secret-the-assistant-keeps-to-itself-0123456789";

async fn post_json(
    base: &str,
    path: &str,
    cookie: Option<&str>,
    body: &Value,
) -> (StatusCode, Value) {
    let mut request = Client::new()
        .post(format!("{base}{path}"))
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body(body.to_string());
    if let Some(cookie) = cookie {
        request = request.header("cookie", cookie);
    }
    let response = request.send().await.unwrap();
    let status = response.status();
    (status, read(response).await)
}

async fn get_json(base: &str, path: &str, cookie: &str) -> (StatusCode, Value) {
    let response = Client::new()
        .get(format!("{base}{path}"))
        .header("cookie", cookie)
        .send()
        .await
        .unwrap();
    let status = response.status();
    (status, read(response).await)
}

/// Registers an assistant, as it would on first meeting nine turtles.
async fn register(base: &str) -> String {
    // No browser headers, as an assistant's server sends none.
    let response = Client::new()
        .post(format!("{base}/oauth/register"))
        .header("content-type", "application/json")
        .body(json!({ "client_name": "Test assistant", "redirect_uris": [REDIRECT] }).to_string())
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let registered: Value = read(response).await;
    assert_eq!(registered["token_endpoint_auth_method"], "none");
    registered["client_id"].as_str().unwrap().to_owned()
}

fn authorize_query(client_id: &str) -> String {
    let mut url = Url::parse("http://x/oauth/authorize").unwrap();
    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", REDIRECT)
        .append_pair("code_challenge", &challenge_for(VERIFIER))
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", "the-assistants-own-state");
    format!("?{}", url.query().unwrap())
}

async fn token(base: &str, form: &[(&str, &str)]) -> (StatusCode, Value) {
    let response = Client::new()
        .post(format!("{base}/oauth/token"))
        .header("content-type", "application/x-www-form-urlencoded")
        .body(encoded(form))
        .send()
        .await
        .unwrap();
    let status = response.status();
    (status, read(response).await)
}

/// The whole OAuth dance for the reader signed in with `cookie`: answers the
/// access and refresh tickets.
async fn connect(base: &str, cookie: &str) -> (String, String) {
    let client_id = register(base).await;
    let query = authorize_query(&client_id);
    let (status, shown) = get_json(base, &format!("/api/oauth/request{query}"), cookie).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(shown["client_name"], "Test assistant");
    assert_eq!(shown["redirect_host"], "assistant.example");
    let (status, approved) = post_json(
        base,
        "/api/oauth/approve",
        Some(cookie),
        &json!({ "query": query }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let back = Url::parse(approved["redirect"].as_str().unwrap()).unwrap();
    assert!(back.as_str().starts_with(REDIRECT));
    let pairs: std::collections::HashMap<_, _> = back.query_pairs().into_owned().collect();
    assert_eq!(pairs["state"], "the-assistants-own-state");
    assert_eq!(pairs["iss"], base);
    let code = pairs["code"].clone();
    let (status, tickets) = token(
        base,
        &[
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("client_id", &client_id),
            ("redirect_uri", REDIRECT),
            ("code_verifier", VERIFIER),
        ],
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{tickets}");
    assert_eq!(tickets["token_type"], "Bearer");
    // The code works once only.
    let (status, again) = token(
        base,
        &[
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("client_id", &client_id),
            ("code_verifier", VERIFIER),
        ],
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(again["error"], "invalid_grant");
    (
        tickets["access_token"].as_str().unwrap().to_owned(),
        tickets["refresh_token"].as_str().unwrap().to_owned(),
    )
}

/// One JSON-RPC message to `/mcp`, as an assistant sends it.
async fn rpc(base: &str, ticket: &str, method: &str, params: Value) -> reqwest::Response {
    Client::new()
        .post(format!("{base}/mcp"))
        .bearer_auth(ticket)
        .header("accept", "application/json, text/event-stream")
        // Some assistants say where they come from; that's fine here.
        .header("origin", "https://assistant.example")
        .header("content-type", "application/json")
        .body(json!({ "jsonrpc": "2.0", "id": 7, "method": method, "params": params }).to_string())
        .send()
        .await
        .unwrap()
}

/// Calls a tool: answers its text read as JSON (or as a string), and whether it was an error.
async fn tool(base: &str, ticket: &str, name: &str, arguments: Value) -> (Value, bool) {
    let response = rpc(
        base,
        ticket,
        "tools/call",
        json!({ "name": name, "arguments": arguments }),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    let answer: Value = read(response).await;
    assert_eq!(answer["id"], 7);
    let result = &answer["result"];
    let text = result["content"][0]["text"].as_str().unwrap();
    (
        serde_json::from_str(text).unwrap_or_else(|_| json!(text)),
        result["isError"].as_bool().unwrap(),
    )
}

#[tokio::test]
async fn an_assistant_finds_out_how_to_sign_in() {
    let base = common::start(common::config()).await;
    let response = rpc(&base, "not-a-ticket", "initialize", json!({})).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let challenge = response.headers()[header::WWW_AUTHENTICATE]
        .to_str()
        .unwrap();
    assert!(challenge.contains(&format!("{base}/.well-known/oauth-protected-resource/mcp")));

    let resource: Value = Client::new()
        .get(format!("{base}/.well-known/oauth-protected-resource/mcp"))
        .send()
        .await
        .unwrap()
        .then_read()
        .await;
    assert_eq!(resource["resource"], format!("{base}/mcp"));
    assert_eq!(resource["authorization_servers"][0], base);
    let server: Value = Client::new()
        .get(format!("{base}/.well-known/oauth-authorization-server"))
        .send()
        .await
        .unwrap()
        .then_read()
        .await;
    assert_eq!(server["issuer"], base);
    assert_eq!(server["code_challenge_methods_supported"], json!(["S256"]));
    assert_eq!(
        server["registration_endpoint"],
        format!("{base}/oauth/register")
    );

    // Return addresses a browser would run, or plain http elsewhere, are refused.
    for bad in ["javascript:alert(1)", "http://evil.example/callback"] {
        let response = Client::new()
            .post(format!("{base}/oauth/register"))
            .header("content-type", "application/json")
            .body(json!({ "redirect_uris": [bad] }).to_string())
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{bad}");
    }
}

#[tokio::test]
async fn the_reader_approves_and_the_assistant_works() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (status, added) = post_json(
        &base,
        "/api/feeds",
        Some(&cookie),
        &json!({ "address": publisher("Garden Notes").await }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let feed = added["feed"]["id"].as_i64().unwrap();

    let (access, refresh) = connect(&base, &cookie).await;

    let answer: Value = rpc(&base, &access, "initialize", json!({ "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": { "name": "test", "version": "1" } }))
        .await.then_read().await;
    assert_eq!(answer["result"]["protocolVersion"], "2025-06-18");
    assert_eq!(answer["result"]["serverInfo"]["name"], "nine-turtles");
    // A notification is accepted with no answer.
    let response = Client::new()
        .post(format!("{base}/mcp"))
        .bearer_auth(&access)
        .header("content-type", "application/json")
        .body(json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }).to_string())
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::ACCEPTED);
    let listed: Value = rpc(&base, &access, "tools/list", json!({}))
        .await
        .then_read()
        .await;
    let names: Vec<&str> = listed["result"]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .map(|tool| tool["name"].as_str().unwrap())
        .collect();
    assert!(names.contains(&"search_articles") && names.contains(&"export_feed_list"));

    // Reading.
    let (unread, error) = tool(&base, &access, "list_unread", json!({})).await;
    assert!(!error);
    assert_eq!(unread["articles"].as_array().unwrap().len(), 5);
    let (found, _) = tool(
        &base,
        &access,
        "search_articles",
        json!({ "query": "gardens" }),
    )
    .await;
    assert_eq!(found["articles"].as_array().unwrap().len(), 5);
    let (by_ada, _) = tool(
        &base,
        &access,
        "search_articles",
        json!({ "author": "ada" }),
    )
    .await;
    let by_ada = by_ada["articles"].as_array().unwrap();
    assert_eq!(by_ada.len(), 1);
    let article = by_ada[0]["id"].as_i64().unwrap();
    let (opened, _) = tool(
        &base,
        &access,
        "open_article",
        json!({ "article_id": article }),
    )
    .await;
    assert_eq!(opened["title"], "Garden Notes post 3");
    assert_eq!(opened["text"], "Words about gardens 3\n\nSecond part");
    assert_eq!(opened["read"], false, "opening doesn't mark it read");
    let (feeds, _) = tool(&base, &access, "list_feeds", json!({})).await;
    assert_eq!(feeds["feeds"][0]["name"], "Garden Notes");
    let (_, error) = tool(&base, &access, "feed_health", json!({})).await;
    assert!(!error);

    // Changing.
    let (_, error) = tool(
        &base,
        &access,
        "star",
        json!({ "article_ids": [article], "starred": true }),
    )
    .await;
    assert!(!error);
    let (starred, _) = tool(&base, &access, "list_starred", json!({})).await;
    assert_eq!(starred["articles"][0]["id"], article);
    let (_, error) = tool(
        &base,
        &access,
        "mark_read",
        json!({ "article_ids": [article], "read": true }),
    )
    .await;
    assert!(!error);
    let (unread, _) = tool(&base, &access, "list_unread", json!({ "feed_id": feed })).await;
    assert_eq!(unread["articles"].as_array().unwrap().len(), 4);
    let (_, error) = tool(&base, &access, "mark_feed_read", json!({ "feed_id": feed })).await;
    assert!(!error);
    let (unread, _) = tool(&base, &access, "list_unread", json!({})).await;
    assert_eq!(unread["articles"].as_array().unwrap().len(), 0);

    let (_, error) = tool(
        &base,
        &access,
        "edit_feed",
        json!({ "feed_id": feed, "title": "Gardens", "folders": ["Outdoors"] }),
    )
    .await;
    assert!(!error);
    let (feeds, _) = tool(&base, &access, "list_feeds", json!({})).await;
    assert_eq!(feeds["feeds"][0]["name"], "Gardens");
    assert_eq!(feeds["feeds"][0]["folders"], json!(["Outdoors"]));
    let folder = feeds["folders"][0]["id"].as_i64().unwrap();
    let (_, error) = tool(
        &base,
        &access,
        "rename_folder",
        json!({ "folder_id": folder, "name": "Outside" }),
    )
    .await;
    assert!(!error);
    let (made, _) = tool(&base, &access, "create_folder", json!({ "name": "Later" })).await;
    let (_, error) = tool(
        &base,
        &access,
        "delete_folder",
        json!({ "folder_id": made["folder_id"] }),
    )
    .await;
    assert!(!error);
    let (feeds, _) = tool(&base, &access, "list_feeds", json!({})).await;
    assert_eq!(
        feeds["folders"],
        json!([{ "id": folder, "name": "Outside" }])
    );

    let (rule, error) = tool(
        &base,
        &access,
        "add_rule",
        json!({ "words": "gardens", "action": "star" }),
    )
    .await;
    assert!(!error, "{rule}");
    let (rules, _) = tool(&base, &access, "list_rules", json!({})).await;
    assert_eq!(rules["rules"][0]["words"], "gardens");
    let (_, error) = tool(
        &base,
        &access,
        "delete_rule",
        json!({ "rule_id": rule["rule_id"] }),
    )
    .await;
    assert!(!error);
    let (_, error) = tool(&base, &access, "add_rule", json!({ "action": "mute" })).await;
    assert!(error, "a rule needs something to match");

    let (opml, _) = tool(&base, &access, "export_feed_list", json!({})).await;
    assert!(opml["file"].as_str().unwrap().contains("Gardens"));

    let (added, error) = tool(
        &base,
        &access,
        "add_feed",
        json!({ "address": publisher("Second Blog").await }),
    )
    .await;
    assert!(!error, "{added}");
    let (refused, error) = tool(
        &base,
        &access,
        "add_feed",
        json!({ "address": "ftp://example.com/feed" }),
    )
    .await;
    assert!(error, "{refused}");

    // A wrong tool name, or nonsense arguments, are said plainly.
    let answer: Value = rpc(
        &base,
        &access,
        "tools/call",
        json!({ "name": "delete_account" }),
    )
    .await
    .then_read()
    .await;
    assert_eq!(answer["error"]["code"], -32602);
    let (_, error) = tool(&base, &access, "mark_read", json!({ "article_ids": "all" })).await;
    assert!(error);

    // The refresh ticket gives new tickets, once.
    let (status, fresh) = token(
        &base,
        &[("grant_type", "refresh_token"), ("refresh_token", &refresh)],
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = token(
        &base,
        &[("grant_type", "refresh_token"), ("refresh_token", &refresh)],
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (_, error) = tool(
        &base,
        fresh["access_token"].as_str().unwrap(),
        "list_feeds",
        json!({}),
    )
    .await;
    assert!(!error);

    // Settings lists it; disconnecting stops every ticket at once.
    let (_, listed) = get_json(&base, "/api/assistants", &cookie).await;
    let assistants = listed["assistants"].as_array().unwrap();
    assert_eq!(assistants.len(), 1);
    assert_eq!(assistants[0]["name"], "Test assistant");
    let id = assistants[0]["id"].as_i64().unwrap();
    let (status, _) = post_json(
        &base,
        &format!("/api/assistants/{id}/disconnect"),
        Some(&cookie),
        &json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let response = rpc(
        &base,
        fresh["access_token"].as_str().unwrap(),
        "tools/list",
        json!({}),
    )
    .await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let (status, _) = token(
        &base,
        &[
            ("grant_type", "refresh_token"),
            ("refresh_token", fresh["refresh_token"].as_str().unwrap()),
        ],
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn a_wrong_verifier_or_address_gets_nothing() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let client_id = register(&base).await;
    let query = authorize_query(&client_id);
    let (_, approved) = post_json(
        &base,
        "/api/oauth/approve",
        Some(&cookie),
        &json!({ "query": query }),
    )
    .await;
    let back = Url::parse(approved["redirect"].as_str().unwrap()).unwrap();
    let code = back
        .query_pairs()
        .find(|(key, _)| key == "code")
        .unwrap()
        .1
        .into_owned();
    let (status, _) = token(
        &base,
        &[
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("client_id", &client_id),
            (
                "code_verifier",
                "a-different-secret-that-is-long-enough-to-count-0000",
            ),
        ],
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // An address the assistant didn't register is never sent a code.
    let other = query.replace("assistant.example", "elsewhere.example");
    let (status, refused) = post_json(
        &base,
        "/api/oauth/approve",
        Some(&cookie),
        &json!({ "query": other }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(refused["error"], "bad-redirect");
    // Nor without PKCE.
    let plain = query.replace("S256", "plain");
    let (status, _) = post_json(
        &base,
        "/api/oauth/approve",
        Some(&cookie),
        &json!({ "query": plain }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    // Saying no tells the assistant so.
    let (status, denied) = post_json(
        &base,
        "/api/oauth/deny",
        Some(&cookie),
        &json!({ "query": query }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(
        denied["redirect"]
            .as_str()
            .unwrap()
            .contains("error=access_denied")
    );
    // And approving needs the reader signed in, from nine turtles' own page.
    let (status, _) = post_json(
        &base,
        "/api/oauth/approve",
        None,
        &json!({ "query": query }),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn an_assistant_gets_links_without_tracking_tags_even_old_ones() {
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (status, _) = post_json(
        &base,
        "/api/feeds",
        Some(&cookie),
        &json!({ "address": publisher("Garden Notes").await }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    // As if stored before tracking tags were taken out on arrival (decision 0112).
    sqlx::query("UPDATE articles SET link = link || '?utm_source=rss'")
        .execute(&state.db)
        .await
        .unwrap();
    let (access, _) = connect(&base, &cookie).await;

    for (name, arguments) in [
        ("list_unread", json!({})),
        ("search_articles", json!({ "query": "gardens" })),
    ] {
        let (answer, error) = tool(&base, &access, name, arguments).await;
        assert!(!error, "{name}");
        let articles = answer["articles"].as_array().unwrap();
        assert!(!articles.is_empty(), "{name}");
        for article in articles {
            let link = article["link"].as_str().unwrap();
            assert!(!link.contains("utm_source"), "{name}: {link}");
        }
    }
}

#[tokio::test]
async fn an_assistant_sees_only_its_own_readers_things() {
    let (base, state) = common::start_with_state(common::config()).await;
    let owner = common::signed_in(&base).await;
    let (_, added) = post_json(
        &base,
        "/api/feeds",
        Some(&owner),
        &json!({ "address": publisher("Owner Blog").await }),
    )
    .await;
    let owners_feed = added["feed"]["id"].as_i64().unwrap();
    let (_, reader) = common::another_reader(&state).await;
    let (access, _) = connect(&base, &reader).await;

    let (feeds, _) = tool(&base, &access, "list_feeds", json!({})).await;
    assert_eq!(feeds["feeds"], json!([]));
    let (found, _) = tool(
        &base,
        &access,
        "search_articles",
        json!({ "query": "gardens" }),
    )
    .await;
    assert_eq!(found["articles"], json!([]));
    let (_, error) = tool(
        &base,
        &access,
        "unsubscribe_feed",
        json!({ "feed_id": owners_feed }),
    )
    .await;
    assert!(error);
    let (_, error) = tool(
        &base,
        &access,
        "edit_feed",
        json!({ "feed_id": owners_feed, "title": "Mine now" }),
    )
    .await;
    assert!(error);
    let (_, unread) = get_json(&base, "/api/feeds", &owner).await;
    assert_eq!(unread["feeds"][0]["title"], "Owner Blog");
    assert_eq!(unread["feeds"][0]["unread"], 5);
}

#[tokio::test]
async fn an_assistant_key_works_until_turned_off() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (status, made) = post_json(
        &base,
        "/api/assistants/key",
        Some(&cookie),
        &json!({ "name": "My script" }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let key = made["key"].as_str().unwrap();
    assert!(key.starts_with("nt_"));
    let (_, error) = tool(&base, key, "list_feeds", json!({})).await;
    assert!(!error);
    let id = made["assistant"]["id"].as_i64().unwrap();
    post_json(
        &base,
        &format!("/api/assistants/{id}/disconnect"),
        Some(&cookie),
        &json!({}),
    )
    .await;
    assert_eq!(
        rpc(&base, key, "tools/list", json!({})).await.status(),
        StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn a_feed_an_assistant_unsubscribes_from_is_kept_for_thirty_days() {
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (_, added) = post_json(
        &base,
        "/api/feeds",
        Some(&cookie),
        &json!({ "address": publisher("Kept Blog").await }),
    )
    .await;
    let feed = added["feed"]["id"].as_i64().unwrap();
    let (_, other) = post_json(
        &base,
        "/api/feeds",
        Some(&cookie),
        &json!({ "address": publisher("Other Blog").await }),
    )
    .await;
    let other = other["feed"]["id"].as_i64().unwrap();
    let (status, made) = post_json(&base, "/api/assistants/key", Some(&cookie), &json!({})).await;
    assert_eq!(status, StatusCode::CREATED);
    let key = made["key"].as_str().unwrap();

    let (answer, error) = tool(&base, key, "unsubscribe_feed", json!({ "feed_id": feed })).await;
    assert!(!error, "{answer}");
    // Settings offers it back.
    let (_, listed) = get_json(&base, "/api/assistants", &cookie).await;
    assert_eq!(listed["unsubscribed"][0]["feed_id"], feed);
    assert_eq!(listed["unsubscribed"][0]["title"], "Kept Blog");

    // Long past the screen's ten minutes, and after the reader unsubscribes
    // from another feed themselves, it's still there.
    sqlx::query(
        "UPDATE subscriptions SET unsubscribed_at = unsubscribed_at - 86400 WHERE feed_id = ?",
    )
    .bind(feed)
    .execute(&state.db)
    .await
    .unwrap();
    let (status, _) = post_json(
        &base,
        &format!("/api/feeds/{other}/unsubscribe"),
        Some(&cookie),
        &json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    nine_turtles::folders::clear_unsubscribed(&state.db, None, nine_turtles::now())
        .await
        .unwrap();
    let (status, _) = post_json(
        &base,
        &format!("/api/feeds/{feed}/resubscribe"),
        Some(&cookie),
        &json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (_, feeds) = get_json(&base, "/api/feeds", &cookie).await;
    assert_eq!(feeds["feeds"][0]["title"], "Kept Blog");
    assert_eq!(
        feeds["feeds"][0]["unread"], 5,
        "its articles and marks came back"
    );

    // After 30 days it's cleared as any unsubscribed feed is.
    tool(&base, key, "unsubscribe_feed", json!({ "feed_id": feed })).await;
    sqlx::query("UPDATE subscriptions SET kept_until = unixepoch() - 1 WHERE feed_id = ?")
        .bind(feed)
        .execute(&state.db)
        .await
        .unwrap();
    nine_turtles::folders::clear_unsubscribed(&state.db, None, nine_turtles::now())
        .await
        .unwrap();
    let (_, error) = tool(&base, key, "resubscribe_feed", json!({ "feed_id": feed })).await;
    assert!(error, "too late");
    let (_, listed) = get_json(&base, "/api/assistants", &cookie).await;
    assert_eq!(listed["unsubscribed"], json!([]));
}

#[tokio::test]
async fn removing_a_folder_or_rule_can_be_undone_by_the_assistant() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (_, added) = post_json(
        &base,
        "/api/feeds",
        Some(&cookie),
        &json!({ "address": publisher("Folder Blog").await }),
    )
    .await;
    let feed = added["feed"]["id"].as_i64().unwrap();
    let (_, made) = post_json(&base, "/api/assistants/key", Some(&cookie), &json!({})).await;
    let key = made["key"].as_str().unwrap();
    tool(
        &base,
        key,
        "edit_feed",
        json!({ "feed_id": feed, "folders": ["Reading"] }),
    )
    .await;
    let (feeds, _) = tool(&base, key, "list_feeds", json!({})).await;
    let folder = feeds["folders"][0]["id"].as_i64().unwrap();
    let (rule, _) = tool(
        &base,
        key,
        "add_rule",
        json!({ "words": "gardens", "folder_id": folder, "action": "star" }),
    )
    .await;

    let (_, saved) = post_json(
        &base,
        "/api/saved-searches",
        Some(&cookie),
        &json!({ "name": "Roses", "query": { "words": "roses", "scope": { "kind": "folder", "id": folder } } }),
    )
    .await;

    let (removed, error) = tool(&base, key, "delete_folder", json!({ "folder_id": folder })).await;
    assert!(!error);
    assert_eq!(removed["feed_ids"], json!([feed]));
    assert_eq!(removed["rule_ids"], json!([rule["rule_id"]]));
    assert_eq!(removed["search_ids"], json!([saved["search"]["id"]]));
    let (back, error) = tool(
        &base,
        key,
        "create_folder",
        json!({ "name": removed["removed"], "feed_ids": removed["feed_ids"], "rule_ids": removed["rule_ids"], "search_ids": removed["search_ids"] }),
    )
    .await;
    assert!(!error);
    let (_, searches) = get_json(&base, "/api/saved-searches", &cookie).await;
    assert_eq!(
        searches["searches"][0]["query"]["scope"]["id"],
        back["folder_id"]
    );
    let (feeds, _) = tool(&base, key, "list_feeds", json!({})).await;
    assert_eq!(feeds["feeds"][0]["folders"], json!(["Reading"]));
    let (rules, _) = tool(&base, key, "list_rules", json!({})).await;
    assert_eq!(rules["rules"][0]["folder_id"], back["folder_id"]);
    assert_eq!(rules["rules"][0]["place_gone"], false);

    let (gone, _) = tool(
        &base,
        key,
        "delete_rule",
        json!({ "rule_id": rule["rule_id"] }),
    )
    .await;
    let removed = &gone["removed"];
    let (_, error) = tool(
        &base,
        key,
        "add_rule",
        json!({ "words": removed["words"], "folder_id": back["folder_id"], "action": removed["action"], "paused": removed["paused"] }),
    )
    .await;
    assert!(!error);
}

#[tokio::test]
async fn a_kept_feed_added_again_comes_back_whole() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let address = publisher("Whole Blog").await;
    let (_, added) = post_json(
        &base,
        "/api/feeds",
        Some(&cookie),
        &json!({ "address": address }),
    )
    .await;
    let feed = added["feed"]["id"].as_i64().unwrap();
    let (_, made) = post_json(&base, "/api/assistants/key", Some(&cookie), &json!({})).await;
    let key = made["key"].as_str().unwrap();
    let (unread, _) = tool(&base, key, "list_unread", json!({})).await;
    let first = unread["articles"][0]["id"].as_i64().unwrap();
    tool(
        &base,
        key,
        "mark_read",
        json!({ "article_ids": [first], "read": true }),
    )
    .await;
    tool(&base, key, "unsubscribe_feed", json!({ "feed_id": feed })).await;

    // Through the Add field: back with its read mark, not afresh.
    let (status, again) = post_json(
        &base,
        "/api/feeds",
        Some(&cookie),
        &json!({ "address": address }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{again}");
    assert_eq!(again["feed"]["id"], feed);
    assert_eq!(again["feed"]["unread"], 4);
    let (_, listed) = get_json(&base, "/api/assistants", &cookie).await;
    assert_eq!(listed["unsubscribed"], json!([]));
}

#[tokio::test]
async fn an_assistant_cant_keep_a_feed_the_reader_unsubscribed_from() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (_, added) = post_json(
        &base,
        "/api/feeds",
        Some(&cookie),
        &json!({ "address": publisher("Gone Blog").await }),
    )
    .await;
    let feed = added["feed"]["id"].as_i64().unwrap();
    let (status, _) = post_json(
        &base,
        &format!("/api/feeds/{feed}/unsubscribe"),
        Some(&cookie),
        &json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (_, made) = post_json(&base, "/api/assistants/key", Some(&cookie), &json!({})).await;
    let (_, error) = tool(
        &base,
        made["key"].as_str().unwrap(),
        "unsubscribe_feed",
        json!({ "feed_id": feed }),
    )
    .await;
    assert!(error);
    let (_, listed) = get_json(&base, "/api/assistants", &cookie).await;
    assert_eq!(
        listed["unsubscribed"],
        json!([]),
        "it keeps the screen's ten minutes"
    );
}

#[tokio::test]
async fn a_busy_assistant_is_asked_to_wait() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let (_, made) = post_json(&base, "/api/assistants/key", Some(&cookie), &json!({})).await;
    let key = made["key"].as_str().unwrap();
    for _ in 0..60 {
        let (_, error) = tool(&base, key, "list_rules", json!({})).await;
        assert!(!error);
    }
    let (said, error) = tool(&base, key, "list_rules", json!({})).await;
    assert!(error);
    assert!(said.as_str().unwrap().contains("wait"));

    // Registering: ten an hour from one address, then others still can.
    let register_from = |address: &'static str| {
        let base = base.clone();
        async move {
            Client::new()
                .post(format!("{base}/oauth/register"))
                .header("x-forwarded-for", address)
                .header("content-type", "application/json")
                .body(json!({ "redirect_uris": [REDIRECT] }).to_string())
                .send()
                .await
                .unwrap()
                .status()
        }
    };
    for _ in 0..10 {
        assert_eq!(register_from("203.0.113.9").await, StatusCode::CREATED);
    }
    assert_eq!(
        register_from("203.0.113.9").await,
        StatusCode::TOO_MANY_REQUESTS
    );
    assert_eq!(register_from("198.51.100.4").await, StatusCode::CREATED);
}

#[tokio::test(flavor = "multi_thread")]
async fn two_codes_swapped_at_once_keep_one_line_in_settings() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let client_id = register(&base).await;
    let query = authorize_query(&client_id);
    // The reader approves twice (two tabs, say), and the assistant swaps both
    // codes at the same moment (survey A9.5).
    let mut codes = Vec::new();
    for _ in 0..8 {
        let (status, approved) = post_json(
            &base,
            "/api/oauth/approve",
            Some(&cookie),
            &json!({ "query": query }),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let back = Url::parse(approved["redirect"].as_str().unwrap()).unwrap();
        let (_, code) = back.query_pairs().find(|(key, _)| key == "code").unwrap();
        codes.push(code.into_owned());
    }
    let swaps: Vec<_> = codes
        .into_iter()
        .map(|code| {
            let (base, client_id) = (base.clone(), client_id.clone());
            tokio::spawn(async move {
                token(
                    &base,
                    &[
                        ("grant_type", "authorization_code"),
                        ("code", &code),
                        ("client_id", &client_id),
                        ("code_verifier", VERIFIER),
                    ],
                )
                .await
            })
        })
        .collect();
    for swap in swaps {
        let (status, tickets) = swap.await.unwrap();
        assert_eq!(status, StatusCode::OK, "{tickets}");
    }
    let (_, listed) = get_json(&base, "/api/assistants", &cookie).await;
    assert_eq!(
        listed["assistants"].as_array().unwrap().len(),
        1,
        "{listed}"
    );
}
