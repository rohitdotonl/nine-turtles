//! A picture for each person and publication (SPEC section 36, decision
//! 0284): beside an article's byline and at the top of their page.
//!
//! Most come from elsewhere and never pass through here: the picture the
//! feed names (`feeds.picture_url`), or the site's own icon, both loaded by
//! the reader's browser from the publisher's site, as an article's pictures
//! are. This file keeps only the picture a reader chose for someone they
//! follow: one per person, a copy kept on each of their places (as a note
//! is), so it stays when one place goes; each reader's own.
//! The web app makes it small (a square of `SIDE` pixels) before sending it,
//! so it's a few kilobytes; nine turtles refuses anything that isn't a JPEG,
//! PNG or WebP picture, or is bigger than `LARGEST`.

use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Path, State},
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde_json::json;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    now, refused,
};

/// The biggest picture kept, in bytes: far more than a small square needs.
pub const LARGEST: usize = 256 * 1024;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/feeds/{id}/picture",
            get(picture).merge(post(choose).layer(DefaultBodyLimit::max(LARGEST))),
        )
        .route("/api/feeds/{id}/picture/delete", post(reset))
}

/// The picture's kind, from its first bytes, never from what the sender says.
pub fn kind_of(image: &[u8]) -> Option<&'static str> {
    if image.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if image.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if image.len() >= 12 && &image[0..4] == b"RIFF" && &image[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

/// The reader's places that stand for the same person as this one: it, and
/// every other place joined to it. Takes the reader (?1) and the place (?2).
macro_rules! same_person {
    () => {
        "SELECT feed_id FROM subscriptions
         WHERE person_id = ?1 AND unsubscribed_at IS NULL AND (feed_id = ?2 OR writer_id =
             (SELECT writer_id FROM subscriptions WHERE person_id = ?1 AND feed_id = ?2
                  AND unsubscribed_at IS NULL))"
    };
}

/// The picture the reader chose for the person this place is one of, if any.
pub async fn chosen(
    db: &sqlx::SqlitePool,
    person: i64,
    feed: i64,
) -> Result<Option<(Vec<u8>, String)>, sqlx::Error> {
    sqlx::query_as(concat!(
        "SELECT image, type FROM pictures WHERE person_id = ?1 AND feed_id IN (",
        same_person!(),
        ") ORDER BY chosen_at DESC LIMIT 1"
    ))
    .bind(person)
    .bind(feed)
    .fetch_optional(db)
    .await
}

/// Keeps a picture for the person this place is one of, on each of their
/// places, in place of any they had. Answers when it was chosen (its version), or None when the
/// reader doesn't follow this place.
pub async fn choose_picture(
    db: &sqlx::SqlitePool,
    person: i64,
    feed: i64,
    image: &[u8],
    kind: &str,
) -> Result<Option<i64>, sqlx::Error> {
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let follows: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM subscriptions
             WHERE person_id = ? AND feed_id = ? AND unsubscribed_at IS NULL)",
    )
    .bind(person)
    .bind(feed)
    .fetch_one(&mut *transaction)
    .await?;
    if !follows {
        return Ok(None);
    }
    forget(&mut transaction, person, feed).await?;
    let at = now();
    sqlx::query(concat!(
        "INSERT INTO pictures (person_id, feed_id, image, type, chosen_at)
         SELECT ?1, feed_id, ?3, ?4, ?5 FROM (",
        same_person!(),
        ")"
    ))
    .bind(person)
    .bind(feed)
    .bind(image)
    .bind(kind)
    .bind(at)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(at))
}

/// Takes off the picture chosen for the person this place is one of.
async fn forget(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    feed: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(concat!(
        "DELETE FROM pictures WHERE person_id = ?1 AND feed_id IN (",
        same_person!(),
        ")"
    ))
    .bind(person)
    .bind(feed)
    .execute(connection)
    .await?;
    Ok(())
}

async fn picture(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match chosen(&state.db, person, id).await {
        Ok(Some((image, kind))) => (
            [
                (
                    header::CONTENT_TYPE,
                    HeaderValue::from_str(&kind).unwrap_or(HeaderValue::from_static("image/jpeg")),
                ),
                // Its address carries its version (`?v=`), so a browser keeps it until it changes.
                (
                    header::CACHE_CONTROL,
                    HeaderValue::from_static("private, max-age=31536000, immutable"),
                ),
                (
                    header::CONTENT_SECURITY_POLICY,
                    HeaderValue::from_static("default-src 'none'"),
                ),
            ],
            image,
        )
            .into_response(),
        Ok(None) => refused(StatusCode::NOT_FOUND, "not-found"),
        Err(error) => database_problem("showing a picture", &error),
    }
}

async fn choose(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    body: Bytes,
) -> Response {
    let Some(kind) = kind_of(&body) else {
        return refused(StatusCode::UNSUPPORTED_MEDIA_TYPE, "not-a-picture");
    };
    match choose_picture(&state.db, person, id, &body, kind).await {
        Ok(Some(at)) => Json(json!({ "chosen": at })).into_response(),
        Ok(None) => refused(StatusCode::NOT_FOUND, "not-found"),
        Err(error) => database_problem("keeping a picture", &error),
    }
}

async fn reset(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let forgotten = async {
        let mut connection = state.db.acquire().await?;
        forget(&mut connection, person, id).await
    }
    .await;
    match forgotten {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("taking off a picture", &error),
    }
}

#[cfg(test)]
mod tests {
    use super::kind_of;

    #[test]
    fn only_pictures_are_kept() {
        assert_eq!(kind_of(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("image/jpeg"));
        assert_eq!(kind_of(b"\x89PNG\r\n\x1a\n...."), Some("image/png"));
        assert_eq!(kind_of(b"RIFF\0\0\0\0WEBPVP8 "), Some("image/webp"));
        assert_eq!(kind_of(b"<svg xmlns=\"http://www.w3.org/2000/svg\">"), None);
        assert_eq!(kind_of(b"GIF89a"), None);
        assert_eq!(kind_of(b""), None);
    }
}
