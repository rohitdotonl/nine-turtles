//! Settling who could be either (SPEC section 15, decision 0263): on
//! Everyone you follow, each tick makes one a person at once, and "The rest
//! are publications" settles every one left; Undo puts back what each was,
//! so one the reader hadn't settled is open again.

use axum::{
    Json,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Deserialize;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    writers::kind::{Kind, WHYS},
};

#[derive(Deserialize)]
pub struct Settle {
    feeds: Vec<Settled>,
}

/// One place, what it is now, and why: left out, the reader chose it.
#[derive(Deserialize)]
struct Settled {
    feed: i64,
    kind: Kind,
    why: Option<String>,
}

/// `POST /api/tidy/settle`: every place named, at once or not at all. Only
/// the reader's own places on their own; a place joined to others is a
/// person whatever it says.
pub async fn settle(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Settle>,
) -> Response {
    let known = form
        .feeds
        .iter()
        .all(|place| place.why.as_deref().is_none_or(|why| WHYS.contains(&why)));
    if form.feeds.is_empty() || form.feeds.len() > super::MOST_AT_ONCE || !known {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let settled = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        for place in &form.feeds {
            sqlx::query(
                "UPDATE subscriptions SET kind = ?, kind_why = COALESCE(?, 'reader')
                 WHERE person_id = ? AND feed_id = ? AND writer_id IS NULL
                     AND unsubscribed_at IS NULL",
            )
            .bind(place.kind.name())
            .bind(place.why.as_deref())
            .bind(person)
            .bind(place.feed)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await
    }
    .await;
    match settled {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("settling people and publications", &error),
    }
}
