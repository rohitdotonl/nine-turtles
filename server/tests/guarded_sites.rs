//! A site's guard against bots, told apart from the site itself (decision
//! 0255), against a made-up publisher whose guard answers as real ones do.

use axum::{
    Router,
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
};
use nine_turtles::fetch::{self, FetchError};
use reqwest::Url;

async fn guarded_site() -> String {
    let app = Router::new().fallback(serve);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{address}")
}

async fn serve(uri: Uri) -> Response {
    let html = [(header::CONTENT_TYPE, "text/html")];
    match uri.path() {
        // Cloudflare's check: a 403 saying so in a header.
        "/check.xml" => (
            StatusCode::FORBIDDEN,
            [("cf-mitigated", "challenge")],
            "<html><head><title>Just a moment...</title></head></html>",
        )
            .into_response(),
        // Cloudflare's block page: only the page says so.
        "/block.xml" => (
            StatusCode::FORBIDDEN,
            html,
            "<html><head><title>Attention Required! | Cloudflare</title></head>\
             <body><h1>Sorry, you have been blocked</h1></body></html>",
        )
            .into_response(),
        // Vercel's check answers 429, which isn't a request to slow down.
        "/vercel.xml" => (
            StatusCode::TOO_MANY_REQUESTS,
            [("x-vercel-mitigated", "challenge")],
            "Vercel Security Checkpoint",
        )
            .into_response(),
        // The site itself refusing, and asking to slow down: not a guard.
        "/private.xml" => (StatusCode::FORBIDDEN, html, "<h1>Forbidden</h1>").into_response(),
        "/busy.xml" => {
            (StatusCode::TOO_MANY_REQUESTS, [(header::RETRY_AFTER, "60")]).into_response()
        }
        "/down.xml" => {
            (StatusCode::SERVICE_UNAVAILABLE, html, "<h1>Back soon</h1>").into_response()
        }
        _ => StatusCode::NOT_FOUND.into_response(),
    }
}

#[tokio::test]
async fn a_guard_is_told_apart_from_the_site_and_from_slow_down() {
    let site = guarded_site().await;
    let client = fetch::client(true).unwrap();
    let get = |path: &str| {
        let url = Url::parse(&format!("{site}{path}")).unwrap();
        let client = client.clone();
        async move { fetch::get(&client, &url, true).await.unwrap_err() }
    };
    assert_eq!(get("/check.xml").await, FetchError::Blocked);
    assert_eq!(get("/block.xml").await, FetchError::Blocked);
    assert_eq!(get("/vercel.xml").await, FetchError::Blocked);
    assert_eq!(get("/private.xml").await, FetchError::Status(403));
    assert_eq!(get("/busy.xml").await, FetchError::SlowDown(Some(60)));
    assert_eq!(get("/down.xml").await, FetchError::Status(503));
}
