//! Collections, kept only for their export (owner's plan, step 9, decision
//! 0174). Collections were the reader's own named shelves for articles
//! (decision 0108); nine turtles keeps Starred alone now. Every article that
//! was on a collection was starred (structure change 40), and the database
//! keeps the collections' names and lines unused, so Settings › Your data
//! can still download the list (SPEC section 23).
//!
//! A line still points at the reader's entry, and the database refuses to
//! delete an entry a line points at (structure change 23), so the yearly
//! clean-up and unsubscribing leave those articles (`cleanup`,
//! `folders::clear`), as they leave starred ones.

use axum::{
    Router,
    extract::State,
    http::header,
    response::{IntoResponse, Response},
    routing::get,
};
use serde_json::{Value, json};

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds,
    starred::{self, Starred},
};

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/collections/export", get(export))
}

/// The reader's collections' names, A to Z (capitals don't matter).
async fn names(db: &sqlx::SqlitePool, person: i64) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT name FROM collections WHERE person_id = ? ORDER BY name COLLATE NOCASE, id",
    )
    .bind(person)
    .fetch_all(db)
    .await
}

/// Every article on any of the reader's collections, newest first, each with
/// the names of its collections (A to Z), as JSON. Takes the reader.
const EXPORT: &str = concat!(
    "SELECT ",
    starred::columns!(),
    ", (SELECT json_group_array(name) FROM (
           SELECT collections.name FROM collection_articles AS mine
               JOIN collections ON collections.id = mine.collection_id
           WHERE mine.person_id = entries.person_id AND mine.article_id = entries.article_id
           ORDER BY collections.name COLLATE NOCASE)) AS tags",
    feeds::from_entries!(),
    "?1 AND entries.article_id IN
         (SELECT article_id FROM collection_articles WHERE person_id = ?1)
     ORDER BY entries.sort_at DESC, entries.article_id DESC"
);

#[derive(sqlx::FromRow)]
struct Collected {
    #[sqlx(flatten)]
    article: Starred,
    /// Its collections' names, as a JSON list.
    tags: String,
}

/// Collections as a JSON Feed file (SPEC section 23), so nothing is locked
/// in: every article on a collection, with its text, original link and
/// feed, as the starred export writes them, and its collections' names as
/// the item's `tags` (JSON Feed's own field). Every collection's name,
/// empty ones too, is listed in the `_nine_turtles` extension.
async fn export(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let found = async {
        let names = names(&state.db, person).await?;
        let articles: Vec<Collected> = sqlx::query_as(EXPORT)
            .bind(person)
            .fetch_all(&state.db)
            .await?;
        Ok::<_, sqlx::Error>((names, articles))
    }
    .await;
    match found {
        Ok((names, articles)) => (
            [
                (header::CONTENT_TYPE, "application/feed+json; charset=utf-8"),
                (
                    header::CONTENT_DISPOSITION,
                    "attachment; filename=\"nine-turtles-collections.json\"",
                ),
            ],
            write(&names, &articles).to_string(),
        )
            .into_response(),
        Err(error) => database_problem("exporting collections", &error),
    }
}

fn write(names: &[String], articles: &[Collected]) -> Value {
    let items: Vec<Value> = articles
        .iter()
        .map(|collected| {
            let mut item = starred::item(&collected.article);
            let tags: Value = serde_json::from_str(&collected.tags).unwrap_or(json!([]));
            item["tags"] = tags;
            item
        })
        .collect();
    json!({
        "version": "https://jsonfeed.org/version/1.1",
        "title": "nine turtles collections",
        "description": "Articles in your nine turtles collections, each with the feed it came from; its collections are its tags.",
        "items": items,
        "_nine_turtles": { "about": "https://nineturtles.app", "collections": names },
    })
}
