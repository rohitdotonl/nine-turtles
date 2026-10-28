//! What `tools/list` tells an assistant about each tool: its name, what it
//! does, the arguments it takes and whether it changes anything. `call` in
//! `mod.rs` does the work; a test in `tests/assistants.rs` checks that
//! every tool listed here is one it knows.

use std::sync::LazyLock;

use serde_json::{Value, json};

use super::{LONGEST_ADDRESS, MOST_AT_ONCE};
use crate::{folders, rules};

/// Every tool, built once.
static ALL: LazyLock<Vec<Value>> = LazyLock::new(list);

/// Every tool, in the order an assistant sees them.
pub(super) fn all() -> &'static [Value] {
    &ALL
}

/// A tool's description for `tools/list`.
fn tool(
    name: &str,
    title: &str,
    description: &str,
    properties: Value,
    required: &[&str],
    hints: Value,
) -> Value {
    json!({
        "name": name,
        "title": title,
        "description": description,
        "inputSchema": {
            "type": "object",
            "properties": properties,
            "required": required,
            "additionalProperties": false,
        },
        "annotations": hints,
    })
}

fn reading() -> Value {
    json!({ "readOnlyHint": true, "openWorldHint": false })
}

fn changing(destructive: bool, idempotent: bool) -> Value {
    json!({
        "readOnlyHint": false,
        "destructiveHint": destructive,
        "idempotentHint": idempotent,
        "openWorldHint": false,
    })
}

#[allow(clippy::too_many_lines)]
fn list() -> Vec<Value> {
    let cursor = json!({ "type": "string", "description": "The `next` from the previous page, to get the page after it." });
    let feed_id = json!({ "type": "integer", "description": "A feed's id, from list_feeds." });
    let folder_id = json!({ "type": "integer", "description": "A folder's id, from list_feeds." });
    let article_ids = json!({
        "type": "array",
        "items": { "type": "integer" },
        "maxItems": MOST_AT_ONCE,
        "description": "Article ids, from a list or search.",
    });
    vec![
        tool(
            "search_articles",
            "Search articles",
            "Find the reader's articles by words, author, feed, folder, starred or unread. \
             Words find longer words they start; put words in double quotes to find them together. \
             50 a page, best matches (in the title) first, then newest.",
            json!({
                "query": { "type": "string", "description": "Words to look for." },
                "author": { "type": "string", "description": "Only articles whose author's name holds this." },
                "feed_id": feed_id,
                "folder_id": folder_id,
                "starred": { "type": "boolean" },
                "unread": { "type": "boolean" },
                "cursor": cursor,
            }),
            &[],
            reading(),
        ),
        tool(
            "list_unread",
            "List unread articles",
            "The reader's unread articles, newest first, 50 a page: all of them, one folder's or one feed's.",
            json!({ "feed_id": feed_id, "folder_id": folder_id, "cursor": cursor }),
            &[],
            reading(),
        ),
        tool(
            "list_starred",
            "List starred articles",
            "The reader's starred articles, newest first, 50 a page.",
            json!({ "cursor": cursor }),
            &[],
            reading(),
        ),
        tool(
            "open_article",
            "Open an article",
            "One article: title, author, link, date, feed, and the text its feed holds, as plain text \
             (cut after 30,000 characters). Opening it doesn't mark it read.",
            json!({ "article_id": { "type": "integer" } }),
            &["article_id"],
            reading(),
        ),
        tool(
            "list_feeds",
            "List feeds and folders",
            "Every feed the reader follows (id, name, address, website, folders, unread count), every folder, \
             and feeds an assistant unsubscribed from that can still be brought back.",
            json!({}),
            &[],
            reading(),
        ),
        tool(
            "feed_health",
            "Feeds that aren't working",
            "Feeds that keep failing to load: dead ones first, with what went wrong and when they last worked.",
            json!({}),
            &[],
            reading(),
        ),
        tool(
            "list_rules",
            "List rules and mutes",
            "The reader's rules (\"when a new article matches this, mute, star or mark it read\") and how many articles are muted.",
            json!({}),
            &[],
            reading(),
        ),
        tool(
            "mark_read",
            "Mark read or unread",
            "Marks articles read (read: true) or unread (read: false).",
            json!({ "article_ids": article_ids, "read": { "type": "boolean" } }),
            &["article_ids", "read"],
            changing(false, true),
        ),
        tool(
            "mark_feed_read",
            "Mark a feed read",
            "Marks every unread article in one feed as read.",
            json!({ "feed_id": feed_id }),
            &["feed_id"],
            changing(false, true),
        ),
        tool(
            "star",
            "Star or unstar",
            "Stars articles (starred: true) or takes their star off (starred: false).",
            json!({ "article_ids": article_ids, "starred": { "type": "boolean" } }),
            &["article_ids", "starred"],
            changing(false, true),
        ),
        tool(
            "add_feed",
            "Add a feed",
            "Follows a feed by its address, or a website's address (its first feed is followed). \
             Only http and https addresses. At most 20 an hour.",
            json!({ "address": { "type": "string", "maxLength": LONGEST_ADDRESS } }),
            &["address"],
            json!({ "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true }),
        ),
        tool(
            "edit_feed",
            "Rename a feed or move it to folders",
            "Renames a feed and/or sets which folders it's in, by folder name (a folder named for the first time is made). \
             Leave out what shouldn't change; an empty list takes it out of every folder.",
            json!({
                "feed_id": feed_id,
                "title": { "type": "string", "maxLength": folders::LONGEST_NAME },
                "folders": { "type": "array", "items": { "type": "string" } },
            }),
            &["feed_id"],
            changing(false, true),
        ),
        tool(
            "create_folder",
            "Create a folder",
            "Makes a folder (or finds the one with that name), optionally with feeds in it. \
             To undo delete_folder, pass the name, feed_ids, rule_ids and search_ids it answered.",
            json!({
                "name": { "type": "string", "maxLength": folders::LONGEST_NAME },
                "feed_ids": { "type": "array", "items": { "type": "integer" } },
                "rule_ids": { "type": "array", "items": { "type": "integer" }, "description": "Rules that pointed at a removed folder." },
                "search_ids": { "type": "array", "items": { "type": "integer" }, "description": "Saved searches that looked in a removed folder." },
            }),
            &["name"],
            changing(false, true),
        ),
        tool(
            "rename_folder",
            "Rename a folder",
            "Renames one of the reader's folders.",
            json!({ "folder_id": folder_id, "name": { "type": "string", "maxLength": folders::LONGEST_NAME } }),
            &["folder_id", "name"],
            changing(false, true),
        ),
        tool(
            "delete_folder",
            "Remove a folder",
            "Removes a folder. Its feeds stay followed; they just leave it. Rules for that folder stay, matching nothing. \
             Answers its feeds, rules and saved searches, so create_folder can put it back (its undo).",
            json!({ "folder_id": folder_id }),
            &["folder_id"],
            changing(true, true),
        ),
        tool(
            "add_rule",
            "Add a rule or mute",
            "Makes a rule: when a new article matches the words (in the title, or title and text) and/or author, \
             in every feed or one feed or folder, it's muted (hidden from lists, counted as read), starred, or marked read. \
             It acts on articles arriving from now on.",
            json!({
                "words": { "type": "string", "maxLength": rules::LONGEST },
                "title_only": { "type": "boolean", "description": "Look in titles only (otherwise title and text)." },
                "author": { "type": "string", "maxLength": rules::LONGEST },
                "feed_id": feed_id,
                "folder_id": folder_id,
                "action": { "type": "string", "enum": ["mute", "star", "read"] },
                "paused": { "type": "boolean", "description": "Made paused, as a removed rule was." },
            }),
            &["action"],
            changing(false, false),
        ),
        tool(
            "delete_rule",
            "Remove a rule",
            "Removes one rule. What it already did stays done. Answers the rule as it was, so add_rule can make it again (its undo).",
            json!({ "rule_id": { "type": "integer" } }),
            &["rule_id"],
            changing(true, true),
        ),
        tool(
            "unsubscribe_feed",
            "Unsubscribe from a feed",
            "Stops following a feed. It's kept, hidden, for 30 days, and the reader can bring it back in \
             Settings (or with resubscribe_feed); then its unstarred articles are removed for good. \
             Starred articles always stay. Ask the reader first.",
            json!({ "feed_id": feed_id }),
            &["feed_id"],
            changing(true, true),
        ),
        tool(
            "resubscribe_feed",
            "Bring back a feed",
            "Follows again a feed unsubscribed from in the last 30 days, with its articles and marks.",
            json!({ "feed_id": feed_id }),
            &["feed_id"],
            changing(false, true),
        ),
        tool(
            "export_feed_list",
            "Export the feed list",
            "The reader's feeds as an OPML file (the standard list every feed reader can import), folders included.",
            json!({}),
            &[],
            reading(),
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_tool_has_a_name_schema_and_hints() {
        let tools = all();
        assert_eq!(tools.len(), 20);
        for tool in tools {
            assert!(tool["name"].as_str().is_some_and(|name| !name.is_empty()));
            assert_eq!(tool["inputSchema"]["type"], "object");
            assert!(tool["annotations"]["readOnlyHint"].is_boolean());
        }
    }
}
