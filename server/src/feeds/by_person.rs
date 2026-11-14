//! Unread, by person (SPEC section 6, decision 0271): each person's unread
//! articles together under their name, people first, then publications
//! (one nine turtles couldn't sort waits with them, decision 0264). A
//! person is who the sidebar shows: their places joined into one, else a
//! place on its own. People are ordered by their newest unread article, and
//! their articles newest first (both oldest first in that order); a page is
//! still 50.
//!
//! Every page lists the reader's unread articles that had arrived when the
//! list was first loaded (`latest`), so nothing arriving meanwhile moves a
//! person, and each page carries on from the person the last one ended in,
//! where they were then: an article read on screen never pulls its person
//! up or down under the reader. A person passed already can come back
//! later only with articles already listed, which the screen leaves out.

use super::{ArticleRow, Order};

/// Which person an article is listed under: a person's places share their
/// number in `writers`, made negative; a place on its own is its own
/// feed's number. Zero is no one's. The weekly email groups by it too.
macro_rules! whose {
    () => {
        "COALESCE(-subscriptions.writer_id, subscriptions.feed_id)"
    };
}
pub(crate) use whose;

/// Where a page of Unread ended: the person (`whose!`) it ended in, where
/// that person stood (a publication or not, and their newest unread
/// article's time, or oldest's), and the newest article number counted
/// (`LATEST` when the list was first loaded).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Place {
    pub publication: bool,
    pub group_at: i64,
    pub whose: i64,
    pub latest: i64,
}

/// Unread by person, in an order. Takes the reader, the newest article
/// number counted, where the page starts (whether publications, the time
/// that placed the person, the person, then the article's time and number)
/// and the limit. The person a page ended in comes first, from where it
/// ended; then everyone placed after them.
///
/// It never places every unread article: each place's newest (or oldest)
/// unread time and count come from the reader's unread entries alone
/// (`places`), each person's from their places' (`people`), and only the
/// people needed to fill the page, by those counts, have their articles
/// read and sorted (`placed`). So a reader with a year unread waits no
/// longer than one who keeps up (tests/speed.rs).
macro_rules! by_person_query {
    ($group:literal, $past:literal, $after:literal, $order:literal) => {
        concat!(
            "WITH places AS MATERIALIZED (
                 SELECT feed_id, ",
            $group,
            "(sort_at) AS at, COUNT(*) AS unread FROM entries
                 WHERE person_id = ?1 AND read = 0 AND article_id <= ?2 GROUP BY feed_id),
             theirs AS MATERIALIZED (
                 SELECT places.feed_id, places.at, places.unread, ",
            whose!(),
            " AS whose, ",
            crate::feeds::kind!(),
            " = 'publication' AS late
                 FROM places CROSS JOIN subscriptions ON subscriptions.person_id = ?1
                     AND subscriptions.feed_id = places.feed_id
                 WHERE subscriptions.unsubscribed_at IS NULL),
             people AS (
                 SELECT whose, whose = ?5 AS going_on,
                     CASE WHEN whose = ?5 THEN ?3 ELSE MAX(late) END AS late,
                     CASE WHEN whose = ?5 THEN ?4 ELSE ",
            $group,
            "(at) END AS group_at,
                     CASE WHEN whose = ?5 THEN 0 ELSE SUM(unread) END AS unread
                 FROM theirs GROUP BY whose),
             needed AS (
                 SELECT whose, going_on, late, group_at FROM (
                     SELECT *, SUM(unread) OVER (ORDER BY going_on DESC, late, group_at ",
            $order,
            ", whose ROWS UNBOUNDED PRECEDING) - unread AS before
                     FROM people WHERE going_on OR ",
            $after,
            ") WHERE before < ?8),
             placed AS (
                 SELECT entries.article_id AS id, entries.sort_at AS at, needed.whose,
                     needed.going_on, needed.late, needed.group_at
                 FROM needed CROSS JOIN theirs ON theirs.whose = needed.whose
                     CROSS JOIN entries ON entries.person_id = ?1 AND entries.feed_id = theirs.feed_id
                 WHERE entries.read = 0 AND entries.article_id <= ?2
                     AND (NOT needed.going_on OR (entries.sort_at, entries.article_id) ",
            $past,
            " (?6, ?7))
                 ORDER BY needed.going_on DESC, needed.late, needed.group_at ",
            $order,
            ", needed.whose, entries.sort_at ",
            $order,
            ", entries.article_id ",
            $order,
            " LIMIT ?8)
             SELECT ",
            crate::feeds::article_row!(),
            ", placed.whose, placed.late AS publication, placed.group_at
             FROM placed CROSS JOIN ",
            crate::feeds::article_row_joins!(),
            " WHERE entries.person_id = ?1 AND entries.article_id = placed.id
             ORDER BY placed.going_on DESC, placed.late, placed.group_at ",
            $order,
            ", placed.whose, placed.at ",
            $order,
            ", placed.id ",
            $order
        )
    };
}

/// The question for Unread by person in an order (tests/speed.rs times it).
pub const fn by_person_sql(order: Order) -> &'static str {
    match order {
        Order::Newest => by_person_query!(
            "MAX",
            "<",
            "(late, -group_at, whose) > (?3, -?4, ?5)",
            "DESC"
        ),
        Order::Oldest => {
            by_person_query!("MIN", ">", "(late, group_at, whose) > (?3, ?4, ?5)", "ASC")
        }
    }
}

/// One page of Unread by person, from the start or from where the last one
/// ended (`after`: that page's last article's time and number, and its
/// place). One extra row is asked for, to know whether another page exists.
pub(super) async fn unread_by_person(
    db: &sqlx::SqlitePool,
    person: i64,
    order: Order,
    after: Option<(i64, i64, Place)>,
) -> Result<(Vec<ArticleRow>, Option<(i64, i64, Place)>), sqlx::Error> {
    let (at, id, place) = match after {
        Some(after) => after,
        None => {
            let latest: i64 = sqlx::query_scalar(super::LATEST).fetch_one(db).await?;
            // Nobody is numbered 0, and every person is placed after "-1".
            let start = Place {
                publication: false,
                group_at: 0,
                whose: 0,
                latest,
            };
            (0, 0, start)
        }
    };
    let starting = after.is_none();
    let mut rows: Vec<ArticleRow> = sqlx::query_as(by_person_sql(order))
        .bind(person)
        .bind(place.latest)
        .bind(if starting {
            -1
        } else {
            i64::from(place.publication)
        })
        .bind(place.group_at)
        .bind(place.whose)
        .bind(at)
        .bind(id)
        .bind(super::PAGE_SIZE + 1)
        .fetch_all(db)
        .await?;
    let next = if rows.len() > usize::try_from(super::PAGE_SIZE).unwrap_or(usize::MAX) {
        rows.pop();
        rows.last().map(|last| {
            let place = Place {
                publication: last.publication.unwrap_or(false),
                group_at: last.group_at.unwrap_or(0),
                whose: last.whose.unwrap_or(0),
                latest: place.latest,
            };
            (last.at, last.id, place)
        })
    } else {
        None
    };
    Ok((rows, next))
}
