//! Search (SPEC section 14): every article's title and text, in SQLite's
//! FTS5 search engine, and the question that finds articles in it.
//!
//! The search index (`articles_search`, structure change 6) keeps only where
//! each word appears, not a copy of the articles. Articles are added to it as
//! they arrive (`feeds::store_articles` calls `index`); one deleted leaves it
//! by itself (a rule in the database). Articles stored before search existed
//! are added once, in the background, when slowfeed starts (`index_missing`).
//!
//! The screen turns what the reader typed, chips included, into a few plain
//! settings: the words, a feed or folder, unread only, starred only, and a
//! date range. Results come in the item list's order, with articles whose
//! title holds every word first.

use axum::{
    Json, Router,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::{QueryBuilder, Sqlite, SqliteConnection};

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::{ArticleRow, Order, PAGE_SIZE},
    log,
};

/// How SQLite's FTS5 search engine splits text into words.
///
/// FTS5's standard `unicode61` splitter treats combining marks as spaces, so
/// Hindi words would be cut apart at every vowel sign (मात्रा). Adding the mark
/// categories (`M*`) to the word characters keeps them whole. `remove_diacritics
/// 2` lets "cafe" find "café". See docs/decisions/0004-search-hindi.md.
///
/// `migrations/0006_search.sql` writes the same setting out in full;
/// tests/search.rs checks the two match.
pub const FTS5_TOKENIZER: &str = "unicode61 remove_diacritics 2 categories 'L* N* Co M*'";

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/search", get(search))
}

/// An article's text as plain words, for the index: tags removed, each
/// piece of text kept apart from the next ("one</p><p>two" is two words).
pub fn plain_words(html: &str) -> String {
    scraper::Html::parse_fragment(html)
        .root_element()
        .text()
        .flat_map(str::split_whitespace)
        .collect::<Vec<_>>()
        .join(" ")
}

/// Adds an article to the search index, or replaces what the index had for
/// it (an article its publisher has since edited). The text searched is the
/// article's content, or its summary when the feed gives only that.
pub async fn index(
    connection: &mut SqliteConnection,
    id: i64,
    title: &str,
    content: Option<&str>,
    summary: Option<&str>,
) -> Result<(), sqlx::Error> {
    let body = content.or(summary).map(plain_words).unwrap_or_default();
    sqlx::query("INSERT OR REPLACE INTO articles_search (rowid, title, body) VALUES (?, ?, ?)")
        .bind(id)
        .bind(title)
        .bind(body)
        .execute(connection)
        .await?;
    Ok(())
}

/// How many articles are added to the index at a time, so the reader's own
/// actions never wait long behind it.
const BATCH: i64 = 200;

/// Adds every article the index doesn't have yet: on the first start after
/// search arrived, all the articles stored before it; after that, none.
/// Returns how many were added.
pub async fn index_missing(db: &sqlx::SqlitePool) -> Result<usize, sqlx::Error> {
    let mut added = 0;
    let mut after = 0;
    loop {
        let missing: Vec<(i64, String, Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT id, title, content, summary FROM articles
             WHERE id > ? AND NOT EXISTS (SELECT 1 FROM articles_search WHERE rowid = articles.id)
             ORDER BY id LIMIT ?",
        )
        .bind(after)
        .bind(BATCH)
        .fetch_all(db)
        .await?;
        let Some(last) = missing.last() else {
            return Ok(added);
        };
        after = last.0;
        let mut transaction = db.begin().await?;
        for (id, title, content, summary) in &missing {
            index(
                &mut transaction,
                *id,
                title,
                content.as_deref(),
                summary.as_deref(),
            )
            .await?;
        }
        transaction.commit().await?;
        added += missing.len();
    }
}

/// Runs `index_missing` once, in the background, and says in the log how it went.
pub async fn catch_up(db: sqlx::SqlitePool) {
    match index_missing(&db).await {
        Ok(0) => {}
        Ok(added) => log::info(&format!(
            "search: added {added} earlier articles to the index"
        )),
        Err(error) => log::problem(&format!(
            "search: couldn't add earlier articles to the index: {error}"
        )),
    }
}

/// What the reader is searching for (SPEC section 14).
#[derive(Debug, Default, Deserialize)]
pub struct Search {
    /// The words typed, outside any chip. A part in double quotes is
    /// searched as those words together, in that order.
    #[serde(default)]
    pub q: String,
    /// Only this feed's articles; otherwise `folder`'s; otherwise every feed's.
    pub feed: Option<i64>,
    pub folder: Option<i64>,
    #[serde(default)]
    pub unread: bool,
    #[serde(default)]
    pub starred: bool,
    /// Only articles from this time on, and only those before `until`
    /// (seconds since 1970; the screen works out the reader's days).
    pub since: Option<i64>,
    pub until: Option<i64>,
    #[serde(default)]
    pub order: Order,
    /// Where the previous page ended, as `title:time:id`.
    pub after: Option<String>,
}

impl Search {
    /// Nothing to search for: no words, and nothing that narrows the list.
    fn is_empty(&self, words: Option<&str>) -> bool {
        words.is_none()
            && self.feed.is_none()
            && self.folder.is_none()
            && !self.unread
            && !self.starred
            && self.since.is_none()
            && self.until.is_none()
    }
}

/// The typed words as an FTS5 question: each word (or quoted part) must
/// appear, and each also finds longer words it starts ("read" finds
/// "reading"). Every part is quoted, so nothing typed is read as FTS5's own
/// syntax. None if no word is left.
pub fn fts_question(typed: &str) -> Option<String> {
    let mut parts = Vec::new();
    for (index, piece) in typed.split('"').enumerate() {
        // Odd pieces were between quotation marks: one part. Even ones: a part per word.
        if index % 2 == 1 {
            parts.push(piece.to_owned());
        } else {
            parts.extend(piece.split_whitespace().map(str::to_owned));
        }
    }
    let quoted: Vec<String> = parts
        .iter()
        .filter(|part| part.chars().any(char::is_alphanumeric))
        .map(|part| {
            format!(
                "\"{}\"*",
                part.split_whitespace().collect::<Vec<_>>().join(" ")
            )
        })
        .collect();
    (!quoted.is_empty()).then(|| quoted.join(" "))
}

/// Results are listed with title matches first, then in the list's order.
#[derive(sqlx::FromRow)]
struct Found {
    #[sqlx(flatten)]
    article: ArticleRow,
    in_title: bool,
}

fn parse_cursor(text: &str) -> Option<(bool, i64, i64)> {
    let mut parts = text.split(':');
    let in_title = match parts.next()? {
        "1" => true,
        "0" => false,
        _ => return None,
    };
    let at = parts.next()?.parse().ok()?;
    let id = parts.next()?.parse().ok()?;
    parts.next().is_none().then_some((in_title, at, id))
}

/// One page of results, and where the next starts (null at the end).
pub async fn find(
    db: &sqlx::SqlitePool,
    search: &Search,
) -> Result<Option<(Vec<ArticleRow>, Option<String>)>, sqlx::Error> {
    let words = fts_question(&search.q);
    if search.is_empty(words.as_deref()) {
        return Ok(Some((Vec::new(), None)));
    }
    let after = match search.after.as_deref().map(parse_cursor) {
        None => None,
        Some(Some(cursor)) => Some(cursor),
        Some(None) => return Ok(None),
    };

    // The inner question picks the page by number, time and title match
    // only, so a word found in thousands of articles sorts small rows; the
    // outer one then fetches what the list shows for just those 51.
    let mut query: QueryBuilder<Sqlite> = QueryBuilder::new(
        "SELECT articles.id, articles.feed_id, feeds.title AS feed_title, articles.title,
                articles.link, articles.sort_at AS at, articles.read, articles.starred, page.in_title
         FROM (SELECT * FROM (SELECT articles.id, articles.sort_at AS at, ",
    );
    if let Some(words) = &words {
        // Every word in the title. FTS5's `{title}:` looks in that column only.
        query
            .push("articles.id IN (SELECT rowid FROM articles_search WHERE articles_search MATCH ");
        query.push_bind(format!("{{title}} : ({words})"));
        query.push(") AS in_title FROM articles_search CROSS JOIN articles ON articles.id = articles_search.rowid ");
    } else {
        query.push("0 AS in_title FROM articles ");
    }
    // An unsubscribed feed's articles are left out, except starred ones,
    // which are kept (SPEC section 15).
    query.push(
        "JOIN feeds ON feeds.id = articles.feed_id
         WHERE (feeds.unsubscribed_at IS NULL OR articles.starred = 1)",
    );
    if let Some(words) = &words {
        query.push(" AND articles_search MATCH ");
        query.push_bind(words.clone());
    }
    if let Some(feed) = search.feed {
        query.push(" AND articles.feed_id = ");
        query.push_bind(feed);
    } else if let Some(folder) = search.folder {
        query.push(" AND articles.feed_id IN (SELECT feed_id FROM feed_folders WHERE folder_id = ");
        query.push_bind(folder);
        query.push(")");
    }
    if search.unread {
        query.push(" AND articles.read = 0");
    }
    if search.starred {
        query.push(" AND articles.starred = 1");
    }
    if let Some(since) = search.since {
        query.push(" AND articles.sort_at >= ");
        query.push_bind(since);
    }
    if let Some(until) = search.until {
        query.push(" AND articles.sort_at < ");
        query.push_bind(until);
    }
    query.push(")");

    let (past, direction) = match search.order {
        Order::Newest => ("<", "DESC"),
        Order::Oldest => (">", "ASC"),
    };
    if let Some((in_title, at, id)) = after {
        // After the cursor: fewer words in the title, or the same and further along the list.
        query.push(" WHERE in_title < ");
        query.push_bind(in_title);
        query.push(" OR (in_title = ");
        query.push_bind(in_title);
        query.push(format!(" AND (at, id) {past} ("));
        query.push_bind(at);
        query.push(", ");
        query.push_bind(id);
        query.push("))");
    }
    let order = format!(" ORDER BY in_title DESC, at {direction}, id {direction}");
    query.push(&order);
    query.push(" LIMIT ");
    query.push_bind(PAGE_SIZE + 1);
    query.push(
        ") AS page CROSS JOIN articles ON articles.id = page.id
         CROSS JOIN feeds ON feeds.id = articles.feed_id",
    );
    query.push(
        order
            .replace(" at ", " page.at ")
            .replace(" id ", " page.id ")
            .replace("in_title", "page.in_title"),
    );

    let mut found: Vec<Found> = query.build_query_as().fetch_all(db).await?;
    let next = if found.len() > usize::try_from(PAGE_SIZE).unwrap_or(usize::MAX) {
        found.pop();
        found.last().map(|last| {
            format!(
                "{}:{}:{}",
                u8::from(last.in_title),
                last.article.at,
                last.article.id
            )
        })
    } else {
        None
    };
    Ok(Some((
        found.into_iter().map(|each| each.article).collect(),
        next,
    )))
}

async fn search(
    _: SignedIn,
    State(state): State<AppState>,
    Query(search): Query<Search>,
) -> Response {
    match find(&state.db, &search).await {
        Ok(Some((articles, next))) => {
            Json(json!({ "articles": articles, "next": next })).into_response()
        }
        Ok(None) => StatusCode::BAD_REQUEST.into_response(),
        Err(error) => database_problem("searching", &error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn typed_words_become_a_safe_question() {
        assert_eq!(
            fts_question("slow reading").as_deref(),
            Some("\"slow\"* \"reading\"*")
        );
        assert_eq!(
            fts_question("\"slow  reading\" club").as_deref(),
            Some("\"slow reading\"* \"club\"*")
        );
        // FTS5's own syntax is just words here.
        assert_eq!(
            fts_question("NEAR(a OR b)*").as_deref(),
            Some("\"NEAR(a\"* \"OR\"* \"b)*\"*")
        );
        assert_eq!(fts_question("किताबें").as_deref(), Some("\"किताबें\"*"));
        assert_eq!(fts_question("  - ... \" \""), None);
    }

    #[test]
    fn text_is_words_without_tags() {
        assert_eq!(
            plain_words("<p>One</p><p>two <b>three</b></p>"),
            "One two three"
        );
        assert_eq!(plain_words("a &amp; b"), "a & b");
    }

    #[test]
    fn page_positions_are_read_strictly() {
        assert_eq!(parse_cursor("1:100:5"), Some((true, 100, 5)));
        assert_eq!(parse_cursor("0:-3:5"), Some((false, -3, 5)));
        assert_eq!(parse_cursor("2:100:5"), None);
        assert_eq!(parse_cursor("1:100"), None);
        assert_eq!(parse_cursor("1:100:5:6"), None);
    }
}
