//! The rule actions other parts share (the screen, assistants, clearing a
//! feed), so each is written once (ENGINEERING.md → "Keeping
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

/// A reader's feed is cleared: their rules for it pass to another place of
/// the same person they still follow, or else stay, matching nothing, and
/// Settings says so, until the reader chooses someone else. Other readers'
/// rules for the same feed carry on.
pub async fn place_gone_for(
    connection: &mut SqliteConnection,
    person: i64,
    feed_id: i64,
) -> Result<(), sqlx::Error> {
    let moved: Vec<(i64, Option<i64>)> = sqlx::query_as(
        "UPDATE rules SET feed_id = (SELECT other.feed_id FROM subscriptions AS gone
                 JOIN subscriptions AS other ON other.person_id = gone.person_id
                     AND other.writer_id = gone.writer_id AND other.feed_id != gone.feed_id
                     AND other.unsubscribed_at IS NULL
             WHERE gone.person_id = ?1 AND gone.feed_id = ?2
             ORDER BY other.added_at, other.feed_id LIMIT 1)
         WHERE person_id = ?1 AND feed_id = ?2 RETURNING id, feed_id",
    )
    .bind(person)
    .bind(feed_id)
    .fetch_all(&mut *connection)
    .await?;
    let gone: Vec<i64> = moved
        .into_iter()
        .filter_map(|(id, feed)| feed.is_none().then_some(id))
        .collect();
    sqlx::query("UPDATE rules SET place_gone = 1 WHERE id IN (SELECT value FROM json_each(?))")
        .bind(serde_json::to_string(&gone).unwrap_or_else(|_| "[]".to_owned()))
        .execute(connection)
        .await?;
    Ok(())
}
