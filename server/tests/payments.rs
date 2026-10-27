//! Paying through Dodo Payments (SPEC section 29, decision 0094): off
//! without the settings; with them, a free trial, then a plan bought on
//! Dodo's checkout and kept up to date by Dodo's signed messages. A made-up
//! Dodo, on this computer, stands in for the real one.

mod common;

use std::sync::{Arc, Mutex};

use axum::{
    Json, Router,
    body::Bytes,
    extract::State,
    http::{HeaderMap, Method, StatusCode, Uri},
};
use hmac::{Hmac, KeyInit, Mac};
use nine_turtles::payments::{self, Settings};
use serde_json::{Value, json};

const DAY: i64 = 24 * 60 * 60;
/// The made-up webhook secret's key ("a made-up webhook key!").
const KEY: &[u8] = b"a made-up webhook key!";

/// What the made-up Dodo was asked: method, path with query, body.
type Asked = Arc<Mutex<Vec<(String, String, Value)>>>;

async fn made_up_dodo(
    State(asked): State<Asked>,
    method: Method,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> (StatusCode, Json<Value>) {
    assert_eq!(headers["authorization"], "Bearer test-api-key");
    let body = serde_json::from_slice(&body).unwrap_or(Value::Null);
    asked
        .lock()
        .unwrap()
        .push((method.to_string(), uri.to_string(), body));
    let status = if uri.path().contains("sub_broken") {
        StatusCode::INTERNAL_SERVER_ERROR
    } else if uri.path().contains("sub_gone") {
        StatusCode::NOT_FOUND
    } else {
        StatusCode::OK
    };
    let answer = json!({
        "session_id": "cks_1",
        "checkout_url": "https://test.checkout.example/cks_1",
        "link": "https://test.portal.example/cus_1",
    });
    (status, Json(answer))
}

/// Starts the made-up Dodo; answers its address and what it was asked.
async fn start_dodo() -> (reqwest::Url, Asked) {
    let asked = Asked::default();
    let app = Router::new()
        .fallback(made_up_dodo)
        .with_state(asked.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (
        reqwest::Url::parse(&format!("http://{address}/")).unwrap(),
        asked,
    )
}

fn settings(api_url: reqwest::Url) -> Settings {
    Settings {
        api_key: "test-api-key".to_owned(),
        webhook_key: KEY.to_vec(),
        monthly_product: "pdt_monthly".to_owned(),
        yearly_product: Some("pdt_yearly".to_owned()),
        api_url,
        live: false,
        monthly_price: "$5 a month".to_owned(),
        yearly_price: Some("$50 a year".to_owned()),
        trial_days: 14,
    }
}

async fn start_with_payments() -> (String, nine_turtles::AppState, Asked) {
    let (dodo, asked) = start_dodo().await;
    let mut config = common::config();
    config.public_url = Some(reqwest::Url::parse("https://app.example").unwrap());
    config.payments = Some(settings(dodo));
    let (base, state) = common::start_with_state(config).await;
    (base, state, asked)
}

/// A reader with an email, as signing up makes them.
async fn reader(state: &nine_turtles::AppState) -> (i64, String) {
    let (person, cookie) = common::another_reader(state).await;
    sqlx::query("UPDATE people SET email = ? WHERE id = ?")
        .bind(format!("reader{person}@example.com"))
        .bind(person)
        .execute(&state.db)
        .await
        .unwrap();
    (person, cookie)
}

async fn body(response: reqwest::Response) -> Value {
    serde_json::from_slice(&response.bytes().await.unwrap()).unwrap()
}

async fn get(base: &str, cookie: &str, path: &str) -> Value {
    let response = reqwest::Client::new()
        .get(format!("{base}{path}"))
        .header("cookie", cookie)
        .send()
        .await
        .unwrap();
    body(response).await
}

async fn post(base: &str, cookie: &str, path: &str, body: Value) -> reqwest::Response {
    reqwest::Client::new()
        .post(format!("{base}{path}"))
        .header("cookie", cookie)
        .header("content-type", "application/json")
        .header("sec-fetch-site", "same-origin")
        .body(body.to_string())
        .send()
        .await
        .unwrap()
}

/// Sends a message as Dodo would, signed (or not) with the webhook key.
async fn message(base: &str, id: &str, event: &Value, signed: bool) -> reqwest::Response {
    let body = event.to_string();
    let timestamp = nine_turtles::now().to_string();
    let mut mac = <Hmac<sha2::Sha256> as KeyInit>::new_from_slice(KEY).unwrap();
    mac.update(format!("{id}.{timestamp}.{body}").as_bytes());
    let mut signature = payments::base64_encode(&mac.finalize().into_bytes());
    if !signed {
        signature = payments::base64_encode(b"not the signature at all, no");
    }
    reqwest::Client::new()
        .post(format!("{base}/payments/dodo"))
        .header("content-type", "application/json")
        .header("webhook-id", id)
        .header("webhook-timestamp", timestamp)
        .header("webhook-signature", format!("v1,{signature}"))
        .body(body)
        .send()
        .await
        .unwrap()
}

fn subscription(kind: &str, person: i64, status: &str, next: i64, ending: bool) -> Value {
    about(
        "sub_1",
        nine_turtles::now(),
        kind,
        person,
        status,
        next,
        ending,
    )
}

/// A message about subscription `id`, sent at `at`.
fn about(
    id: &str,
    at: i64,
    kind: &str,
    person: i64,
    status: &str,
    next: i64,
    ending: bool,
) -> Value {
    json!({
        "business_id": "bus_1",
        "type": kind,
        "timestamp": nine_turtles::starred::rfc3339(at),
        "data": {
            "payload_type": "Subscription",
            "subscription_id": id,
            "product_id": "pdt_monthly",
            "status": status,
            "next_billing_date": nine_turtles::starred::rfc3339(next),
            "cancel_at_next_billing_date": ending,
            "customer": { "customer_id": "cus_1", "email": format!("reader{person}@example.com") },
            "metadata": { "person_id": person.to_string() },
        }
    })
}

/// Moves a reader's joining, and payments' switching on, `days` back.
async fn joined_days_ago(state: &nine_turtles::AppState, person: i64, days: i64) {
    // A minute more, so "4 days ago" never rounds back up to 4 days.
    let at = nine_turtles::now() - days * DAY - 60;
    sqlx::query("UPDATE people SET created_at = ? WHERE id = ?")
        .bind(at)
        .bind(person)
        .execute(&state.db)
        .await
        .unwrap();
    sqlx::query("UPDATE settings SET value = ? WHERE name = 'payments_on_at'")
        .bind(at.to_string())
        .execute(&state.db)
        .await
        .unwrap();
}

#[tokio::test]
async fn without_the_settings_nobody_pays_and_dodo_has_no_door() {
    let (base, state) = common::start_with_state(common::config()).await;
    let (_, cookie) = reader(&state).await;
    assert_eq!(
        get(&base, &cookie, "/api/plan").await,
        json!({ "on": false })
    );
    let event = subscription("subscription.active", 2, "active", 0, false);
    assert_eq!(message(&base, "msg_1", &event, true).await.status(), 404);
}

#[tokio::test]
async fn a_new_reader_has_a_free_trial_and_the_owner_never_pays() {
    let (base, state, _) = start_with_payments().await;
    let (_, cookie) = reader(&state).await;
    let plan = get(&base, &cookie, "/api/plan").await;
    assert_eq!(plan["on"], true);
    assert_eq!(plan["test_mode"], true);
    assert_eq!(plan["plan"]["standing"], "trial");
    let ends = plan["plan"]["ends_at"].as_i64().unwrap();
    assert!(
        (ends - (nine_turtles::now() + 14 * DAY)).abs() < 60,
        "{plan}"
    );
    assert_eq!(plan["prices"]["monthly"], "$5 a month");
    assert_eq!(plan["can_manage"], false);

    let owner = common::signed_in(&base).await;
    assert_eq!(
        get(&base, &owner, "/api/plan").await["plan"]["standing"],
        "free"
    );
}

#[tokio::test]
async fn after_the_trial_a_reader_reads_but_cant_add_feeds() {
    let (base, state, _) = start_with_payments().await;
    let (person, cookie) = reader(&state).await;
    joined_days_ago(&state, person, 15).await;
    assert_eq!(
        get(&base, &cookie, "/api/plan").await["plan"]["standing"],
        "ended"
    );
    let added = post(
        &base,
        &cookie,
        "/api/feeds",
        json!({ "address": "https://example.com/feed" }),
    )
    .await;
    assert_eq!(added.status(), 402);
    assert_eq!(body(added).await["error"], "plan-ended");
    let imported = reqwest::Client::new()
        .post(format!("{base}/api/opml"))
        .header("cookie", &cookie)
        .header("sec-fetch-site", "same-origin")
        .body(
            r#"<opml version="2.0"><body><outline type="rss" xmlUrl="https://example.com/feed"/></body></opml>"#,
        )
        .send()
        .await
        .unwrap();
    assert_eq!(imported.status(), 402);
    // Reading still works.
    let articles = reqwest::Client::new()
        .get(format!("{base}/api/articles"))
        .header("cookie", &cookie)
        .send()
        .await
        .unwrap();
    assert_eq!(articles.status(), 200);
}

#[tokio::test]
async fn checkout_asks_dodo_for_the_readers_plan_and_keeps_the_trials_days() {
    let (base, state, asked) = start_with_payments().await;
    let (person, cookie) = reader(&state).await;
    joined_days_ago(&state, person, 4).await;
    let answer = post(
        &base,
        &cookie,
        "/api/plan/checkout",
        json!({ "period": "yearly" }),
    )
    .await;
    assert_eq!(answer.status(), 200);
    assert_eq!(
        body(answer).await["url"],
        "https://test.checkout.example/cks_1"
    );
    let (method, path, body) = asked.lock().unwrap()[0].clone();
    assert_eq!((method.as_str(), path.as_str()), ("POST", "/checkouts"));
    assert_eq!(body["product_cart"][0]["product_id"], "pdt_yearly");
    assert_eq!(body["metadata"]["person_id"], person.to_string());
    assert_eq!(
        body["customer"]["email"],
        format!("reader{person}@example.com")
    );
    assert_eq!(body["return_url"], "https://app.example/settings/plan");
    // 14 days, 4 gone: 9 days and a part, rounded up, so the first charge
    // never comes before the day Settings showed.
    assert_eq!(body["subscription_data"]["trial_period_days"], 10);

    let unknown = post(
        &base,
        &cookie,
        "/api/plan/checkout",
        json!({ "period": "weekly" }),
    )
    .await;
    assert_eq!(unknown.status(), 400);
}

#[tokio::test]
async fn dodos_signed_messages_keep_the_readers_plan() {
    let (base, state, asked) = start_with_payments().await;
    let (person, cookie) = reader(&state).await;
    joined_days_ago(&state, person, 20).await;
    let next = nine_turtles::now() + 30 * DAY;

    // Unsigned: ignored.
    let active = subscription("subscription.active", person, "active", next, false);
    assert_eq!(message(&base, "msg_1", &active, false).await.status(), 401);
    assert_eq!(
        get(&base, &cookie, "/api/plan").await["plan"]["standing"],
        "ended"
    );

    assert_eq!(message(&base, "msg_1", &active, true).await.status(), 200);
    let plan = get(&base, &cookie, "/api/plan").await;
    assert_eq!(plan["plan"]["standing"], "paid", "{plan}");
    assert_eq!(plan["plan"]["period"], "monthly");
    assert_eq!(plan["plan"]["renews_at"], next);
    assert_eq!(plan["can_manage"], true);
    let added = post(
        &base,
        &cookie,
        "/api/feeds",
        json!({ "address": "not a web address" }),
    )
    .await;
    assert_eq!(body(added).await["error"], "not-an-address");

    // A renewal that failed: a week's grace.
    let held = subscription("subscription.on_hold", person, "on_hold", next, false);
    assert_eq!(message(&base, "msg_2", &held, true).await.status(), 200);
    let plan = get(&base, &cookie, "/api/plan").await;
    assert_eq!(plan["plan"]["standing"], "on-hold");
    // The same message again changes nothing, even if it now says otherwise.
    let replay = subscription("subscription.active", person, "active", next, false);
    assert_eq!(message(&base, "msg_2", &replay, true).await.status(), 200);
    assert_eq!(
        get(&base, &cookie, "/api/plan").await["plan"]["standing"],
        "on-hold"
    );

    // Cancelled: it lasts to the end of what was paid.
    let cancelled = subscription("subscription.cancelled", person, "cancelled", next, true);
    assert_eq!(
        message(&base, "msg_3", &cancelled, true).await.status(),
        200
    );
    let plan = get(&base, &cookie, "/api/plan").await;
    assert_eq!(plan["plan"]["standing"], "paid");
    assert_eq!(plan["plan"]["ending"], true);
    assert_eq!(plan["plan"]["until"], next);

    // Billing opens Dodo's page for this customer, coming back to Settings.
    let billing = post(&base, &cookie, "/api/plan/manage", json!({})).await;
    assert_eq!(
        body(billing).await["url"],
        "https://test.portal.example/cus_1"
    );
    let (_, path, _) = asked.lock().unwrap().last().unwrap().clone();
    assert_eq!(
        path,
        "/customers/cus_1/customer-portal/session?return_url=https%3A%2F%2Fapp.example%2Fsettings%2Fplan"
    );

    // Expired: over.
    let expired = subscription("subscription.expired", person, "expired", next, false);
    assert_eq!(message(&base, "msg_4", &expired, true).await.status(), 200);
    assert_eq!(
        get(&base, &cookie, "/api/plan").await["plan"]["standing"],
        "ended"
    );
}

#[tokio::test]
async fn deleting_an_account_cancels_its_plan_first() {
    let (base, state, asked) = start_with_payments().await;
    let (person, cookie) = reader(&state).await;
    let next = nine_turtles::now() + 30 * DAY;
    let active = subscription("subscription.active", person, "active", next, false);
    assert_eq!(message(&base, "msg_1", &active, true).await.status(), 200);

    let deleted = post(&base, &cookie, "/api/people/me/delete", json!({})).await;
    assert_eq!(deleted.status(), 204);
    let (method, path, body) = asked.lock().unwrap().last().unwrap().clone();
    assert_eq!(
        (method.as_str(), path.as_str()),
        ("PATCH", "/subscriptions/sub_1")
    );
    assert_eq!(body["status"], "cancelled");
    let plans: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM plans")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(plans, 0);
}

#[tokio::test]
async fn the_owners_readers_page_shows_each_readers_plan() {
    let (base, state, _) = start_with_payments().await;
    reader(&state).await;
    let owner = common::signed_in(&base).await;
    let page = get(&base, &owner, "/api/admin").await;
    let readers = page["readers"].as_array().unwrap();
    assert_eq!(readers[0]["plan"]["standing"], "free");
    assert_eq!(readers[1]["plan"]["standing"], "trial");
}

#[tokio::test]
async fn a_late_or_old_message_never_undoes_a_newer_plan() {
    let (base, state, _) = start_with_payments().await;
    let (person, cookie) = reader(&state).await;
    joined_days_ago(&state, person, 20).await;
    let now = nine_turtles::now();
    let next = now + 30 * DAY;
    let standing = || async { get(&base, &cookie, "/api/plan").await["plan"].clone() };

    // Cancelled, then an older "active" arrives late: still cancelled.
    let cancelled = about(
        "sub_1",
        now,
        "subscription.cancelled",
        person,
        "cancelled",
        next,
        true,
    );
    assert_eq!(
        message(&base, "msg_1", &cancelled, true).await.status(),
        200
    );
    let late = about(
        "sub_1",
        now - 60,
        "subscription.active",
        person,
        "active",
        next,
        false,
    );
    assert_eq!(message(&base, "msg_2", &late, true).await.status(), 200);
    assert_eq!(standing().await["ending"], true);

    // The reader buys again; then the old subscription expires: the new one stays.
    let again = about(
        "sub_2",
        now + 1,
        "subscription.active",
        person,
        "active",
        next,
        false,
    );
    assert_eq!(message(&base, "msg_3", &again, true).await.status(), 200);
    let old_ends = about(
        "sub_1",
        now + 2,
        "subscription.expired",
        person,
        "expired",
        next,
        false,
    );
    assert_eq!(message(&base, "msg_4", &old_ends, true).await.status(), 200);
    let plan = standing().await;
    assert_eq!(plan["standing"], "paid", "{plan}");
    assert_eq!(plan["ending"], false);
    let kept: String = sqlx::query_scalar("SELECT subscription_id FROM plans WHERE person_id = ?")
        .bind(person)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(kept, "sub_2");
}

#[tokio::test]
async fn a_message_naming_a_reader_whose_email_differs_isnt_theirs() {
    let (base, state, _) = start_with_payments().await;
    let (person, cookie) = reader(&state).await;
    // As if the number had belonged to a deleted reader with another email.
    let mut event = subscription(
        "subscription.active",
        person,
        "active",
        nine_turtles::now() + DAY,
        false,
    );
    event["data"]["customer"]["email"] = json!("someone-else@example.com");
    assert_eq!(message(&base, "msg_1", &event, true).await.status(), 200);
    assert_eq!(
        get(&base, &cookie, "/api/plan").await["plan"]["standing"],
        "trial"
    );
}

#[tokio::test]
async fn deleting_waits_if_dodo_cant_be_reached_but_not_if_the_plan_is_already_over() {
    let (base, state, _) = start_with_payments().await;
    let next = nine_turtles::now() + 30 * DAY;
    // The made-up Dodo answers 500 for sub_broken and 404 for sub_gone.
    for (id, answer) in [("sub_broken", 502), ("sub_gone", 204)] {
        let (person, cookie) = reader(&state).await;
        let event = about(
            id,
            nine_turtles::now(),
            "subscription.active",
            person,
            "active",
            next,
            false,
        );
        assert_eq!(
            message(&base, &format!("msg_{id}"), &event, true)
                .await
                .status(),
            200
        );
        let deleted = post(&base, &cookie, "/api/people/me/delete", json!({})).await;
        assert_eq!(deleted.status(), answer, "{id}");
        let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM people WHERE id = ?")
            .bind(person)
            .fetch_one(&state.db)
            .await
            .unwrap();
        assert_eq!(left, i64::from(answer == 502), "{id}");
    }
}

#[tokio::test]
async fn a_plan_that_starts_brings_the_readers_feeds_forward() {
    let (base, state, _) = start_with_payments().await;
    let (person, _) = reader(&state).await;
    joined_days_ago(&state, person, 20).await;
    let later = nine_turtles::now() + 20 * 60 * 60;
    sqlx::query(
        "INSERT INTO feeds (id, url, url_key, title, added_at, next_check_at)
         VALUES (500, 'https://example.com/feed', 'example.com/feed', 'A feed', 1, ?)",
    )
    .bind(later)
    .execute(&state.db)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (?, 500, 'A feed', 1)",
    )
    .bind(person)
    .execute(&state.db)
    .await
    .unwrap();
    let next = nine_turtles::now() + 30 * DAY;
    let active = subscription("subscription.active", person, "active", next, false);
    assert_eq!(message(&base, "msg_1", &active, true).await.status(), 200);
    let due: i64 = sqlx::query_scalar("SELECT next_check_at FROM feeds WHERE id = 500")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert!(
        due <= nine_turtles::now() + 60 * 60,
        "due at {due}, not soon"
    );
}
