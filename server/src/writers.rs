//! People (SPEC section 36, decisions 0146 and 0163): a person is one human
//! with one or more sources on the web (a blog, a channel, a newsletter). In
//! the code they're "writers", because the readers are already `people`, and
//! a source is a "place"; on screen the word "feed" stays off their screens.
//!
//! A place the reader hasn't joined to another has no writer: it's a person
//! or a publication with one source (`writers/kind.rs` guesses which).
//! Joining places ("+ Add a source" on the person's page, or "This is one
//! person" on a folder) makes a writer, or adds to one, and puts every place
//! of the person in the same folders. Each join, and each "Take out of …",
//! answers what the places were like before, so the screen's Undo can put
//! them back (`put_back`).
//!
//! A person's list is any of their places' lists: `GET /api/articles?feed=3`
//! for a place of a person with two or more places lists all of them
//! (`widen`). nine turtles never joins places by itself.

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::SqliteConnection;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::List,
    folders::{self, clean_name},
    now, refused,
};

pub mod kind;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/writers/join", post(join_places))
        .route("/api/writers/put-back", post(put_places_back))
        .route("/api/writers/separate", post(separate_place))
        .route("/api/folders/{id}/person", post(folder_to_person))
        .route("/api/writers/unsubscribe", post(unsubscribe_person))
}

/// The people the reader has joined places into, A to Z, each with at least
/// one place they still follow, for the sidebar. Takes the reader.
pub const PEOPLE: &str = "SELECT id, name FROM writers
     WHERE person_id = ?1 AND EXISTS (SELECT 1 FROM subscriptions
         WHERE subscriptions.person_id = ?1 AND subscriptions.writer_id = writers.id
             AND subscriptions.unsubscribed_at IS NULL)
     ORDER BY name COLLATE NOCASE, id";

#[derive(Serialize, sqlx::FromRow)]
pub struct Writer {
    pub id: i64,
    pub name: String,
}

/// A place as it was before a join or a separation: its person (none for a
/// place on its own) and that person's name then, and its folders, for Undo.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct Before {
    pub feed: i64,
    pub writer: Option<i64>,
    #[serde(default)]
    pub name: Option<String>,
    pub folders: Vec<i64>,
    /// The address the reader had typed for it (decision 0147), so Undo
    /// brings it back too.
    #[serde(default)]
    pub write_to: Option<String>,
    /// The reader's note on them (decision 0164), so Undo brings it back too.
    #[serde(default)]
    pub note: Option<String>,
}

/// A place's list becomes its person's when they have two or more places
/// the reader still follows; every other list stays as it is. A place on
/// its own keeps its own quick list (`entries_newest_by_feed`).
pub async fn widen(db: &sqlx::SqlitePool, person: i64, list: List) -> Result<List, sqlx::Error> {
    let List::Feed(feed) = list else {
        return Ok(list);
    };
    let writer: Option<i64> = sqlx::query_scalar(
        "SELECT writer_id FROM subscriptions AS place
         WHERE person_id = ?1 AND feed_id = ?2 AND writer_id IS NOT NULL
             AND (SELECT COUNT(*) FROM subscriptions
                  WHERE person_id = ?1 AND writer_id = place.writer_id
                      AND unsubscribed_at IS NULL) > 1",
    )
    .bind(person)
    .bind(feed)
    .fetch_optional(db)
    .await?;
    Ok(writer.map_or(list, List::Writer))
}

fn ids(list: &[i64]) -> String {
    Value::from(list).to_string()
}

/// The places among `feeds` the reader still follows, with their person
/// and folders.
async fn before_of(
    connection: &mut SqliteConnection,
    person: i64,
    feeds: &[i64],
) -> Result<Vec<Before>, sqlx::Error> {
    // Each place: its feed, person, that person's name, the address typed for it and the note.
    type Place = (
        i64,
        Option<i64>,
        Option<String>,
        Option<String>,
        Option<String>,
    );
    let places: Vec<Place> = sqlx::query_as(
        "SELECT subscriptions.feed_id, subscriptions.writer_id, writers.name,
             subscriptions.write_to, subscriptions.note FROM subscriptions
         LEFT JOIN writers ON writers.id = subscriptions.writer_id
         WHERE subscriptions.person_id = ? AND subscriptions.unsubscribed_at IS NULL
             AND subscriptions.feed_id IN (SELECT value FROM json_each(?))
         ORDER BY subscriptions.feed_id",
    )
    .bind(person)
    .bind(ids(feeds))
    .fetch_all(&mut *connection)
    .await?;
    let mut before = Vec::with_capacity(places.len());
    for (feed, writer, name, write_to, note) in places {
        let folders: Vec<i64> = sqlx::query_scalar(
            "SELECT feed_folders.folder_id FROM feed_folders
             JOIN folders ON folders.id = feed_folders.folder_id
             WHERE feed_folders.feed_id = ? AND folders.person_id = ?
             ORDER BY feed_folders.folder_id",
        )
        .bind(feed)
        .bind(person)
        .fetch_all(&mut *connection)
        .await?;
        before.push(Before {
            feed,
            writer,
            name,
            folders,
            write_to,
            note,
        });
    }
    Ok(before)
}

/// Joins `feeds` (places the reader follows) into one person, with every
/// other place of the people they already belong to. The person is the
/// first of those people, renamed to `name` if one is given; with none, a
/// new person called `name`, or the first place's name. Every place ends up
/// in exactly `folders` when given (the reader's answer when the places were
/// in different folders), or else in every folder any of them was in.
/// Answers the person and what the places were like before; `None` when
/// the reader follows none of `feeds`.
pub async fn join(
    connection: &mut SqliteConnection,
    person: i64,
    feeds: &[i64],
    name: Option<&str>,
    folders: Option<&[i64]>,
) -> Result<Option<(i64, Vec<Before>)>, sqlx::Error> {
    let given = before_of(connection, person, feeds).await?;
    // The person first named, in the reader's order.
    let target = feeds
        .iter()
        .find_map(|feed| given.iter().find(|place| place.feed == *feed)?.writer);
    let Some(first) = feeds
        .iter()
        .find(|feed| given.iter().any(|place| place.feed == **feed))
    else {
        return Ok(None);
    };
    let writers: Vec<i64> = given.iter().filter_map(|place| place.writer).collect();
    let others: Vec<i64> = sqlx::query_scalar(
        "SELECT feed_id FROM subscriptions
         WHERE person_id = ? AND unsubscribed_at IS NULL
             AND writer_id IN (SELECT value FROM json_each(?))",
    )
    .bind(person)
    .bind(ids(&writers))
    .fetch_all(&mut *connection)
    .await?;
    let mut places: Vec<i64> = given.iter().map(|place| place.feed).collect();
    places.extend(others);
    places.sort_unstable();
    places.dedup();
    let before = before_of(connection, person, &places).await?;
    let writer = match target {
        Some(writer) => {
            if let Some(name) = name {
                sqlx::query("UPDATE writers SET name = ? WHERE id = ? AND person_id = ?")
                    .bind(name)
                    .bind(writer)
                    .bind(person)
                    .execute(&mut *connection)
                    .await?;
            }
            writer
        }
        None => {
            let name = match name {
                Some(name) => name.to_owned(),
                None => {
                    sqlx::query_scalar(
                        "SELECT title FROM subscriptions WHERE person_id = ? AND feed_id = ?",
                    )
                    .bind(person)
                    .bind(first)
                    .fetch_one(&mut *connection)
                    .await?
                }
            };
            sqlx::query_scalar(
                "INSERT INTO writers (person_id, name, created_at) VALUES (?, ?, ?) RETURNING id",
            )
            .bind(person)
            .bind(name)
            .bind(now())
            .fetch_one(&mut *connection)
            .await?
        }
    };
    // Their notes become one, on every place (decision 0164).
    let notes: Vec<Option<String>> = before.iter().map(|place| place.note.clone()).collect();
    sqlx::query(
        "UPDATE subscriptions SET writer_id = ?, note = ?
         WHERE person_id = ? AND feed_id IN (SELECT value FROM json_each(?))",
    )
    .bind(writer)
    .bind(crate::notes::joined(&notes))
    .bind(person)
    .bind(ids(&places))
    .execute(&mut *connection)
    .await?;
    if let Some(chosen) = folders {
        for &place in &places {
            folders::file_in(connection, person, place, chosen).await?;
        }
    } else {
        let mut every: Vec<i64> = before
            .iter()
            .flat_map(|place| place.folders.clone())
            .collect();
        every.sort_unstable();
        every.dedup();
        sqlx::query(
            "INSERT OR IGNORE INTO feed_folders (folder_id, feed_id)
             SELECT folder.value, place.value FROM json_each(?) AS folder, json_each(?) AS place",
        )
        .bind(ids(&every))
        .bind(ids(&places))
        .execute(&mut *connection)
        .await?;
    }
    // The people merged into this one have no place left; Undo brings them back by name.
    forget_empty(connection, person).await?;
    Ok(Some((writer, before)))
}

/// Undo for a join or a separation: each place the reader still follows
/// goes back to the person it had, under the name that person had then
/// (brought back if a join merged them away), and to exactly the folders it
/// was in. People left with no place at all go.
pub async fn put_back(
    connection: &mut SqliteConnection,
    person: i64,
    before: &[Before],
) -> Result<(), sqlx::Error> {
    for place in before {
        if let (Some(writer), Some(name)) = (place.writer, &place.name) {
            // Never another reader's: a number someone else holds is left alone, and the place
            // then stands on its own.
            sqlx::query(
                "INSERT INTO writers (id, person_id, name, created_at) VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT (id) DO UPDATE SET name = excluded.name
                     WHERE writers.person_id = excluded.person_id",
            )
            .bind(writer)
            .bind(person)
            .bind(name)
            .bind(now())
            .execute(&mut *connection)
            .await?;
        }
        let changed = sqlx::query(
            "UPDATE subscriptions SET writer_id =
                 (SELECT id FROM writers WHERE id = ?1 AND person_id = ?2), write_to = ?4, note = ?5
             WHERE person_id = ?2 AND feed_id = ?3 AND unsubscribed_at IS NULL",
        )
        .bind(place.writer)
        .bind(person)
        .bind(place.feed)
        // Only ever an address in its one written form.
        .bind(
            place
                .write_to
                .as_deref()
                .and_then(crate::write_back::address),
        )
        .bind(
            place
                .note
                .as_deref()
                .and_then(|note| crate::notes::clean_note(note).ok().flatten()),
        )
        .execute(&mut *connection)
        .await?;
        if changed.rows_affected() > 0 {
            folders::file_in(connection, person, place.feed, &place.folders).await?;
        }
    }
    forget_empty(connection, person).await
}

/// Removes the reader's people who have no place left, followed or kept
/// for its starred articles.
async fn forget_empty(connection: &mut SqliteConnection, person: i64) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM writers WHERE person_id = ?1 AND NOT EXISTS (SELECT 1 FROM subscriptions
             WHERE subscriptions.person_id = ?1 AND subscriptions.writer_id = writers.id)",
    )
    .bind(person)
    .execute(connection)
    .await?;
    Ok(())
}

/// The person a followed place belongs to, if any.
async fn writer_of(
    connection: &mut SqliteConnection,
    person: i64,
    feed: i64,
) -> Result<Option<i64>, sqlx::Error> {
    Ok(sqlx::query_scalar(
        "SELECT writer_id FROM subscriptions WHERE person_id = ? AND feed_id = ?",
    )
    .bind(person)
    .bind(feed)
    .fetch_optional(connection)
    .await?
    .flatten())
}

/// Edit's name (on their page): the person's, for a place joined to others; the
/// place's own otherwise. The name is already cleaned (`clean_name`).
pub async fn rename_place(
    connection: &mut SqliteConnection,
    person: i64,
    feed: i64,
    name: &str,
) -> Result<(), sqlx::Error> {
    match writer_of(connection, person, feed).await? {
        Some(writer) => {
            sqlx::query("UPDATE writers SET name = ? WHERE id = ? AND person_id = ?")
                .bind(name)
                .bind(writer)
                .bind(person)
                .execute(&mut *connection)
                .await?;
            Ok(())
        }
        None => folders::rename_feed(connection, person, feed, name).await,
    }
}

/// Edit's folders: every place of the person goes in exactly these.
pub async fn file_places(
    connection: &mut SqliteConnection,
    person: i64,
    feed: i64,
    chosen: &[i64],
) -> Result<(), sqlx::Error> {
    let places: Vec<i64> = match writer_of(connection, person, feed).await? {
        Some(writer) => {
            sqlx::query_scalar(
                "SELECT feed_id FROM subscriptions
                 WHERE person_id = ? AND writer_id = ? AND unsubscribed_at IS NULL",
            )
            .bind(person)
            .bind(writer)
            .fetch_all(&mut *connection)
            .await?
        }
        None => vec![feed],
    };
    for place in places {
        folders::file_in(connection, person, place, chosen).await?;
    }
    Ok(())
}

#[derive(Deserialize)]
struct JoinForm {
    feeds: Vec<i64>,
    #[serde(default)]
    name: Option<String>,
    /// The folders they all go in, when the reader was asked.
    #[serde(default)]
    folders: Option<Vec<i64>>,
}

/// "+ Add a source": someone the reader follows, or an address followed then and there.
async fn join_places(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<JoinForm>,
) -> Response {
    let name = match form.name.as_deref() {
        None => None,
        Some(name) => match clean_name(name) {
            Some(name) => Some(name),
            None => return refused(StatusCode::BAD_REQUEST, "no-name"),
        },
    };
    let joined = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let joined = join(
            &mut transaction,
            person,
            &form.feeds,
            name.as_deref(),
            form.folders.as_deref(),
        )
        .await?;
        transaction.commit().await?;
        Ok::<_, sqlx::Error>(joined)
    }
    .await;
    match joined {
        Ok(Some((writer, before))) => {
            Json(json!({ "writer": writer, "before": before })).into_response()
        }
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("joining places", &error),
    }
}

#[derive(Deserialize)]
struct PutBackForm {
    before: Vec<Before>,
}

async fn put_places_back(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<PutBackForm>,
) -> Response {
    let done = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        put_back(&mut transaction, person, &form.before).await?;
        transaction.commit().await
    }
    .await;
    match done {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("putting places back", &error),
    }
}

#[derive(Deserialize)]
struct PlaceForm {
    feed: i64,
}

/// "Unsubscribe from …": with `remove_kept`, what the reader starred or
/// marked in every place of theirs, and the note on the person, go too once
/// it's cleared for good (SPEC section 42, `notes::drop_kept`).
#[derive(Deserialize)]
struct LeavingForm {
    feed: i64,
    #[serde(default)]
    remove_kept: bool,
}

/// "Take out of …": one place leaves its person and stands on its own
/// again, in the folders it's in, a person or publication as guessed afresh. Only a person with another place left can
/// lose one. Answers what it was like before, for Undo.
async fn separate_place(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<PlaceForm>,
) -> Response {
    let separated = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let before = before_of(&mut transaction, person, &[form.feed]).await?;
        let Some(writer) = before.first().and_then(|place| place.writer) else {
            return Ok(None);
        };
        // The address typed for the person was theirs, not this place's
        // (decision 0147); Undo brings it back.
        sqlx::query(
            "UPDATE subscriptions SET writer_id = NULL, kind = NULL, write_to = NULL
             WHERE person_id = ? AND feed_id = ?",
        )
        .bind(person)
        .bind(form.feed)
        .execute(&mut *transaction)
        .await?;
        let left: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM subscriptions
             WHERE person_id = ? AND writer_id = ? AND unsubscribed_at IS NULL",
        )
        .bind(person)
        .bind(writer)
        .fetch_one(&mut *transaction)
        .await?;
        if left == 0 {
            // Their only place: nothing to separate it from.
            return Ok(None);
        }
        transaction.commit().await?;
        Ok::<_, sqlx::Error>(Some(before))
    }
    .await;
    match separated {
        Ok(Some(before)) => Json(json!({ "before": before })).into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("separating a place", &error),
    }
}

/// "This is one person", on a folder that holds one person's places: its
/// places become one person, named as the folder was, and the folder goes.
/// Answers what Undo needs: the places as they were, and the folder's saved
/// searches (as deleting a folder does).
async fn folder_to_person(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let made = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let places: Vec<i64> = sqlx::query_scalar(
            "SELECT subscriptions.feed_id FROM feed_folders
             JOIN folders ON folders.id = feed_folders.folder_id
             JOIN subscriptions ON subscriptions.person_id = folders.person_id
                 AND subscriptions.feed_id = feed_folders.feed_id
             WHERE folders.id = ? AND folders.person_id = ?
                 AND subscriptions.unsubscribed_at IS NULL
             ORDER BY subscriptions.added_at, subscriptions.feed_id",
        )
        .bind(id)
        .bind(person)
        .fetch_all(&mut *transaction)
        .await?;
        let name: Option<String> =
            sqlx::query_scalar("SELECT name FROM folders WHERE id = ? AND person_id = ?")
                .bind(id)
                .bind(person)
                .fetch_optional(&mut *transaction)
                .await?;
        let (Some(name), false) = (name, places.is_empty()) else {
            return Ok(None);
        };
        let Some((writer, before)) =
            join(&mut transaction, person, &places, Some(&name), None).await?
        else {
            return Ok(None);
        };
        let Some(deleted) = folders::delete(&mut transaction, person, id).await? else {
            return Ok(None);
        };
        transaction.commit().await?;
        Ok::<_, sqlx::Error>(Some(json!({
            "writer": writer,
            "before": before,
            "searches": deleted.searches,
        })))
    }
    .await;
    match made {
        Ok(Some(answer)) => Json(answer).into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("making a folder one person", &error),
    }
}

/// "Unsubscribe from Alpha…": every source of the person the place belongs
/// to (just the place, for one on its own), together, so Undo brings them
/// all back. Answers the places unsubscribed from.
async fn unsubscribe_person(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<LeavingForm>,
) -> Response {
    let left = async {
        folders::clear_unsubscribed(&state.db, Some(person), i64::MAX).await?;
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let places: Vec<i64> = sqlx::query_scalar(
            "SELECT feed_id FROM subscriptions
             WHERE person_id = ?1 AND unsubscribed_at IS NULL AND (feed_id = ?2 OR writer_id =
                 (SELECT writer_id FROM subscriptions WHERE person_id = ?1 AND feed_id = ?2))
             ORDER BY feed_id",
        )
        .bind(person)
        .bind(form.feed)
        .fetch_all(&mut *transaction)
        .await?;
        folders::hide(&mut transaction, person, &places, now()).await?;
        if form.remove_kept {
            crate::notes::drop_later(&mut transaction, person, &places).await?;
        }
        transaction.commit().await?;
        Ok::<_, sqlx::Error>(places)
    }
    .await;
    match left {
        Ok(places) if places.is_empty() => StatusCode::NOT_FOUND.into_response(),
        Ok(places) => Json(json!({ "feeds": places })).into_response(),
        Err(error) => database_problem("unsubscribing from a person", &error),
    }
}
