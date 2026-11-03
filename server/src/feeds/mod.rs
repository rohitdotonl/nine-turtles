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
    writers::{PEOPLE, Writer},
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
    /// The reader's name for it: a person's own name, once nine turtles or
    /// the reader gives it.
    title: String,
    /// The feed's own title (a blog's), shown under a person's name when
    /// the two differ (owner's plan, step 2).
    site_title: String,
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
    /// When it was last checked with an answer, so an empty feed can say
    /// "Last checked today at 14:20." (decision 0142). None for a newsletter,
    /// which is never checked: its emails arrive by themselves.
    checked_at: Option<i64>,
    /// The person it's one place of, when the reader joined it to others
    /// (`writers`); none for a place on its own.
    person: Option<i64>,
    /// What kind of source it is, for the person's page and their list's
    /// labels (SPEC section 36): "blog", "video", "newsletter" or "podcast".
    place: String,
    /// "person" or "publication" (decision 0163): always a person for a
    /// place joined to others.
    kind: String,
    /// When the reader followed it, for the person's page's "Following since".
    added_at: i64,
    /// A YouTube channel's feed, whose Shorts and live streams are sorted
    /// out (decision 0144), and whether the reader switched each on.
    sorts_videos: bool,
    shorts: bool,
    live_streams: bool,
    /// Where to write back (decision 0147): the address the reader typed
    /// for this person, and the one the feed or newsletter gives.
    write_to: Option<String>,
    email: Option<String>,
    /// The reader's note on the person (decision 0164).
    note: Option<String>,
    /// The folders it's in, by number.
    #[sqlx(skip)]
    folders: Vec<i64>,
}

/// Each feed a reader follows, with their name for it, their settings and
/// their unread count, counted from the `entries_unread_by_feed` index alone
/// (tests/speed.rs checks this). A feed that flows past (`river`) counts
/// nothing. Takes the reader.
pub const FEEDS: &str = "SELECT feeds.id, subscriptions.title, feeds.title AS site_title, feeds.site_url, subscriptions.river,
        subscriptions.check_at_most, subscriptions.open_on_site, subscriptions.paused_at,
        CASE WHEN feeds.failures >= 2 THEN feeds.failing_since END AS failing_since,
        CASE WHEN feeds.url NOT LIKE 'newsletter:%' THEN feeds.fetched_at END AS checked_at,
        subscriptions.writer_id AS person, subscriptions.added_at, subscriptions.write_to,
        subscriptions.note, feeds.email, subscriptions.shorts, subscriptions.live_streams,
        feeds.url LIKE '%youtube.com/feeds/videos.xml?channel_id=%' AS sorts_videos,
        COALESCE(subscriptions.place, CASE WHEN feeds.url LIKE 'newsletter:%' THEN 'newsletter'
             WHEN feeds.url LIKE '%youtube.com/feeds/%' THEN 'video' ELSE 'blog' END) AS place,
        CASE WHEN subscriptions.writer_id IS NOT NULL THEN 'person'
             ELSE COALESCE(subscriptions.kind, 'person') END AS kind,
        CASE WHEN subscriptions.river THEN 0 ELSE
            (SELECT COUNT(*) FROM entries WHERE entries.person_id = subscriptions.person_id
                 AND entries.feed_id = subscriptions.feed_id AND entries.read = 0)
        END AS unread
     FROM subscriptions JOIN feeds ON feeds.id = subscriptions.feed_id
     WHERE subscriptions.person_id = ? AND subscriptions.unsubscribed_at IS NULL
     ORDER BY subscriptions.title COLLATE NOCASE, feeds.id";

/// The sidebar's feeds, folders and people, and whether the reader has
/// highlighted or written a note on anything (its Notes row, SPEC section 42).
type Sidebar = (Vec<FeedRow>, Vec<Folder>, Vec<Writer>, bool);

/// Every followed feed, alphabetically, with its unread count and folders,
/// every folder, alphabetically (SPEC section 5), and the people places
/// were joined into (SPEC section 36).
async fn list_feeds(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let listed: Result<Sidebar, sqlx::Error> = async {
        let mut connection = state.db.acquire().await?;
        // Each place not yet guessed a person or publication is, once (decision 0163).
        let mut guessing = sqlx::Connection::begin(&mut *connection).await?;
        crate::writers::kind::fill(&mut guessing, person, None).await?;
        guessing.commit().await?;
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
        let people: Vec<Writer> = sqlx::query_as(PEOPLE)
            .bind(person)
            .fetch_all(&mut *transaction)
            .await?;
        let notes: bool =
            sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM notes WHERE person_id = ?)")
                .bind(person)
                .fetch_one(&mut *transaction)
                .await?;
        transaction.commit().await?;
        let mut by_feed = std::collections::HashMap::<i64, Vec<i64>>::new();
        for (feed, folder) in memberships {
            by_feed.entry(feed).or_default().push(folder);
        }
        for feed in &mut feeds {
            feed.folders = by_feed.remove(&feed.id).unwrap_or_default();
        }
        Ok((feeds, folders, people, notes))
    }
    .await;
    match listed {
        Ok((feeds, folders, people, notes)) => {
            Json(json!({ "feeds": feeds, "folders": folders, "people": people, "notes": notes }))
                .into_response()
        }
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
