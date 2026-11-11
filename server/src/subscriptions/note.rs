//! The line that ends an import (SPEC section 16, decision 0263): once every
//! feed a file brought has had its first check, Unread and All articles say
//! how it was sorted, "Your list is in: 18 people and 4 publications. 8
//! could be either.", until the reader closes it, looks them over or undoes
//! the import. The feeds it added are kept in one `person_settings` row,
//! `import_note`, so the line outlasts a reload or a restart.

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use sqlx::SqliteConnection;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
};

/// How the feeds an import added are sorted now.
#[derive(Serialize, sqlx::FromRow, Debug, PartialEq, Eq)]
pub struct Sorted {
    pub people: i64,
    pub publications: i64,
    /// Could be either: kept with the publications, counted apart.
    pub open: i64,
}

/// Remembers the feeds reader `person`'s import added, in place of any
/// import's before it; an import that added none leaves the last one's.
pub async fn keep(
    connection: &mut SqliteConnection,
    person: i64,
    feeds: &[i64],
) -> Result<(), sqlx::Error> {
    if feeds.is_empty() {
        return Ok(());
    }
    sqlx::query(
        "INSERT INTO person_settings (person_id, name, value) VALUES (?, 'import_note', ?)
         ON CONFLICT (person_id, name) DO UPDATE SET value = excluded.value",
    )
    .bind(person)
    .bind(serde_json::to_string(feeds).unwrap_or_else(|_| "[]".to_owned()))
    .execute(connection)
    .await
    .map(|_| ())
}

/// The line's counts, once nothing the import added still waits for its
/// first check; none while one does, or with nothing to say. A feed whose
/// first check failed isn't counted: Everyone you follow lists it as not
/// working.
pub async fn sorted(
    connection: &mut SqliteConnection,
    person: i64,
) -> Result<Option<Sorted>, sqlx::Error> {
    let counted: Option<CountedRow> = sqlx::query_as(
        "SELECT COUNT(*) FILTER (WHERE feeds.fetched_at IS NULL AND feeds.failures = 0
                     AND feeds.url NOT LIKE 'newsletter:%') AS waiting,
             COUNT(*) FILTER (WHERE subscriptions.kind IS NOT NULL
                     AND (subscriptions.writer_id IS NOT NULL OR subscriptions.kind = 'person'))
                 AS people,
             COUNT(*) FILTER (WHERE subscriptions.writer_id IS NULL
                     AND subscriptions.kind = 'publication'
                     AND COALESCE(subscriptions.kind_why, '') NOT LIKE 'unsure-%') AS publications,
             COUNT(*) FILTER (WHERE subscriptions.writer_id IS NULL
                     AND subscriptions.kind_why LIKE 'unsure-%') AS open
         FROM person_settings, json_each(person_settings.value) AS added
         JOIN subscriptions ON subscriptions.person_id = person_settings.person_id
             AND subscriptions.feed_id = added.value AND subscriptions.unsubscribed_at IS NULL
         JOIN feeds ON feeds.id = subscriptions.feed_id
         WHERE person_settings.person_id = ? AND person_settings.name = 'import_note'",
    )
    .bind(person)
    .fetch_optional(&mut *connection)
    .await?;
    Ok(counted
        .map(CountedRow::split)
        .and_then(|(waiting, sorted)| {
            (waiting == 0 && sorted.people + sorted.publications + sorted.open > 0)
                .then_some(sorted)
        }))
}

#[derive(sqlx::FromRow)]
struct CountedRow {
    waiting: i64,
    people: i64,
    publications: i64,
    open: i64,
}

impl CountedRow {
    fn split(self) -> (i64, Sorted) {
        (
            self.waiting,
            Sorted {
                people: self.people,
                publications: self.publications,
                open: self.open,
            },
        )
    }
}

/// Ends the line for good: the reader closed it, looked them over, or
/// undid the import.
pub async fn forget(connection: &mut SqliteConnection, person: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM person_settings WHERE person_id = ? AND name = 'import_note'")
        .bind(person)
        .execute(connection)
        .await
        .map(|_| ())
}

/// `POST /api/opml/note/close`.
pub async fn close(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let closed = async {
        let mut connection = state.db.acquire().await?;
        forget(&mut connection, person).await
    }
    .await;
    match closed {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("closing an import's line", &error),
    }
}

#[cfg(test)]
mod tests {
    use super::Sorted;

    #[test]
    fn the_counts_go_to_the_app_by_name() {
        let sorted = Sorted {
            people: 18,
            publications: 4,
            open: 8,
        };
        assert_eq!(
            serde_json::to_value(&sorted).unwrap_or_default(),
            serde_json::json!({ "people": 18, "publications": 4, "open": 8 })
        );
    }
}
