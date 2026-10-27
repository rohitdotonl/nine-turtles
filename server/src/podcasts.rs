//! Podcasts (SPEC section 34, decision 0111): where each reader stopped in
//! each episode, and their Up Next. Each reader's alone, like every mark.
//!
//! nine turtles never fetches, copies or passes on an episode's audio: the
//! reader's browser plays the publisher's own file from the publisher's own
//! address (the publisher floor). The server only keeps, per reader, a
//! position in seconds (`episode_progress`) and an order (`up_next`), both
//! tied to the reader's own entry for the article (structure change 24), so
//! they go with it when the entry goes.
//!
//! - `GET /api/episodes/{id}/progress`: where the reader stopped, or null.
//! - `POST /api/episodes/{id}/progress` `{position, duration, finished, at}`:
//!   the latest save wins (`at`, milliseconds, as marks are; never later
//!   than the server's own now).
//! - `GET /api/up-next`: the episodes lined up, in order, by number.
//! - `POST /api/up-next` `{articles}`: the whole new order (adding, moving
//!   and removing are all this). Only the reader's own episodes are kept, at
//!   most `MOST_UP_NEXT`.
//! - The list itself is `GET /api/articles?view=upnext` (`list`).

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::ArticleRow,
    marks::now_ms,
};

/// The most episodes one reader's Up Next holds.
pub const MOST_UP_NEXT: usize = 200;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/episodes/{id}/progress",
            get(progress).post(save_progress),
        )
        .route("/api/up-next", get(up_next).post(set_up_next))
}

#[derive(Debug, PartialEq, Serialize, sqlx::FromRow)]
pub struct Progress {
    /// Where the reader stopped, in seconds from the start.
    pub position: f64,
    /// How long the episode turned out to be, in seconds, if known.
    pub duration: Option<f64>,
    /// Played to (nearly) the end.
    pub finished: bool,
    /// When it was saved (milliseconds, by the server's clock), so a device
    /// can tell whether its own copy, kept while offline, is newer.
    pub saved_at: i64,
}

/// Where reader `person` stopped in episode `id`, if anywhere.
pub async fn progress_of(
    db: &sqlx::SqlitePool,
    person: i64,
    id: i64,
) -> Result<Option<Progress>, sqlx::Error> {
    sqlx::query_as(
        "SELECT position, duration, finished, saved_at FROM episode_progress
         WHERE person_id = ? AND article_id = ?",
    )
    .bind(person)
    .bind(id)
    .fetch_optional(db)
    .await
}

async fn progress(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match progress_of(&state.db, person, id).await {
        Ok(progress) => Json(json!({ "progress": progress })).into_response(),
        Err(error) => database_problem("reading where an episode stopped", &error),
    }
}

#[derive(Deserialize)]
struct Saving {
    position: f64,
    duration: Option<f64>,
    #[serde(default)]
    finished: bool,
    /// When the device saved it (milliseconds since 1970, by the server's
    /// clock as the device knows it); just now if absent.
    at: Option<i64>,
}

/// Keeps where the reader stopped. Only an episode they have (an entry of
/// theirs that is an episode); any other is not found. A save older than
/// the one kept changes nothing, so a late save from another device never
/// takes the reader back.
async fn save_progress(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<Saving>,
) -> Response {
    let sensible = |seconds: f64| seconds.is_finite() && (0.0..=86_400.0 * 7.0).contains(&seconds);
    if !sensible(form.position) || form.duration.is_some_and(|duration| !sensible(duration)) {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let now = now_ms();
    let at = form.at.map_or(now, |at| at.min(now));
    let saved = sqlx::query(
        "INSERT INTO episode_progress (person_id, article_id, position, duration, finished, saved_at)
         SELECT entries.person_id, entries.article_id, ?3, ?4, ?5, ?6
         FROM entries JOIN articles ON articles.id = entries.article_id
         WHERE entries.person_id = ?1 AND entries.article_id = ?2
             AND articles.episode_url IS NOT NULL
         ON CONFLICT (person_id, article_id) DO UPDATE SET
             position = excluded.position, duration = excluded.duration,
             finished = excluded.finished, saved_at = excluded.saved_at
         WHERE excluded.saved_at >= episode_progress.saved_at",
    )
    .bind(person)
    .bind(id)
    .bind(form.position)
    .bind(form.duration)
    .bind(form.finished)
    .bind(at)
    .execute(&state.db)
    .await;
    match saved {
        Ok(_) => match is_episode_of(&state.db, person, id).await {
            Ok(true) => StatusCode::NO_CONTENT.into_response(),
            Ok(false) => StatusCode::NOT_FOUND.into_response(),
            Err(error) => database_problem("saving where an episode stopped", &error),
        },
        Err(error) => database_problem("saving where an episode stopped", &error),
    }
}

/// Whether article `id` is an episode reader `person` has.
async fn is_episode_of(db: &sqlx::SqlitePool, person: i64, id: i64) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM entries JOIN articles ON articles.id = entries.article_id
             WHERE entries.person_id = ? AND entries.article_id = ?
                 AND articles.episode_url IS NOT NULL)",
    )
    .bind(person)
    .bind(id)
    .fetch_one(db)
    .await
}

/// The reader's Up Next, in order, by article number.
pub async fn order_of(db: &sqlx::SqlitePool, person: i64) -> Result<Vec<i64>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT article_id FROM up_next WHERE person_id = ? ORDER BY place, article_id",
    )
    .bind(person)
    .fetch_all(db)
    .await
}

async fn up_next(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    match order_of(&state.db, person).await {
        Ok(articles) => Json(json!({ "articles": articles })).into_response(),
        Err(error) => database_problem("reading Up Next", &error),
    }
}

#[derive(Deserialize)]
struct NewOrder {
    articles: Vec<i64>,
}

/// Replaces the reader's Up Next with this order. An article named twice
/// counts once, where it's first named; one that isn't an episode they have
/// is left out. Answers the order kept.
async fn set_up_next(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<NewOrder>,
) -> Response {
    if form.articles.len() > MOST_UP_NEXT * 2 {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
    let mut seen = std::collections::HashSet::new();
    let wanted: Vec<i64> = form
        .articles
        .into_iter()
        .filter(|id| seen.insert(*id))
        .take(MOST_UP_NEXT)
        .collect();
    let set = async {
        let mut transaction = state.db.begin().await?;
        sqlx::query("DELETE FROM up_next WHERE person_id = ?")
            .bind(person)
            .execute(&mut *transaction)
            .await?;
        sqlx::query(
            "INSERT INTO up_next (person_id, article_id, place)
             SELECT entries.person_id, entries.article_id, wanted.key
             FROM json_each(?2) AS wanted
                 JOIN entries ON entries.person_id = ?1 AND entries.article_id = wanted.value
                 JOIN articles ON articles.id = entries.article_id
             WHERE articles.episode_url IS NOT NULL",
        )
        .bind(person)
        .bind(Value::from(wanted).to_string())
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        order_of(&state.db, person).await
    }
    .await;
    match set {
        Ok(articles) => Json(json!({ "articles": articles })).into_response(),
        Err(error) => database_problem("saving Up Next", &error),
    }
}

/// The Up Next list, in the reader's order, as the item list shows it: only
/// episodes of feeds they still follow (one they left leaves it with its
/// entry). Muted ones stay: the reader lined them up themselves.
const LIST: &str =
    "SELECT entries.article_id AS id, entries.feed_id, subscriptions.title AS feed_title,
            articles.title, articles.link, entries.sort_at AS at,
            entries.read, entries.starred, entries.muted,
            articles.episode_url IS NOT NULL AS episode, articles.episode_seconds
     FROM up_next CROSS JOIN entries ON entries.person_id = up_next.person_id
             AND entries.article_id = up_next.article_id
         CROSS JOIN articles ON articles.id = entries.article_id
         CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
             AND subscriptions.feed_id = entries.feed_id
     WHERE up_next.person_id = ? AND subscriptions.unsubscribed_at IS NULL
     ORDER BY up_next.place, up_next.article_id";

/// The whole list: it's never longer than `MOST_UP_NEXT`, one page.
pub async fn list(db: &sqlx::SqlitePool, person: i64) -> Result<Vec<ArticleRow>, sqlx::Error> {
    sqlx::query_as(LIST).bind(person).fetch_all(db).await
}
