//! Hiding (SPEC section 27, decisions 0077 and 0173): "Hide articles about
//! [words] from [everyone / this person]", one sentence the reader fills in.
//!
//! A rule looks for a word or phrase in an article's title or text (an old
//! rule may look in titles only), from everyone or from one person: one of
//! their places stands for all of them. A matching article is hidden. Only
//! what the feed holds and what the reader wrote are used: no guessing, no
//! ranking (DESIGN.md → "Never").
//!
//! Rules act on articles as they arrive (`feeds::store_articles` calls
//! `apply_to_new`). A new rule can also be applied, once, to the unread
//! articles that already match; the screen asks first and offers Undo.
//!
//! Each rule is a reader's, and changes only that reader's marks (their
//! entries); another reader of the same feed sees the article as before.
//!
//! A hidden article (`muted` in the database) is kept and counts as read,
//! so it waits in no list and other feed readers see it as read too. Only
//! the Hidden articles page, search and (if it's starred) Starred show it;
//! unhiding it (or marking it unread) brings it back, unread.
//!
//! Rules from before step 8 that had an author, starred or marked read, or
//! applied to a folder were deleted by structure change 40 (decision 0174);
//! what they did stays done. `RULES` still reads only the kind made now.

use std::collections::HashSet;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqliteConnection;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::{ArticleRow, follows},
    now, search,
};

mod shared;
pub use shared::{delete, place_gone_for};

/// The longest phrase a rule can hold, in characters.
pub const LONGEST: usize = 200;

/// The most hidden articles the Hidden articles page lists at once, newest first.
pub const MUTED_SHOWN: i64 = 200;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/rules", get(list_rules).post(create_rule))
        .route("/api/rules/{id}", post(edit_rule))
        .route("/api/rules/{id}/paused", post(pause_rule))
        .route("/api/rules/{id}/delete", post(delete_rule))
        .route("/api/rules/{id}/apply", post(apply_rule))
        .route("/api/muted", get(list_muted))
}

/// Hides the named articles for one reader, all in one step. Takes the
/// reader, then the articles.
const HIDE: &str = "UPDATE entries SET muted = 1, read = 1
     WHERE person_id = ? AND article_id IN (SELECT value FROM json_each(?))";

/// One rule, as stored and as the screen shows it.
#[derive(Clone, Debug, Serialize)]
pub struct Rule {
    pub id: i64,
    /// Whose rule it is.
    #[serde(skip)]
    pub person_id: i64,
    pub words: String,
    /// Only an old rule looks in titles alone; new ones look in the text too.
    pub title_only: bool,
    /// The person it hides from, by one of their places; none for everyone.
    pub feed_id: Option<i64>,
    /// The person it applied to is no longer followed, so it matches nothing.
    pub place_gone: bool,
    pub paused: bool,
}

type RuleLine = (i64, i64, String, bool, Option<i64>, bool, bool);

/// A reader's rules, in the order they were made. Takes the reader. Rules
/// that no longer fit (an author, star or mark read, a folder) are left out.
const RULES: &str = "SELECT id, person_id, words, title_only, feed_id, place_gone, paused
    FROM rules WHERE person_id = ? AND action = 'mute' AND author = '' AND words != ''
        AND folder_id IS NULL
    ORDER BY id";

pub(crate) async fn rules(
    connection: &mut SqliteConnection,
    person: i64,
) -> Result<Vec<Rule>, sqlx::Error> {
    let lines: Vec<RuleLine> = sqlx::query_as(RULES)
        .bind(person)
        .fetch_all(connection)
        .await?;
    Ok(lines
        .into_iter()
        .map(
            |(id, person_id, words, title_only, feed_id, place_gone, paused)| Rule {
                id,
                person_id,
                words,
                title_only,
                feed_id,
                place_gone,
                paused,
            },
        )
        .collect())
}

/// Text cut into lower-case words, so a phrase is found whatever its capital
/// letters and punctuation, and only as whole words: "AI" never matches
/// "said". Marks inside a word (Hindi's vowel signs) stay in it.
pub fn words_of(text: &str) -> Vec<String> {
    text.split(|c: char| {
        c.is_whitespace()
            || c.is_ascii_punctuation()
            || "‘’‚‛“”„‟–—―…«»‹›·•।॥、。，！？：；（）".contains(c)
    })
    .filter(|word| !word.is_empty())
    .map(str::to_lowercase)
    .collect()
}

/// Whether `phrase`'s words appear together, in order, in `text`'s.
fn holds(text: &[String], phrase: &[String]) -> bool {
    !phrase.is_empty() && text.windows(phrase.len()).any(|window| window == phrase)
}

/// An article as a rule reads it: its words, cut once.
pub struct Candidate {
    pub id: i64,
    pub feed_id: i64,
    title: Vec<String>,
    text: Vec<String>,
}

impl Candidate {
    pub fn new(
        id: i64,
        feed_id: i64,
        title: &str,
        content: Option<&str>,
        summary: Option<&str>,
    ) -> Self {
        let text = content
            .or(summary)
            .map(search::plain_words)
            .unwrap_or_default();
        Self {
            id,
            feed_id,
            title: words_of(title),
            text: words_of(&text),
        }
    }
}

impl Rule {
    /// Whether it applies to a feed whose person has these places (the feed
    /// itself among them), whatever the article.
    fn covers(&self, places: &HashSet<i64>) -> bool {
        if self.paused || self.place_gone {
            return false;
        }
        self.feed_id.is_none_or(|feed| places.contains(&feed))
    }

    /// Whether an article (of a feed it covers) is about its words.
    pub fn matches(&self, article: &Candidate) -> bool {
        let words = words_of(&self.words);
        holds(&article.title, &words) || (!self.title_only && holds(&article.text, &words))
    }
}

/// Every place, the reader's, of the person a feed belongs to: just the
/// feed for a place on its own.
async fn places_of(
    connection: &mut SqliteConnection,
    person: i64,
    feed_id: i64,
) -> Result<HashSet<i64>, sqlx::Error> {
    let places: Vec<i64> = sqlx::query_scalar(PLACES)
        .bind(person)
        .bind(feed_id)
        .fetch_all(connection)
        .await?;
    Ok(places.into_iter().chain([feed_id]).collect())
}

/// The reader's places that share a person with one feed. Takes the
/// reader, then the feed.
const PLACES: &str = "SELECT feed_id FROM subscriptions
    WHERE person_id = ?1 AND writer_id =
        (SELECT writer_id FROM subscriptions WHERE person_id = ?1 AND feed_id = ?2)";

type ArticleLine = (i64, i64, String, Option<String>, Option<String>);

/// Does each reader's rules' work on one feed's articles numbered above
/// `after`: the ones that just arrived. Only readers who have them (whose
/// subscription isn't cleared) are asked.
pub async fn apply_to_new(
    connection: &mut SqliteConnection,
    feed_id: i64,
    after: i64,
) -> Result<(), sqlx::Error> {
    let people: Vec<i64> = sqlx::query_scalar(
        "SELECT DISTINCT rules.person_id FROM rules JOIN subscriptions
             ON subscriptions.person_id = rules.person_id AND subscriptions.feed_id = ?
         WHERE rules.paused = 0 AND rules.place_gone = 0 AND subscriptions.cleared = 0
         ORDER BY rules.person_id",
    )
    .bind(feed_id)
    .fetch_all(&mut *connection)
    .await?;
    let mut candidates = None;
    for person in people {
        let covering = covering(connection, person, feed_id).await?;
        if covering.is_empty() {
            continue;
        }
        if candidates.is_none() {
            let lines: Vec<ArticleLine> = sqlx::query_as(
                "SELECT id, feed_id, title, content, summary FROM articles
                 WHERE feed_id = ? AND id > ?",
            )
            .bind(feed_id)
            .bind(after)
            .fetch_all(&mut *connection)
            .await?;
            candidates = Some(self::candidates(lines));
        }
        let candidates = candidates.as_deref().unwrap_or_default();
        hide_matching(connection, person, &covering, candidates).await?;
    }
    Ok(())
}

/// Does one reader's rules' work on these articles of one feed: the ones
/// new to them because they just followed a feed others already had.
pub async fn apply_to(
    connection: &mut SqliteConnection,
    person: i64,
    feed_id: i64,
    ids: &[i64],
) -> Result<(), sqlx::Error> {
    if ids.is_empty() {
        return Ok(());
    }
    let covering = covering(connection, person, feed_id).await?;
    if covering.is_empty() {
        return Ok(());
    }
    let lines: Vec<ArticleLine> = sqlx::query_as(
        "SELECT id, feed_id, title, content, summary FROM articles
         WHERE feed_id = ? AND id IN (SELECT value FROM json_each(?))",
    )
    .bind(feed_id)
    .bind(serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_owned()))
    .fetch_all(&mut *connection)
    .await?;
    hide_matching(connection, person, &covering, &candidates(lines)).await
}

/// One reader's running rules that apply to a feed.
async fn covering(
    connection: &mut SqliteConnection,
    person: i64,
    feed_id: i64,
) -> Result<Vec<Rule>, sqlx::Error> {
    let all = rules(connection, person).await?;
    let places = places_of(connection, person, feed_id).await?;
    Ok(all
        .into_iter()
        .filter(|rule| rule.covers(&places))
        .collect())
}

/// Hides, for one reader, the articles any of these rules matches.
async fn hide_matching(
    connection: &mut SqliteConnection,
    person: i64,
    covering: &[Rule],
    candidates: &[Candidate],
) -> Result<(), sqlx::Error> {
    let ids: Vec<i64> = candidates
        .iter()
        .filter(|article| covering.iter().any(|rule| rule.matches(article)))
        .map(|article| article.id)
        .collect();
    hide(connection, person, &ids).await
}

fn candidates(lines: Vec<ArticleLine>) -> Vec<Candidate> {
    lines
        .into_iter()
        .map(|(id, feed_id, title, content, summary)| {
            Candidate::new(id, feed_id, &title, content.as_deref(), summary.as_deref())
        })
        .collect()
}

async fn hide(
    connection: &mut SqliteConnection,
    person: i64,
    ids: &[i64],
) -> Result<(), sqlx::Error> {
    if ids.is_empty() {
        return Ok(());
    }
    sqlx::query(HIDE)
        .bind(person)
        .bind(serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_owned()))
        .execute(connection)
        .await?;
    Ok(())
}

/// How many unread articles `matching_now` reads at a time, so even a rule
/// for everyone never holds every article's text in memory at once.
const MATCH_BATCH: i64 = 500;

/// The unread articles of feeds its reader follows that a rule would hide
/// now. It only reads, a batch at a time, so callers run it outside a
/// write, never holding up background checks.
async fn matching_now(db: &sqlx::SqlitePool, rule: &Rule) -> Result<Vec<i64>, sqlx::Error> {
    let mut found = Vec::new();
    if rule.place_gone {
        return Ok(found);
    }
    let mut after = 0;
    loop {
        let lines: Vec<ArticleLine> = sqlx::query_as(
            "SELECT articles.id, entries.feed_id, articles.title,
                    articles.content, articles.summary
             FROM entries CROSS JOIN articles ON articles.id = entries.article_id
                 JOIN subscriptions ON subscriptions.person_id = entries.person_id
                     AND subscriptions.feed_id = entries.feed_id
             WHERE entries.person_id = ?1 AND entries.read = 0
                 AND subscriptions.unsubscribed_at IS NULL AND entries.article_id > ?3
                 AND (?2 IS NULL OR entries.feed_id = ?2 OR subscriptions.writer_id =
                      (SELECT writer_id FROM subscriptions WHERE person_id = ?1 AND feed_id = ?2))
             ORDER BY entries.article_id LIMIT ?4",
        )
        .bind(rule.person_id)
        .bind(rule.feed_id)
        .bind(after)
        .bind(MATCH_BATCH)
        .fetch_all(db)
        .await?;
        let Some(last) = lines.last() else {
            return Ok(found);
        };
        after = last.0;
        found.extend(
            candidates(lines)
                .iter()
                .filter(|article| rule.matches(article))
                .map(|article| article.id),
        );
    }
}

/// Every rule, and how many articles are hidden, for Settings.
async fn list_rules(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let listed: Result<(Vec<Rule>, i64), sqlx::Error> = async {
        let mut connection = state.db.acquire().await?;
        let all = rules(&mut connection, person).await?;
        let muted = sqlx::query_scalar(MUTED_COUNT)
            .bind(person)
            .fetch_one(&mut *connection)
            .await?;
        Ok((all, muted))
    }
    .await;
    match listed {
        Ok((rules, muted)) => Json(json!({ "rules": rules, "muted": muted })).into_response(),
        Err(error) => database_problem("listing rules", &error),
    }
}

/// A rule as the screen sends it.
#[derive(Deserialize)]
pub(crate) struct RuleForm {
    pub words: String,
    /// The person, by one of their places; none for everyone.
    pub feed_id: Option<i64>,
    /// Kept as it was when an old title-only rule is edited or made again.
    #[serde(default)]
    pub title_only: bool,
    /// Undo for deleting a rule brings it back paused if it was, and with
    /// its person gone if it was, so it never spreads to everyone.
    #[serde(default)]
    pub paused: bool,
    #[serde(default)]
    pub place_gone: bool,
}

/// A phrase as the reader typed it, its spaces tidied. None if it's too long.
fn tidy(text: &str) -> Option<String> {
    let tidied = text.split_whitespace().collect::<Vec<_>>().join(" ");
    (tidied.chars().count() <= LONGEST).then_some(tidied)
}

/// The form, checked: words to look for, and a person the reader follows.
async fn checked(
    connection: &mut SqliteConnection,
    person: i64,
    form: &RuleForm,
) -> Result<Result<String, &'static str>, sqlx::Error> {
    let Some(words) = tidy(&form.words) else {
        return Ok(Err("too-long"));
    };
    if words_of(&words).is_empty() {
        return Ok(Err("nothing-to-match"));
    }
    if let Some(feed) = form.feed_id
        && !follows(connection, person, feed).await?
    {
        return Ok(Err("no-place"));
    }
    Ok(Ok(words))
}

async fn rule(
    connection: &mut SqliteConnection,
    person: i64,
    id: i64,
) -> Result<Option<Rule>, sqlx::Error> {
    Ok(rules(connection, person)
        .await?
        .into_iter()
        .find(|rule| rule.id == id))
}

/// Makes a rule for reader `person`, from the screen or an assistant
/// (`mcp`). Answers its number and how many unread articles already match
/// it, or why it was refused.
pub(crate) async fn make(
    state: &AppState,
    person: i64,
    form: &RuleForm,
) -> Result<Result<(i64, usize), &'static str>, sqlx::Error> {
    let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
    let words = match checked(&mut transaction, person, form).await? {
        Ok(words) => words,
        Err(refusal) => return Ok(Err(refusal)),
    };
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO rules (person_id, words, title_only, feed_id, place_gone, action, paused,
             created_at)
         VALUES (?, ?, ?, ?, ?, 'mute', ?, ?) RETURNING id",
    )
    .bind(person)
    .bind(&words)
    .bind(form.title_only)
    .bind(form.feed_id)
    .bind(form.place_gone && form.feed_id.is_none())
    .bind(form.paused)
    .bind(now())
    .fetch_one(&mut *transaction)
    .await?;
    let made = rule(&mut transaction, person, id).await?;
    transaction.commit().await?;
    let matching = match made {
        Some(rule) => matching_now(&state.db, &rule).await?.len(),
        None => 0,
    };
    Ok(Ok((id, matching)))
}

/// Makes a rule. Answers its number and how many unread articles already
/// match it, so the screen can offer to hide them too.
async fn create_rule(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<RuleForm>,
) -> Response {
    let made = make(&state, person, &form).await;
    match made {
        Ok(Ok((id, matching))) => Json(json!({ "id": id, "matching": matching })).into_response(),
        Ok(Err(refusal)) => problem(refusal),
        Err(error) => database_problem("making a rule", &error),
    }
}

/// Changes a rule. It acts on articles arriving from now on.
async fn edit_rule(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<RuleForm>,
) -> Response {
    let saved: Result<Result<bool, &str>, sqlx::Error> = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        if rule(&mut transaction, person, id).await?.is_none() {
            return Ok(Ok(false));
        }
        let words = match checked(&mut transaction, person, &form).await? {
            Ok(words) => words,
            Err(refusal) => return Ok(Err(refusal)),
        };
        let changed = sqlx::query(
            "UPDATE rules SET words = ?, title_only = ?, feed_id = ?, place_gone = 0
             WHERE id = ? AND person_id = ?",
        )
        .bind(&words)
        .bind(form.title_only)
        .bind(form.feed_id)
        .bind(id)
        .bind(person)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(Ok(changed.rows_affected() > 0))
    }
    .await;
    match saved {
        Ok(Ok(true)) => StatusCode::NO_CONTENT.into_response(),
        Ok(Ok(false)) => StatusCode::NOT_FOUND.into_response(),
        Ok(Err(refusal)) => problem(refusal),
        Err(error) => database_problem("changing a rule", &error),
    }
}

#[derive(Deserialize)]
struct Paused {
    paused: bool,
}

/// Pauses a rule, or starts it again.
async fn pause_rule(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(form): Json<Paused>,
) -> Response {
    let changed = async {
        let mut connection = state.db.acquire().await?;
        if rule(&mut connection, person, id).await?.is_none() {
            return Ok(false);
        }
        sqlx::query("UPDATE rules SET paused = ? WHERE id = ? AND person_id = ?")
            .bind(form.paused)
            .bind(id)
            .bind(person)
            .execute(&mut *connection)
            .await?;
        Ok::<_, sqlx::Error>(true)
    }
    .await;
    match changed {
        Ok(false) => StatusCode::NOT_FOUND.into_response(),
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("pausing a rule", &error),
    }
}

/// Deletes a rule. What it already did stays done. The screen keeps the
/// rule, so Undo can make it again.
async fn delete_rule(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match delete(&state.db, person, id).await {
        Ok(false) => StatusCode::NOT_FOUND.into_response(),
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("deleting a rule", &error),
    }
}

/// Applies a rule, once, to the unread articles that match it now. Answers
/// the articles it hid, so the screen can undo exactly those.
async fn apply_rule(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let applied: Result<Option<Vec<i64>>, sqlx::Error> = async {
        let found = rule(&mut *state.db.acquire().await?, person, id).await?;
        let Some(rule) = found else {
            return Ok(None);
        };
        // Found first, only reading; then changed in one short write. Only
        // those still unread are changed, and only those are answered.
        let ids = matching_now(&state.db, &rule).await?;
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let ids: Vec<i64> = sqlx::query_scalar(
            "SELECT article_id FROM entries
             WHERE person_id = ? AND article_id IN (SELECT value FROM json_each(?)) AND read = 0",
        )
        .bind(person)
        .bind(serde_json::to_string(&ids).unwrap_or_else(|_| "[]".to_owned()))
        .fetch_all(&mut *transaction)
        .await?;
        hide(&mut transaction, person, &ids).await?;
        transaction.commit().await?;
        Ok(Some(ids))
    }
    .await;
    match applied {
        Ok(Some(ids)) => Json(json!({ "ids": ids })).into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("applying a rule", &error),
    }
}

/// How many articles the reader has hidden, from the `entries_muted` index.
pub(crate) const MUTED_COUNT: &str =
    "SELECT COUNT(*) FROM entries WHERE person_id = ? AND muted = 1";

/// The Hidden articles page: the reader's newest hidden articles, and how many there are.
async fn list_muted(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let listed: Result<(Vec<ArticleRow>, i64), sqlx::Error> = async {
        let articles = sqlx::query_as(concat!(
            "SELECT entries.article_id AS id, entries.feed_id, COALESCE(writers.name, subscriptions.title) AS feed_title,
                    articles.title, articles.link, entries.sort_at AS at,
                    entries.read, entries.starred, entries.muted,
                    articles.episode_url IS NOT NULL AS episode, articles.episode_seconds,",
            crate::feeds::publication_writer!(),
            "
             FROM entries CROSS JOIN articles ON articles.id = entries.article_id
                 CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
                     AND subscriptions.feed_id = entries.feed_id
                 LEFT JOIN writers ON writers.id = subscriptions.writer_id
             WHERE entries.person_id = ? AND entries.muted = 1
             ORDER BY entries.sort_at DESC, entries.article_id DESC LIMIT ?"
        ),
        )
        .bind(person)
        .bind(MUTED_SHOWN)
        .fetch_all(&state.db)
        .await?;
        let count = sqlx::query_scalar(MUTED_COUNT)
            .bind(person)
            .fetch_one(&state.db)
            .await?;
        Ok((articles, count))
    }
    .await;
    match listed {
        Ok((articles, count)) => {
            Json(json!({ "articles": articles, "count": count })).into_response()
        }
        Err(error) => database_problem("listing hidden articles", &error),
    }
}

fn problem(error: &str) -> Response {
    (StatusCode::BAD_REQUEST, Json(json!({ "error": error }))).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(words: &str, title_only: bool) -> Rule {
        Rule {
            id: 1,
            person_id: 1,
            words: words.to_owned(),
            title_only,
            feed_id: None,
            place_gone: false,
            paused: false,
        }
    }

    fn article(title: &str, content: &str) -> Candidate {
        Candidate::new(1, 1, title, Some(content), None)
    }

    #[test]
    fn a_phrase_matches_whole_words_whatever_their_capitals() {
        let sponsored = rule("Sponsored", false);
        assert!(sponsored.matches(&article("SPONSORED: a new laptop", "")));
        assert!(sponsored.matches(&article("A post (sponsored)", "")));
        assert!(!sponsored.matches(&article("Unsponsored thoughts", "")));
        let ai = rule("AI", false);
        assert!(!ai.matches(&article("What she said", "")));
        assert!(ai.matches(&article("On AI, again", "")));
        let phrase = rule("open web", false);
        assert!(phrase.matches(&article("Back to the Open Web.", "")));
        assert!(!phrase.matches(&article("Open the web", "")));
    }

    #[test]
    fn an_old_title_only_rule_leaves_the_text_alone() {
        let in_title = rule("crypto", true);
        let anywhere = rule("crypto", false);
        let post = article("A quiet week", "<p>Nothing about <b>crypto</b> here.</p>");
        assert!(!in_title.matches(&post));
        assert!(anywhere.matches(&post));
        // The HTML's own words never count.
        assert!(!rule("class", false).matches(&article("A", "<p class=\"x\">Hi</p>")));
        assert!(!rule("", false).matches(&article("Anything", "")));
    }

    #[test]
    fn hindi_words_stay_whole() {
        let hindi = rule("किताब", false);
        assert!(hindi.matches(&article("नई किताब।", "")));
        assert!(!hindi.matches(&article("किताबें", "")));
    }

    #[test]
    fn a_rule_covers_only_its_person_and_only_while_it_runs() {
        let alpha: HashSet<i64> = [3, 4].into_iter().collect();
        let mut one = rule("x", false);
        assert!(one.covers(&alpha));
        one.feed_id = Some(4);
        assert!(one.covers(&alpha));
        assert!(!one.covers(&[5].into_iter().collect()));
        one.paused = true;
        assert!(!one.covers(&alpha));
        one.paused = false;
        one.place_gone = true;
        assert!(!one.covers(&alpha));
    }
}
