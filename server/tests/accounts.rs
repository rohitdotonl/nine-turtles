//! What email makes possible (SPEC sections 1 and 18, decision 0088):
//! "Forgot your password?", signing in by link, changing an email,
//! and deleting an account, tested against a real running nine turtles
//! whose emails land in an outbox instead of being sent.

mod common;

use common::{PASSWORD, emails_to, newest_link, signed_in, start_with_mail, start_with_state};
use nine_turtles::email::Outbox;
use reqwest::{Client, Response, StatusCode};
use serde_json::{Value, json};

const READER_PASSWORD: &str = "slow mornings, long reads";
const NEW_PASSWORD: &str = "a new page every morning";

async fn post(base: &str, path: &str, cookie: Option<&str>, body: Value) -> Response {
    let mut request = Client::new()
        .post(format!("{base}{path}"))
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body(body.to_string());
    if let Some(cookie) = cookie {
        request = request.header("cookie", cookie);
    }
    request.send().await.unwrap()
}

async fn session(base: &str, cookie: Option<&str>) -> Value {
    let mut request = Client::new().get(format!("{base}/api/session"));
    if let Some(cookie) = cookie {
        request = request.header("cookie", cookie);
    }
    request
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap()
        .parse::<Value>()
        .unwrap()
}

async fn sign_in(base: &str, email: &str, password: &str) -> Response {
    post(
        base,
        "/api/sign-in",
        None,
        json!({ "email": email, "password": password }),
    )
    .await
}

fn cookie_from(response: &Response) -> String {
    let set_cookie = response.headers()["set-cookie"].to_str().unwrap();
    set_cookie.split(';').next().unwrap().to_owned()
}

async fn error_of(response: Response) -> String {
    let body: Value = response
        .text()
        .await
        .unwrap_or_default()
        .parse()
        .unwrap_or(Value::Null);
    body["error"].as_str().unwrap_or_default().to_owned()
}

/// A nine turtles that can send email. Answers its address, its insides,
/// the outbox and the owner's cookie.
async fn open_app() -> (String, nine_turtles::AppState, Outbox, String) {
    let (base, state, outbox) = start_with_mail(common::config()).await;
    let owner = signed_in(&base).await;
    (base, state, outbox, owner)
}

/// Signs up (made at once, no email sent, decision 0115): answers the new
/// reader's cookie.
async fn open_reader(base: &str, outbox: &Outbox, email: &str) -> String {
    let made = post(
        base,
        "/api/sign-up",
        None,
        json!({ "email": email, "password": READER_PASSWORD }),
    )
    .await;
    assert_eq!(made.status(), StatusCode::NO_CONTENT);
    assert!(emails_to(outbox, email).is_empty());
    cookie_from(&made)
}

#[tokio::test]
async fn without_email_settings_nothing_is_sent_and_sign_up_still_works() {
    let (base, state) = start_with_state(common::config()).await;
    assert!(state.mailer.is_none());
    let owner = signed_in(&base).await;

    // Sign-up needs no email (decision 0115): the account is made at once.
    let signed_up = post(
        &base,
        "/api/sign-up",
        None,
        json!({ "email": "mira@example.com", "password": READER_PASSWORD }),
    )
    .await;
    assert_eq!(signed_up.status(), StatusCode::NO_CONTENT);
    let mira = cookie_from(&signed_up);
    assert_eq!(session(&base, Some(&mira)).await["signed_in"], true);

    let forgot = post(
        &base,
        "/api/password/forgot",
        None,
        json!({ "email": "mira@example.com" }),
    )
    .await;
    assert_eq!(forgot.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(error_of(forgot).await, "no-email");
    let link = post(
        &base,
        "/api/sign-in/link",
        None,
        json!({ "email": "mira@example.com" }),
    )
    .await;
    assert_eq!(link.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(error_of(link).await, "no-email");

    let signed_out = session(&base, None).await;
    assert_eq!(signed_out["email_sending"], false);
    assert_eq!(session(&base, Some(&owner)).await["email_sending"], false);
}

#[tokio::test]
async fn forgot_your_password_always_answers_the_same() {
    let (base, state, outbox, _) = open_app().await;
    let email = "noor@example.com";
    let laptop = open_reader(&base, &outbox, email).await;
    let before = emails_to(&outbox, email).len();
    let reader: i64 = sqlx::query_scalar("SELECT id FROM people WHERE email = ?")
        .bind(email)
        .fetch_one(&state.db)
        .await
        .unwrap();
    sqlx::query("INSERT INTO app_passwords (person_id, password_hash, made_at) VALUES (?, 'x', 0)")
        .bind(reader)
        .execute(&state.db)
        .await
        .unwrap();

    let forgot = |address: &'static str| {
        let base = base.clone();
        async move {
            let response = post(
                &base,
                "/api/password/forgot",
                None,
                json!({ "email": address }),
            )
            .await;
            (response.status(), response.text().await.unwrap())
        }
    };
    let nobody = forgot("nobody@example.com").await;
    let someone = forgot("NOOR@example.com").await;
    assert_eq!(nobody, someone);
    assert_eq!(nobody.0, StatusCode::ACCEPTED);
    assert!(emails_to(&outbox, "nobody@example.com").is_empty());
    let sent = emails_to(&outbox, email);
    assert_eq!(sent.len(), before + 1);
    assert_eq!(
        sent.last().unwrap().subject,
        "A new password for nine turtles"
    );
    let (page, ticket) = newest_link(&outbox, email);
    assert_eq!(page, "/reset-password");
    let lifetime: i64 = sqlx::query_scalar(
        "SELECT expires_at - created_at FROM email_links WHERE purpose = 'reset'",
    )
    .fetch_one(&state.db)
    .await
    .unwrap();
    assert_eq!(lifetime, 60 * 60);

    // A short password is refused as at sign-up, and the link still works.
    let short = post(
        &base,
        "/api/password/reset",
        None,
        json!({ "ticket": ticket, "password": "short" }),
    )
    .await;
    assert_eq!(short.status(), StatusCode::BAD_REQUEST);
    assert_eq!(error_of(short).await, "password-short");

    let reset = post(
        &base,
        "/api/password/reset",
        None,
        json!({ "ticket": ticket, "password": NEW_PASSWORD }),
    )
    .await;
    assert_eq!(reset.status(), StatusCode::OK);
    let phone = cookie_from(&reset);
    assert_eq!(session(&base, Some(&phone)).await["signed_in"], true);
    // The other device is signed out, the app password (for other feed
    // reader apps) is turned off, and the old password no longer works.
    assert_eq!(session(&base, Some(&laptop)).await["signed_in"], false);
    let app_passwords: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM app_passwords WHERE person_id = ?")
            .bind(reader)
            .fetch_one(&state.db)
            .await
            .unwrap();
    assert_eq!(app_passwords, 0);
    assert_eq!(
        sign_in(&base, email, READER_PASSWORD).await.status(),
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        sign_in(&base, email, NEW_PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );
    // Once only.
    let again = post(
        &base,
        "/api/password/reset",
        None,
        json!({ "ticket": ticket, "password": "yet another password" }),
    )
    .await;
    assert_eq!(again.status(), StatusCode::GONE);
}

#[tokio::test]
async fn at_most_three_emails_go_to_one_address_in_an_hour() {
    let (base, state, outbox, _) = open_app().await;
    let email = "tam@example.com";
    open_reader(&base, &outbox, email).await;
    // Three reset emails, a minute apart, then nothing, though the answer
    // never changes.
    for _ in 0..5 {
        a_minute_passes(&state.db).await;
        let response = post(
            &base,
            "/api/password/forgot",
            None,
            json!({ "email": email }),
        )
        .await;
        assert_eq!(response.status(), StatusCode::ACCEPTED);
    }
    assert_eq!(emails_to(&outbox, email).len(), 3);
}

#[tokio::test]
async fn pressing_send_link_twice_sends_one_email() {
    let (base, state, outbox, _) = open_app().await;
    let email = "twice@example.com";
    open_reader(&base, &outbox, email).await;
    let before = emails_to(&outbox, email).len();
    let forgot = || {
        post(
            &base,
            "/api/password/forgot",
            None,
            json!({ "email": email }),
        )
    };
    assert_eq!(forgot().await.status(), StatusCode::ACCEPTED);
    assert_eq!(forgot().await.status(), StatusCode::ACCEPTED);
    assert_eq!(emails_to(&outbox, email).len(), before + 1);
    // A minute later, "Send again" sends another.
    a_minute_passes(&state.db).await;
    assert_eq!(forgot().await.status(), StatusCode::ACCEPTED);
    assert_eq!(emails_to(&outbox, email).len(), before + 2);
}

/// Moves every link a minute (and a second) into the past, as if a minute
/// had passed, while staying within the hour the counts look back.
async fn a_minute_passes(db: &sqlx::SqlitePool) {
    sqlx::query("UPDATE email_links SET created_at = created_at - 61")
        .execute(db)
        .await
        .unwrap();
}

#[tokio::test]
async fn a_password_link_lasts_an_hour() {
    let (base, state, outbox, _) = open_app().await;
    let email = "ada@example.com";
    open_reader(&base, &outbox, email).await;
    post(
        &base,
        "/api/password/forgot",
        None,
        json!({ "email": email }),
    )
    .await;
    sqlx::query("UPDATE email_links SET expires_at = unixepoch() - 1 WHERE purpose = 'reset'")
        .execute(&state.db)
        .await
        .unwrap();
    let (_, ticket) = newest_link(&outbox, email);
    let late = post(
        &base,
        "/api/password/reset",
        None,
        json!({ "ticket": ticket, "password": NEW_PASSWORD }),
    )
    .await;
    assert_eq!(late.status(), StatusCode::GONE);
    assert_eq!(
        sign_in(&base, email, READER_PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );
}

#[tokio::test]
async fn changing_an_email_waits_for_the_new_address_and_tells_the_old() {
    let (base, _, outbox, _) = open_app().await;
    let old = "kai@example.com";
    let new = "kai@elsewhere.example";
    let cookie = open_reader(&base, &outbox, old).await;

    let wrong = post(
        &base,
        "/api/people/me/email/change",
        Some(&cookie),
        json!({ "email": new, "password": "not my password" }),
    )
    .await;
    assert_eq!(wrong.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(error_of(wrong).await, "wrong-password");
    assert!(emails_to(&outbox, new).is_empty());

    let same = post(
        &base,
        "/api/people/me/email/change",
        Some(&cookie),
        json!({ "email": "KAI@example.com", "password": READER_PASSWORD }),
    )
    .await;
    assert_eq!(same.status(), StatusCode::BAD_REQUEST);

    let asked = post(
        &base,
        "/api/people/me/email/change",
        Some(&cookie),
        json!({ "email": new, "password": READER_PASSWORD }),
    )
    .await;
    assert_eq!(asked.status(), StatusCode::ACCEPTED);
    // Nothing changes until the link is followed.
    assert_eq!(session(&base, Some(&cookie)).await["email"], old);
    let (page, ticket) = newest_link(&outbox, new);
    assert_eq!(page, "/confirm-email");

    let confirmed = post(
        &base,
        "/api/email/confirm",
        None,
        json!({ "ticket": ticket }),
    )
    .await;
    assert_eq!(confirmed.status(), StatusCode::OK);
    assert_eq!(session(&base, Some(&cookie)).await["email"], new);
    let told = emails_to(&outbox, old);
    assert_eq!(
        told.last().unwrap().subject,
        "Your nine turtles email was changed"
    );
    assert!(told.last().unwrap().body.contains(new));
    assert!(!told.last().unwrap().body.contains("http"));

    assert_eq!(
        sign_in(&base, new, READER_PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        sign_in(&base, old, READER_PASSWORD).await.status(),
        StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn an_address_another_reader_has_gets_nothing() {
    let (base, _, outbox, _) = open_app().await;
    let cookie = open_reader(&base, &outbox, "one@example.com").await;
    open_reader(&base, &outbox, "two@example.com").await;
    let before = emails_to(&outbox, "two@example.com").len();
    let asked = post(
        &base,
        "/api/people/me/email/change",
        Some(&cookie),
        json!({ "email": "two@example.com", "password": READER_PASSWORD }),
    )
    .await;
    assert_eq!(asked.status(), StatusCode::ACCEPTED);
    assert_eq!(emails_to(&outbox, "two@example.com").len(), before);
}

#[tokio::test]
async fn the_owner_can_set_a_new_password_by_email_too() {
    let (base, _, outbox) = start_with_mail(common::config()).await;
    let owner = signed_in(&base).await;
    let saved = post(
        &base,
        "/api/people/me/email",
        Some(&owner),
        json!({ "email": "owner@example.com", "password": common::PASSWORD }),
    )
    .await;
    assert!(saved.status().is_success());
    post(
        &base,
        "/api/password/forgot",
        None,
        json!({ "email": "owner@example.com" }),
    )
    .await;
    let (_, ticket) = newest_link(&outbox, "owner@example.com");
    let reset = post(
        &base,
        "/api/password/reset",
        None,
        json!({ "ticket": ticket, "password": NEW_PASSWORD }),
    )
    .await;
    assert_eq!(reset.status(), StatusCode::OK);
    // The new password works with the email; the old one no longer does,
    // and the password alone signs nobody in (decision 0116).
    let alone = post(
        &base,
        "/api/sign-in",
        None,
        json!({ "password": NEW_PASSWORD }),
    )
    .await;
    assert_eq!(alone.status(), StatusCode::BAD_REQUEST);
    assert_eq!(error_of(alone).await, "email-needed");
    assert_eq!(
        sign_in(&base, "owner@example.com", PASSWORD).await.status(),
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        sign_in(&base, "owner@example.com", NEW_PASSWORD)
            .await
            .status(),
        StatusCode::NO_CONTENT
    );
}

/// How many lines of reader `person` `table` holds.
async fn lines_of(db: &sqlx::SqlitePool, table: &str, person: i64) -> i64 {
    sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
        "SELECT COUNT(*) FROM \"{table}\" WHERE person_id = ?"
    )))
    .bind(person)
    .fetch_one(db)
    .await
    .unwrap()
}

/// Every table with a `person_id` column, from the database itself.
async fn tables_with_a_reader(db: &sqlx::SqlitePool) -> Vec<String> {
    sqlx::query_scalar(
        "SELECT m.name FROM sqlite_master m
         WHERE m.type = 'table'
           AND EXISTS (SELECT 1 FROM pragma_table_info(m.name) WHERE name = 'person_id')
         ORDER BY m.name",
    )
    .fetch_all(db)
    .await
    .unwrap()
}

#[tokio::test]
async fn deleting_an_account_leaves_nothing_of_theirs() {
    let (base, state, outbox, owner) = open_app().await;
    let email = "leaving@example.com";
    let cookie = open_reader(&base, &outbox, email).await;
    let person: i64 = sqlx::query_scalar("SELECT id FROM people WHERE email = ?")
        .bind(email)
        .fetch_one(&state.db)
        .await
        .unwrap();

    // A link asked for by address, which holds their email.
    let forgot = post(
        &base,
        "/api/password/forgot",
        None,
        json!({ "email": email }),
    )
    .await;
    assert_eq!(forgot.status(), StatusCode::ACCEPTED);

    // Something of theirs, and of the owner's, in every table that can hold it.
    for (statement, what) in [
        (
            "INSERT INTO folders (person_id, name) VALUES (?, 'Essays')",
            "a folder",
        ),
        (
            "INSERT INTO saved_searches (person_id, name, query, created_at) VALUES (?, 'Gardens', '{\"words\":\"garden\"}', 0)",
            "a saved search",
        ),
        (
            "INSERT INTO rules (person_id, words, action, created_at) VALUES (?, 'Sponsored', 'mute', 0)",
            "a rule",
        ),
        (
            "INSERT INTO person_settings (person_id, name, value) VALUES (?, 'sort', 'oldest')",
            "a setting",
        ),
        (
            "INSERT INTO app_passwords (person_id, password_hash, made_at) VALUES (?1, 'x' || ?1, 0)",
            "an app password",
        ),
        (
            "INSERT INTO plans (person_id, subscription_id, customer_id, status, access_until, updated_at)
             VALUES (?1, 'sub_' || ?1, 'cus_' || ?1, 'cancelled', 0, 0)",
            "a plan",
        ),
    ] {
        for whose in [person, 1] {
            sqlx::query(statement)
                .bind(whose)
                .execute(&state.db)
                .await
                .unwrap_or_else(|error| panic!("couldn't add {what}: {error}"));
        }
    }
    post(
        &base,
        "/api/password/forgot",
        None,
        json!({ "email": email }),
    )
    .await;

    // Two feeds: one only they follow (a starred article in it), and one the
    // owner follows too, with an article each.
    let db = &state.db;
    for (id, url, followers) in [
        (901, "https://only.example/feed", vec![person]),
        (902, "https://shared.example/feed", vec![person, 1]),
    ] {
        sqlx::query(
            "INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (?, ?, ?, 'A feed', 1)",
        )
        .bind(id)
        .bind(url)
        .bind(url)
        .execute(db)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
             VALUES (?1, ?1, 'one', 'A post', 1, 1)",
        )
        .bind(id)
        .execute(db)
        .await
        .unwrap();
        for follower in followers {
            sqlx::query(
                "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (?, ?, 'A feed', 1)",
            )
            .bind(follower)
            .bind(id)
            .execute(db)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO entries (person_id, article_id, feed_id, sort_at, starred) VALUES (?, ?2, ?2, 1, 1)",
            )
            .bind(follower)
            .bind(id)
            .execute(db)
            .await
            .unwrap();
        }
    }

    // Every table with a reader's lines is one `people::delete` names.
    let tables = tables_with_a_reader(&state.db).await;
    for table in &tables {
        assert!(
            nine_turtles::people::PER_READER_TABLES
                .iter()
                .any(|(name, _)| name == table),
            "{table} has a person_id column but people::PER_READER_TABLES doesn't name it, \
             so deleting an account would leave its lines behind"
        );
    }

    // How many lines the owner has in each, to check none of theirs go.
    let mut owners_before = Vec::new();
    for table in &tables {
        owners_before.push(lines_of(&state.db, table, 1).await);
    }

    // The owner's own account can't be deleted.
    let refused = post(&base, "/api/people/me/delete", Some(&owner), json!({})).await;
    assert_eq!(refused.status(), StatusCode::FORBIDDEN);

    let deleted = post(&base, "/api/people/me/delete", Some(&cookie), json!({})).await;
    assert_eq!(deleted.status(), StatusCode::NO_CONTENT);
    // Both the cookie and its name from before the rename are cleared.
    let cleared: Vec<&str> = deleted
        .headers()
        .get_all("set-cookie")
        .iter()
        .map(|value| value.to_str().unwrap())
        .filter(|value| value.contains("Max-Age=0"))
        .collect();
    assert!(
        cleared
            .iter()
            .any(|value| value.starts_with("nine_turtles_session=;"))
    );
    assert!(
        cleared
            .iter()
            .any(|value| value.starts_with("slowfeed_session=;"))
    );
    assert_eq!(session(&base, Some(&cookie)).await["signed_in"], false);

    for (table, owners) in tables.iter().zip(owners_before) {
        assert_eq!(
            lines_of(&state.db, table, person).await,
            0,
            "{table} still holds the deleted reader's lines"
        );
        let still = lines_of(&state.db, table, 1).await;
        // The owner's entry in the feed only the reader followed was never
        // there; every other line of the owner's stays.
        assert_eq!(still, owners, "{table} lost some of the owner's lines");
    }
    // Their emailed links held their email: gone too.
    let links: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM email_links WHERE email = ? COLLATE NOCASE")
            .bind(email)
            .fetch_one(&state.db)
            .await
            .unwrap();
    assert_eq!(
        links, 0,
        "email_links still holds the deleted reader's email"
    );
    let gone: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM people WHERE id = ?")
        .bind(person)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(gone, 0);
    // The feed only they followed is gone, articles and all, so it's no
    // longer checked; the owner's keeps everything.
    let feeds: Vec<i64> = sqlx::query_scalar("SELECT id FROM feeds WHERE id IN (901, 902)")
        .fetch_all(db)
        .await
        .unwrap();
    assert_eq!(feeds, [902]);
    let articles: Vec<i64> = sqlx::query_scalar("SELECT id FROM articles WHERE id IN (901, 902)")
        .fetch_all(db)
        .await
        .unwrap();
    assert_eq!(articles, [902]);
    let owners: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND article_id = 902")
            .fetch_one(db)
            .await
            .unwrap();
    assert_eq!(owners, 1);

    // The owner is untouched, and the address is free to sign up again.
    assert_eq!(session(&base, Some(&owner)).await["signed_in"], true);
    assert_eq!(
        sign_in(&base, email, READER_PASSWORD).await.status(),
        StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn deleting_ones_data_empties_the_account_but_keeps_it() {
    let (base, state, outbox, owner) = open_app().await;
    let email = "fresh@example.com";
    let cookie = open_reader(&base, &outbox, email).await;
    let person: i64 = sqlx::query_scalar("SELECT id FROM people WHERE email = ?")
        .bind(email)
        .fetch_one(&state.db)
        .await
        .unwrap();
    let db = &state.db;

    // Some of their data, and the owner's, and two things of their account.
    for statement in [
        "INSERT INTO folders (person_id, name) VALUES (?, 'Essays')",
        "INSERT INTO saved_searches (person_id, name, query, created_at) VALUES (?, 'Gardens', '{\"words\":\"garden\"}', 0)",
        "INSERT INTO rules (person_id, words, action, created_at) VALUES (?, 'Sponsored', 'mute', 0)",
        "INSERT INTO person_settings (person_id, name, value) VALUES (?, 'sort', 'oldest')",
        "INSERT INTO app_passwords (person_id, password_hash, made_at) VALUES (?1, 'x' || ?1, 0)",
    ] {
        for whose in [person, 1] {
            sqlx::query(statement)
                .bind(whose)
                .execute(db)
                .await
                .unwrap();
        }
    }
    // A feed only they follow, with a starred article on a collection, and
    // one the owner follows too.
    for (id, url, followers) in [
        (901, "https://only.example/feed", vec![person]),
        (902, "https://shared.example/feed", vec![person, 1]),
    ] {
        sqlx::query(
            "INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (?, ?, ?, 'A feed', 1)",
        )
        .bind(id)
        .bind(url)
        .bind(url)
        .execute(db)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
             VALUES (?1, ?1, 'one', 'A post', 1, 1)",
        )
        .bind(id)
        .execute(db)
        .await
        .unwrap();
        for follower in followers {
            sqlx::query(
                "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (?, ?, 'A feed', 1)",
            )
            .bind(follower)
            .bind(id)
            .execute(db)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO entries (person_id, article_id, feed_id, sort_at, starred) VALUES (?, ?2, ?2, 1, 1)",
            )
            .bind(follower)
            .bind(id)
            .execute(db)
            .await
            .unwrap();
        }
    }
    let made = post(
        &base,
        "/api/collections",
        Some(&cookie),
        json!({ "name": "Keep" }),
    )
    .await;
    assert!(made.status().is_success(), "{}", made.status());

    // Two of their newsletters: one they follow, and one they stopped,
    // whose feed's line keeps its sender away (decision 0091).
    for (id, stopped) in [(903, None), (904, Some(1))] {
        let url = format!("newsletter:{person}:{id}");
        sqlx::query(
            "INSERT INTO feeds (id, url, url_key, title, added_at, newsletter_of)
             VALUES (?, ?2, ?2, 'A letter', 1, ?3)",
        )
        .bind(id)
        .bind(&url)
        .bind(person)
        .execute(db)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO subscriptions (person_id, feed_id, title, added_at, unsubscribed_at)
             VALUES (?, ?, 'A letter', 1, ?)",
        )
        .bind(person)
        .bind(id)
        .bind(stopped)
        .execute(db)
        .await
        .unwrap();
    }

    // Each table is the data that goes or the account that stays, never both.
    let tables = tables_with_a_reader(db).await;
    for (table, _) in nine_turtles::people::PER_READER_TABLES {
        let data = nine_turtles::people::DATA_TABLES.contains(table);
        let account = nine_turtles::people::ACCOUNT_TABLES.contains(table);
        assert!(
            data != account,
            "{table} must be in exactly one of people::DATA_TABLES and people::ACCOUNT_TABLES"
        );
    }
    let mut owners_before = Vec::new();
    for table in &tables {
        owners_before.push(lines_of(db, table, 1).await);
    }
    let mut kept_before = Vec::new();
    for table in nine_turtles::people::ACCOUNT_TABLES {
        kept_before.push(lines_of(db, table, person).await);
    }

    // Signed out, nothing happens.
    let refused = post(&base, "/api/people/me/data/delete", None, json!({})).await;
    assert_eq!(refused.status(), StatusCode::UNAUTHORIZED);

    let emptied = post(
        &base,
        "/api/people/me/data/delete",
        Some(&cookie),
        json!({}),
    )
    .await;
    assert_eq!(emptied.status(), StatusCode::NO_CONTENT);

    for table in nine_turtles::people::DATA_TABLES {
        assert_eq!(
            lines_of(db, table, person).await,
            0,
            "{table} still holds the reader's data"
        );
    }
    for (table, before) in nine_turtles::people::ACCOUNT_TABLES.iter().zip(kept_before) {
        assert_eq!(
            lines_of(db, table, person).await,
            before,
            "{table} lost some of the reader's account"
        );
    }
    for (table, owners) in tables.iter().zip(owners_before) {
        assert_eq!(
            lines_of(db, table, 1).await,
            owners,
            "{table} lost some of the owner's lines"
        );
    }
    // The feed only they followed goes; the shared one stays for the owner.
    let feeds: Vec<i64> = sqlx::query_scalar("SELECT id FROM feeds WHERE id IN (901, 902)")
        .fetch_all(db)
        .await
        .unwrap();
    assert_eq!(feeds, [902]);
    // The newsletter they followed goes; the one they stopped stays stopped.
    let letters: Vec<i64> = sqlx::query_scalar("SELECT id FROM feeds WHERE id IN (903, 904)")
        .fetch_all(db)
        .await
        .unwrap();
    assert_eq!(letters, [904]);

    // They're still signed in, and can sign in again with the same password.
    assert_eq!(session(&base, Some(&cookie)).await["signed_in"], true);
    assert_eq!(
        sign_in(&base, email, READER_PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );

    // The owner can empty their own account too.
    let emptied = post(&base, "/api/people/me/data/delete", Some(&owner), json!({})).await;
    assert_eq!(emptied.status(), StatusCode::NO_CONTENT);
    for table in nine_turtles::people::DATA_TABLES {
        assert_eq!(
            lines_of(db, table, 1).await,
            0,
            "{table} still holds the owner's data"
        );
    }
    let feeds: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM feeds WHERE id IN (901, 902)")
        .fetch_one(db)
        .await
        .unwrap();
    assert_eq!(feeds, 0);
    assert_eq!(session(&base, Some(&owner)).await["signed_in"], true);
}

/// Whether `task` is still waiting after a moment.
async fn still_waiting<T>(task: &tokio::task::JoinHandle<T>) -> bool {
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    !task.is_finished()
}

#[tokio::test]
async fn changing_an_email_counts_wrong_passwords_as_sign_in_does() {
    let (base, _, outbox, _) = open_app().await;
    let email = "ivy@example.com";
    let cookie = open_reader(&base, &outbox, email).await;
    let change = |password: &'static str| {
        post(
            &base,
            "/api/people/me/email/change",
            Some(&cookie),
            json!({ "email": "ivy@elsewhere.example", "password": password }),
        )
    };
    for _ in 0..4 {
        assert_eq!(
            change("not my password").await.status(),
            StatusCode::UNAUTHORIZED
        );
    }
    // The fifth wrong try starts the wait, here and for signing in alike.
    assert_eq!(
        change("not my password").await.status(),
        StatusCode::TOO_MANY_REQUESTS
    );
    assert_eq!(
        change(READER_PASSWORD).await.status(),
        StatusCode::TOO_MANY_REQUESTS
    );
    assert_eq!(
        sign_in(&base, email, READER_PASSWORD).await.status(),
        StatusCode::TOO_MANY_REQUESTS
    );
    assert!(emails_to(&outbox, "ivy@elsewhere.example").is_empty());
}

#[tokio::test]
async fn emailed_links_wait_their_turn_for_a_password_check() {
    let (base, state, outbox, _) = open_app().await;
    let email = "lee@example.com";
    let cookie = open_reader(&base, &outbox, email).await;
    post(
        &base,
        "/api/password/forgot",
        None,
        json!({ "email": email }),
    )
    .await;
    let (_, ticket) = newest_link(&outbox, email);

    // Every place for checks is taken, as in a flood of guesses.
    let flood = state
        .password_checks
        .others
        .acquire_many(nine_turtles::auth::OTHERS_CHECKS_AT_ONCE as u32)
        .await
        .unwrap();
    // A made-up ticket is refused at once: no password is scrambled for it.
    let made_up = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        post(
            &base,
            "/api/password/reset",
            None,
            json!({ "ticket": "0".repeat(64), "password": NEW_PASSWORD }),
        ),
    )
    .await
    .expect("a made-up ticket waited for a password check");
    assert_eq!(made_up.status(), StatusCode::GONE);

    let change = tokio::spawn({
        let base = base.clone();
        async move {
            post(
                &base,
                "/api/people/me/email/change",
                Some(&cookie),
                json!({ "email": "lee@elsewhere.example", "password": READER_PASSWORD }),
            )
            .await
            .status()
        }
    });
    assert!(still_waiting(&change).await);
    let reset = tokio::spawn({
        let base = base.clone();
        async move {
            post(
                &base,
                "/api/password/reset",
                None,
                json!({ "ticket": ticket, "password": NEW_PASSWORD }),
            )
            .await
            .status()
        }
    });
    assert!(still_waiting(&reset).await);
    drop(flood);
    assert_eq!(change.await.unwrap(), StatusCode::ACCEPTED);
    assert_eq!(reset.await.unwrap(), StatusCode::OK);
}

#[tokio::test]
async fn an_address_with_a_name_in_it_is_refused() {
    let (base, _, outbox, _) = open_app().await;
    open_reader(&base, &outbox, "victim@example.com").await;
    for path in ["/api/password/forgot", "/api/sign-up"] {
        let response = post(
            &base,
            path,
            None,
            json!({
                "email": "evil<victim@example.com>",
                "password": READER_PASSWORD,
            }),
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{path}");
        assert_eq!(error_of(response).await, "email", "{path}");
    }
    assert!(emails_to(&outbox, "victim@example.com").is_empty());
}

#[tokio::test]
async fn requests_sent_together_cant_pass_the_limits() {
    let (base, _, outbox, _) = open_app().await;
    let email = "rush@example.com";
    let cookie = open_reader(&base, &outbox, email).await;
    // "Forgot your password?" ten times at once: only one password link
    // goes out in a minute.
    let mut forgots = Vec::new();
    for _ in 0..10 {
        let base = base.clone();
        forgots.push(tokio::spawn(async move {
            post(
                &base,
                "/api/password/forgot",
                None,
                json!({ "email": email }),
            )
            .await
            .status()
        }));
    }
    for forgot in forgots {
        assert_eq!(forgot.await.unwrap(), StatusCode::ACCEPTED);
    }
    assert_eq!(emails_to(&outbox, email).len(), 1);

    // Five changes of email at once, each to a new address: three go out,
    // and the rest are told there have been enough.
    let mut changes = Vec::new();
    for number in 0..5 {
        let base = base.clone();
        let cookie = cookie.clone();
        changes.push(tokio::spawn(async move {
            post(
                &base,
                "/api/people/me/email/change",
                Some(&cookie),
                json!({
                    "email": format!("rush{number}@elsewhere.example"),
                    "password": READER_PASSWORD,
                }),
            )
            .await
            .status()
        }));
    }
    let mut answers = Vec::new();
    for change in changes {
        answers.push(change.await.unwrap());
    }
    let sent = answers
        .iter()
        .filter(|status| **status == StatusCode::ACCEPTED)
        .count();
    let too_many = answers
        .iter()
        .filter(|status| **status == StatusCode::TOO_MANY_REQUESTS)
        .count();
    assert_eq!((sent, too_many), (3, 2), "{answers:?}");
    let links = (0..5)
        .map(|number| emails_to(&outbox, &format!("rush{number}@elsewhere.example")).len())
        .sum::<usize>();
    assert_eq!(links, 3);
}

#[tokio::test]
async fn changing_to_a_taken_address_counts_as_any_change() {
    let (base, _, outbox, _) = open_app().await;
    let cookie = open_reader(&base, &outbox, "asks@example.com").await;
    open_reader(&base, &outbox, "taken@example.com").await;
    let other = open_reader(&base, &outbox, "other@example.com").await;
    let change = |cookie: String, email: &'static str| {
        let base = base.clone();
        async move {
            post(
                &base,
                "/api/people/me/email/change",
                Some(&cookie),
                json!({ "email": email, "password": READER_PASSWORD }),
            )
            .await
            .status()
        }
    };
    // Four tries at a taken address answer exactly as four at a free one.
    let mut taken = Vec::new();
    let mut free = Vec::new();
    for _ in 0..4 {
        taken.push(change(cookie.clone(), "taken@example.com").await);
        free.push(change(other.clone(), "free@example.com").await);
    }
    assert_eq!(taken, free);
    assert_eq!(
        taken,
        [
            StatusCode::ACCEPTED,
            StatusCode::ACCEPTED,
            StatusCode::ACCEPTED,
            StatusCode::TOO_MANY_REQUESTS
        ]
    );
    // The taken address got nothing, and its own emails aren't used up:
    // its reader can still ask for a new password.
    assert!(emails_to(&outbox, "taken@example.com").is_empty());
    post(
        &base,
        "/api/password/forgot",
        None,
        json!({ "email": "taken@example.com" }),
    )
    .await;
    assert_eq!(emails_to(&outbox, "taken@example.com").len(), 1);
}

#[tokio::test]
async fn the_owners_email_needs_their_password() {
    let (base, state, _) = start_with_mail(common::config()).await;
    let owner = signed_in(&base).await;
    let save = |password: &'static str| {
        post(
            &base,
            "/api/people/me/email",
            Some(&owner),
            json!({ "email": "taker@example.com", "password": password }),
        )
    };
    let missing = post(
        &base,
        "/api/people/me/email",
        Some(&owner),
        json!({ "email": "taker@example.com" }),
    )
    .await;
    assert_eq!(missing.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(error_of(missing).await, "wrong-password");
    for _ in 0..3 {
        let wrong = save("not the owner's password").await;
        assert_eq!(wrong.status(), StatusCode::UNAUTHORIZED);
    }
    let email: Option<String> = sqlx::query_scalar("SELECT email FROM people WHERE id = 1")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(email.as_deref(), Some(common::OWNER_EMAIL));
    // The fifth wrong try starts the wait, for signing in with the owner's email too.
    assert_eq!(
        save("not the owner's password").await.status(),
        StatusCode::TOO_MANY_REQUESTS
    );
    assert_eq!(save(PASSWORD).await.status(), StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(
        sign_in(&base, common::OWNER_EMAIL, PASSWORD).await.status(),
        StatusCode::TOO_MANY_REQUESTS
    );
}

#[tokio::test]
async fn a_new_password_setting_wins_over_one_set_by_email() {
    let first = common::config();
    let data_dir = first.data_dir.clone();
    let first_setting = first.password.clone();
    let (base, _, outbox) = start_with_mail(first).await;
    let owner = signed_in(&base).await;
    post(
        &base,
        "/api/people/me/email",
        Some(&owner),
        json!({ "email": "owner@example.com", "password": PASSWORD }),
    )
    .await;
    post(
        &base,
        "/api/password/forgot",
        None,
        json!({ "email": "owner@example.com" }),
    )
    .await;
    let (_, ticket) = newest_link(&outbox, "owner@example.com");
    let reset = post(
        &base,
        "/api/password/reset",
        None,
        json!({ "ticket": ticket, "password": NEW_PASSWORD }),
    )
    .await;
    assert_eq!(reset.status(), StatusCode::OK);
    let device = cookie_from(&reset);
    // A sign-in link asked for and not yet used.
    ask_sign_in_link(&base, "owner@example.com").await;
    let (page, sign_in_ticket) = newest_link(&outbox, "owner@example.com");
    assert_eq!(page, "/sign-in-link");

    let owner_with = |base: String, password: &'static str| async move {
        sign_in(&base, "owner@example.com", password).await.status()
    };

    // Started again with the same setting: the password set by email stays.
    let mut same = common::config();
    same.data_dir = data_dir.clone();
    same.password = first_setting.clone();
    let (base, _) = start_with_state(same).await;
    assert_eq!(
        owner_with(base.clone(), NEW_PASSWORD).await,
        StatusCode::NO_CONTENT
    );
    assert_eq!(session(&base, Some(&device)).await["signed_in"], true);

    // Started with no setting at all: nothing changes, so a slip on the
    // host never locks the owner out.
    let mut none = common::config();
    none.data_dir = data_dir.clone();
    none.password = nine_turtles::config::PasswordSetting::Missing;
    let (base, _) = start_with_state(none).await;
    assert_eq!(
        sign_in(&base, "owner@example.com", NEW_PASSWORD)
            .await
            .status(),
        StatusCode::NO_CONTENT
    );

    // A new NINE_TURTLES_PASSWORD_HASH wins: the owner's way back that
    // needs no email sent. The password set by email stops working, and every
    // device signed in as the owner is signed out, and links sent before
    // stop working.
    const ANOTHER: &str = "the owner's way back in";
    let mut changed = common::config();
    changed.data_dir = data_dir.clone();
    changed.password =
        nine_turtles::config::PasswordSetting::Set(nine_turtles::password::hash(ANOTHER).unwrap());
    let (base, state) = start_with_state(changed.clone()).await;
    assert_eq!(session(&base, Some(&device)).await["signed_in"], false);
    assert_eq!(
        use_sign_in_link(&base, &sign_in_ticket).await.status(),
        StatusCode::GONE
    );
    assert_eq!(
        owner_with(base.clone(), NEW_PASSWORD).await,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        owner_with(base.clone(), ANOTHER).await,
        StatusCode::NO_CONTENT
    );
    let own: Option<String> = sqlx::query_scalar("SELECT password_hash FROM people WHERE id = 1")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(own, None);

    // And once the setting is in force again, starting again changes nothing more.
    let (base, _) = start_with_state(changed).await;
    assert_eq!(owner_with(base, ANOTHER).await, StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn emailed_links_past_their_time_are_tidied_by_background_checking() {
    let (base, state, outbox, _) = open_app().await;
    open_reader(&base, &outbox, "later@example.com").await;
    let changed = post(
        &base,
        "/api/password/forgot",
        None,
        json!({ "email": "later@example.com" }),
    )
    .await;
    assert_eq!(changed.status(), StatusCode::ACCEPTED);
    assert_eq!(emails_to(&outbox, "later@example.com").len(), 1);
    let count = || async {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM email_links")
            .fetch_one(&state.db)
            .await
            .unwrap()
    };
    assert_eq!(count().await, 1);
    nine_turtles::checking::round(&state, nine_turtles::now())
        .await
        .unwrap();
    assert_eq!(count().await, 1);
    nine_turtles::checking::round(&state, nine_turtles::now() + 25 * 60 * 60)
        .await
        .unwrap();
    assert_eq!(count().await, 0);
}

/// Asks for a sign-in link for `email`, as "Email me a sign-in link" does.
async fn ask_sign_in_link(base: &str, email: &str) -> Response {
    post(base, "/api/sign-in/link", None, json!({ "email": email })).await
}

async fn use_sign_in_link(base: &str, ticket: &str) -> Response {
    post(
        base,
        "/api/sign-in/link/use",
        None,
        json!({ "ticket": ticket }),
    )
    .await
}

#[tokio::test]
async fn a_sign_in_link_signs_in_once_and_leaves_the_password_alone() {
    let (base, state, outbox, _) = open_app().await;
    let email = "iris@example.com";
    let laptop = open_reader(&base, &outbox, email).await;
    let before = emails_to(&outbox, email).len();

    // The same answer whether or not the address has an account.
    let nobody = ask_sign_in_link(&base, "nobody@example.com").await;
    let (nobody_status, nobody_body) = (nobody.status(), nobody.text().await.unwrap());
    let someone = ask_sign_in_link(&base, "IRIS@example.com").await;
    assert_eq!(nobody_status, StatusCode::ACCEPTED);
    assert_eq!(
        (nobody_status, nobody_body),
        (someone.status(), someone.text().await.unwrap())
    );
    assert!(emails_to(&outbox, "nobody@example.com").is_empty());
    let sent = emails_to(&outbox, email);
    assert_eq!(sent.len(), before + 1);
    assert_eq!(sent.last().unwrap().subject, "Sign in to nine turtles");
    let (page, ticket) = newest_link(&outbox, email);
    assert_eq!(page, "/sign-in-link");
    let lifetime: i64 = sqlx::query_scalar(
        "SELECT expires_at - created_at FROM email_links WHERE purpose = 'sign-in'",
    )
    .fetch_one(&state.db)
    .await
    .unwrap();
    assert_eq!(lifetime, 15 * 60);

    let used = use_sign_in_link(&base, &ticket).await;
    assert_eq!(used.status(), StatusCode::OK);
    let phone = cookie_from(&used);
    let signed_in_as = session(&base, Some(&phone)).await;
    assert_eq!(signed_in_as["signed_in"], true);
    assert_eq!(signed_in_as["email"], email);
    // The other device stays signed in, and the password still works.
    assert_eq!(session(&base, Some(&laptop)).await["signed_in"], true);
    assert_eq!(
        sign_in(&base, email, READER_PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );
    // Once only.
    assert_eq!(
        use_sign_in_link(&base, &ticket).await.status(),
        StatusCode::GONE
    );
    assert_eq!(
        use_sign_in_link(&base, "made-up").await.status(),
        StatusCode::GONE
    );
}

#[tokio::test]
async fn a_sign_in_link_lasts_fifteen_minutes_and_still_counts_for_the_hour() {
    let (base, state, outbox, _) = open_app().await;
    let email = "lena@example.com";
    open_reader(&base, &outbox, email).await;
    ask_sign_in_link(&base, email).await;
    let (_, ticket) = newest_link(&outbox, email);
    // Sixteen minutes later.
    sqlx::query(
        "UPDATE email_links SET created_at = created_at - 16 * 60,
                                expires_at = expires_at - 16 * 60",
    )
    .execute(&state.db)
    .await
    .unwrap();
    assert_eq!(
        use_sign_in_link(&base, &ticket).await.status(),
        StatusCode::GONE
    );
    // The sign-in link was one of the hour's three, though it has stopped
    // working: two more, then nothing.
    let before = emails_to(&outbox, email).len();
    for _ in 0..3 {
        a_minute_passes(&state.db).await;
        assert_eq!(
            ask_sign_in_link(&base, email).await.status(),
            StatusCode::ACCEPTED
        );
    }
    assert_eq!(emails_to(&outbox, email).len(), before + 2);
}

#[tokio::test]
async fn pressing_send_link_twice_sends_one_sign_in_link() {
    let (base, state, outbox, _) = open_app().await;
    let email = "twice-in@example.com";
    open_reader(&base, &outbox, email).await;
    let before = emails_to(&outbox, email).len();
    assert_eq!(
        ask_sign_in_link(&base, email).await.status(),
        StatusCode::ACCEPTED
    );
    assert_eq!(
        ask_sign_in_link(&base, email).await.status(),
        StatusCode::ACCEPTED
    );
    assert_eq!(emails_to(&outbox, email).len(), before + 1);
    a_minute_passes(&state.db).await;
    ask_sign_in_link(&base, email).await;
    assert_eq!(emails_to(&outbox, email).len(), before + 2);
}

#[tokio::test]
async fn a_new_email_or_a_new_password_ends_earlier_sign_in_links() {
    let (base, state, outbox, _) = open_app().await;
    let email = "moss@example.com";
    let laptop = open_reader(&base, &outbox, email).await;

    // A link to the old address stops working once the email changes.
    ask_sign_in_link(&base, email).await;
    let (_, to_old) = newest_link(&outbox, email);
    let change = post(
        &base,
        "/api/people/me/email/change",
        Some(&laptop),
        json!({ "email": "fern@example.com", "password": READER_PASSWORD }),
    )
    .await;
    assert!(change.status().is_success());
    let (_, confirm) = newest_link(&outbox, "fern@example.com");
    let confirmed = post(
        &base,
        "/api/email/confirm",
        None,
        json!({ "ticket": confirm }),
    )
    .await;
    assert_eq!(confirmed.status(), StatusCode::OK);
    assert_eq!(
        use_sign_in_link(&base, &to_old).await.status(),
        StatusCode::GONE
    );

    // A new password ends a sign-in link not yet used.
    a_minute_passes(&state.db).await;
    ask_sign_in_link(&base, "fern@example.com").await;
    let (_, sign_in_ticket) = newest_link(&outbox, "fern@example.com");
    a_minute_passes(&state.db).await;
    post(
        &base,
        "/api/password/forgot",
        None,
        json!({ "email": "fern@example.com" }),
    )
    .await;
    let (_, reset_ticket) = newest_link(&outbox, "fern@example.com");
    let reset = post(
        &base,
        "/api/password/reset",
        None,
        json!({ "ticket": reset_ticket, "password": NEW_PASSWORD }),
    )
    .await;
    assert_eq!(reset.status(), StatusCode::OK);
    assert_eq!(
        use_sign_in_link(&base, &sign_in_ticket).await.status(),
        StatusCode::GONE
    );
}

#[tokio::test]
async fn the_owner_can_sign_in_by_email_link_too() {
    let (base, _, outbox) = start_with_mail(common::config()).await;
    // Before the owner's first sign-in saves their email, nothing goes anywhere.
    ask_sign_in_link(&base, "owner@example.com").await;
    assert!(emails_to(&outbox, "owner@example.com").is_empty());
    signed_in(&base).await;
    ask_sign_in_link(&base, "owner@example.com").await;
    let (_, ticket) = newest_link(&outbox, "owner@example.com");
    let used = use_sign_in_link(&base, &ticket).await;
    assert_eq!(used.status(), StatusCode::OK);
    let phone = cookie_from(&used);
    assert_eq!(session(&base, Some(&phone)).await["owner"], true);
    // Signing in with the email and password is as it was.
    assert_eq!(
        sign_in(&base, "owner@example.com", PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );
}
