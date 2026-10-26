//! Checking feeds in the background, politely (SPEC section 11,
//! ENGINEERING.md → "Fetching feeds"), so new articles are waiting when the
//! reader comes back.
//!
//! - Every feed has its own rhythm (`rhythm`): half the time it usually
//!   takes to publish, never less than 30 minutes and never more than a day.
//!   A blog that has gone quiet is checked once a day.
//! - Every 30 seconds a round looks at the feeds whose time has come, at
//!   most 20, four at a time, so checks are spread out and never all at once.
//!   Each wait is nudged by up to a tenth at random, so feeds added together
//!   drift apart.
//! - Each check says what nine turtles already has (`fetch::check`), so an
//!   unchanged feed costs the publisher a few bytes.
//! - A failing feed waits twice as long after each failure in a row, up to a
//!   day, and never holds up another feed. A publisher who asks nine turtles to
//!   slow down gets at least the wait they asked for.
//! - A feed whose every follower has been away for a month is checked once
//!   a day, until one of them comes back (`admin`).
//! - Only the feed file is fetched, never an article's page.
//!
//! The screen doesn't change when articles arrive: it says "New items" and
//! waits for the reader (`feeds::new_articles`).

use std::{sync::atomic::Ordering, time::Duration};

use reqwest::Url;
use serde::Serialize;
use tokio::task::JoinSet;

use crate::{
    AppState, admin,
    feed::{self, ParsedFeed},
    feeds::store_articles,
    fetch::{self, Answer, FetchError, Fetched, Known},
    folders, log, now, websub,
};

pub const MINUTE: i64 = 60;
pub const HOUR: i64 = 60 * MINUTE;
pub const DAY: i64 = 24 * HOUR;
/// Never more often than this (SPEC section 11).
pub const SHORTEST_WAIT: i64 = 30 * MINUTE;
/// At least once a day, working or failing.
pub const LONGEST_WAIT: i64 = DAY;
/// For a feed that gives no dates: a few times a day.
pub const UNKNOWN_RHYTHM: i64 = 4 * HOUR;
/// The longest "slow down" nine turtles obeys, so a mistaken answer can't
/// silence a feed for good.
pub const LONGEST_SLOW_DOWN: i64 = 7 * DAY;
/// "Not found" this long, or failing this long, and a feed counts as dead
/// (ENGINEERING.md → "Fetching feeds"). It's still checked once a day.
pub const DEAD_WHEN_MISSING: i64 = 7 * DAY;
pub const DEAD_WHEN_FAILING: i64 = 21 * DAY;
/// Failing this long, and the daily check mentions it.
pub const KEEPS_FAILING: i64 = 3 * DAY;

const ROUND_EVERY: Duration = Duration::from_secs(30);
const PER_ROUND: i64 = 20;
const AT_ONCE: usize = 4;

/// The feeds whose time has come, the longest-waiting first, from the
/// `feeds_due` index (tests/speed.rs checks this).
pub const DUE: &str = "SELECT id FROM feeds WHERE next_check_at <= ? AND unsubscribed_at IS NULL
         AND newsletter_of IS NULL
     ORDER BY next_check_at, id LIMIT ?";

/// Runs for as long as nine turtles does: a round, a pause, another round.
pub async fn run(state: AppState) {
    // The browser tests check every feed every few seconds, so rounds come quicker.
    let pause = if state.config.test_check_seconds.is_some() {
        Duration::from_secs(1)
    } else {
        ROUND_EVERY
    };
    loop {
        if let Err(error) = round(&state, now()).await {
            log::problem(&format!(
                "background checking couldn't read the database: {error}"
            ));
        }
        state.last_round.store(now(), Ordering::Relaxed);
        tokio::time::sleep(pause).await;
    }
}

/// Checks the feeds due at `now`: at most 20, four at a time. Returns how
/// many were checked. First, feeds unsubscribed long enough ago that Undo
/// is no longer offered are cleared for good (`folders::clear_unsubscribed`),
/// and emailed links past their time are deleted (`accounts::tidy_links`).
pub async fn round(state: &AppState, now: i64) -> Result<usize, sqlx::Error> {
    folders::clear_unsubscribed(&state.db, None, now - folders::UNDO_FOR).await?;
    // Emailed links past their time go, even when no new one is made.
    crate::accounts::tidy_links(&state.db, now).await?;
    websub::renew(state, now).await?;
    let due: Vec<i64> = sqlx::query_scalar(DUE)
        .bind(now)
        .bind(PER_ROUND)
        .fetch_all(&state.db)
        .await?;
    let count = due.len();
    let mut waiting = due.into_iter();
    let mut checks = JoinSet::new();
    loop {
        while checks.len() < AT_ONCE {
            let Some(id) = waiting.next() else { break };
            let state = state.clone();
            checks.spawn(async move { (id, check(&state, id, now).await) });
        }
        match checks.join_next().await {
            None => break,
            Some(Ok((_, Ok(())))) => {}
            Some(Ok((id, Err(error)))) => log::problem(&format!(
                "database error while checking feed {id} in the background: {error}"
            )),
            Some(Err(error)) => log::problem(&format!("a background check stopped: {error}")),
        }
    }
    Ok(count)
}

#[derive(sqlx::FromRow)]
struct Due {
    url: String,
    etag: Option<String>,
    last_modified: Option<String>,
    check_every: i64,
    /// The shortest wait the reader allows this feed (Edit feed): 0, an
    /// hour or a day; a day while every follower is away.
    check_at_most: i64,
    failures: i64,
    /// Every follower is away (`admin::AWAY_AFTER`).
    away: bool,
}

/// Checks one feed and stores what's new. Every outcome sets when the feed
/// is next due; a database problem is the only error.
pub async fn check(state: &AppState, feed_id: i64, now: i64) -> Result<(), sqlx::Error> {
    // Pushed back first, so even if saving the result fails, the publisher
    // isn't asked again in the next round.
    let claimed =
        // A newsletter feed has nothing to fetch: its articles arrive by email.
        sqlx::query(
            "UPDATE feeds SET next_check_at = ? WHERE id = ? AND unsubscribed_at IS NULL
             AND newsletter_of IS NULL",
        )
            .bind(now + SHORTEST_WAIT)
            .bind(feed_id)
            .execute(&state.db)
            .await?;
    if claimed.rows_affected() == 0 {
        // Unsubscribed in the meantime, or a newsletter.
        return Ok(());
    }
    let mut feed: Due = sqlx::query_as(concat!(
        "SELECT url, etag, last_modified, check_every, check_at_most, failures, ",
        admin::everyone_away!("?1"),
        " AS away FROM feeds WHERE id = ?2"
    ))
    .bind(now - admin::AWAY_AFTER)
    .bind(feed_id)
    .fetch_one(&state.db)
    .await?;
    // Nobody who follows it has been here for a month: once a day is plenty
    // until one of them comes back (`admin::here`).
    if feed.away {
        feed.check_at_most = feed.check_at_most.max(admin::AWAY_WAIT);
    }
    let Ok(url) = Url::parse(&feed.url) else {
        return failed(state, feed_id, &feed, Failure::NotAnAddress, now).await;
    };
    let known = Known {
        etag: feed.etag.as_deref(),
        last_modified: feed.last_modified.as_deref(),
    };
    match fetch::check(&state.http, &url, state.config.local_feeds_allowed, &known).await {
        Ok(Answer::Changed(fetched)) => match feed::parse(&fetched.body, &fetched.final_url) {
            Some(parsed) => {
                let lasting = fetched.lasting_url.clone();
                worked(
                    state,
                    feed_id,
                    &feed,
                    &lasting,
                    Some((&fetched, &parsed)),
                    now,
                )
                .await?;
                websub::offered(state, feed_id, parsed.hub.as_ref(), now).await
            }
            None => failed(state, feed_id, &feed, Failure::NotAFeed, now).await,
        },
        Ok(Answer::Unchanged { lasting_url }) => {
            worked(state, feed_id, &feed, &lasting_url, None, now).await
        }
        Err(error) => failed(state, feed_id, &feed, Failure::Fetch(error), now).await,
    }
}

/// The feed answered: store what's new, remember what the publisher said,
/// and set the next check by the feed's rhythm. `changed` is empty when the
/// publisher said "nothing new".
async fn worked(
    state: &AppState,
    feed_id: i64,
    feed: &Due,
    lasting_url: &Url,
    changed: Option<(&Fetched, &ParsedFeed)>,
    now: i64,
) -> Result<(), sqlx::Error> {
    // IMMEDIATE: take the right to write from the start, waiting for any
    // other write to finish, so this can't fail half way when a reader's
    // marks are saved at the same moment.
    let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
    // Unsubscribed while it was being fetched: nothing to store.
    let followed: Option<i64> =
        sqlx::query_scalar("SELECT id FROM feeds WHERE id = ? AND unsubscribed_at IS NULL")
            .bind(feed_id)
            .fetch_optional(&mut *transaction)
            .await?;
    if followed.is_none() {
        return transaction.commit().await;
    }
    let (every, etag, last_modified) = match changed {
        Some((fetched, parsed)) => {
            store_articles(&mut transaction, feed_id, &parsed.articles, now).await?;
            (
                rhythm(parsed, now),
                fetched.etag.clone(),
                fetched.last_modified.clone(),
            )
        }
        None => (
            feed.check_every,
            feed.etag.clone(),
            feed.last_modified.clone(),
        ),
    };
    // While a hub delivers new articles, this check is only the backup:
    // at most twice a day (decision 0069).
    // "Check at most hourly" or "daily", chosen in Edit feed, is the
    // shortest rhythm, nudged only upwards so it's never sooner. A day is
    // also the longest wait, so a daily feed waits exactly a day: daily
    // feeds still drift apart, since each was last checked at its own time.
    let mut next = if state.config.test_check_seconds.is_some() {
        wait(state, every)
    } else {
        wait(state, every.max(feed.check_at_most)).max(feed.check_at_most)
    };
    if state.config.test_check_seconds.is_none()
        && websub::delivering(&state.db, feed_id, now).await?
    {
        next = next.max(websub::BACKUP_WAIT);
    }
    sqlx::query(
        "UPDATE feeds SET etag = ?, last_modified = ?, fetched_at = ?, check_every = ?,
             next_check_at = ?, failures = 0, failing_since = NULL, missing_since = NULL,
             problem = NULL
         WHERE id = ?",
    )
    .bind(etag)
    .bind(last_modified)
    .bind(now)
    .bind(every)
    .bind(now + next)
    .bind(feed_id)
    .execute(&mut *transaction)
    .await?;
    // Moved for good: remember the new address. If another followed feed
    // already has it, keep this one's as it is ("OR IGNORE").
    if lasting_url.as_str() != feed.url {
        sqlx::query("UPDATE OR IGNORE feeds SET url = ?, url_key = ? WHERE id = ?")
            .bind(lasting_url.as_str())
            .bind(feed::normalize(lasting_url))
            .bind(feed_id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await
}

#[derive(Debug)]
enum Failure {
    NotAnAddress,
    NotAFeed,
    Fetch(FetchError),
}

impl Failure {
    /// A short word for the logs (and the V2 feed health page). Never the
    /// feed's address or name.
    fn word(&self) -> String {
        match self {
            Self::NotAnAddress => "not-an-address".into(),
            Self::NotAFeed => "not-a-feed".into(),
            Self::Fetch(FetchError::NotAllowed) => "not-allowed".into(),
            Self::Fetch(FetchError::Unreachable) => "unreachable".into(),
            Self::Fetch(FetchError::Status(404 | 410)) => "not-found".into(),
            Self::Fetch(FetchError::Status(code)) => format!("answered-{code}"),
            Self::Fetch(FetchError::TooBig) => "too-big".into(),
            Self::Fetch(FetchError::SlowDown(_)) => "slow-down".into(),
        }
    }
}

/// The feed didn't work this time: wait longer before the next try.
async fn failed(
    state: &AppState,
    feed_id: i64,
    feed: &Due,
    failure: Failure,
    now: i64,
) -> Result<(), sqlx::Error> {
    let failures = feed.failures + 1;
    let mut next = backoff(feed.check_every.max(feed.check_at_most), failures);
    if let Failure::Fetch(FetchError::SlowDown(Some(asked))) = failure {
        next = next.max(asked.min(LONGEST_SLOW_DOWN));
    }
    let next = state.config.test_check_seconds.unwrap_or(next);
    let missing = matches!(failure, Failure::Fetch(FetchError::Status(404 | 410)));
    let word = failure.word();
    log::info(&format!(
        "feed {feed_id} couldn't be checked ({word}, {failures} in a row); trying again in {} minutes",
        next / MINUTE
    ));
    sqlx::query(
        "UPDATE feeds SET failures = ?, failing_since = COALESCE(failing_since, ?),
             missing_since = CASE WHEN ? THEN COALESCE(missing_since, ?) END,
             problem = ?, next_check_at = ?
         WHERE id = ?",
    )
    .bind(failures)
    .bind(now)
    .bind(missing)
    .bind(now)
    .bind(word)
    .bind(now + next)
    .bind(feed_id)
    .execute(&state.db)
    .await?;
    Ok(())
}

/// How long to wait between checks of a working feed: half the time it
/// usually takes between articles, or since its newest one if that's longer
/// (a blog gone quiet), between 30 minutes and a day. Judged from the ten
/// newest dated articles; a feed with no dates gets a few times a day.
pub fn rhythm(feed: &ParsedFeed, now: i64) -> i64 {
    rhythm_from(
        feed.articles
            .iter()
            .filter_map(|article| article.published_at)
            .collect(),
        now,
    )
}

fn rhythm_from(mut dates: Vec<i64>, now: i64) -> i64 {
    // A date in the future counts as now.
    for date in &mut dates {
        *date = (*date).min(now);
    }
    dates.sort_unstable_by(|a, b| b.cmp(a));
    dates.dedup();
    dates.truncate(10);
    let (Some(&newest), Some(&oldest)) = (dates.first(), dates.last()) else {
        return UNKNOWN_RHYTHM;
    };
    let gaps = i64::try_from(dates.len() - 1).unwrap_or(1).max(1);
    let usual_gap = (newest - oldest) / gaps;
    let quiet_for = now - newest;
    (usual_gap.max(quiet_for) / 2).clamp(SHORTEST_WAIT, LONGEST_WAIT)
}

/// After `failures` failed checks in a row: the feed's own wait, doubled for
/// each, up to a day.
pub fn backoff(every: i64, failures: i64) -> i64 {
    let doublings = u32::try_from(failures.clamp(0, 16)).unwrap_or(16);
    every
        .max(SHORTEST_WAIT)
        .saturating_mul(1 << doublings)
        .min(LONGEST_WAIT)
}

/// The wait before a working feed's next check: its rhythm, nudged by up to
/// a tenth either way at random, so feeds added together drift apart. The
/// browser tests set their own short wait instead.
pub fn wait(state: &AppState, every: i64) -> i64 {
    if let Some(seconds) = state.config.test_check_seconds {
        return seconds;
    }
    nudged(every, random_fraction())
}

/// `every` moved by `fraction` (from -1 to 1) of a tenth, kept within the
/// shortest and longest waits.
fn nudged(every: i64, fraction: f64) -> i64 {
    #[allow(clippy::cast_possible_truncation, clippy::cast_precision_loss)]
    let nudge = (every as f64 * 0.1 * fraction) as i64;
    (every + nudge).clamp(SHORTEST_WAIT, LONGEST_WAIT)
}

/// A random number from -1 to 1; 0 if the computer can't give one.
fn random_fraction() -> f64 {
    let mut bytes = [0u8; 4];
    if getrandom::fill(&mut bytes).is_err() {
        return 0.0;
    }
    f64::from(u32::from_le_bytes(bytes)) / f64::from(u32::MAX) * 2.0 - 1.0
}

/// How the feeds are doing, as counts only: the diagnostics page shows
/// these and the daily check reports "Some feeds keep failing". Never which
/// feeds they are (ENGINEERING.md → "Sign-in and security").
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Health {
    pub feeds_followed: i64,
    /// Failed their latest check.
    pub feeds_failing: i64,
    /// Failing for three days or more.
    pub feeds_failing_for_days: i64,
    /// Not found for a week, or failing for three weeks.
    pub feeds_dead: i64,
}

pub async fn health(db: &sqlx::SqlitePool, now: i64) -> Result<Health, sqlx::Error> {
    sqlx::query_as(
        "SELECT COUNT(*) AS feeds_followed,
                COALESCE(SUM(failures > 0), 0) AS feeds_failing,
                COALESCE(SUM(failing_since <= ?), 0) AS feeds_failing_for_days,
                COALESCE(SUM(missing_since <= ? OR failing_since <= ?), 0) AS feeds_dead
         FROM feeds WHERE unsubscribed_at IS NULL",
    )
    .bind(now - KEEPS_FAILING)
    .bind(now - DEAD_WHEN_MISSING)
    .bind(now - DEAD_WHEN_FAILING)
    .fetch_one(db)
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_790_000_000;

    fn every(gap: i64, count: i64) -> Vec<i64> {
        (0..count).map(|number| NOW - number * gap).collect()
    }

    #[test]
    fn each_feed_is_checked_on_its_own_rhythm() {
        // Every hour: as often as allowed, every 30 minutes.
        assert_eq!(rhythm_from(every(HOUR, 10), NOW), SHORTEST_WAIT);
        // Once a day: twice a day.
        assert_eq!(rhythm_from(every(DAY, 10), NOW), 12 * HOUR);
        // Once a week: once a day, the longest wait.
        assert_eq!(rhythm_from(every(7 * DAY, 10), NOW), LONGEST_WAIT);
        // Used to publish hourly, but nothing for a month: once a day.
        let quiet: Vec<i64> = every(HOUR, 10).iter().map(|at| at - 30 * DAY).collect();
        assert_eq!(rhythm_from(quiet, NOW), LONGEST_WAIT);
        // Daily, last article 20 hours ago: still twice a day.
        let late: Vec<i64> = every(DAY, 10).iter().map(|at| at - 20 * HOUR).collect();
        assert_eq!(rhythm_from(late, NOW), 12 * HOUR);
        // No dates: a few times a day. Dates in the future count as now.
        assert_eq!(rhythm_from(vec![], NOW), UNKNOWN_RHYTHM);
        assert_eq!(
            rhythm_from(vec![NOW + 5 * DAY, NOW + 9 * DAY], NOW),
            SHORTEST_WAIT
        );
        // Only the ten newest count: an old burst doesn't matter.
        let mut mixed = every(HOUR, 10);
        mixed.extend(every(DAY, 40).iter().map(|at| at - 400 * DAY));
        assert_eq!(rhythm_from(mixed, NOW), SHORTEST_WAIT);
    }

    #[test]
    fn a_failing_feed_waits_twice_as_long_each_time_up_to_a_day() {
        assert_eq!(backoff(HOUR, 1), 2 * HOUR);
        assert_eq!(backoff(HOUR, 2), 4 * HOUR);
        assert_eq!(backoff(HOUR, 4), 16 * HOUR);
        assert_eq!(backoff(HOUR, 5), DAY);
        assert_eq!(backoff(HOUR, 500), DAY);
        assert_eq!(backoff(12 * HOUR, 1), DAY);
        // Never less than the shortest wait, even if the stored rhythm were odd.
        assert_eq!(backoff(0, 1), 2 * SHORTEST_WAIT);
    }

    #[test]
    fn waits_are_nudged_by_up_to_a_tenth_and_stay_within_limits() {
        assert_eq!(nudged(10 * HOUR, 1.0), 11 * HOUR);
        assert_eq!(nudged(10 * HOUR, -1.0), 9 * HOUR);
        assert_eq!(nudged(10 * HOUR, 0.0), 10 * HOUR);
        assert_eq!(nudged(SHORTEST_WAIT, -1.0), SHORTEST_WAIT);
        assert_eq!(nudged(LONGEST_WAIT, 1.0), LONGEST_WAIT);
        let spread: std::collections::HashSet<i64> = (0..20)
            .map(|_| nudged(10 * HOUR, random_fraction()))
            .collect();
        assert!(spread.len() > 1, "{spread:?}");
        assert!(
            spread
                .iter()
                .all(|wait| (9 * HOUR..=11 * HOUR).contains(wait))
        );
    }
}
