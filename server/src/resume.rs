//! Pick up where you left off (SPEC section 7, decision 0175): the one
//! article the reader last left part of the way through, and their place in
//! it, kept on the server so every device they sign in on can offer it. Each
//! device still keeps its own places for every article (decision 0060);
//! this is only the latest one, so it stays a single `person_settings` row
//! (`resume`), stored as `article block within`.
//!
//! The screen sets it a moment after the reader stops scrolling part of the
//! way through (`PUT /api/resume`), and lets it go once they reach the end,
//! scroll back to the top or open something else (`DELETE /api/resume?id=`,
//! which only lets go of that article, so a device that's behind never
//! forgets a newer place). `GET /api/resume` says what to offer, or `null`.

use axum::{
    Json, Router,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::ArticleRow,
};

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/resume", get(read).put(keep).delete(forget))
}

/// Where the reader stopped: which block of the article's text was at the
/// top of the window, and how far down that block (0 to 1).
#[derive(Clone, Copy, Debug, PartialEq, Deserialize)]
pub struct Place {
    pub id: i64,
    pub block: u32,
    pub within: f64,
}

impl Place {
    fn stored(self) -> String {
        format!("{} {} {}", self.id, self.block, self.within)
    }

    fn from_stored(stored: &str) -> Option<Self> {
        let mut parts = stored.split(' ');
        let place = Self {
            id: parts.next()?.parse().ok()?,
            block: parts.next()?.parse().ok()?,
            within: parts.next()?.parse().ok()?,
        };
        (parts.next().is_none() && (0.0..=1.0).contains(&place.within)).then_some(place)
    }
}

/// The article, with its writer's name when known: the name the reader
/// gave the person (SPEC section 36), else the article's own author. Only an
/// article still listed (not muted, its feed still followed) is offered.
const ARTICLE: &str = "SELECT entries.article_id AS id, entries.feed_id,
            COALESCE(writers.name, subscriptions.title) AS feed_title,
            articles.title, articles.link, entries.sort_at AS at,
            entries.read, entries.starred, entries.muted,
            articles.episode_url IS NOT NULL AS episode, articles.episode_seconds,
            NULLIF(TRIM(COALESCE(writers.name, articles.author, '')), '') AS signed_by
     FROM entries CROSS JOIN articles ON articles.id = entries.article_id
         CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
             AND subscriptions.feed_id = entries.feed_id
         LEFT JOIN writers ON writers.id = subscriptions.writer_id
     WHERE entries.person_id = ? AND entries.article_id = ? AND entries.muted = 0
         AND subscriptions.unsubscribed_at IS NULL";

#[derive(sqlx::FromRow)]
struct Offered {
    #[sqlx(flatten)]
    article: ArticleRow,
    signed_by: Option<String>,
}

/// What to offer the reader, if anything: the article, its writer and the place.
pub async fn offered(
    db: &SqlitePool,
    person: i64,
) -> Result<Option<serde_json::Value>, sqlx::Error> {
    let stored: Option<String> = sqlx::query_scalar(
        "SELECT value FROM person_settings WHERE person_id = ? AND name = 'resume'",
    )
    .bind(person)
    .fetch_optional(db)
    .await?;
    let Some(place) = stored.as_deref().and_then(Place::from_stored) else {
        return Ok(None);
    };
    let found: Option<Offered> = sqlx::query_as(ARTICLE)
        .bind(person)
        .bind(place.id)
        .fetch_optional(db)
        .await?;
    Ok(found.map(|found| {
        json!({
            "article": found.article,
            "writer": found.signed_by,
            "block": place.block,
            "within": place.within,
        })
    }))
}

async fn read(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    match offered(&state.db, person).await {
        Ok(offer) => Json(offer).into_response(),
        Err(error) => database_problem("reading where the reader left off", &error),
    }
}

/// Keeps `place` as where the reader left off, if it's an article they have.
pub async fn set(db: &SqlitePool, person: i64, place: Place) -> Result<bool, sqlx::Error> {
    let changed = sqlx::query(
        "INSERT INTO person_settings (person_id, name, value)
             SELECT ?1, 'resume', ?3 FROM entries WHERE person_id = ?1 AND article_id = ?2
         ON CONFLICT (person_id, name) DO UPDATE SET value = excluded.value",
    )
    .bind(person)
    .bind(place.id)
    .bind(place.stored())
    .execute(db)
    .await?
    .rows_affected();
    Ok(changed > 0)
}

async fn keep(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(place): Json<Place>,
) -> Response {
    if !(0.0..=1.0).contains(&place.within) {
        return StatusCode::UNPROCESSABLE_ENTITY.into_response();
    }
    match set(&state.db, person, place).await {
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("keeping where the reader left off", &error),
    }
}

#[derive(Deserialize)]
struct Which {
    id: i64,
}

/// Lets go of where the reader left off, only if it's still article `id`.
pub async fn clear(db: &SqlitePool, person: i64, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM person_settings WHERE person_id = ? AND name = 'resume'
         AND value LIKE ? || ' %'",
    )
    .bind(person)
    .bind(id.to_string())
    .execute(db)
    .await
    .map(|_| ())
}

async fn forget(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Query(which): Query<Which>,
) -> Response {
    match clear(&state.db, person, which.id).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("letting go of where the reader left off", &error),
    }
}

#[cfg(test)]
mod tests {
    use super::Place;

    #[test]
    fn a_place_is_stored_as_three_words_and_read_back() {
        let place = Place {
            id: 42,
            block: 7,
            within: 0.25,
        };
        assert_eq!(place.stored(), "42 7 0.25");
        assert_eq!(Place::from_stored("42 7 0.25"), Some(place));
        for broken in ["", "42", "42 7", "42 7 2", "x 7 0.5", "42 7 0.5 9"] {
            assert_eq!(Place::from_stored(broken), None, "{broken}");
        }
    }
}
