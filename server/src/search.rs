//! Search (SPEC section 14): every article's title and text, in SQLite's
//! FTS5 search engine, and the question that finds articles in it.
//!
//! The search index (`articles_search`, structure change 6) keeps only where
//! each word appears, not a copy of the articles. Articles are added to it as
//! they arrive (`feeds::store_articles` calls `index`); one deleted leaves it
//! by itself (a rule in the database). Articles stored before search existed
//! are added once, in the background, when nine turtles starts (`index_missing`).
//!
//! The screen turns what the reader typed, chips included, into a few plain
//! settings: the words, a feed or folder, unread only, starred only, and a
//! date range. Results come in the item list's order, with articles whose
//! title holds every word first.
//!
//! Each result carries a one-line excerpt of its text around the first
//! searched word found there, so the reader sees why it matched. The index
//! keeps no copy of the text (it's "contentless", to stay small), so FTS5's
//! own `snippet()` has nothing to cut from: the excerpt is cut here, from the
//! article's stored text, as plain words. It goes to the screen as pieces,
//! each plain text marked as a searched word or not, so no HTML from a feed
//! (and no marker inside the text) ever reaches it (decision 0035).

use axum::{
    Json, Router,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::{Deserialize, Serialize};
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
    content: Option<String>,
    summary: Option<String>,
}

/// One search result: the article as the list shows it, and its excerpt.
#[derive(Serialize)]
pub struct Hit {
    #[serde(flatten)]
    pub article: ArticleRow,
    /// Null when no searched word is in the text (only in the title), or
    /// when nothing but filters was searched.
    pub excerpt: Option<Vec<Piece>>,
}

/// A piece of an excerpt: plain text, and whether it's a searched word.
#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct Piece {
    pub text: String,
    #[serde(rename = "match")]
    pub matched: bool,
}

/// About how many characters an excerpt holds, and at most how many come
/// before its first searched word, so the word shows even in a narrow list
/// that cuts the line short.
const EXCERPT_CHARS: usize = 90;
const LEAD_CHARS: usize = 24;

/// A character that belongs to a word, as the search index splits words:
/// letters, numbers and the marks that join them (FTS5_TOKENIZER).
fn is_word_char(c: char) -> bool {
    c.is_alphanumeric()
        || matches!(c,
            '\u{0300}'..='\u{036F}'
            | '\u{0483}'..='\u{0489}'
            | '\u{0591}'..='\u{05C7}'
            | '\u{0610}'..='\u{061A}'
            | '\u{064B}'..='\u{065F}'
            | '\u{0900}'..='\u{0903}'
            | '\u{093A}'..='\u{094F}'
            | '\u{0951}'..='\u{0957}'
            | '\u{0962}'..='\u{0963}'
            | '\u{0981}'..='\u{0983}'
            | '\u{1AB0}'..='\u{1AFF}'
            | '\u{1DC0}'..='\u{1DFF}'
            | '\u{20D0}'..='\u{20FF}'
            | '\u{FE20}'..='\u{FE2F}')
}

/// Where each word starts and ends in `text`, in bytes.
fn word_spans(text: &str) -> Vec<(usize, usize)> {
    let mut spans = Vec::new();
    let mut start = None;
    for (at, c) in text.char_indices() {
        match (is_word_char(c), start) {
            (true, None) => start = Some(at),
            (false, Some(begun)) => {
                spans.push((begun, at));
                start = None;
            }
            _ => {}
        }
    }
    if let Some(begun) = start {
        spans.push((begun, text.len()));
    }
    spans
}

/// A Latin letter without its accent, as the index's `remove_diacritics`
/// compares them ("cafe" finds "café").
fn base_letter(c: char) -> char {
    match c {
        'à'..='å' | 'ā' | 'ă' | 'ą' => 'a',
        'ç' | 'ć' | 'ĉ' | 'ċ' | 'č' => 'c',
        'ď' | 'đ' => 'd',
        'è'..='ë' | 'ē' | 'ĕ' | 'ė' | 'ę' | 'ě' => 'e',
        'ĝ' | 'ğ' | 'ġ' | 'ģ' => 'g',
        'ĥ' | 'ħ' => 'h',
        'ì'..='ï' | 'ĩ' | 'ī' | 'ĭ' | 'į' | 'ı' => 'i',
        'ĵ' => 'j',
        'ķ' => 'k',
        'ĺ' | 'ļ' | 'ľ' | 'ŀ' | 'ł' => 'l',
        'ñ' | 'ń' | 'ņ' | 'ň' => 'n',
        'ò'..='ö' | 'ø' | 'ō' | 'ŏ' | 'ő' => 'o',
        'ŕ' | 'ŗ' | 'ř' => 'r',
        'ś' | 'ŝ' | 'ş' | 'š' => 's',
        'ţ' | 'ť' | 'ŧ' => 't',
        'ù'..='ü' | 'ũ' | 'ū' | 'ŭ' | 'ů' | 'ű' | 'ų' => 'u',
        'ŵ' => 'w',
        'ý' | 'ÿ' | 'ŷ' => 'y',
        'ź' | 'ż' | 'ž' => 'z',
        other => other,
    }
}

/// A word as search compares it: small letters, Latin accents set aside.
fn fold(word: &str) -> String {
    word.chars()
        .flat_map(char::to_lowercase)
        .filter(|c| !matches!(c, '\u{0300}'..='\u{036F}'))
        .map(base_letter)
        .collect()
}

/// The searched words, as `fold` gives them, each to be found at the start
/// of a word in the text, as the search itself matches ("read" finds "reading").
pub fn searched_words(typed: &str) -> Vec<String> {
    word_spans(typed)
        .into_iter()
        .map(|(start, end)| fold(&typed[start..end]))
        .filter(|word| !word.is_empty())
        .collect()
}

/// A line of `text` around the first of the `searched` words in it: a few
/// words before it, then on to about 90 characters, cut only between words,
/// with "…" where text was left out (three typed dots in the text become
/// "…" too). Every searched word in the line is
/// marked. None if no searched word is in the text.
pub fn excerpt(text: &str, searched: &[String]) -> Option<Vec<Piece>> {
    let spans = word_spans(text);
    let is_match = |&(start, end): &(usize, usize)| {
        let word = fold(&text[start..end]);
        searched.iter().any(|term| word.starts_with(term.as_str()))
    };
    let first = spans.iter().position(is_match)?;
    let chars = |from: usize, to: usize| text[from..to].chars().count();

    // Back a few whole words, then on to the last whole word that fits.
    let mut from = first;
    while from > 0 && chars(spans[from - 1].0, spans[first].0) <= LEAD_CHARS {
        from -= 1;
    }
    let mut to = first;
    while to + 1 < spans.len() && chars(spans[from].0, spans[to + 1].1) <= EXCERPT_CHARS {
        to += 1;
    }
    // From the very start (or to the very end) when no word is left out,
    // so punctuation there isn't mistaken for a cut.
    let start = if from == 0 { 0 } else { spans[from].0 };
    let end = if to + 1 == spans.len() {
        text.len()
    } else {
        spans[to].1
    };

    let mut pieces: Vec<Piece> = Vec::new();
    let mut add = |piece: &str, matched: bool| {
        if piece.is_empty() {
            return;
        }
        // Three typed dots in the publisher's text read as one real ellipsis,
        // like the ones nine turtles adds where it cuts.
        let piece = piece.replace("...", "…");
        match pieces.last_mut() {
            Some(last) if last.matched == matched => last.text.push_str(&piece),
            _ => pieces.push(Piece {
                text: piece,
                matched,
            }),
        }
    };
    if from > 0 {
        add("…", false);
    }
    let mut at = start;
    for span in &spans[from..=to] {
        if is_match(span) {
            add(&text[at..span.0], false);
            add(&text[span.0..span.1], true);
            at = span.1;
        }
    }
    add(&text[at..end], false);
    if end < text.len() {
        add("…", false);
    }
    Some(pieces)
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
    person: i64,
    search: &Search,
) -> Result<Option<(Vec<Hit>, Option<String>)>, sqlx::Error> {
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
    // Only the reader's own entries are searched, with their marks.
    let mut query: QueryBuilder<Sqlite> = QueryBuilder::new(
        "SELECT entries.article_id AS id, entries.feed_id, subscriptions.title AS feed_title,
                articles.title, articles.link, entries.sort_at AS at, entries.read,
                entries.starred, entries.muted, page.in_title, articles.content, articles.summary
         FROM (SELECT * FROM (SELECT entries.article_id AS id, entries.sort_at AS at, ",
    );
    if let Some(words) = &words {
        // Every word in the title. FTS5's `{title}:` looks in that column only.
        query.push(
            "entries.article_id IN (SELECT rowid FROM articles_search WHERE articles_search MATCH ",
        );
        query.push_bind(format!("{{title}} : ({words})"));
        query.push(
            ") AS in_title FROM articles_search CROSS JOIN entries
                 ON entries.person_id = ",
        );
        query.push_bind(person);
        query.push(" AND entries.article_id = articles_search.rowid ");
    } else {
        query.push("0 AS in_title FROM entries ");
    }
    // An unsubscribed feed's articles are left out, except starred ones,
    // which are kept (SPEC section 15). The reader's few unsubscribed feeds
    // are listed once, rather than each match looking up its subscription.
    query.push("WHERE entries.person_id = ");
    query.push_bind(person);
    query.push(
        " AND (entries.starred = 1 OR entries.feed_id NOT IN
             (SELECT feed_id FROM subscriptions
              WHERE person_id = ",
    );
    query.push_bind(person);
    query.push(" AND unsubscribed_at IS NOT NULL))");
    if let Some(words) = &words {
        query.push(" AND articles_search MATCH ");
        query.push_bind(words.clone());
    }
    if let Some(feed) = search.feed {
        query.push(" AND entries.feed_id = ");
        query.push_bind(feed);
    } else if let Some(folder) = search.folder {
        query.push(
            " AND entries.feed_id IN (SELECT feed_id FROM feed_folders
              WHERE folder_id = (SELECT id FROM folders WHERE id = ",
        );
        query.push_bind(folder);
        query.push(" AND person_id = ");
        query.push_bind(person);
        query.push("))");
    }
    if search.unread {
        // A feed that flows past is never in Unread (SPEC section 10).
        query.push(
            " AND entries.read = 0 AND entries.feed_id NOT IN
                 (SELECT feed_id FROM subscriptions WHERE river = 1 AND person_id = ",
        );
        query.push_bind(person);
        query.push(")");
    }
    if search.starred {
        query.push(" AND entries.starred = 1");
    }
    if let Some(since) = search.since {
        query.push(" AND entries.sort_at >= ");
        query.push_bind(since);
    }
    if let Some(until) = search.until {
        query.push(" AND entries.sort_at < ");
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
    query.push(") AS page CROSS JOIN entries ON entries.person_id = ");
    query.push_bind(person);
    query.push(
        " AND entries.article_id = page.id
         CROSS JOIN articles ON articles.id = page.id
         CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
             AND subscriptions.feed_id = entries.feed_id",
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
    let searched = searched_words(&search.q);
    // Reading up to fifty articles' HTML for excerpts is steady CPU work, so it
    // runs off the threads that answer requests.
    let results = tokio::task::spawn_blocking(move || {
        found
            .into_iter()
            .map(|each| {
                // The text searched: the content, or the summary when the feed gives only that.
                let excerpt = match each.content.as_deref().or(each.summary.as_deref()) {
                    Some(html) if !searched.is_empty() => excerpt(&plain_words(html), &searched),
                    _ => None,
                };
                Hit {
                    article: each.article,
                    excerpt,
                }
            })
            .collect::<Vec<_>>()
    })
    .await
    .expect("excerpts never panic");
    Ok(Some((results, next)))
}

async fn search(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Query(search): Query<Search>,
) -> Response {
    match find(&state.db, person, &search).await {
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

    /// An excerpt as text, with the searched words in [brackets].
    fn shown(text: &str, typed: &str) -> Option<String> {
        excerpt(text, &searched_words(typed)).map(|pieces| {
            pieces
                .iter()
                .map(|piece| {
                    if piece.matched {
                        format!("[{}]", piece.text)
                    } else {
                        piece.text.clone()
                    }
                })
                .collect()
        })
    }

    #[test]
    fn excerpts_show_the_first_match_in_its_words() {
        // Short text is shown whole, punctuation included, every match marked.
        assert_eq!(
            shown("The tomatoes ripened. Tomatoes again.", "tomato").as_deref(),
            Some("The [tomatoes] ripened. [Tomatoes] again.")
        );
        // Words found by their start, in any case, accents set aside.
        assert_eq!(
            shown("Reading by the window at the Café.", "READ cafe").as_deref(),
            Some("[Reading] by the window at the [Café].")
        );
        // Three typed dots become one real ellipsis, as at a cut.
        assert_eq!(
            shown("...and then the garden waited...", "garden").as_deref(),
            Some("…and then the [garden] waited…")
        );
        // No searched word in the text: no excerpt.
        assert_eq!(shown("Nothing here.", "tomato"), None);
        assert_eq!(shown("Nothing here.", "  \"\" "), None);
        // Hindi words stay whole, and only a few come before the match.
        assert_eq!(
            shown("शहर के पुराने पुस्तकालय में नई किताबें आई हैं।", "किता").as_deref(),
            Some("…पुराने पुस्तकालय में नई [किताबें] आई हैं।")
        );
    }

    #[test]
    fn long_text_is_cut_between_words_around_the_first_match() {
        let text = "One two three four five six seven eight nine ten eleven twelve \
                    thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty \
                    garden twenty-one twenty-two twenty-three twenty-four twenty-five \
                    twenty-six twenty-seven twenty-eight twenty-nine thirty thirty-one \
                    thirty-two thirty-three thirty-four thirty-five garden";
        let line = shown(text, "garden").unwrap();
        assert_eq!(
            line,
            "…nineteen twenty [garden] twenty-one twenty-two twenty-three twenty-four twenty-five twenty…"
        );
        // Only a few words before the match, and about 90 characters in all.
        let before = line.split('[').next().unwrap().chars().count();
        assert!(before <= LEAD_CHARS + 2, "{before}");
        assert!(line.chars().count() <= EXCERPT_CHARS + 4, "{line}");
        // A match in the very first word starts the line, with nothing left out before it.
        assert!(shown(text, "one").unwrap().starts_with("[One] two three"));
    }

    #[test]
    fn excerpts_are_plain_text_pieces() {
        // Tags are gone before the excerpt is cut; what's left is only text,
        // and the screen shows it as text, never as HTML.
        let text = plain_words("<p>Late <b>gardening</b> &lt;script&gt; notes.</p>");
        assert_eq!(
            excerpt(&text, &searched_words("garden")),
            Some(vec![
                Piece {
                    text: "Late ".to_owned(),
                    matched: false
                },
                Piece {
                    text: "gardening".to_owned(),
                    matched: true
                },
                Piece {
                    text: " <script> notes.".to_owned(),
                    matched: false
                },
            ])
        );
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
