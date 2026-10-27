//! How often a feed posts, in plain words (SPEC sections 15 and 17,
//! decision 0105): "Posts about 3 times a week", "Posts about once a
//! month", "Hasn't posted in 4 months", "Too new to tell". Shown quietly in
//! Edit feed and on the feed health page. Rounded words only: no chart, no
//! decimals, no judgement.
//!
//! Counted from the feed's articles of the last 90 days by the time the list
//! sorts them by (`sort_at`: when the publisher says it was published, or
//! when it arrived if they don't say, never later than that), through the
//! `articles_newest_by_feed` index. A feed's articles are the feed's, shared
//! by its readers; only a reader who follows the feed is told.

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
use serde_json::json;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    now,
};

const DAY: i64 = 86_400;
/// How far back the counting looks.
pub const WINDOW_DAYS: i64 = 90;
/// Less history than this, or fewer articles than `FEWEST`, is too new to tell.
const SHORTEST_DAYS: i64 = 14;
const FEWEST: i64 = 3;

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/feeds/{id}/frequency", get(read))
}

/// What the words are worked out from.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, sqlx::FromRow)]
pub struct Posting {
    /// Its newest and oldest article's time, if it has any.
    pub newest: Option<i64>,
    pub oldest: Option<i64>,
    /// How many articles it has, up to `FEWEST` (more isn't needed).
    pub some: i64,
    /// How many it posted in the last `WINDOW_DAYS`.
    pub recent: i64,
}

/// The facts for feed `feed`, as of `now`, each read from the index alone.
pub async fn posting(db: &sqlx::SqlitePool, feed: i64, now: i64) -> Result<Posting, sqlx::Error> {
    sqlx::query_as(
        "SELECT (SELECT MAX(sort_at) FROM articles WHERE feed_id = ?1) AS newest,
                (SELECT MIN(sort_at) FROM articles WHERE feed_id = ?1) AS oldest,
                (SELECT COUNT(*) FROM (SELECT 1 FROM articles WHERE feed_id = ?1 LIMIT ?3)) AS some,
                (SELECT COUNT(*) FROM articles WHERE feed_id = ?1 AND sort_at > ?2) AS recent",
    )
    .bind(feed)
    .bind(now - WINDOW_DAYS * DAY)
    .bind(FEWEST)
    .fetch_one(db)
    .await
}

/// The words for a feed, for reader `person`; `None` if they don't follow it.
pub async fn for_reader(
    db: &sqlx::SqlitePool,
    person: i64,
    feed: i64,
    now: i64,
) -> Result<Option<String>, sqlx::Error> {
    let follows: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM subscriptions
             WHERE person_id = ? AND feed_id = ? AND unsubscribed_at IS NULL)",
    )
    .bind(person)
    .bind(feed)
    .fetch_one(db)
    .await?;
    if !follows {
        return Ok(None);
    }
    Ok(Some(words(posting(db, feed, now).await?, now)))
}

async fn read(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match for_reader(&state.db, person, id, now()).await {
        Ok(Some(words)) => Json(json!({ "words": words })).into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("working out how often a feed posts", &error),
    }
}

/// "2 months", "a year", "3 years": a quiet span, rounded down.
fn span(days: i64) -> String {
    let (count, unit) = if days >= 365 {
        (days / 365, "year")
    } else if days >= 60 {
        (days / 30, "month")
    } else if days >= 14 {
        (days / 7, "week")
    } else {
        (days.max(1), "day")
    };
    if count == 1 {
        format!("a {unit}")
    } else {
        format!("{count} {unit}s")
    }
}

/// "once", "twice" or "3 times".
fn times(count: i64) -> String {
    match count {
        1 => "once".to_owned(),
        2 => "twice".to_owned(),
        _ => format!("{count} times"),
    }
}

/// How often a feed posts, in plain rounded words.
pub fn words(posting: Posting, now: i64) -> String {
    let (Some(newest), Some(oldest)) = (posting.newest, posting.oldest) else {
        return "Too new to tell".to_owned();
    };
    if posting.recent == 0 {
        return format!("Hasn't posted in {}", span((now - newest) / DAY));
    }
    let history = (now - oldest).clamp(0, WINDOW_DAYS * DAY);
    if posting.some < FEWEST || history < SHORTEST_DAYS * DAY {
        return "Too new to tell".to_owned();
    }
    // Per day, in hundredths, so the rounding stays in whole numbers.
    let per_day = posting.recent * DAY * 100 / history;
    let per_week = per_day * 7;
    let per_month = per_day * 30;
    // Rounded to the nearest whole number, from hundredths.
    let round = |hundredths: i64| (hundredths + 50) / 100;
    if per_day >= 150 {
        format!("Posts about {} a day", round(per_day))
    } else if per_day >= 75 {
        "Posts about once a day".to_owned()
    } else if per_week >= 150 {
        format!("Posts about {} a week", times(round(per_week)))
    } else if per_week >= 75 {
        "Posts about once a week".to_owned()
    } else if per_month >= 150 {
        format!("Posts about {} a month", times(round(per_month)))
    } else if per_month >= 75 {
        "Posts about once a month".to_owned()
    } else {
        "Posts less than once a month".to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_800_000_000;

    /// A feed with `recent` posts in the window and more before, the oldest
    /// `history` days ago.
    fn words_for(recent: i64, history: i64) -> String {
        words(
            Posting {
                newest: Some(NOW - DAY),
                oldest: Some(NOW - history * DAY),
                some: FEWEST,
                recent,
            },
            NOW,
        )
    }

    #[test]
    fn busy_feeds_post_so_many_a_day() {
        assert_eq!(words_for(12 * 90, 400), "Posts about 12 a day");
        assert_eq!(words_for(2 * 90, 90), "Posts about 2 a day");
        assert_eq!(words_for(90, 90), "Posts about once a day");
    }

    #[test]
    fn steady_feeds_post_so_many_a_week_or_month() {
        assert_eq!(words_for(39, 90), "Posts about 3 times a week");
        assert_eq!(words_for(26, 90), "Posts about twice a week");
        assert_eq!(words_for(13, 90), "Posts about once a week");
        assert_eq!(words_for(6, 90), "Posts about twice a month");
        assert_eq!(words_for(3, 90), "Posts about once a month");
        assert_eq!(words_for(1, 90), "Posts less than once a month");
    }

    #[test]
    fn a_young_feed_is_counted_over_its_own_history() {
        // Ten posts in its first three weeks: about three a week.
        assert_eq!(words_for(10, 21), "Posts about 3 times a week");
    }

    #[test]
    fn a_feed_too_new_or_too_small_says_so() {
        assert_eq!(words_for(20, 10), "Too new to tell");
        let two = Posting {
            newest: Some(NOW - DAY),
            oldest: Some(NOW - 300 * DAY),
            some: 2,
            recent: 1,
        };
        assert_eq!(words(two, NOW), "Too new to tell");
        assert_eq!(words(Posting::default(), NOW), "Too new to tell");
    }

    #[test]
    fn a_quiet_feed_says_how_long_since() {
        let quiet = |days: i64| {
            words(
                Posting {
                    newest: Some(NOW - days * DAY),
                    oldest: Some(NOW - 2_000 * DAY),
                    some: 3,
                    recent: 0,
                },
                NOW,
            )
        };
        assert_eq!(quiet(91), "Hasn't posted in 3 months");
        assert_eq!(quiet(130), "Hasn't posted in 4 months");
        assert_eq!(quiet(400), "Hasn't posted in a year");
        assert_eq!(quiet(800), "Hasn't posted in 2 years");
    }
}
