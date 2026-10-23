//! Speed tests on a made-up library the size of a heavy reader's: 500 feeds
//! and a year of articles (ENGINEERING.md → "Fast by design"). Every later
//! milestone adds its own questions here, so slowness is caught by the
//! computer, not noticed by the reader.

mod common;

use std::time::{Duration, Instant};

use slowfeed::feeds::{ALL_FEEDS, ONE_FEED, page};
use sqlx::SqlitePool;

const FEEDS: i64 = 500;
/// About one article every other day per feed, for a year.
const ARTICLES_PER_FEED: i64 = 200;
const YEAR: i64 = 365 * 24 * 60 * 60;
const NOW: i64 = 1_790_000_000;
/// Well inside the "under a tenth of a second" every action must feel like,
/// even in the slower test build.
const FAST_ENOUGH: Duration = Duration::from_millis(100);

/// Builds the made-up library in a fresh database file.
async fn big_library() -> SqlitePool {
    let db = slowfeed::db::open(&common::config().data_dir)
        .await
        .unwrap();
    let mut transaction = db.begin().await.unwrap();
    for feed in 1..=FEEDS {
        sqlx::query("INSERT INTO feeds (id, url, url_key, title, added_at) VALUES (?, ?, ?, ?, ?)")
            .bind(feed)
            .bind(format!("https://blog-{feed}.example/feed"))
            .bind(format!("blog-{feed}.example/feed"))
            .bind(format!("Blog {feed}"))
            .bind(NOW - YEAR)
            .execute(&mut *transaction)
            .await
            .unwrap();
    }
    for feed in 1..=FEEDS {
        for number in 0..ARTICLES_PER_FEED {
            // Spread over the year, never two feeds in step.
            let at = NOW - (number * YEAR / ARTICLES_PER_FEED) - feed * 97;
            sqlx::query(
                "INSERT INTO articles (feed_id, fingerprint, title, link, summary, received_at, sort_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(feed)
            .bind(format!("id:{feed}-{number}"))
            .bind(format!("Article {number} from blog {feed}"))
            .bind(format!("https://blog-{feed}.example/{number}"))
            .bind("<p>A paragraph of made-up text, about as long as a short summary.</p>")
            .bind(at)
            .bind(at)
            .execute(&mut *transaction)
            .await
            .unwrap();
        }
    }
    transaction.commit().await.unwrap();
    sqlx::query("ANALYZE").execute(&db).await.unwrap();
    db
}

/// How the database plans to answer, as its own words.
async fn plan(db: &SqlitePool, sql: &str, binds: &[i64]) -> String {
    let explain = format!("EXPLAIN QUERY PLAN {sql}");
    let mut query = sqlx::query_as::<_, (i64, i64, i64, String)>(sqlx::AssertSqlSafe(explain));
    for value in binds {
        query = query.bind(*value);
    }
    let rows = query.fetch_all(db).await.unwrap();
    rows.into_iter()
        .map(|row| row.3)
        .collect::<Vec<_>>()
        .join("; ")
}

#[tokio::test]
async fn the_item_list_is_fast_with_500_feeds_and_a_year_of_articles() {
    let db = big_library().await;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM articles")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(total, FEEDS * ARTICLES_PER_FEED);

    // The list's questions always use an index, never a full read of every
    // article or a sort done on the spot.
    for (sql, binds) in [
        (ALL_FEEDS, vec![i64::MAX, i64::MAX, 51]),
        (ONE_FEED, vec![250, i64::MAX, i64::MAX, 51]),
    ] {
        let plan = plan(&db, sql, &binds).await;
        assert!(
            plan.contains("USING INDEX articles_newest")
                || plan.contains("USING COVERING INDEX articles_newest"),
            "{plan}"
        );
        assert!(!plan.contains("TEMP B-TREE"), "{plan}");
    }

    // First page, a page deep in the past, and one feed's page.
    let first = Instant::now();
    let (articles, older) = page(&db, None, None).await.unwrap();
    let first = first.elapsed();
    assert_eq!(articles.len(), 50);

    let deep = Instant::now();
    let (deep_articles, _) = page(&db, None, Some((NOW - YEAR / 2, i64::MAX)))
        .await
        .unwrap();
    let deep = deep.elapsed();
    assert_eq!(deep_articles.len(), 50);
    assert!(older.is_some());

    let one = Instant::now();
    let (one_feed, _) = page(&db, Some(250), None).await.unwrap();
    let one = one.elapsed();
    assert!(one_feed.iter().all(|article| article.feed_id == 250));

    for (what, took) in [
        ("first page", first),
        ("deep page", deep),
        ("one feed", one),
    ] {
        assert!(took < FAST_ENOUGH, "{what} took {took:?}");
    }
}
