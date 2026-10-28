//! Collections (SPEC section 34, decision 0108): the reader's own named
//! shelves for articles ("To cite", "Recipes"), each reader's alone. An
//! article can be on several; stars stay a thing of their own.
//!
//! An article on any collection is kept forever, like a starred one: the
//! yearly clean-up and unsubscribing leave its entry (`cleanup`,
//! `folders::clear`), and the database refuses to delete an entry a
//! collection still points at (structure change 23).
//!
//! The list of a collection's articles is `GET /api/articles?collection=3`
//! (`feeds::page`), in the reader's sort order by the article's date, like
//! every list. Deleting a collection removes only it and its lines, never an
//! article; it answers the collection's articles and the saved searches
//! limited to it, so the screen's Undo can make it again with the same ones.

use axum::{
    Json, Router,
    extract::{Path, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    folders::clean_name,
    now,
    starred::{self, Starred},
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/collections", get(list).post(create))
        .route("/api/collections/export", get(export))
        .route("/api/collections/{id}", post(rename))
        .route("/api/collections/{id}/delete", post(delete))
        .route(
            "/api/articles/{id}/collections",
            get(of_article).post(set_for_article),
        )
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Collection {
    pub id: i64,
    pub name: String,
}

/// The reader's collections, A to Z (capitals don't matter).
pub async fn all(db: &sqlx::SqlitePool, person: i64) -> Result<Vec<Collection>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, name FROM collections WHERE person_id = ? ORDER BY name COLLATE NOCASE, id",
    )
    .bind(person)
    .fetch_all(db)
    .await
}

async fn list(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    match all(&state.db, person).await {
        Ok(collections) => Json(json!({ "collections": collections })).into_response(),
        Err(error) => database_problem("listing collections", &error),
    }
}

#[derive(Deserialize)]
struct NewCollection {
    name: String,
    /// Articles to put on it straight away: Undo after deleting one gives
    /// back what was on it. Any the reader no longer has are skipped.
    #[serde(default)]
    articles: Vec<i64>,
    /// Saved searches to limit to it again: Undo after deleting one gives
    /// back the searches that were limited to it. Only the reader's own that
    /// still look in a deleted collection (number 0) change.
    #[serde(default)]
    searches: Vec<i64>,
}

async fn create(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<NewCollection>,
) -> Response {
    let Some(name) = clean_name(&form.name) else {
        return problem(StatusCode::BAD_REQUEST, "no-name");
    };
    let made = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO collections (person_id, name, created_at) VALUES (?, ?, ?) RETURNING id",
        )
        .bind(person)
        .bind(&name)
        .bind(now())
        .fetch_one(&mut *transaction)
        .await?;
        sqlx::query(
            "INSERT OR IGNORE INTO collection_articles (collection_id, person_id, article_id, added_at)
             SELECT ?1, entries.person_id, entries.article_id, ?3 FROM entries
             WHERE entries.person_id = ?2
                 AND entries.article_id IN (SELECT value FROM json_each(?4))",
        )
        .bind(id)
        .bind(person)
        .bind(now())
        .bind(Value::from(form.articles).to_string())
        .execute(&mut *transaction)
        .await?;
        crate::saved_searches::back_in(&mut *transaction, person, "collection", id, &form.searches)
            .await?;
        transaction.commit().await?;
        Ok::<i64, sqlx::Error>(id)
    }
    .await;
    match made {
        Ok(id) => (
            StatusCode::CREATED,
            Json(json!({ "collection": Collection { id, name } })),
        )
            .into_response(),
        Err(sqlx::Error::Database(error)) if error.is_unique_violation() => {
            problem(StatusCode::CONFLICT, "already")
        }
        Err(error) => database_problem("making a collection", &error),
    }
}

#[derive(Deserialize)]
struct Name {
    name: String,
}

async fn rename(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<Name>,
) -> Response {
    let Some(name) = clean_name(&form.name) else {
        return problem(StatusCode::BAD_REQUEST, "no-name");
    };
    let changed = sqlx::query("UPDATE collections SET name = ? WHERE id = ? AND person_id = ?")
        .bind(&name)
        .bind(id)
        .bind(person)
        .execute(&state.db)
        .await;
    match changed {
        Ok(changed) if changed.rows_affected() == 0 => StatusCode::NOT_FOUND.into_response(),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(sqlx::Error::Database(error)) if error.is_unique_violation() => {
            problem(StatusCode::CONFLICT, "already")
        }
        Err(error) => database_problem("renaming a collection", &error),
    }
}

/// Deletes a collection: only it and its lines go, never an article at once
/// (one that was kept only by it, say of a feed since unsubscribed, is then
/// left to the yearly clean-up as usual). Answers the articles it held and
/// the saved searches limited to it, for Undo.
async fn delete(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let deleted = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let articles: Vec<i64> = sqlx::query_scalar(
            "SELECT article_id FROM collection_articles
             WHERE collection_id = ? AND person_id = ? ORDER BY article_id",
        )
        .bind(id)
        .bind(person)
        .fetch_all(&mut *transaction)
        .await?;
        let gone = sqlx::query("DELETE FROM collections WHERE id = ? AND person_id = ?")
            .bind(id)
            .bind(person)
            .execute(&mut *transaction)
            .await?
            .rows_affected();
        // Its number may be given again: saved searches in it now find
        // nothing. Which ones they were goes back with the answer, for Undo.
        let searches =
            crate::saved_searches::forget(&mut *transaction, person, "collection", id).await?;
        transaction.commit().await?;
        Ok::<Option<(Vec<i64>, Vec<i64>)>, sqlx::Error>((gone > 0).then_some((articles, searches)))
    }
    .await;
    match deleted {
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Ok(Some((articles, searches))) => {
            Json(json!({ "articles": articles, "searches": searches })).into_response()
        }
        Err(error) => database_problem("deleting a collection", &error),
    }
}

/// Whether reader `person` has article `id` (an entry of theirs).
async fn has(
    executor: impl sqlx::SqliteExecutor<'_>,
    person: i64,
    id: i64,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM entries WHERE person_id = ? AND article_id = ?)",
    )
    .bind(person)
    .bind(id)
    .fetch_one(executor)
    .await
}

/// The reader's collections this article is on, by number (the sheet's
/// ticked boxes). An article they don't have is not found.
async fn of_article(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let found = async {
        if !has(&state.db, person, id).await? {
            return Ok(None);
        }
        let ids: Vec<i64> = sqlx::query_scalar(
            "SELECT collection_id FROM collection_articles
             WHERE person_id = ? AND article_id = ? ORDER BY collection_id",
        )
        .bind(person)
        .bind(id)
        .fetch_all(&state.db)
        .await?;
        Ok::<Option<Vec<i64>>, sqlx::Error>(Some(ids))
    }
    .await;
    match found {
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Ok(Some(ids)) => Json(json!({ "collections": ids })).into_response(),
        Err(error) => database_problem("listing an article's collections", &error),
    }
}

#[derive(Deserialize)]
struct Chosen {
    /// Every collection the article should be on now; it leaves the others.
    collections: Vec<i64>,
}

/// Puts an article on exactly the collections named (the sheet's Save):
/// it joins those it wasn't on and leaves those not named. Numbers that
/// aren't the reader's collections are passed over.
async fn set_for_article(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<Chosen>,
) -> Response {
    let chosen = Value::from(form.collections).to_string();
    let saved = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        if !has(&mut *transaction, person, id).await? {
            return Ok(false);
        }
        sqlx::query(
            "DELETE FROM collection_articles
             WHERE person_id = ?1 AND article_id = ?2
                 AND collection_id NOT IN (SELECT value FROM json_each(?3))",
        )
        .bind(person)
        .bind(id)
        .bind(&chosen)
        .execute(&mut *transaction)
        .await?;
        sqlx::query(
            "INSERT OR IGNORE INTO collection_articles (collection_id, person_id, article_id, added_at)
             SELECT id, person_id, ?2, ?3 FROM collections
             WHERE person_id = ?1 AND id IN (SELECT value FROM json_each(?4))",
        )
        .bind(person)
        .bind(id)
        .bind(now())
        .bind(&chosen)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok::<bool, sqlx::Error>(true)
    }
    .await;
    match saved {
        Ok(false) => StatusCode::NOT_FOUND.into_response(),
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("saving an article's collections", &error),
    }
}

/// Every article on any of the reader's collections, newest first, each with
/// the names of its collections (A to Z), as JSON. Takes the reader.
const EXPORT: &str = "SELECT articles.fingerprint, articles.title, articles.link, articles.author,
            articles.content, articles.summary,
            COALESCE(articles.language, feeds.language) AS language,
            articles.published_at, subscriptions.title AS feed_title,
            feeds.url AS feed_url, feeds.site_url,
            (SELECT json_group_array(name) FROM (
                 SELECT collections.name FROM collection_articles AS mine
                     JOIN collections ON collections.id = mine.collection_id
                 WHERE mine.person_id = entries.person_id AND mine.article_id = entries.article_id
                 ORDER BY collections.name COLLATE NOCASE)) AS tags
     FROM entries CROSS JOIN articles ON articles.id = entries.article_id
         CROSS JOIN feeds ON feeds.id = entries.feed_id
         CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
             AND subscriptions.feed_id = entries.feed_id
     WHERE entries.person_id = ?1 AND entries.article_id IN
         (SELECT article_id FROM collection_articles WHERE person_id = ?1)
     ORDER BY entries.sort_at DESC, entries.article_id DESC";

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
        let names = all(&state.db, person).await?;
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

fn write(names: &[Collection], articles: &[Collected]) -> Value {
    let items: Vec<Value> = articles
        .iter()
        .map(|collected| {
            let mut item = starred::item(&collected.article);
            let tags: Value = serde_json::from_str(&collected.tags).unwrap_or(json!([]));
            item["tags"] = tags;
            item
        })
        .collect();
    let names: Vec<&str> = names.iter().map(|each| each.name.as_str()).collect();
    json!({
        "version": "https://jsonfeed.org/version/1.1",
        "title": "nine turtles collections",
        "description": "Articles in your nine turtles collections, each with the feed it came from; its collections are its tags.",
        "items": items,
        "_nine_turtles": { "about": "https://nineturtles.app", "collections": names },
    })
}

fn problem(status: StatusCode, error: &str) -> Response {
    (status, Json(json!({ "error": error }))).into_response()
}
