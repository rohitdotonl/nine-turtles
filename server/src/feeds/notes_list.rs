//! The Notes list (SPEC section 42, decision 0308): every article the
//! reader highlighted or wrote a note on, grouped by person, as Unread is
//! (`by_person`): the person with the newest mark first, and within each
//! person the article with the newest mark first. Each article carries its
//! marks, newest first, for the list to show in place of a date.
//!
//! It is one page: the reader's own marks, a short list however long they
//! read, and a grouping that pages would split.

use std::collections::HashMap;

use serde::Serialize;

use super::{ArticleRow, by_person::whose};

/// One of the reader's marks on an article, as the Notes list shows it: the
/// words highlighted, with the note on them; or, with no words, the note on
/// the whole article.
#[derive(Clone, Debug, Serialize, sqlx::FromRow, PartialEq, Eq)]
pub struct Mark {
    #[serde(skip)]
    pub article_id: i64,
    pub quote: Option<String>,
    pub note: Option<String>,
}

/// The marked articles in the list's order. Each article is placed by its
/// newest mark (`at`, the highest note number breaking a tie), and each
/// person by their newest article's. Takes the reader.
pub const NOTES_SQL: &str = concat!(
    "WITH marked AS MATERIALIZED (
         SELECT article_id, MAX(made_at) AS at, MAX(id) AS last FROM notes
         WHERE person_id = ?1 GROUP BY article_id),
     placed AS (
         SELECT marked.article_id, marked.at, marked.last, ",
    whose!(),
    " AS whose
         FROM marked CROSS JOIN entries ON entries.person_id = ?1
                 AND entries.article_id = marked.article_id
             CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
                 AND subscriptions.feed_id = entries.feed_id),
     ranked AS (
         SELECT *, MAX(at) OVER (PARTITION BY whose) AS group_at,
             MAX(last) OVER (PARTITION BY whose) AS group_last
         FROM placed)
     SELECT ",
    super::article_row!(),
    ", ranked.whose, ranked.group_at
     FROM ranked CROSS JOIN ",
    super::article_row_joins!(),
    " WHERE entries.person_id = ?1 AND entries.article_id = ranked.article_id
     ORDER BY ranked.group_at DESC, ranked.group_last DESC, ranked.at DESC, ranked.last DESC"
);

/// Every mark of the reader's, newest first. Takes the reader.
const MARKS_SQL: &str = "SELECT article_id, quote, note FROM notes
     WHERE person_id = ? ORDER BY made_at DESC, id DESC";

/// The reader's Notes list, whole, each article with its marks.
pub async fn notes_list(
    db: &sqlx::SqlitePool,
    person: i64,
) -> Result<Vec<ArticleRow>, sqlx::Error> {
    let mut rows: Vec<ArticleRow> = sqlx::query_as(NOTES_SQL).bind(person).fetch_all(db).await?;
    let marks: Vec<Mark> = sqlx::query_as(MARKS_SQL).bind(person).fetch_all(db).await?;
    let mut by_article: HashMap<i64, Vec<Mark>> = HashMap::new();
    for mark in marks {
        by_article.entry(mark.article_id).or_default().push(mark);
    }
    for row in &mut rows {
        row.marks = Some(by_article.remove(&row.id).unwrap_or_default());
    }
    Ok(rows)
}
