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

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
    let count = |sql: &'static str| sqlx::query_scalar::<_, i64>(sql).fetch_one(&db);
    assert_eq!(count("SELECT COUNT(*) FROM feeds").await.unwrap(), 10);
    assert_eq!(count("SELECT COUNT(*) FROM folders").await.unwrap(), 2);
    assert_eq!(
        count("SELECT COUNT(*) FROM feed_folders").await.unwrap(),
        10
    );
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
    // Every feed behaves as before: inbox, its own rhythm, read in nine turtles.
    assert_eq!(
        count(
            "SELECT COUNT(*) FROM feeds WHERE river = 0 AND check_at_most = 0 AND open_on_site = 0"
        )
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
    // Nothing is muted, and there are no rules, until the reader makes one.
    assert_eq!(
        count("SELECT COUNT(*) FROM articles WHERE muted = 1")
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

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
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
            (1, "mode".to_owned(), "river".to_owned()),
            (1, "sort".to_owned(), "oldest".to_owned())
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
