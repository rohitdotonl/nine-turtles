//! The owner report (decision 0130, `docs/operations/owner-report.md`): a
//! hidden, read-only address (`GET /owner-report`) for the owner's own
//! manual, kept apart from nine turtles. It answers only to its own key
//! (`NINE_TURTLES_OWNER_REPORT_KEY`, in an `Authorization: Bearer` header);
//! without that setting it answers "not found", as if it didn't exist.
//!
//! Counts and dates only: when the last backups were taken and how many are
//! kept, how many readers there are and how many were here lately, how many
//! pay, and the days plans renew or end in the next 30 days. Never a name,
//! an email, a reader's number, or anything about what anyone reads.

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, header},
    response::{IntoResponse, Response},
    routing::get,
};
use serde::Serialize;
use serde_json::json;

use crate::{
    AppState, admin,
    auth::database_problem,
    backup,
    checking::DAY,
    db, log, now,
    payments::{self, Standing},
};

/// How far ahead the days plans renew or end are shown.
const COMING_UP: i64 = 30 * DAY;
/// Readers who joined, or were here, this recently are counted.
const LATELY: i64 = 30 * DAY;

pub fn routes() -> Router<AppState> {
    Router::new().route("/owner-report", get(report))
}

/// How many readers stand where, for paying. While payments are off,
/// everyone is free.
#[derive(Debug, Default, Serialize)]
struct Paying {
    free: usize,
    trial: usize,
    paid: usize,
    on_hold: usize,
    ended: usize,
}

/// A day something happens to a plan, in the next `COMING_UP`; never whose.
#[derive(Debug, Serialize, PartialEq, Eq, PartialOrd, Ord)]
struct Upcoming {
    /// Such as `2026-11-03` (UTC).
    day: String,
    /// `renews`, `ends` (cancelled, or a renewal still failing), or `trial-ends`.
    what: &'static str,
}

async fn report(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some(refused) =
        crate::status::key_refused(&headers, state.config.owner_report_key.as_deref())
    {
        return refused;
    }
    let now = now();
    let found = match admin::totals(&state.db, now).await {
        Ok(totals) => admin::readers(&state.db, now)
            .await
            .map(|readers| (totals, readers)),
        Err(error) => Err(error),
    };
    let (totals, readers) = match found {
        Ok(found) => found,
        Err(error) => return database_problem("gathering the owner report", &error),
    };

    let mut paying = Paying::default();
    let mut coming_up = Vec::new();
    for reader in &readers {
        let standing = match payments::standing(&state, reader.id, now).await {
            Ok(standing) => standing,
            Err(error) => return database_problem("reading a plan for the owner report", &error),
        };
        let (count, upcoming) = match standing {
            Standing::Free => (&mut paying.free, None),
            Standing::Trial { ends_at } => (&mut paying.trial, Some((ends_at, "trial-ends"))),
            Standing::Paid {
                until, renews_at, ..
            } => (
                &mut paying.paid,
                Some(renews_at.map_or((until, "ends"), |at| (at, "renews"))),
            ),
            Standing::OnHold { until } => (&mut paying.on_hold, Some((until, "ends"))),
            Standing::Ended => (&mut paying.ended, None),
        };
        *count += 1;
        if let Some((at, what)) = upcoming.filter(|(at, _)| *at <= now + COMING_UP) {
            coming_up.push(Upcoming {
                day: backup::day_name(at),
                what,
            });
        }
    }
    // Sorted by day, so the order never hints at which reader is which.
    coming_up.sort();

    let backups = match &state.storage {
        None => json!({ "on": false }),
        Some(storage) => match backup::kept(storage).await {
            Ok(kept) => json!({ "on": true, "kept": kept }),
            Err(error) => {
                log::problem(&format!(
                    "the owner report couldn't list the backups: {error}"
                ));
                json!({ "on": true, "kept": null })
            }
        },
    };

    (
        [(header::CACHE_CONTROL, "no-store")],
        Json(json!({
            "version": crate::VERSION,
            "generated_at": now,
            "started_at": state.started_at,
            "database_bytes": db::size_in_bytes(&state.config.data_dir),
            "problems_since_start": log::recent_problems().len(),
            "backups": backups,
            "readers": {
                "total": totals.readers,
                "joined_last_30_days": readers
                    .iter()
                    .filter(|reader| reader.created_at > now - LATELY)
                    .count(),
                "here_last_30_days": readers
                    .iter()
                    .filter(|reader| reader.last_here > now - LATELY)
                    .count(),
            },
            "feeds": {
                "followed": totals.feeds,
                "resting": totals.feeds_resting,
                "failing": totals.feeds_failing,
            },
            "articles": totals.articles,
            "payments": {
                "on": state.config.payments.is_some(),
                "live": state.config.payments.as_ref().is_some_and(|settings| settings.live),
                "readers": paying,
                "coming_up": coming_up,
            },
        })),
    )
        .into_response()
}
