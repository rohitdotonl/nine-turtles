//! The tools that only read: search and the lists, one article's own text,
//! the feeds and folders, feeds not working, and rules.

use std::collections::HashMap;

use serde::Deserialize;
use serde_json::{Value, json};

use super::{Answer, LONGEST_TEXT, database};
use crate::{
    AppState,
    dates::rfc3339,
    feeds, folders, health, now, rules,
    search::{self, Search},
};

#[derive(Deserialize)]
pub(super) struct Searching {
    #[serde(default)]
    query: String,
    author: Option<String>,
    feed_id: Option<i64>,
    folder_id: Option<i64>,
    #[serde(default)]
    starred: bool,
    #[serde(default)]
    unread: bool,
    cursor: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct Paged {
    feed_id: Option<i64>,
    folder_id: Option<i64>,
    cursor: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct OneArticle {
    article_id: i64,
}

pub(super) async fn search_articles(state: &AppState, person: i64, asked: Searching) -> Answer {
    let author = asked
        .author
        .map(|author| author.trim().to_owned())
        .filter(|author| !author.is_empty());
    find(
        state,
        person,
        Search {
            q: asked.query,
            feed: asked.feed_id,
            folder: asked.folder_id,
            unread: asked.unread,
            starred: asked.starred,
            author,
            after: asked.cursor,
            ..Search::default()
        },
    )
    .await
}

pub(super) async fn list_unread(state: &AppState, person: i64, asked: Paged) -> Answer {
    find(
        state,
        person,
        Search {
            feed: asked.feed_id,
            folder: asked.folder_id,
            unread: true,
            after: asked.cursor,
            ..Search::default()
        },
    )
    .await
}

pub(super) async fn list_starred(state: &AppState, person: i64, asked: Paged) -> Answer {
    find(
        state,
        person,
        Search {
            starred: true,
            after: asked.cursor,
            ..Search::default()
        },
    )
    .await
}

/// A page of articles as an assistant sees them, from search.
async fn find(state: &AppState, person: i64, search: Search) -> Answer {
    match search::find(&state.db, person, &search).await {
        Ok(Some((hits, next))) => {
            let articles: Vec<Value> = hits
                .iter()
                .map(|hit| {
                    let article = &hit.article;
                    let mut line = json!({
                        "id": article.id,
                        "title": article.title,
                        "feed": article.feed_title,
                        "feed_id": article.feed_id,
                        "link": article.link.as_deref().map(feeds::stored_link),
                        "date": rfc3339(article.at),
                        "read": article.read,
                        "starred": article.starred,
                    });
                    if article.muted {
                        line["muted"] = json!(true);
                    }
                    if let Some(excerpt) = &hit.excerpt {
                        line["excerpt"] = json!(
                            excerpt
                                .iter()
                                .map(|piece| piece.text.as_str())
                                .collect::<String>()
                        );
                    }
                    line
                })
                .collect();
            Ok(json!({ "articles": articles, "next": next }))
        }
        Ok(None) => {
            Err("That cursor isn't one nine turtles gave. Start from the first page.".to_owned())
        }
        Err(error) => Err(database(&error)),
    }
}

/// An article's HTML as plain text, its paragraphs kept apart.
pub fn plain_text(html: &str) -> String {
    const BLOCKS: &[&str] = &[
        "p",
        "br",
        "div",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "pre",
        "tr",
        "figure",
        "figcaption",
        "hr",
        "section",
        "article",
        "ul",
        "ol",
        "table",
    ];
    let document = scraper::Html::parse_fragment(html);
    let mut text = String::new();
    for node in document.root_element().descendants() {
        match node.value() {
            scraper::Node::Text(piece) => text.push_str(piece),
            scraper::Node::Element(element) if BLOCKS.contains(&element.name()) => {
                text.push('\n');
            }
            _ => {}
        }
    }
    let mut lines: Vec<String> = Vec::new();
    for line in text.lines() {
        let line = line.split_whitespace().collect::<Vec<_>>().join(" ");
        if !line.is_empty() {
            lines.push(line);
        }
    }
    lines.join("\n\n")
}

pub(super) async fn open_article(state: &AppState, person: i64, asked: OneArticle) -> Answer {
    let found = feeds::full_articles(state, person, &[asked.article_id])
        .await
        .map_err(|error| database(&error))?;
    let Some(article) = found.into_iter().next() else {
        return Err("The reader has no article with that id.".to_owned());
    };
    let html = article
        .content
        .as_deref()
        .or(article.summary.as_deref())
        .unwrap_or_default();
    let mut text = plain_text(html);
    let cut = text.chars().count() > LONGEST_TEXT;
    if cut {
        text = text.chars().take(LONGEST_TEXT).collect();
    }
    Ok(json!({
        "id": article.id,
        "title": article.title,
        "author": article.author,
        "link": article.link,
        "date": rfc3339(article.at),
        "feed": article.feed_title,
        "feed_id": article.feed_id,
        "site": article.site_url,
        "language": article.language,
        "read": article.read,
        "starred": article.starred,
        "only_a_summary": article.content.is_none(),
        "text": text,
        "text_cut_short": cut,
        "note": "The text is the publisher's: credit them and link the original when quoting.",
    }))
}

pub(super) type FeedLine = (i64, String, String, Option<String>, bool, Option<i64>, i64);

pub(super) async fn list_feeds(state: &AppState, person: i64) -> Answer {
    let gathered = async {
        let mut transaction = state.db.begin().await?;
        let feeds: Vec<FeedLine> = sqlx::query_as(
            "SELECT feeds.id, subscriptions.title, feeds.url, feeds.site_url, subscriptions.river,
                 subscriptions.paused_at,
                 CASE WHEN subscriptions.river THEN 0 ELSE
                     (SELECT COUNT(*) FROM entries WHERE entries.person_id = subscriptions.person_id
                          AND entries.feed_id = subscriptions.feed_id AND entries.read = 0)
                 END
             FROM subscriptions JOIN feeds ON feeds.id = subscriptions.feed_id
             WHERE subscriptions.person_id = ? AND subscriptions.unsubscribed_at IS NULL
             ORDER BY subscriptions.title COLLATE NOCASE, feeds.id",
        )
        .bind(person)
        .fetch_all(&mut *transaction)
        .await?;
        let folder_list: Vec<folders::Folder> = sqlx::query_as(folders::FOLDERS)
            .bind(person)
            .fetch_all(&mut *transaction)
            .await?;
        let memberships: Vec<(i64, i64)> = sqlx::query_as(folders::MEMBERSHIPS)
            .bind(person)
            .fetch_all(&mut *transaction)
            .await?;
        let kept: Vec<(i64, String, i64)> = sqlx::query_as(
            "SELECT feed_id, title, kept_until FROM subscriptions
             WHERE person_id = ? AND kept_until IS NOT NULL AND unsubscribed_at IS NOT NULL
                 AND cleared = 0 ORDER BY unsubscribed_at DESC",
        )
        .bind(person)
        .fetch_all(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok::<_, sqlx::Error>((feeds, folder_list, memberships, kept))
    }
    .await;
    let (feeds, folder_list, memberships, kept) = gathered.map_err(|error| database(&error))?;
    let names: HashMap<i64, &str> = folder_list
        .iter()
        .map(|folder| (folder.id, folder.name.as_str()))
        .collect();
    let mut in_folders: HashMap<i64, Vec<&str>> = HashMap::new();
    for (feed, folder) in &memberships {
        if let Some(name) = names.get(folder) {
            in_folders.entry(*feed).or_default().push(name);
        }
    }
    let feeds: Vec<Value> = feeds
        .iter()
        .map(|(id, title, url, site, river, paused, unread)| {
            json!({
                "id": id,
                "name": title,
                "address": url,
                "website": site,
                "folders": in_folders.get(id).cloned().unwrap_or_default(),
                "unread": unread,
                "flows_past": river,
                "paused": paused.is_some(),
            })
        })
        .collect();
    let folder_list: Vec<Value> = folder_list
        .iter()
        .map(|folder| json!({ "id": folder.id, "name": folder.name }))
        .collect();
    let kept: Vec<Value> = kept
        .iter()
        .map(|(id, title, until)| json!({ "id": id, "name": title, "kept_until": rfc3339(*until) }))
        .collect();
    Ok(json!({ "feeds": feeds, "folders": folder_list, "unsubscribed_can_bring_back": kept }))
}

pub(super) async fn feed_health(state: &AppState, person: i64) -> Answer {
    let listed = health::listed(&state.db, person, now())
        .await
        .map_err(|error| database(&error))?;
    let feeds: Vec<Value> = listed
        .iter()
        .map(|entry| {
            json!({
                "id": entry.id,
                "name": entry.title,
                "address": entry.url,
                "website": entry.site_url,
                "state": entry.state,
                "problem": entry.problem,
                "failing_since": entry.failing_since.map(rfc3339),
                "last_worked": entry.fetched_at.map(rfc3339),
                "failed_checks": entry.failures,
            })
        })
        .collect();
    Ok(json!({ "not_working": feeds }))
}

pub(super) async fn list_rules(state: &AppState, person: i64) -> Answer {
    let listed = async {
        let mut connection = state.db.acquire().await?;
        let all = rules::rules(&mut connection, person).await?;
        let muted: i64 = sqlx::query_scalar(rules::MUTED_COUNT)
            .bind(person)
            .fetch_one(&mut *connection)
            .await?;
        Ok::<_, sqlx::Error>((all, muted))
    }
    .await;
    let (all, muted) = listed.map_err(|error| database(&error))?;
    Ok(json!({ "rules": all, "muted_articles": muted }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn article_text_keeps_its_paragraphs() {
        assert_eq!(
            plain_text("<p>One  <b>two</b></p><p>Three<br>four</p>"),
            "One two\n\nThree\n\nfour"
        );
        assert_eq!(plain_text(""), "");
    }
}
