//! A new highlight (SPEC section 42): the words, a little either side,
//! and an optional note. One sent again under the key the web app made for
//! it is saved once (decision 0255).

use serde::Deserialize;

use super::{AROUND, LONGEST_QUOTE, Note, Refusal, clean_note};
use crate::now;

/// What a new highlight holds.
#[derive(Deserialize)]
pub struct NewHighlight {
    pub quote: String,
    #[serde(default)]
    pub before: String,
    #[serde(default)]
    pub after: String,
    #[serde(default)]
    pub note: Option<String>,
    /// The key the web app made for this highlight (decision 0255): sent
    /// again with the same key, the highlight already saved is answered
    /// instead of a second one. None from an assistant.
    #[serde(default)]
    pub key: Option<String>,
}

/// The longest key a new highlight may carry; a longer one, or one with
/// other characters than letters, digits and `-`, is ignored.
const LONGEST_KEY: usize = 64;

fn made_key(form: &NewHighlight) -> Option<&str> {
    form.key.as_deref().filter(|key| {
        !key.is_empty()
            && key.len() <= LONGEST_KEY
            && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    })
}

fn around(text: &str, from_end: bool) -> String {
    let count = text.chars().count();
    if from_end {
        text.chars().skip(count.saturating_sub(AROUND)).collect()
    } else {
        text.chars().take(AROUND).collect()
    }
}

/// Highlights words in one of the reader's articles. Answers the highlight:
/// sent again under the same key, the one already saved (decision 0255).
pub async fn add_highlight(
    db: &sqlx::SqlitePool,
    person: i64,
    article: i64,
    form: &NewHighlight,
) -> Result<Result<Note, Refusal>, sqlx::Error> {
    let quote = form.quote.trim();
    if quote.is_empty() || quote.chars().count() > LONGEST_QUOTE {
        return Ok(Err(Refusal::NoQuote));
    }
    let Ok(note) = clean_note(form.note.as_deref().unwrap_or_default()) else {
        return Ok(Err(Refusal::TooLong));
    };
    let key = made_key(form);
    let at = now();
    let made: Option<i64> = sqlx::query_scalar(
        "INSERT INTO notes (person_id, article_id, quote, before, after, note, made_at, changed_at, made_key)
         SELECT person_id, article_id, ?3, ?4, ?5, ?6, ?7, ?7, ?8 FROM entries
         WHERE person_id = ?1 AND article_id = ?2
         ON CONFLICT (person_id, made_key) WHERE made_key IS NOT NULL DO NOTHING
         RETURNING id",
    )
    .bind(person)
    .bind(article)
    .bind(quote)
    .bind(around(&form.before, true))
    .bind(around(&form.after, false))
    .bind(&note)
    .bind(at)
    .bind(key)
    .fetch_optional(db)
    .await?;
    let Some(id) = made else {
        // Sent before, under the same key: the one already saved, as it is now.
        return Ok(match key {
            Some(key) => saved_under(db, person, article, key)
                .await?
                .ok_or(Refusal::NotFound),
            None => Err(Refusal::NotFound),
        });
    };
    Ok(Ok(Note {
        id,
        quote: Some(quote.to_owned()),
        before: around(&form.before, true),
        after: around(&form.after, false),
        note,
        made_at: at,
        key: key.map(str::to_owned),
    }))
}

/// The reader's highlight on this article saved under `key`, if any.
async fn saved_under(
    db: &sqlx::SqlitePool,
    person: i64,
    article: i64,
    key: &str,
) -> Result<Option<Note>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, quote, before, after, note, made_at, made_key AS key FROM notes
         WHERE person_id = ? AND made_key = ? AND article_id = ? AND quote IS NOT NULL",
    )
    .bind(person)
    .bind(key)
    .bind(article)
    .fetch_optional(db)
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_little_text_either_side_is_kept() {
        let long = "é".repeat(AROUND + 10);
        assert_eq!(around(&long, true).chars().count(), AROUND);
        assert_eq!(around("short", false), "short");
    }
}
