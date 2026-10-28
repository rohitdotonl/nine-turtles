//! Adding a feed, listing feeds and their articles, and reading one article
//! (SPEC sections 3, 5, 6 and 7). Marking articles read or starred is in
//! `marks`; folders, editing feeds and unsubscribing in `folders`.
//!
//! Five parts: `adding` (the Add field), `store` (feeds, subscriptions,
//! articles and entries in the database), `lists` (the item list),
//! `articles` (reading them) and, here, the routes and the sidebar's list of
//! feeds. Everything is used as `feeds::…`, whichever part it lives in.

mod adding;
mod articles;
mod lists;
mod store;

pub use adding::*;
pub use articles::*;
pub use lists::*;
pub use store::*;

use axum::{
    Json, Router,
    extract::State,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::Serialize;
use serde_json::json;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    folders::{FOLDERS, Folder, MEMBERSHIPS},
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/feeds", get(list_feeds).post(add_feed))
        .route("/api/articles", get(list_articles))
        .route("/api/articles/new", get(new_articles))
        .route("/api/articles/several", get(read_several))
        .route("/api/articles/{id}", get(read_article))
}

#[derive(Serialize, sqlx::FromRow)]
struct FeedRow {
    id: i64,
    title: String,
    site_url: Option<String>,
    /// How many of its articles are unread, for the sidebar's muted count;
    /// none for a feed that flows past.
    unread: i64,
    /// Its settings from Edit feed (SPEC section 15): it flows past as in
    /// river mode, the shortest wait between checks (seconds, 0 for its own
    /// rhythm), and whether its articles open on the publisher's site.
    river: bool,
    check_at_most: i64,
    open_on_site: bool,
    /// When the reader paused it, if it's paused.
    paused_at: Option<i64>,
    /// When its checks began failing, while the feed health page lists it
    /// as not working (`health::LISTED_AFTER` failures in a row), so its
    /// list can say so and offer Find new address (decision 0106).
    failing_since: Option<i64>,
    /// The folders it's in, by number.
    #[sqlx(skip)]
    folders: Vec<i64>,
}

/// Each feed a reader follows, with their name for it, their settings and
/// their unread count, counted from the `entries_unread_by_feed` index alone
/// (tests/speed.rs checks this). A feed that flows past (`river`) counts
/// nothing. Takes the reader.
pub const FEEDS: &str = "SELECT feeds.id, subscriptions.title, feeds.site_url, subscriptions.river,
        subscriptions.check_at_most, subscriptions.open_on_site, subscriptions.paused_at,
        CASE WHEN feeds.failures >= 2 THEN feeds.failing_since END AS failing_since,
        CASE WHEN subscriptions.river THEN 0 ELSE
            (SELECT COUNT(*) FROM entries WHERE entries.person_id = subscriptions.person_id
                 AND entries.feed_id = subscriptions.feed_id AND entries.read = 0)
        END AS unread
     FROM subscriptions JOIN feeds ON feeds.id = subscriptions.feed_id
     WHERE subscriptions.person_id = ? AND subscriptions.unsubscribed_at IS NULL
     ORDER BY subscriptions.title COLLATE NOCASE, feeds.id";

/// Every followed feed, alphabetically, with its unread count and folders,
/// and every folder, alphabetically (SPEC section 5).
async fn list_feeds(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let listed: Result<(Vec<FeedRow>, Vec<Folder>), sqlx::Error> = async {
        let mut connection = state.db.acquire().await?;
        // One snapshot, so the feeds, folders and memberships agree.
        let mut transaction = sqlx::Connection::begin(&mut *connection).await?;
        let mut feeds: Vec<FeedRow> = sqlx::query_as(FEEDS)
            .bind(person)
            .fetch_all(&mut *transaction)
            .await?;
        let folders: Vec<Folder> = sqlx::query_as(FOLDERS)
            .bind(person)
            .fetch_all(&mut *transaction)
            .await?;
        let memberships: Vec<(i64, i64)> = sqlx::query_as(MEMBERSHIPS)
            .bind(person)
            .fetch_all(&mut *transaction)
            .await?;
        transaction.commit().await?;
        let mut by_feed = std::collections::HashMap::<i64, Vec<i64>>::new();
        for (feed, folder) in memberships {
            by_feed.entry(feed).or_default().push(folder);
        }
        for feed in &mut feeds {
            feed.folders = by_feed.remove(&feed.id).unwrap_or_default();
        }
        Ok((feeds, folders))
    }
    .await;
    match listed {
        Ok((feeds, folders)) => Json(json!({ "feeds": feeds, "folders": folders })).into_response(),
        Err(error) => database_problem("listing feeds", &error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_feeds_list_says_it_is_failing_exactly_when_feed_health_lists_it() {
        let listed = format!(
            "WHEN feeds.failures >= {} THEN feeds.failing_since",
            crate::health::LISTED_AFTER
        );
        assert!(FEEDS.contains(&listed));
    }
}
