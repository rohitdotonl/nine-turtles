//! The yearly clean-up (SPEC section 23, decision 0089): unstarred articles
//! go a year after nine turtles first received them, starred ones stay
//! forever, and a removed article its feed still lists never comes back as
//! new.

mod common;

use nine_turtles::{AppState, cleanup, feed::ParsedArticle, feeds};

const DAY: i64 = 86_400;
/// "Now" in these tests: 1 January 2028.
const NOW: i64 = 1_830_297_600;

fn article(fingerprint: &str) -> ParsedArticle {
    ParsedArticle {
        fingerprint: fingerprint.to_owned(),
        title: format!("Post {fingerprint}"),
        link: None,
        author: None,
        content: None,
        summary: None,
        language: None,
        published_at: None,
        episode: None,
    }
}

/// A feed followed by these readers. Answers its number.
async fn feed(state: &AppState, name: &str, readers: &[i64]) -> i64 {
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO feeds (url, url_key, title, added_at) VALUES (?1, ?1, ?2, 0) RETURNING id",
    )
    .bind(format!("https://{name}.example/feed"))
    .bind(name)
    .fetch_one(&state.db)
    .await
    .unwrap();
    for reader in readers {
        sqlx::query(
            "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (?, ?, ?, 0)",
        )
        .bind(reader)
        .bind(id)
        .bind(name)
        .execute(&state.db)
        .await
        .unwrap();
    }
    id
}

/// Stores these articles as received `days_ago` days before `NOW`.
async fn receive(state: &AppState, feed: i64, fingerprints: &[&str], days_ago: i64) {
    let articles: Vec<ParsedArticle> = fingerprints.iter().map(|f| article(f)).collect();
    let mut transaction = state.db.begin().await.unwrap();
    feeds::store_articles(&mut transaction, feed, &articles, NOW - days_ago * DAY)
        .await
        .unwrap();
    transaction.commit().await.unwrap();
}

async fn mark(state: &AppState, reader: i64, fingerprint: &str, column: &str) {
    let sql = match column {
        "read" => {
            "UPDATE entries SET read = 1 WHERE person_id = ?
             AND article_id = (SELECT id FROM articles WHERE fingerprint = ?)"
        }
        _ => {
            "UPDATE entries SET starred = 1 WHERE person_id = ?
             AND article_id = (SELECT id FROM articles WHERE fingerprint = ?)"
        }
    };
    sqlx::query(sql)
        .bind(reader)
        .bind(fingerprint)
        .execute(&state.db)
        .await
        .unwrap();
}

async fn articles(state: &AppState) -> Vec<String> {
    sqlx::query_scalar("SELECT fingerprint FROM articles ORDER BY fingerprint")
        .fetch_all(&state.db)
        .await
        .unwrap()
}

async fn entries(state: &AppState, reader: i64) -> Vec<String> {
    sqlx::query_scalar(
        "SELECT articles.fingerprint FROM entries JOIN articles ON articles.id = entries.article_id
         WHERE entries.person_id = ? ORDER BY articles.fingerprint",
    )
    .bind(reader)
    .fetch_all(&state.db)
    .await
    .unwrap()
}

async fn count(state: &AppState, sql: &'static str) -> i64 {
    sqlx::query_scalar(sql).fetch_one(&state.db).await.unwrap()
}

#[tokio::test]
async fn unstarred_articles_go_after_a_year_and_starred_ones_stay() {
    let (_, state) = common::start_with_state(common::config()).await;
    let garden = feed(&state, "garden", &[1]).await;
    receive(
        &state,
        garden,
        &["old-read", "old-unread", "old-starred"],
        400,
    )
    .await;
    receive(&state, garden, &["almost-a-year"], 364).await;
    receive(&state, garden, &["new"], 1).await;
    mark(&state, 1, "old-read", "read").await;
    mark(&state, 1, "old-starred", "starred").await;

    let removed = cleanup::run(&state.db, NOW).await.unwrap();
    assert_eq!(
        removed,
        cleanup::Removed {
            entries: 2,
            articles: 2
        }
    );
    assert_eq!(
        articles(&state).await,
        ["almost-a-year", "new", "old-starred"]
    );
    assert_eq!(
        entries(&state, 1).await,
        ["almost-a-year", "new", "old-starred"]
    );
    // Their words leave search too.
    assert_eq!(
        count(&state, "SELECT COUNT(*) FROM articles_search").await,
        3
    );

    // Running again the same night finds nothing more.
    assert_eq!(
        cleanup::run(&state.db, NOW).await.unwrap(),
        cleanup::Removed::default()
    );
}

#[tokio::test]
async fn a_removed_article_the_feed_still_lists_never_comes_back_as_new() {
    let (_, state) = common::start_with_state(common::config()).await;
    let garden = feed(&state, "garden", &[1]).await;
    receive(&state, garden, &["old"], 400).await;
    cleanup::run(&state.db, NOW).await.unwrap();
    assert!(articles(&state).await.is_empty());

    // The publisher still lists it next to a new post: only the new one comes in.
    receive(&state, garden, &["old", "fresh"], 0).await;
    assert_eq!(articles(&state).await, ["fresh"]);
    assert_eq!(entries(&state, 1).await, ["fresh"]);
}

#[tokio::test]
async fn one_readers_star_keeps_the_article_only_for_them() {
    let (_, state) = common::start_with_state(common::config()).await;
    let (other, _) = common::another_reader(&state).await;
    let garden = feed(&state, "garden", &[1, other]).await;
    receive(&state, garden, &["shared"], 400).await;
    mark(&state, other, "shared", "starred").await;

    cleanup::run(&state.db, NOW).await.unwrap();
    assert_eq!(articles(&state).await, ["shared"]);
    assert!(entries(&state, 1).await.is_empty());
    assert_eq!(entries(&state, other).await, ["shared"]);

    // Once they unstar it, the next night's clean-up removes it.
    sqlx::query("UPDATE entries SET starred = 0")
        .execute(&state.db)
        .await
        .unwrap();
    cleanup::run(&state.db, NOW + DAY).await.unwrap();
    assert!(articles(&state).await.is_empty());
}

#[tokio::test]
async fn an_article_on_a_collection_is_kept_like_a_starred_one_for_its_reader_only() {
    let (_, state) = common::start_with_state(common::config()).await;
    let (other, _) = common::another_reader(&state).await;
    let garden = feed(&state, "garden", &[1, other]).await;
    receive(&state, garden, &["kept", "gone"], 400).await;
    let shelf: i64 = sqlx::query_scalar(
        "INSERT INTO collections (person_id, name, created_at) VALUES (1, 'Recipes', 0) RETURNING id",
    )
    .fetch_one(&state.db)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO collection_articles (collection_id, person_id, article_id, added_at)
         SELECT ?, 1, id, 0 FROM articles WHERE fingerprint = 'kept'",
    )
    .bind(shelf)
    .execute(&state.db)
    .await
    .unwrap();

    cleanup::run(&state.db, NOW).await.unwrap();
    assert_eq!(articles(&state).await, ["kept"]);
    assert_eq!(entries(&state, 1).await, ["kept"]);
    // The other reader's line for it goes: a collection keeps it only for its reader.
    assert!(entries(&state, other).await.is_empty());

    // Taken off the collection (here, the collection deleted), the next night removes it.
    sqlx::query("DELETE FROM collections")
        .execute(&state.db)
        .await
        .unwrap();
    cleanup::run(&state.db, NOW + DAY).await.unwrap();
    assert!(articles(&state).await.is_empty());
}

#[tokio::test]
async fn article_numbers_freed_by_the_clean_up_are_never_given_again() {
    let (_, state) = common::start_with_state(common::config()).await;
    let garden = feed(&state, "garden", &[1]).await;
    receive(&state, garden, &["only"], 400).await;
    let removed: i64 = count(&state, "SELECT MAX(id) FROM articles").await;
    cleanup::run(&state.db, NOW).await.unwrap();

    receive(&state, garden, &["next"], 0).await;
    assert!(count(&state, "SELECT MAX(id) FROM articles").await > removed);
}

#[tokio::test]
async fn letting_go_of_a_feed_forgets_its_removed_articles() {
    let (_, state) = common::start_with_state(common::config()).await;
    let garden = feed(&state, "garden", &[1]).await;
    receive(&state, garden, &["old"], 400).await;
    cleanup::run(&state.db, NOW).await.unwrap();
    assert_eq!(
        count(&state, "SELECT COUNT(*) FROM forgotten_articles").await,
        1
    );

    // The reader unsubscribes and Undo passes: the feed goes, with its record.
    sqlx::query("DELETE FROM subscriptions")
        .execute(&state.db)
        .await
        .unwrap();
    let mut connection = state.db.acquire().await.unwrap();
    nine_turtles::folders::let_go(&mut connection, garden)
        .await
        .unwrap();
    assert_eq!(
        count(&state, "SELECT COUNT(*) FROM forgotten_articles").await,
        0
    );
    assert_eq!(count(&state, "SELECT COUNT(*) FROM feeds").await, 0);
}

#[tokio::test]
async fn muted_articles_go_like_any_other() {
    let (_, state) = common::start_with_state(common::config()).await;
    let garden = feed(&state, "garden", &[1]).await;
    receive(&state, garden, &["muted"], 400).await;
    mark(&state, 1, "muted", "read").await;
    sqlx::query("UPDATE entries SET muted = 1")
        .execute(&state.db)
        .await
        .unwrap();
    cleanup::run(&state.db, NOW).await.unwrap();
    assert!(articles(&state).await.is_empty());
}

#[tokio::test]
async fn a_feed_kept_only_for_stars_goes_once_its_last_old_article_does() {
    let (_, state) = common::start_with_state(common::config()).await;
    let garden = feed(&state, "garden", &[1]).await;
    receive(&state, garden, &["kept"], 400).await;
    // Unsubscribed and cleared, its line kept for the star; later unstarred.
    sqlx::query("UPDATE subscriptions SET unsubscribed_at = 1, cleared = 1")
        .execute(&state.db)
        .await
        .unwrap();
    cleanup::run(&state.db, NOW).await.unwrap();
    assert!(articles(&state).await.is_empty());
    assert_eq!(count(&state, "SELECT COUNT(*) FROM subscriptions").await, 0);
    assert_eq!(count(&state, "SELECT COUNT(*) FROM feeds").await, 0);
    assert_eq!(
        count(&state, "SELECT COUNT(*) FROM forgotten_articles").await,
        0
    );
}

#[tokio::test]
async fn a_new_follower_of_a_shared_feed_gets_what_is_still_kept() {
    let (_, state) = common::start_with_state(common::config()).await;
    let garden = feed(&state, "garden", &[1]).await;
    receive(&state, garden, &["removed"], 400).await;
    receive(&state, garden, &["kept"], 10).await;
    cleanup::run(&state.db, NOW).await.unwrap();

    // Another reader follows it; the publisher still lists both posts.
    let (other, _) = common::another_reader(&state).await;
    sqlx::query(
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (?, ?, 'garden', 0)",
    )
    .bind(other)
    .bind(garden)
    .execute(&state.db)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO entries (person_id, article_id, feed_id, sort_at)
         SELECT ?, id, feed_id, sort_at FROM articles",
    )
    .bind(other)
    .execute(&state.db)
    .await
    .unwrap();
    receive(&state, garden, &["removed", "kept"], 0).await;
    assert_eq!(entries(&state, other).await, ["kept"]);
    assert_eq!(entries(&state, 1).await, ["kept"]);
}
