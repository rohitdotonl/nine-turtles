//! Person or publication (SPEC section 36, decisions 0163 and 0264): everything
//! a reader follows is someone or something. A place joined to others is
//! always a person's; for a place on its own nine turtles sorts it once, from
//! the feed alone (never fetching a page), and says why, and the reader can
//! change it. Where the feed can't tell, it says so: the place "could be
//! either", kept with the publications until the reader settles it. It
//! guesses what kind of source each place is too: a newsletter, a video
//! channel, a podcast or a blog.
//!
//! How it sorts, the first that fits (`kind_from`):
//! 1. A YouTube channel or playlist: could be either (a vlogger's channel and
//!    a company's sign their videos alike).
//! 2. Several names sign its articles: a publication.
//! 3. One name signs them, a person's name (a role such as "admin" beside it
//!    doesn't count), not the feed's or the site's own unless that reads as a
//!    person's ("Julia Evans", never "The Verge"): a person.
//! 4. No such name, and the site is someone's own (a place of theirs on a
//!    site many people share, a title saying it's theirs, "Jim's Notes" but
//!    never "Harper's Magazine", or an address that is a name-like title run
//!    together, janedoe.com): a person.
//! 5. No such name, and the site's own name is a word of its title (NASA at
//!    apod.nasa.gov): a publication.
//! 6. A folder it came in says which ("Friends", "News"): that.
//! 7. Anything else: could be either.
//!
//! A person is called by their name (owner's plan, step 2): when every
//! article is signed by the same one author, that's what the person is called,
//! not the blog's title ("Tomas Berg", not "Notes from Tomas"). A name the
//! reader gave them stays.

use reqwest::Url;
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

/// Why a place is filed as it is (`subscriptions.kind_why`, decision 0264):
/// one of the reasons below when nine turtles chose, `reader` when the reader
/// did. Null for a place sorted before nine turtles said why. A place whose
/// reason starts `unsure-` is open: it could be either, and is kept with the
/// publications until the reader settles it.
pub const WHYS: &[&str] = &[
    "one-name",
    "own-site",
    "several-names",
    "site-name",
    "folder",
    "unsure-no-names",
    "unsure-channel",
    "reader",
];

/// What nine turtles knows of a place when it sorts it: the names on its
/// newest articles, its address, its website, the reader's name for it, the
/// feed's own title and the names of the folders it's in.
pub struct Clues<'a> {
    pub authors: &'a [String],
    pub url: &'a str,
    pub site: Option<&'a str>,
    pub title: &'a str,
    pub feed_title: &'a str,
    pub folders: &'a [String],
}

/// Words in a folder's name that say what's in it (rule 6).
const PEOPLE_FOLDERS: &[&str] = &["friends", "family", "people", "personal", "writers"];
const PUBLICATION_FOLDERS: &[&str] = &[
    "news",
    "newspapers",
    "magazines",
    "publications",
    "companies",
    "media",
    "press",
];

/// "person" or "publication", and why (`WHYS`), the first rule that fits
/// (the module's comment lists them).
pub fn kind_from(clues: &Clues) -> (&'static str, &'static str) {
    if Url::parse(clues.url).is_ok_and(|url| crate::youtube::addresses::is_feed(&url)) {
        return ("publication", "unsure-channel");
    }
    let host = clues.site.and_then(host_of).or_else(|| host_of(clues.url));
    let mut names: Vec<String> = clues
        .authors
        .iter()
        .map(|name| name.trim().to_lowercase())
        .filter(|name| !name.is_empty() && !NOT_NAMES.contains(&name.as_str()))
        .collect();
    names.sort_unstable();
    names.dedup();
    if names.len() > 1 {
        return ("publication", "several-names");
    }
    // A role ("admin") beside a name doesn't count against it.
    let signed: Vec<String> = clues
        .authors
        .iter()
        .filter(|name| !NOT_NAMES.contains(&name.trim().to_lowercase().as_str()))
        .cloned()
        .collect();
    let named = one_author(&signed).is_some_and(|name| {
        let squashed_name = squashed(&name);
        let own = squashed_name == squashed(clues.feed_title)
            || host.as_deref().and_then(site_name) == Some(squashed_name.as_str());
        // The feed's or the site's own name, unless it reads as a person's:
        // "Julia Evans" signing Julia Evans's blog is hers, "The Verge" isn't.
        let words: Vec<&str> = name.split_whitespace().collect();
        !own || (words.len() > 1 && reads_as_a_name(&words))
    });
    if named {
        return ("person", "one-name");
    }
    if let Some(host) = &host {
        if is_own_site(host, clues.title) || is_own_site(host, clues.feed_title) {
            return ("person", "own-site");
        }
        if names_the_site(host, clues.title) || names_the_site(host, clues.feed_title) {
            return ("publication", "site-name");
        }
    }
    let said = |words: &[&str]| {
        clues.folders.iter().any(|folder| {
            folder
                .split(|letter: char| !letter.is_alphanumeric())
                .any(|word| words.contains(&word.to_lowercase().as_str()))
        })
    };
    if said(PEOPLE_FOLDERS) {
        ("person", "folder")
    } else if said(PUBLICATION_FOLDERS) {
        ("publication", "folder")
    } else {
        ("publication", "unsure-no-names")
    }
}

/// Words of a magazine's or a paper's name: after someone's name, they make
/// it the publication's ("Harper's Magazine"), never the person's.
const MAGAZINE_WORDS: &[&str] = &[
    "magazine",
    "news",
    "journal",
    "review",
    "times",
    "daily",
    "weekly",
    "digest",
    "press",
    "media",
    "report",
    "gazette",
    "post",
    "tribune",
    "herald",
    "quarterly",
    "health",
    "life",
];

/// Words that are never part of someone's name: a publication's ("The",
/// "Notes", "Studio") or an everyday word a title is often made of ("Men's
/// Health", "Reader's Digest", "Bleeping Computer").
const NOT_NAME_WORDS: &[&str] = &[
    "the",
    "a",
    "an",
    "of",
    "and",
    "blog",
    "notes",
    "letters",
    "podcast",
    "show",
    "studio",
    "labs",
    "men",
    "women",
    "man",
    "woman",
    "reader",
    "readers",
    "today",
    "world",
    "nature",
    "children",
    "kids",
    "people",
    "everyone",
    "everybody",
    "nobody",
    "god",
    "earth",
    "america",
    "nation",
    "city",
    "year",
    "week",
    "day",
    "writer",
    "writers",
    "editor",
    "editors",
    "mother",
    "father",
    "mom",
    "dad",
    "baby",
    "cook",
    "chef",
    "nerd",
    "geek",
    "programmer",
    "developer",
    "hacker",
    "maker",
    "design",
    "designer",
    "science",
    "computer",
    "computing",
    "tech",
    "technology",
    "games",
    "game",
    "sports",
    "guide",
    "wire",
    "insider",
    "central",
    "hub",
    "online",
    "network",
    "radio",
    "tv",
    "living",
    "home",
    "kitchen",
    "garden",
    "world's",
];

/// One to three capitalised words that could be someone's name: none of them
/// a magazine's word or an everyday one ("Jim Nielsen", never "The Verge",
/// "Low-tech Magazine" or "Bleeping Computer").
fn reads_as_a_name(words: &[&str]) -> bool {
    (1..=3).contains(&words.len())
        && words.iter().all(|word| {
            let lower = word.to_lowercase();
            word.starts_with(char::is_uppercase)
                && !MAGAZINE_WORDS.contains(&lower.as_str())
                && !NOT_NAME_WORDS.contains(&lower.as_str())
        })
}

/// Letters and digits only, lower case: "Jane Doe" and "janedoe" alike.
fn squashed(text: &str) -> String {
    text.chars()
        .filter(|letter| letter.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

/// The site's own name, the part of its address before the ending
/// (`nasa` in apod.nasa.gov).
fn site_name(host: &str) -> Option<&str> {
    let parts: Vec<&str> = host.split('.').collect();
    parts
        .len()
        .checked_sub(2)
        .and_then(|at| parts.get(at))
        .copied()
}

/// A site of someone's own: a place of theirs on a site many people share
/// (a Substack, a Bluesky account), a title that says it's someone's
/// ("Jim Nielsen's Blog"), or an address made of the title's words run
/// together (janedoe.com for "Jane Doe").
fn is_own_site<'a>(host: &str, title: &'a str) -> bool {
    let shared = PERSONAL_SITES
        .iter()
        .any(|shared| host == *shared || host.ends_with(&format!(".{shared}")));
    let words: Vec<&str> = title
        .split(|letter: char| !letter.is_alphanumeric() && letter != '\'' && letter != '\u{2019}')
        .filter(|word| !word.is_empty())
        .collect();
    // Someone's name said as theirs, first in the title: "Jim Nielsen's
    // Writing", never "The World's Best", "Men's Health" or "Harper's Magazine".
    let possessive = |word: &'a str| {
        word.strip_suffix("'s")
            .or_else(|| word.strip_suffix("\u{2019}s"))
    };
    let theirs = words
        .iter()
        .position(|word| possessive(word).is_some())
        .is_some_and(|at| {
            let mut name: Vec<&str> = words[..at].to_vec();
            name.extend(possessive(words[at]));
            reads_as_a_name(&name)
                && !words[at + 1..]
                    .iter()
                    .any(|word| MAGAZINE_WORDS.contains(&word.to_lowercase().as_str()))
        });
    let name = site_name(host).unwrap_or_default();
    let lower = title.to_lowercase();
    let named_theirs = !name.is_empty()
        && (lower.contains(&format!("{name}'s")) || lower.contains(&format!("{name}\u{2019}s")));
    // Only when the title reads as a name of two or three words.
    let run_together =
        words.len() > 1 && reads_as_a_name(&words) && squashed(name) == squashed(title);
    shared || theirs || named_theirs || run_together
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
/// title, as a publication's is. A site of someone's own (`is_own_site`) is
/// sorted before this is asked.
fn names_the_site(host: &str, title: &str) -> bool {
    let Some(name) = site_name(host) else {
        return false;
    };
    let words: Vec<String> = title
        .split(|letter: char| !letter.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_lowercase)
        .collect();
    words.len() > 1 && words.iter().any(|word| word == name)
}

/// Settles one of reader `person`'s places as `kind`, for `why`: what the
/// reader chose (`None`, kept as "reader"), or the reason Undo puts back.
/// Only a place on its own and still followed: one joined to others is a
/// person whatever it says.
pub async fn settle(
    connection: &mut SqliteConnection,
    person: i64,
    feed: i64,
    kind: Kind,
    why: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE subscriptions SET kind = ?, kind_why = COALESCE(?, 'reader')
         WHERE person_id = ? AND feed_id = ? AND writer_id IS NULL AND unsubscribed_at IS NULL",
    )
    .bind(kind.name())
    .bind(why)
    .bind(person)
    .bind(feed)
    .execute(connection)
    .await
    .map(|_| ())
}

/// Sorts, and keeps, each of the reader's places that has no kind or no
/// source kind yet, once it has been fetched: an imported feed waits for its
/// first check, so the guess sees its authors and episodes (and the folders
/// the import made first). `only` is a feed just added, whose articles were
/// stored then, so it's sorted at once. Their choices stay as they made
/// them. A place first sorted a person by its one name is called by that
/// name (`name_by_author`).
pub async fn fill(
    connection: &mut SqliteConnection,
    person: i64,
    only: Option<i64>,
) -> Result<(), sqlx::Error> {
    type Waiting = (i64, String, Option<String>, String, String, bool, bool);
    let waiting: Vec<Waiting> = sqlx::query_as(
        "SELECT feeds.id, feeds.url, feeds.site_url, subscriptions.title, feeds.title,
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
    for (feed, url, site, title, feed_title, unguessed, has_episodes) in waiting {
        let authors: Vec<String> = sqlx::query_scalar(
            "SELECT trim(author) FROM articles
             WHERE feed_id = ? AND trim(COALESCE(author, '')) != ''
             GROUP BY trim(author) ORDER BY MAX(id) DESC LIMIT 10",
        )
        .bind(feed)
        .fetch_all(&mut *connection)
        .await?;
        let folders: Vec<String> = sqlx::query_scalar(
            "SELECT folders.name FROM feed_folders JOIN folders ON folders.id = feed_folders.folder_id
             WHERE folders.person_id = ? AND feed_folders.feed_id = ?",
        )
        .bind(person)
        .bind(feed)
        .fetch_all(&mut *connection)
        .await?;
        let (kind, why) = kind_from(&Clues {
            authors: &authors,
            url: &url,
            site: site.as_deref(),
            title: &title,
            feed_title: &feed_title,
            folders: &folders,
        });
        sqlx::query(
            "UPDATE subscriptions SET kind = COALESCE(kind, ?),
                 kind_why = CASE WHEN kind IS NULL THEN ? ELSE kind_why END,
                 place = COALESCE(place, ?)
             WHERE person_id = ? AND feed_id = ?",
        )
        .bind(kind)
        .bind(why)
        .bind(place_from(&url, has_episodes))
        .bind(person)
        .bind(feed)
        .execute(&mut *connection)
        .await?;
        if unguessed && why == "one-name" {
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

    /// Sorts a place from its authors, address, site, title and folders.
    fn sort(
        authors: &[&str],
        url: &str,
        site: Option<&str>,
        title: &str,
        folders: &[&str],
    ) -> (&'static str, &'static str) {
        kind_from(&Clues {
            authors: &names(authors),
            url,
            site,
            title,
            feed_title: title,
            folders: &names(folders),
        })
    }

    #[test]
    fn a_youtube_channel_could_be_either() {
        let feed = "https://www.youtube.com/feeds/videos.xml?channel_id=UC123";
        assert_eq!(
            sort(
                &["Sony LIV"],
                feed,
                Some("https://www.youtube.com/channel/UC123"),
                "Sony LIV",
                &[]
            ),
            ("publication", "unsure-channel")
        );
    }

    #[test]
    fn several_names_are_a_publication() {
        let url = "https://example.com/feed";
        assert_eq!(
            sort(&["Jane", "Kai"], url, None, "Example", &[]),
            ("publication", "several-names")
        );
        // A role beside a name isn't a second name, nor counts against it.
        assert_eq!(
            sort(&["Jane Doe", "admin"], url, None, "Example", &[]),
            ("person", "one-name")
        );
    }

    #[test]
    fn one_persons_name_is_a_person() {
        let url = "https://example.com/feed";
        assert_eq!(
            sort(&["Jane Doe", " jane doe "], url, None, "Notes", &[]),
            ("person", "one-name")
        );
        // A role, the feed's own title or the site's own name is no one's name.
        assert_eq!(
            sort(&["admin"], url, None, "Notes", &[]).1,
            "unsure-no-names"
        );
        assert_eq!(
            sort(
                &["NASA"],
                "https://apod.nasa.gov/apod.rss",
                None,
                "NASA Picture of the Day",
                &[]
            )
            .1,
            "site-name"
        );
        assert_eq!(
            sort(
                &["The Verge"],
                "https://www.theverge.com/rss",
                None,
                "The Verge",
                &[]
            )
            .1,
            "unsure-no-names"
        );
        assert_eq!(
            sort(&["Example"], url, None, "Notes", &[]).1,
            "unsure-no-names"
        );
        // Their own name as their blog's title is still theirs.
        assert_eq!(
            sort(
                &["Julia Evans"],
                "https://jvns.ca/atom.xml",
                None,
                "Julia Evans",
                &[]
            ),
            ("person", "one-name")
        );
    }

    #[test]
    fn a_site_of_someones_own_is_a_person() {
        let none: &[&str] = &[];
        for (url, title) in [
            ("https://jane.substack.com/feed", "Letters"),
            ("https://janedoe.com/feed", "Jane Doe"),
            ("https://jim.example/feed", "Jim Nielsen's Blog"),
            ("https://jk.example/feed", "Jeff Kaufman\u{2019}s Writing"),
            ("https://alpha.example/feed", "alpha's blog"),
            ("https://blog.jim-nielsen.com/feed", "Jim Nielsen"),
        ] {
            assert_eq!(
                sort(none, url, None, title, &[]),
                ("person", "own-site"),
                "{title}"
            );
        }
        // Their one name as the title, at their own address, is theirs too.
        assert_eq!(
            sort(
                &["Jane Doe"],
                "https://janedoe.com/feed",
                None,
                "Jane Doe",
                &[]
            ),
            ("person", "one-name")
        );
        // A name said as a magazine's, or an everyday word's, is no one's.
        for (url, title) in [
            ("https://harpers.org/feed/", "Harper's Magazine"),
            ("https://www.menshealth.com/rss/", "Men's Health"),
            ("https://www.rd.com/feed/", "Reader's Digest"),
            ("https://example.com/feed", "Today's Picks"),
            ("https://example.com/feed", "The World's Best Notes"),
            (
                "https://www.bleepingcomputer.com/feed/",
                "Bleeping Computer",
            ),
        ] {
            assert_ne!(sort(none, url, None, title, &[]).1, "own-site", "{title}");
        }
        // A magazine at its own name run together is the magazine's.
        assert_eq!(
            sort(
                none,
                "https://solar.lowtechmagazine.com/posts/index.xml",
                None,
                "Low-tech Magazine",
                &[]
            )
            .1,
            "unsure-no-names"
        );
        // "The world's" is no one's.
        assert_eq!(
            sort(
                none,
                "https://example.com/feed",
                None,
                "The world's best notes",
                &[]
            )
            .1,
            "unsure-no-names"
        );
    }

    #[test]
    fn a_site_named_in_its_title_is_a_publication() {
        assert_eq!(
            sort(
                &[],
                "https://apod.nasa.gov/apod.rss",
                Some("https://apod.nasa.gov/"),
                "NASA Picture of the Day",
                &[]
            ),
            ("publication", "site-name")
        );
    }

    #[test]
    fn a_folder_it_came_in_can_say() {
        let url = "https://example.com/rss";
        assert_eq!(
            sort(&[], url, None, "Notes", &["My Friends"]),
            ("person", "folder")
        );
        assert_eq!(
            sort(&[], url, None, "Notes", &["Tech news"]),
            ("publication", "folder")
        );
        // A whole word only.
        assert_eq!(
            sort(&[], url, None, "Notes", &["Newsletters"]).1,
            "unsure-no-names"
        );
        // A name in the feed wins over the folder.
        assert_eq!(
            sort(&["Jane Doe"], url, None, "Notes", &["News"]),
            ("person", "one-name")
        );
    }

    #[test]
    fn with_nothing_to_go_on_it_could_be_either() {
        assert_eq!(
            sort(&[], "https://example.com/rss", None, "Notes", &[]),
            ("publication", "unsure-no-names")
        );
        assert_eq!(
            sort(&[], "not an address", None, "Notes", &[]).1,
            "unsure-no-names"
        );
    }

    #[test]
    fn every_reason_is_one_the_app_knows() {
        for why in [
            "one-name",
            "own-site",
            "several-names",
            "site-name",
            "folder",
            "unsure-no-names",
            "unsure-channel",
        ] {
            assert!(WHYS.contains(&why));
        }
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
