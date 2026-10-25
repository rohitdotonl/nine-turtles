//! Every change to the database's structure is tried on a copy of
//! real-shaped data first (ENGINEERING.md → "The floor"). Each test here
//! builds a database as an earlier version of nine turtles left it, fills it,
//! then lets today's nine turtles open it, and checks nothing was lost.

mod common;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

#[tokio::test]
async fn adding_read_state_and_stars_keeps_every_feed_article_and_sign_in() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database as Milestone 6 left it (structure changes 1 and 2).
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(2, &old)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO sessions (token_hash, created_at, last_used_at, expires_at)
         VALUES (x'00112233', 1, 1, 9999999999)",
    )
    .execute(&old)
    .await
    .unwrap();
    for feed in 1..=20 {
        sqlx::query("INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (?, ?, ?, ?, 1)")
            .bind(feed)
            .bind(format!("https://blog-{feed}.example/feed"))
            .bind(format!("blog-{feed}.example/feed"))
            .bind(format!("Blog {feed}"))
            .execute(&old)
            .await
            .unwrap();
        for number in 0..50 {
            sqlx::query(
                "INSERT INTO articles (feed_id, fingerprint, title, content, received_at, sort_at)
                 VALUES (?, ?, ?, '<p>Words.</p>', 2, ?)",
            )
            .bind(feed)
            .bind(format!("id:{number}"))
            .bind(format!("Article {number}"))
            .bind(number)
            .execute(&old)
            .await
            .unwrap();
        }
    }
    old.close().await;

    // Today's nine turtles opens it and brings its structure up to date.
    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let count = |sql: &'static str| sqlx::query_scalar::<_, i64>(sql).fetch_one(&db);
    assert_eq!(count("SELECT COUNT(*) FROM sessions").await.unwrap(), 1);
    assert_eq!(count("SELECT COUNT(*) FROM feeds").await.unwrap(), 20);
    assert_eq!(count("SELECT COUNT(*) FROM articles").await.unwrap(), 1000);
    assert_eq!(
        count("SELECT COUNT(*) FROM articles WHERE content = '<p>Words.</p>'")
            .await
            .unwrap(),
        1000
    );
    // Every article stored before starts unread and not starred.
    assert_eq!(
        count("SELECT COUNT(*) FROM articles WHERE read = 0 AND starred = 0")
            .await
            .unwrap(),
        1000
    );
    // Only the two values a mark can have are accepted.
    assert!(
        sqlx::query("UPDATE articles SET read = 2 WHERE id = 1")
            .execute(&db)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn adding_background_checks_keeps_every_feed_article_mark_and_star() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database as Milestone 7 left it (structure changes 1 to 3).
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(3, &old)
        .await
        .unwrap();
    for feed in 1..=20 {
        sqlx::query(
            "INSERT INTO feeds (id, url, url_key, title, etag, last_modified, added_at, fetched_at)
             VALUES (?, ?, ?, ?, '\"abc\"', 'Wed, 21 Oct 2026 07:28:00 GMT', 1, 2)",
        )
        .bind(feed)
        .bind(format!("https://blog-{feed}.example/feed"))
        .bind(format!("blog-{feed}.example/feed"))
        .bind(format!("Blog {feed}"))
        .execute(&old)
        .await
        .unwrap();
        for number in 0..50 {
            sqlx::query(
                "INSERT INTO articles (feed_id, fingerprint, title, content, received_at, sort_at,
                     read, starred)
                 VALUES (?, ?, ?, '<p>Words.</p>', 2, ?, ?, ?)",
            )
            .bind(feed)
            .bind(format!("id:{number}"))
            .bind(format!("Article {number}"))
            .bind(number)
            .bind(number % 2)
            .bind(i64::from(number % 10 == 0))
            .execute(&old)
            .await
            .unwrap();
        }
    }
    sqlx::query("INSERT INTO settings (name, value) VALUES ('sort', 'oldest')")
        .execute(&old)
        .await
        .unwrap();
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let count = |sql: &'static str| sqlx::query_scalar::<_, i64>(sql).fetch_one(&db);
    assert_eq!(count("SELECT COUNT(*) FROM feeds").await.unwrap(), 20);
    assert_eq!(count("SELECT COUNT(*) FROM articles").await.unwrap(), 1000);
    assert_eq!(
        count("SELECT COUNT(*) FROM articles WHERE read = 1")
            .await
            .unwrap(),
        500
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM articles WHERE starred = 1")
            .await
            .unwrap(),
        100
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM settings WHERE value = 'oldest'")
            .await
            .unwrap(),
        1
    );
    // What the publishers said last time is kept, so the first background
    // check can already ask "anything new?".
    assert_eq!(
        count("SELECT COUNT(*) FROM feeds WHERE etag = '\"abc\"' AND last_modified IS NOT NULL")
            .await
            .unwrap(),
        20
    );
    // Every feed is due for its first check, and none counts as failing.
    assert_eq!(
        count("SELECT COUNT(*) FROM feeds WHERE next_check_at = 0 AND failures = 0 AND failing_since IS NULL")
            .await
            .unwrap(),
        20
    );
}

#[tokio::test]
async fn adding_folders_keeps_every_feed_followed_with_its_articles_marks_and_schedule() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database as Milestone 8 left it (structure changes 1 to 4).
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(4, &old)
        .await
        .unwrap();
    for feed in 1..=20 {
        sqlx::query(
            "INSERT INTO feeds (id, url, url_key, title, added_at, next_check_at, check_every,
                 failures, failing_since, problem)
             VALUES (?, ?, ?, ?, 1, 5000, 1800, ?, ?, ?)",
        )
        .bind(feed)
        .bind(format!("https://blog-{feed}.example/feed"))
        .bind(format!("blog-{feed}.example/feed"))
        .bind(format!("Blog {feed}"))
        .bind(feed % 2)
        .bind((feed % 2 == 1).then_some(4000))
        .bind((feed % 2 == 1).then_some("unreachable"))
        .execute(&old)
        .await
        .unwrap();
        for number in 0..50 {
            sqlx::query(
                "INSERT INTO articles (feed_id, fingerprint, title, received_at, sort_at, read,
                     starred)
                 VALUES (?, ?, ?, 2, ?, ?, ?)",
            )
            .bind(feed)
            .bind(format!("id:{number}"))
            .bind(format!("Article {number}"))
            .bind(number)
            .bind(number % 2)
            .bind(i64::from(number % 10 == 0))
            .execute(&old)
            .await
            .unwrap();
        }
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let count = |sql: &'static str| sqlx::query_scalar::<_, i64>(sql).fetch_one(&db);
    // Every feed is still followed, cleared of nothing, in no folder.
    assert_eq!(
        count("SELECT COUNT(*) FROM feeds WHERE unsubscribed_at IS NULL AND cleared = 0")
            .await
            .unwrap(),
        20
    );
    assert_eq!(count("SELECT COUNT(*) FROM folders").await.unwrap(), 0);
    assert_eq!(count("SELECT COUNT(*) FROM feed_folders").await.unwrap(), 0);
    assert_eq!(count("SELECT COUNT(*) FROM articles").await.unwrap(), 1000);
    assert_eq!(
        count("SELECT COUNT(*) FROM articles WHERE read = 1")
            .await
            .unwrap(),
        500
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM articles WHERE starred = 1")
            .await
            .unwrap(),
        100
    );
    // Schedules and failure histories are kept as they were.
    assert_eq!(
        count("SELECT COUNT(*) FROM feeds WHERE next_check_at = 5000 AND check_every = 1800")
            .await
            .unwrap(),
        20
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM feeds WHERE failures = 1 AND failing_since = 4000")
            .await
            .unwrap(),
        10
    );
}

#[tokio::test]
async fn adding_search_keeps_everything_and_indexes_every_earlier_article() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database as Milestone 9 left it (structure changes 1 to 5).
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(5, &old)
        .await
        .unwrap();
    sqlx::query("INSERT INTO folders (id, name) VALUES (1, 'Gardens')")
        .execute(&old)
        .await
        .unwrap();
    for feed in 1..=20 {
        sqlx::query("INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (?, ?, ?, ?, 1)")
            .bind(feed)
            .bind(format!("https://blog-{feed}.example/feed"))
            .bind(format!("blog-{feed}.example/feed"))
            .bind(format!("Blog {feed}"))
            .execute(&old)
            .await
            .unwrap();
        sqlx::query("INSERT INTO feed_folders (folder_id, feed_id) VALUES (1, ?)")
            .bind(feed)
            .execute(&old)
            .await
            .unwrap();
        for number in 0..50 {
            sqlx::query(
                "INSERT INTO articles (feed_id, fingerprint, title, content, received_at, sort_at,
                     read, starred)
                 VALUES (?, ?, ?, '<p>Words about <em>compost</em>.</p>', 2, ?, ?, ?)",
            )
            .bind(feed)
            .bind(format!("id:{number}"))
            .bind(format!("Article {number}"))
            .bind(number)
            .bind(number % 2)
            .bind(i64::from(number % 10 == 0))
            .execute(&old)
            .await
            .unwrap();
        }
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let count = |sql: &'static str| sqlx::query_scalar::<_, i64>(sql).fetch_one(&db);
    assert_eq!(count("SELECT COUNT(*) FROM feeds").await.unwrap(), 20);
    assert_eq!(
        count("SELECT COUNT(*) FROM feed_folders").await.unwrap(),
        20
    );
    assert_eq!(count("SELECT COUNT(*) FROM articles").await.unwrap(), 1000);
    assert_eq!(
        count("SELECT COUNT(*) FROM articles WHERE read = 1")
            .await
            .unwrap(),
        500
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM articles WHERE starred = 1")
            .await
            .unwrap(),
        100
    );
    // Starting up adds every earlier article to the search index, once.
    assert_eq!(
        nine_turtles::search::index_missing(&db).await.unwrap(),
        1000
    );
    assert_eq!(nine_turtles::search::index_missing(&db).await.unwrap(), 0);
    assert_eq!(
        count("SELECT COUNT(*) FROM articles_search WHERE articles_search MATCH 'compost'")
            .await
            .unwrap(),
        1000
    );
}

#[tokio::test]
async fn adding_websub_keeps_every_feed_article_and_schedule() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database as V1 left it (structure changes 1 to 6).
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(6, &old)
        .await
        .unwrap();
    for feed in 1..=10 {
        sqlx::query(
            "INSERT INTO feeds (id, url, url_key, title, added_at, next_check_at, check_every)
             VALUES (?, ?, ?, ?, 1, ?, 3600)",
        )
        .bind(feed)
        .bind(format!("https://blog-{feed}.example/feed"))
        .bind(format!("blog-{feed}.example/feed"))
        .bind(format!("Blog {feed}"))
        .bind(1000 + feed)
        .execute(&old)
        .await
        .unwrap();
        for number in 0..20 {
            sqlx::query(
                "INSERT INTO articles (feed_id, fingerprint, title, received_at, sort_at, read,
                     starred)
                 VALUES (?, ?, ?, 2, ?, ?, ?)",
            )
            .bind(feed)
            .bind(format!("id:{number}"))
            .bind(format!("Article {number}"))
            .bind(number)
            .bind(number % 2)
            .bind(i64::from(number % 5 == 0))
            .execute(&old)
            .await
            .unwrap();
        }
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let count = |sql: &'static str| sqlx::query_scalar::<_, i64>(sql).fetch_one(&db);
    assert_eq!(count("SELECT COUNT(*) FROM feeds").await.unwrap(), 10);
    assert_eq!(count("SELECT COUNT(*) FROM articles").await.unwrap(), 200);
    assert_eq!(
        count("SELECT COUNT(*) FROM articles WHERE read = 1")
            .await
            .unwrap(),
        100
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM articles WHERE starred = 1")
            .await
            .unwrap(),
        40
    );
    assert_eq!(
        count("SELECT SUM(next_check_at) FROM feeds").await.unwrap(),
        10 * 1000 + 55
    );
    // Nothing is subscribed to a hub until a check finds one.
    assert_eq!(count("SELECT COUNT(*) FROM websub").await.unwrap(), 0);
}
