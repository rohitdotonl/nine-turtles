//! Every change to the database's structure is tried on a copy of
//! real-shaped data first (ENGINEERING.md → "The floor"). Each test here
//! builds a database as an earlier version of nine turtles left it, fills it,
//! then lets today's nine turtles open it, and checks nothing was lost.

mod common;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

/// Opens the database and brings it up to structure change `version` only,
/// for a test whose tables a later change removed (structure change 40,
/// decision 0174, deleted collections, saved searches, Up Next and opening
/// times, and the rules step 8 switched off).
async fn upgraded_to(data_dir: &std::path::Path, version: i64) -> sqlx::SqlitePool {
    let db = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(data_dir))
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(version, &db)
        .await
        .unwrap();
    db
}

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
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND read = 0 AND starred = 0")
            .await
            .unwrap(),
        1000
    );
    // Only the two values a mark can have are accepted.
    assert!(
        sqlx::query("UPDATE entries SET read = 2 WHERE article_id = 1")
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
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND read = 1")
            .await
            .unwrap(),
        500
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND starred = 1")
            .await
            .unwrap(),
        100
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM person_settings WHERE person_id = 1 AND name = 'sort' AND value = 'oldest'")
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
        count("SELECT COUNT(*) FROM subscriptions WHERE person_id = 1 AND unsubscribed_at IS NULL AND cleared = 0")
            .await
            .unwrap(),
        20
    );
    assert_eq!(count("SELECT COUNT(*) FROM folders").await.unwrap(), 0);
    assert_eq!(count("SELECT COUNT(*) FROM feed_folders").await.unwrap(), 0);
    assert_eq!(count("SELECT COUNT(*) FROM articles").await.unwrap(), 1000);
    assert_eq!(
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND read = 1")
            .await
            .unwrap(),
        500
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND starred = 1")
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
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND read = 1")
            .await
            .unwrap(),
        500
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND starred = 1")
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
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND read = 1")
            .await
            .unwrap(),
        100
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND starred = 1")
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

#[tokio::test]
async fn adding_saved_searches_keeps_every_feed_folder_article_and_mark() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database as WebSub left it (structure changes 1 to 7).
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(7, &old)
        .await
        .unwrap();
    sqlx::query("INSERT INTO folders (id, name) VALUES (1, 'Tech'), (2, 'Essays')")
        .execute(&old)
        .await
        .unwrap();
    for feed in 1..=10 {
        sqlx::query("INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (?, ?, ?, ?, 1)")
            .bind(feed)
            .bind(format!("https://blog-{feed}.example/feed"))
            .bind(format!("blog-{feed}.example/feed"))
            .bind(format!("Blog {feed}"))
            .execute(&old)
            .await
            .unwrap();
        sqlx::query("INSERT INTO feed_folders (folder_id, feed_id) VALUES (?, ?)")
            .bind(1 + feed % 2)
            .bind(feed)
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

    let db = upgraded_to(&data_dir, 39).await;
    let count = |sql: &'static str| sqlx::query_scalar::<_, i64>(sql).fetch_one(&db);
    assert_eq!(count("SELECT COUNT(*) FROM feeds").await.unwrap(), 10);
    assert_eq!(count("SELECT COUNT(*) FROM folders").await.unwrap(), 2);
    assert_eq!(
        count("SELECT COUNT(*) FROM feed_folders").await.unwrap(),
        10
    );
    assert_eq!(count("SELECT COUNT(*) FROM articles").await.unwrap(), 200);
    assert_eq!(
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND read = 1")
            .await
            .unwrap(),
        100
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND starred = 1")
            .await
            .unwrap(),
        40
    );
    // No search is saved until the reader saves one.
    assert_eq!(
        count("SELECT COUNT(*) FROM saved_searches").await.unwrap(),
        0
    );
}

#[tokio::test]
async fn adding_feed_settings_keeps_every_feed_as_it_was() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just before feed settings (structure changes up to 8).
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(8, &old)
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
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND read = 1")
            .await
            .unwrap(),
        100
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND starred = 1")
            .await
            .unwrap(),
        40
    );
    assert_eq!(
        count("SELECT SUM(next_check_at) FROM feeds").await.unwrap(),
        10 * 1000 + 55
    );
    // Every feed behaves as before: its own rhythm, read in nine turtles.
    assert_eq!(
        count("SELECT COUNT(*) FROM subscriptions WHERE check_at_most = 0 AND open_on_site = 0")
            .await
            .unwrap(),
        10
    );
}

#[tokio::test]
async fn adding_rules_keeps_every_article_mark_and_star_and_mutes_nothing() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just before rules (structure changes up to 9).
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(9, &old)
        .await
        .unwrap();
    for feed in 1..=10 {
        sqlx::query("INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (?, ?, ?, ?, 1)")
            .bind(feed)
            .bind(format!("https://blog-{feed}.example/feed"))
            .bind(format!("blog-{feed}.example/feed"))
            .bind(format!("Blog {feed}"))
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
            .bind(format!("Sponsored article {number}"))
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
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND read = 1")
            .await
            .unwrap(),
        100
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND starred = 1")
            .await
            .unwrap(),
        40
    );
    // Nothing is muted, and there are no rules, until the reader makes one.
    assert_eq!(
        count("SELECT COUNT(*) FROM entries WHERE person_id = 1 AND muted = 1")
            .await
            .unwrap(),
        0
    );
    assert_eq!(count("SELECT COUNT(*) FROM rules").await.unwrap(), 0);
}

#[tokio::test]
async fn giving_things_an_owner_makes_everything_the_owners_and_loses_nothing() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just before readers (structure changes up to 10), with a
    // signed-in device, settings, an app password, folders with feeds in
    // them, saved searches and rules.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(10, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO sessions (token_hash, created_at, last_used_at, expires_at)
         VALUES (x'00112233', 1, 1, 9999999999), (x'44556677', 1, 1, 9999999999)",
        "INSERT INTO settings (name, value) VALUES ('sort', 'oldest'), ('mode', 'river'),
             ('app_password', 'abc123'), ('app_password_made_at', '1790000000'),
             ('articles_high_water', '4000')",
        "INSERT INTO folders (id, name) VALUES (1, 'Gardens'), (2, 'Essays'), (3, 'Empty')",
        "INSERT INTO saved_searches (id, name, query, created_at)
         VALUES (1, 'Tomatoes', '{\"q\":\"tomatoes\"}', 5), (2, 'Essays', '{}', 6)",
        "INSERT INTO rules (id, words, author, feed_id, folder_id, place_gone, action, paused,
             created_at)
         VALUES (1, 'sponsored', '', NULL, NULL, 0, 'mute', 0, 7),
                (2, '', 'Ann', 3, NULL, 0, 'star', 1, 8),
                (3, 'news', '', NULL, 1, 0, 'read', 0, 9),
                (4, 'gone', '', NULL, NULL, 1, 'mute', 0, 10)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    for feed in 1..=10 {
        sqlx::query("INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (?, ?, ?, ?, 1)")
            .bind(feed)
            .bind(format!("https://blog-{feed}.example/feed"))
            .bind(format!("blog-{feed}.example/feed"))
            .bind(format!("Blog {feed}"))
            .execute(&old)
            .await
            .unwrap();
        // Every feed in Gardens, every other one in Essays too.
        for folder in [1, 2]
            .into_iter()
            .filter(|folder| *folder == 1 || feed % 2 == 0)
        {
            sqlx::query("INSERT INTO feed_folders (folder_id, feed_id) VALUES (?, ?)")
                .bind(folder)
                .bind(feed)
                .execute(&old)
                .await
                .unwrap();
        }
    }
    old.close().await;

    let db = upgraded_to(&data_dir, 39).await;
    let count = |sql: &'static str| sqlx::query_scalar::<_, i64>(sql).fetch_one(&db);
    // One reader, the owner.
    assert_eq!(
        count("SELECT COUNT(*) FROM people WHERE id = 1 AND owner = 1")
            .await
            .unwrap(),
        1
    );
    assert_eq!(count("SELECT COUNT(*) FROM people").await.unwrap(), 1);
    // Both devices stay signed in, as the owner's.
    assert_eq!(
        count("SELECT COUNT(*) FROM sessions WHERE person_id = 1")
            .await
            .unwrap(),
        2
    );
    // The settings and the app password are the owner's; nine turtles' own
    // highest article number stays where it was.
    let settings: Vec<(i64, String, String)> =
        sqlx::query_as("SELECT person_id, name, value FROM person_settings ORDER BY name")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(
        settings,
        [
            (1, "sort".to_owned(), "oldest".to_owned()),
            // River became Unread off (structure change 38).
            (1, "unread".to_owned(), "off".to_owned())
        ]
    );
    let app: (i64, String, i64) =
        sqlx::query_as("SELECT person_id, password_hash, made_at FROM app_passwords")
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(app, (1, "abc123".to_owned(), 1_790_000_000));
    let left: Vec<(String, String)> = sqlx::query_as("SELECT name, value FROM settings")
        .fetch_all(&db)
        .await
        .unwrap();
    assert_eq!(
        left,
        [("articles_high_water".to_owned(), "4000".to_owned())]
    );
    // Every folder, with every feed still in it, keeps its number.
    let folders: Vec<(i64, i64, String)> =
        sqlx::query_as("SELECT id, person_id, name FROM folders ORDER BY id")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(
        folders,
        [
            (1, 1, "Gardens".to_owned()),
            (2, 1, "Essays".to_owned()),
            (3, 1, "Empty".to_owned())
        ]
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM feed_folders WHERE folder_id = 1")
            .await
            .unwrap(),
        10
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM feed_folders WHERE folder_id = 2")
            .await
            .unwrap(),
        5
    );
    // Saved searches and rules are the owner's, exactly as they were.
    let searches: Vec<(i64, i64, String, String, i64)> = sqlx::query_as(
        "SELECT id, person_id, name, query, created_at FROM saved_searches ORDER BY id",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(
        searches,
        [
            (
                1,
                1,
                "Tomatoes".to_owned(),
                r#"{"q":"tomatoes"}"#.to_owned(),
                5
            ),
            (2, 1, "Essays".to_owned(), "{}".to_owned(), 6)
        ]
    );
    type RuleRow = (
        i64,
        i64,
        String,
        String,
        Option<i64>,
        Option<i64>,
        i64,
        String,
        i64,
        i64,
    );
    let rules: Vec<RuleRow> = sqlx::query_as(
        "SELECT id, person_id, words, author, feed_id, folder_id, place_gone, action, paused,
             created_at FROM rules ORDER BY id",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    let rule = |id, words: &str, author: &str, feed, folder, gone, action: &str, paused, at| {
        (
            id,
            1,
            words.to_owned(),
            author.to_owned(),
            feed,
            folder,
            gone,
            action.to_owned(),
            paused,
            at,
        )
    };
    assert_eq!(
        rules,
        [
            rule(1, "sponsored", "", None, None, 0, "mute", 0, 7),
            rule(2, "", "Ann", Some(3), None, 0, "star", 1, 8),
            rule(3, "news", "", None, Some(1), 0, "read", 0, 9),
            rule(4, "gone", "", None, None, 1, "mute", 0, 10),
        ]
    );

    // Names are unique for each reader now, not across readers.
    sqlx::query("INSERT INTO people (id, created_at) VALUES (2, 1)")
        .execute(&db)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO folders (person_id, name) VALUES (2, 'gardens')",
        "INSERT INTO saved_searches (person_id, name, query, created_at)
         VALUES (2, 'tomatoes', '{}', 1)",
    ] {
        sqlx::query(sql).execute(&db).await.unwrap();
    }
    for sql in [
        "INSERT INTO folders (person_id, name) VALUES (1, 'GARDENS')",
        "INSERT INTO saved_searches (person_id, name, query, created_at)
         VALUES (1, 'TOMATOES', '{}', 1)",
    ] {
        assert!(sqlx::query(sql).execute(&db).await.is_err(), "{sql}");
    }
    // Every table's rules still hold: SQLite finds nothing out of place.
    let problems: Vec<(String,)> = sqlx::query_as("PRAGMA foreign_key_check")
        .fetch_all(&db)
        .await
        .unwrap();
    assert!(problems.is_empty(), "{problems:?}");
}

/// One article's marks as structure change 12 must keep them: its number,
/// feed, place in the list, and read, starred and muted marks.
type Marks = (i64, i64, i64, bool, bool, bool);

#[tokio::test]
async fn giving_each_reader_their_own_feeds_and_marks_keeps_every_one_as_the_owners() {
    let config = common::config();
    let data_dir = config.data_dir.clone();
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just before part two (structure changes up to 11):
    // feeds with a rename and their own settings, one in folders, one just
    // unsubscribed from (Undo still possible), one cleared but kept for its
    // two starred articles, one with nothing yet; read, starred and muted
    // articles; a hub; a rule and a saved search for a feed.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(11, &old)
        .await
        .unwrap();
    let now = nine_turtles::now();
    for (id, title, unsubscribed_at, cleared, river, check_at_most, open_on_site) in [
        (1, "My renamed blog", None, 0, 1, 3600, 1),
        (2, "Blog 2", None, 0, 0, 0, 0),
        (3, "Blog 3", None, 0, 0, 86_400, 0),
        (4, "Just left", Some(now - 60), 0, 0, 0, 1),
        (5, "Cleared, stars kept", Some(now - 86_400), 1, 0, 0, 0),
        (6, "Nothing yet", None, 0, 0, 0, 0),
    ] {
        sqlx::query(
            "INSERT INTO feeds (id, url, url_key, title, added_at, fetched_at, next_check_at,
                 check_every, unsubscribed_at, cleared, river, check_at_most, open_on_site)
             VALUES (?, ?, ?, ?, ?, 5, 99, 3600, ?, ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(format!("https://blog-{id}.example/feed"))
        .bind(format!("blog-{id}.example/feed"))
        .bind(title)
        .bind(id * 10)
        .bind(unsubscribed_at)
        .bind(cleared)
        .bind(river)
        .bind(check_at_most)
        .bind(open_on_site)
        .execute(&old)
        .await
        .unwrap();
    }
    for feed in 1..=5 {
        for number in 0..30 {
            if feed == 5 && number >= 2 {
                break;
            }
            let muted = feed != 5 && number % 7 == 0;
            sqlx::query(
                "INSERT INTO articles (feed_id, fingerprint, title, received_at, sort_at, read,
                     starred, muted)
                 VALUES (?, ?, ?, 2, ?, ?, ?, ?)",
            )
            .bind(feed)
            .bind(format!("id:{number}"))
            .bind(format!("Article {number}"))
            .bind(1_000 * feed + number)
            .bind(muted || number % 2 == 1)
            .bind(feed == 5 || number % 10 == 0)
            .bind(muted)
            .execute(&old)
            .await
            .unwrap();
        }
    }
    for sql in [
        "INSERT INTO folders (id, person_id, name) VALUES (1, 1, 'Gardens')",
        "INSERT INTO feed_folders (folder_id, feed_id) VALUES (1, 3), (1, 4)",
        "INSERT INTO websub (feed_id, hub, topic, token, secret, asked_at)
         VALUES (2, 'https://hub.example/', 'https://blog-2.example/feed', 'tok', 'sec', 1)",
        "INSERT INTO rules (person_id, words, feed_id, action, created_at)
         VALUES (1, 'sponsored', 1, 'mute', 1)",
        "INSERT INTO saved_searches (person_id, name, query, created_at)
         VALUES (1, 'In blog 3', '{\"scope\":{\"kind\":\"feed\",\"id\":3}}', 1)",
        "INSERT INTO settings (name, value) VALUES ('articles_high_water', '500')",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    let before: Vec<Marks> = sqlx::query_as(
        "SELECT id, feed_id, sort_at, read, starred, muted FROM articles ORDER BY id",
    )
    .fetch_all(&old)
    .await
    .unwrap();
    assert_eq!(before.len(), 4 * 30 + 2);
    old.close().await;

    // Today's nine turtles opens it.
    let (base, state) = common::start_with_state(config).await;
    let db = &state.db;
    let count = |sql: &'static str| sqlx::query_scalar::<_, i64>(sql).fetch_one(db);

    // Every article is still there, once, and is the owner's with exactly
    // the marks it had, except that feed 1 flowed past (river), so its
    // articles were counted as read when that went (structure change 38).
    assert_eq!(count("SELECT COUNT(*) FROM articles").await.unwrap(), 122);
    let before: Vec<Marks> = before
        .into_iter()
        .map(|mut marks| {
            if marks.1 == 1 {
                marks.3 = true;
            }
            marks
        })
        .collect();
    let after: Vec<Marks> = sqlx::query_as(
        "SELECT article_id, feed_id, sort_at, read, starred, muted FROM entries
         WHERE person_id = 1 ORDER BY article_id",
    )
    .fetch_all(db)
    .await
    .unwrap();
    assert_eq!(after, before);
    assert_eq!(count("SELECT COUNT(*) FROM entries").await.unwrap(), 122);

    // Every feed line is the owner's subscription, with its name, settings
    // and unsubscribing exactly as they were.
    // (Feed 1 flowed past, which went in structure change 38.)
    type Subscription = (i64, String, i64, Option<i64>, bool, i64, bool);
    let subscriptions: Vec<Subscription> = sqlx::query_as(
        "SELECT feed_id, title, added_at, unsubscribed_at, cleared, check_at_most, open_on_site
         FROM subscriptions WHERE person_id = 1 ORDER BY feed_id",
    )
    .fetch_all(db)
    .await
    .unwrap();
    assert_eq!(
        subscriptions,
        [
            (1, "My renamed blog".into(), 10, None, false, 3600, true),
            (2, "Blog 2".into(), 20, None, false, 0, false),
            (3, "Blog 3".into(), 30, None, false, 86_400, false),
            (4, "Just left".into(), 40, Some(now - 60), false, 0, true),
            (
                5,
                "Cleared, stars kept".into(),
                50,
                Some(now - 86_400),
                true,
                0,
                false
            ),
            (6, "Nothing yet".into(), 60, None, false, 0, false),
        ]
    );
    // What background checking reads stays as it was.
    let shared: Vec<(i64, Option<i64>, i64, i64, i64)> = sqlx::query_as(
        "SELECT id, unsubscribed_at, check_at_most, next_check_at, check_every FROM feeds
         ORDER BY id",
    )
    .fetch_all(db)
    .await
    .unwrap();
    assert_eq!(
        shared,
        [
            (1, None, 3600, 99, 3600),
            (2, None, 0, 99, 3600),
            (3, None, 86_400, 99, 3600),
            (4, Some(now - 60), 0, 99, 3600),
            (5, Some(now - 86_400), 0, 99, 3600),
            (6, None, 0, 99, 3600),
        ]
    );
    for (sql, expected) in [
        ("SELECT COUNT(*) FROM feed_folders", 2),
        ("SELECT COUNT(*) FROM websub", 1),
        ("SELECT COUNT(*) FROM rules WHERE feed_id = 1", 1),
    ] {
        assert_eq!(
            sqlx::query_scalar::<_, i64>(sql)
                .fetch_one(db)
                .await
                .unwrap(),
            expected,
            "{sql}"
        );
    }
    let high_water: String =
        sqlx::query_scalar("SELECT value FROM settings WHERE name = 'articles_high_water'")
            .fetch_one(db)
            .await
            .unwrap();
    assert_eq!(high_water, "500");

    // The old shared marks and per-reader feed columns are gone, with
    // their indexes.
    let columns = |table: &'static str| {
        sqlx::query_scalar::<_, String>("SELECT name FROM pragma_table_info(?)")
            .bind(table)
            .fetch_all(db)
    };
    let article_columns = columns("articles").await.unwrap();
    for gone in ["read", "starred", "muted"] {
        assert!(
            !article_columns.iter().any(|column| column == gone),
            "{gone}"
        );
    }
    let feed_columns = columns("feeds").await.unwrap();
    for gone in ["cleared", "river", "open_on_site"] {
        assert!(!feed_columns.iter().any(|column| column == gone), "{gone}");
    }
    assert!(feed_columns.iter().any(|column| column == "title"));
    assert_eq!(
        count(
            "SELECT COUNT(*) FROM sqlite_schema WHERE type = 'index' AND name IN
             ('articles_unread', 'articles_starred', 'articles_unread_by_feed', 'articles_muted')"
        )
        .await
        .unwrap(),
        0
    );
    let problems: Vec<(String,)> = sqlx::query_as("PRAGMA foreign_key_check")
        .fetch_all(db)
        .await
        .unwrap();
    assert!(problems.is_empty(), "{problems:?}");
    // Only the two values a mark can have are accepted.
    assert!(
        sqlx::query("UPDATE entries SET read = 2 WHERE article_id = 1")
            .execute(db)
            .await
            .is_err()
    );

    // The owner sees everything as before: the renamed feed, the cleared
    // feed's stars, and Undo for the feed unsubscribed from just before.
    let cookie = common::signed_in(&base).await;
    let client = reqwest::Client::new();
    let get = |path: &'static str| {
        let request = client
            .get(format!("{base}{path}"))
            .header("cookie", &cookie);
        async move {
            let response = request.send().await.unwrap();
            assert_eq!(response.status(), reqwest::StatusCode::OK, "{path}");
            serde_json::from_str::<serde_json::Value>(&response.text().await.unwrap()).unwrap()
        }
    };
    let feeds = get("/api/feeds").await["feeds"].clone();
    let names: Vec<&str> = feeds
        .as_array()
        .unwrap()
        .iter()
        .map(|feed| feed["title"].as_str().unwrap())
        .collect();
    assert_eq!(
        names,
        ["Blog 2", "Blog 3", "My renamed blog", "Nothing yet"]
    );
    assert_eq!(feeds[2]["unread"], 0);
    assert_eq!(feeds[0]["unread"], 15 - 3);
    let starred = get("/api/articles?view=starred").await["articles"].clone();
    assert_eq!(starred.as_array().unwrap().len(), 2 + 4 * 3);
    assert_eq!(starred[0]["feed_title"], "Cleared, stars kept");
    let undone = client
        .post(format!("{base}/api/feeds/4/resubscribe"))
        .header("cookie", &cookie)
        .header("sec-fetch-site", "same-origin")
        .send()
        .await
        .unwrap();
    assert_eq!(undone.status(), reqwest::StatusCode::NO_CONTENT);
    let feeds = get("/api/feeds").await["feeds"].clone();
    assert_eq!(feeds.as_array().unwrap().len(), 5);
    assert_eq!(feeds[2]["title"], "Just left");
    assert_eq!(feeds[2]["folders"], serde_json::json!([1]));
    assert_eq!(feeds[2]["open_on_site"], true);
    let unsubscribed: Option<i64> =
        sqlx::query_scalar("SELECT unsubscribed_at FROM feeds WHERE id = 4")
            .fetch_one(db)
            .await
            .unwrap();
    assert_eq!(unsubscribed, None);
}

#[tokio::test]
async fn adding_emails_keeps_every_reader_and_device_and_gives_nobody_a_password() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after readers (structure change 11): the owner and
    // one other reader, each with a signed-in device.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(11, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO people (id, created_at) VALUES (2, 5)",
        "INSERT INTO sessions (person_id, token_hash, created_at, last_used_at, expires_at)
         VALUES (1, x'00112233', 1, 1, 9999999999), (2, x'44556677', 1, 1, 9999999999)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let people: Vec<(i64, bool, Option<String>, Option<String>)> =
        sqlx::query_as("SELECT id, owner, email, password_hash FROM people ORDER BY id")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(people, [(1, true, None, None), (2, false, None, None)]);
    let devices: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sessions")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(devices, 2);

    // Two readers can't share an email, whatever its capital letters.
    sqlx::query("UPDATE people SET email = 'Rohit@Example.com' WHERE id = 1")
        .execute(&db)
        .await
        .unwrap();
    let clash = sqlx::query("UPDATE people SET email = 'rohit@example.com' WHERE id = 2")
        .execute(&db)
        .await;
    assert!(clash.is_err());
}

#[tokio::test]
async fn adding_the_clean_ups_record_keeps_every_feed_article_and_mark() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after account emails (structure change 14): one
    // feed the owner follows, with a starred article and a read one.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(14, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (1, 'u', 'u', 'Garden', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (1, 1, 'Garden', 1)",
        "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
         VALUES (1, 1, 'a', 'A', 1, 1), (2, 1, 'b', 'B', 2, 2)",
        "INSERT INTO entries (person_id, article_id, feed_id, sort_at, read, starred)
         VALUES (1, 1, 1, 1, 0, 1), (1, 2, 1, 2, 1, 0)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let entries: Vec<(i64, bool, bool)> =
        sqlx::query_as("SELECT article_id, read, starred FROM entries ORDER BY article_id")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(entries, [(1, false, true), (2, true, false)]);
    let forgotten: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM forgotten_articles")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(forgotten, 0);
}

#[tokio::test]
async fn adding_newsletters_keeps_every_feed_and_makes_none_a_newsletter() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after the yearly clean-up's record (structure
    // change 15): one web feed the owner follows, with a starred article.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(15, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (1, 'u', 'u', 'Garden', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (1, 1, 'Garden', 1)",
        "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
         VALUES (1, 1, 'a', 'A', 1, 1)",
        "INSERT INTO entries (person_id, article_id, feed_id, sort_at, starred) VALUES (1, 1, 1, 1, 1)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let feeds: Vec<(i64, String, Option<i64>)> =
        sqlx::query_as("SELECT id, title, newsletter_of FROM feeds")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(feeds, [(1, "Garden".to_owned(), None)]);
    let starred: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM entries WHERE starred = 1")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(starred, 1);
    let addresses: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM newsletter_addresses")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(addresses, 0);
}

#[tokio::test]
async fn adding_newsletter_labels_keeps_every_address_and_feed() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after newsletters part two (structure change 16):
    // the owner's address and one newsletter feed with an article.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(16, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO newsletter_addresses (name, person_id, created_at) VALUES ('turtle-abcdefgh', 1, 1)",
        "INSERT INTO feeds (id, url, url_key, title, added_at, next_check_at, newsletter_of)
         VALUES (1, 'newsletter:1:list:x', 'newsletter:1:list:x', 'Garden', 1, 9223372036854775807, 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (1, 1, 'Garden', 1)",
        "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
         VALUES (1, 1, 'a', 'A', 1, 1)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let kept: (i64, i64, i64) = sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM newsletter_addresses), (SELECT COUNT(*) FROM feeds),
                (SELECT COUNT(*) FROM articles)",
    )
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(kept, (1, 1, 1));
    let new: (i64, i64) = sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM newsletter_labels), (SELECT COUNT(*) FROM newsletter_senders)",
    )
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(new, (0, 0));
}

#[tokio::test]
async fn allowing_sign_in_links_keeps_every_emailed_link() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after pausing feeds (structure change 19), with one link
    // of each kind waiting.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(19, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO people (id, owner, email, created_at) VALUES (2, 0, 'kai@example.com', 1)",
        "INSERT INTO email_links (purpose, person_id, email, password_hash, token_hash, created_at,
                                  expires_at, used, emailed)
         VALUES ('sign-up', NULL, 'new@example.com', 'line', x'01', 1, 9999999999, 0, 1),
                ('reset', 2, 'kai@example.com', NULL, x'02', 1, 9999999999, 1, 1),
                ('change', 2, 'taken@example.com', NULL, x'03', 1, 9999999999, 1, 0)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    // Only as far as this change: a later one drops sign-up links.
    sqlx::migrate!("./migrations")
        .run_to(20, &old)
        .await
        .unwrap();

    let db = old;
    let links: Vec<(String, Option<i64>, String, i64, i64)> = sqlx::query_as(
        "SELECT purpose, person_id, email, used, emailed FROM email_links ORDER BY id",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(
        links,
        [
            (
                "sign-up".to_owned(),
                None,
                "new@example.com".to_owned(),
                0,
                1
            ),
            (
                "reset".to_owned(),
                Some(2),
                "kai@example.com".to_owned(),
                1,
                1
            ),
            (
                "change".to_owned(),
                Some(2),
                "taken@example.com".to_owned(),
                1,
                0
            ),
        ]
    );
    sqlx::query(
        "INSERT INTO email_links (purpose, person_id, email, token_hash, created_at, expires_at)
         VALUES ('sign-in', 2, 'kai@example.com', x'04', 1, 901)",
    )
    .execute(&db)
    .await
    .unwrap();
    // Deleting a reader still takes their links with them.
    sqlx::query("DELETE FROM people WHERE id = 2")
        .execute(&db)
        .await
        .unwrap();
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM email_links")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(left, 1);
}

#[tokio::test]
async fn remembering_when_marks_were_made_keeps_every_mark() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after sign-in links (structure change 20): one feed
    // the owner follows, with a starred article, a read one and a muted one.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(20, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (1, 'u', 'u', 'Garden', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (1, 1, 'Garden', 1)",
        "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
         VALUES (1, 1, 'a', 'A', 1, 1), (2, 1, 'b', 'B', 2, 2), (3, 1, 'c', 'C', 3, 3)",
        "INSERT INTO entries (person_id, article_id, feed_id, sort_at, read, starred, muted)
         VALUES (1, 1, 1, 1, 0, 1, 0), (1, 2, 1, 2, 1, 0, 0), (1, 3, 1, 3, 1, 0, 1)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let entries: Vec<(i64, bool, bool, bool, i64, i64)> = sqlx::query_as(
        "SELECT article_id, read, starred, muted, read_marked_at, starred_marked_at
         FROM entries ORDER BY article_id",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(
        entries,
        [
            (1, false, true, false, 0, 0),
            (2, true, false, false, 0, 0),
            (3, true, false, true, 0, 0)
        ]
    );
}

#[tokio::test]
async fn remembering_what_was_opened_keeps_every_mark_and_opens_nothing() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after mark times (structure change 21): one feed the
    // owner follows, with a starred article and a read one.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(21, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (1, 'u', 'u', 'Garden', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (1, 1, 'Garden', 1)",
        "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
         VALUES (1, 1, 'a', 'A', 1, 1), (2, 1, 'b', 'B', 2, 2)",
        "INSERT INTO entries (person_id, article_id, feed_id, sort_at, read, starred,
             read_marked_at, starred_marked_at)
         VALUES (1, 1, 1, 1, 0, 1, 0, 5), (1, 2, 1, 2, 1, 0, 7, 0)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = upgraded_to(&data_dir, 39).await;
    let entries: Vec<(i64, bool, bool, i64, i64, Option<i64>)> = sqlx::query_as(
        "SELECT article_id, read, starred, read_marked_at, starred_marked_at, opened_at
         FROM entries ORDER BY article_id",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(
        entries,
        [(1, false, true, 0, 5, None), (2, true, false, 7, 0, None)]
    );
}

#[tokio::test]
async fn adding_collections_keeps_every_entry_and_starts_with_none() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after Recently read (structure change 22): one feed
    // the owner follows, with a starred article and an opened one.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(22, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (1, 'u', 'u', 'Garden', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (1, 1, 'Garden', 1)",
        "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
         VALUES (1, 1, 'a', 'A', 1, 1), (2, 1, 'b', 'B', 2, 2)",
        "INSERT INTO entries (person_id, article_id, feed_id, sort_at, read, starred, opened_at)
         VALUES (1, 1, 1, 1, 0, 1, NULL), (1, 2, 1, 2, 1, 0, 9)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = upgraded_to(&data_dir, 39).await;
    let entries: Vec<(i64, bool, bool, Option<i64>)> = sqlx::query_as(
        "SELECT article_id, read, starred, opened_at FROM entries ORDER BY article_id",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(entries, [(1, false, true, None), (2, true, false, Some(9))]);
    let collections: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM collections")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(collections, 0);
    // A collection's line must point at one of its reader's entries.
    sqlx::query(
        "INSERT INTO collections (id, person_id, name, created_at) VALUES (1, 1, 'Soup', 0)",
    )
    .execute(&db)
    .await
    .unwrap();
    let stray = sqlx::query(
        "INSERT INTO collection_articles (collection_id, person_id, article_id, added_at)
         VALUES (1, 1, 99, 0)",
    )
    .execute(&db)
    .await;
    assert!(stray.is_err());
}

#[tokio::test]
async fn adding_podcasts_keeps_every_article_and_entry_and_makes_none_an_episode() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after collections (structure change 23): one feed
    // the owner follows, with a starred article on a collection.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(23, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (1, 'u', 'u', 'Radio', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (1, 1, 'Radio', 1)",
        "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
         VALUES (1, 1, 'a', 'A', 1, 1), (2, 1, 'b', 'B', 2, 2)",
        "INSERT INTO entries (person_id, article_id, feed_id, sort_at, read, starred)
         VALUES (1, 1, 1, 1, 0, 1), (1, 2, 1, 2, 1, 0)",
        "INSERT INTO collections (id, person_id, name, created_at) VALUES (1, 1, 'Keep', 0)",
        "INSERT INTO collection_articles (collection_id, person_id, article_id, added_at)
         VALUES (1, 1, 1, 0)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = upgraded_to(&data_dir, 39).await;
    let articles: Vec<(i64, String, Option<String>)> =
        sqlx::query_as("SELECT id, title, episode_url FROM articles ORDER BY id")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(
        articles,
        [(1, "A".to_owned(), None), (2, "B".to_owned(), None)]
    );
    let entries: Vec<(i64, bool, bool)> =
        sqlx::query_as("SELECT article_id, read, starred FROM entries ORDER BY article_id")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(entries, [(1, false, true), (2, true, false)]);
    let collected: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM collection_articles")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(collected, 1);
    // A place and an Up Next line must point at one of the reader's
    // entries, and go with it.
    let stray = sqlx::query("INSERT INTO up_next (person_id, article_id, place) VALUES (1, 99, 0)")
        .execute(&db)
        .await;
    assert!(stray.is_err());
    sqlx::query(
        "INSERT INTO episode_progress (person_id, article_id, position, saved_at)
         VALUES (1, 2, 12.5, 0)",
    )
    .execute(&db)
    .await
    .unwrap();
    sqlx::query("INSERT INTO up_next (person_id, article_id, place) VALUES (1, 2, 0)")
        .execute(&db)
        .await
        .unwrap();
    sqlx::query("DELETE FROM entries WHERE person_id = 1 AND article_id = 2")
        .execute(&db)
        .await
        .unwrap();
    let left: i64 = sqlx::query_scalar(
        "SELECT (SELECT COUNT(*) FROM episode_progress) + (SELECT COUNT(*) FROM up_next)",
    )
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(left, 0);
}

#[tokio::test]
async fn adding_passkeys_keeps_every_reader_and_device() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after marks remembered their times (structure
    // change 21): the owner and another reader, each signed in on a device.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(21, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO people (id, created_at, email) VALUES (2, 5, 'reader@example.com')",
        "INSERT INTO sessions (person_id, token_hash, created_at, last_used_at, expires_at)
         VALUES (1, x'00112233', 1, 1, 9999999999), (2, x'44556677', 1, 1, 9999999999)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let people: Vec<(i64, Option<String>)> =
        sqlx::query_as("SELECT id, email FROM people ORDER BY id")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(
        people,
        [(1, None), (2, Some("reader@example.com".to_owned()))]
    );
    let devices: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sessions")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(devices, 2);
    // Nobody has a passkey yet, and one passkey can't be two readers'.
    let passkeys: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM passkeys")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(passkeys, 0);
    let add = |person: i64| {
        sqlx::query(
            "INSERT INTO passkeys (person_id, credential_id, user_handle, passkey, created_at)
             VALUES (?, x'0102', 'handle', '{}', 1)",
        )
        .bind(person)
        .execute(&db)
    };
    add(1).await.unwrap();
    assert!(add(2).await.is_err());
}

#[tokio::test]
async fn dropping_sign_up_links_keeps_every_readers_link_and_setting() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after assistants (structure change 26), with a
    // waiting sign-up link, one of each other kind, and the old Sign-up
    // switch's settings beside one that stays.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(26, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO people (id, owner, email, created_at) VALUES (2, 0, 'kai@example.com', 1)",
        "INSERT INTO email_links (purpose, person_id, email, password_hash, token_hash, created_at,
                                  expires_at, used, emailed)
         VALUES ('sign-up', NULL, 'new@example.com', 'line', x'01', 1, 9999999999, 0, 1),
                ('reset', 2, 'kai@example.com', NULL, x'02', 1, 9999999999, 1, 1),
                ('change', 2, 'taken@example.com', NULL, x'03', 1, 9999999999, 1, 0),
                ('sign-in', 2, 'kai@example.com', NULL, x'04', 1, 9999999999, 0, 1)",
        "INSERT INTO settings (name, value)
         VALUES ('sign_up', 'invite'), ('sign_up_invite', 'ab'),
                ('sign_up_invite_made_at', '1'), ('theme', 'plain')",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let links: Vec<(String, i64, String, Vec<u8>, i64, i64)> = sqlx::query_as(
        "SELECT purpose, person_id, email, token_hash, used, emailed FROM email_links ORDER BY id",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(
        links,
        [
            (
                "reset".to_owned(),
                2,
                "kai@example.com".to_owned(),
                vec![2],
                1,
                1
            ),
            (
                "change".to_owned(),
                2,
                "taken@example.com".to_owned(),
                vec![3],
                1,
                0
            ),
            (
                "sign-in".to_owned(),
                2,
                "kai@example.com".to_owned(),
                vec![4],
                0,
                1
            ),
        ]
    );
    let settings: Vec<(String, String)> =
        sqlx::query_as("SELECT name, value FROM settings ORDER BY name")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(settings, [("theme".to_owned(), "plain".to_owned())]);
    // A link with nobody's name, or for a sign-up, can't be stored any more.
    for sql in [
        "INSERT INTO email_links (purpose, person_id, email, token_hash, created_at, expires_at)
         VALUES ('sign-up', 2, 'new@example.com', x'05', 1, 901)",
        "INSERT INTO email_links (purpose, person_id, email, token_hash, created_at, expires_at)
         VALUES ('reset', NULL, 'new@example.com', x'06', 1, 901)",
    ] {
        assert!(sqlx::query(sql).execute(&db).await.is_err(), "{sql}");
    }
    // Deleting a reader still takes their links with them.
    sqlx::query("DELETE FROM people WHERE id = 2")
        .execute(&db)
        .await
        .unwrap();
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM email_links")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(left, 0);
}

#[tokio::test]
async fn adding_people_keeps_every_feed_on_its_own_with_its_name_and_folder() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after sign-up links went (structure change 27): two
    // feeds followed, one in a folder.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(27, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at)
         VALUES (1, 'a', 'a', 'Garden', 1), (2, 'b', 'b', 'Radio', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at)
         VALUES (1, 1, 'My garden', 1), (1, 2, 'Radio', 2)",
        "INSERT INTO folders (id, person_id, name) VALUES (1, 1, 'Friends')",
        "INSERT INTO feed_folders (folder_id, feed_id) VALUES (1, 1)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    // Every feed is still followed, with its own name, on its own; the
    // folder keeps its feed.
    let followed: Vec<(i64, String, Option<i64>)> =
        sqlx::query_as("SELECT feed_id, title, writer_id FROM subscriptions ORDER BY feed_id")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(
        followed,
        [
            (1, "My garden".to_owned(), None),
            (2, "Radio".to_owned(), None)
        ]
    );
    let filed: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM feed_folders")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(filed, 1);
    // A person can be made, and removing them leaves their places followed.
    sqlx::query("INSERT INTO writers (id, person_id, name, created_at) VALUES (1, 1, 'Kai', 1)")
        .execute(&db)
        .await
        .unwrap();
    sqlx::query("UPDATE subscriptions SET writer_id = 1")
        .execute(&db)
        .await
        .unwrap();
    sqlx::query("DELETE FROM writers")
        .execute(&db)
        .await
        .unwrap();
    let alone: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM subscriptions WHERE writer_id IS NULL")
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(alone, 2);
}

#[tokio::test]
async fn adding_youtube_sorting_keeps_every_article_and_entry_and_leaves_nothing_out() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after writing back (structure change 29): a YouTube
    // channel the owner follows, with two videos, one read and starred.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(29, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at)
         VALUES (1, 'https://www.youtube.com/feeds/videos.xml?channel_id=UCa', 'y', 'Walks', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (1, 1, 'Walks', 1)",
        "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
         VALUES (1, 1, 'a', 'A', 1, 1), (2, 1, 'b', 'B', 2, 2)",
        "INSERT INTO entries (person_id, article_id, feed_id, sort_at, read, starred)
         VALUES (1, 1, 1, 1, 1, 1), (1, 2, 1, 2, 0, 0)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let articles: Vec<(i64, Option<String>)> =
        sqlx::query_as("SELECT id, video_kind FROM articles ORDER BY id")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(articles, [(1, None), (2, None)]);
    let entries: Vec<(i64, bool, bool)> =
        sqlx::query_as("SELECT article_id, read, starred FROM entries ORDER BY article_id")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(entries, [(1, true, true), (2, false, false)]);
    let switches: (bool, bool) = sqlx::query_as("SELECT shorts, live_streams FROM subscriptions")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(switches, (false, false));
    let odd = sqlx::query("UPDATE articles SET video_kind = 'cat' WHERE id = 1")
        .execute(&db)
        .await;
    assert!(odd.is_err());
}

#[tokio::test]
async fn confirming_addresses_keeps_every_reader_and_link_and_confirms_every_address() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after YouTube (structure change 30): the owner and a
    // reader with an email, one reader without, and two emailed links.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(30, &old)
        .await
        .unwrap();
    for sql in [
        "UPDATE people SET email = 'owner@example.com' WHERE id = 1",
        "INSERT INTO people (id, owner, email, password_hash, created_at)
         VALUES (2, 0, 'mira@example.com', 'line', 5), (3, 0, NULL, NULL, 6)",
        "INSERT INTO email_links (purpose, person_id, email, token_hash, created_at, expires_at)
         VALUES ('sign-in', 2, 'mira@example.com', x'01', 1, 2),
                ('change', 1, 'new@example.com', x'02', 1, 2)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    // Everyone with an address counts as confirmed (the owner's choice).
    let people: Vec<(i64, bool)> =
        sqlx::query_as("SELECT id, email_confirmed_at IS NOT NULL FROM people ORDER BY id")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(people, [(1, true), (2, true), (3, false)]);
    let links: Vec<(String, Option<i64>)> =
        sqlx::query_as("SELECT purpose, person_id FROM email_links ORDER BY token_hash")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(
        links,
        [
            ("sign-in".to_owned(), Some(2)),
            ("change".to_owned(), Some(1))
        ]
    );
    // A waiting sign-up may now be kept, with no reader and its password.
    sqlx::query(
        "INSERT INTO email_links (purpose, email, password_hash, token_hash, created_at, expires_at)
         VALUES ('sign-up', 'kai@example.com', 'line', x'03', 1, 2)",
    )
    .execute(&db)
    .await
    .unwrap();
}

#[tokio::test]
async fn adding_publications_keeps_every_feed_person_and_folder_and_guesses_nothing_yet() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just before people and publications (structure change
    // 32): two feeds followed, joined into one person, one in a folder, and
    // asked about once.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(32, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at)
         VALUES (1, 'a', 'a', 'Garden', 1), (2, 'b', 'b', 'Radio', 1)",
        "INSERT INTO writers (id, person_id, name, created_at) VALUES (1, 1, 'Kai', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at, writer_id, same_asked)
         VALUES (1, 1, 'My garden', 1, 1, 1), (1, 2, 'Radio', 2, 1, 0)",
        "INSERT INTO folders (id, person_id, name) VALUES (1, 1, 'Friends')",
        "INSERT INTO feed_folders (folder_id, feed_id) VALUES (1, 1)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    // Every feed is still followed, with its name and person, and nothing is guessed yet.
    type Followed = (i64, String, Option<i64>, Option<String>, Option<String>);
    let followed: Vec<Followed> = sqlx::query_as(
        "SELECT feed_id, title, writer_id, kind, place FROM subscriptions ORDER BY feed_id",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(
        followed,
        [
            (1, "My garden".to_owned(), Some(1), None, None),
            (2, "Radio".to_owned(), Some(1), None, None)
        ]
    );
    let filed: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM feed_folders")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(filed, 1);
    // Only a person or a publication, and only the four kinds of source.
    assert!(
        sqlx::query("UPDATE subscriptions SET kind = 'band'")
            .execute(&db)
            .await
            .is_err()
    );
    assert!(
        sqlx::query("UPDATE subscriptions SET place = 'radio'")
            .execute(&db)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn adding_notes_keeps_every_subscription_and_entry_and_notes_nothing() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after people and publications (structure change 33): one
    // feed the owner follows, with a starred article and a read one.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(33, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (1, 'u', 'u', 'Garden', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at, write_to)
         VALUES (1, 1, 'Garden', 1, 'ivy@example.org')",
        "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
         VALUES (1, 1, 'a', 'A', 1, 1), (2, 1, 'b', 'B', 2, 2)",
        "INSERT INTO entries (person_id, article_id, feed_id, sort_at, read, starred)
         VALUES (1, 1, 1, 1, 0, 1), (1, 2, 1, 2, 1, 0)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let entries: Vec<(i64, bool, bool)> =
        sqlx::query_as("SELECT article_id, read, starred FROM entries ORDER BY article_id")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(entries, [(1, false, true), (2, true, false)]);
    let place: (String, Option<String>, Option<String>, bool) = sqlx::query_as(
        "SELECT title, write_to, note, drop_kept FROM subscriptions WHERE feed_id = 1",
    )
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(
        place,
        (
            "Garden".to_owned(),
            Some("ivy@example.org".to_owned()),
            None,
            false
        )
    );
    let notes: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM notes")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(notes, 0);
    // A note must point at one of its reader's entries, and say something.
    let stray = sqlx::query(
        "INSERT INTO notes (person_id, article_id, note, made_at, changed_at) VALUES (1, 99, 'x', 0, 0)",
    )
    .execute(&db)
    .await;
    assert!(stray.is_err());
    let empty = sqlx::query(
        "INSERT INTO notes (person_id, article_id, made_at, changed_at) VALUES (1, 1, 0, 0)",
    )
    .execute(&db)
    .await;
    assert!(empty.is_err());
}

#[tokio::test]
async fn calling_people_by_their_names_keeps_every_name_the_reader_gave() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after notes and highlights (structure change 34):
    // 1. a blog whose every article is Tomas Berg's, under the blog's title;
    // 2. the same kind of blog the reader renamed "My friend Tomas";
    // 3. a publication by one writer; 4. a blog by two writers;
    // 5. a blog with one unsigned article; 6. a blog signed "admin";
    // 7. Tomas's blog joined into a person the reader named "Tomas".
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(34, &old)
        .await
        .unwrap();
    sqlx::query("INSERT INTO writers (id, person_id, name, created_at) VALUES (1, 1, 'Tomas', 1)")
        .execute(&old)
        .await
        .unwrap();
    let blogs = [
        (
            1,
            "Notes from Tomas",
            "person",
            None,
            ["Tomas Berg", "tomas berg"],
        ),
        (
            2,
            "My friend Tomas",
            "person",
            None,
            ["Tomas Berg", "Tomas Berg"],
        ),
        (
            3,
            "The Gazette",
            "publication",
            None,
            ["Asha Rao", "Asha Rao"],
        ),
        (
            4,
            "Two of us",
            "person",
            None,
            ["Asha Rao", "Kai Ostrander"],
        ),
        (5, "Half signed", "person", None, ["Asha Rao", ""]),
        (6, "Site", "person", None, ["admin", "admin"]),
        (
            7,
            "Notes from Tomas",
            "person",
            Some(1),
            ["Tomas Berg", "Tomas Berg"],
        ),
    ];
    for (id, title, kind, writer, authors) in blogs {
        // The publisher's own title is the reader's, except where the reader renamed it.
        let feed_title = if id == 2 { "Notes from Tomas" } else { title };
        sqlx::query(
            "INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (?1, ?1, ?1, ?2, 1)",
        )
        .bind(id)
        .bind(feed_title)
        .execute(&old)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO subscriptions (person_id, feed_id, title, added_at, kind, writer_id)
             VALUES (1, ?, ?, 1, ?, ?)",
        )
        .bind(id)
        .bind(title)
        .bind(kind)
        .bind(writer)
        .execute(&old)
        .await
        .unwrap();
        for (number, author) in authors.iter().enumerate() {
            sqlx::query(
                "INSERT INTO articles (feed_id, fingerprint, title, author, received_at, sort_at)
                 VALUES (?, ?, 'A', ?, 1, 1)",
            )
            .bind(id)
            .bind(format!("{id}-{number}"))
            .bind(author)
            .execute(&old)
            .await
            .unwrap();
        }
    }
    old.close().await;

    // Nothing is renamed by the change itself; people on their own wait for their feed's next check.
    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let waiting: Vec<(String, bool)> =
        sqlx::query_as("SELECT title, name_pending FROM subscriptions ORDER BY feed_id")
            .fetch_all(&db)
            .await
            .unwrap();
    let pending: Vec<bool> = waiting.iter().map(|(_, pending)| *pending).collect();
    assert_eq!(pending, [true, true, false, true, true, true, false]);
    let kept: (i64, i64) =
        sqlx::query_as("SELECT (SELECT COUNT(*) FROM feeds), (SELECT COUNT(*) FROM articles)")
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(kept, (7, 14));

    // At the check: only the person still called by their blog's own title takes the author's name.
    let mut connection = db.acquire().await.unwrap();
    for feed in 1..=7 {
        nine_turtles::writers::kind::name_by_author(&mut connection, feed, None)
            .await
            .unwrap();
    }
    let names: Vec<(String, bool)> =
        sqlx::query_as("SELECT title, name_pending FROM subscriptions ORDER BY feed_id")
            .fetch_all(&mut *connection)
            .await
            .unwrap();
    let expected = [
        "Tomas Berg",
        "My friend Tomas",
        "The Gazette",
        "Two of us",
        "Half signed",
        "Site",
        "Notes from Tomas",
    ];
    assert_eq!(
        names,
        expected.map(|name| (name.to_owned(), false)).to_vec()
    );
}

#[tokio::test]
async fn looking_on_writers_sites_keeps_every_feed_and_address_and_has_looked_nowhere() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after people by their names (structure change 35):
    // a feed giving its own address, and one the reader typed an address for.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(35, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at, email)
         VALUES (1, 'u', 'u', 'Garden', 1, 'hal@garden.example'), (2, 'v', 'v', 'Shed', 1, NULL)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at, write_to)
         VALUES (1, 1, 'Garden', 1, NULL), (1, 2, 'Shed', 1, 'ivy@example.org')",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let feeds: Vec<(Option<String>, Option<i64>, Option<String>)> =
        sqlx::query_as("SELECT email, site_looked_at, site_email FROM feeds ORDER BY id")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(
        feeds,
        [
            (Some("hal@garden.example".to_owned()), None, None),
            (None, None, None)
        ]
    );
    let typed: Vec<Option<String>> =
        sqlx::query_scalar("SELECT write_to FROM subscriptions ORDER BY feed_id")
            .fetch_all(&db)
            .await
            .unwrap();
    assert_eq!(typed, [None, Some("ivy@example.org".to_owned())]);
}

#[tokio::test]
async fn ending_let_unread_go_marks_only_what_it_was_already_letting_go() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after looking on writers' sites (structure change
    // 36): reader 1 let unread go after a week, reader 2 never chose. Each
    // has an old unread article, a recent one, and a starred old one; reader
    // 1 also has an old one in a feed left (in its Undo time).
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(36, &old)
        .await
        .unwrap();
    // ?1 is two months ago, ?2 yesterday.
    let now = nine_turtles::now();
    for sql in [
        "INSERT INTO people (id, owner, email, created_at) VALUES (2, 0, 'kai@example.com', 1)",
        "INSERT INTO feeds (id, url, url_key, title, added_at)
         VALUES (1, 'u', 'u', 'Garden', 1), (2, 'v', 'v', 'Shed', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at, unsubscribed_at)
         VALUES (1, 1, 'Garden', 1, NULL), (1, 2, 'Shed', 1, ?2), (2, 1, 'Garden', 1, NULL)",
        "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
         VALUES (1, 1, 'a', 'Old', 1, ?1), (2, 1, 'b', 'New', 1, ?2),
                (3, 1, 'c', 'Kept', 1, ?1), (4, 2, 'd', 'Left', 1, ?1)",
        "INSERT INTO entries (person_id, article_id, feed_id, sort_at, read, starred)
         VALUES (1, 1, 1, ?1, 0, 0), (1, 2, 1, ?2, 0, 0), (1, 3, 1, ?1, 0, 1), (1, 4, 2, ?1, 0, 0),
                (2, 1, 1, ?1, 0, 0), (2, 2, 1, ?2, 0, 0), (2, 3, 1, ?1, 0, 1)",
        "INSERT INTO person_settings (person_id, name, value)
         VALUES (1, 'let_go', 'week'), (1, 'let_go_at', '1'), (1, 'sort', 'oldest'),
                (2, 'let_go', 'never'), (2, 'let_go_at', '1')",
    ] {
        sqlx::query(sql)
            .bind(now - 60 * 86_400)
            .bind(now - 86_400)
            .execute(&old)
            .await
            .unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let entries: Vec<(i64, i64, bool, bool)> = sqlx::query_as(
        "SELECT person_id, article_id, read, starred FROM entries ORDER BY person_id, article_id",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(
        entries,
        [
            // Reader 1: what the week had let go stays read (starred too), as the
            // background round did; yesterday's and the feed left are untouched.
            (1, 1, true, false),
            (1, 2, false, false),
            (1, 3, true, true),
            (1, 4, false, false),
            // Reader 2 never chose: nothing changes.
            (2, 1, false, false),
            (2, 2, false, false),
            (2, 3, false, true),
        ]
    );
    // The setting is gone; every other setting stays.
    let settings: Vec<(i64, String, String)> = sqlx::query_as(
        "SELECT person_id, name, value FROM person_settings ORDER BY person_id, name",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(settings, [(1, "sort".to_owned(), "oldest".to_owned())]);
}

#[tokio::test]
async fn unread_on_or_off_keeps_every_choice_and_marks_only_what_flowed_past() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after ending "Let unread go" (structure change 37):
    // reader 1 reads as an inbox with one feed set to flow past (river);
    // reader 2 chose river for the whole app. Each has unread, read and
    // starred articles.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(37, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO people (id, owner, email, created_at) VALUES (2, 0, 'kai@example.com', 1)",
        "INSERT INTO feeds (id, url, url_key, title, added_at)
         VALUES (1, 'u', 'u', 'Garden', 1), (2, 'v', 'v', 'Shed', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at, river, open_on_site)
         VALUES (1, 1, 'Garden', 1, 0, 1), (1, 2, 'Shed', 1, 1, 0), (2, 2, 'Shed', 1, 0, 0)",
        "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
         VALUES (1, 1, 'a', 'Rose', 1, 1), (2, 2, 'b', 'Spade', 1, 2), (3, 2, 'c', 'Rake', 1, 3)",
        "INSERT INTO entries (person_id, article_id, feed_id, sort_at, read, starred)
         VALUES (1, 1, 1, 1, 0, 0), (1, 2, 2, 2, 0, 1), (1, 3, 2, 3, 1, 0),
                (2, 2, 2, 2, 0, 0), (2, 3, 2, 3, 0, 1)",
        "INSERT INTO person_settings (person_id, name, value)
         VALUES (1, 'mode', 'inbox'), (1, 'sort', 'oldest'), (2, 'mode', 'river')",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let entries: Vec<(i64, i64, bool, bool)> = sqlx::query_as(
        "SELECT person_id, article_id, read, starred FROM entries ORDER BY person_id, article_id",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(
        entries,
        [
            // Reader 1: the feed that flowed past has nothing unread now
            // (its star stays); the other feed is untouched.
            (1, 1, false, false),
            (1, 2, true, true),
            (1, 3, true, false),
            // Reader 2 follows the same feed as an ordinary one: untouched.
            (2, 2, false, false),
            (2, 3, false, true),
        ]
    );
    // River became Unread off; inbox needs nothing stored.
    let settings: Vec<(i64, String, String)> = sqlx::query_as(
        "SELECT person_id, name, value FROM person_settings ORDER BY person_id, name",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(
        settings,
        [
            (1, "sort".to_owned(), "oldest".to_owned()),
            (2, "unread".to_owned(), "off".to_owned())
        ]
    );
    // The column is gone; every other setting of each feed stays.
    let columns: Vec<String> =
        sqlx::query_scalar("SELECT name FROM pragma_table_info('subscriptions')")
            .fetch_all(&db)
            .await
            .unwrap();
    assert!(!columns.iter().any(|column| column == "river"));
    let open: Vec<(i64, i64, bool)> = sqlx::query_as(
        "SELECT person_id, feed_id, open_on_site FROM subscriptions ORDER BY person_id, feed_id",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(open, [(1, 1, true), (1, 2, false), (2, 2, false)]);
}

#[tokio::test]
async fn hiding_articles_about_keeps_every_rule_and_spreads_a_folders_rule_to_its_people() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after "Unread, on or off" (structure change 38).
    // Reader 1 follows Garden and Shed (one person, Alpha) and Pond (on its
    // own), all in the folder Home, and Barn outside it. Their rules: a mute
    // for one feed and one for everyone (these fit); a mute for Home (one
    // rule per person in it, after); a mute for an empty folder; a star
    // rule, a mark-read rule and a mute with an author (switched off, kept).
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(38, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO feeds (id, url, url_key, title, added_at)
         VALUES (1, 'u', 'u', 'Garden', 1), (2, 'v', 'v', 'Shed', 1), (3, 'w', 'w', 'Pond', 1),
                (4, 'x', 'x', 'Barn', 1)",
        "INSERT INTO writers (id, person_id, name, created_at) VALUES (1, 1, 'Alpha', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at, writer_id)
         VALUES (1, 1, 'Garden', 1, 1), (1, 2, 'Shed', 1, 1), (1, 3, 'Pond', 1, NULL),
                (1, 4, 'Barn', 1, NULL)",
        "INSERT INTO folders (id, person_id, name) VALUES (5, 1, 'Home'), (6, 1, 'Empty')",
        "INSERT INTO feed_folders (folder_id, feed_id) VALUES (5, 1), (5, 2), (5, 3)",
        "INSERT INTO rules (id, person_id, words, title_only, author, feed_id, folder_id, action,
             paused, created_at)
         VALUES (1, 1, 'crypto', 0, '', 4, NULL, 'mute', 0, 1),
                (2, 1, 'sponsored', 1, '', NULL, NULL, 'mute', 0, 2),
                (3, 1, 'football', 0, '', NULL, 5, 'mute', 1, 3),
                (4, 1, 'golf', 0, '', NULL, 6, 'mute', 0, 4),
                (5, 1, 'garden', 0, '', NULL, NULL, 'star', 0, 5),
                (6, 1, 'news', 0, '', 4, NULL, 'read', 0, 6),
                (7, 1, '', 0, 'Jane', NULL, 5, 'mute', 0, 7)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = upgraded_to(&data_dir, 39).await;
    type Line = (
        String,
        bool,
        String,
        Option<i64>,
        Option<i64>,
        bool,
        String,
        bool,
    );
    let rules: Vec<Line> = sqlx::query_as(
        "SELECT words, title_only, author, feed_id, folder_id, place_gone, action, paused
         FROM rules ORDER BY id",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    let line = |words: &str, title_only, author: &str, feed, folder, gone, action: &str, paused| {
        (
            words.to_owned(),
            title_only,
            author.to_owned(),
            feed,
            folder,
            gone,
            action.to_owned(),
            paused,
        )
    };
    assert_eq!(
        rules,
        [
            // The two that fit, as they were.
            line("crypto", false, "", Some(4), None, false, "mute", false),
            line("sponsored", true, "", None, None, false, "mute", false),
            // The empty folder's rule matches nothing, as before.
            line("golf", false, "", None, None, true, "mute", false),
            // Kept, untouched; nine turtles no longer shows or runs them.
            line("garden", false, "", None, None, false, "star", false),
            line("news", false, "", Some(4), None, false, "read", false),
            line("", false, "Jane", None, Some(5), false, "mute", false),
            // Home's rule became one per person in it, paused as it was:
            // Alpha (by Garden, standing for Shed too), then Pond.
            line("football", false, "", Some(1), None, false, "mute", true),
            line("football", false, "", Some(3), None, false, "mute", true),
        ]
    );
    // Every feed is still followed, in its folder.
    let pairs: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM feed_folders")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(pairs, 3);
}

#[tokio::test]
async fn keeping_starred_deletes_what_is_gone_and_leaves_every_mark() {
    let data_dir = common::config().data_dir;
    std::fs::create_dir_all(&data_dir).unwrap();

    // The database just after "Hide articles about…" (structure change 39).
    // Reader 1 has three articles: one on the collection Soup, one starred
    // and on Soup too, and one on no collection. Reader 2 has the first
    // article too, on no collection of theirs. Reader 1 has a saved search,
    // an opened article, an Up Next line, old keys and settings, and four
    // rules: one that runs and three switched off in step 8.
    let old = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(nine_turtles::db::path(&data_dir))
                .create_if_missing(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run_to(39, &old)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO people (id, owner, email, created_at) VALUES (2, 0, 'kai@example.com', 1)",
        "INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (1, 'u', 'u', 'Radio', 1)",
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at)
         VALUES (1, 1, 'Radio', 1), (2, 1, 'Radio', 1)",
        "INSERT INTO articles (id, feed_id, fingerprint, title, received_at, sort_at)
         VALUES (1, 1, 'a', 'A', 1, 1), (2, 1, 'b', 'B', 2, 2), (3, 1, 'c', 'C', 3, 3)",
        "INSERT INTO entries (person_id, article_id, feed_id, sort_at, read, starred,
             starred_marked_at)
         VALUES (1, 1, 1, 1, 1, 0, 0), (1, 2, 1, 2, 0, 1, 7), (1, 3, 1, 3, 0, 0, 0),
                (2, 1, 1, 1, 0, 0, 0)",
        "INSERT INTO collections (id, person_id, name, created_at) VALUES (1, 1, 'Soup', 0)",
        "INSERT INTO collection_articles (collection_id, person_id, article_id, added_at)
         VALUES (1, 1, 1, 0), (1, 1, 2, 0)",
        "INSERT INTO saved_searches (person_id, name, query, created_at)
         VALUES (1, 'Walks', '{\"words\":\"walking\"}', 0)",
        "UPDATE entries SET opened_at = 5 WHERE person_id = 1 AND article_id = 3",
        "INSERT INTO up_next (person_id, article_id, place) VALUES (1, 3, 1)",
        "INSERT INTO person_settings (person_id, name, value)
         VALUES (1, 'keys', '{\"star\":\"x\"}'), (1, 'mode', 'river'), (1, 'sort', 'oldest')",
        "INSERT INTO rules (id, person_id, words, author, folder_id, action, created_at)
         VALUES (1, 1, 'Sponsored', '', NULL, 'mute', 0), (2, 1, '', 'Ann', NULL, 'mute', 0),
                (3, 1, 'Soup', '', 9, 'mute', 0), (4, 1, 'Soup', '', NULL, 'star', 0)",
    ] {
        sqlx::query(sql).execute(&old).await.unwrap();
    }
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let entries: Vec<(i64, i64, bool, bool, bool)> = sqlx::query_as(
        "SELECT person_id, article_id, read, starred, starred_marked_at > 1000000000000
         FROM entries ORDER BY person_id, article_id",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(
        entries,
        [
            // On Soup: as it was (nothing is carried over, the owner, 4 November 2026).
            (1, 1, true, false, false),
            // Already starred: as it was, its star's time too.
            (1, 2, false, true, false),
            // On no collection: unstarred, as it was.
            (1, 3, false, false, false),
            // Another reader's line for it: theirs, unstarred.
            (2, 1, false, false, false),
        ]
    );
    // Collections, saved searches, Up Next and opening times are gone.
    let tables: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_schema WHERE name IN
             ('collections', 'collection_articles', 'saved_searches', 'up_next', 'entries_opened')",
    )
    .fetch_all(&db)
    .await
    .unwrap();
    assert!(tables.is_empty(), "{tables:?}");
    let opened: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('entries') WHERE name = 'opened_at'",
    )
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(opened, 0);
    // Only the rule that runs is left, and only the settings still read.
    let rules: Vec<i64> = sqlx::query_scalar("SELECT id FROM rules ORDER BY id")
        .fetch_all(&db)
        .await
        .unwrap();
    assert_eq!(rules, [1]);
    let settings: Vec<String> =
        sqlx::query_scalar("SELECT name FROM person_settings WHERE person_id = 1 ORDER BY name")
            .fetch_all(&db)
            .await
            .unwrap();
    assert!(
        !settings.iter().any(|name| name == "keys" || name == "mode"),
        "{settings:?}"
    );
    assert!(settings.iter().any(|name| name == "sort"), "{settings:?}");
}
