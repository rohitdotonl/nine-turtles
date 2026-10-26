//! OPML import and export (SPEC section 16): the standard file feed readers
//! use to move a list of feeds and folders from one app to another.
//!
//! Importing only writes down the feeds and folders; it fetches nothing.
//! Each new feed is due for a background check straight away, so its
//! articles arrive over the next few minutes, a few feeds at a time
//! (`checking`), never all at once. A feed listed several times becomes one
//! feed in several folders, and feeds already followed aren't duplicated
//! (they join the file's folders). A feed another reader already follows
//! isn't stored twice: the reader gets their own subscription to it, its
//! articles so far counted as read. Exporting writes each feed the reader
//! follows under every folder of theirs it's in.

use std::collections::HashMap;

use axum::{
    Json, Router,
    extract::State,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
    routing::get,
};
use opml::{OPML, Outline};
use reqwest::Url;
use serde::Serialize;
use serde_json::json;

use crate::{
    AppState, admin,
    auth::{SignedIn, database_problem},
    feed,
    feeds::{make_room, subscribe},
    folders::{self, FOLDERS, Folder, MEMBERSHIPS, clean_name},
    now,
};

/// More feeds than any reader follows. A file listing more is refused
/// rather than half imported.
pub const MOST_FEEDS: usize = 5_000;

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/opml", get(export).post(import))
}

/// One feed as the file lists it.
#[derive(Debug, PartialEq, Eq)]
pub struct Listed {
    /// The name the file gives it, if any.
    pub name: Option<String>,
    /// The feed's address, exactly as written.
    pub address: String,
    pub site: Option<String>,
    /// The folder it's listed under, if any.
    pub folder: Option<String>,
}

/// Reads an OPML file. Every feed it lists, in order, each with the folder
/// it's directly under. Folders inside folders aren't a nine turtles idea, so a
/// feed belongs to the innermost one. None if it isn't an OPML file.
pub fn read(text: &str) -> Option<Vec<Listed>> {
    let document = OPML::from_str(text.trim_start_matches('\u{feff}')).ok()?;
    let mut listed = Vec::new();
    walk(&document.body.outlines, None, &mut listed);
    Some(listed)
}

fn walk(outlines: &[Outline], folder: Option<&str>, listed: &mut Vec<Listed>) {
    for outline in outlines {
        let name = [outline.title.as_deref(), Some(outline.text.as_str())]
            .into_iter()
            .flatten()
            .find_map(clean_name);
        match &outline.xml_url {
            Some(address) => listed.push(Listed {
                name,
                address: address.trim().to_owned(),
                site: outline.html_url.clone(),
                folder: folder.map(str::to_owned),
            }),
            None => walk(&outline.outlines, name.as_deref().or(folder), listed),
        }
    }
}

/// What an import did, for the plain summary the screen shows.
#[derive(Debug, Default, Serialize)]
pub struct Summary {
    /// Feeds now followed that weren't before.
    pub added: usize,
    /// Feeds in the file that were already followed.
    pub already: usize,
    pub folders_added: usize,
    /// The names (or addresses) of the feeds that couldn't be read.
    pub unreadable: Vec<String>,
}

async fn import(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    text: String,
) -> Response {
    let Some(listed) = read(&text) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "not-opml" })),
        )
            .into_response();
    };
    if listed.len() > MOST_FEEDS {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
    match follow_all(&state.db, person, &listed, now()).await {
        Ok(Imported::Done(summary)) => Json(json!({ "summary": summary })).into_response(),
        Ok(Imported::TooMany { following, adding }) => (
            StatusCode::CONFLICT,
            Json(json!({
                "error": "too-many",
                "following": following,
                "adding": adding,
                "most": admin::MOST_FEEDS,
            })),
        )
            .into_response(),
        Err(error) => database_problem("importing an OPML file", &error),
    }
}

/// What `follow_all` did.
#[derive(Debug)]
pub enum Imported {
    Done(Summary),
    /// Nothing was imported: the reader, who follows `following` feeds,
    /// would have followed `adding` more, past `admin::MOST_FEEDS`.
    TooMany {
        following: i64,
        adding: usize,
    },
}

/// Follows every feed listed for reader `person`, all at once or not at
/// all: nothing, if it would take them past the most feeds one reader can
/// follow.
pub async fn follow_all(
    db: &sqlx::SqlitePool,
    person: i64,
    listed: &[Listed],
    now: i64,
) -> Result<Imported, sqlx::Error> {
    let mut summary = Summary::default();
    let mut seen: HashMap<String, i64> = HashMap::new();
    let mut transaction = db.begin_with("BEGIN IMMEDIATE").await?;
    let before = admin::following(&mut transaction, person).await?;
    for entry in listed {
        let Some(url) = web_address(&entry.address) else {
            summary
                .unreadable
                .push(entry.name.clone().unwrap_or_else(|| entry.address.clone()));
            continue;
        };
        let key = feed::normalize(&url);
        let id = if let Some(&id) = seen.get(&key) {
            id
        } else {
            let id = follow_one(
                &mut transaction,
                person,
                entry,
                &url,
                &key,
                now,
                &mut summary,
            )
            .await?;
            seen.insert(key, id);
            id
        };
        if let Some(name) = &entry.folder {
            let (folder, created) = folders::folder_named(&mut transaction, person, name).await?;
            summary.folders_added += usize::from(created);
            sqlx::query("INSERT OR IGNORE INTO feed_folders (folder_id, feed_id) VALUES (?, ?)")
                .bind(folder)
                .bind(id)
                .execute(&mut *transaction)
                .await?;
        }
    }
    if summary.added > 0 && admin::following(&mut transaction, person).await? > admin::MOST_FEEDS {
        transaction.rollback().await?;
        return Ok(Imported::TooMany {
            following: before,
            adding: summary.added,
        });
    }
    transaction.commit().await?;
    Ok(Imported::Done(summary))
}

/// Follows one feed from the file for reader `person`, unless they follow
/// it already. Answers its number either way.
async fn follow_one(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    entry: &Listed,
    url: &Url,
    key: &str,
    now: i64,
    summary: &mut Summary,
) -> Result<i64, sqlx::Error> {
    make_room(connection, person, key).await?;
    let followed: Option<i64> = sqlx::query_scalar(
        "SELECT feeds.id FROM feeds JOIN subscriptions ON subscriptions.feed_id = feeds.id
         WHERE feeds.url_key = ? AND subscriptions.person_id = ?
             AND subscriptions.unsubscribed_at IS NULL",
    )
    .bind(key)
    .bind(person)
    .fetch_optional(&mut *connection)
    .await?;
    if let Some(id) = followed {
        summary.already += 1;
        return Ok(id);
    }
    let title = entry
        .name
        .clone()
        .or_else(|| url.host_str().map(str::to_owned))
        .unwrap_or_else(|| url.to_string());
    let site = entry
        .site
        .as_deref()
        .and_then(web_address)
        .map(String::from);
    // New (or one nobody follows any more, started afresh): due for its
    // first check straight away. One others follow is left as it is.
    let fresh: Option<i64> = sqlx::query_scalar(
        "INSERT INTO feeds (url, url_key, title, site_url, added_at, next_check_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (url_key) DO UPDATE SET
             url = excluded.url, title = excluded.title, site_url = excluded.site_url,
             language = NULL, etag = NULL, last_modified = NULL, added_at = excluded.added_at,
             fetched_at = NULL, next_check_at = excluded.next_check_at, failures = 0,
             failing_since = NULL, missing_since = NULL, problem = NULL
         WHERE feeds.unsubscribed_at IS NOT NULL
         RETURNING id",
    )
    .bind(url.as_str())
    .bind(key)
    .bind(&title)
    .bind(site)
    .bind(now)
    .bind(now)
    .fetch_optional(&mut *connection)
    .await?;
    let id = match fresh {
        Some(id) => id,
        None => {
            sqlx::query_scalar("SELECT id FROM feeds WHERE url_key = ?")
                .bind(key)
                .fetch_one(&mut *connection)
                .await?
        }
    };
    subscribe(connection, person, id, &title, now).await?;
    // Nothing is fetched here, so what's already stored counts as read;
    // what arrives from the next check is new.
    sqlx::query(
        "INSERT OR IGNORE INTO entries (person_id, article_id, feed_id, sort_at, read)
         SELECT ?, id, feed_id, sort_at, 1 FROM articles WHERE feed_id = ?",
    )
    .bind(person)
    .bind(id)
    .execute(&mut *connection)
    .await?;
    summary.added += 1;
    Ok(id)
}

/// An `http` or `https` address, or None.
fn web_address(text: &str) -> Option<Url> {
    let url = Url::parse(text.trim()).ok()?;
    (matches!(url.scheme(), "http" | "https") && url.host_str().is_some()).then_some(url)
}

#[derive(sqlx::FromRow)]
struct Followed {
    id: i64,
    title: String,
    url: String,
    site_url: Option<String>,
}

/// Downloads an OPML file of every followed feed: each folder A to Z with
/// its feeds, then the feeds in no folder.
async fn export(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let gathered: Result<_, sqlx::Error> = async {
        let mut transaction = state.db.begin().await?;
        let feeds: Vec<Followed> = sqlx::query_as(
            "SELECT feeds.id, subscriptions.title, feeds.url, feeds.site_url
             FROM subscriptions JOIN feeds ON feeds.id = subscriptions.feed_id
             WHERE subscriptions.person_id = ? AND subscriptions.unsubscribed_at IS NULL
                 AND feeds.newsletter_of IS NULL
             ORDER BY subscriptions.title COLLATE NOCASE, feeds.id",
        )
        .bind(person)
        .fetch_all(&mut *transaction)
        .await?;
        let folders: Vec<Folder> = sqlx::query_as(FOLDERS)
            .bind(person)
            .fetch_all(&mut *transaction)
            .await?;
        let memberships: Vec<(i64, i64)> = sqlx::query_as(MEMBERSHIPS)
            .bind(person)
            .fetch_all(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok((feeds, folders, memberships))
    }
    .await;
    let (feeds, folders, memberships) = match gathered {
        Ok(gathered) => gathered,
        Err(error) => return database_problem("exporting an OPML file", &error),
    };
    match write(&feeds, &folders, &memberships) {
        Some(file) => (
            [
                (header::CONTENT_TYPE, "text/x-opml; charset=utf-8"),
                (
                    header::CONTENT_DISPOSITION,
                    "attachment; filename=\"nine-turtles-feeds.opml\"",
                ),
            ],
            file,
        )
            .into_response(),
        None => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

fn write(feeds: &[Followed], folders: &[Folder], memberships: &[(i64, i64)]) -> Option<String> {
    let outline = |feed: &Followed| Outline {
        text: feed.title.clone(),
        title: Some(feed.title.clone()),
        r#type: Some("rss".to_owned()),
        xml_url: Some(feed.url.clone()),
        html_url: feed.site_url.clone(),
        ..Outline::default()
    };
    let mut document = OPML {
        head: Some(opml::Head {
            title: Some("nine turtles feeds".to_owned()),
            ..opml::Head::default()
        }),
        ..OPML::default()
    };
    for folder in folders {
        let inside: Vec<Outline> = feeds
            .iter()
            .filter(|feed| memberships.contains(&(feed.id, folder.id)))
            .map(outline)
            .collect();
        document.body.outlines.push(Outline {
            text: folder.name.clone(),
            title: Some(folder.name.clone()),
            outlines: inside,
            ..Outline::default()
        });
    }
    document.body.outlines.extend(
        feeds
            .iter()
            .filter(|feed| !memberships.iter().any(|(id, _)| *id == feed.id))
            .map(outline),
    );
    let body = document.to_string().ok()?;
    Some(format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n{body}\n"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn feeds_are_read_with_their_innermost_folder() {
        let file = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head><title>Made-up feeds</title></head>
  <body>
    <outline text="Loose" xmlUrl="https://loose.example/feed" htmlUrl="https://loose.example/"/>
    <outline text="Tech" title="Tech">
      <outline type="rss" text="Gadgets" xmlUrl="https://gadgets.example/rss"/>
      <outline text="Deeper">
        <outline text="Chips" title="Chips &amp; more" xmlUrl="https://chips.example/atom"/>
      </outline>
    </outline>
    <outline text="Empty folder"/>
  </body>
</opml>"#;
        let listed = read(file).unwrap();
        let summary: Vec<_> = listed
            .iter()
            .map(|entry| (entry.name.as_deref(), entry.folder.as_deref()))
            .collect();
        assert_eq!(
            summary,
            [
                (Some("Loose"), None),
                (Some("Gadgets"), Some("Tech")),
                (Some("Chips & more"), Some("Deeper")),
            ]
        );
        assert_eq!(listed[0].site.as_deref(), Some("https://loose.example/"));
    }

    #[test]
    fn only_opml_files_are_read() {
        assert_eq!(read("not a file at all"), None);
        assert_eq!(read("<rss version=\"2.0\"><channel/></rss>"), None);
    }

    #[test]
    fn only_web_addresses_are_followed() {
        assert!(web_address("https://example.com/feed").is_some());
        assert!(web_address(" http://example.com/feed ").is_some());
        assert!(web_address("feed://example.com/feed").is_none());
        assert!(web_address("javascript:alert(1)").is_none());
        assert!(web_address("example.com/feed").is_none());
    }

    #[test]
    fn an_export_reads_back_the_same() {
        let feed = |id: i64, title: &str| Followed {
            id,
            title: title.to_owned(),
            url: format!("https://{id}.example/feed?a=1&b=2"),
            site_url: None,
        };
        let feeds = [feed(1, "Alpha <one>"), feed(2, "Beta"), feed(3, "Gamma")];
        let folders = [
            Folder {
                id: 7,
                name: "News & views".to_owned(),
            },
            Folder {
                id: 8,
                name: "Tech".to_owned(),
            },
        ];
        // Alpha is in both folders, Gamma in none.
        let file = write(&feeds, &folders, &[(1, 7), (1, 8), (2, 8)]).unwrap();
        let listed: Vec<_> = read(&file)
            .unwrap()
            .into_iter()
            .map(|entry| (entry.name.unwrap(), entry.folder, entry.address))
            .collect();
        let row = |name: &str, folder: Option<&str>, id: i64| {
            (
                name.to_owned(),
                folder.map(str::to_owned),
                format!("https://{id}.example/feed?a=1&b=2"),
            )
        };
        assert_eq!(
            listed,
            [
                row("Alpha <one>", Some("News & views"), 1),
                row("Alpha <one>", Some("Tech"), 1),
                row("Beta", Some("Tech"), 2),
                row("Gamma", None, 3),
            ]
        );
    }
}
