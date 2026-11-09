//! Seeing what a word will hide before it's added (SPEC section 27,
//! decision 0216): as the reader types in Settings › Hiding, the screen asks
//! which unread articles the word would hide, from everyone or from the one
//! person the field is for. It only reads: nothing is hidden until Add.
//! The same matching as Add (`matching_now`), so the two never disagree.

use axum::{
    Json,
    extract::State,
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use serde_json::json;

use super::{Rule, checked, holds, matching_now, problem, words_of};
use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::ArticleRow,
};

/// How many of the matching articles the screen lists, newest first; the
/// rest are counted.
const SHOWN: i64 = 5;

/// What the screen sends as the reader types.
#[derive(Deserialize)]
pub(super) struct Typed {
    words: String,
    /// The person, by one of their places; none for everyone.
    #[serde(default)]
    feed_id: Option<i64>,
}

/// How many unread articles the typed word would hide, the newest few of
/// them, and which of those it was found in the title of.
pub(super) async fn preview(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(typed): Json<Typed>,
) -> Response {
    let found = async {
        let mut connection = state.db.acquire().await?;
        let form = super::RuleForm {
            words: typed.words,
            feed_id: typed.feed_id,
            title_only: false,
            paused: false,
            place_gone: false,
            days: None,
            until: None,
            restore: false,
        };
        let words = match checked(&mut connection, person, &form).await? {
            Ok(words) => words,
            Err(refusal) => return Ok(Err(refusal)),
        };
        drop(connection);
        let rule = Rule {
            id: 0,
            person_id: person,
            words,
            title_only: false,
            feed_id: typed.feed_id,
            place_gone: false,
            paused: false,
            until: None,
        };
        let ids = matching_now(&state.db, &rule).await?;
        let articles: Vec<ArticleRow> = sqlx::query_as(concat!(
            "SELECT entries.article_id AS id, entries.feed_id, COALESCE(writers.name, subscriptions.title) AS feed_title,
                    articles.title, articles.link, entries.sort_at AS at,
                    entries.read, entries.starred, entries.muted,
                    articles.episode_url IS NOT NULL AS episode, articles.episode_seconds,",
            crate::feeds::publication_writer!(),
            ", ",
            crate::feeds::untitled_body!(),
            "
             FROM entries CROSS JOIN articles ON articles.id = entries.article_id
                 CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
                     AND subscriptions.feed_id = entries.feed_id
                 LEFT JOIN writers ON writers.id = subscriptions.writer_id
             WHERE entries.person_id = ? AND entries.article_id IN (SELECT value FROM json_each(?))
             ORDER BY entries.sort_at DESC, entries.article_id DESC LIMIT ?"
        ))
        .bind(person)
        .bind(serde_json::to_string(&ids).unwrap_or_else(|_| "[]".to_owned()))
        .bind(SHOWN)
        .fetch_all(&state.db)
        .await?;
        let phrase = words_of(&rule.words);
        let in_title: Vec<i64> = articles
            .iter()
            .filter(|article| holds(&words_of(&article.title), &phrase))
            .map(|article| article.id)
            .collect();
        Ok::<_, sqlx::Error>(Ok((ids.len(), articles, in_title)))
    }
    .await;
    match found {
        Ok(Ok((count, articles, in_title))) => {
            Json(json!({ "count": count, "articles": articles, "in_title": in_title }))
                .into_response()
        }
        Ok(Err(refusal)) => problem(refusal),
        Err(error) => database_problem("previewing a word", &error),
    }
}
