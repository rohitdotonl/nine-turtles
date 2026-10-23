//! Speed tests on a made-up library the size of a heavy reader's: 500 feeds
//! and a year of articles (ENGINEERING.md → "Fast by design"). Every later
//! milestone adds its own questions here, so slowness is caught by the
//! computer, not noticed by the reader.

mod common;

use std::time::{Duration, Instant};

use slowfeed::{
    checking::DUE,
    feeds::{FEEDS, LATEST, List, Order, list_sql, new_sql, page},
    search::{Search, find},
};
use sqlx::SqlitePool;

const FEEDS_COUNT: i64 = 500;
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
    for feed in 1..=FEEDS_COUNT {
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
    for feed in 1..=FEEDS_COUNT {
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
    // Folders, as if an OPML file was imported: every tenth feed in "Big",
    // feed 250 alone in "Small", the rest in "Other".
    for (folder, name) in [(1, "Big"), (2, "Small"), (3, "Other")] {
        sqlx::query("INSERT INTO folders (id, name) VALUES (?, ?)")
            .bind(folder)
            .bind(name)
            .execute(&mut *transaction)
            .await
            .unwrap();
    }
    for feed in 1..=FEEDS_COUNT {
        let folder = match feed {
            250 => 2,
            _ if feed % 10 == 0 => 1,
            _ => 3,
        };
        sqlx::query("INSERT INTO feed_folders (folder_id, feed_id) VALUES (?, ?)")
            .bind(folder)
            .bind(feed)
            .execute(&mut *transaction)
            .await
            .unwrap();
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
    assert_eq!(total, FEEDS_COUNT * ARTICLES_PER_FEED);

    // A reader who keeps up: everything older than a month is read, and one
    // article in fifty is starred.
    sqlx::query("UPDATE articles SET read = 1 WHERE sort_at < ?")
        .bind(NOW - YEAR / 12)
        .execute(&db)
        .await
        .unwrap();
    sqlx::query("UPDATE articles SET starred = 1 WHERE id % 50 = 0")
        .execute(&db)
        .await
        .unwrap();
    sqlx::query("ANALYZE").execute(&db).await.unwrap();

    // Every list, in both orders, always uses its index, never a full read
    // of every article or a sort done on the spot.
    for (list, index) in [
        (List::All, "articles_newest"),
        (List::Unread, "articles_unread"),
        (List::Starred, "articles_starred"),
        (List::Feed(250), "articles_newest_by_feed"),
        (List::Folder(1), "articles_newest"),
    ] {
        for order in [Order::Newest, Order::Oldest] {
            let mut binds = match list {
                List::Feed(id) | List::Folder(id) => vec![id],
                _ => vec![],
            };
            binds.extend([i64::MAX, i64::MAX, 51]);
            let plan = plan(&db, list_sql(list, order), &binds).await;
            assert!(
                plan.contains(&format!("INDEX {index} ")),
                "{list:?} {order:?}: {plan}"
            );
            assert!(!plan.contains("TEMP B-TREE"), "{list:?} {order:?}: {plan}");
        }
    }
    // The sidebar's unread counts come from their own small index.
    let counts = plan(&db, FEEDS, &[]).await;
    assert!(counts.contains("INDEX articles_unread_by_feed"), "{counts}");

    let mut timings = Vec::new();
    let mut time = async |what: &'static str, list: List, order: Order, after| {
        let started = Instant::now();
        let (articles, next) = page(&db, list, order, after).await.unwrap();
        timings.push((what, started.elapsed()));
        (articles, next)
    };

    // First page, a page deep in the past, one feed, Unread, Starred, and
    // oldest first.
    let (articles, next) = time("first page", List::All, Order::Newest, None).await;
    assert_eq!(articles.len(), 50);
    assert!(next.is_some());
    let (deep, _) = time(
        "deep page",
        List::All,
        Order::Newest,
        Some((NOW - YEAR / 2, i64::MAX)),
    )
    .await;
    assert_eq!(deep.len(), 50);
    let (one_feed, _) = time("one feed", List::Feed(250), Order::Newest, None).await;
    assert!(one_feed.iter().all(|article| article.feed_id == 250));
    // A folder of 49 feeds, and one holding a single feed: the hardest
    // case, since most articles walked past belong to other feeds.
    let (big_folder, _) = time("big folder", List::Folder(1), Order::Newest, None).await;
    assert_eq!(big_folder.len(), 50);
    assert!(big_folder.iter().all(|article| article.feed_id % 10 == 0));
    let (small_folder, _) = time("small folder", List::Folder(2), Order::Newest, None).await;
    assert!(small_folder.iter().all(|article| article.feed_id == 250));
    let (small_deep, _) = time(
        "small folder, deep",
        List::Folder(2),
        Order::Newest,
        Some((NOW - YEAR / 2, i64::MAX)),
    )
    .await;
    assert_eq!(small_deep.len(), 50);
    let (unread, _) = time("unread", List::Unread, Order::Newest, None).await;
    assert_eq!(unread.len(), 50);
    assert!(unread.iter().all(|article| !article.read));
    let (starred, _) = time("starred", List::Starred, Order::Newest, None).await;
    assert_eq!(starred.len(), 50);
    assert!(starred.iter().all(|article| article.starred));
    let (oldest_unread, _) = time("oldest unread", List::Unread, Order::Oldest, None).await;
    assert!(
        oldest_unread
            .windows(2)
            .all(|pair| pair[0].at <= pair[1].at)
    );

    // The sidebar's counts, for a reader who keeps up and for one who has
    // read nothing at all (every article counted).
    for (what, read_before) in [
        ("counts", NOW - YEAR / 12),
        ("counts, nothing read", i64::MIN),
    ] {
        sqlx::query("UPDATE articles SET read = (sort_at < ?)")
            .bind(read_before)
            .execute(&db)
            .await
            .unwrap();
        let started = Instant::now();
        let rows = sqlx::query(FEEDS).fetch_all(&db).await.unwrap();
        timings.push((what, started.elapsed()));
        assert_eq!(rows.len(), 500);
    }

    // "New items · press r": each list asks only about articles that arrived
    // since it was loaded, by number, never reading the whole year.
    let since: i64 = sqlx::query_scalar(LATEST).fetch_one(&db).await.unwrap();
    for list in [List::All, List::Unread, List::Feed(250), List::Folder(1)] {
        let sql = new_sql(list).unwrap();
        let binds = match list {
            List::Feed(id) | List::Folder(id) => vec![since - 1000, id],
            _ => vec![since - 1000],
        };
        let plan = plan(&db, sql, &binds).await;
        assert!(
            plan.contains("INTEGER PRIMARY KEY (rowid>?)"),
            "{list:?}: {plan}"
        );
        let started = Instant::now();
        let mut question = sqlx::query_scalar::<_, bool>(sql).bind(since - 1000);
        if let List::Feed(id) | List::Folder(id) = list {
            question = question.bind(id);
        }
        question.fetch_one(&db).await.unwrap();
        timings.push(("new items", started.elapsed()));
    }
    let latest = plan(&db, LATEST, &[]).await;
    assert!(!latest.contains("SCAN articles"), "{latest}");
    // Background checking finds the feeds due from its own index.
    let due = plan(&db, DUE, &[NOW, 20]).await;
    assert!(due.contains("INDEX feeds_due"), "{due}");
    assert!(!due.contains("TEMP B-TREE"), "{due}");

    for (what, took) in timings {
        assert!(took < FAST_ENOUGH, "{what} took {took:?}");
    }
}

/// A search for a word found in every one of the 100,000 articles reads
/// the whole of the index's list for that word, then picks the newest 50.
/// That takes 40 to 70 ms in the real (release) build, about three times
/// that in the slower test build, so it is allowed this long here, with room
/// for a slow test computer. Everything else must
/// be FAST_ENOUGH.
const WORD_IN_EVERY_ARTICLE: Duration = Duration::from_millis(400);

#[tokio::test]
async fn search_is_fast_with_500_feeds_and_a_year_of_articles() {
    let db = big_library().await;
    // A word in one title in a hundred, and one in a tenth of the titles;
    // every article shares the rest of its words.
    sqlx::query("UPDATE articles SET title = title || ' about tomatoes' WHERE id % 100 = 0")
        .execute(&db)
        .await
        .unwrap();
    sqlx::query("UPDATE articles SET title = title || ' on gardening' WHERE id % 10 = 3")
        .execute(&db)
        .await
        .unwrap();
    sqlx::query("UPDATE articles SET starred = 1 WHERE id % 50 = 0")
        .execute(&db)
        .await
        .unwrap();
    let started = Instant::now();
    let indexed = slowfeed::search::index_missing(&db).await.unwrap();
    let catching_up = started.elapsed();
    assert_eq!(
        indexed,
        usize::try_from(FEEDS_COUNT * ARTICLES_PER_FEED).unwrap()
    );

    let words = |q: &str| Search {
        q: q.into(),
        ..Search::default()
    };
    let mut timings = Vec::new();
    for (what, search, allowed) in [
        ("a rare word", words("tomatoes"), FAST_ENOUGH),
        (
            "a word in a tenth of the articles",
            words("gardening"),
            FAST_ENOUGH,
        ),
        ("the start of a word", words("garden"), FAST_ENOUGH),
        (
            "a rare word and a common one",
            words("tomatoes paragraph"),
            FAST_ENOUGH,
        ),
        (
            "a word in a feed",
            Search {
                feed: Some(300),
                ..words("tomatoes")
            },
            FAST_ENOUGH,
        ),
        (
            "unread only",
            Search {
                unread: true,
                ..words("gardening")
            },
            FAST_ENOUGH,
        ),
        (
            "starred only, no words",
            Search {
                starred: true,
                ..Search::default()
            },
            FAST_ENOUGH,
        ),
        (
            "a date range, no words",
            Search {
                since: Some(NOW - YEAR / 2),
                until: Some(NOW - YEAR / 3),
                ..Search::default()
            },
            FAST_ENOUGH,
        ),
        (
            "a word in every article",
            words("paragraph"),
            WORD_IN_EVERY_ARTICLE,
        ),
        (
            "two words in every article",
            words("made-up text"),
            WORD_IN_EVERY_ARTICLE,
        ),
        (
            "a word in every article, in a folder",
            Search {
                folder: Some(1),
                ..words("paragraph")
            },
            WORD_IN_EVERY_ARTICLE,
        ),
    ] {
        let started = Instant::now();
        let (articles, _) = find(&db, &search).await.unwrap().unwrap();
        timings.push((what, started.elapsed(), allowed));
        assert!(!articles.is_empty(), "{what}");
    }
    eprintln!("catching up {indexed} articles took {catching_up:?}; {timings:?}");
    for (what, took, allowed) in timings {
        assert!(took < allowed, "{what} took {took:?}");
    }
}
