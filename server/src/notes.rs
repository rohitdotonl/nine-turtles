//! Notes and highlights (SPEC section 42, decision 0164): the reader's
//! highlights on articles, each with an optional note; one note on a whole
//! article; and one note on each person. Each reader's alone: other readers
//! and the weekly email never see them; the reader's own AI
//! assistant can (SPEC section 33).
//!
//! A highlighted or noted article is kept forever, like a starred one: the
//! yearly clean-up and unsubscribing leave its entry (`cleanup`,
//! `folders::clear`), and the database refuses to delete an entry a note
//! still points at (structure change 34). Unsubscribing can remove them
//! instead, when the reader chooses to (`drop_kept`).
//!
//! A highlight is stored as the words marked, as plain text, with a few
//! characters either side; the web app finds them in the article's text
//! (`web/src/lib/highlights.ts`). Nothing here reads the article's HTML.

pub mod export;

use std::collections::HashMap;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::SqliteConnection;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::ArticleRow,
    now, refused,
};

/// The longest note kept, in characters: a page or so.
pub const LONGEST_NOTE: usize = 5_000;
/// The longest highlight, in characters: several paragraphs.
pub const LONGEST_QUOTE: usize = 5_000;
/// How much text either side of a highlight is kept to find it again.
pub const AROUND: usize = 64;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/articles/{id}/highlights", post(highlight))
        .route("/api/articles/{id}/note", post(note_on_article))
        .route("/api/highlights/{id}", post(change_highlight))
        .route("/api/highlights/{id}/delete", post(unhighlight))
        .route("/api/feeds/{id}/note", post(note_on_person))
        .route("/api/feeds/{id}/kept", get(kept))
        .route("/api/feeds/{id}/highlights", get(their_highlights))
        .route("/api/notes/export", get(export::download))
}

/// A highlight or a note on a whole article, as the reading area shows it.
#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow, PartialEq, Eq)]
pub struct Note {
    pub id: i64,
    /// The words highlighted; none for the note on the whole article.
    pub quote: Option<String>,
    /// A little of the text just before and after them, to find the right place.
    #[serde(default)]
    pub before: String,
    #[serde(default)]
    pub after: String,
    pub note: Option<String>,
    /// When it was made, in seconds since 1970 (UTC).
    #[serde(default)]
    pub made_at: i64,
}

/// A note as typed: trimmed, at most `LONGEST_NOTE` characters, and only
/// the characters text has (line breaks and tabs, no other control
/// characters). None when nothing is left; `TooLong` when it's too long.
pub fn clean_note(raw: &str) -> Result<Option<String>, Refusal> {
    let kept: String = raw
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
        .collect();
    let kept = kept.trim();
    if kept.chars().count() > LONGEST_NOTE {
        return Err(Refusal::TooLong);
    }
    Ok((!kept.is_empty()).then(|| kept.to_owned()))
}

/// A note, with the article it's on.
#[derive(sqlx::FromRow)]
struct Row {
    article_id: i64,
    #[sqlx(flatten)]
    note: Note,
}

/// The reader's notes on these articles, each article's in the order made.
pub async fn of_articles(
    executor: impl sqlx::SqliteExecutor<'_>,
    person: i64,
    ids: &[i64],
) -> Result<HashMap<i64, Vec<Note>>, sqlx::Error> {
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT article_id, id, quote, before, after, note, made_at FROM notes
             WHERE person_id = ? AND article_id IN (SELECT value FROM json_each(?))
             ORDER BY article_id, made_at, id",
    )
    .bind(person)
    .bind(Value::from(ids).to_string())
    .fetch_all(executor)
    .await?;
    let mut found: HashMap<i64, Vec<Note>> = HashMap::new();
    for row in rows {
        found.entry(row.article_id).or_default().push(row.note);
    }
    Ok(found)
}

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
}

/// Why a highlight or note wasn't kept.
#[derive(Debug, PartialEq, Eq)]
pub enum Refusal {
    /// Not the reader's article, highlight or place.
    NotFound,
    /// No words to highlight, or more than `LONGEST_QUOTE`.
    NoQuote,
    /// A note longer than `LONGEST_NOTE`.
    TooLong,
}

fn around(text: &str, from_end: bool) -> String {
    let count = text.chars().count();
    if from_end {
        text.chars().skip(count.saturating_sub(AROUND)).collect()
    } else {
        text.chars().take(AROUND).collect()
    }
}

/// Highlights words in one of the reader's articles. Answers the highlight.
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
    let at = now();
    let made: Option<i64> = sqlx::query_scalar(
        "INSERT INTO notes (person_id, article_id, quote, before, after, note, made_at, changed_at)
         SELECT person_id, article_id, ?3, ?4, ?5, ?6, ?7, ?7 FROM entries
         WHERE person_id = ?1 AND article_id = ?2
         RETURNING id",
    )
    .bind(person)
    .bind(article)
    .bind(quote)
    .bind(around(&form.before, true))
    .bind(around(&form.after, false))
    .bind(&note)
    .bind(at)
    .fetch_optional(db)
    .await?;
    Ok(made.map_or(Err(Refusal::NotFound), |id| {
        Ok(Note {
            id,
            quote: Some(quote.to_owned()),
            before: around(&form.before, true),
            after: around(&form.after, false),
            note,
            made_at: at,
        })
    }))
}

/// Changes a highlight's note (none takes it off). Answers the highlight as
/// it was, for Undo.
pub async fn set_highlight_note(
    db: &sqlx::SqlitePool,
    person: i64,
    id: i64,
    note: &str,
) -> Result<Result<Note, Refusal>, sqlx::Error> {
    let Ok(note) = clean_note(note) else {
        return Ok(Err(Refusal::TooLong));
    };
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let Some(was) = one(&mut transaction, person, id).await? else {
        return Ok(Err(Refusal::NotFound));
    };
    sqlx::query("UPDATE notes SET note = ?, changed_at = ? WHERE id = ? AND person_id = ?")
        .bind(&note)
        .bind(now())
        .bind(id)
        .bind(person)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(Ok(was))
}

/// One of the reader's highlights, with the article it's on.
async fn one(
    connection: &mut SqliteConnection,
    person: i64,
    id: i64,
) -> Result<Option<Note>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, quote, before, after, note, made_at FROM notes
         WHERE id = ? AND person_id = ? AND quote IS NOT NULL",
    )
    .bind(id)
    .bind(person)
    .fetch_optional(connection)
    .await
}

/// Removes a highlight and its note. Answers what it was, so Undo can make
/// it again.
pub async fn remove_highlight(
    db: &sqlx::SqlitePool,
    person: i64,
    id: i64,
) -> Result<Option<Note>, sqlx::Error> {
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let Some(was) = one(&mut transaction, person, id).await? else {
        return Ok(None);
    };
    sqlx::query("DELETE FROM notes WHERE id = ? AND person_id = ?")
        .bind(id)
        .bind(person)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(Some(was))
}

/// Sets the reader's note on a whole article; an empty one removes it.
/// Answers the note it had (none if none), for Undo.
pub async fn set_article_note(
    db: &sqlx::SqlitePool,
    person: i64,
    article: i64,
    note: &str,
) -> Result<Result<Option<String>, Refusal>, sqlx::Error> {
    let Ok(note) = clean_note(note) else {
        return Ok(Err(Refusal::TooLong));
    };
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let has: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM entries WHERE person_id = ? AND article_id = ?)",
    )
    .bind(person)
    .bind(article)
    .fetch_one(&mut *transaction)
    .await?;
    if !has {
        return Ok(Err(Refusal::NotFound));
    }
    let was: Option<String> = sqlx::query_scalar(
        "DELETE FROM notes WHERE person_id = ? AND article_id = ? AND quote IS NULL RETURNING note",
    )
    .bind(person)
    .bind(article)
    .fetch_optional(&mut *transaction)
    .await?
    .flatten();
    if let Some(note) = &note {
        let at = now();
        sqlx::query(
            "INSERT INTO notes (person_id, article_id, note, made_at, changed_at)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(person)
        .bind(article)
        .bind(note)
        .bind(at)
        .bind(at)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    Ok(Ok(was))
}

/// Sets the reader's note on a person, on every place of theirs they follow
/// (as the address to write to is, decision 0147); an empty one removes it.
/// Answers the note it had, for Undo.
pub async fn set_person_note(
    db: &sqlx::SqlitePool,
    person: i64,
    feed: i64,
    note: &str,
) -> Result<Result<Option<String>, Refusal>, sqlx::Error> {
    let Ok(note) = clean_note(note) else {
        return Ok(Err(Refusal::TooLong));
    };
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let was: Option<Option<String>> = sqlx::query_scalar(
        "SELECT note FROM subscriptions
         WHERE person_id = ? AND feed_id = ? AND unsubscribed_at IS NULL",
    )
    .bind(person)
    .bind(feed)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(was) = was else {
        return Ok(Err(Refusal::NotFound));
    };
    sqlx::query(
        "UPDATE subscriptions SET note = ?1
         WHERE person_id = ?2 AND unsubscribed_at IS NULL
             AND (feed_id = ?3 OR writer_id = (SELECT writer_id FROM subscriptions
                      WHERE person_id = ?2 AND feed_id = ?3 AND unsubscribed_at IS NULL))",
    )
    .bind(&note)
    .bind(person)
    .bind(feed)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Ok(was))
}

/// The notes of several places, joined into one (joining people, SPEC
/// section 36): each different note once, in the order given, a blank line
/// between them.
pub fn joined(notes: &[Option<String>]) -> Option<String> {
    let mut kept: Vec<&str> = Vec::new();
    for note in notes.iter().flatten() {
        if !kept.contains(&note.as_str()) {
            kept.push(note);
        }
    }
    (!kept.is_empty()).then(|| kept.join("\n\n"))
}

/// What unsubscribing from a place would keep: how many of its articles the
/// reader starred, how many they highlighted or wrote a note on, and
/// whether they wrote a note on the person.
#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct Kept {
    pub starred: i64,
    pub marked: i64,
    pub note: bool,
}

/// The places of the person place `?2` belongs to, for reader `?1`: `places`,
/// with each place's `feed_id` and the reader's `note` on it. Every place at
/// once, as "Unsubscribe from …" leaves them all and their page lists them all.
macro_rules! places_of {
    () => {
        "WITH places AS (
             SELECT feed_id, note FROM subscriptions
             WHERE person_id = ?1 AND unsubscribed_at IS NULL AND (feed_id = ?2 OR writer_id =
                 (SELECT writer_id FROM subscriptions WHERE person_id = ?1 AND feed_id = ?2)))"
    };
}

pub async fn kept_by(
    db: &sqlx::SqlitePool,
    person: i64,
    feed: i64,
) -> Result<Option<Kept>, sqlx::Error> {
    // Every place of the person's at once, as "Unsubscribe from …" leaves them all.
    let found: Option<(i64, i64, bool)> = sqlx::query_as(concat!(
        places_of!(),
        "
         SELECT
             (SELECT COUNT(*) FROM entries WHERE person_id = ?1 AND starred = 1
                  AND feed_id IN (SELECT feed_id FROM places)),
             (SELECT COUNT(DISTINCT notes.article_id) FROM notes JOIN entries
                  ON entries.person_id = notes.person_id AND entries.article_id = notes.article_id
              WHERE notes.person_id = ?1 AND entries.feed_id IN (SELECT feed_id FROM places)),
             EXISTS (SELECT 1 FROM places WHERE note IS NOT NULL)
         FROM subscriptions WHERE person_id = ?1 AND feed_id = ?2 AND unsubscribed_at IS NULL",
    ))
    .bind(person)
    .bind(feed)
    .fetch_optional(db)
    .await?;
    Ok(found.map(|(starred, marked, note)| Kept {
        starred,
        marked,
        note,
    }))
}

/// Unsubscribing with "Remove them too": what the reader kept from these
/// places goes once the unsubscribe is cleared for good (`drop_kept`); Undo
/// before then brings it all back (`feeds::store::follow_again`).
pub async fn drop_later(
    connection: &mut SqliteConnection,
    person: i64,
    feeds: &[i64],
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE subscriptions SET drop_kept = 1
         WHERE person_id = ? AND feed_id IN (SELECT value FROM json_each(?))",
    )
    .bind(person)
    .bind(serde_json::to_string(feeds).unwrap_or_else(|_| "[]".to_owned()))
    .execute(&mut *connection)
    .await?;
    Ok(())
}

/// When an unsubscribe is cleared for good and the reader chose to remove
/// what they kept (`subscriptions.drop_kept`): their highlights and notes on
/// the place's articles and their note on the person go, and its articles
/// are unstarred, so `folders::clear` then removes them with the rest.
pub async fn drop_kept(
    connection: &mut SqliteConnection,
    person: i64,
    feed: i64,
) -> Result<(), sqlx::Error> {
    let dropping: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM subscriptions
                        WHERE person_id = ? AND feed_id = ? AND drop_kept = 1)",
    )
    .bind(person)
    .bind(feed)
    .fetch_one(&mut *connection)
    .await?;
    if !dropping {
        return Ok(());
    }
    sqlx::query(
        "DELETE FROM notes WHERE person_id = ?1 AND article_id IN
             (SELECT article_id FROM entries WHERE person_id = ?1 AND feed_id = ?2)",
    )
    .bind(person)
    .bind(feed)
    .execute(&mut *connection)
    .await?;
    sqlx::query(
        "UPDATE entries SET starred = 0 WHERE person_id = ? AND feed_id = ? AND starred = 1",
    )
    .bind(person)
    .bind(feed)
    .execute(&mut *connection)
    .await?;
    sqlx::query("UPDATE subscriptions SET note = NULL WHERE person_id = ? AND feed_id = ?")
        .bind(person)
        .bind(feed)
        .execute(&mut *connection)
        .await?;
    Ok(())
}

fn answer_refusal(refusal: &Refusal) -> Response {
    match refusal {
        Refusal::NotFound => refused(StatusCode::NOT_FOUND, "not-found"),
        Refusal::NoQuote => refused(StatusCode::BAD_REQUEST, "no-quote"),
        Refusal::TooLong => refused(StatusCode::BAD_REQUEST, "too-long"),
    }
}

async fn highlight(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<NewHighlight>,
) -> Response {
    match add_highlight(&state.db, person, id, &form).await {
        Ok(Ok(made)) => (StatusCode::CREATED, Json(json!({ "highlight": made }))).into_response(),
        Ok(Err(refusal)) => answer_refusal(&refusal),
        Err(error) => database_problem("highlighting", &error),
    }
}

#[derive(Deserialize)]
struct Text {
    #[serde(default)]
    note: String,
}

async fn change_highlight(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<Text>,
) -> Response {
    match set_highlight_note(&state.db, person, id, &form.note).await {
        Ok(Ok(was)) => Json(json!({ "was": was })).into_response(),
        Ok(Err(refusal)) => answer_refusal(&refusal),
        Err(error) => database_problem("changing a highlight's note", &error),
    }
}

async fn unhighlight(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match remove_highlight(&state.db, person, id).await {
        Ok(Some(was)) => Json(json!({ "was": was })).into_response(),
        Ok(None) => refused(StatusCode::NOT_FOUND, "not-found"),
        Err(error) => database_problem("removing a highlight", &error),
    }
}

async fn note_on_article(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<Text>,
) -> Response {
    match set_article_note(&state.db, person, id, &form.note).await {
        Ok(Ok(was)) => Json(json!({ "was": was })).into_response(),
        Ok(Err(refusal)) => answer_refusal(&refusal),
        Err(error) => database_problem("keeping a note on an article", &error),
    }
}

async fn note_on_person(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<Text>,
) -> Response {
    match set_person_note(&state.db, person, id, &form.note).await {
        Ok(Ok(was)) => Json(json!({ "was": was })).into_response(),
        Ok(Err(refusal)) => answer_refusal(&refusal),
        Err(error) => database_problem("keeping a note on a person", &error),
    }
}

async fn kept(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match kept_by(&state.db, person, id).await {
        Ok(Some(kept)) => Json(kept).into_response(),
        Ok(None) => refused(StatusCode::NOT_FOUND, "not-found"),
        Err(error) => database_problem("counting what unsubscribing keeps", &error),
    }
}

/// The most highlights their page lists: a page, not an archive (Notes has them all).
pub const THEIR_HIGHLIGHTS: i64 = 20;

/// A highlight from the person's writing, as their page lists it (decision
/// 0211): the words, the reader's note on them, and the article they're in.
#[derive(Serialize, sqlx::FromRow)]
pub struct TheirHighlight {
    #[sqlx(rename = "highlight_id")]
    pub id: i64,
    pub quote: String,
    pub note: Option<String>,
    #[sqlx(flatten)]
    pub article: ArticleRow,
}

/// The reader's highlights in articles from every place of the person's,
/// the newest article first and, within one, in the order they were made.
pub async fn highlights_of(
    db: &sqlx::SqlitePool,
    person: i64,
    feed: i64,
) -> Result<Vec<TheirHighlight>, sqlx::Error> {
    sqlx::query_as(concat!(
        places_of!(),
        "
         SELECT notes.id AS highlight_id, notes.quote, notes.note,
             entries.article_id AS id, entries.feed_id,
             COALESCE(writers.name, subscriptions.title) AS feed_title,
             articles.title, articles.link, entries.sort_at AS at,
             entries.read, entries.starred, entries.muted,
             articles.episode_url IS NOT NULL AS episode, articles.episode_seconds, ",
        crate::feeds::untitled_body!(),
        "
         FROM notes
             JOIN entries ON entries.person_id = notes.person_id AND entries.article_id = notes.article_id
             JOIN articles ON articles.id = entries.article_id
             JOIN subscriptions ON subscriptions.person_id = entries.person_id
                 AND subscriptions.feed_id = entries.feed_id
             LEFT JOIN writers ON writers.id = subscriptions.writer_id
         WHERE notes.person_id = ?1 AND notes.quote IS NOT NULL
             AND entries.feed_id IN (SELECT feed_id FROM places)
         ORDER BY entries.sort_at DESC, notes.made_at, notes.id
         LIMIT ?3",
    ))
    .bind(person)
    .bind(feed)
    .bind(THEIR_HIGHLIGHTS)
    .fetch_all(db)
    .await
}

async fn their_highlights(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match highlights_of(&state.db, person, id).await {
        Ok(found) => Json(json!({ "highlights": found })).into_response(),
        Err(error) => database_problem("listing their highlights", &error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notes_are_kept_as_typed_but_trimmed() {
        assert_eq!(
            clean_note("  Met at the fair.\n\n "),
            Ok(Some("Met at the fair.".to_owned()))
        );
        assert_eq!(clean_note("a\u{0}b\tc"), Ok(Some("ab\tc".to_owned())));
        assert_eq!(clean_note(" \n "), Ok(None));
        assert_eq!(
            clean_note(&"x".repeat(LONGEST_NOTE)).map(|n| n.map(|n| n.len())),
            Ok(Some(LONGEST_NOTE))
        );
        assert_eq!(
            clean_note(&"x".repeat(LONGEST_NOTE + 1)),
            Err(Refusal::TooLong)
        );
    }

    #[test]
    fn joined_notes_keep_each_different_one_once() {
        let a = Some("Met at the fair.".to_owned());
        let b = Some("Writes in spring.".to_owned());
        assert_eq!(
            joined(&[a.clone(), None, b, a]).as_deref(),
            Some("Met at the fair.\n\nWrites in spring.")
        );
        assert_eq!(joined(&[None, None]), None);
    }

    #[test]
    fn only_a_little_text_either_side_is_kept() {
        let long = "é".repeat(AROUND + 10);
        assert_eq!(around(&long, true).chars().count(), AROUND);
        assert_eq!(around("short", false), "short");
    }
}
