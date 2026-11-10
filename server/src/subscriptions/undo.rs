//! Undo for an import (SPEC section 16, decision 0235): "Wrong file? Undo
//! the import" takes away exactly what the reader's last import added, the
//! feeds it followed, the folders it made and the folders it put feeds
//! already followed into, and nothing that was there before.
//!
//! What an import added is held in memory only, for one import per reader
//! (Undo reverses the last action only) and for `UNDO_FOR`. The screen
//! offers Undo only until the reader's next action, which is almost always
//! sooner; if nine turtles restarted in between (a new version going live),
//! Undo says it's too late, and every feed can still be unsubscribed from
//! as usual.

use std::{collections::HashMap, sync::Mutex};

use axum::{
    Json,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

use super::Added;
use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    folders::{UNDO_FOR, clear, hide},
    now,
};

/// Each reader's last import that added something, and when.
#[derive(Default)]
pub struct Imports(Mutex<HashMap<i64, (Added, i64)>>);

impl Imports {
    /// Remembers what reader `person`'s import at `at` added, in place of
    /// any import before it. Answers whether it can be undone: an import
    /// that added nothing can't, and leaves no Undo behind.
    pub fn remember(&self, person: i64, added: Added, at: i64) -> bool {
        let mut imports = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        imports.retain(|_, (_, when)| *when > at - UNDO_FOR);
        let something =
            !(added.feeds.is_empty() && added.folders.is_empty() && added.joined.is_empty());
        if something {
            imports.insert(person, (added, at));
        } else {
            imports.remove(&person);
        }
        something
    }

    /// Takes reader `person`'s last import, if Undo can still reach it.
    fn take(&self, person: i64, at: i64) -> Option<Added> {
        let mut imports = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let (added, when) = imports.remove(&person)?;
        (when > at - UNDO_FOR).then_some(added)
    }

    /// Puts an import back, when undoing it failed, so Undo can be tried again.
    fn put_back(&self, person: i64, added: Added, at: i64) {
        let mut imports = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        imports.entry(person).or_insert((added, at));
    }
}

/// Undoes the reader's last import, or says it's too late.
pub async fn undo(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let at = now();
    let Some(added) = state.imports.take(person, at) else {
        return (StatusCode::CONFLICT, Json(json!({ "error": "too-late" }))).into_response();
    };
    match take_away(&state.db, person, &added, at).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => {
            state.imports.put_back(person, added, at);
            database_problem("undoing an import", &error)
        }
    }
}

/// Takes away what one import added for reader `person`, all at once or not
/// at all. A folder the import made goes only once nothing else is in it.
pub async fn take_away(
    db: &sqlx::SqlitePool,
    person: i64,
    added: &Added,
    at: i64,
) -> Result<(), sqlx::Error> {
    let list = |ids: &[i64]| serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_owned());
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    // First out of the folders that were there before, so clearing a feed
    // never takes such a folder with it (`clear` removes a folder it was
    // the last one in).
    sqlx::query(
        "DELETE FROM feed_folders
         WHERE feed_id IN (SELECT value FROM json_each(?1))
             AND folder_id IN (SELECT id FROM folders WHERE person_id = ?2)
             AND folder_id NOT IN (SELECT value FROM json_each(?3))",
    )
    .bind(list(&added.feeds))
    .bind(person)
    .bind(list(&added.folders))
    .execute(&mut *transaction)
    .await?;
    for &(folder, feed) in &added.joined {
        sqlx::query(
            "DELETE FROM feed_folders WHERE folder_id = ? AND feed_id = ?
             AND folder_id IN (SELECT id FROM folders WHERE person_id = ?)",
        )
        .bind(folder)
        .bind(feed)
        .bind(person)
        .execute(&mut *transaction)
        .await?;
    }
    // The feeds it followed go for good at once: there's nothing of the
    // reader's in them yet worth a second Undo (a star stays, as always).
    hide(&mut transaction, person, &added.feeds, at).await?;
    for &feed in &added.feeds {
        clear(&mut transaction, person, feed).await?;
    }
    sqlx::query(
        "DELETE FROM folders WHERE person_id = ? AND id IN (SELECT value FROM json_each(?))
         AND NOT EXISTS (SELECT 1 FROM feed_folders WHERE folder_id = folders.id)",
    )
    .bind(person)
    .bind(list(&added.folders))
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await
}
