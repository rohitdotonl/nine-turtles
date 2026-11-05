//! How often a feed posts, in plain words (SPEC sections 15 and 17,
//! decision 0105): "Posts about 3 times a week", "Posts about once a
//! month", "Hasn't posted in 4 months", "Too new to tell". Shown quietly on
//! the feed health page and, as a feed is chosen, in Add. Rounded words only: no chart, no
//! decimals, no judgement.
//!
//! Counted from the feed's articles of the last 90 days by the time the list
//! sorts them by (`sort_at`: when the publisher says it was published, or
//! when it arrived if they don't say, never later than that), through the
//! `articles_newest_by_feed` index. A feed's articles are the feed's, shared
//! by its readers; only a reader who follows the feed is told.
//!
//! The yearly clean-up (`cleanup`) removes unstarred articles a year after
//! they arrived, so a long-silent feed may have none left, or only an old
//! starred one. A silence of a year or more is therefore only ever "over a
//! year", and a feed with no articles is counted from when nine turtles
//! started fetching it.

use crate::cleanup;

const DAY: i64 = 86_400;
/// How far back the counting looks.
pub const WINDOW_DAYS: i64 = 90;
/// Less history than this, or fewer articles than `FEWEST`, is too new to tell.
const SHORTEST_DAYS: i64 = 14;
const FEWEST: i64 = 3;
/// How many dated posts tell a feed's pace from less than two weeks.
const SHORT_SPAN_FEWEST: usize = 5;

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
    /// When nine turtles started fetching it.
    pub added: i64,
}

/// The facts for feed `feed`, as of `now`, each read from the index alone.
pub async fn posting(db: &sqlx::SqlitePool, feed: i64, now: i64) -> Result<Posting, sqlx::Error> {
    sqlx::query_as(
        "SELECT (SELECT MAX(sort_at) FROM articles WHERE feed_id = ?1) AS newest,
                (SELECT MIN(sort_at) FROM articles WHERE feed_id = ?1) AS oldest,
                (SELECT COUNT(*) FROM (SELECT 1 FROM articles WHERE feed_id = ?1 LIMIT ?3)) AS some,
                (SELECT COUNT(*) FROM articles WHERE feed_id = ?1 AND sort_at > ?2) AS recent,
                (SELECT added_at FROM feeds WHERE id = ?1) AS added",
    )
    .bind(feed)
    .bind(now - WINDOW_DAYS * DAY)
    .bind(FEWEST)
    .fetch_one(db)
    .await
}

/// "2 months", "3 weeks", "a day": a quiet span under a year, rounded down.
fn span(days: i64) -> String {
    let (count, unit) = if days >= 60 {
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

/// "Hasn't posted in 4 months", for a silence of `seconds`. From a year on,
/// the clean-up may have removed what came later, so only "over a year".
fn silent_for(seconds: i64) -> String {
    if seconds >= cleanup::KEPT_FOR {
        "Hasn't posted in over a year".to_owned()
    } else {
        format!("Hasn't posted in {}", span(seconds / DAY))
    }
}

/// How often a feed posts, in plain rounded words.
pub fn words(posting: Posting, now: i64) -> String {
    let (Some(newest), Some(oldest)) = (posting.newest, posting.oldest) else {
        // None left: silent since it was added, or since the clean-up's
        // year if it was emptied by it.
        let since = now - posting.added;
        if since < SHORTEST_DAYS * DAY {
            return "Too new to tell".to_owned();
        }
        return silent_for(since);
    };
    if posting.recent == 0 {
        return silent_for(now - newest);
    }
    let history = (now - oldest).clamp(0, WINDOW_DAYS * DAY);
    if posting.some < FEWEST || history < SHORTEST_DAYS * DAY {
        return "Too new to tell".to_owned();
    }
    rate(posting.recent, history)
}

/// How often `posts` over `history` seconds is, in words.
fn rate(posts: i64, history: i64) -> String {
    // Per day, in hundredths, so the rounding stays in whole numbers.
    let per_day = posts * DAY * 100 / history.max(1);
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

/// How often a feed nine turtles hasn't stored posts, from the dates its
/// articles give (a site's several feeds, when the reader chooses one,
/// SPEC section 3); `None` if none is dated. A date in the future counts as
/// now, as it does for stored articles.
pub fn of_dates(dates: impl Iterator<Item = i64>, now: i64) -> Option<String> {
    let dates: Vec<i64> = dates.map(|date| date.min(now)).collect();
    let posting = Posting {
        newest: Some(*dates.iter().max()?),
        oldest: dates.iter().min().copied(),
        some: i64::try_from(dates.len()).unwrap_or(i64::MAX).min(FEWEST),
        recent: i64::try_from(
            dates
                .iter()
                .filter(|date| **date > now - WINDOW_DAYS * DAY)
                .count(),
        )
        .unwrap_or(i64::MAX),
        added: now,
    };
    // A busy feed holds only its last few days: enough posts tell its pace
    // from that span alone, where a stored feed would wait two weeks.
    let span = now - posting.oldest.unwrap_or(now);
    if dates.len() >= SHORT_SPAN_FEWEST && span < SHORTEST_DAYS * DAY {
        return Some(rate(posting.recent, span.max(DAY)));
    }
    Some(words(posting, now))
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
                added: NOW - history * DAY,
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
            added: NOW - 300 * DAY,
        };
        assert_eq!(words(two, NOW), "Too new to tell");
        let empty = Posting {
            added: NOW - 3 * DAY,
            ..Posting::default()
        };
        assert_eq!(words(empty, NOW), "Too new to tell");
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
                    added: NOW - 2_000 * DAY,
                },
                NOW,
            )
        };
        assert_eq!(quiet(91), "Hasn't posted in 3 months");
        assert_eq!(quiet(130), "Hasn't posted in 4 months");
        assert_eq!(quiet(300), "Hasn't posted in 10 months");
        // A year on, the clean-up may have removed later posts.
        assert_eq!(quiet(400), "Hasn't posted in over a year");
        assert_eq!(quiet(800), "Hasn't posted in over a year");
    }

    #[test]
    fn a_feed_with_no_articles_left_counts_from_when_it_was_added() {
        let empty = |days: i64| {
            words(
                Posting {
                    added: NOW - days * DAY,
                    ..Posting::default()
                },
                NOW,
            )
        };
        assert_eq!(empty(10), "Too new to tell");
        assert_eq!(empty(130), "Hasn't posted in 4 months");
        // Emptied by the yearly clean-up: nothing arrived in the last year.
        assert_eq!(empty(900), "Hasn't posted in over a year");
    }

    #[test]
    fn a_feed_not_stored_is_told_from_its_dates() {
        let week = 7 * DAY;
        let dates = (0..26).map(|weeks| NOW - weeks * week / 2);
        assert_eq!(
            of_dates(dates, NOW).as_deref(),
            Some("Posts about twice a week")
        );
        assert_eq!(of_dates(std::iter::empty(), NOW), None);
        let old = [NOW - 400 * DAY, NOW - 500 * DAY, NOW - 600 * DAY];
        assert_eq!(
            of_dates(old.into_iter(), NOW).as_deref(),
            Some("Hasn't posted in over a year")
        );
        // A busy feed holding only its last few days isn't "too new".
        let busy = (0..20).map(|hours| NOW - hours * DAY / 4);
        assert_eq!(of_dates(busy, NOW).as_deref(), Some("Posts about 4 a day"));
    }
}
