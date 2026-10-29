//! The owner report (decision 0130): hidden without its key setting,
//! answers only to its own key, and gives counts and dates, never who.

mod common;

use common::DIAGNOSTICS_KEY;
use nine_turtles::{AppState, payments::Settings};
use reqwest::{Client, StatusCode};
use serde_json::Value;

const KEY: &str = "a made-up owner report key, long enough";
const DAY: i64 = 24 * 60 * 60;

fn config() -> nine_turtles::config::Config {
    let mut config = common::config();
    config.owner_report_key = Some(KEY.to_owned());
    config
}

async fn ask(base: &str, key: Option<&str>) -> reqwest::Response {
    let mut request = Client::new().get(format!("{base}/owner-report"));
    if let Some(key) = key {
        request = request.header("authorization", format!("Bearer {key}"));
    }
    request.send().await.unwrap()
}

#[tokio::test]
async fn without_its_key_setting_the_report_is_not_there() {
    let base = common::start(common::config()).await;

    assert_eq!(ask(&base, None).await.status(), StatusCode::NOT_FOUND);
    assert_eq!(ask(&base, Some("")).await.status(), StatusCode::NOT_FOUND);
    assert_eq!(
        ask(&base, Some(DIAGNOSTICS_KEY)).await.status(),
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn the_report_answers_only_to_its_own_key() {
    let base = common::start(config()).await;

    for wrong in [None, Some("wrong"), Some(DIAGNOSTICS_KEY)] {
        assert_eq!(ask(&base, wrong).await.status(), StatusCode::UNAUTHORIZED);
    }
    let response = ask(&base, Some(KEY)).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["cache-control"], "no-store");
    let report: Value = serde_json::from_str(&response.text().await.unwrap()).unwrap();
    assert_eq!(report["version"], nine_turtles::VERSION);
    assert_eq!(report["backups"]["on"], false);
    assert_eq!(report["readers"]["total"], 1);
    assert_eq!(report["payments"]["on"], false);
    assert_eq!(report["payments"]["readers"]["free"], 1);
}

/// Makes a reader who joined `joined_ago` seconds ago, with this email.
async fn reader(state: &AppState, joined_ago: i64, email: &str) -> i64 {
    let (person, _) = common::another_reader(state).await;
    sqlx::query("UPDATE people SET created_at = unixepoch() - ?, email = ? WHERE id = ?")
        .bind(joined_ago)
        .bind(email)
        .bind(person)
        .execute(&state.db)
        .await
        .unwrap();
    person
}

/// Gives the reader a plan: Dodo's status, when it renews (none when
/// cancelled), and until when it lasts, in days from now.
async fn plan(state: &AppState, person: i64, status: &str, renews: Option<i64>, until: i64) {
    sqlx::query(
        "INSERT INTO plans (person_id, subscription_id, customer_id, period, status,
                            renews_at, ending, access_until, updated_at)
         VALUES (?1, 'sub_' || ?1, 'cus_' || ?1, 'monthly', ?2,
                 unixepoch() + ?3 * 86400, ?4, unixepoch() + ?5 * 86400, unixepoch())",
    )
    .bind(person)
    .bind(status)
    .bind(renews.unwrap_or(until))
    .bind(i64::from(renews.is_none()))
    .bind(until)
    .execute(&state.db)
    .await
    .unwrap();
}

#[tokio::test]
async fn the_report_counts_who_pays_and_the_days_plans_change_but_never_who() {
    let mut config = config();
    config.payments = Some(Settings {
        api_key: "test-api-key".to_owned(),
        webhook_key: b"a made-up webhook key!".to_vec(),
        monthly_product: "pdt_monthly".to_owned(),
        yearly_product: None,
        api_url: reqwest::Url::parse("http://127.0.0.1:9/").unwrap(),
        live: false,
        monthly_price: "$5 a month".to_owned(),
        yearly_price: None,
        trial_days: 14,
    });
    let (base, state) = common::start_with_state(config).await;
    // Payments have been on for a long while, so trials run from joining.
    sqlx::query("UPDATE settings SET value = CAST(unixepoch() - 365 * 86400 AS TEXT) WHERE name = 'payments_on_at'")
        .execute(&state.db)
        .await
        .unwrap();

    reader(&state, DAY, "trying@example.com").await;
    let renewing = reader(&state, 40 * DAY, "renewing@example.com").await;
    plan(&state, renewing, "active", Some(10), 13).await;
    let leaving = reader(&state, 40 * DAY, "leaving@example.com").await;
    plan(&state, leaving, "active", None, 5).await;
    let later = reader(&state, 40 * DAY, "later@example.com").await;
    plan(&state, later, "active", Some(60), 63).await;
    let card = reader(&state, 40 * DAY, "card@example.com").await;
    plan(&state, card, "on_hold", Some(3), 3).await;
    reader(&state, 100 * DAY, "gone@example.com").await;

    let report = ask(&base, Some(KEY)).await.text().await.unwrap();
    assert!(!report.contains('@'), "{report} names someone");
    let report: Value = serde_json::from_str(&report).unwrap();
    assert_eq!(report["readers"]["total"], 7);
    assert_eq!(report["readers"]["joined_last_30_days"], 2);
    assert_eq!(report["payments"]["on"], true);
    assert_eq!(report["payments"]["live"], false);
    assert_eq!(
        report["payments"]["readers"],
        serde_json::json!({ "free": 1, "trial": 1, "paid": 3, "on_hold": 1, "ended": 1 })
    );

    let day = |from_now: i64| nine_turtles::backup::day_name(nine_turtles::now() + from_now * DAY);
    let coming_up: Vec<(String, String)> = report["payments"]["coming_up"]
        .as_array()
        .unwrap()
        .iter()
        .map(|upcoming| {
            (
                upcoming["day"].as_str().unwrap().to_owned(),
                upcoming["what"].as_str().unwrap().to_owned(),
            )
        })
        .collect();
    // Sorted by day; the plan renewing in 60 days is too far off.
    assert_eq!(
        coming_up,
        [
            (day(3), "ends".to_owned()),
            (day(5), "ends".to_owned()),
            (day(10), "renews".to_owned()),
            (day(13), "trial-ends".to_owned()),
        ]
    );
}
