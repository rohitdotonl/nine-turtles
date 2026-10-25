//! Backups (SPEC section 23): a nightly copy goes to S3-compatible storage,
//! old copies are deleted by the keeping rules, a copy is stored before every
//! structure change, and a stored copy brings everything back on a fresh disk.
//! The storage here is a small stand-in for S3 running inside the test; that
//! the signatures are exactly what real services expect is tested in
//! `storage.rs` against Amazon's documented example.

mod common;

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

use axum::{
    Router,
    body::Bytes,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
};
use nine_turtles::{backup, storage::Settings};
use sha2::{Digest, Sha256};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

type Objects = Arc<Mutex<BTreeMap<String, Vec<u8>>>>;

/// 25 October 2026, 04:00 UTC.
const NIGHT: i64 = 1_792_900_800;
const DAY: i64 = 86_400;

/// Starts a stand-in S3 service holding one bucket, `backups`. It refuses
/// unsigned requests and uploads whose content doesn't match the hash they
/// were signed with.
async fn fake_storage() -> (Settings, Objects) {
    let objects = Objects::default();
    let app = Router::new()
        .route("/backups", get(list))
        .route("/backups/{*name}", get(fetch).put(store).delete(remove))
        .with_state(objects.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    let settings = Settings {
        endpoint: format!("http://{address}").parse().unwrap(),
        bucket: "backups".into(),
        region: "auto".into(),
        key_id: "test-key-id".into(),
        secret: "test-secret".into(),
    };
    (settings, objects)
}

fn signed(headers: &HeaderMap) -> bool {
    headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| {
            value.starts_with("AWS4-HMAC-SHA256 Credential=test-key-id/")
                && value.contains("/auto/s3/aws4_request")
        })
}

async fn list(
    State(objects): State<Objects>,
    headers: HeaderMap,
    Query(query): Query<BTreeMap<String, String>>,
) -> impl IntoResponse {
    if !signed(&headers) || query.get("list-type").map(String::as_str) != Some("2") {
        return (StatusCode::FORBIDDEN, String::new());
    }
    let prefix = query.get("prefix").cloned().unwrap_or_default();
    let contents: String = objects
        .lock()
        .unwrap()
        .iter()
        .filter(|(name, _)| name.starts_with(&prefix))
        .map(|(name, body)| {
            format!(
                "<Contents><Key>{name}</Key><Size>{}</Size></Contents>",
                body.len()
            )
        })
        .collect();
    (
        StatusCode::OK,
        format!(
            "<?xml version=\"1.0\"?><ListBucketResult><IsTruncated>false</IsTruncated>{contents}</ListBucketResult>"
        ),
    )
}

async fn fetch(
    State(objects): State<Objects>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> impl IntoResponse {
    if !signed(&headers) {
        return Err(StatusCode::FORBIDDEN);
    }
    objects
        .lock()
        .unwrap()
        .get(&name)
        .cloned()
        .ok_or(StatusCode::NOT_FOUND)
}

async fn store(
    State(objects): State<Objects>,
    headers: HeaderMap,
    Path(name): Path<String>,
    body: Bytes,
) -> StatusCode {
    let hash: String = Sha256::digest(&body)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    if !signed(&headers) || headers["x-amz-content-sha256"] != hash.as_str() {
        return StatusCode::FORBIDDEN;
    }
    objects.lock().unwrap().insert(name, body.to_vec());
    StatusCode::OK
}

async fn remove(
    State(objects): State<Objects>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> StatusCode {
    if !signed(&headers) {
        return StatusCode::FORBIDDEN;
    }
    objects.lock().unwrap().remove(&name);
    StatusCode::NO_CONTENT
}

fn names(objects: &Objects, prefix: &str) -> Vec<String> {
    objects
        .lock()
        .unwrap()
        .keys()
        .filter(|name| name.starts_with(prefix))
        .cloned()
        .collect()
}

#[tokio::test]
async fn a_nightly_copy_brings_everything_back_on_a_fresh_disk() {
    let (settings, objects) = fake_storage().await;
    let mut config = common::config();
    config.backup = Some(settings.clone());
    let state = nine_turtles::state(config).await.unwrap();
    for feed in 1..=3 {
        sqlx::query("INSERT INTO feeds (url, url_key, title, added_at) VALUES (?, ?, ?, 1)")
            .bind(format!("https://blog-{feed}.example/feed"))
            .bind(format!("blog-{feed}.example/feed"))
            .bind(format!("Blog {feed}"))
            .execute(&state.db)
            .await
            .unwrap();
    }
    let storage = state.storage.clone().unwrap();

    let name = backup::nightly(&state.db, &storage, NIGHT).await.unwrap();
    assert_eq!(name, "nightly/2026-10-25.sqlite");
    assert_eq!(
        names(&objects, ""),
        ["monthly/2026-10.sqlite", "nightly/2026-10-25.sqlite"]
    );
    // A new host: an empty disk, the same storage, and the copy to restore.
    let mut fresh = common::config();
    fresh.backup = Some(settings);
    fresh.restore_from = Some(name);
    let restored = nine_turtles::state(fresh).await.unwrap();
    let titles: Vec<String> = sqlx::query_scalar("SELECT title FROM feeds ORDER BY title")
        .fetch_all(&restored.db)
        .await
        .unwrap();
    assert_eq!(titles, ["Blog 1", "Blog 2", "Blog 3"]);
}

#[tokio::test]
async fn restoring_never_replaces_a_database_that_is_there() {
    let (settings, _objects) = fake_storage().await;
    let mut config = common::config();
    config.backup = Some(settings.clone());
    let state = nine_turtles::state(config.clone()).await.unwrap();
    let storage = state.storage.clone().unwrap();
    let name = backup::nightly(&state.db, &storage, NIGHT).await.unwrap();
    sqlx::query("INSERT INTO feeds (url, url_key, title, added_at) VALUES ('https://a.example/feed', 'a.example/feed', 'Newer', 1)")
        .execute(&state.db)
        .await
        .unwrap();
    state.db.close().await;

    config.restore_from = Some(name);
    let again = nine_turtles::state(config).await.unwrap();
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM feeds")
        .fetch_one(&again.db)
        .await
        .unwrap();
    assert_eq!(count, 1, "the newer database was kept");
}

#[tokio::test]
async fn keeps_thirty_nights_and_twelve_months() {
    let (settings, objects) = fake_storage().await;
    let mut config = common::config();
    config.backup = Some(settings);
    let state = nine_turtles::state(config).await.unwrap();
    let storage = state.storage.clone().unwrap();

    // Fourteen months of first-of-the-month copies…
    for month in 0..14 {
        let at = NIGHT - (14 - month) * 31 * DAY;
        backup::nightly(&state.db, &storage, at).await.unwrap();
    }
    // …then forty nights in a row.
    for night in 0..40 {
        backup::nightly(&state.db, &storage, NIGHT + night * DAY)
            .await
            .unwrap();
    }
    let nightly = names(&objects, "nightly/");
    assert_eq!(nightly.len(), backup::NIGHTLY_KEPT);
    assert_eq!(nightly.last().unwrap(), "nightly/2026-12-03.sqlite");
    assert_eq!(nightly.first().unwrap(), "nightly/2026-11-04.sqlite");
    let monthly = names(&objects, "monthly/");
    assert_eq!(monthly.len(), backup::MONTHLY_KEPT);
    assert_eq!(monthly.last().unwrap(), "monthly/2026-12.sqlite");
}

/// A database as an earlier nine turtles left it, before structure change 7.
async fn database_before_the_last_change(data_dir: &std::path::Path) {
    std::fs::create_dir_all(data_dir).unwrap();
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(data_dir))
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(6, &old)
        .await
        .unwrap();
    sqlx::query("INSERT INTO feeds (url, url_key, title, added_at) VALUES ('https://a.example/feed', 'a.example/feed', 'Kept', 1)")
        .execute(&old)
        .await
        .unwrap();
    old.close().await;
}

#[tokio::test]
async fn a_copy_is_stored_before_the_structure_changes() {
    let (settings, objects) = fake_storage().await;
    let mut config = common::config();
    config.backup = Some(settings.clone());
    database_before_the_last_change(&config.data_dir).await;

    nine_turtles::state(config).await.unwrap();
    let stored = names(&objects, "before-change/");
    assert_eq!(stored.len(), 1);
    assert!(stored[0].ends_with("-before-change-7.sqlite"), "{stored:?}");

    // That copy is the database as it was, before change 7.
    let mut fresh = common::config();
    fresh.backup = Some(settings);
    nine_turtles::backup::restore_if_empty(
        &fresh.data_dir,
        Some(&nine_turtles::storage::Storage::new(fresh.backup.clone().unwrap()).unwrap()),
        &stored[0],
    )
    .await
    .unwrap();
    let copy = SqlitePoolOptions::new()
        .connect_with(SqliteConnectOptions::new().filename(nine_turtles::db::path(&fresh.data_dir)))
        .await
        .unwrap();
    let changes: i64 = sqlx::query_scalar("SELECT MAX(version) FROM _sqlx_migrations")
        .fetch_one(&copy)
        .await
        .unwrap();
    assert_eq!(changes, 6);
    let title: String = sqlx::query_scalar("SELECT title FROM feeds")
        .fetch_one(&copy)
        .await
        .unwrap();
    assert_eq!(title, "Kept");
}

#[tokio::test]
async fn without_a_backup_the_structure_is_not_changed() {
    // Storage that can't be reached: nothing listens on this port.
    let unreachable = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = unreachable.local_addr().unwrap();
    drop(unreachable);
    let mut config = common::config();
    config.backup = Some(Settings {
        endpoint: format!("http://{address}").parse().unwrap(),
        bucket: "backups".into(),
        region: "auto".into(),
        key_id: "id".into(),
        secret: "secret".into(),
    });
    database_before_the_last_change(&config.data_dir).await;

    let Err(error) = nine_turtles::state(config.clone()).await else {
        panic!("nine turtles started without its backup");
    };
    assert!(error.contains("nothing was changed"), "{error}");
    let db = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new().filename(nine_turtles::db::path(&config.data_dir)),
        )
        .await
        .unwrap();
    let changes: i64 = sqlx::query_scalar("SELECT MAX(version) FROM _sqlx_migrations")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(changes, 6);
}

#[tokio::test]
async fn an_up_to_date_database_is_opened_without_a_copy() {
    let (settings, objects) = fake_storage().await;
    let mut config = common::config();
    config.backup = Some(settings);
    let state = nine_turtles::state(config.clone()).await.unwrap();
    state.db.close().await;
    nine_turtles::state(config).await.unwrap();
    assert!(names(&objects, "").is_empty());
}
