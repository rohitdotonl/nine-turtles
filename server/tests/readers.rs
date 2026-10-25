//! Signing in with an email address, the readers list, and joining through
//! the owner's sign-up switch (SPEC sections 1 and 18, decision 0087),
//! tested against a real running nine turtles.

mod common;

use common::PASSWORD;
use reqwest::{Client, Response, StatusCode};
use serde_json::{Value, json};

const READER_PASSWORD: &str = "slow mornings, long reads";

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

async fn get(base: &str, path: &str, cookie: &str) -> Response {
    Client::new()
        .get(format!("{base}{path}"))
        .header("cookie", cookie)
        .send()
        .await
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

async fn session(base: &str, cookie: &str) -> Value {
    get(base, "/api/session", cookie)
        .await
        .text()
        .await
        .unwrap()
        .parse::<Value>()
        .unwrap()
}

/// The owner makes an invite link; answers its ticket.
async fn invite(base: &str, owner: &str) -> String {
    let response = post(base, "/api/sign-up/invite", Some(owner), json!({})).await;
    assert_eq!(response.status(), StatusCode::OK);
    let body: Value = json_of(response).await;
    let ticket = body["invite"].as_str().unwrap().to_owned();
    assert_eq!(ticket.len(), 64);
    ticket
}

async fn sign_up(base: &str, email: &str, password: &str, invite: &str) -> Response {
    post(
        base,
        "/api/sign-up",
        None,
        json!({ "email": email, "password": password, "invite": invite }),
    )
    .await
}

#[tokio::test]
async fn an_invited_reader_signs_up_and_then_signs_in_with_their_email() {
    let base = common::start(common::config()).await;
    let owner = common::signed_in(&base).await;
    let ticket = invite(&base, &owner).await;

    let joined = sign_up(&base, "Mira@Example.com", READER_PASSWORD, &ticket).await;
    assert_eq!(joined.status(), StatusCode::NO_CONTENT);
    let joined_session = session(&base, &cookie_from(&joined)).await;
    assert_eq!(joined_session["signed_in"], true);
    assert_eq!(joined_session["owner"], false);
    assert_eq!(joined_session["email"], "Mira@Example.com");

    // Another device, however the address is capitalised.
    let again = sign_in(&base, " mira@example.com", READER_PASSWORD).await;
    assert_eq!(again.status(), StatusCode::NO_CONTENT);
    let again_session = session(&base, &cookie_from(&again)).await;
    assert_eq!(again_session["owner"], false);
    assert_eq!(again_session["email"], "Mira@Example.com");

    // Mira's password isn't the owner's, and the owner's isn't hers.
    assert_eq!(
        sign_in(&base, "mira@example.com", PASSWORD).await.status(),
        StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn a_wrong_password_and_an_unknown_email_get_the_same_answer() {
    let (base, state) = common::start_with_state(common::config()).await;
    let line = nine_turtles::password::hash(READER_PASSWORD).unwrap();
    sqlx::query("INSERT INTO people (email, password_hash, created_at) VALUES (?, ?, 1)")
        .bind("mira@example.com")
        .bind(line)
        .execute(&state.db)
        .await
        .unwrap();

    let wrong = sign_in(&base, "mira@example.com", "not her password").await;
    let unknown = sign_in(&base, "nobody@example.com", "not her password").await;
    assert_eq!(wrong.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(unknown.status(), wrong.status());
    assert!(wrong.headers().get("set-cookie").is_none());
    assert!(unknown.headers().get("set-cookie").is_none());
    assert_eq!(wrong.text().await.unwrap(), unknown.text().await.unwrap());
}

#[tokio::test]
async fn a_stranger_guessing_one_email_never_locks_the_owner_out() {
    let base = common::start(common::config()).await;
    let owner = common::signed_in(&base).await;
    assert_eq!(
        post(
            &base,
            "/api/people/me/email",
            Some(&owner),
            json!({ "email": "rohit@example.com", "password": common::PASSWORD })
        )
        .await
        .status(),
        StatusCode::OK
    );

    for _ in 0..4 {
        assert_eq!(
            sign_in(&base, "mira@example.com", "guess").await.status(),
            StatusCode::UNAUTHORIZED
        );
    }
    let fifth = sign_in(&base, "MIRA@example.com", "guess").await;
    assert_eq!(fifth.status(), StatusCode::TOO_MANY_REQUESTS);

    // The owner signs in both ways, with the password alone and with their email.
    let password_only = common::signed_in(&base).await;
    assert_eq!(session(&base, &password_only).await["owner"], true);
    let by_email = sign_in(&base, "Rohit@Example.com", PASSWORD).await;
    assert_eq!(by_email.status(), StatusCode::NO_CONTENT);
    let owner_session = session(&base, &cookie_from(&by_email)).await;
    assert_eq!(owner_session["owner"], true);
    assert_eq!(owner_session["email"], "rohit@example.com");

    // And the owner's own wrong tries don't make the guessed email wait longer, or vice versa.
    assert_eq!(
        sign_in(&base, "mira@example.com", "guess").await.status(),
        StatusCode::TOO_MANY_REQUESTS
    );
}

#[tokio::test]
async fn the_password_alone_is_still_the_owners_sign_in() {
    let base = common::start(common::config()).await;
    let cookie = common::signed_in(&base).await;
    let answer = session(&base, &cookie).await;
    assert_eq!(answer["owner"], true);
    assert_eq!(answer["email"], Value::Null);

    // An empty email is the same as none.
    let empty = sign_in(&base, "", PASSWORD).await;
    assert_eq!(empty.status(), StatusCode::NO_CONTENT);
    assert_eq!(session(&base, &cookie_from(&empty)).await["owner"], true);
}

#[tokio::test]
async fn only_the_owner_sees_the_readers_and_sets_sign_up() {
    let (base, state) = common::start_with_state(common::config()).await;
    let owner = common::signed_in(&base).await;
    let (_, reader) = common::another_reader(&state).await;

    let listed = get(&base, "/api/people", &owner).await;
    assert_eq!(listed.status(), StatusCode::OK);
    let body: Value = json_of(listed).await;
    let people = body["people"].as_array().unwrap();
    assert_eq!(people.len(), 2);
    assert_eq!(people[0]["owner"], true);
    assert_eq!(people[1]["owner"], false);
    for person in people {
        let mut fields: Vec<&String> = person.as_object().unwrap().keys().collect();
        fields.sort();
        assert_eq!(fields, ["created_at", "email", "id", "owner"]);
    }

    for path in ["/api/people", "/api/sign-up/settings"] {
        assert_eq!(
            get(&base, path, &reader).await.status(),
            StatusCode::FORBIDDEN,
            "{path}"
        );
    }
    for (path, body) in [
        ("/api/sign-up/switch", json!({ "sign_up": "invite" })),
        ("/api/sign-up/invite", json!({})),
        ("/api/people/me/email", json!({ "email": "me@example.com" })),
    ] {
        assert_eq!(
            post(&base, path, Some(&reader), body).await.status(),
            StatusCode::FORBIDDEN,
            "{path}"
        );
    }
    let settings: Value = get(&base, "/api/sign-up/settings", &owner)
        .await
        .text()
        .await
        .unwrap()
        .parse::<Value>()
        .unwrap();
    assert_eq!(settings["sign_up"], "closed");
}

#[tokio::test]
async fn while_sign_up_is_closed_nobody_can_join() {
    let base = common::start(common::config()).await;
    let owner = common::signed_in(&base).await;

    // A fresh nine turtles starts closed.
    let refused = sign_up(&base, "mira@example.com", READER_PASSWORD, "").await;
    assert_eq!(refused.status(), StatusCode::FORBIDDEN);
    assert_eq!(refused.text().await.unwrap(), r#"{"error":"closed"}"#);

    // Closing again forgets the invite link.
    let ticket = invite(&base, &owner).await;
    let closed = post(
        &base,
        "/api/sign-up/switch",
        Some(&owner),
        json!({ "sign_up": "closed" }),
    )
    .await;
    assert_eq!(closed.status(), StatusCode::NO_CONTENT);
    assert_eq!(
        sign_up(&base, "mira@example.com", READER_PASSWORD, &ticket)
            .await
            .status(),
        StatusCode::FORBIDDEN
    );
    // Choosing Invite link again doesn't bring the old link back.
    post(
        &base,
        "/api/sign-up/switch",
        Some(&owner),
        json!({ "sign_up": "invite" }),
    )
    .await;
    assert_eq!(
        sign_up(&base, "mira@example.com", READER_PASSWORD, &ticket)
            .await
            .status(),
        StatusCode::FORBIDDEN
    );
}

#[tokio::test]
async fn an_invite_link_works_for_several_until_a_new_one_is_made() {
    let base = common::start(common::config()).await;
    let owner = common::signed_in(&base).await;
    let first = invite(&base, &owner).await;

    for email in ["one@example.com", "two@example.com"] {
        assert_eq!(
            sign_up(&base, email, READER_PASSWORD, &first)
                .await
                .status(),
            StatusCode::NO_CONTENT,
            "{email}"
        );
    }

    let second = invite(&base, &owner).await;
    assert_ne!(first, second);
    assert_eq!(
        sign_up(&base, "three@example.com", READER_PASSWORD, &first)
            .await
            .status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        sign_up(&base, "three@example.com", READER_PASSWORD, &second)
            .await
            .status(),
        StatusCode::NO_CONTENT
    );
    let settings: Value = get(&base, "/api/sign-up/settings", &owner)
        .await
        .text()
        .await
        .unwrap()
        .parse::<Value>()
        .unwrap();
    assert_eq!(settings["sign_up"], "invite");
    assert!(settings["invite_made_at"].is_i64());
}

#[tokio::test]
async fn open_sign_up_is_refused_until_confirmation_emails_work() {
    let (base, state) = common::start_with_state(common::config()).await;
    let owner = common::signed_in(&base).await;
    let ticket = invite(&base, &owner).await;

    let switched = post(
        &base,
        "/api/sign-up/switch",
        Some(&owner),
        json!({ "sign_up": "open" }),
    )
    .await;
    assert_eq!(switched.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        switched.text().await.unwrap(),
        r#"{"error":"open-needs-email"}"#
    );

    // Even if the stored setting somehow said "open", nobody joins by it.
    sqlx::query("UPDATE settings SET value = 'open' WHERE name = 'sign_up'")
        .execute(&state.db)
        .await
        .unwrap();
    for ticket in ["", ticket.as_str()] {
        assert_eq!(
            sign_up(&base, "mira@example.com", READER_PASSWORD, ticket)
                .await
                .status(),
            StatusCode::FORBIDDEN
        );
    }
}

#[tokio::test]
async fn an_email_already_used_is_refused_and_so_are_poor_details() {
    let base = common::start(common::config()).await;
    let owner = common::signed_in(&base).await;
    let ticket = invite(&base, &owner).await;
    post(
        &base,
        "/api/people/me/email",
        Some(&owner),
        json!({ "email": "rohit@example.com", "password": common::PASSWORD }),
    )
    .await;
    assert_eq!(
        sign_up(&base, "mira@example.com", READER_PASSWORD, &ticket)
            .await
            .status(),
        StatusCode::NO_CONTENT
    );

    for email in ["MIRA@example.com", "Rohit@Example.com"] {
        let again = sign_up(&base, email, READER_PASSWORD, &ticket).await;
        assert_eq!(again.status(), StatusCode::CONFLICT, "{email}");
        assert_eq!(again.text().await.unwrap(), r#"{"error":"already"}"#);
    }
    // The owner can't take a reader's email either.
    let taken = post(
        &base,
        "/api/people/me/email",
        Some(&owner),
        json!({ "email": "Mira@example.com", "password": common::PASSWORD }),
    )
    .await;
    assert_eq!(taken.status(), StatusCode::CONFLICT);

    for (email, password, error) in [
        ("not an email", READER_PASSWORD, "email"),
        ("new@example.com", "too short", "password-short"),
        // One short of the 12 the owner's own password needs too.
        ("new@example.com", "eleven char", "password-short"),
    ] {
        let refused = sign_up(&base, email, password, &ticket).await;
        assert_eq!(refused.status(), StatusCode::BAD_REQUEST);
        assert_eq!(
            refused.text().await.unwrap(),
            format!(r#"{{"error":"{error}"}}"#)
        );
    }
}

#[tokio::test]
async fn no_more_than_twenty_accounts_are_made_in_an_hour() {
    let (base, state) = common::start_with_state(common::config()).await;
    let owner = common::signed_in(&base).await;
    let ticket = invite(&base, &owner).await;
    for number in 0..nine_turtles::people::SIGN_UPS_PER_HOUR {
        sqlx::query("INSERT INTO people (email, created_at) VALUES (?, unixepoch())")
            .bind(format!("{number}@example.com"))
            .execute(&state.db)
            .await
            .unwrap();
    }

    let capped = sign_up(&base, "late@example.com", READER_PASSWORD, &ticket).await;
    assert_eq!(capped.status(), StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(capped.text().await.unwrap(), r#"{"error":"too-many"}"#);

    // Accounts made more than an hour ago don't count.
    sqlx::query("UPDATE people SET created_at = unixepoch() - 3601 WHERE owner = 0")
        .execute(&state.db)
        .await
        .unwrap();
    assert_eq!(
        sign_up(&base, "late@example.com", READER_PASSWORD, &ticket)
            .await
            .status(),
        StatusCode::NO_CONTENT
    );
}

#[tokio::test]
async fn tries_with_a_taken_email_count_towards_the_hours_twenty() {
    let (base, state) = common::start_with_state(common::config()).await;
    let owner = common::signed_in(&base).await;
    let ticket = invite(&base, &owner).await;
    assert_eq!(
        sign_up(&base, "mira@example.com", READER_PASSWORD, &ticket)
            .await
            .status(),
        StatusCode::NO_CONTENT
    );
    // Eighteen more tries this hour (one account is made already).
    {
        let mut tries = state.sign_ups.lock().await;
        for _ in 0..nine_turtles::people::SIGN_UPS_PER_HOUR - 2 {
            assert!(tries.try_one(std::time::Instant::now()));
        }
    }

    // The twentieth: a taken email, with the same answer as always.
    let taken = sign_up(&base, "Mira@example.com", READER_PASSWORD, &ticket).await;
    assert_eq!(taken.status(), StatusCode::CONFLICT);
    assert_eq!(taken.text().await.unwrap(), r#"{"error":"already"}"#);

    // It counted, so the hour is used up, for taken and new emails alike.
    for email in ["mira@example.com", "new@example.com"] {
        let capped = sign_up(&base, email, READER_PASSWORD, &ticket).await;
        assert_eq!(capped.status(), StatusCode::TOO_MANY_REQUESTS, "{email}");
        assert_eq!(capped.text().await.unwrap(), r#"{"error":"too-many"}"#);
    }
}

#[tokio::test]
async fn sign_ups_sent_together_go_one_at_a_time_and_stop_at_twenty() {
    let (base, state) = common::start_with_state(common::config()).await;
    let owner = common::signed_in(&base).await;
    let ticket = invite(&base, &owner).await;
    {
        let mut tries = state.sign_ups.lock().await;
        for _ in 0..nine_turtles::people::SIGN_UPS_PER_HOUR - 2 {
            assert!(tries.try_one(std::time::Instant::now()));
        }
    }

    let mut together = tokio::task::JoinSet::new();
    for number in 0..5 {
        let (base, ticket) = (base.clone(), ticket.clone());
        together.spawn(async move {
            sign_up(
                &base,
                &format!("{number}@example.com"),
                READER_PASSWORD,
                &ticket,
            )
            .await
            .status()
        });
    }
    let answers = together.join_all().await;
    let made = answers
        .iter()
        .filter(|status| **status == StatusCode::NO_CONTENT)
        .count();
    assert_eq!(made, 2, "{answers:?}");
    assert!(
        answers
            .iter()
            .all(|status| [StatusCode::NO_CONTENT, StatusCode::TOO_MANY_REQUESTS].contains(status))
    );
}

#[tokio::test]
async fn the_owners_email_cant_be_told_apart_while_the_password_alone_waits() {
    let base = common::start(common::config()).await;
    let owner = common::signed_in(&base).await;
    post(
        &base,
        "/api/people/me/email",
        Some(&owner),
        json!({ "email": "rohit@example.com", "password": common::PASSWORD }),
    )
    .await;
    let ticket = invite(&base, &owner).await;
    assert_eq!(
        sign_up(&base, "mira@example.com", READER_PASSWORD, &ticket)
            .await
            .status(),
        StatusCode::NO_CONTENT
    );

    // A stranger uses up the password-only sign-in's five free tries...
    for _ in 0..4 {
        assert_eq!(
            sign_in(&base, "", "guess").await.status(),
            StatusCode::UNAUTHORIZED
        );
    }
    assert_eq!(
        sign_in(&base, "", "guess").await.status(),
        StatusCode::TOO_MANY_REQUESTS
    );

    // ...then tries emails: the owner's answers just as the others do.
    let mut answers = Vec::new();
    for email in [
        "Rohit@example.com",
        "mira@example.com",
        "nobody@example.com",
    ] {
        let answer = sign_in(&base, email, "guess").await;
        answers.push((answer.status(), answer.text().await.unwrap()));
    }
    assert_eq!(answers[0].0, StatusCode::UNAUTHORIZED, "{answers:?}");
    assert!(
        answers.iter().all(|answer| *answer == answers[0]),
        "{answers:?}"
    );

    // The owner's email has a count of its own, so it still signs in.
    assert_eq!(
        sign_in(&base, "rohit@example.com", PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );
}

#[tokio::test]
async fn a_password_too_long_to_be_right_is_refused_at_once() {
    let (base, state) = common::start_with_state(common::config()).await;
    let long = "x".repeat(nine_turtles::password::MAXIMUM_LENGTH + 1);
    let wrong = sign_in(&base, "", "guess").await;
    let wrong = (wrong.status(), wrong.text().await.unwrap());
    let checked_before = state
        .wrong_passwords
        .load(std::sync::atomic::Ordering::Relaxed);
    for email in ["", "nobody@example.com"] {
        for _ in 0..10 {
            let answer = sign_in(&base, email, &long).await;
            assert_eq!((answer.status(), answer.text().await.unwrap()), wrong);
        }
    }
    // Never checked or counted: the password alone still has its tries.
    let checked = state
        .wrong_passwords
        .load(std::sync::atomic::Ordering::Relaxed);
    assert_eq!(checked, checked_before);
    assert_eq!(
        sign_in(&base, "", PASSWORD).await.status(),
        StatusCode::NO_CONTENT
    );
}

#[tokio::test]
async fn guesses_sent_together_cant_race_past_the_five_free_tries() {
    let (base, state) = common::start_with_state(common::config()).await;
    let mut together = tokio::task::JoinSet::new();
    for _ in 0..10 {
        let base = base.clone();
        together.spawn(async move { sign_in(&base, "nobody@example.com", "guess").await.status() });
    }
    let answers = together.join_all().await;
    assert!(
        answers.iter().all(
            |status| [StatusCode::UNAUTHORIZED, StatusCode::TOO_MANY_REQUESTS].contains(status)
        ),
        "{answers:?}"
    );
    assert!(answers.contains(&StatusCode::TOO_MANY_REQUESTS));
    // Only the five free tries were checked; the rest were refused at once.
    let checked = state
        .wrong_passwords
        .load(std::sync::atomic::Ordering::Relaxed);
    assert_eq!(checked, 5, "{answers:?}");
}

#[tokio::test]
async fn guesses_at_other_emails_never_hold_up_the_owners_sign_in() {
    let (base, state) = common::start_with_state(common::config()).await;
    let owner = common::signed_in(&base).await;
    post(
        &base,
        "/api/people/me/email",
        Some(&owner),
        json!({ "email": "rohit@example.com", "password": common::PASSWORD }),
    )
    .await;

    // Every place for other emails' checks is taken, as in a flood of guesses.
    let flood = state
        .password_checks
        .others
        .acquire_many(nine_turtles::auth::OTHERS_CHECKS_AT_ONCE as u32)
        .await
        .unwrap();
    let guess = tokio::spawn({
        let base = base.clone();
        async move { sign_in(&base, "nobody@example.com", "guess").await.status() }
    });

    // A guess is waiting its turn, yet the password alone signs in at once.
    let quickly = std::time::Duration::from_secs(30);
    let signed_in = tokio::time::timeout(quickly, sign_in(&base, "", PASSWORD))
        .await
        .expect("the owner's sign-in waited behind the guesses");
    assert_eq!(signed_in.status(), StatusCode::NO_CONTENT);
    assert!(!guess.is_finished());

    // The owner's email waits in the same line as every other email, so its
    // timing can't give it away.
    let by_email = tokio::spawn({
        let base = base.clone();
        async move { sign_in(&base, "Rohit@Example.com", PASSWORD).await.status() }
    });
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    assert!(!by_email.is_finished());

    drop(flood);
    assert_eq!(guess.await.unwrap(), StatusCode::UNAUTHORIZED);
    assert_eq!(by_email.await.unwrap(), StatusCode::NO_CONTENT);
}

async fn json_of(response: Response) -> Value {
    response.text().await.unwrap().parse().unwrap()
}
