//! What email makes possible (SPEC sections 1 and 18, decision 0088):
//! confirming an Open sign-up, "Forgot your password?", changing an email,
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

/// A nine turtles that can send email, with sign-up switched to Open by the
/// owner. Answers its address, its insides, the outbox and the owner's cookie.
async fn open_app() -> (String, nine_turtles::AppState, Outbox, String) {
    let (base, state, outbox) = start_with_mail(common::config()).await;
    let owner = signed_in(&base).await;
    let switched = post(
        &base,
        "/api/sign-up/switch",
        Some(&owner),
        json!({ "sign_up": "open" }),
    )
    .await;
    assert_eq!(switched.status(), StatusCode::NO_CONTENT);
    (base, state, outbox, owner)
}

/// Signs up while Open and follows the emailed link: answers the new reader's cookie.
async fn confirmed_reader(base: &str, outbox: &Outbox, email: &str) -> String {
    let asked = post(
        base,
        "/api/sign-up",
        None,
        json!({ "email": email, "password": READER_PASSWORD, "invite": "" }),
    )
    .await;
    assert_eq!(asked.status(), StatusCode::ACCEPTED);
    let (page, ticket) = newest_link(outbox, email);
    assert_eq!(page, "/confirm-email");
    let confirmed = post(
        base,
        "/api/email/confirm",
        None,
        json!({ "ticket": ticket }),
    )
    .await;
    assert_eq!(confirmed.status(), StatusCode::OK);
    cookie_from(&confirmed)
}

#[tokio::test]
async fn without_email_settings_nothing_is_sent_and_open_stays_refused() {
    let (base, state) = start_with_state(common::config()).await;
    assert!(state.mailer.is_none());
    let owner = signed_in(&base).await;

    let switched = post(
        &base,
        "/api/sign-up/switch",
        Some(&owner),
        json!({ "sign_up": "open" }),
    )
    .await;
    assert_eq!(switched.status(), StatusCode::BAD_REQUEST);
    assert_eq!(error_of(switched).await, "open-needs-email");

    // Even set by hand, Open isn't open without email.
    sqlx::query("INSERT OR REPLACE INTO settings (name, value) VALUES ('sign_up', 'open')")
        .execute(&state.db)
        .await
        .unwrap();
    let signed_up = post(
        &base,
        "/api/sign-up",
        None,
        json!({ "email": "mira@example.com", "password": READER_PASSWORD, "invite": "" }),
    )
    .await;
    assert_eq!(signed_up.status(), StatusCode::FORBIDDEN);

    let forgot = post(
        &base,
        "/api/password/forgot",
        None,
        json!({ "email": "mira@example.com" }),
    )
    .await;
    assert_eq!(forgot.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(error_of(forgot).await, "no-email");

    let signed_out = session(&base, None).await;
    assert_eq!(signed_out["email_sending"], false);
    assert_eq!(signed_out["sign_up_open"], false);
    assert_eq!(session(&base, Some(&owner)).await["email_sending"], false);
}

#[tokio::test]
async fn an_open_sign_up_waits_for_its_emailed_link() {
    let (base, state, outbox, owner) = open_app().await;
    let settings: Value = Client::new()
        .get(format!("{base}/api/sign-up/settings"))
        .header("cookie", &owner)
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap()
        .parse()
        .unwrap();
    assert_eq!(settings["sign_up"], "open");
    assert_eq!(settings["open_available"], true);
    let signed_out = session(&base, None).await;
    assert_eq!(signed_out["sign_up_open"], true);
    assert_eq!(signed_out["email_sending"], true);

    let email = "mira@example.com";
    let asked = post(
        &base,
        "/api/sign-up",
        None,
        json!({ "email": email, "password": READER_PASSWORD, "invite": "" }),
    )
    .await;
    assert_eq!(asked.status(), StatusCode::ACCEPTED);
    assert!(asked.headers().get("set-cookie").is_none());
    let sent = emails_to(&outbox, email);
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0].subject, "Confirm your email for nine turtles");
    assert!(!sent[0].body.contains('!'));
    let (page, ticket) = newest_link(&outbox, email);
    assert_eq!(page, "/confirm-email");
    assert_eq!(ticket.len(), 64);

    // No account yet; only a scramble of the ticket is kept.
    let people: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM people WHERE email = ?")
        .bind(email)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(people, 0);
    let stored: Vec<u8> = sqlx::query_scalar("SELECT token_hash FROM email_links")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_ne!(stored, ticket.as_bytes());
    assert_eq!(stored.len(), 32);

    // Signing in before confirming: the right password hears it's waiting
    // (and the link is sent again); a wrong one hears only "don't match".
    let wrong = sign_in(&base, email, "not the password at all").await;
    assert_eq!(wrong.status(), StatusCode::UNAUTHORIZED);
    let waiting = sign_in(&base, email, READER_PASSWORD).await;
    assert_eq!(waiting.status(), StatusCode::FORBIDDEN);
    let waiting: Value = waiting.text().await.unwrap().parse::<Value>().unwrap();
    assert_eq!(waiting["error"], "unconfirmed");
    assert_eq!(waiting["sent"], true);
    assert_eq!(emails_to(&outbox, email).len(), 2);

    // The first link still works, once.
    let confirmed = post(
        &base,
        "/api/email/confirm",
        None,
        json!({ "ticket": ticket }),
    )
    .await;
    assert_eq!(confirmed.status(), StatusCode::OK);
    let cookie = cookie_from(&confirmed);
    let now = session(&base, Some(&cookie)).await;
    assert_eq!(now["signed_in"], true);
    assert_eq!(now["owner"], false);
    assert_eq!(now["email"], email);
    let again = post(
        &base,
        "/api/email/confirm",
        None,
        json!({ "ticket": ticket }),
    )
    .await;
    assert_eq!(again.status(), StatusCode::GONE);
    // The link sent again is spent too.
    let (_, resent) = newest_link(&outbox, email);
    let resent = post(
        &base,
        "/api/email/confirm",
        None,
        json!({ "ticket": resent }),
    )
    .await;
    assert_eq!(resent.status(), StatusCode::GONE);

    assert_eq!(
        sign_in(&base, email, READER_PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );

    // Signing up again with the same address answers the same, and sends nothing.
    let twice = post(
        &base,
        "/api/sign-up",
        None,
        json!({ "email": "MIRA@example.com", "password": READER_PASSWORD, "invite": "" }),
    )
    .await;
    assert_eq!(twice.status(), StatusCode::ACCEPTED);
    assert_eq!(emails_to(&outbox, email).len(), 2);
}

#[tokio::test]
async fn a_confirmation_link_lasts_a_day() {
    let (base, state, outbox, _) = open_app().await;
    let email = "late@example.com";
    post(
        &base,
        "/api/sign-up",
        None,
        json!({ "email": email, "password": READER_PASSWORD, "invite": "" }),
    )
    .await;
    let lifetime: i64 = sqlx::query_scalar("SELECT expires_at - created_at FROM email_links")
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(lifetime, 24 * 60 * 60);
    sqlx::query("UPDATE email_links SET expires_at = unixepoch() - 1")
        .execute(&state.db)
        .await
        .unwrap();
    let (_, ticket) = newest_link(&outbox, email);
    let late = post(
        &base,
        "/api/email/confirm",
        None,
        json!({ "ticket": ticket }),
    )
    .await;
    assert_eq!(late.status(), StatusCode::GONE);
    assert_eq!(error_of(late).await, "expired");
    // And an expired sign-up can't be signed in to either.
    assert_eq!(
        sign_in(&base, email, READER_PASSWORD).await.status(),
        StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn invite_sign_ups_need_no_email() {
    let (base, _, outbox) = start_with_mail(common::config()).await;
    let owner = signed_in(&base).await;
    post(
        &base,
        "/api/sign-up/switch",
        Some(&owner),
        json!({ "sign_up": "invite" }),
    )
    .await;
    let made: Value = post(&base, "/api/sign-up/invite", Some(&owner), json!({}))
        .await
        .text()
        .await
        .unwrap()
        .parse()
        .unwrap();
    let invite = made["invite"].as_str().unwrap();
    let joined = post(
        &base,
        "/api/sign-up",
        None,
        json!({ "email": "ines@example.com", "password": READER_PASSWORD, "invite": invite }),
    )
    .await;
    assert_eq!(joined.status(), StatusCode::NO_CONTENT);
    assert!(outbox.lock().unwrap().is_empty());
}

#[tokio::test]
async fn forgot_your_password_always_answers_the_same() {
    let (base, state, outbox, _) = open_app().await;
    let email = "noor@example.com";
    let laptop = confirmed_reader(&base, &outbox, email).await;
    let before = emails_to(&outbox, email).len();

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
    // The other device is signed out; the old password no longer works.
    assert_eq!(session(&base, Some(&laptop)).await["signed_in"], false);
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
    let (base, _, outbox, _) = open_app().await;
    let email = "tam@example.com";
    confirmed_reader(&base, &outbox, email).await;
    // The confirmation was one; two more reset emails, then nothing, though
    // the answer never changes.
    for _ in 0..5 {
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
async fn a_password_link_lasts_an_hour() {
    let (base, state, outbox, _) = open_app().await;
    let email = "ada@example.com";
    confirmed_reader(&base, &outbox, email).await;
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
    let cookie = confirmed_reader(&base, &outbox, old).await;

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
    let cookie = confirmed_reader(&base, &outbox, "one@example.com").await;
    confirmed_reader(&base, &outbox, "two@example.com").await;
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
        json!({ "email": "owner@example.com" }),
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
    // The new password works with the email and alone; the old one no longer does.
    let alone = post(
        &base,
        "/api/sign-in",
        None,
        json!({ "password": NEW_PASSWORD }),
    )
    .await;
    assert_eq!(alone.status(), StatusCode::NO_CONTENT);
    let old = post(&base, "/api/sign-in", None, json!({ "password": PASSWORD })).await;
    assert_eq!(old.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(
        sign_in(&base, "owner@example.com", NEW_PASSWORD)
            .await
            .status(),
        StatusCode::NO_CONTENT
    );
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
    let cookie = confirmed_reader(&base, &outbox, email).await;
    let person: i64 = sqlx::query_scalar("SELECT id FROM people WHERE email = ?")
        .bind(email)
        .fetch_one(&state.db)
        .await
        .unwrap();

    // Something of theirs in every table that can hold it.
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
            "INSERT INTO app_passwords (person_id, password_hash, made_at) VALUES (?, 'x', 0)",
            "an app password",
        ),
    ] {
        sqlx::query(statement)
            .bind(person)
            .execute(&state.db)
            .await
            .unwrap_or_else(|error| panic!("couldn't add {what}: {error}"));
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

    // The owner's own account can't be deleted.
    let refused = post(&base, "/api/people/me/delete", Some(&owner), json!({})).await;
    assert_eq!(refused.status(), StatusCode::FORBIDDEN);

    let deleted = post(&base, "/api/people/me/delete", Some(&cookie), json!({})).await;
    assert_eq!(deleted.status(), StatusCode::NO_CONTENT);
    assert!(
        deleted.headers()["set-cookie"]
            .to_str()
            .unwrap()
            .contains("Max-Age=0")
    );
    assert_eq!(session(&base, Some(&cookie)).await["signed_in"], false);

    for table in &tables {
        let left: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
            "SELECT COUNT(*) FROM \"{table}\" WHERE person_id = ?"
        )))
        .bind(person)
        .fetch_one(&state.db)
        .await
        .unwrap();
        assert_eq!(left, 0, "{table} still holds the deleted reader's lines");
    }
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

/// Whether `task` is still waiting after a moment.
async fn still_waiting<T>(task: &tokio::task::JoinHandle<T>) -> bool {
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    !task.is_finished()
}

#[tokio::test]
async fn changing_an_email_counts_wrong_passwords_as_sign_in_does() {
    let (base, _, outbox, _) = open_app().await;
    let email = "ivy@example.com";
    let cookie = confirmed_reader(&base, &outbox, email).await;
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
    let cookie = confirmed_reader(&base, &outbox, email).await;
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
async fn confirming_a_sign_up_goes_one_at_a_time_within_the_hours_count() {
    let (base, state, outbox, _) = open_app().await;
    let email = "noa@example.com";
    let asked = post(
        &base,
        "/api/sign-up",
        None,
        json!({ "email": email, "password": READER_PASSWORD, "invite": "" }),
    )
    .await;
    assert_eq!(asked.status(), StatusCode::ACCEPTED);
    let (_, ticket) = newest_link(&outbox, email);

    // The hour's accounts are made meanwhile: the link must wait.
    for number in 0..nine_turtles::people::SIGN_UPS_PER_HOUR {
        sqlx::query(
            "INSERT INTO people (owner, email, password_hash, created_at)
             VALUES (0, ?, NULL, unixepoch())",
        )
        .bind(format!("made{number}@example.com"))
        .execute(&state.db)
        .await
        .unwrap();
    }
    let capped = post(
        &base,
        "/api/email/confirm",
        None,
        json!({ "ticket": ticket }),
    )
    .await;
    assert_eq!(capped.status(), StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(error_of(capped).await, "too-many");
    sqlx::query("UPDATE people SET created_at = unixepoch() - 7200 WHERE owner = 0")
        .execute(&state.db)
        .await
        .unwrap();

    // Behind another sign-up, the link waits its turn; it still works.
    let one_at_a_time = state.sign_ups.lock().await;
    let confirmed = tokio::spawn({
        let base = base.clone();
        async move {
            post(
                &base,
                "/api/email/confirm",
                None,
                json!({ "ticket": ticket }),
            )
            .await
            .status()
        }
    });
    assert!(still_waiting(&confirmed).await);
    drop(one_at_a_time);
    assert_eq!(confirmed.await.unwrap(), StatusCode::OK);
}
