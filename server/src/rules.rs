//! Rules and mutes (SPEC section 27, decision 0077): "when a new article
//! matches this, do that", written by the reader in plain fields.
//!
//! A rule looks for a word or phrase (in the title, or in the title or the
//! text) and an author, in every feed, one folder or one feed. It mutes the
//! article, stars it, or marks it read. Only what the feed holds and what
//! the reader wrote are used: no guessing, no ranking (DESIGN.md → "Never").
//!
//! Rules act on articles as they arrive (`feeds::store_articles` calls
//! `apply_to_new`). A new rule can also be applied, once, to the unread
//! articles that already match; the screen asks first and offers Undo.
//!
//! Each rule is a reader's, and changes only that reader's marks (their
//! entries); another reader of the same feed sees the article as before.
//!
//! A muted article is kept and counts as read, so it waits in no list and
//! other feed readers see it as read too. Only the Muted page, search and
//! (if it's starred) Starred show it; unmuting it (or marking it unread) brings it back, unread.

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

/// The longest phrase or author name a rule can hold, in characters.
pub const LONGEST: usize = 200;

/// The most muted articles the Muted page lists at once, newest first.
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

/// What a rule does to an article that matches.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    /// Kept, counted as read, shown only on the Muted page and in search.
    Mute,
    /// Starred.
    Star,
    /// Marked as read: it stays in its feed's list.
    Read,
}

impl Action {
    const fn word(self) -> &'static str {
        match self {
            Self::Mute => "mute",
            Self::Star => "star",
            Self::Read => "read",
        }
    }

    fn from_word(word: &str) -> Option<Self> {
        match word {
            "mute" => Some(Self::Mute),
            "star" => Some(Self::Star),
            "read" => Some(Self::Read),
            _ => None,
        }
    }

    /// Changes the named articles' marks for one reader, all in one step.
    /// Takes the reader, then the articles.
    const fn sql(self) -> &'static str {
        match self {
            Self::Mute => {
                "UPDATE entries SET muted = 1, read = 1
                 WHERE person_id = ? AND article_id IN (SELECT value FROM json_each(?))"
            }
            Self::Star => {
                "UPDATE entries SET starred = 1
                 WHERE person_id = ? AND article_id IN (SELECT value FROM json_each(?))"
            }
            Self::Read => {
                "UPDATE entries SET read = 1
                 WHERE person_id = ? AND article_id IN (SELECT value FROM json_each(?))"
            }
        }
    }
}

/// One rule, as stored and as the screen shows it.
#[derive(Clone, Debug, Serialize)]
pub struct Rule {
    pub id: i64,
    /// Whose rule it is.
    #[serde(skip)]
    pub person_id: i64,
    pub words: String,
    pub title_only: bool,
    pub author: String,
    pub feed_id: Option<i64>,
    pub folder_id: Option<i64>,
    /// The feed or folder it applied to is gone, so it matches nothing.
    pub place_gone: bool,
    pub action: Action,
    pub paused: bool,
}

type RuleLine = (
    i64,
    i64,
    String,
    bool,
    String,
    Option<i64>,
    Option<i64>,
    bool,
    String,
    bool,
);

/// A reader's rules, in the order they were made. Takes the reader.
const RULES: &str = "SELECT id, person_id, words, title_only, author, feed_id, folder_id,
        place_gone, action, paused FROM rules WHERE person_id = ? ORDER BY id";

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
        .filter_map(
            |(
                id,
                person_id,
                words,
                title_only,
                author,
                feed_id,
                folder_id,
                place_gone,
                action,
                paused,
            )| {
                Some(Rule {
                    id,
                    person_id,
                    words,
                    title_only,
                    author,
                    feed_id,
                    folder_id,
                    place_gone,
                    action: Action::from_word(&action)?,
                    paused,
                })
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
    author: Vec<String>,
}

impl Candidate {
    pub fn new(
        id: i64,
        feed_id: i64,
        title: &str,
        author: Option<&str>,
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
            author: words_of(author.unwrap_or_default()),
        }
    }
}

impl Rule {
    /// Whether it applies to a feed in these folders, whatever the article.
    fn covers(&self, feed_id: i64, folders: &HashSet<i64>) -> bool {
        if self.paused || self.place_gone {
            return false;
        }
        match (self.feed_id, self.folder_id) {
            (Some(feed), _) => feed == feed_id,
            (None, Some(folder)) => folders.contains(&folder),
            (None, None) => true,
        }
    }

    /// Whether an article (of a feed it covers) matches: every part the
    /// reader filled in must hold.
    pub fn matches(&self, article: &Candidate) -> bool {
        let words = words_of(&self.words);
        let author = words_of(&self.author);
        if words.is_empty() && author.is_empty() {
            return false;
        }
        let words_hold = words.is_empty()
            || holds(&article.title, &words)
            || (!self.title_only && holds(&article.text, &words));
        let author_holds = author.is_empty() || holds(&article.author, &author);
        words_hold && author_holds
    }
}

/// The reader's folders a feed is in.
async fn folders_of(
    connection: &mut SqliteConnection,
    person: i64,
    feed_id: i64,
) -> Result<HashSet<i64>, sqlx::Error> {
    let folders: Vec<i64> = sqlx::query_scalar(
        "SELECT feed_folders.folder_id FROM feed_folders
             JOIN folders ON folders.id = feed_folders.folder_id
         WHERE feed_folders.feed_id = ? AND folders.person_id = ?",
    )
    .bind(feed_id)
    .bind(person)
    .fetch_all(connection)
    .await?;
    Ok(folders.into_iter().collect())
}

type ArticleLine = (
    i64,
    i64,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
);

/// Does each reader's rules' work on one feed's articles numbered above
/// `after`: the ones that just arrived. Only readers who have them (whose
/// subscription isn't cleared) are asked. Each reader's rules run in the
/// order they were made, on that reader's marks; an article can be both
/// starred and muted.
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
        let all = rules(connection, person).await?;
        let folders = folders_of(connection, person, feed_id).await?;
        let covering: Vec<&Rule> = all
            .iter()
            .filter(|rule| rule.covers(feed_id, &folders))
            .collect();
        if covering.is_empty() {
            continue;
        }
        if candidates.is_none() {
            let lines: Vec<ArticleLine> = sqlx::query_as(
                "SELECT id, feed_id, title, author, content, summary FROM articles
                 WHERE feed_id = ? AND id > ?",
            )
            .bind(feed_id)
            .bind(after)
            .fetch_all(&mut *connection)
            .await?;
            candidates = Some(self::candidates(lines));
        }
        let candidates = candidates.as_deref().unwrap_or_default();
        act_on_each(connection, person, &covering, candidates).await?;
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
    let all = rules(connection, person).await?;
    let folders = folders_of(connection, person, feed_id).await?;
    let covering: Vec<&Rule> = all
        .iter()
        .filter(|rule| rule.covers(feed_id, &folders))
        .collect();
    if covering.is_empty() {
        return Ok(());
    }
    let lines: Vec<ArticleLine> = sqlx::query_as(
        "SELECT id, feed_id, title, author, content, summary FROM articles
         WHERE feed_id = ? AND id IN (SELECT value FROM json_each(?))",
    )
    .bind(feed_id)
    .bind(serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_owned()))
    .fetch_all(&mut *connection)
    .await?;
    act_on_each(connection, person, &covering, &candidates(lines)).await
}

/// Does each of one reader's rules' work on the articles that match it.
async fn act_on_each(
    connection: &mut SqliteConnection,
    person: i64,
    covering: &[&Rule],
    candidates: &[Candidate],
) -> Result<(), sqlx::Error> {
    for &rule in covering {
        let ids: Vec<i64> = candidates
            .iter()
            .filter(|article| rule.matches(article))
            .map(|article| article.id)
            .collect();
        act(connection, person, rule.action, &ids).await?;
    }
    Ok(())
}

fn candidates(lines: Vec<ArticleLine>) -> Vec<Candidate> {
    lines
        .into_iter()
        .map(|(id, feed_id, title, author, content, summary)| {
            Candidate::new(
                id,
                feed_id,
                &title,
                author.as_deref(),
                content.as_deref(),
                summary.as_deref(),
            )
        })
        .collect()
}

async fn act(
    connection: &mut SqliteConnection,
    person: i64,
    action: Action,
    ids: &[i64],
) -> Result<(), sqlx::Error> {
    if ids.is_empty() {
        return Ok(());
    }
    sqlx::query(action.sql())
        .bind(person)
        .bind(serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_owned()))
        .execute(connection)
        .await?;
    Ok(())
}

/// How many unread articles `matching_now` reads at a time, so even an
/// all-feeds rule never holds every article's text in memory at once.
const MATCH_BATCH: i64 = 500;

/// The unread articles of feeds its reader follows that a rule would change
/// now: for a star rule, only those not starred yet. It only reads, a batch
/// at a time, so callers run it outside a write, never holding up
/// background checks.
async fn matching_now(db: &sqlx::SqlitePool, rule: &Rule) -> Result<Vec<i64>, sqlx::Error> {
    let mut found = Vec::new();
    if rule.place_gone {
        return Ok(found);
    }
    let mut after = 0;
    loop {
        let lines: Vec<ArticleLine> = sqlx::query_as(
            "SELECT articles.id, entries.feed_id, articles.title, articles.author,
                    articles.content, articles.summary
             FROM entries CROSS JOIN articles ON articles.id = entries.article_id
                 JOIN subscriptions ON subscriptions.person_id = entries.person_id
                     AND subscriptions.feed_id = entries.feed_id
             WHERE entries.person_id = ?6 AND entries.read = 0
                 AND subscriptions.unsubscribed_at IS NULL AND entries.article_id > ?4
                 AND (?1 = 0 OR entries.starred = 0)
                 AND (?2 IS NULL OR entries.feed_id = ?2)
                 AND (?3 IS NULL OR entries.feed_id IN
                      (SELECT feed_id FROM feed_folders WHERE folder_id =
                           (SELECT id FROM folders WHERE id = ?3 AND person_id = ?6)))
             ORDER BY entries.article_id LIMIT ?5",
        )
        .bind(rule.action == Action::Star)
        .bind(rule.feed_id)
        .bind(rule.folder_id)
        .bind(after)
        .bind(MATCH_BATCH)
        .bind(rule.person_id)
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

/// Every rule, and how many articles are muted, for Settings.
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
    #[serde(default)]
    pub words: String,
    #[serde(default)]
    pub title_only: bool,
    #[serde(default)]
    pub author: String,
    pub feed_id: Option<i64>,
    pub folder_id: Option<i64>,
    pub action: Action,
    /// Undo for deleting a rule brings it back paused if it was, and with
    /// its place gone if it was, so it never spreads to every feed.
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

/// The form, checked: something to look for, a place that exists and is
/// the reader's.
async fn checked(
    connection: &mut SqliteConnection,
    person: i64,
    form: &RuleForm,
) -> Result<Result<(String, String), &'static str>, sqlx::Error> {
    let (Some(words), Some(author)) = (tidy(&form.words), tidy(&form.author)) else {
        return Ok(Err("too-long"));
    };
    if words_of(&words).is_empty() && words_of(&author).is_empty() {
        return Ok(Err("nothing-to-match"));
    }
    if form.feed_id.is_some() && form.folder_id.is_some() {
        return Ok(Err("no-place"));
    }
    if let Some(feed) = form.feed_id
        && !follows(connection, person, feed).await?
    {
        return Ok(Err("no-place"));
    }
    if let Some(folder) = form.folder_id {
        let found: Option<i64> =
            sqlx::query_scalar("SELECT id FROM folders WHERE id = ? AND person_id = ?")
                .bind(folder)
                .bind(person)
                .fetch_optional(&mut *connection)
                .await?;
        if found.is_none() {
            return Ok(Err("no-place"));
        }
    }
    Ok(Ok((words, author)))
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
    let (words, author) = match checked(&mut transaction, person, form).await? {
        Ok(parts) => parts,
        Err(refusal) => return Ok(Err(refusal)),
    };
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO rules (person_id, words, title_only, author, feed_id, folder_id,
             place_gone, action, paused, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(person)
    .bind(&words)
    .bind(form.title_only)
    .bind(&author)
    .bind(form.feed_id)
    .bind(form.folder_id)
    .bind(form.place_gone && form.feed_id.is_none() && form.folder_id.is_none())
    .bind(form.action.word())
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
/// match it, so the screen can offer to apply it to them too.
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
        let (words, author) = match checked(&mut transaction, person, &form).await? {
            Ok(parts) => parts,
            Err(refusal) => return Ok(Err(refusal)),
        };
        let changed = sqlx::query(
            "UPDATE rules SET words = ?, title_only = ?, author = ?, feed_id = ?, folder_id = ?,
                 place_gone = 0, action = ? WHERE id = ? AND person_id = ?",
        )
        .bind(&words)
        .bind(form.title_only)
        .bind(&author)
        .bind(form.feed_id)
        .bind(form.folder_id)
        .bind(form.action.word())
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
    let changed = sqlx::query("UPDATE rules SET paused = ? WHERE id = ? AND person_id = ?")
        .bind(form.paused)
        .bind(id)
        .bind(person)
        .execute(&state.db)
        .await;
    match changed {
        Ok(changed) if changed.rows_affected() == 0 => StatusCode::NOT_FOUND.into_response(),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
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
    let deleted = sqlx::query("DELETE FROM rules WHERE id = ? AND person_id = ?")
        .bind(id)
        .bind(person)
        .execute(&state.db)
        .await;
    match deleted {
        Ok(deleted) if deleted.rows_affected() == 0 => StatusCode::NOT_FOUND.into_response(),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("deleting a rule", &error),
    }
}

/// Applies a rule, once, to the unread articles that match it now. Answers
/// the articles it changed, so the screen can undo exactly those.
async fn apply_rule(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let applied: Result<Option<(Action, Vec<i64>)>, sqlx::Error> = async {
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
        act(&mut transaction, person, rule.action, &ids).await?;
        transaction.commit().await?;
        Ok(Some((rule.action, ids)))
    }
    .await;
    match applied {
        Ok(Some((action, ids))) => Json(json!({ "action": action, "ids": ids })).into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("applying a rule", &error),
    }
}

/// How many articles the reader has muted, from the `entries_muted` index.
pub(crate) const MUTED_COUNT: &str =
    "SELECT COUNT(*) FROM entries WHERE person_id = ? AND muted = 1";

/// The Muted page: the reader's newest muted articles, and how many there are.
async fn list_muted(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let listed: Result<(Vec<ArticleRow>, i64), sqlx::Error> = async {
        let articles = sqlx::query_as(
            "SELECT entries.article_id AS id, entries.feed_id, subscriptions.title AS feed_title,
                    articles.title, articles.link, entries.sort_at AS at,
                    entries.read, entries.starred, entries.muted
             FROM entries CROSS JOIN articles ON articles.id = entries.article_id
                 CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
                     AND subscriptions.feed_id = entries.feed_id
             WHERE entries.person_id = ? AND entries.muted = 1
             ORDER BY entries.sort_at DESC, entries.article_id DESC LIMIT ?",
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
        Err(error) => database_problem("listing muted articles", &error),
    }
}

/// The feed or folder a rule applied to is gone: it stays, matching nothing,
/// and Settings says so, until the reader chooses somewhere else. Answers
/// the rules it changed, so Undo for deleting a folder can hand them back
/// (`back_in_folder`).
pub async fn place_gone(
    connection: &mut SqliteConnection,
    feed_id: Option<i64>,
    folder_id: Option<i64>,
) -> Result<Vec<i64>, sqlx::Error> {
    sqlx::query_scalar(
        "UPDATE rules SET place_gone = 1, feed_id = NULL, folder_id = NULL
         WHERE feed_id = ? OR folder_id = ? RETURNING id",
    )
    .bind(feed_id)
    .bind(folder_id)
    .fetch_all(connection)
    .await
}

/// A reader's feed is cleared: their rules for it stay, matching nothing,
/// as `place_gone` says. Other readers' rules for the same feed carry on.
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

fn problem(error: &str) -> Response {
    (StatusCode::BAD_REQUEST, Json(json!({ "error": error }))).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(words: &str, title_only: bool, author: &str) -> Rule {
        Rule {
            id: 1,
            person_id: 1,
            words: words.to_owned(),
            title_only,
            author: author.to_owned(),
            feed_id: None,
            folder_id: None,
            place_gone: false,
            action: Action::Mute,
            paused: false,
        }
    }

    fn article(title: &str, author: Option<&str>, content: &str) -> Candidate {
        Candidate::new(1, 1, title, author, Some(content), None)
    }

    #[test]
    fn a_phrase_matches_whole_words_whatever_their_capitals() {
        let sponsored = rule("Sponsored", true, "");
        assert!(sponsored.matches(&article("SPONSORED: a new laptop", None, "")));
        assert!(sponsored.matches(&article("A post (sponsored)", None, "")));
        assert!(!sponsored.matches(&article("Unsponsored thoughts", None, "")));
        let ai = rule("AI", true, "");
        assert!(!ai.matches(&article("What she said", None, "")));
        assert!(ai.matches(&article("On AI, again", None, "")));
        let phrase = rule("open web", true, "");
        assert!(phrase.matches(&article("Back to the Open Web.", None, "")));
        assert!(!phrase.matches(&article("Open the web", None, "")));
    }

    #[test]
    fn title_only_leaves_the_text_alone() {
        let in_title = rule("crypto", true, "");
        let anywhere = rule("crypto", false, "");
        let post = article(
            "A quiet week",
            None,
            "<p>Nothing about <b>crypto</b> here.</p>",
        );
        assert!(!in_title.matches(&post));
        assert!(anywhere.matches(&post));
        // The HTML's own words never count.
        assert!(!rule("class", false, "").matches(&article("A", None, "<p class=\"x\">Hi</p>")));
    }

    #[test]
    fn every_part_filled_in_must_hold() {
        let jane = rule("", false, "Jane Doe");
        assert!(jane.matches(&article("Anything", Some("jane doe"), "")));
        assert!(!jane.matches(&article("Anything", Some("Jane Smith"), "")));
        assert!(!jane.matches(&article("Anything", None, "")));
        let both = rule("garden", false, "Jane Doe");
        assert!(both.matches(&article("My garden", Some("Jane Doe"), "")));
        assert!(!both.matches(&article("My kitchen", Some("Jane Doe"), "")));
        assert!(!rule("", false, "").matches(&article("Anything", Some("Jane"), "")));
    }

    #[test]
    fn hindi_words_stay_whole() {
        let hindi = rule("किताब", false, "");
        assert!(hindi.matches(&article("नई किताब।", None, "")));
        assert!(!hindi.matches(&article("किताबें", None, "")));
    }

    #[test]
    fn a_rule_covers_only_its_place_and_only_while_it_runs() {
        let folders: HashSet<i64> = [7].into_iter().collect();
        let mut one = rule("x", false, "");
        assert!(one.covers(3, &folders));
        one.folder_id = Some(7);
        assert!(one.covers(3, &folders));
        assert!(!one.covers(3, &HashSet::new()));
        one.folder_id = None;
        one.feed_id = Some(4);
        assert!(!one.covers(3, &folders));
        assert!(one.covers(4, &HashSet::new()));
        one.paused = true;
        assert!(!one.covers(4, &HashSet::new()));
        one.paused = false;
        one.place_gone = true;
        assert!(!one.covers(4, &HashSet::new()));
    }
}
