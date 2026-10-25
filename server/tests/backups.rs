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

/// The name a stand-in storage refuses to delete anything under, for the
/// test of a failed clean-up.
const UNDELETABLE: &str = "monthly/";

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
    if !signed(&headers)
        || (name.starts_with(UNDELETABLE) && objects.lock().unwrap().contains_key("refuse-deletes"))
    {
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

#[tokio::test]
async fn old_copies_that_cannot_be_deleted_never_fail_the_backup() {
    let (settings, objects) = fake_storage().await;
    let mut config = common::config();
    config.backup = Some(settings);
    let state = nine_turtles::state(config).await.unwrap();
    let storage = state.storage.clone().unwrap();
    for month in 0..13 {
        backup::nightly(&state.db, &storage, NIGHT - (13 - month) * 31 * DAY)
            .await
            .unwrap();
    }
    objects
        .lock()
        .unwrap()
        .insert("refuse-deletes".into(), Vec::new());
    // A fourteenth month: the copy is stored, the oldest month can't go.
    let name = backup::nightly(&state.db, &storage, NIGHT).await.unwrap();
    assert!(names(&objects, "").contains(&name));
    assert_eq!(names(&objects, "monthly/").len(), backup::MONTHLY_KEPT + 1);
}

#[tokio::test]
async fn an_empty_database_left_behind_is_replaced_by_the_restore() {
    let (settings, _objects) = fake_storage().await;
    let mut config = common::config();
    config.backup = Some(settings.clone());
    let state = nine_turtles::state(config).await.unwrap();
    sqlx::query("INSERT INTO feeds (url, url_key, title, added_at) VALUES ('https://a.example/feed', 'a.example/feed', 'Back again', 1)")
        .execute(&state.db)
        .await
        .unwrap();
    let storage = state.storage.clone().unwrap();
    let name = backup::nightly(&state.db, &storage, NIGHT).await.unwrap();

    // A running nine turtles reconnected after its database was moved aside,
    // leaving an empty file with nothing in it.
    let mut fresh = common::config();
    std::fs::create_dir_all(&fresh.data_dir).unwrap();
    let empty = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&fresh.data_dir))
                .create_if_missing(true),
        )
        .await
        .unwrap();
    empty.close().await;
    fresh.backup = Some(settings);
    fresh.restore_from = Some(name);
    let restored = nine_turtles::state(fresh).await.unwrap();
    let title: String = sqlx::query_scalar("SELECT title FROM feeds")
        .fetch_one(&restored.db)
        .await
        .unwrap();
    assert_eq!(title, "Back again");
}

#[tokio::test]
async fn a_restore_that_fails_leaves_no_database_behind() {
    let (settings, _objects) = fake_storage().await;
    let mut config = common::config();
    config.backup = Some(settings);
    config.restore_from = Some("nightly/1999-01-01.sqlite".into());
    let data_dir = config.data_dir.clone();
    let Err(error) = nine_turtles::state(config).await else {
        panic!("a missing copy was restored");
    };
    assert!(error.contains("nightly/1999-01-01.sqlite"), "{error}");
    assert!(!nine_turtles::db::exists(&data_dir));
    assert_eq!(std::fs::read_dir(&data_dir).unwrap().count(), 0);
}

/// The change that gave everything an owner (structure change 11) is backed
/// up first, and that copy restored on a fresh disk is changed again the
/// same way, with nothing lost: the rehearsal for the live app.
#[tokio::test]
async fn the_change_to_many_readers_is_backed_up_and_its_copy_restores_whole() {
    let (settings, objects) = fake_storage().await;
    let mut config = common::config();
    config.backup = Some(settings.clone());
    std::fs::create_dir_all(&config.data_dir).unwrap();
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&config.data_dir))
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(10, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at)
         VALUES (1, 'https://a.example/feed', 'a.example/feed', 'Kept', 1)",
        "INSERT INTO folders (id, name) VALUES (1, 'Gardens')",
        "INSERT INTO feed_folders (folder_id, feed_id) VALUES (1, 1)",
        "INSERT INTO settings (name, value) VALUES ('sort', 'oldest')",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let changed = nine_turtles::state(config).await.unwrap();
    let stored = names(&objects, "before-change/");
    assert_eq!(stored.len(), 1);
    assert!(
        stored[0].ends_with("-before-change-11.sqlite"),
        "{stored:?}"
    );
    let folder = "SELECT folders.person_id, folders.name FROM folders
                  JOIN feed_folders ON feed_folders.folder_id = folders.id";
    let live: (i64, String) = sqlx::query_as(folder).fetch_one(&changed.db).await.unwrap();

    // A new host restores that copy; nine turtles changes it as it starts.
    let mut fresh = common::config();
    fresh.backup = Some(settings);
    fresh.restore_from = Some(stored[0].clone());
    let restored = nine_turtles::state(fresh).await.unwrap();
    let again: (i64, String) = sqlx::query_as(folder)
        .fetch_one(&restored.db)
        .await
        .unwrap();
    assert_eq!(again, live);
    assert_eq!(again, (1, "Gardens".to_owned()));
    let sort: String = sqlx::query_scalar(
        "SELECT value FROM person_settings WHERE person_id = 1 AND name = 'sort'",
    )
    .fetch_one(&restored.db)
    .await
    .unwrap();
    assert_eq!(sort, "oldest");
}

/// Structure change 12 (each reader's own feeds and marks, decision 0086)
/// is backed up first, and that copy restored on a fresh disk is changed
/// again the same way, with every mark, name and setting kept: the
/// rehearsal for the live app.
#[tokio::test]
async fn the_change_to_each_readers_own_marks_is_backed_up_and_its_copy_restores_whole() {
    let (settings, objects) = fake_storage().await;
    let mut config = common::config();
    config.backup = Some(settings.clone());
    std::fs::create_dir_all(&config.data_dir).unwrap();
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&config.data_dir))
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(11, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at, river, open_on_site, check_at_most)
         VALUES (1, 'https://a.example/feed', 'a.example/feed', 'Renamed', 1, 1, 1, 3600),
                (2, 'https://b.example/feed', 'b.example/feed', 'Kept', 2, 0, 0, 0)",
        "UPDATE feeds SET unsubscribed_at = unixepoch() - 60 WHERE id = 2",
        "INSERT INTO articles (feed_id, fingerprint, title, received_at, sort_at, read, starred,
             muted)
         VALUES (1, 'a', 'Read', 1, 1, 1, 0, 0), (1, 'b', 'Starred', 1, 2, 0, 1, 0),
                (1, 'c', 'Muted', 1, 3, 1, 0, 1), (2, 'd', 'Waiting', 1, 4, 0, 1, 0)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let changed = nine_turtles::state(config).await.unwrap();
    let stored = names(&objects, "before-change/");
    assert_eq!(stored.len(), 1);
    assert!(
        stored[0].ends_with("-before-change-12.sqlite"),
        "{stored:?}"
    );
    let marks = "SELECT entries.person_id, articles.title, entries.read, entries.starred,
                     entries.muted, subscriptions.title, subscriptions.river,
                     subscriptions.open_on_site, subscriptions.check_at_most,
                     subscriptions.unsubscribed_at IS NOT NULL
                 FROM entries JOIN articles ON articles.id = entries.article_id
                 JOIN subscriptions ON subscriptions.person_id = entries.person_id
                     AND subscriptions.feed_id = entries.feed_id
                 ORDER BY articles.id";
    type Line = (i64, String, bool, bool, bool, String, bool, bool, i64, bool);
    let live: Vec<Line> = sqlx::query_as(marks).fetch_all(&changed.db).await.unwrap();

    // A new host restores that copy; nine turtles changes it as it starts.
    let mut fresh = common::config();
    fresh.backup = Some(settings);
    fresh.restore_from = Some(stored[0].clone());
    let restored = nine_turtles::state(fresh).await.unwrap();
    let again: Vec<Line> = sqlx::query_as(marks).fetch_all(&restored.db).await.unwrap();
    assert_eq!(again, live);
    let line = |title: &str, read, starred, muted, feed: &str, river, open, every, left| {
        (
            1,
            title.to_owned(),
            read,
            starred,
            muted,
            feed.to_owned(),
            river,
            open,
            every,
            left,
        )
    };
    assert_eq!(
        again,
        [
            line(
                "Read", true, false, false, "Renamed", true, true, 3600, false
            ),
            line(
                "Starred", false, true, false, "Renamed", true, true, 3600, false
            ),
            line(
                "Muted", true, false, true, "Renamed", true, true, 3600, false
            ),
            line("Waiting", false, true, false, "Kept", false, false, 0, true),
        ]
    );
}
