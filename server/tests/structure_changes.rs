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
    // Every feed behaves as before: inbox, its own rhythm, read in nine turtles.
    assert_eq!(
        count(
            "SELECT COUNT(*) FROM subscriptions WHERE river = 0 AND check_at_most = 0 AND open_on_site = 0"
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
    // the marks it had.
    assert_eq!(count("SELECT COUNT(*) FROM articles").await.unwrap(), 122);
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
    type Subscription = (i64, String, i64, Option<i64>, bool, bool, i64, bool);
    let subscriptions: Vec<Subscription> = sqlx::query_as(
        "SELECT feed_id, title, added_at, unsubscribed_at, cleared, river, check_at_most,
             open_on_site
         FROM subscriptions WHERE person_id = 1 ORDER BY feed_id",
    )
    .fetch_all(db)
    .await
    .unwrap();
    assert_eq!(
        subscriptions,
        [
            (
                1,
                "My renamed blog".into(),
                10,
                None,
                false,
                true,
                3600,
                true
            ),
            (2, "Blog 2".into(), 20, None, false, false, 0, false),
            (3, "Blog 3".into(), 30, None, false, false, 86_400, false),
            (
                4,
                "Just left".into(),
                40,
                Some(now - 60),
                false,
                false,
                0,
                true
            ),
            (
                5,
                "Cleared, stars kept".into(),
                50,
                Some(now - 86_400),
                true,
                false,
                0,
                false
            ),
            (6, "Nothing yet".into(), 60, None, false, false, 0, false),
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
        ("SELECT COUNT(*) FROM saved_searches", 1),
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
    assert_eq!(feeds[2]["river"], true);
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
    old.close().await;

    let db = nine_turtles::db::open(&data_dir).await.unwrap();
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
