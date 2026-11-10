//! The folder actions every door shares (the screen and assistants), so
//! each is written once (ENGINEERING.md → "Keeping the code tidy").

use sqlx::SqliteConnection;

/// The number of the reader's folder called `name`, if they have one.
pub async fn named(
    connection: &mut SqliteConnection,
    person: i64,
    name: &str,
) -> Result<Option<i64>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM folders WHERE person_id = ? AND name = ?")
        .bind(person)
        .bind(name)
        .fetch_optional(connection)
        .await
}

/// What renaming a folder came to.
pub enum Renamed {
    Done,
    /// The reader has no folder with that number.
    NoFolder,
    /// Another of the reader's folders has the name: its number, or `None`
    /// when another tab took the name in between.
    Taken(Option<i64>),
}

/// Renames one of the reader's folders to `name` (already through
/// `clean_name`), the one way every door does it (the screen and
/// assistants).
pub async fn rename(
    connection: &mut SqliteConnection,
    person: i64,
    id: i64,
    name: &str,
) -> Result<Renamed, sqlx::Error> {
    let other: Option<i64> =
        sqlx::query_scalar("SELECT id FROM folders WHERE person_id = ? AND name = ? AND id != ?")
            .bind(person)
            .bind(name)
            .bind(id)
            .fetch_optional(&mut *connection)
            .await?;
    if let Some(hidden) = other {
        // A folder hidden because everyone in it was unsubscribed from
        // (still kept, decision 0240) can't be seen, so it never blocks a
        // name: this folder takes its place, and its waiting pairs, so Bring
        // back still lands in a folder of that name.
        let waiting: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM feed_folders WHERE folder_id = ?2)
                 AND NOT EXISTS (SELECT 1 FROM feed_folders JOIN subscriptions
                     ON subscriptions.person_id = ?1
                         AND subscriptions.feed_id = feed_folders.feed_id
                 WHERE feed_folders.folder_id = ?2 AND subscriptions.unsubscribed_at IS NULL)",
        )
        .bind(person)
        .bind(hidden)
        .fetch_one(&mut *connection)
        .await?;
        if !waiting {
            return Ok(Renamed::Taken(other));
        }
        sqlx::query(
            "INSERT OR IGNORE INTO feed_folders (folder_id, feed_id)
             SELECT ?, feed_id FROM feed_folders WHERE folder_id = ?",
        )
        .bind(id)
        .bind(hidden)
        .execute(&mut *connection)
        .await?;
        sqlx::query("DELETE FROM feed_folders WHERE folder_id = ?")
            .bind(hidden)
            .execute(&mut *connection)
            .await?;
        sqlx::query("DELETE FROM folders WHERE id = ? AND person_id = ?")
            .bind(hidden)
            .bind(person)
            .execute(&mut *connection)
            .await?;
    }
    let renamed = sqlx::query("UPDATE folders SET name = ? WHERE id = ? AND person_id = ?")
        .bind(name)
        .bind(id)
        .bind(person)
        .execute(&mut *connection)
        .await;
    match renamed {
        Ok(renamed) if renamed.rows_affected() == 0 => Ok(Renamed::NoFolder),
        Ok(_) => Ok(Renamed::Done),
        Err(sqlx::Error::Database(error)) if error.is_unique_violation() => {
            Ok(Renamed::Taken(None))
        }
        Err(error) => Err(error),
    }
}

/// What deleting a folder took away, for Undo to hand back (`put_back`).
pub struct Deleted {
    pub name: String,
    /// The feeds that were in it.
    pub feeds: Vec<i64>,
}

/// Deletes one of the reader's folders, the one way every door does it (the
/// screen and assistants). Its feeds stay followed; they just leave
/// it. Answers what Undo needs, or `None` when the reader has no
/// such folder.
pub async fn delete(
    connection: &mut SqliteConnection,
    person: i64,
    id: i64,
) -> Result<Option<Deleted>, sqlx::Error> {
    let feeds: Vec<i64> = sqlx::query_scalar(
        "SELECT feed_id FROM feed_folders WHERE folder_id =
             (SELECT id FROM folders WHERE id = ? AND person_id = ?)",
    )
    .bind(id)
    .bind(person)
    .fetch_all(&mut *connection)
    .await?;
    let name: Option<String> =
        sqlx::query_scalar("DELETE FROM folders WHERE id = ? AND person_id = ? RETURNING name")
            .bind(id)
            .bind(person)
            .fetch_optional(&mut *connection)
            .await?;
    let Some(name) = name else {
        return Ok(None);
    };
    Ok(Some(Deleted { name, feeds }))
}

/// Undo for `delete`: fills the folder made again, numbered `id`, with the
/// feeds the reader still follows.
pub async fn put_back(
    connection: &mut SqliteConnection,
    person: i64,
    id: i64,
    feeds: &[i64],
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR IGNORE INTO feed_folders (folder_id, feed_id)
         SELECT ?, feed_id FROM subscriptions
         WHERE person_id = ? AND feed_id IN (SELECT value FROM json_each(?))
             AND unsubscribed_at IS NULL",
    )
    .bind(id)
    .bind(person)
    .bind(serde_json::to_string(feeds).unwrap_or_else(|_| "[]".to_owned()))
    .execute(&mut *connection)
    .await?;
    Ok(())
}
