//! Folders and managing feeds (SPEC section 15): renaming a feed and
//! choosing its folders, creating, renaming and deleting folders, and
//! unsubscribing, with undo.
//!
//! Unsubscribing hides the feed from that reader at once (its background
//! checks stop once nobody follows it), but keeps everything for a few
//! minutes, so Undo can bring it back whole, read history included. After
//! that (or as soon as the reader unsubscribes from another feed, since Undo
//! only ever reverses the last action) the reader's unstarred entries and
//! folder pairs for it are removed for good. Their starred articles stay in
//! Starred, so their subscription's line stays too, hidden, for its name.
//! Other readers who follow the feed keep it exactly as it was; when nobody
//! follows it any more, its articles nobody starred go too
//! (ENGINEERING.md → "Data").

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqliteConnection;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    checking::{DAY, HOUR},
    feeds::{follow_again, follows, refresh_shared},
    now, rules,
};

/// How long Undo can bring an unsubscribed feed back, in seconds. The screen
/// offers Undo only until the reader's next action, which is almost always
/// sooner.
pub const UNDO_FOR: i64 = 10 * 60;

/// The longest name a feed or folder can have, in characters.
pub const LONGEST_NAME: usize = 200;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/feeds/{id}", post(edit_feed))
        .route("/api/feeds/{id}/unsubscribe", post(unsubscribe))
        .route("/api/feeds/{id}/resubscribe", post(resubscribe))
        .route("/api/folders", post(create_folder))
        .route("/api/folders/{id}", post(rename_folder))
        .route("/api/folders/{id}/delete", post(delete_folder))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Folder {
    pub id: i64,
    pub name: String,
}

/// A reader's folders, alphabetically (SPEC section 5). Takes the reader.
pub const FOLDERS: &str =
    "SELECT id, name FROM folders WHERE person_id = ? ORDER BY name COLLATE NOCASE, id";

/// Which feed the reader follows is in which of their folders, for the
/// sidebar. Takes the reader.
pub const MEMBERSHIPS: &str = "SELECT feed_folders.feed_id, feed_folders.folder_id
     FROM feed_folders JOIN folders ON folders.id = feed_folders.folder_id
         JOIN subscriptions ON subscriptions.person_id = folders.person_id
             AND subscriptions.feed_id = feed_folders.feed_id
     WHERE folders.person_id = ? AND subscriptions.unsubscribed_at IS NULL";

/// A name as the reader typed it, with spaces at either end removed and runs
/// of spaces made one. None if nothing is left, or it's too long.
pub fn clean_name(name: &str) -> Option<String> {
    let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
    let length = name.chars().count();
    (1..=LONGEST_NAME).contains(&length).then_some(name)
}

/// The reader's folder with this name (whatever its capital letters),
/// created if they have none yet. Answers its number, and whether it was
/// created.
pub async fn folder_named(
    connection: &mut SqliteConnection,
    person: i64,
    name: &str,
) -> Result<(i64, bool), sqlx::Error> {
    let created: Option<i64> = sqlx::query_scalar(
        "INSERT INTO folders (person_id, name) VALUES (?, ?)
         ON CONFLICT (person_id, name) DO NOTHING RETURNING id",
    )
    .bind(person)
    .bind(name)
    .fetch_optional(&mut *connection)
    .await?;
    if let Some(id) = created {
        return Ok((id, true));
    }
    let id = sqlx::query_scalar("SELECT id FROM folders WHERE person_id = ? AND name = ?")
        .bind(person)
        .bind(name)
        .fetch_one(&mut *connection)
        .await?;
    Ok((id, false))
}

#[derive(Deserialize)]
struct EditFeed {
    title: String,
    /// Every folder the feed should be in; it leaves any other.
    folders: Vec<i64>,
    /// A folder to create (or find by name) and put the feed in too.
    #[serde(default)]
    new_folder: Option<String>,
    /// Its settings (SPEC section 15). Each is left as it is when absent, so
    /// a tab opened before they existed can't reset them.
    #[serde(default)]
    river: Option<bool>,
    #[serde(default)]
    check: Option<Check>,
    #[serde(default)]
    open_on_site: Option<bool>,
    #[serde(default)]
    paused: Option<bool>,
}

/// How often the reader allows a feed to be checked in the background.
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Check {
    /// On its own rhythm, as every feed is by default.
    Automatic,
    Hourly,
    Daily,
}

impl Check {
    /// The shortest wait between checks, in seconds (0: none of its own).
    const fn at_most(self) -> i64 {
        match self {
            Self::Automatic => 0,
            Self::Hourly => HOUR,
            Self::Daily => DAY,
        }
    }
}

/// How many of the articles a feed brought while it was paused go back to
/// Unread when the reader unpauses it: only the newest few, so nothing piles
/// up (SPEC section 15). The number is also written in SPEC section 15 and
/// in Edit feed's helper line (`web/src/lib/EditFeed.svelte`).
pub const BACK_FROM_PAUSE: i64 = 3;

/// "Edit feed": its name, folders and settings, saved together or not at all.
async fn edit_feed(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<EditFeed>,
) -> Response {
    let Some(title) = clean_name(&form.title) else {
        return problem(StatusCode::BAD_REQUEST, "no-name");
    };
    let new_folder = match form.new_folder.as_deref().map(str::trim) {
        None | Some("") => None,
        Some(name) => match clean_name(name) {
            Some(name) => Some(name),
            None => return problem(StatusCode::BAD_REQUEST, "no-name"),
        },
    };
    let saved: Result<Option<()>, sqlx::Error> = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        if !follows(&mut transaction, person, id).await? {
            return Ok(None);
        }
        rename_feed(&mut transaction, person, id, &title).await?;
        sqlx::query(
            "UPDATE subscriptions SET river = COALESCE(?, river),
                 open_on_site = COALESCE(?, open_on_site),
                 check_at_most = COALESCE(?, check_at_most)
             WHERE person_id = ? AND feed_id = ?",
        )
        .bind(form.river)
        .bind(form.open_on_site)
        .bind(form.check.map(Check::at_most))
        .bind(person)
        .bind(id)
        .execute(&mut *transaction)
        .await?;
        if form.check.is_some() {
            // The feed is checked as often as its most eager follower
            // allows. A longer wait applies at once: the next check moves
            // to no sooner than that long after the last one.
            refresh_shared(&mut transaction, id).await?;
            sqlx::query(
                "UPDATE feeds SET
                     next_check_at = MAX(next_check_at, COALESCE(fetched_at, 0) + check_at_most)
                 WHERE id = ?",
            )
            .bind(id)
            .execute(&mut *transaction)
            .await?;
        }
        let mut folders = form.folders.clone();
        if let Some(name) = &new_folder {
            folders.push(folder_named(&mut transaction, person, name).await?.0);
        }
        file_in(&mut transaction, person, id, &folders).await?;
        // After the folders, so rules for folders act on the ones just saved.
        if let Some(paused) = form.paused {
            set_paused(&mut transaction, person, id, paused, now()).await?;
        }
        transaction.commit().await?;
        Ok(Some(()))
    }
    .await;
    match saved {
        Ok(Some(())) => StatusCode::NO_CONTENT.into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("editing a feed", &error),
    }
}

/// Gives a followed feed the reader's own name for it. The name is already
/// cleaned (`clean_name`). Every way of renaming a feed comes here.
pub async fn rename_feed(
    connection: &mut SqliteConnection,
    person: i64,
    id: i64,
    title: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE subscriptions SET title = ? WHERE person_id = ? AND feed_id = ?")
        .bind(title)
        .bind(person)
        .bind(id)
        .execute(&mut *connection)
        .await?;
    Ok(())
}

/// Puts a feed in exactly these folders of the reader's, and out of their
/// others. Folders that no longer exist (deleted in another tab), or that
/// aren't the reader's, are skipped.
pub async fn file_in(
    connection: &mut SqliteConnection,
    person: i64,
    id: i64,
    folders: &[i64],
) -> Result<(), sqlx::Error> {
    take_out_of_folders(connection, person, id).await?;
    sqlx::query(
        "INSERT OR IGNORE INTO feed_folders (folder_id, feed_id)
         SELECT folders.id, ? FROM folders
         WHERE folders.person_id = ? AND folders.id IN (SELECT value FROM json_each(?))",
    )
    .bind(id)
    .bind(person)
    .bind(serde_json::to_string(folders).unwrap_or_else(|_| "[]".to_owned()))
    .execute(&mut *connection)
    .await?;
    Ok(())
}

/// Pauses a feed for the reader, or unpauses it. While it's paused its new
/// articles arrive already read (`feeds::store_articles`); unpausing puts
/// the newest few of them back in Unread, and the reader's rules act on
/// those again, so one a rule marks as read stays read. Pausing a feed
/// that's already paused (or the reverse) changes nothing.
async fn set_paused(
    connection: &mut SqliteConnection,
    person: i64,
    id: i64,
    paused: bool,
    now: i64,
) -> Result<(), sqlx::Error> {
    if paused {
        sqlx::query(
            "UPDATE subscriptions SET paused_at = ?
             WHERE person_id = ? AND feed_id = ? AND paused_at IS NULL",
        )
        .bind(now)
        .bind(person)
        .bind(id)
        .execute(&mut *connection)
        .await?;
        return Ok(());
    }
    let since: Option<i64> = sqlx::query_scalar(
        "SELECT paused_at FROM subscriptions WHERE person_id = ? AND feed_id = ?",
    )
    .bind(person)
    .bind(id)
    .fetch_optional(&mut *connection)
    .await?
    .flatten();
    let Some(since) = since else {
        return Ok(());
    };
    sqlx::query("UPDATE subscriptions SET paused_at = NULL WHERE person_id = ? AND feed_id = ?")
        .bind(person)
        .bind(id)
        .execute(&mut *connection)
        .await?;
    // The inner SELECT picks the newest few first, then the UPDATE marks
    // them; keep it uncorrelated so LIMIT applies to the feed, not per row.
    let back: Vec<i64> = sqlx::query_scalar(
        "UPDATE entries SET read = 0
         WHERE person_id = ?1 AND feed_id = ?2 AND article_id IN (
             SELECT entries.article_id FROM entries
             JOIN articles ON articles.id = entries.article_id
             WHERE entries.person_id = ?1 AND entries.feed_id = ?2
                 AND entries.read = 1 AND entries.muted = 0 AND articles.received_at >= ?3
             ORDER BY entries.sort_at DESC, entries.article_id DESC LIMIT ?4)
         RETURNING article_id",
    )
    .bind(person)
    .bind(id)
    .bind(since)
    .bind(BACK_FROM_PAUSE)
    .fetch_all(&mut *connection)
    .await?;
    rules::apply_to(connection, person, id, &back).await
}

/// Unsubscribes on the screen (Undo comes back through `resubscribe`).
async fn unsubscribe(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match leave(&state.db, person, id, now(), Leaving::Screen).await {
        Ok(false) => StatusCode::NOT_FOUND.into_response(),
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("unsubscribing", &error),
    }
}

/// Where a reader unsubscribed, which decides how long the feed waits,
/// hidden, to be brought back.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Leaving {
    /// Ten minutes (SPEC section 15). Any feed the reader unsubscribed from
    /// before is cleared for good first, since Undo only reverses the last
    /// action.
    Screen,
    /// Ten minutes too, but earlier feeds keep theirs (SPEC section 26).
    App,
    /// 30 days (`mcp::KEPT_FOR`), with Bring back in Settings (SPEC
    /// section 33). Only a feed this hides: one the reader unsubscribed from
    /// elsewhere keeps its own time.
    Assistant,
}

/// Unsubscribes the reader from a feed: it's hidden straight away, and no
/// longer checked if nobody else follows it. Background checking clears it
/// for good once its time is up. Answers whether they followed it.
pub async fn leave(
    db: &sqlx::SqlitePool,
    person: i64,
    id: i64,
    at: i64,
    leaving: Leaving,
) -> Result<bool, sqlx::Error> {
    if leaving == Leaving::Screen {
        clear_unsubscribed(db, Some(person), i64::MAX).await?;
    }
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let hidden = hide(&mut transaction, person, &[id], at).await? > 0;
    if hidden && leaving == Leaving::Assistant {
        sqlx::query("UPDATE subscriptions SET kept_until = ? WHERE person_id = ? AND feed_id = ?")
            .bind(at + crate::mcp::KEPT_FOR)
            .bind(person)
            .bind(id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
    Ok(hidden)
}

/// Hides these feeds from the reader, as unsubscribed at `now`, and stops
/// checking any that nobody else follows. Answers how many they followed.
pub async fn hide(
    connection: &mut SqliteConnection,
    person: i64,
    feeds: &[i64],
    now: i64,
) -> Result<u64, sqlx::Error> {
    let hidden: Vec<i64> = sqlx::query_scalar(
        "UPDATE subscriptions SET unsubscribed_at = ?, kept_until = NULL
         WHERE person_id = ? AND feed_id IN (SELECT value FROM json_each(?))
             AND unsubscribed_at IS NULL
         RETURNING feed_id",
    )
    .bind(now)
    .bind(person)
    .bind(serde_json::to_string(feeds).unwrap_or_else(|_| "[]".to_owned()))
    .fetch_all(&mut *connection)
    .await?;
    for &feed in &hidden {
        refresh_shared(connection, feed).await?;
    }
    Ok(hidden.len() as u64)
}

/// Undo for unsubscribing: the feed comes back as it was, and is checked
/// again soon. Too late once it has been cleared.
async fn resubscribe(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let back: Result<bool, sqlx::Error> = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let back = follow_again(&mut transaction, person, id, now()).await?;
        transaction.commit().await?;
        Ok(back)
    }
    .await;
    match back {
        Ok(false) => problem(StatusCode::CONFLICT, "too-late"),
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("undoing an unsubscribe", &error),
    }
}

/// Takes a feed out of every one of the reader's folders (other readers'
/// folders are theirs).
pub async fn take_out_of_folders(
    connection: &mut SqliteConnection,
    person: i64,
    feed_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM feed_folders WHERE feed_id = ?
         AND folder_id IN (SELECT id FROM folders WHERE person_id = ?)",
    )
    .bind(feed_id)
    .bind(person)
    .execute(connection)
    .await?;
    Ok(())
}

/// Clears, for good, every subscription unsubscribed at or before `before`
/// that isn't cleared yet: one reader's, or (`None`) everyone's. A feed an
/// assistant unsubscribed from waits until its `kept_until` has passed
/// (30 days, `mcp::KEPT_FOR`), whatever `before` says. Answers how many.
pub async fn clear_unsubscribed(
    db: &sqlx::SqlitePool,
    person: Option<i64>,
    before: i64,
) -> Result<usize, sqlx::Error> {
    let waiting: Vec<(i64, i64)> = sqlx::query_as(
        "SELECT person_id, feed_id FROM subscriptions
         WHERE unsubscribed_at <= ? AND cleared = 0 AND (?2 IS NULL OR person_id = ?2)
             AND (kept_until IS NULL OR kept_until <= ?3)
         ORDER BY person_id, feed_id",
    )
    .bind(before)
    .bind(person)
    .bind(now())
    .fetch_all(db)
    .await?;
    let mut cleared = 0;
    for &(person, id) in &waiting {
        let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
        cleared += usize::from(clear(&mut transaction, person, id).await?);
        transaction.commit().await?;
    }
    Ok(cleared)
}

/// Removes, for one reader, a feed they unsubscribed from: their unstarred
/// entries (their read history) that aren't on any of their collections, their folder pairs for it, and their
/// rules' and saved searches' hold on it. Their subscription's line goes
/// too, unless their starred or collected articles still need its name. Other readers'
/// things are untouched. Once nobody follows or waits on the feed, its
/// articles nobody has go, its hub subscription goes, and the feed's line
/// goes if no article is left. Does nothing (and answers false) if the
/// reader follows it again or it's already cleared: Undo may have come
/// first.
pub async fn clear(
    connection: &mut SqliteConnection,
    person: i64,
    id: i64,
) -> Result<bool, sqlx::Error> {
    let claimed = sqlx::query(
        "UPDATE subscriptions SET cleared = 1
         WHERE person_id = ? AND feed_id = ? AND unsubscribed_at IS NOT NULL AND cleared = 0",
    )
    .bind(person)
    .bind(id)
    .execute(&mut *connection)
    .await?;
    if claimed.rows_affected() == 0 {
        return Ok(false);
    }
    // Entries carried over to a new address (`health::follow_elsewhere`)
    // hold articles stored under the old feed: once they go, that feed may
    // need letting go too.
    let elsewhere: Vec<i64> = sqlx::query_scalar(
        "SELECT DISTINCT articles.feed_id FROM entries
             JOIN articles ON articles.id = entries.article_id
         WHERE entries.person_id = ?1 AND entries.feed_id = ?2 AND entries.starred = 0
             AND articles.feed_id != ?2 AND NOT EXISTS (SELECT 1 FROM collection_articles AS kept
                 WHERE kept.person_id = ?1 AND kept.article_id = entries.article_id)",
    )
    .bind(person)
    .bind(id)
    .fetch_all(&mut *connection)
    .await?;
    // An article on any of their collections stays, as a starred one does (decision 0108).
    sqlx::query(
        "DELETE FROM entries WHERE person_id = ?1 AND feed_id = ?2 AND starred = 0
         AND NOT EXISTS (SELECT 1 FROM collection_articles AS kept
             WHERE kept.person_id = ?1 AND kept.article_id = entries.article_id)",
    )
    .bind(person)
    .bind(id)
    .execute(&mut *connection)
    .await?;
    take_out_of_folders(&mut *connection, person, id).await?;
    // Their rules for it stay, paused and saying so (SPEC section 27).
    rules::place_gone_for(connection, person, id).await?;
    crate::saved_searches::forget(&mut *connection, person, "feed", id).await?;
    sqlx::query(
        "DELETE FROM subscriptions WHERE person_id = ?1 AND feed_id = ?2
         AND NOT EXISTS (SELECT 1 FROM entries WHERE person_id = ?1 AND feed_id = ?2)",
    )
    .bind(person)
    .bind(id)
    .execute(&mut *connection)
    .await?;
    let_go(connection, id).await?;
    for other in elsewhere {
        let_go(connection, other).await?;
    }
    Ok(true)
}

/// Once nobody follows a feed or waits to, its articles nobody has go, its
/// hub subscription goes, and the feed's line goes if no article is left.
/// A newsletter feed's line stays, so its sender's later emails stay away
/// (decision 0091); it goes with its reader's account.
/// An article any reader still has an entry for (a star, or one carried
/// over to a new address) always stays, and so does its feed's line.
/// Leaves a feed someone follows as it is.
pub async fn let_go(connection: &mut SqliteConnection, id: i64) -> Result<(), sqlx::Error> {
    let someone: Option<i64> = sqlx::query_scalar(
        "SELECT person_id FROM subscriptions WHERE feed_id = ? AND cleared = 0 LIMIT 1",
    )
    .bind(id)
    .fetch_optional(&mut *connection)
    .await?;
    if someone.is_none() {
        remember_high_water(connection).await?;
        // Nobody follows it, or waits to: only articles someone still has
        // (starred ones, or ones carried over to a new address) stay.
        sqlx::query(
            "DELETE FROM articles WHERE feed_id = ?
             AND NOT EXISTS (SELECT 1 FROM entries WHERE entries.article_id = articles.id)",
        )
        .bind(id)
        .execute(&mut *connection)
        .await?;
        // Its hub's deliveries now find no address and are refused; the hub
        // stops when its lease ends.
        sqlx::query("DELETE FROM websub WHERE feed_id = ?")
            .bind(id)
            .execute(&mut *connection)
            .await?;
        // The yearly clean-up's record of its removed articles goes too: if
        // someone follows the feed again, it starts afresh (decision 0089).
        sqlx::query("DELETE FROM forgotten_articles WHERE feed_id = ?")
            .bind(id)
            .execute(&mut *connection)
            .await?;
        sqlx::query(
            "DELETE FROM feeds WHERE id = ?1 AND newsletter_of IS NULL
             AND NOT EXISTS (SELECT 1 FROM articles WHERE feed_id = ?1)
             AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE feed_id = ?1)",
        )
        .bind(id)
        .execute(&mut *connection)
        .await?;
    }
    refresh_shared(connection, id).await
}

/// Remembers the highest article number ever given, so numbers freed by
/// removing articles are never given again (see `feeds::store_articles`).
pub async fn remember_high_water(connection: &mut SqliteConnection) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO settings (name, value)
         VALUES ('articles_high_water',
                 CAST(COALESCE((SELECT MAX(id) FROM articles), 0) AS TEXT))
         ON CONFLICT (name) DO UPDATE SET value = CAST(
             MAX(CAST(value AS INTEGER), CAST(excluded.value AS INTEGER)) AS TEXT)",
    )
    .execute(&mut *connection)
    .await?;
    Ok(())
}

#[derive(Deserialize)]
struct NewFolder {
    name: String,
    /// Feeds to put in it straight away (Undo for deleting a folder).
    #[serde(default)]
    feeds: Vec<i64>,
    /// Rules that were in it, to hand back (Undo for deleting a folder).
    #[serde(default)]
    rules: Vec<i64>,
    /// Saved searches that looked in it, to look in it again (Undo too).
    #[serde(default)]
    searches: Vec<i64>,
}

async fn create_folder(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<NewFolder>,
) -> Response {
    let Some(name) = clean_name(&form.name) else {
        return problem(StatusCode::BAD_REQUEST, "no-name");
    };
    let created: Result<Result<i64, i64>, sqlx::Error> = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let (id, new) = folder_named(&mut transaction, person, &name).await?;
        if !new {
            return Ok(Err(id));
        }
        put_back(
            &mut transaction,
            person,
            id,
            &form.feeds,
            &form.rules,
            &form.searches,
        )
        .await?;
        transaction.commit().await?;
        Ok(Ok(id))
    }
    .await;
    match created {
        Ok(Ok(id)) => (
            StatusCode::CREATED,
            Json(json!({ "folder": Folder { id, name } })),
        )
            .into_response(),
        Ok(Err(id)) => already(id),
        Err(error) => database_problem("creating a folder", &error),
    }
}

#[derive(Deserialize)]
struct RenameFolder {
    name: String,
}

async fn rename_folder(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<RenameFolder>,
) -> Response {
    let Some(name) = clean_name(&form.name) else {
        return problem(StatusCode::BAD_REQUEST, "no-name");
    };
    let other: Result<Option<i64>, sqlx::Error> =
        sqlx::query_scalar("SELECT id FROM folders WHERE person_id = ? AND name = ? AND id != ?")
            .bind(person)
            .bind(&name)
            .bind(id)
            .fetch_optional(&state.db)
            .await;
    match other {
        Ok(Some(other)) => return already(other),
        Ok(None) => {}
        Err(error) => return database_problem("renaming a folder", &error),
    }
    let renamed = sqlx::query("UPDATE folders SET name = ? WHERE id = ? AND person_id = ?")
        .bind(&name)
        .bind(id)
        .bind(person)
        .execute(&state.db)
        .await;
    match renamed {
        Ok(renamed) if renamed.rows_affected() == 0 => StatusCode::NOT_FOUND.into_response(),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        // Another tab took the name in between.
        Err(sqlx::Error::Database(error)) if error.is_unique_violation() => {
            problem(StatusCode::CONFLICT, "already")
        }
        Err(error) => database_problem("renaming a folder", &error),
    }
}

/// Deletes a folder. Its feeds stay; they just leave it. The screen keeps
/// the folder's name and feeds, so Undo can create it again.
async fn delete_folder(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let deleted: Result<Option<Deleted>, sqlx::Error> = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let deleted = delete(&mut transaction, person, id).await?;
        transaction.commit().await?;
        Ok(deleted)
    }
    .await;
    // The screen keeps the name and feeds itself; it needs back only the
    // rules and saved searches, for Undo.
    match deleted {
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Ok(Some(deleted)) if deleted.rules.is_empty() && deleted.searches.is_empty() => {
            StatusCode::NO_CONTENT.into_response()
        }
        Ok(Some(deleted)) => {
            Json(json!({ "rules": deleted.rules, "searches": deleted.searches })).into_response()
        }
        Err(error) => database_problem("deleting a folder", &error),
    }
}

/// What deleting a folder took away, for Undo to hand back (`put_back`).
pub struct Deleted {
    pub name: String,
    /// The feeds that were in it.
    pub feeds: Vec<i64>,
    /// Rules for it, now paused and saying so (SPEC section 27).
    pub rules: Vec<i64>,
    /// Saved searches that looked in it, now looking in no folder.
    pub searches: Vec<i64>,
}

/// Deletes one of the reader's folders, the one way every door does it (the
/// screen, sync apps, assistants). Its feeds stay followed; they just leave
/// it. Rules and saved searches for it stay, matching and finding nothing
/// (decisions 0077 and 0081). Answers what Undo needs, or `None` when the
/// reader has no such folder.
pub async fn delete(
    connection: &mut SqliteConnection,
    person: i64,
    id: i64,
) -> Result<Option<Deleted>, sqlx::Error> {
    let feeds: Vec<i64> = sqlx::query_scalar(
        "SELECT feed_id FROM feed_folders WHERE folder_id =
             (SELECT id FROM folders WHERE id = ? AND person_id = ?)",
    )
    .bind(id)
    .bind(person)
    .fetch_all(&mut *connection)
    .await?;
    let name: Option<String> =
        sqlx::query_scalar("DELETE FROM folders WHERE id = ? AND person_id = ? RETURNING name")
            .bind(id)
            .bind(person)
            .fetch_optional(&mut *connection)
            .await?;
    let Some(name) = name else {
        return Ok(None);
    };
    let searches = crate::saved_searches::forget(&mut *connection, person, "folder", id).await?;
    let rules = rules::place_gone(connection, id).await?;
    Ok(Some(Deleted {
        name,
        feeds,
        rules,
        searches,
    }))
}

/// Undo for `delete`: fills the folder made again, numbered `id`, with the
/// feeds the reader still follows, and hands back its rules and saved
/// searches.
pub async fn put_back(
    connection: &mut SqliteConnection,
    person: i64,
    id: i64,
    feeds: &[i64],
    rules: &[i64],
    searches: &[i64],
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR IGNORE INTO feed_folders (folder_id, feed_id)
         SELECT ?, feed_id FROM subscriptions
         WHERE person_id = ? AND feed_id IN (SELECT value FROM json_each(?))
             AND unsubscribed_at IS NULL",
    )
    .bind(id)
    .bind(person)
    .bind(serde_json::to_string(feeds).unwrap_or_else(|_| "[]".to_owned()))
    .execute(&mut *connection)
    .await?;
    rules::back_in_folder(connection, person, id, rules).await?;
    crate::saved_searches::back_in(&mut *connection, person, "folder", id, searches).await?;
    Ok(())
}

fn already(id: i64) -> Response {
    (
        StatusCode::CONFLICT,
        Json(json!({ "error": "already", "folder_id": id })),
    )
        .into_response()
}

fn problem(status: StatusCode, error: &str) -> Response {
    (status, Json(json!({ "error": error }))).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_tidied_and_never_empty() {
        assert_eq!(clean_name("  Tech  ").as_deref(), Some("Tech"));
        assert_eq!(
            clean_name("Long   reads\tand essays").as_deref(),
            Some("Long reads and essays")
        );
        assert_eq!(clean_name("   "), None);
        assert_eq!(clean_name(""), None);
        assert_eq!(
            clean_name(&"a".repeat(LONGEST_NAME)).map(|name| name.len()),
            Some(200)
        );
        assert_eq!(clean_name(&"a".repeat(LONGEST_NAME + 1)), None);
    }
}
