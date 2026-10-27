//! Starting a real nine turtles for a test, with its own empty data folder.

#![allow(dead_code)] // Each test file uses a different part of this.

use std::{
    path::PathBuf,
    sync::atomic::{AtomicU32, Ordering},
};

use nine_turtles::config::{Config, PasswordSetting};

pub const PASSWORD: &str = "a quiet place to read";
/// The owner's email: their first sign-in saves it (decision 0116).
pub const OWNER_EMAIL: &str = "owner@example.com";
pub const DIAGNOSTICS_KEY: &str = "test-diagnostics-key";

/// Settings like the live app's: a password and a diagnostics key are set.
pub fn config() -> Config {
    Config {
        listen: "127.0.0.1:0".parse().unwrap(),
        data_dir: fresh_data_dir(),
        password: PasswordSetting::Set(nine_turtles::password::hash(PASSWORD).unwrap()),
        diagnostics_key: Some(DIAGNOSTICS_KEY.to_owned()),
        local_feeds_allowed: true,
        test_check_seconds: None,
        public_url: None,
        backup: None,
        restore_from: None,
        smtp: None,
        newsletter_secret: None,
        newsletter_domain: None,
        payments: None,
    }
}

/// Starts nine turtles on a free port on this computer and returns its address.
pub async fn start(config: Config) -> String {
    start_with_state(config).await.0
}

/// Like `start`, and also hands back nine turtles' insides, so a test can run
/// background checking itself, at a time of its choosing.
pub async fn start_with_state(config: Config) -> (String, nine_turtles::AppState) {
    let state = nine_turtles::state(config).await.unwrap();
    let app = nine_turtles::router(state.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (format!("http://{address}"), state)
}

fn fresh_data_dir() -> PathBuf {
    static NEXT: AtomicU32 = AtomicU32::new(0);
    let dir = std::env::temp_dir().join(format!(
        "nine-turtles-test-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

/// Signs the owner in with their email and password (on a new nine turtles,
/// this first sign-in saves the email) and returns the cookie a browser
/// would send back.
pub async fn signed_in(base: &str) -> String {
    let response = reqwest::Client::new()
        .post(format!("{base}/api/sign-in"))
        .header("content-type", "application/json")
        .header("sec-fetch-site", "same-origin")
        .body(format!(
            r#"{{"email":"{OWNER_EMAIL}","password":"{PASSWORD}"}}"#
        ))
        .send()
        .await
        .unwrap();
    let set_cookie = response.headers()["set-cookie"].to_str().unwrap();
    set_cookie.split(';').next().unwrap().to_owned()
}

/// Makes another reader (number 2 onward), as signing up will, and signs a
/// device in for them. Answers their number and the cookie their browser
/// would send back.
pub async fn another_reader(state: &nine_turtles::AppState) -> (i64, String) {
    let person: i64 =
        sqlx::query_scalar("INSERT INTO people (created_at) VALUES (unixepoch()) RETURNING id")
            .fetch_one(&state.db)
            .await
            .unwrap();
    let token = nine_turtles::auth::remember_device(&state.db, person)
        .await
        .unwrap()
        .unwrap();
    (person, format!("nine_turtles_session={token}"))
}

/// Like `start_with_state`, with email switched on: each email is kept in
/// the returned outbox instead of sent (`email::Mailer::outbox`), and its
/// links start with this nine turtles' own address.
pub async fn start_with_mail(
    config: Config,
) -> (String, nine_turtles::AppState, nine_turtles::email::Outbox) {
    let mut state = nine_turtles::state(config).await.unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let (mailer, outbox) = nine_turtles::email::Mailer::outbox(reqwest::Url::parse(&base).unwrap());
    state.mailer = Some(mailer);
    let app = nine_turtles::router(state.clone());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (base, state, outbox)
}

/// The emails sent to `to` so far, oldest first.
pub fn emails_to(outbox: &nine_turtles::email::Outbox, to: &str) -> Vec<nine_turtles::email::Sent> {
    outbox
        .lock()
        .unwrap()
        .iter()
        .filter(|sent| sent.to.eq_ignore_ascii_case(to))
        .cloned()
        .collect()
}

/// The page and the ticket of the link in the newest email sent to `to`.
pub fn newest_link(outbox: &nine_turtles::email::Outbox, to: &str) -> (String, String) {
    let sent = emails_to(outbox, to);
    let body = &sent.last().expect("an email was sent").body;
    let start = body.find("http").expect("a link in the email");
    let link = body[start..].split_whitespace().next().unwrap();
    let url = reqwest::Url::parse(link).unwrap();
    // The ticket comes after the #, never in the query the server would log.
    assert_eq!(url.query(), None, "no query in {link}");
    let ticket = url
        .fragment()
        .and_then(|fragment| fragment.strip_prefix("ticket="))
        .expect("the ticket after the #")
        .to_owned();
    (url.path().to_owned(), ticket)
}
