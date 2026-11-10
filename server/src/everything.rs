//! Download everything (SPEC section 23, decision 0251): Settings › Your data
//! gives the reader one .zip file that opens as a folder of plain pages, so
//! what they kept outlives nine turtles. Its `index.html` opens in any
//! browser, with or without nine turtles or the internet: who they follow,
//! and every article they kept (starred, or with a highlight or a note), each
//! as a page of its own with its text, the original's link, and their
//! highlights and notes. Beside it, the files other apps read: the OPML file
//! (`subscriptions`), starred articles as JSON Feed (`starred`), and notes and
//! highlights as Markdown (`notes::export`).
//!
//! The pages are plain HTML with their style inside, no scripts and no fonts
//! to fetch, the kind of page browsers have opened since the 1990s.
//! Pictures stay on the publisher's site: they show when the reader is
//! online, and their descriptions stand in when not.

use std::collections::BTreeMap;
use std::fmt::Write as _;

use axum::{
    Router,
    extract::State,
    http::header,
    response::{IntoResponse, Response},
    routing::get,
};

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    dates::{civil_date, day_month_year},
    feed::escape,
    feeds::{self, stored_html, stored_link},
    notes, starred, subscriptions,
    zip::{MOST_FILES, Zip},
};

mod pages;

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/everything", get(download))
}

/// One person the reader follows, with their note on them.
#[derive(sqlx::FromRow)]
struct Followed {
    name: String,
    site_url: Option<String>,
    note: Option<String>,
}

/// One article the reader kept: starred, highlighted or noted.
#[derive(sqlx::FromRow)]
struct Kept {
    id: i64,
    title: String,
    link: Option<String>,
    language: Option<String>,
    at: i64,
    starred: bool,
    who: String,
    feed_title: String,
}

/// Room for the index and the files beside it.
const MOST_ARTICLES: usize = MOST_FILES - 10;

/// The reader's kept articles, newest first: starred, or with a highlight or
/// a note, as the yearly clean-up keeps them (`cleanup`). Takes the reader
/// and how many at most.
const KEPT: &str = concat!(
    "SELECT articles.id, articles.title, articles.link,
         COALESCE(articles.language, feeds.language) AS language,
         entries.sort_at AS at, entries.starred,
         COALESCE(writers.name, subscriptions.title) AS who,
         subscriptions.title AS feed_title",
    feeds::from_entries!(),
    "? AND (entries.starred = 1 OR EXISTS (SELECT 1 FROM notes
         WHERE notes.person_id = entries.person_id AND notes.article_id = entries.article_id))
     ORDER BY entries.sort_at DESC, articles.id DESC LIMIT ?"
);

/// One download is built at a time, for everyone: each is held in memory
/// while it's made, and the server is small. Another waits its turn.
static ONE_AT_A_TIME: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn download(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let today = crate::now();
    let _turn = ONE_AT_A_TIME.lock().await;
    match zip_for(&state.db, person, today).await {
        Ok(zip) => {
            let (year, month, day) = civil_date(today);
            (
                [
                    (header::CONTENT_TYPE, "application/zip".to_owned()),
                    (
                        header::CONTENT_DISPOSITION,
                        format!(
                            "attachment; filename=\"nine-turtles-{year}-{month:02}-{day:02}.zip\""
                        ),
                    ),
                ],
                zip,
            )
                .into_response()
        }
        Err(error) => database_problem("downloading everything", &error),
    }
}

/// The whole download for reader `person`: one folder, named for `today`.
pub async fn zip_for(
    db: &sqlx::SqlitePool,
    person: i64,
    today: i64,
) -> Result<Vec<u8>, sqlx::Error> {
    let (year, month, day) = civil_date(today);
    let folder = format!("nine-turtles-{year}-{month:02}-{day:02}");
    let mut zip = Zip::new(today);

    let followed: Vec<Followed> = sqlx::query_as(
        "SELECT COALESCE(writers.name, subscriptions.title) AS name, feeds.site_url, subscriptions.note
         FROM subscriptions JOIN feeds ON feeds.id = subscriptions.feed_id
             LEFT JOIN writers ON writers.id = subscriptions.writer_id
         WHERE subscriptions.person_id = ? AND subscriptions.unsubscribed_at IS NULL
             AND subscriptions.cleared = 0",
    )
    .bind(person)
    .fetch_all(db)
    .await?;
    let kept: Vec<Kept> = sqlx::query_as(KEPT)
        .bind(person)
        .bind(MOST_ARTICLES as i64)
        .fetch_all(db)
        .await?;

    // Each article's page, its text read one at a time so only the zip grows
    // (`starred::file` reads its articles a page at a time too).
    let mut listed = Vec::with_capacity(kept.len());
    for article in &kept {
        let (content, summary): (Option<String>, Option<String>) =
            sqlx::query_as("SELECT content, summary FROM articles WHERE id = ?")
                .bind(article.id)
                .fetch_one(db)
                .await?;
        let marks: Vec<(Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT quote, note FROM notes WHERE person_id = ? AND article_id = ?
             ORDER BY quote IS NULL, made_at, id",
        )
        .bind(person)
        .bind(article.id)
        .fetch_all(db)
        .await?;
        let text = content
            .as_deref()
            .or(summary.as_deref())
            .map(stored_html)
            .unwrap_or_default();
        let path = pages::article_path(article.id, &article.title, article.at);
        zip.add(
            &format!("{folder}/{path}"),
            pages::article(article, &text, &marks).as_bytes(),
        );
        listed.push((path, !marks.is_empty()));
    }

    zip.add(
        &format!("{folder}/index.html"),
        pages::index(&followed, &kept, &listed, today).as_bytes(),
    );
    if let Some(opml) = subscriptions::opml_for(db, person).await? {
        zip.add(&format!("{folder}/follows.opml"), opml.as_bytes());
    }
    zip.add(
        &format!("{folder}/starred.json"),
        starred::file(db, person).await?.as_bytes(),
    );
    let markdown = notes::export::markdown(db, person, today).await?;
    zip.add(
        &format!("{folder}/notes-and-highlights.md"),
        markdown.as_bytes(),
    );
    Ok(zip.finish())
}

/// A person's site and notes, under their name (lowercased first, to sort A to Z).
type People<'a> = BTreeMap<(String, String), (Option<&'a str>, Vec<&'a str>)>;

/// The people followed, A to Z, each name once (a writer with two feeds is
/// one person), with every note written on them.
fn people(followed: &[Followed]) -> People<'_> {
    let mut people = People::new();
    for one in followed {
        let (site, notes) = people
            .entry((one.name.to_lowercase(), one.name.clone()))
            .or_default();
        if site.is_none() {
            *site = one.site_url.as_deref();
        }
        if let Some(note) = one.note.as_deref().filter(|note| !notes.contains(note)) {
            notes.push(note);
        }
    }
    people
}

/// A link only to a web address: anything else stays plain text.
fn web_link(address: &str, words: &str) -> String {
    if address.starts_with("https://") || address.starts_with("http://") {
        format!(r#"<a href="{}">{words}</a>"#, escape(&stored_link(address)))
    } else {
        words.to_owned()
    }
}

/// "Title" for an article with none, as the app says it.
fn title_of(title: &str) -> String {
    let title = title.trim();
    escape(if title.is_empty() { "Untitled" } else { title })
}

/// A byline: who, the publication when it isn't them, and the day.
fn byline(article: &Kept) -> String {
    let mut line = escape(&article.who);
    if article.feed_title != article.who {
        let _ = write!(line, " · {}", escape(&article.feed_title));
    }
    let _ = write!(line, " · {}", day_month_year(article.at));
    line
}
