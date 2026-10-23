//! The program hands the browser the frontend that's packed inside it.

use reqwest::StatusCode;

/// Starts slowfeed on a free port on this computer and returns its address.
async fn start() -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, slowfeed::app()).await.unwrap() });
    format!("http://{address}")
}

#[tokio::test]
async fn home_page_is_the_app() {
    let base = start().await;
    let response = reqwest::get(format!("{base}/")).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["content-type"], "text/html");
    assert_eq!(response.headers()["cache-control"], "no-cache");
    let body = response.text().await.unwrap();
    assert!(body.contains("<title>slowfeed</title>"));
}

#[tokio::test]
async fn other_screens_also_get_the_app() {
    let base = start().await;
    let response = reqwest::get(format!("{base}/some/screen")).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert!(
        response
            .text()
            .await
            .unwrap()
            .contains("<title>slowfeed</title>")
    );
}

#[tokio::test]
async fn fonts_are_served_by_slowfeed_itself() {
    let base = start().await;
    let response = reqwest::get(format!("{base}/fonts/literata-400-latin.woff2"))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["content-type"], "font/woff2");
}

#[tokio::test]
async fn missing_files_are_not_found() {
    let base = start().await;
    let response = reqwest::get(format!("{base}/assets/missing.js"))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
