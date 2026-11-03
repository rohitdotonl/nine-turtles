//! "How did you hear about nine turtles?" (decision 0155, SPEC section 41):
//! one optional answer at sign-up, kept with the account, shown only as
//! totals in the owner report, and gone when the reader deletes their data.

mod common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

const KEY: &str = "a made-up owner report key, long enough";
const READER_PASSWORD: &str = "slow mornings, long reads";

async fn sign_up(base: &str, body: Value) -> StatusCode {
    Client::new()
        .post(format!("{base}/api/sign-up"))
        .header("content-type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .unwrap()
        .status()
}

async fn answer_of(state: &nine_turtles::AppState, email: &str) -> Option<String> {
    sqlx::query_scalar("SELECT heard_about FROM people WHERE email = ?")
        .bind(email)
        .fetch_one(&state.db)
        .await
        .unwrap()
}

#[tokio::test]
async fn the_answer_is_optional_and_only_the_offered_ones_are_kept() {
    let (base, state) = common::start_with_state(common::config()).await;

    let with =
        json!({ "email": "ana@example.com", "password": READER_PASSWORD, "heard_about": "blog" });
    assert_eq!(sign_up(&base, with).await, StatusCode::NO_CONTENT);
    assert_eq!(
        answer_of(&state, "ana@example.com").await.as_deref(),
        Some("blog")
    );

    // Not saying is fine: the page sends nothing, or nothing chosen.
    let without = json!({ "email": "bo@example.com", "password": READER_PASSWORD });
    assert_eq!(sign_up(&base, without).await, StatusCode::NO_CONTENT);
    assert_eq!(answer_of(&state, "bo@example.com").await, None);
    let empty =
        json!({ "email": "cy@example.com", "password": READER_PASSWORD, "heard_about": null });
    assert_eq!(sign_up(&base, empty).await, StatusCode::NO_CONTENT);
    assert_eq!(answer_of(&state, "cy@example.com").await, None);

    // An answer the page doesn't offer never stops anyone signing up; it's
    // kept as no answer.
    let odd = json!({ "email": "di@example.com", "password": READER_PASSWORD, "heard_about": "a billboard" });
    assert_eq!(sign_up(&base, odd).await, StatusCode::NO_CONTENT);
    assert_eq!(answer_of(&state, "di@example.com").await, None);
}

#[tokio::test]
async fn the_owner_report_counts_the_answers_but_never_whose() {
    let mut config = common::config();
    config.owner_report_key = Some(KEY.to_owned());
    let (base, _) = common::start_with_state(config).await;
    for (email, answer) in [
        ("ana@example.com", Some("friend")),
        ("bo@example.com", Some("friend")),
        ("cy@example.com", Some("ai")),
        ("di@example.com", None),
    ] {
        let body = json!({ "email": email, "password": READER_PASSWORD, "heard_about": answer });
        assert_eq!(sign_up(&base, body).await, StatusCode::NO_CONTENT);
    }

    let report = Client::new()
        .get(format!("{base}/owner-report"))
        .header("authorization", format!("Bearer {KEY}"))
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    assert!(!report.contains('@'), "{report} names someone");
    let report: Value = serde_json::from_str(&report).unwrap();
    // Every answer is named, even at 0; the owner never answered, so with
    // di they are the two who didn't say.
    assert_eq!(
        report["readers"]["heard_about"],
        json!({
            "blog": 0, "friend": 2, "search": 0, "ai": 1, "reddit": 0, "other": 0,
            "no_answer": 2,
        })
    );
}

#[tokio::test]
async fn deleting_ones_data_takes_the_answer_too() {
    let (base, state) = common::start_with_state(common::config()).await;
    let body =
        json!({ "email": "ana@example.com", "password": READER_PASSWORD, "heard_about": "reddit" });
    assert_eq!(sign_up(&base, body).await, StatusCode::NO_CONTENT);
    let person: i64 = sqlx::query_scalar("SELECT id FROM people WHERE email = 'ana@example.com'")
        .fetch_one(&state.db)
        .await
        .unwrap();

    nine_turtles::people::delete_data(&state.db, person)
        .await
        .unwrap();
    assert_eq!(answer_of(&state, "ana@example.com").await, None);
}

#[tokio::test]
async fn while_the_address_is_confirmed_the_answer_waits_with_its_link() {
    let (base, state, outbox) = common::start_with_mail(common::config()).await;
    let body =
        json!({ "email": "ana@example.com", "password": READER_PASSWORD, "heard_about": "search" });
    assert_eq!(sign_up(&base, body).await, StatusCode::ACCEPTED);
    let (_, ticket) = common::newest_link(&outbox, "ana@example.com");

    let finished = Client::new()
        .post(format!("{base}/api/sign-up/finish"))
        .header("content-type", "application/json")
        .body(json!({ "ticket": ticket, "password": READER_PASSWORD }).to_string())
        .send()
        .await
        .unwrap();
    assert!(finished.status().is_success(), "{}", finished.status());
    assert_eq!(
        answer_of(&state, "ana@example.com").await.as_deref(),
        Some("search")
    );
}

#[tokio::test]
async fn the_link_finished_keeps_its_own_answer_and_leaves_no_copy() {
    let (base, state, outbox) = common::start_with_mail(common::config()).await;
    let stranger = "someone else's password, typed first";
    let first =
        json!({ "email": "ana@example.com", "password": stranger, "heard_about": "reddit" });
    assert_eq!(sign_up(&base, first).await, StatusCode::ACCEPTED);
    let (_, ticket) = common::newest_link(&outbox, "ana@example.com");
    // Within the minute no new email goes, but this sign-up waits too; the
    // link already sent finishes whichever password is typed.
    let mine =
        json!({ "email": "ana@example.com", "password": READER_PASSWORD, "heard_about": "friend" });
    assert_eq!(sign_up(&base, mine).await, StatusCode::ACCEPTED);

    let finished = Client::new()
        .post(format!("{base}/api/sign-up/finish"))
        .header("content-type", "application/json")
        .body(json!({ "ticket": ticket, "password": READER_PASSWORD }).to_string())
        .send()
        .await
        .unwrap();
    assert!(finished.status().is_success(), "{}", finished.status());
    assert_eq!(
        answer_of(&state, "ana@example.com").await.as_deref(),
        Some("friend")
    );
    let copies: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM email_links WHERE heard_about IS NOT NULL")
            .fetch_one(&state.db)
            .await
            .unwrap();
    assert_eq!(copies, 0);
}
