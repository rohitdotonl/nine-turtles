//! WebSub: instant updates from publishers who offer them (SPEC section 12),
//! tested against a real nine turtles and a made-up publisher with its own
//! made-up hub, which records every request nine turtles sends it.

mod common;

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use axum::{
    Router,
    extract::State,
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
};
use hmac::{Hmac, KeyInit, Mac};
use nine_turtles::{
    AppState,
    checking::{self, HOUR},
    feed::Hub,
    websub::{self, LEASE},
};
use reqwest::{Client, Url};
use serde_json::json;

#[derive(Default)]
struct Site {
    base: String,
    /// Each form the hub was sent, as its fields.
    asked: Vec<HashMap<String, String>>,
}

type Shared = Arc<Mutex<Site>>;

async fn publisher() -> (String, Shared) {
    let site: Shared = Arc::default();
    let app = Router::new().fallback(serve).with_state(site.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    site.lock().unwrap().base.clone_from(&base);
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (base, site)
}

async fn serve(State(site): State<Shared>, uri: Uri, body: String) -> Response {
    let mut site = site.lock().unwrap();
    if uri.path() == "/hub" {
        let form = Url::parse(&format!("http://form.invalid/?{body}")).unwrap();
        site.asked.push(form.query_pairs().into_owned().collect());
        return StatusCode::ACCEPTED.into_response();
    }
    (
        [(header::CONTENT_TYPE, "application/atom+xml")],
        atom(&site.base, &["Post 1"]),
    )
        .into_response()
}

fn atom(base: &str, posts: &[&str]) -> String {
    let entries: String = posts
        .iter()
        .map(|title| {
            format!(
                "<entry><title>{title}</title><id>{title}</id>\
                 <updated>2026-10-20T00:00:00Z</updated></entry>"
            )
        })
        .collect();
    format!(
        r#"<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<title>Instant Notes</title><id>instant</id><updated>2026-10-20T00:00:00Z</updated>
<link rel="hub" href="{base}/hub" /><link rel="self" href="{base}/feed.xml" />
{entries}</feed>"#
    )
}

fn signature(secret: &str, body: &str) -> String {
    let mut mac = <Hmac<sha2::Sha256> as KeyInit>::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(body.as_bytes());
    let hex: String = mac
        .finalize()
        .into_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    format!("sha256={hex}")
}

async fn articles(state: &AppState, feed_id: i64) -> Vec<String> {
    sqlx::query_scalar("SELECT title FROM articles WHERE feed_id = ? ORDER BY id")
        .bind(feed_id)
        .fetch_all(&state.db)
        .await
        .unwrap()
}

async fn asked(site: &Shared, count: usize) -> Vec<HashMap<String, String>> {
    for _ in 0..100 {
        let asked = site.lock().unwrap().asked.clone();
        if asked.len() >= count {
            return asked;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    panic!("the hub wasn't asked {count} times");
}

#[tokio::test]
async fn a_feed_with_a_hub_gets_new_articles_the_moment_they_are_published() {
    let (site_base, site) = publisher().await;
    let mut config = common::config();
    // Hubs are told this address; the test delivers to the real one itself.
    config.public_url = Some(Url::parse("https://nine-turtles.example").unwrap());
    let (base, state) = common::start_with_state(config).await;
    let cookie = common::signed_in(&base).await;
    let client = Client::new();

    let added = client
        .post(format!("{base}/api/feeds"))
        .header("cookie", &cookie)
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body(json!({ "address": format!("{site_base}/feed.xml") }).to_string())
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    let added: serde_json::Value = serde_json::from_str(&added).unwrap();
    let feed_id = added["feed"]["id"].as_i64().unwrap();

    // Adding the feed asked its hub to deliver, with a secret of its own.
    let form = asked(&site, 1).await.remove(0);
    assert_eq!(form["hub.mode"], "subscribe");
    assert_eq!(form["hub.topic"], format!("{site_base}/feed.xml"));
    assert_eq!(form["hub.lease_seconds"], LEASE.to_string());
    let secret = form["hub.secret"].clone();
    assert_eq!(secret.len(), 64);
    let path = form["hub.callback"]
        .strip_prefix("https://nine-turtles.example")
        .unwrap()
        .to_owned();
    assert!(path.starts_with("/websub/"), "{path}");
    let callback = format!("{base}{path}");
    let now = nine_turtles::now();
    assert!(!websub::delivering(&state.db, feed_id, now).await.unwrap());

    // The hub checks nine turtles asked. A wrong feed or address is refused.
    let verify = |address: &str, topic: &str| {
        let mut url = Url::parse(address).unwrap();
        url.query_pairs_mut().extend_pairs([
            ("hub.mode", "subscribe"),
            ("hub.topic", topic),
            ("hub.challenge", "quiet-word-42"),
            ("hub.lease_seconds", "86400"),
        ]);
        client.get(url).send()
    };
    let topic = format!("{site_base}/feed.xml");
    let wrong = verify(&callback, "https://elsewhere.example/feed")
        .await
        .unwrap();
    assert_eq!(wrong.status(), StatusCode::NOT_FOUND);
    let unknown = verify(&format!("{base}/websub/not-a-token"), &topic)
        .await
        .unwrap();
    assert_eq!(unknown.status(), StatusCode::NOT_FOUND);
    let right = verify(&callback, &topic).await.unwrap();
    assert_eq!(right.status(), StatusCode::OK);
    assert_eq!(right.text().await.unwrap(), "quiet-word-42");
    assert!(websub::delivering(&state.db, feed_id, now).await.unwrap());

    // A signed delivery is stored at once; a forged one is ignored, though
    // still answered "received".
    let deliver = |body: String, signature: Option<String>| {
        let mut request = client
            .post(&callback)
            .header("content-type", "application/atom+xml")
            .body(body);
        if let Some(signature) = signature {
            request = request.header("x-hub-signature", signature);
        }
        request.send()
    };
    let fresh = atom(&site_base, &["Post 2"]);
    let forged = atom(&site_base, &["Forged"]);
    let answer = deliver(forged.clone(), Some(signature("not the secret", &forged)))
        .await
        .unwrap();
    assert_eq!(answer.status(), StatusCode::ACCEPTED);
    let answer = deliver(forged, None).await.unwrap();
    assert_eq!(answer.status(), StatusCode::ACCEPTED);
    let answer = deliver(fresh.clone(), Some(signature(&secret, &fresh)))
        .await
        .unwrap();
    assert_eq!(answer.status(), StatusCode::ACCEPTED);
    assert_eq!(articles(&state, feed_id).await, ["Post 1", "Post 2"]);

    // A delivery that only says "it changed" makes the feed due now.
    // (Last checked an hour ago, so it may be checked again now.)
    sqlx::query("UPDATE feeds SET next_check_at = ?, fetched_at = ? WHERE id = ?")
        .bind(now + 2 * HOUR)
        .bind(now - HOUR)
        .bind(feed_id)
        .execute(&state.db)
        .await
        .unwrap();
    deliver(String::new(), Some(signature(&secret, "")))
        .await
        .unwrap();
    let due: i64 = sqlx::query_scalar("SELECT next_check_at FROM feeds WHERE id = ?")
        .bind(feed_id)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert!(due <= nine_turtles::now(), "{due}");
    // Just checked: however often the hub says so, not sooner than 30 minutes.
    sqlx::query("UPDATE feeds SET next_check_at = ?, fetched_at = ? WHERE id = ?")
        .bind(now + 2 * HOUR)
        .bind(now)
        .bind(feed_id)
        .execute(&state.db)
        .await
        .unwrap();
    for _ in 0..3 {
        deliver(String::new(), Some(signature(&secret, "")))
            .await
            .unwrap();
    }
    let due: i64 = sqlx::query_scalar("SELECT next_check_at FROM feeds WHERE id = ?")
        .bind(feed_id)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(due, now + checking::SHORTEST_WAIT);

    // While the hub delivers, the regular check is only a backup: at most
    // twice a day.
    checking::check(&state, feed_id, now).await.unwrap();
    let next: i64 = sqlx::query_scalar("SELECT next_check_at FROM feeds WHERE id = ?")
        .bind(feed_id)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert!(next >= now + websub::BACKUP_WAIT, "{}", next - now);

    // A day before the lease ends, nine turtles asks again, at the same
    // address with the same secret. Asked once, it doesn't ask again that day.
    let ends_soon = now + websub::LEASE;
    sqlx::query("UPDATE websub SET active_until = ?, asked_at = ? WHERE feed_id = ?")
        .bind(ends_soon)
        .bind(now)
        .bind(feed_id)
        .execute(&state.db)
        .await
        .unwrap();
    let almost_over = ends_soon - HOUR;
    websub::renew(&state, almost_over).await.unwrap();
    let renewal = asked(&site, 2).await.remove(1);
    assert_eq!(renewal["hub.callback"], form["hub.callback"]);
    assert_eq!(renewal["hub.secret"], secret);
    websub::renew(&state, almost_over + 60).await.unwrap();
    assert_eq!(site.lock().unwrap().asked.len(), 2);

    // Unsubscribed: the hub's deliveries and checks are refused.
    sqlx::query("UPDATE feeds SET unsubscribed_at = ? WHERE id = ?")
        .bind(now)
        .bind(feed_id)
        .execute(&state.db)
        .await
        .unwrap();
    let after = deliver(fresh.clone(), Some(signature(&secret, &fresh)))
        .await
        .unwrap();
    assert_eq!(after.status(), StatusCode::NOT_FOUND);
    assert_eq!(
        verify(&callback, &topic).await.unwrap().status(),
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn without_a_public_address_nine_turtles_never_signs_up() {
    let (site_base, site) = publisher().await;
    let (base, state) = common::start_with_state(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let response = Client::new()
        .post(format!("{base}/api/feeds"))
        .header("cookie", &cookie)
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body(json!({ "address": format!("{site_base}/feed.xml") }).to_string())
        .send()
        .await
        .unwrap();
    assert!(response.status().is_success());
    checking::round(&state, nine_turtles::now() + 2 * checking::DAY)
        .await
        .unwrap();
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    assert!(site.lock().unwrap().asked.is_empty());
    let lines: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM websub")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(lines, 0);
}

/// Adds the made-up publisher's feed to a nine turtles that tells hubs a
/// public address, and returns the feed's number once its hub was asked.
async fn following_with_a_hub() -> (String, AppState, Shared, i64) {
    let (site_base, site) = publisher().await;
    let mut config = common::config();
    config.public_url = Some(Url::parse("https://nine-turtles.example").unwrap());
    let (base, state) = common::start_with_state(config).await;
    let cookie = common::signed_in(&base).await;
    let added = Client::new()
        .post(format!("{base}/api/feeds"))
        .header("cookie", &cookie)
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body(json!({ "address": format!("{site_base}/feed.xml") }).to_string())
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    let added: serde_json::Value = serde_json::from_str(&added).unwrap();
    asked(&site, 1).await;
    (base, state, site, added["feed"]["id"].as_i64().unwrap())
}

fn callback_of(base: &str, form: &HashMap<String, String>) -> String {
    let path = form["hub.callback"]
        .strip_prefix("https://nine-turtles.example")
        .unwrap();
    format!("{base}{path}")
}

async fn verify(callback: &str, mode: &str, topic: &str, lease: &str) -> StatusCode {
    let mut url = Url::parse(callback).unwrap();
    url.query_pairs_mut().extend_pairs([
        ("hub.mode", mode),
        ("hub.topic", topic),
        ("hub.challenge", "word"),
        ("hub.lease_seconds", lease),
    ]);
    Client::new().get(url).send().await.unwrap().status()
}

async fn number(state: &AppState, sql: &'static str, feed_id: i64) -> Option<i64> {
    sqlx::query_scalar(sql)
        .bind(feed_id)
        .fetch_one(&state.db)
        .await
        .unwrap()
}

#[tokio::test]
async fn a_ping_never_overrides_a_publishers_request_to_slow_down() {
    let (base, state, site, feed_id) = following_with_a_hub().await;
    let form = asked(&site, 1).await.remove(0);
    let callback = callback_of(&base, &form);
    let now = nine_turtles::now();
    // The publisher said "slow down": the next check is in two days.
    sqlx::query(
        "UPDATE feeds SET failures = 1, problem = 'slow-down', next_check_at = ?,
             fetched_at = ? WHERE id = ?",
    )
    .bind(now + 2 * checking::DAY)
    .bind(now - checking::DAY)
    .bind(feed_id)
    .execute(&state.db)
    .await
    .unwrap();
    let answer = Client::new()
        .post(&callback)
        .header("x-hub-signature", signature(&form["hub.secret"], ""))
        .send()
        .await
        .unwrap();
    assert_eq!(answer.status(), StatusCode::ACCEPTED);
    let due = number(
        &state,
        "SELECT next_check_at FROM feeds WHERE id = ?",
        feed_id,
    )
    .await;
    assert_eq!(due, Some(now + 2 * checking::DAY));
}

#[tokio::test]
async fn hubs_that_refuse_change_or_disappear_are_handled() {
    let (base, state, site, feed_id) = following_with_a_hub().await;
    let first = asked(&site, 1).await.remove(0);
    let topic = first["hub.topic"].clone();
    let callback = callback_of(&base, &first);
    let active = "SELECT active_until FROM websub WHERE feed_id = ?";
    let lease = "SELECT lease FROM websub WHERE feed_id = ?";

    // Leases are believed between an hour and 30 days.
    assert_eq!(
        verify(&callback, "subscribe", &topic, "5").await,
        StatusCode::OK
    );
    assert_eq!(number(&state, lease, feed_id).await, Some(HOUR));
    let years = (400 * checking::DAY).to_string();
    assert_eq!(
        verify(&callback, "subscribe", &topic, &years).await,
        StatusCode::OK
    );
    assert_eq!(
        number(&state, lease, feed_id).await,
        Some(30 * checking::DAY)
    );
    // nine turtles never agrees to stop while it follows the feed.
    assert_eq!(
        verify(&callback, "unsubscribe", &topic, "").await,
        StatusCode::NOT_FOUND
    );

    // The hub says no: back to ordinary checks, and asked again only after a week.
    assert_eq!(
        verify(&callback, "denied", &topic, "").await,
        StatusCode::OK
    );
    assert_eq!(number(&state, active, feed_id).await, None);
    let now = nine_turtles::now();
    assert!(!websub::delivering(&state.db, feed_id, now).await.unwrap());
    websub::renew(&state, now + checking::DAY).await.unwrap();
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    assert_eq!(site.lock().unwrap().asked.len(), 1);
    websub::renew(&state, now + websub::ASK_AGAIN_AFTER + 60)
        .await
        .unwrap();
    let again = asked(&site, 2).await.remove(1);
    assert_eq!(again["hub.callback"], first["hub.callback"]);

    // The feed names another hub: a fresh address and secret; the old
    // address is no longer recognized.
    let site_base = site.lock().unwrap().base.clone();
    let moved = Hub {
        hub: Url::parse(&format!("{site_base}/hub?new")).unwrap(),
        topic: Url::parse(&topic).unwrap(),
    };
    websub::offered(&state, feed_id, Some(&moved), now)
        .await
        .unwrap();
    let third = asked(&site, 3).await.remove(2);
    assert_ne!(third["hub.callback"], first["hub.callback"]);
    assert_ne!(third["hub.secret"], first["hub.secret"]);
    assert_eq!(
        verify(&callback, "subscribe", &topic, "86400").await,
        StatusCode::NOT_FOUND
    );
    // Offered the same hub again: nothing new is asked.
    websub::offered(&state, feed_id, Some(&moved), now)
        .await
        .unwrap();
    assert_eq!(site.lock().unwrap().asked.len(), 3);

    // The feed stops naming a hub: the subscription is forgotten.
    websub::offered(&state, feed_id, None, now).await.unwrap();
    let lines = number(
        &state,
        "SELECT COUNT(*) FROM websub WHERE feed_id = ?",
        feed_id,
    )
    .await;
    assert_eq!(lines, Some(0));
}

#[tokio::test]
async fn unsubscribing_from_a_feed_with_a_hub_clears_it_as_usual() {
    let (base, state, site, feed_id) = following_with_a_hub().await;
    let form = asked(&site, 1).await.remove(0);
    let cookie = common::signed_in(&base).await;
    let gone = Client::new()
        .post(format!("{base}/api/feeds/{feed_id}/unsubscribe"))
        .header("cookie", &cookie)
        .header("sec-fetch-site", "same-origin")
        .send()
        .await
        .unwrap();
    assert!(gone.status().is_success(), "{}", gone.status());
    let cleared = nine_turtles::folders::clear_unsubscribed(&state.db, None, i64::MAX)
        .await
        .unwrap();
    assert_eq!(cleared, 1);
    let feeds = number(&state, "SELECT COUNT(*) FROM feeds WHERE id = ?", feed_id).await;
    assert_eq!(feeds, Some(0));
    let lines = number(
        &state,
        "SELECT COUNT(*) FROM websub WHERE feed_id = ?",
        feed_id,
    )
    .await;
    assert_eq!(lines, Some(0));
    assert_eq!(
        verify(
            &callback_of(&base, &form),
            "subscribe",
            &form["hub.topic"],
            "86400"
        )
        .await,
        StatusCode::NOT_FOUND
    );
}
