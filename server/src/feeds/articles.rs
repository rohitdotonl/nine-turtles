//! Reading articles (SPEC sections 7 and 32): one for the reading area, or
//! several at once for reading offline, and the one way every reader of an
//! article (screen, sync apps, assistants, exports) gets its text.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feed,
};

/// One article, everything the reading area shows (SPEC section 7).
#[derive(Serialize, sqlx::FromRow)]
pub struct FullArticle {
    pub id: i64,
    pub feed_id: i64,
    pub feed_title: String,
    /// The publisher's website, so the source is credited with a link.
    pub site_url: Option<String>,
    pub title: String,
    /// The original article: "Open original" and Copy link go here.
    pub link: Option<String>,
    pub author: Option<String>,
    /// The article's text, already cleaned (feed/clean.rs). Null when the feed
    /// gives only a summary.
    pub content: Option<String>,
    pub summary: Option<String>,
    /// The article's language, or its feed's; null if neither says.
    pub language: Option<String>,
    /// Seconds since 1970 (UTC), as in the list.
    pub at: i64,
    pub read: bool,
    pub starred: bool,
    /// A podcast's episode (SPEC section 35): the publisher's own address
    /// for its audio file, which the reader's browser plays from there.
    /// Null for any other article.
    pub episode_url: Option<String>,
    pub episode_type: Option<String>,
    pub episode_bytes: Option<i64>,
    pub episode_seconds: Option<i64>,
    pub episode_artwork: Option<String>,
}

/// Only an article the reader has (an entry of theirs); any other is not
/// found, as if it didn't exist.
pub(super) async fn read_article(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match full_articles(&state, person, &[id]).await {
        Ok(mut found) => match found.pop() {
            Some(article) => Json(json!({ "article": article })).into_response(),
            None => StatusCode::NOT_FOUND.into_response(),
        },
        Err(error) => database_problem("reading an article", &error),
    }
}

/// The most articles `/api/articles/several` gives at once.
pub const SEVERAL_AT_ONCE: usize = 50;

#[derive(Deserialize)]
pub(super) struct Several {
    /// The articles' numbers, separated by commas.
    ids: String,
}

/// Several articles at once, for the copies kept on a device for reading
/// offline (SPEC section 32): a few requests instead of hundreds, and only
/// the words, each image a short note (`feed::text_only`). Only the
/// reader's own; any other is left out, so the answer may hold fewer than
/// were asked for.
pub(super) async fn read_several(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Query(query): Query<Several>,
) -> Response {
    let ids: Option<Vec<i64>> = query
        .ids
        .split(',')
        .filter(|id| !id.is_empty())
        .map(|id| id.trim().parse().ok())
        .collect();
    let Some(ids) = ids else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    if ids.len() > SEVERAL_AT_ONCE {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
    match full_articles(&state, person, &ids).await {
        Ok(mut articles) => {
            for article in &mut articles {
                article.content = article.content.take().map(|html| feed::text_only(&html));
                article.summary = article.summary.take().map(|html| feed::text_only(&html));
            }
            Json(json!({ "articles": articles })).into_response()
        }
        Err(error) => database_problem("reading articles", &error),
    }
}

/// Where a reader's articles come from: their own entries, each with its
/// article, its feed and the reader's subscription to it (whose title is
/// their name for the feed). Followed by the reader. Every list that shows
/// articles with their text uses it: the reading area, sync apps
/// (`greader`) and the starred and collections exports.
macro_rules! from_entries {
    () => {
        " FROM entries CROSS JOIN articles ON articles.id = entries.article_id
             CROSS JOIN feeds ON feeds.id = entries.feed_id
             CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
                 AND subscriptions.feed_id = entries.feed_id
         WHERE entries.person_id = "
    };
}
pub(crate) use from_entries;

/// A stored article's text as every reader of it gets it: on screen, in
/// sync apps, to assistants and in exports. Articles stored before trackers
/// were taken out on arrival (Milestone 5, decision 0112) lose them here
/// instead, and their pictures load as the reader reaches them. Newer
/// articles come through unchanged.
pub(crate) fn stored_html(html: &str) -> String {
    feed::without_trackers(html, None)
}

/// A stored article's link without tracking tags, for the same reason as
/// `stored_html`.
pub(crate) fn stored_link(link: &str) -> String {
    feed::link_without_tracking(link)
}

/// The reader's articles among `ids`, each ready for the reading area.
pub(crate) async fn full_articles(
    state: &AppState,
    person: i64,
    ids: &[i64],
) -> Result<Vec<FullArticle>, sqlx::Error> {
    let ids = serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_owned());
    let mut articles: Vec<FullArticle> = sqlx::query_as(concat!(
        "SELECT articles.id, entries.feed_id, subscriptions.title AS feed_title,
                 feeds.site_url, articles.title, articles.link, articles.author,
                 articles.content, articles.summary,
                 COALESCE(articles.language, feeds.language) AS language,
                 entries.sort_at AS at, entries.read, entries.starred,
                 articles.episode_url, articles.episode_type, articles.episode_bytes,
                 articles.episode_seconds, articles.episode_artwork",
        from_entries!(),
        "? AND entries.article_id IN (SELECT value FROM json_each(?))"
    ))
    .bind(person)
    .bind(ids)
    .fetch_all(&state.db)
    .await?;
    for article in &mut articles {
        article.content = article.content.take().map(|html| stored_html(&html));
        article.summary = article.summary.take().map(|html| stored_html(&html));
        article.link = article.link.take().map(|link| stored_link(&link));
        article.language = article.language.take().filter(|tag| is_language_tag(tag));
    }
    Ok(articles)
}

/// A language as feeds write it (`en`, `en-GB`, `hi`), so screen readers can
/// use it. Anything else is left out rather than guessed.
fn is_language_tag(tag: &str) -> bool {
    let mut parts = tag.split('-');
    let first = parts.next().unwrap_or("");
    (2..=8).contains(&first.len())
        && first.chars().all(|c| c.is_ascii_alphabetic())
        && parts.all(|part| {
            (1..=8).contains(&part.len()) && part.chars().all(|c| c.is_ascii_alphanumeric())
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_real_language_tags_mark_an_article() {
        for good in ["en", "en-GB", "hi", "zh-Hant-TW", "pt-br"] {
            assert!(is_language_tag(good), "{good}");
        }
        for bad in ["", "e", "en_GB", "english language", "en-", "<b>"] {
            assert!(!is_language_tag(bad), "{bad}");
        }
    }
}
