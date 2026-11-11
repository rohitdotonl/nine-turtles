//! The reader's notes and highlights for their own assistant (SPEC sections
//! 33 and 42, decision 0164): it can read them, highlight words, and write
//! or change notes, through the same functions the screen uses (`notes`).
//! Removing a highlight answers what it was, so the assistant can put it
//! back.

use serde::Deserialize;
use serde_json::{Value, json};

use super::{Answer, database, reading::plain_text};
use crate::{
    AppState, feeds,
    notes::{self, NewHighlight, Refusal},
};

fn refusal(refusal: &Refusal) -> String {
    match refusal {
        Refusal::NotFound => "The reader has no article, highlight or feed with that id.",
        Refusal::NoQuote => {
            "There are no words to highlight, or too many (at most 5,000 characters)."
        }
        Refusal::TooLong => "That note is too long: at most 5,000 characters.",
    }
    .to_owned()
}

/// Everything the reader wrote, as the Markdown file Your data exports.
pub(super) async fn read_notes(state: &AppState, person: i64) -> Answer {
    let text = notes::export::markdown(&state.db, person, crate::now())
        .await
        .map_err(|error| database(&error))?;
    Ok(json!({ "format": "Markdown", "text": text }))
}

/// The reader's highlights and note on one article, for `open_article`.
pub(super) fn of_article(found: &[notes::Note]) -> Value {
    let highlights: Vec<Value> = found
        .iter()
        .filter_map(|note| {
            Some(json!({ "highlight_id": note.id, "words": note.quote.as_ref()?, "note": note.note }))
        })
        .collect();
    let whole = found
        .iter()
        .find(|note| note.quote.is_none())
        .and_then(|note| note.note.clone());
    json!({ "highlights": highlights, "your_note": whole })
}

#[derive(Deserialize)]
pub(super) struct Highlighting {
    article_id: i64,
    words: String,
    #[serde(default)]
    note: Option<String>,
}

/// Highlights words found in the article's text, as the reader would.
pub(super) async fn add_highlight(state: &AppState, person: i64, asked: Highlighting) -> Answer {
    let found = feeds::full_articles(state, person, &[asked.article_id])
        .await
        .map_err(|error| database(&error))?;
    let Some(article) = found.into_iter().next() else {
        return Err(refusal(&Refusal::NotFound));
    };
    let html = article
        .content
        .as_deref()
        .or(article.summary.as_deref())
        .unwrap_or_default();
    let text = plain_text(html)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let words = asked.words.split_whitespace().collect::<Vec<_>>().join(" ");
    let Some(at) = (!words.is_empty()).then(|| text.find(&words)).flatten() else {
        return Err("Those words aren't in the article's text. Copy them exactly as open_article shows them.".to_owned());
    };
    let form = NewHighlight {
        quote: words.clone(),
        before: text[..at].to_owned(),
        after: text[at + words.len()..].to_owned(),
        note: asked.note,
        key: None,
    };
    match notes::add_highlight(&state.db, person, asked.article_id, &form).await {
        Ok(Ok(made)) => Ok(json!({ "done": true, "highlight_id": made.id })),
        Ok(Err(why)) => Err(refusal(&why)),
        Err(error) => Err(database(&error)),
    }
}

#[derive(Deserialize)]
pub(super) struct HighlightNote {
    highlight_id: i64,
    #[serde(default)]
    note: String,
}

pub(super) async fn edit_highlight(state: &AppState, person: i64, asked: HighlightNote) -> Answer {
    match notes::set_highlight_note(&state.db, person, asked.highlight_id, &asked.note).await {
        Ok(Ok(was)) => Ok(json!({ "done": true, "note_before": was.note })),
        Ok(Err(why)) => Err(refusal(&why)),
        Err(error) => Err(database(&error)),
    }
}

#[derive(Deserialize)]
pub(super) struct OneHighlight {
    highlight_id: i64,
}

pub(super) async fn remove_highlight(state: &AppState, person: i64, asked: OneHighlight) -> Answer {
    match notes::remove_highlight(&state.db, person, asked.highlight_id).await {
        Ok(Some(was)) => Ok(json!({
            "done": true,
            "removed": { "words": was.quote, "note": was.note },
            "undo": "add_highlight with the same words and note puts it back.",
        })),
        Ok(None) => Err(refusal(&Refusal::NotFound)),
        Err(error) => Err(database(&error)),
    }
}

#[derive(Deserialize)]
pub(super) struct ArticleNote {
    article_id: i64,
    #[serde(default)]
    note: String,
}

pub(super) async fn set_article_note(state: &AppState, person: i64, asked: ArticleNote) -> Answer {
    match notes::set_article_note(&state.db, person, asked.article_id, &asked.note).await {
        Ok(Ok(was)) => Ok(json!({ "done": true, "note_before": was })),
        Ok(Err(why)) => Err(refusal(&why)),
        Err(error) => Err(database(&error)),
    }
}

#[derive(Deserialize)]
pub(super) struct PersonNote {
    feed_id: i64,
    #[serde(default)]
    note: String,
}

pub(super) async fn set_person_note(state: &AppState, person: i64, asked: PersonNote) -> Answer {
    match notes::set_person_note(&state.db, person, asked.feed_id, &asked.note).await {
        Ok(Ok(was)) => Ok(json!({ "done": true, "note_before": was })),
        Ok(Err(why)) => Err(refusal(&why)),
        Err(error) => Err(database(&error)),
    }
}
