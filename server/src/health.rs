//! The feed health page (SPEC section 17): the feeds that aren't working,
//! worst first, each with what went wrong and three ways to deal with it.
//!
//! - **Which feeds:** a feed is listed once two checks in a row have failed
//!   (one failure is usually a blip that the next check clears). It's
//!   **dead** after a week of "not found" or three weeks of any failure,
//!   and still checked once a day in case it comes back; otherwise it's
//!   **having trouble**. Dead feeds come first, then the longest failing.
//! - **Retry** checks the feed straight away, exactly as background
//!   checking would (`checking::check`), unless the publisher asked nine
//!   turtles to slow down and that wait isn't over: respecting it comes
//!   first.
//! - **Find new address** visits the feed's site (the home page its feed
//!   names, or the feed address's own home page) once, because the reader
//!   asked, and lists the feeds that page names (decision 0016). It never
//!   guesses other addresses.
//! - **Use this address** moves the feed to an address the reader chose:
//!   it keeps its name, folders, articles, read marks and stars. A feed
//!   other readers follow too isn't moved under them: the reader follows
//!   the new address instead, with their name, settings, folders, rules and
//!   saved searches, and every article they had and every mark comes along
//!   (`follow_elsewhere`): nothing of theirs is cleared later.
//! - **Unsubscribe** is the usual one, with Undo (`folders`).
//!
//! The screen turns the short problem word into plain sentences; no error
//! codes are ever shown.

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    checking::{self, DEAD_WHEN_FAILING, DEAD_WHEN_MISSING},
    discover, feed,
    feeds::{Followed, follow_in, make_room, offer_hub, refresh_shared, store_articles},
    fetch::{self, FetchError, Fetched},
    folders, frequency, now,
};

/// Failed checks in a row before a feed is listed.
pub const LISTED_AFTER: i64 = 2;

/// Retry asks a failing feed's publisher at most once in this long; presses
/// in between answer with how the last try went (fetch politely).
pub const RETRY_GAP: i64 = 5 * 60;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/health", get(list))
        .route("/api/health/{id}/retry", post(retry))
        .route("/api/health/{id}/find", post(find))
        .route("/api/health/{id}/address", post(move_to))
}

/// How a feed is doing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Condition {
    Working,
    Trouble,
    Dead,
}

/// One feed as the page shows it.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Entry {
    pub id: i64,
    pub title: String,
    pub url: String,
    pub site_url: Option<String>,
    /// What went wrong last, as a short word (`checking`), or none.
    pub problem: Option<String>,
    /// When its current run of failures began.
    pub failing_since: Option<i64>,
    /// When its current run of "not found" answers began.
    pub missing_since: Option<i64>,
    /// When it last worked, if ever.
    pub fetched_at: Option<i64>,
    /// When it's next checked.
    pub next_check_at: i64,
    pub failures: i64,
    #[sqlx(skip)]
    pub state: Option<Condition>,
    /// How often it posts, in plain words (`frequency`).
    #[sqlx(skip)]
    pub frequency: Option<String>,
}

impl Entry {
    fn judged(mut self, now: i64) -> Self {
        self.state = Some(judge(
            self.failures,
            self.failing_since,
            self.missing_since,
            now,
        ));
        self
    }
}

/// Dead, having trouble, or working, from a feed's failures.
pub fn judge(
    failures: i64,
    failing_since: Option<i64>,
    missing_since: Option<i64>,
    now: i64,
) -> Condition {
    let dead = missing_since.is_some_and(|since| since <= now - DEAD_WHEN_MISSING)
        || failing_since.is_some_and(|since| since <= now - DEAD_WHEN_FAILING);
    if failures == 0 {
        Condition::Working
    } else if dead {
        Condition::Dead
    } else {
        Condition::Trouble
    }
}

/// The feeds a reader follows, by their name for each, as the page shows
/// them, then `$rest`. Takes the reader first.
macro_rules! entries {
    ($rest:literal) => {
        concat!(
            "SELECT feeds.id, subscriptions.title, feeds.url, feeds.site_url, feeds.problem,
                 feeds.failing_since, feeds.missing_since, feeds.fetched_at,
                 feeds.next_check_at, feeds.failures
             FROM subscriptions JOIN feeds ON feeds.id = subscriptions.feed_id
             WHERE subscriptions.person_id = ? AND subscriptions.unsubscribed_at IS NULL ",
            $rest
        )
    };
}

/// The feeds the reader follows that aren't working: dead ones first, then
/// the longest failing, then by name.
pub async fn listed(
    db: &sqlx::SqlitePool,
    person: i64,
    now: i64,
) -> Result<Vec<Entry>, sqlx::Error> {
    let mut entries: Vec<Entry> = sqlx::query_as(entries!(
        "AND feeds.failures >= ?
         ORDER BY feeds.failing_since, subscriptions.title COLLATE NOCASE, feeds.id"
    ))
    .bind(person)
    .bind(LISTED_AFTER)
    .fetch_all(db)
    .await?
    .into_iter()
    .map(|entry: Entry| entry.judged(now))
    .collect();
    // Stable: within each group, the order above stays.
    entries.sort_by_key(|entry| entry.state != Some(Condition::Dead));
    for entry in &mut entries {
        entry.frequency = Some(frequency::words(
            frequency::posting(db, entry.id, now).await?,
            now,
        ));
    }
    Ok(entries)
}

async fn entry(
    db: &sqlx::SqlitePool,
    person: i64,
    id: i64,
    now: i64,
) -> Result<Option<Entry>, sqlx::Error> {
    let entry: Option<Entry> = sqlx::query_as(entries!("AND feeds.id = ?"))
        .bind(person)
        .bind(id)
        .fetch_optional(db)
        .await?;
    match entry {
        Some(entry) => {
            let mut entry = entry.judged(now);
            entry.frequency = Some(frequency::words(
                frequency::posting(db, id, now).await?,
                now,
            ));
            Ok(Some(entry))
        }
        None => Ok(None),
    }
}

async fn list(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    match listed(&state.db, person, now()).await {
        Ok(feeds) => Json(json!({ "feeds": feeds })).into_response(),
        Err(error) => database_problem("listing the feeds that aren't working", &error),
    }
}

fn refused(status: StatusCode, error: &str) -> Response {
    (status, Json(json!({ "error": error }))).into_response()
}

/// Retry: checks the feed now, unless that would be impolite (`may_ask`),
/// and answers how it's doing afterwards.
async fn retry(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let now = now();
    let before = match entry(&state.db, person, id, now).await {
        Ok(Some(before)) => before,
        Ok(None) => return StatusCode::NOT_FOUND.into_response(),
        Err(error) => return database_problem("retrying a feed", &error),
    };
    // The publisher asked for a pause that isn't over: Retry waits too.
    if before.problem.as_deref() == Some("slow-down") && before.next_check_at > now {
        return (
            StatusCode::CONFLICT,
            Json(json!({ "error": "asked-to-wait", "until": before.next_check_at })),
        )
            .into_response();
    }
    if may_ask(&state, &before, now)
        && let Err(error) = checking::check(&state, id, now).await
    {
        return database_problem("retrying a feed", &error);
    }
    let after = entry(&state.db, person, id, now).await;
    match after {
        Ok(Some(after)) => Json(json!({ "feed": after })).into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("retrying a feed", &error),
    }
}

/// Whether Retry may ask the publisher now: a working feed only when it
/// wasn't fetched in the last half hour (as background checking waits), and
/// any feed at most once every `RETRY_GAP`, whoever presses it. Claims the
/// try, so two presses at once ask only once.
fn may_ask(state: &AppState, feed: &Entry, now: i64) -> bool {
    let working = feed.failures == 0;
    if working
        && feed
            .fetched_at
            .is_some_and(|at| at > now - checking::SHORTEST_WAIT)
    {
        return false;
    }
    let mut retried = state
        .retried
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    retried.retain(|_, at| *at > now - RETRY_GAP);
    if retried.contains_key(&feed.id) {
        return false;
    }
    retried.insert(feed.id, now);
    true
}

/// The page Find new address visits: the site the feed names, or the feed
/// address's own home page.
pub fn home_page(site_url: Option<&str>, feed_url: &str) -> Option<Url> {
    let web = |url: Url| matches!(url.scheme(), "http" | "https").then_some(url);
    site_url
        .and_then(|site| Url::parse(site).ok())
        .and_then(web)
        .or_else(|| {
            let mut url = web(Url::parse(feed_url).ok()?)?;
            url.set_path("/");
            url.set_query(None);
            url.set_fragment(None);
            Some(url)
        })
}

fn fetch_refusal(error: &FetchError) -> Response {
    let word = match error {
        FetchError::NotAllowed => "not-allowed",
        FetchError::Status(404 | 410) => "not-found",
        FetchError::TooBig => "too-big",
        _ => "unreachable",
    };
    refused(StatusCode::BAD_GATEWAY, word)
}

/// Find new address: the feeds the site's home page names, other than the
/// one that isn't working and any the reader already follows.
async fn find(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let feed = match entry(&state.db, person, id, now()).await {
        Ok(Some(feed)) => feed,
        Ok(None) => return StatusCode::NOT_FOUND.into_response(),
        Err(error) => return database_problem("finding a feed's new address", &error),
    };
    let Some(page) = home_page(feed.site_url.as_deref(), &feed.url) else {
        return refused(StatusCode::UNPROCESSABLE_ENTITY, "no-feed");
    };
    let fetched = match fetch::get(&state.http, &page, state.config.local_feeds_allowed).await {
        Ok(fetched) => fetched,
        Err(error) => return fetch_refusal(&error),
    };
    // The home page may itself be the feed, now at this address.
    let found = if feed::parse(&fetched.body, &fetched.final_url).is_some() {
        vec![discover::Found {
            title: feed.title.clone(),
            url: fetched.lasting_url.clone(),
        }]
    } else {
        discover::feeds_in(&String::from_utf8_lossy(&fetched.body), &fetched.final_url)
    };
    let mut choices = Vec::new();
    for found in found {
        let followed: Result<Option<i64>, sqlx::Error> = sqlx::query_scalar(
            "SELECT feeds.id FROM feeds JOIN subscriptions ON subscriptions.feed_id = feeds.id
             WHERE feeds.url_key = ? AND subscriptions.person_id = ?
                 AND subscriptions.unsubscribed_at IS NULL",
        )
        .bind(feed::normalize(&found.url))
        .bind(person)
        .fetch_optional(&state.db)
        .await;
        match followed {
            Ok(None) => choices.push(json!({ "title": found.title, "url": found.url.as_str() })),
            Ok(Some(_)) => {}
            Err(error) => return database_problem("finding a feed's new address", &error),
        }
    }
    if choices.is_empty() {
        return refused(StatusCode::UNPROCESSABLE_ENTITY, "no-feed");
    }
    Json(json!({ "page": page.as_str(), "choices": choices })).into_response()
}

#[derive(Deserialize)]
struct NewAddress {
    url: String,
}

/// Use this address: fetches the feed there and, if it is one, moves the
/// feed to it, storing what's new. Its name, folders, articles, read marks
/// and stars stay. The shared feed's address changes only when the reader
/// is its only follower; otherwise they follow the new address instead
/// (`follow_elsewhere`).
async fn move_to(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<NewAddress>,
) -> Response {
    let Some(url) = Url::parse(form.url.trim())
        .ok()
        .filter(|url| matches!(url.scheme(), "http" | "https") && url.host_str().is_some())
    else {
        return refused(StatusCode::BAD_REQUEST, "not-an-address");
    };
    let fetched = match fetch::get(&state.http, &url, state.config.local_feeds_allowed).await {
        Ok(fetched) => fetched,
        Err(error) => return fetch_refusal(&error),
    };
    let Some(parsed) = feed::parse(&fetched.body, &fetched.final_url) else {
        return refused(StatusCode::UNPROCESSABLE_ENTITY, "no-feed");
    };
    let now = now();
    let moved: Result<Result<i64, Response>, sqlx::Error> = async {
        let lasting = &fetched.lasting_url;
        let key = feed::normalize(lasting);
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        if !crate::feeds::follows(&mut transaction, person, id).await? {
            return Ok(Err(StatusCode::NOT_FOUND.into_response()));
        }
        // A feed the reader unsubscribed from at that address, still
        // waiting for Undo, is cleared first, as adding it would.
        make_room(&mut transaction, person, &key).await?;
        // Another feed at that address: one someone follows (`true`), or one
        // unsubscribed from earlier whose line stays for starred articles.
        let taken: Option<bool> = sqlx::query_scalar(
            "SELECT unsubscribed_at IS NULL FROM feeds WHERE url_key = ? AND id != ?",
        )
        .bind(&key)
        .bind(id)
        .fetch_optional(&mut *transaction)
        .await?;
        // Others following the feed (or waiting to Undo) keep its address.
        let others: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM subscriptions WHERE feed_id = ? AND person_id != ? AND cleared = 0",
        )
        .bind(id)
        .bind(person)
        .fetch_one(&mut *transaction)
        .await?;
        if others > 0 || taken == Some(true) {
            let moved =
                follow_elsewhere(&mut transaction, &state, person, id, &fetched, &parsed, now)
                    .await?;
            return Ok(match moved {
                Ok((new, fresh)) => {
                    transaction.commit().await?;
                    if fresh {
                        offer_hub(&state, new, parsed.hub.clone(), now);
                    }
                    Ok(new)
                }
                Err(refusal) => Err(refusal),
            });
        }
        // Merging two feeds is never done quietly, so an address whose line
        // stays for starred articles is refused, in words that say so.
        if taken == Some(false) {
            return Ok(Err(refused(StatusCode::CONFLICT, "kept-stars")));
        }
        let every = checking::rhythm(&parsed, now);
        sqlx::query(
            "UPDATE feeds SET url = ?, url_key = ?, etag = ?, last_modified = ?, fetched_at = ?,
                 check_every = ?, next_check_at = ?, failures = 0, failing_since = NULL,
                 missing_since = NULL, problem = NULL,
                 site_url = COALESCE(?, site_url), language = COALESCE(?, language)
             WHERE id = ?",
        )
        .bind(lasting.as_str())
        .bind(&key)
        .bind(&fetched.etag)
        .bind(&fetched.last_modified)
        .bind(now)
        .bind(every)
        .bind(now + checking::wait(&state, every))
        .bind(&parsed.site_url)
        .bind(&parsed.language)
        .bind(id)
        .execute(&mut *transaction)
        .await?;
        store_articles(&mut transaction, id, &parsed.articles, now).await?;
        transaction.commit().await?;
        Ok(Ok(id))
    }
    .await;
    match moved {
        Ok(Ok(id)) => match entry(&state.db, person, id, now).await {
            Ok(Some(after)) => Json(json!({ "feed": after })).into_response(),
            Ok(None) => StatusCode::NOT_FOUND.into_response(),
            Err(error) => database_problem("moving a feed to a new address", &error),
        },
        Ok(Err(refusal)) => refusal,
        Err(error) => database_problem("moving a feed to a new address", &error),
    }
}

/// Use this address, for a feed others follow too: the reader follows the
/// feed at the new address (stored once, like any other), under their name
/// for the old one and with its settings, folders, rules and saved
/// searches. Every article they had and every mark comes along, as moving
/// in place keeps them (`carry_entries_over`), and their old subscription
/// goes outright: nothing is left to clear later, so nothing of theirs is
/// lost. Answers the feed they follow now, and whether it was stored from
/// this fetch (so its hub is asked).
async fn follow_elsewhere(
    transaction: &mut sqlx::SqliteConnection,
    state: &AppState,
    person: i64,
    old: i64,
    fetched: &Fetched,
    parsed: &feed::ParsedFeed,
    now: i64,
) -> Result<Result<(i64, bool), Response>, sqlx::Error> {
    let (title, river, check_at_most, open_on_site, paused_at): (
        String,
        bool,
        i64,
        bool,
        Option<i64>,
    ) = sqlx::query_as(
        "SELECT title, river, check_at_most, open_on_site, paused_at FROM subscriptions
             WHERE person_id = ? AND feed_id = ?",
    )
    .bind(person)
    .bind(old)
    .fetch_one(&mut *transaction)
    .await?;
    let (new, fresh) = match follow_in(
        &mut *transaction,
        state,
        person,
        fetched,
        parsed,
        &title,
        now,
    )
    .await?
    {
        Followed::New { feed_id, fresh } => (feed_id, fresh),
        Followed::Already(_) => return Ok(Err(refused(StatusCode::CONFLICT, "already"))),
    };
    sqlx::query(
        "UPDATE subscriptions SET river = ?, check_at_most = ?, open_on_site = ?, paused_at = ?
         WHERE person_id = ? AND feed_id = ?",
    )
    .bind(river)
    .bind(check_at_most)
    .bind(open_on_site)
    .bind(paused_at)
    .bind(person)
    .bind(new)
    .execute(&mut *transaction)
    .await?;
    refresh_shared(&mut *transaction, new).await?;
    sqlx::query(
        "INSERT OR IGNORE INTO feed_folders (folder_id, feed_id)
         SELECT feed_folders.folder_id, ?1 FROM feed_folders
         JOIN folders ON folders.id = feed_folders.folder_id
         WHERE feed_folders.feed_id = ?2 AND folders.person_id = ?3",
    )
    .bind(new)
    .bind(old)
    .bind(person)
    .execute(&mut *transaction)
    .await?;
    sqlx::query("UPDATE rules SET feed_id = ? WHERE person_id = ? AND feed_id = ?")
        .bind(new)
        .bind(person)
        .bind(old)
        .execute(&mut *transaction)
        .await?;
    sqlx::query(
        "UPDATE saved_searches SET query = json_set(query, '$.scope.id', ?1)
         WHERE person_id = ?2 AND json_extract(query, '$.scope.kind') = 'feed'
             AND json_extract(query, '$.scope.id') = ?3",
    )
    .bind(new)
    .bind(person)
    .bind(old)
    .execute(&mut *transaction)
    .await?;
    carry_entries_over(&mut *transaction, person, old, new).await?;
    sqlx::query(
        "DELETE FROM feed_folders WHERE feed_id = ?
         AND folder_id IN (SELECT id FROM folders WHERE person_id = ?)",
    )
    .bind(old)
    .bind(person)
    .execute(&mut *transaction)
    .await?;
    // No entry points at it any more (the foreign key would refuse
    // otherwise), so the line can go.
    sqlx::query("DELETE FROM subscriptions WHERE person_id = ? AND feed_id = ?")
        .bind(person)
        .bind(old)
        .execute(&mut *transaction)
        .await?;
    // What the old feed's followers share is worked out again. If nobody
    // else follows it, its articles nobody has any more go; ones the reader
    // still has (carried over) stay, and so does the old feed's line under
    // them.
    folders::let_go(&mut *transaction, old).await?;
    Ok(Ok((new, fresh)))
}

/// Brings one reader's entries for the old feed over to the new one, every
/// mark kept. An old article the new address also lists (the same
/// fingerprint, which prefers the feed's own ID, else the same link) is the
/// same post: its read, star and mute go onto the reader's entry for the
/// new copy, and the old entry goes. Every other old article stays theirs,
/// in the new feed's list, with its marks: the entry now names the new
/// feed, while the article stays stored under the old one, which keeps it
/// while any entry has it (`folders::let_go`).
async fn carry_entries_over(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    old: i64,
    new: i64,
) -> Result<(), sqlx::Error> {
    // The new copy of each old article, if there is one: the same
    // fingerprint first, else the same link (the lowest number if several).
    // Links are compared without their tracking tags: an old article may
    // have been stored with them, its new copy never is (decision 0112).
    let olds: Vec<(i64, String, Option<String>)> = sqlx::query_as(
        "SELECT entries.article_id, articles.fingerprint, articles.link
         FROM entries CROSS JOIN articles ON articles.id = entries.article_id
         WHERE entries.person_id = ? AND entries.feed_id = ?
         ORDER BY entries.article_id",
    )
    .bind(person)
    .bind(old)
    .fetch_all(&mut *connection)
    .await?;
    let twins: Vec<(i64, String, Option<String>)> = sqlx::query_as(
        "SELECT id, fingerprint, link FROM articles WHERE feed_id = ? ORDER BY id DESC",
    )
    .bind(new)
    .fetch_all(&mut *connection)
    .await?;
    let mut by_fingerprint = std::collections::HashMap::new();
    let mut by_link = std::collections::HashMap::new();
    // Highest number first, so the lowest is what's left for each link.
    for (id, fingerprint, link) in twins {
        by_fingerprint.insert(fingerprint, id);
        if let Some(link) = link {
            by_link.insert(feed::link_without_tracking(&link), id);
        }
    }
    let pairs: Vec<(i64, Option<i64>)> = olds
        .into_iter()
        .map(|(article, fingerprint, link)| {
            let copy = by_fingerprint.get(&fingerprint).copied().or_else(|| {
                let link = feed::link_without_tracking(link.as_deref()?);
                by_link.get(&link).copied()
            });
            (article, copy)
        })
        .collect();
    let mut taken = std::collections::HashSet::new();
    for (article, copy) in pairs {
        // Each new copy takes one old article's marks; any other old
        // article that looks the same simply stays, as its own.
        let merged = match copy {
            Some(copy) if copy != article && taken.insert(copy) => {
                sqlx::query(
                    "UPDATE entries SET
                         read = old.read, muted = old.muted,
                         starred = MAX(entries.starred, old.starred)
                     FROM (SELECT read, starred, muted FROM entries
                           WHERE person_id = ?1 AND article_id = ?2) AS old
                     WHERE entries.person_id = ?1 AND entries.article_id = ?3
                         AND entries.feed_id = ?4",
                )
                .bind(person)
                .bind(article)
                .bind(copy)
                .bind(new)
                .execute(&mut *connection)
                .await?
                .rows_affected()
                    > 0
            }
            _ => false,
        };
        if merged {
            // Its collections go with its marks to the copy (decision 0108);
            // a collection already holding the copy keeps the one line.
            sqlx::query(
                "UPDATE OR IGNORE collection_articles SET article_id = ?3
                 WHERE person_id = ?1 AND article_id = ?2",
            )
            .bind(person)
            .bind(article)
            .bind(copy)
            .execute(&mut *connection)
            .await?;
            sqlx::query("DELETE FROM collection_articles WHERE person_id = ? AND article_id = ?")
                .bind(person)
                .bind(article)
                .execute(&mut *connection)
                .await?;
            // Where they stopped in an episode, and its place in Up Next, go
            // with it too (decision 0113); what the old line keeps goes with it.
            for table in ["episode_progress", "up_next"] {
                sqlx::query(sqlx::AssertSqlSafe(format!(
                    "UPDATE OR IGNORE {table} SET article_id = ?3
                     WHERE person_id = ?1 AND article_id = ?2"
                )))
                .bind(person)
                .bind(article)
                .bind(copy)
                .execute(&mut *connection)
                .await?;
            }
            sqlx::query("DELETE FROM entries WHERE person_id = ? AND article_id = ?")
                .bind(person)
                .bind(article)
                .execute(&mut *connection)
                .await?;
        } else {
            sqlx::query("UPDATE entries SET feed_id = ? WHERE person_id = ? AND article_id = ?")
                .bind(new)
                .bind(person)
                .bind(article)
                .execute(&mut *connection)
                .await?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::checking::DAY;

    const NOW: i64 = 1_790_000_000;

    #[test]
    fn a_feed_is_dead_after_a_week_not_found_or_three_weeks_failing() {
        assert_eq!(judge(0, None, None, NOW), Condition::Working);
        assert_eq!(judge(3, Some(NOW - DAY), None, NOW), Condition::Trouble);
        assert_eq!(
            judge(9, Some(NOW - 6 * DAY), Some(NOW - 6 * DAY), NOW),
            Condition::Trouble
        );
        assert_eq!(
            judge(9, Some(NOW - 7 * DAY), Some(NOW - 7 * DAY), NOW),
            Condition::Dead
        );
        assert_eq!(
            judge(9, Some(NOW - 20 * DAY), None, NOW),
            Condition::Trouble
        );
        assert_eq!(judge(9, Some(NOW - 21 * DAY), None, NOW), Condition::Dead);
    }

    #[test]
    fn find_new_address_visits_the_site_or_the_feeds_home_page() {
        let home = |site: Option<&str>, feed: &str| home_page(site, feed).map(String::from);
        assert_eq!(
            home(
                Some("https://blog.example/about"),
                "https://feeds.example/x.xml"
            )
            .as_deref(),
            Some("https://blog.example/about")
        );
        assert_eq!(
            home(None, "https://blog.example/feed.xml?x=1#y").as_deref(),
            Some("https://blog.example/")
        );
        // A site address that isn't a web page: the feed's home page instead.
        assert_eq!(
            home(Some("javascript:alert(1)"), "http://blog.example/rss").as_deref(),
            Some("http://blog.example/")
        );
        assert_eq!(home(None, "not an address"), None);
    }
}
