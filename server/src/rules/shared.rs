//! The rule actions other parts share (the screen, assistants, deleting a
//! folder or a feed), so each is written once (ENGINEERING.md → "Keeping
//! the code tidy").

use sqlx::SqliteConnection;

/// Deletes one of the reader's rules, the one way every door does it (the
/// screen, assistants). Answers whether the reader had it.
pub async fn delete<'c>(
    executor: impl sqlx::SqliteExecutor<'c>,
    person: i64,
    id: i64,
) -> Result<bool, sqlx::Error> {
    let deleted = sqlx::query("DELETE FROM rules WHERE id = ? AND person_id = ?")
        .bind(id)
        .bind(person)
        .execute(executor)
        .await?;
    Ok(deleted.rows_affected() > 0)
}

/// The folder a rule applied to is gone (folders belong to one reader): its
/// rules stay, matching nothing, and Settings says so, until the reader
/// chooses somewhere else. Answers the rules it changed, so Undo for deleting
/// a folder can hand them back (`back_in_folder`). A feed's rules go with
/// `place_gone_for`, which keeps to one reader, since others may follow it.
pub async fn place_gone(
    connection: &mut SqliteConnection,
    folder_id: i64,
) -> Result<Vec<i64>, sqlx::Error> {
    sqlx::query_scalar(
        "UPDATE rules SET place_gone = 1, feed_id = NULL, folder_id = NULL
         WHERE folder_id = ? RETURNING id",
    )
    .bind(folder_id)
    .fetch_all(connection)
    .await
}

/// A reader's feed is cleared: their rules for it stay, matching nothing,
/// as `place_gone` says for a folder. Other readers' rules for the same feed carry on.
pub async fn place_gone_for(
    connection: &mut SqliteConnection,
    person: i64,
    feed_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE rules SET place_gone = 1, feed_id = NULL, folder_id = NULL
         WHERE person_id = ? AND feed_id = ?",
    )
    .bind(person)
    .bind(feed_id)
    .execute(connection)
    .await?;
    Ok(())
}

/// Undo for deleting a folder: the reader's rules it had go back to the
/// folder made again, if they still have nowhere else.
pub async fn back_in_folder(
    connection: &mut SqliteConnection,
    person: i64,
    folder_id: i64,
    rules: &[i64],
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE rules SET folder_id = ?, place_gone = 0
         WHERE person_id = ? AND id IN (SELECT value FROM json_each(?)) AND place_gone = 1
             AND feed_id IS NULL AND folder_id IS NULL",
    )
    .bind(folder_id)
    .bind(person)
    .bind(serde_json::to_string(rules).unwrap_or_else(|_| "[]".to_owned()))
    .execute(connection)
    .await?;
    Ok(())
}
