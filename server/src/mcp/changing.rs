//! The tools that change things: marking and starring, adding, editing and
//! unsubscribing feeds, folders and rules. Each one's answer says what an
//! assistant needs to undo it.

use std::time::Duration;

use serde::Deserialize;
use serde_json::json;

use super::{ADDS_AN_HOUR, Answer, KEPT_FOR, LONGEST_ADDRESS, MOST_AT_ONCE, database};
use crate::{
    AppState,
    dates::rfc3339,
    feeds::{self, NotAdded},
    folders::{self, Leaving},
    marks::{self, Mark, now_ms},
    now, rules,
};

#[derive(Deserialize)]
pub(super) struct Marking {
    article_ids: Vec<i64>,
    read: Option<bool>,
    starred: Option<bool>,
}

#[derive(Deserialize)]
pub(super) struct OneFeed {
    feed_id: i64,
}

#[derive(Deserialize)]
pub(super) struct Address {
    address: String,
}

#[derive(Deserialize)]
pub(super) struct FeedEdit {
    feed_id: i64,
    title: Option<String>,
    folders: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub(super) struct FolderName {
    folder_id: Option<i64>,
    name: Option<String>,
    /// For create_folder: feeds to put in it, and rules and saved searches
    /// to point at it again, as delete_folder answered them (its undo).
    #[serde(default)]
    feed_ids: Vec<i64>,
    #[serde(default)]
    rule_ids: Vec<i64>,
    #[serde(default)]
    search_ids: Vec<i64>,
}

#[derive(Deserialize)]
pub(super) struct OneRule {
    rule_id: i64,
}

pub(super) async fn mark(state: &AppState, person: i64, asked: Marking) -> Answer {
    if asked.article_ids.len() > MOST_AT_ONCE {
        return Err(format!("At most {MOST_AT_ONCE} articles at once."));
    }
    let (which, value, word) = match (asked.read, asked.starred) {
        (Some(read), None) => (Mark::Read, read, if read { "read" } else { "unread" }),
        (None, Some(starred)) => (
            Mark::Starred,
            starred,
            if starred { "starred" } else { "unstarred" },
        ),
        _ => return Err("Say read (for mark_read) or starred (for star).".to_owned()),
    };
    let changed = marks::set(
        &state.db,
        person,
        which,
        &asked.article_ids,
        value,
        now_ms(),
    )
    .await
    .map_err(|error| database(&error))?;
    Ok(json!({ "done": true, "articles": changed, "now": word }))
}

pub(super) async fn mark_feed_read(state: &AppState, person: i64, asked: OneFeed) -> Answer {
    let changed = sqlx::query(
        "UPDATE entries SET read = 1, read_marked_at = ? WHERE person_id = ? AND feed_id = ? AND read = 0",
    )
    .bind(now_ms())
    .bind(person)
    .bind(asked.feed_id)
    .execute(&state.db)
    .await
    .map_err(|error| database(&error))?;
    Ok(json!({ "done": true, "marked_read": changed.rows_affected() }))
}

/// Why a feed wasn't added, in words an assistant can pass on.
pub(super) fn not_added(why: &NotAdded) -> String {
    match why {
        NotAdded::NotAnAddress => "That isn't a web address (http or https).",
        NotAdded::NotAllowed => "nine turtles doesn't fetch from that address.",
        NotAdded::Unreachable => "That website couldn't be reached.",
        NotAdded::NotFound => "Nothing was found at that address.",
        NotAdded::TooBig => "That page is too big to be a feed.",
        NotAdded::NoFeed => "No feed was found there.",
        NotAdded::Already(_) => "The reader already follows that feed.",
        NotAdded::TooMany => "The reader follows as many feeds as nine turtles allows.",
        NotAdded::PlanEnded => "The reader's plan has ended, so new feeds can't be added.",
        NotAdded::Database => {
            "nine turtles had a problem with its database. Try again in a moment."
        }
    }
    .to_owned()
}

pub(super) async fn add_feed(state: &AppState, person: i64, asked: Address) -> Answer {
    let address = asked.address.trim();
    if address.len() > LONGEST_ADDRESS {
        return Err("That address is too long.".to_owned());
    }
    // Checked before counting, so a mistyped address costs nothing.
    if feeds::parse_address(address).is_none() {
        return Err(not_added(&NotAdded::NotAnAddress));
    }
    if !state
        .assistant_limits
        .allow("add", person, ADDS_AN_HOUR, Duration::from_secs(3_600))
    {
        return Err(format!(
            "At most {ADDS_AN_HOUR} feeds an hour. Try again later."
        ));
    }
    let id = feeds::add_for_app(state, person, address)
        .await
        .map_err(|why| not_added(&why))?;
    let title: Option<String> =
        sqlx::query_scalar("SELECT title FROM subscriptions WHERE person_id = ? AND feed_id = ?")
            .bind(person)
            .bind(id)
            .fetch_optional(&state.db)
            .await
            .map_err(|error| database(&error))?;
    Ok(json!({ "done": true, "feed_id": id, "name": title }))
}

pub(super) async fn edit_feed(state: &AppState, person: i64, asked: FeedEdit) -> Answer {
    let title = match &asked.title {
        Some(title) => Some(
            folders::clean_name(title)
                .ok_or_else(|| format!("A name is 1 to {} characters.", folders::LONGEST_NAME))?,
        ),
        None => None,
    };
    let wanted = match &asked.folders {
        Some(names) => Some(
            names
                .iter()
                .map(|name| {
                    folders::clean_name(name).ok_or_else(|| {
                        format!(
                            "A folder's name is 1 to {} characters.",
                            folders::LONGEST_NAME
                        )
                    })
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
        None => None,
    };
    let edited = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        if !feeds::follows(&mut transaction, person, asked.feed_id).await? {
            return Ok(false);
        }
        if let Some(title) = &title {
            folders::rename_feed(&mut transaction, person, asked.feed_id, title).await?;
        }
        if let Some(names) = &wanted {
            let mut ids = Vec::with_capacity(names.len());
            for name in names {
                ids.push(
                    folders::folder_named(&mut transaction, person, name)
                        .await?
                        .0,
                );
            }
            folders::file_in(&mut transaction, person, asked.feed_id, &ids).await?;
        }
        transaction.commit().await?;
        Ok::<bool, sqlx::Error>(true)
    }
    .await
    .map_err(|error| database(&error))?;
    if edited {
        Ok(json!({ "done": true }))
    } else {
        Err("The reader doesn't follow a feed with that id.".to_owned())
    }
}

pub(super) async fn folder(state: &AppState, person: i64, tool: &str, asked: FolderName) -> Answer {
    let name = match asked.name.as_deref() {
        Some(name) => Some(folders::clean_name(name).ok_or_else(|| {
            format!(
                "A folder's name is 1 to {} characters.",
                folders::LONGEST_NAME
            )
        })?),
        None => None,
    };
    let done = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let answer = match (tool, asked.folder_id, name) {
            ("create_folder", _, Some(name)) => {
                let (id, new) = folders::folder_named(&mut transaction, person, &name).await?;
                // Only feeds the reader follows, as the screen's Undo does.
                folders::put_back(
                    &mut transaction,
                    person,
                    id,
                    &asked.feed_ids,
                    &asked.rule_ids,
                    &asked.search_ids,
                )
                .await?;
                Ok(json!({ "done": true, "folder_id": id, "already_there": !new }))
            }
            ("rename_folder", Some(id), Some(name)) => {
                let other: Option<i64> = sqlx::query_scalar(
                    "SELECT id FROM folders WHERE person_id = ? AND name = ? AND id != ?",
                )
                .bind(person)
                .bind(&name)
                .bind(id)
                .fetch_optional(&mut *transaction)
                .await?;
                if other.is_some() {
                    Err("Another folder already has that name.".to_owned())
                } else {
                    let renamed =
                        sqlx::query("UPDATE folders SET name = ? WHERE id = ? AND person_id = ?")
                            .bind(&name)
                            .bind(id)
                            .bind(person)
                            .execute(&mut *transaction)
                            .await?;
                    if renamed.rows_affected() == 0 {
                        Err("The reader has no folder with that id.".to_owned())
                    } else {
                        Ok(json!({ "done": true }))
                    }
                }
            }
            ("delete_folder", Some(id), _) => {
                match folders::delete(&mut transaction, person, id).await? {
                    // Everything the assistant needs to undo it.
                    Some(gone) => Ok(json!({
                        "done": true,
                        "removed": gone.name,
                        "feed_ids": gone.feeds,
                        "rule_ids": gone.rules,
                        "search_ids": gone.searches,
                        "undo": "create_folder with this name, feed_ids, rule_ids and search_ids puts it back as it was",
                    })),
                    None => Err("The reader has no folder with that id.".to_owned()),
                }
            }
            _ => Err("Give the folder's id and/or name.".to_owned()),
        };
        transaction.commit().await?;
        Ok::<Answer, sqlx::Error>(answer)
    }
    .await;
    done.map_err(|error| database(&error))?
}

#[derive(Deserialize)]
pub(super) struct RuleAsked {
    #[serde(default)]
    words: String,
    #[serde(default)]
    title_only: bool,
    #[serde(default)]
    author: String,
    feed_id: Option<i64>,
    folder_id: Option<i64>,
    action: rules::Action,
    #[serde(default)]
    paused: bool,
}

pub(super) async fn add_rule(state: &AppState, person: i64, asked: RuleAsked) -> Answer {
    let form = rules::RuleForm {
        words: asked.words,
        title_only: asked.title_only,
        author: asked.author,
        feed_id: asked.feed_id,
        folder_id: asked.folder_id,
        action: asked.action,
        paused: asked.paused,
        place_gone: false,
    };
    match rules::make(state, person, &form).await {
        Ok(Ok((id, matching))) => Ok(json!({
            "done": true,
            "rule_id": id,
            "unread_articles_already_matching": matching,
            "note": "It acts on articles arriving from now on; the reader can apply it to those already here in Settings.",
        })),
        Ok(Err("too-long")) => Err(format!(
            "Words and author are at most {} characters.",
            rules::LONGEST
        )),
        Ok(Err("nothing-to-match")) => Err("Give words or an author to look for.".to_owned()),
        Ok(Err(_)) => Err(
            "Give one feed or one folder of the reader's, or neither for every feed.".to_owned(),
        ),
        Err(error) => Err(database(&error)),
    }
}

pub(super) async fn delete_rule(state: &AppState, person: i64, asked: OneRule) -> Answer {
    let removed = async {
        let mut connection = state.db.acquire().await?;
        let rule = rules::rules(&mut connection, person)
            .await?
            .into_iter()
            .find(|rule| rule.id == asked.rule_id);
        if rule.is_some() {
            sqlx::query("DELETE FROM rules WHERE id = ? AND person_id = ?")
                .bind(asked.rule_id)
                .bind(person)
                .execute(&mut *connection)
                .await?;
        }
        Ok::<_, sqlx::Error>(rule)
    }
    .await
    .map_err(|error| database(&error))?;
    match removed {
        Some(rule) => Ok(json!({ "done": true, "removed": rule })),
        None => Err("The reader has no rule with that id.".to_owned()),
    }
}

pub(super) async fn unsubscribe(state: &AppState, person: i64, asked: OneFeed) -> Answer {
    let at = now();
    let hidden = folders::leave(&state.db, person, asked.feed_id, at, Leaving::Assistant)
        .await
        .map_err(|error| database(&error))?;
    if !hidden {
        return Err("The reader doesn't follow a feed with that id.".to_owned());
    }
    Ok(json!({
        "done": true,
        "kept_until": rfc3339(at + KEPT_FOR),
        "note": "The reader can bring it back in Settings until then, or you can with resubscribe_feed.",
    }))
}

pub(super) async fn resubscribe(state: &AppState, person: i64, asked: OneFeed) -> Answer {
    let back = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let back = feeds::follow_again(&mut transaction, person, asked.feed_id, now()).await?;
        transaction.commit().await?;
        Ok::<bool, sqlx::Error>(back)
    }
    .await
    .map_err(|error| database(&error))?;
    if back {
        Ok(json!({ "done": true }))
    } else {
        Err(
            "That feed can't be brought back: the reader follows it, or it's already gone."
                .to_owned(),
        )
    }
}
