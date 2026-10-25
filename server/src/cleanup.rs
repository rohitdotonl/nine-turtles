//! The yearly clean-up (SPEC section 23, decision 0089): an article nobody
//! has starred is removed a year after nine turtles first received it, read
//! or not. A starred one stays forever.
//!
//! It runs just after each night's backup is safely stored (`backup::run`),
//! so whatever it removes is still in that night's copy; without backups it
//! never runs. Each reader's own entries go first: an entry the reader
//! hasn't starred is removed even if someone else starred the article, so
//! what one reader sees never depends on another's stars. An article goes
//! once no reader has it any more, and its fingerprint is remembered in
//! `forgotten_articles`, so the publisher still listing it doesn't bring it
//! back as new (`feeds::store_articles`).

use sqlx::SqlitePool;

use crate::{folders, log};

/// How long an unstarred article is kept, counted from when nine turtles
/// first received it: a year.
pub const KEPT_FOR: i64 = 365 * 86_400;

/// How many articles one step removes, so the database is never held for
/// long while readers read.
const AT_ONCE: i64 = 500;

/// What one clean-up removed.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Removed {
    /// Readers' unstarred entries for old articles.
    pub entries: u64,
    /// Old articles no reader had any more.
    pub articles: u64,
}

/// Removes what's more than a year old at `at`, a few hundred at a time.
pub async fn run(db: &SqlitePool, at: i64) -> Result<Removed, sqlx::Error> {
    let before = at - KEPT_FOR;
    let mut removed = Removed::default();
    loop {
        let mut transaction = db.begin().await?;
        let entries = sqlx::query(
            "DELETE FROM entries WHERE (person_id, article_id) IN (
                 SELECT entries.person_id, entries.article_id
                 FROM articles JOIN entries ON entries.article_id = articles.id
                 WHERE articles.received_at < ? AND entries.starred = 0
                 LIMIT ?)",
        )
        .bind(before)
        .bind(AT_ONCE)
        .execute(&mut *transaction)
        .await?
        .rows_affected();
        transaction.commit().await?;
        removed.entries += entries;
        if entries < AT_ONCE as u64 {
            break;
        }
    }
    loop {
        let mut transaction = db.begin().await?;
        let old: Vec<(i64, i64)> = sqlx::query_as(
            "SELECT id, feed_id FROM articles
             WHERE received_at < ?
             AND NOT EXISTS (SELECT 1 FROM entries WHERE entries.article_id = articles.id)
             LIMIT ?",
        )
        .bind(before)
        .bind(AT_ONCE)
        .fetch_all(&mut *transaction)
        .await?;
        // Numbers freed here are never given again (`feeds::store_articles`).
        if !old.is_empty() {
            folders::remember_high_water(&mut transaction).await?;
        }
        for (id, _) in &old {
            sqlx::query(
                "INSERT OR IGNORE INTO forgotten_articles (feed_id, fingerprint)
                 SELECT feed_id, fingerprint FROM articles WHERE id = ?",
            )
            .bind(id)
            .execute(&mut *transaction)
            .await?;
            sqlx::query("DELETE FROM articles WHERE id = ?")
                .bind(id)
                .execute(&mut *transaction)
                .await?;
        }
        // A feed nobody follows any more whose last article just went goes
        // too, as unsubscribing would have done.
        let mut feeds: Vec<i64> = old.iter().map(|(_, feed)| *feed).collect();
        feeds.sort_unstable();
        feeds.dedup();
        for feed in feeds {
            folders::let_go(&mut transaction, feed).await?;
        }
        transaction.commit().await?;
        removed.articles += old.len() as u64;
        if (old.len() as i64) < AT_ONCE {
            break;
        }
    }
    Ok(removed)
}

/// Runs the clean-up after a night's backup, and says what it removed.
pub async fn after_backup(db: &SqlitePool, at: i64) {
    match run(db, at).await {
        Ok(Removed {
            entries: 0,
            articles: 0,
        }) => {}
        Ok(removed) => log::info(&format!(
            "yearly clean-up: removed {} articles and {} readers' entries received over a year ago",
            removed.articles, removed.entries
        )),
        Err(error) => log::problem(&format!("the yearly clean-up failed: {error}")),
    }
}
