//! Tidying many feeds at once (SPEC section 15, "Your feeds"): every feed
//! with when it last posted, so the quiet ones can be found, and moving or
//! unsubscribing from several feeds in one go, each with one Undo.
//!
//! Unsubscribing several feeds works as unsubscribing one does (`folders`):
//! they're hidden at once and kept for a few minutes, so one Undo brings
//! them all back whole. Moving remembers nothing here: the screen keeps each
//! feed's folders from before and sends them back for Undo (`restore`).

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::follow_again,
    folders::{self, FOLDERS, Folder, MEMBERSHIPS, clean_name},
    now,
};

/// More feeds than one request may change: more than any reader follows.
const MOST_AT_ONCE: usize = 5_000;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/tidy/feeds", get(list))
        .route("/api/tidy/unsubscribe", post(unsubscribe))
        .route("/api/tidy/resubscribe", post(resubscribe))
        .route("/api/tidy/move", post(move_feeds))
        .route("/api/tidy/restore", post(restore))
}

#[derive(Serialize, sqlx::FromRow)]
struct Listed {
    id: i64,
    title: String,
    /// When its newest article was published (never later than it arrived),
    /// or null if it has none.
    last_posted: Option<i64>,
    added_at: i64,
    #[sqlx(skip)]
    folders: Vec<i64>,
}

/// Each feed the reader follows, by their name for it, with when they
/// followed it and its newest article, found from the
/// `articles_newest_by_feed` index alone. Takes the reader.
const LISTED: &str = "SELECT subscriptions.feed_id AS id, subscriptions.title,
        subscriptions.added_at,
        (SELECT MAX(sort_at) FROM articles WHERE articles.feed_id = subscriptions.feed_id)
            AS last_posted
     FROM subscriptions WHERE person_id = ? AND unsubscribed_at IS NULL
     ORDER BY title COLLATE NOCASE, feed_id";

/// Every followed feed, A to Z, with when it last posted and its folders,
/// and every folder.
async fn list(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let listed: Result<(Vec<Listed>, Vec<Folder>), sqlx::Error> = async {
        let mut transaction = state.db.begin().await?;
        let mut feeds: Vec<Listed> = sqlx::query_as(LISTED)
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
        Err(error) => database_problem("listing feeds to tidy", &error),
    }
}

#[derive(Deserialize)]
struct Chosen {
    feeds: Vec<i64>,
}

/// The chosen feeds as one JSON list, for `json_each`; None if there are
/// none or too many.
fn as_list(feeds: &[i64]) -> Option<String> {
    if feeds.is_empty() || feeds.len() > MOST_AT_ONCE {
        return None;
    }
    serde_json::to_string(feeds).ok()
}

/// Unsubscribes from every chosen feed at once. Feeds unsubscribed before
/// are cleared for good first, since Undo only reverses the last action.
async fn unsubscribe(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Chosen>,
) -> Response {
    if as_list(&form.feeds).is_none() {
        return problem(StatusCode::BAD_REQUEST, "none-chosen");
    }
    let done: Result<u64, sqlx::Error> = async {
        folders::clear_unsubscribed(&state.db, Some(person), i64::MAX).await?;
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let hidden = folders::hide(&mut transaction, person, &form.feeds, now()).await?;
        transaction.commit().await?;
        Ok(hidden)
    }
    .await;
    match done {
        Ok(0) => StatusCode::NOT_FOUND.into_response(),
        Ok(count) => Json(json!({ "unsubscribed": count })).into_response(),
        Err(error) => database_problem("unsubscribing from several feeds", &error),
    }
}

/// Undo for unsubscribing from several feeds: every one still waiting comes
/// back as it was. Too late once they've been cleared.
async fn resubscribe(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Chosen>,
) -> Response {
    if as_list(&form.feeds).is_none() {
        return problem(StatusCode::BAD_REQUEST, "none-chosen");
    }
    let back: Result<u64, sqlx::Error> = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let now = now();
        let mut back = 0;
        for &feed in &form.feeds {
            back += u64::from(follow_again(&mut transaction, person, feed, now).await?);
        }
        transaction.commit().await?;
        Ok(back)
    }
    .await;
    match back {
        Ok(0) => problem(StatusCode::CONFLICT, "too-late"),
        Ok(back) => Json(json!({ "resubscribed": back })).into_response(),
        Err(error) => database_problem("undoing unsubscribing from several feeds", &error),
    }
}

#[derive(Deserialize)]
struct Move {
    feeds: Vec<i64>,
    /// The folder they move to; none (and no `new_folder`) takes them out
    /// of every folder.
    #[serde(default)]
    folder: Option<i64>,
    /// A folder to create (or find by name) and move them to.
    #[serde(default)]
    new_folder: Option<String>,
}

/// Moves the chosen feeds to one folder (or to no folder): each leaves
/// every other folder it was in. Answers the folder, and whether it was
/// made just now, so Undo can remove it again.
async fn move_feeds(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Move>,
) -> Response {
    let Some(list) = as_list(&form.feeds) else {
        return problem(StatusCode::BAD_REQUEST, "none-chosen");
    };
    let new_folder = match form.new_folder.as_deref().map(str::trim) {
        None | Some("") => None,
        Some(name) => match clean_name(name) {
            Some(name) => Some(name),
            None => return problem(StatusCode::BAD_REQUEST, "no-name"),
        },
    };
    let moved: Result<Option<(Option<i64>, bool)>, sqlx::Error> = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let (folder, created) = match (&new_folder, form.folder) {
            (Some(name), _) => {
                let (id, created) = folders::folder_named(&mut transaction, person, name).await?;
                (Some(id), created)
            }
            (None, Some(id)) => {
                let found: Option<i64> =
                    sqlx::query_scalar("SELECT id FROM folders WHERE id = ? AND person_id = ?")
                        .bind(id)
                        .bind(person)
                        .fetch_optional(&mut *transaction)
                        .await?;
                if found.is_none() {
                    return Ok(None);
                }
                (Some(id), false)
            }
            (None, None) => (None, false),
        };
        sqlx::query(
            "DELETE FROM feed_folders WHERE feed_id IN (
                 SELECT feed_id FROM subscriptions
                 WHERE person_id = ?2 AND feed_id IN (SELECT value FROM json_each(?1))
                     AND unsubscribed_at IS NULL)
             AND folder_id IN (SELECT id FROM folders WHERE person_id = ?2)",
        )
        .bind(&list)
        .bind(person)
        .execute(&mut *transaction)
        .await?;
        if let Some(folder) = folder {
            sqlx::query(
                "INSERT OR IGNORE INTO feed_folders (folder_id, feed_id)
                 SELECT ?, feed_id FROM subscriptions
                 WHERE person_id = ? AND feed_id IN (SELECT value FROM json_each(?))
                     AND unsubscribed_at IS NULL",
            )
            .bind(folder)
            .bind(person)
            .bind(&list)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        Ok(Some((folder, created)))
    }
    .await;
    match moved {
        Ok(Some((folder, created))) => {
            Json(json!({ "folder": folder, "created": created })).into_response()
        }
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("moving several feeds", &error),
    }
}

#[derive(Deserialize)]
struct Placed {
    id: i64,
    folders: Vec<i64>,
}

#[derive(Deserialize)]
struct Restore {
    feeds: Vec<Placed>,
}

/// Undo for moving: each feed goes back to exactly the folders it was in.
/// Folders deleted since are skipped.
async fn restore(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Restore>,
) -> Response {
    if form.feeds.is_empty() || form.feeds.len() > MOST_AT_ONCE {
        return problem(StatusCode::BAD_REQUEST, "none-chosen");
    }
    let restored: Result<(), sqlx::Error> = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        for feed in &form.feeds {
            folders::take_out_of_folders(&mut transaction, person, feed.id).await?;
            sqlx::query(
                "INSERT OR IGNORE INTO feed_folders (folder_id, feed_id)
                 SELECT folders.id, subscriptions.feed_id FROM folders, subscriptions
                 WHERE folders.person_id = ?1 AND folders.id IN (SELECT value FROM json_each(?2))
                   AND subscriptions.person_id = ?1 AND subscriptions.feed_id = ?3
                   AND subscriptions.unsubscribed_at IS NULL",
            )
            .bind(person)
            .bind(serde_json::to_string(&feed.folders).unwrap_or_else(|_| "[]".to_owned()))
            .bind(feed.id)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await
    }
    .await;
    match restored {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("undoing a move", &error),
    }
}

fn problem(status: StatusCode, error: &str) -> Response {
    (status, Json(json!({ "error": error }))).into_response()
}
