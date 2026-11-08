//! Person or publication (SPEC section 36, decision 0163): everything a
//! reader follows is someone or something. A place joined to others is
//! always a person's; for a place on its own nine turtles guesses once, from
//! the feed alone (never fetching a page), and the reader can change it. It
//! guesses what kind of source each place is too: a newsletter, a video
//! channel, a podcast or a blog.
//!
//! The guess, in order:
//! 1. One name wrote every article: a person. Several names: a publication.
//! 0. A YouTube channel or playlist is a publication, without guessing.
//! 2. No names: a place of someone's own on a site many people share (a
//!    Substack, a Bluesky account) is a person; a site
//!    the feed's own name matches (NASA at nasa.gov) is a publication.
//! 3. Still unclear: a person, since nine turtles is for people worth
//!    knowing. The reader sees the guess when adding and can change it.
//!
//! A person is called by their name (owner's plan, step 2): when every
//! article is signed by the same one author, that's what the person is called,
//! not the blog's title ("Tomas Berg", not "Notes from Tomas"). A name the
//! reader gave them stays.

use serde::Deserialize;
use sqlx::SqliteConnection;

/// Someone or something, as the reader chooses in Add or Edit.
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Person,
    Publication,
}

impl Kind {
    pub const fn name(self) -> &'static str {
        match self {
            Self::Person => "person",
            Self::Publication => "publication",
        }
    }
}

/// Sites where each person has a place of their own, so a feed there is
/// someone's, not a publication's.
const PERSONAL_SITES: &[&str] = &[
    "medium.com",
    "substack.com",
    "wordpress.com",
    "blogspot.com",
    "tumblr.com",
    "github.io",
    "bsky.app",
    "mastodon.social",
    "buttondown.com",
    "buttondown.email",
    "ghost.io",
    "micro.blog",
    "write.as",
    "bearblog.dev",
    "dev.to",
    "hashnode.dev",
    "neocities.org",
    "patreon.com",
];

/// "person" or "publication", from the names on its articles, its address,
/// its website and its title.
pub fn kind_from(authors: &[String], url: &str, site: Option<&str>, title: &str) -> &'static str {
    // A YouTube channel isn't guessed (the owner, 8 November 2026): its feed
    // signs every video with the channel's name, which can't tell a vlogger
    // from a company. It starts as a publication; the reader can change it.
    if url.contains("youtube.com/feeds/") {
        return "publication";
    }
    let mut names: Vec<String> = authors
        .iter()
        .map(|name| name.trim().to_lowercase())
        .filter(|name| !name.is_empty())
        .collect();
    names.sort_unstable();
    names.dedup();
    match names.len() {
        1 => return "person",
        0 => {}
        _ => return "publication",
    }
    let Some(host) = site.and_then(host_of).or_else(|| host_of(url)) else {
        return "person";
    };
    if PERSONAL_SITES
        .iter()
        .any(|shared| host == *shared || host.ends_with(&format!(".{shared}")))
    {
        return "person";
    }
    if names_the_site(&host, title) {
        "publication"
    } else {
        "person"
    }
}

/// Names a blog gives its articles that are a role or a placeholder, never
/// someone's name ("admin" on a WordPress blog).
const NOT_NAMES: &[&str] = &[
    "admin",
    "administrator",
    "anonymous",
    "author",
    "editor",
    "editors",
    "guest",
    "root",
    "staff",
    "team",
    "unknown",
    "user",
    "webmaster",
];

/// The one author every named article is by, when there is exactly one
/// and it's a person's name: what a person is called. Written as the feed
/// writes it, newest first, and capitalised if any article capitalises it.
pub fn one_author(authors: &[String]) -> Option<String> {
    let names: Vec<&str> = authors
        .iter()
        .map(|name| name.trim())
        .filter(|name| !name.is_empty())
        .collect();
    let first = *names.first()?;
    if names.iter().any(|other| !other.eq_ignore_ascii_case(first)) {
        return None;
    }
    let name = names
        .iter()
        .find(|name| name.starts_with(char::is_uppercase))
        .unwrap_or(&first);
    let plain = !NOT_NAMES.contains(&name.to_lowercase().as_str())
        && name.chars().count() <= 60
        && !name.contains(['@', '/', ':']);
    plain.then(|| (*name).to_owned())
}

/// What kind of source a place is: a newsletter, a video channel (YouTube's
/// feeds), a podcast (any episode), or a blog.
pub fn place_from(url: &str, has_episodes: bool) -> &'static str {
    if url.starts_with("newsletter:") {
        "newsletter"
    } else if url.contains("youtube.com/feeds/") {
        "video"
    } else if has_episodes {
        "podcast"
    } else {
        "blog"
    }
}

/// The website part of an address, lower case, without "www.".
fn host_of(address: &str) -> Option<String> {
    let host = reqwest::Url::parse(address)
        .ok()?
        .host_str()?
        .to_ascii_lowercase();
    Some(host.strip_prefix("www.").unwrap_or(&host).to_owned())
}

/// The site's own name (`nasa` in apod.nasa.gov) is one whole word of the
/// title, as a publication's is. A name made of two of its words run
/// together (`janedoe` for "Jane Doe") is a person's own domain, and one
/// said as someone's ("Jane's blog") is theirs: neither is this.
fn names_the_site(host: &str, title: &str) -> bool {
    let parts: Vec<&str> = host.split('.').collect();
    let Some(name) = parts.len().checked_sub(2).and_then(|at| parts.get(at)) else {
        return false;
    };
    let words: Vec<String> = title
        .split(|letter: char| !letter.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_lowercase)
        .collect();
    let lower = title.to_lowercase();
    let theirs =
        lower.contains(&format!("{name}'s")) || lower.contains(&format!("{name}\u{2019}s"));
    !theirs && words.len() > 1 && words.iter().any(|word| word == name)
}

/// Guesses, and keeps, each of the reader's places that has no kind or no
/// source kind yet, once it has been fetched: an imported feed waits for its
/// first check, so the guess sees its authors and episodes. `only` is a feed
/// just added, whose articles were stored then, so it's guessed at once. Their choices
/// stay as they made them. A place first guessed a person is called by its
/// one author's name (`name_by_author`).
pub async fn fill(
    connection: &mut SqliteConnection,
    person: i64,
    only: Option<i64>,
) -> Result<(), sqlx::Error> {
    type Waiting = (i64, String, Option<String>, String, bool, bool);
    let waiting: Vec<Waiting> = sqlx::query_as(
        "SELECT feeds.id, feeds.url, feeds.site_url, subscriptions.title,
             subscriptions.kind IS NULL, EXISTS (SELECT 1 FROM articles WHERE articles.feed_id = feeds.id
                 AND articles.episode_url IS NOT NULL)
         FROM subscriptions JOIN feeds ON feeds.id = subscriptions.feed_id
         WHERE subscriptions.person_id = ?1 AND subscriptions.unsubscribed_at IS NULL
             AND (subscriptions.kind IS NULL OR subscriptions.place IS NULL)
             AND (feeds.fetched_at IS NOT NULL OR ?2 IS NOT NULL)
             AND (?2 IS NULL OR feeds.id = ?2)",
    )
    .bind(person)
    .bind(only)
    .fetch_all(&mut *connection)
    .await?;
    for (feed, url, site, title, unguessed, has_episodes) in waiting {
        let authors: Vec<String> = sqlx::query_scalar(
            "SELECT trim(author) FROM articles
             WHERE feed_id = ? AND trim(COALESCE(author, '')) != ''
             GROUP BY trim(author) ORDER BY MAX(id) DESC LIMIT 10",
        )
        .bind(feed)
        .fetch_all(&mut *connection)
        .await?;
        let kind = kind_from(&authors, &url, site.as_deref(), &title);
        sqlx::query(
            "UPDATE subscriptions SET kind = COALESCE(kind, ?), place = COALESCE(place, ?)
             WHERE person_id = ? AND feed_id = ?",
        )
        .bind(kind)
        .bind(place_from(&url, has_episodes))
        .bind(person)
        .bind(feed)
        .execute(&mut *connection)
        .await?;
        if unguessed && kind == "person" {
            name_by_author(connection, feed, Some(person)).await?;
        }
    }
    Ok(())
}

/// Calls a place's followers by its one author's name (owner's plan, step 2),
/// where they still call it by the feed's own title, as the publisher last
/// gave it, so a name the reader gave or brought from another app stays.
/// `who` is one reader whose place was just guessed a person; `None` is
/// every follower still waiting for a name since structure change 35
/// (`name_pending`), at the feed's check, once its title is fresh.
/// Named only when every article is signed by that one name: an unsigned
/// one may be someone else's.
pub async fn name_by_author(
    connection: &mut SqliteConnection,
    feed: i64,
    who: Option<i64>,
) -> Result<(), sqlx::Error> {
    let waiting: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM subscriptions WHERE feed_id = ?1
             AND (person_id = ?2 OR (?2 IS NULL AND name_pending)))",
    )
    .bind(feed)
    .bind(who)
    .fetch_one(&mut *connection)
    .await?;
    if !waiting {
        return Ok(());
    }
    let authors: Vec<String> = sqlx::query_scalar(
        "SELECT trim(author) FROM articles
         WHERE feed_id = ? AND trim(COALESCE(author, '')) != ''
         GROUP BY trim(author) ORDER BY MAX(id) DESC LIMIT 10",
    )
    .bind(feed)
    .fetch_all(&mut *connection)
    .await?;
    let all_signed: bool = sqlx::query_scalar(
        "SELECT NOT EXISTS (SELECT 1 FROM articles
             WHERE feed_id = ? AND trim(COALESCE(author, '')) = '')",
    )
    .bind(feed)
    .fetch_one(&mut *connection)
    .await?;
    if let (true, Some(name)) = (all_signed, one_author(&authors)) {
        sqlx::query(
            "UPDATE subscriptions SET title = ?1
             WHERE feed_id = ?2 AND (person_id = ?3 OR (?3 IS NULL AND name_pending))
                 AND writer_id IS NULL AND kind = 'person'
                 AND title = (SELECT title FROM feeds WHERE feeds.id = subscriptions.feed_id)",
        )
        .bind(name)
        .bind(feed)
        .bind(who)
        .execute(&mut *connection)
        .await?;
    }
    if who.is_none() {
        sqlx::query("UPDATE subscriptions SET name_pending = 0 WHERE feed_id = ?")
            .bind(feed)
            .execute(&mut *connection)
            .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(list: &[&str]) -> Vec<String> {
        list.iter().map(|name| (*name).to_owned()).collect()
    }

    #[test]
    fn one_name_is_a_person_and_several_are_a_publication() {
        let url = "https://example.com/feed";
        assert_eq!(
            kind_from(&names(&["Jane", " jane "]), url, None, "Example"),
            "person"
        );
        assert_eq!(
            kind_from(&names(&["Jane", "Kai"]), url, None, "Example"),
            "publication"
        );
    }

    #[test]
    fn a_person_is_called_by_their_one_name_as_the_feed_writes_it() {
        assert_eq!(
            one_author(&names(&["tomas berg", "Tomas Berg"])).as_deref(),
            Some("Tomas Berg")
        );
        assert_eq!(one_author(&names(&["Tomas Berg", "Asha Rao"])), None);
        assert_eq!(one_author(&names(&[])), None);
        // A role or a placeholder is no one's name.
        assert_eq!(one_author(&names(&["admin"])), None);
        assert_eq!(one_author(&names(&["Staff"])), None);
    }

    #[test]
    fn a_youtube_channel_starts_as_a_publication() {
        let feed = "https://www.youtube.com/feeds/videos.xml?channel_id=UC123";
        assert_eq!(
            kind_from(
                &names(&["Sony LIV"]),
                feed,
                Some("https://www.youtube.com/channel/UC123"),
                "Sony LIV"
            ),
            "publication"
        );
    }

    #[test]
    fn with_no_names_the_site_decides() {
        let none = names(&[]);
        assert_eq!(
            kind_from(
                &none,
                "https://jane.substack.com/feed",
                None,
                "Jane's Letters"
            ),
            "person"
        );
        assert_eq!(
            kind_from(
                &none,
                "https://apod.nasa.gov/apod.rss",
                Some("https://apod.nasa.gov/"),
                "NASA Picture of the Day"
            ),
            "publication"
        );
        // A person's own domain, made of their name, is theirs, as is a site named as someone's.
        assert_eq!(
            kind_from(&none, "https://janedoe.com/feed", None, "Jane Doe"),
            "person"
        );
        assert_eq!(
            kind_from(&none, "https://alpha.example/feed", None, "Alpha's blog"),
            "person"
        );
        // Nothing to go on: a person.
        assert_eq!(
            kind_from(&none, "https://example.com/rss", None, "Notes"),
            "person"
        );
        assert_eq!(kind_from(&none, "not an address", None, "Notes"), "person");
    }

    #[test]
    fn a_source_is_a_newsletter_video_podcast_or_blog() {
        assert_eq!(place_from("newsletter:abc", false), "newsletter");
        assert_eq!(
            place_from(
                "https://www.youtube.com/feeds/videos.xml?channel_id=a",
                false
            ),
            "video"
        );
        assert_eq!(
            place_from("https://example.com/podcast.xml", true),
            "podcast"
        );
        assert_eq!(place_from("https://example.com/feed", false), "blog");
    }
}
