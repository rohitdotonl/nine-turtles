//! The blog checkup on the website (SPEC section 43, decision 0178): a
//! writer gives their blog's address and sees what a feed reader sees of it:
//! its feed, their name in it, and the ways a reader can write to them, at
//! three levels (a contact page is enough, an email address in the feed is
//! best, "Reply by email" on each post is optional).
//!
//! It looks as the feed finder does (`finder`, `lookup`), under the same
//! memory and limits, and then once at the writer's site the way Write back
//! does (`write_back::site`, decision 0168): its home page (the page given,
//! when that is the home page, isn't fetched again) and, only if the home
//! page shows no address, the one contact or about page it links to. Never
//! an article's page. Nothing about who asked is kept.

use std::time::Duration;

use axum::{
    Router,
    extract::{Query, State},
    response::Response,
    routing::get,
};
use feed_rs::model::Feed;
use reqwest::Url;
use serde::{Deserialize, Serialize};

use crate::{
    AppState, feed,
    fetch::{self, Fetched},
    finder::{self, Answer, Problem},
    lookup::{self, Looked, NotFound},
    write_back::{self, Named, site},
};

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/checkup", get(check))
}

/// The longest the visit to the writer's site may take, both pages together.
const LOOKING_FOR: Duration = Duration::from_secs(8);
/// The longest name or title passed on.
const LONGEST: usize = 300;

/// What the checkup found, as the website shows it.
#[derive(Clone, Debug, Default, Serialize, PartialEq, Eq)]
pub struct Checkup {
    /// The blog's feed, if one was found.
    pub feed: Option<FeedSeen>,
    /// The writer's name, as the feed gives it.
    pub name: Option<String>,
    /// The address the feed gives for its writer (the best way).
    pub email_in_feed: Option<String>,
    /// The feed's articles name several people's addresses (a magazine).
    pub several_in_feed: bool,
    /// The address a "Reply by email" link in the posts gives.
    pub reply_in_posts: Option<String>,
    /// The contact (or about) page the home page links to, and whether the
    /// home page or that page shows an email address. Only whether: the
    /// writer knows their own, and the checkup mustn't hand out addresses a
    /// site hid from bots.
    pub contact_page: Option<String>,
    pub address_on_site: bool,
    /// Whether the site could be looked at for a contact page.
    pub site_looked: bool,
    /// Which blog platform it seems to be, for showing its fixes first.
    pub platform: Option<Platform>,
    /// The site the feed names, where the writer's site starts.
    #[serde(skip)]
    site: Option<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct FeedSeen {
    pub title: String,
    pub url: String,
    /// Its newest post's date, seconds since 1970 (UTC).
    pub newest: Option<i64>,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    BearBlog,
    WordPress,
    Ghost,
    MicroBlog,
    Hugo,
    Jekyll,
    Eleventy,
}

#[derive(Deserialize)]
struct Asked {
    #[serde(default)]
    address: String,
}

async fn check(State(state): State<AppState>, Query(asked): Query<Asked>) -> Response {
    let state = &state;
    let answer = finder::guarded(state, "checkup ", &asked.address, |url| async move {
        match look(state, &url).await {
            Ok(checkup) => Answer::Checked(Box::new(checkup)),
            Err(problem) => Answer::Problem(problem),
        }
    })
    .await;
    finder::for_website(match answer {
        Ok(Answer::Checked(checkup)) => Ok(*checkup),
        Ok(Answer::Problem(problem)) | Err(problem) => Err(problem),
        // Never: the checkup's answers are kept apart from the finder's.
        Ok(Answer::Found(_)) => Err(Problem::Busy),
    })
}

/// The page given, fetched once: its feed found as the finder finds it,
/// then the writer's site looked at for a contact page.
async fn look(state: &AppState, url: &Url) -> Result<Checkup, Problem> {
    let local = state.config.local_feeds_allowed;
    let fetched = fetch::get(&state.http, url, local).await?;
    // The page given, kept if it's a web page, so the home page isn't fetched twice.
    let given = (feed::parse(&fetched.body, &fetched.final_url).is_none())
        .then(|| (page_text(&fetched), fetched.final_url.clone()));
    let mut checkup = match lookup::look_at(state, fetched, true).await {
        Ok(Looked::Feed(fetched, _)) => read_feed(&fetched),
        Ok(Looked::Feeds(choices)) => choices
            .into_iter()
            .find_map(|choice| choice.fetched)
            .map(|fetched| read_feed(&fetched))
            .unwrap_or_default(),
        Err(NotFound::NoFeed) => Checkup::default(),
        Err(NotFound::Fetch(error)) => return Err(error.into()),
    };
    let feed_site = checkup.site.take();
    let home = home_of(feed_site.as_deref(), given.as_ref().map(|(_, at)| at), url);
    let page = given
        .filter(|(_, at)| same_page(at, &home))
        .map(|(page, _)| page);
    if let Ok(seen) = tokio::time::timeout(LOOKING_FOR, visit(state, &home, page)).await {
        checkup.site_looked = seen.looked;
        checkup.contact_page = seen.contact.map(String::from);
        checkup.address_on_site = seen.address.is_some();
        checkup.platform = checkup.platform.or(seen.platform);
    }
    checkup.platform = checkup.platform.or_else(|| platform_of_host(&home));
    Ok(checkup)
}

/// What the feed itself says, read without fetching anything more.
fn read_feed(fetched: &Fetched) -> Checkup {
    let Some(raw) = feed::raw(&fetched.body, &fetched.final_url) else {
        return Checkup::default();
    };
    let parsed = feed::parse(&fetched.body, &fetched.final_url);
    let (email_in_feed, several_in_feed) = match write_back::named(&raw) {
        Named::One(found) => (Some(found), false),
        Named::Several => (None, true),
        Named::None => (None, false),
    };
    Checkup {
        feed: parsed.as_ref().map(|parsed| FeedSeen {
            title: parsed.title.chars().take(LONGEST).collect(),
            url: fetched.lasting_url.to_string(),
            newest: parsed.articles.iter().filter_map(|a| a.published_at).max(),
        }),
        name: name_in(&raw),
        email_in_feed,
        several_in_feed,
        reply_in_posts: write_back::in_posts(&raw),
        platform: raw
            .generator
            .as_ref()
            .and_then(|generator| platform_named(&generator.content)),
        site: parsed.and_then(|parsed| parsed.site_url),
        ..Checkup::default()
    }
}

/// The writer's name: the feed's author (or an RSS editor's, or a
/// podcast's owner), else the one name all its articles give. A name
/// that's only the blog's title doesn't count: that's no person's name.
fn name_in(feed: &Feed) -> Option<String> {
    let title = feed
        .title
        .as_ref()
        .map(|title| title.content.trim().to_lowercase());
    let named = |name: &Option<String>| {
        let name = name.as_deref()?.trim();
        // An RSS editor is written "hal@hal.example (Hal Berg)" (read as
        // the name "(Hal Berg)"); a name such as "Hal Berg (he/him)" keeps
        // its brackets.
        let name = match name.split_once('(') {
            Some((before, inside)) if before.contains('@') || before.trim().is_empty() => {
                inside.trim_end_matches(')').trim()
            }
            _ => name,
        };
        (!name.is_empty()
            && !name.contains('@')
            && title.as_deref() != Some(name.to_lowercase().as_str()))
        .then(|| name.chars().take(LONGEST).collect::<String>())
    };
    let editors = feed
        .contributors
        .iter()
        .filter(|person| matches!(person.role.as_deref(), Some("managingEditor" | "owner")));
    if let Some(found) = feed
        .authors
        .iter()
        .chain(editors)
        .find_map(|person| named(&person.name))
    {
        return Some(found);
    }
    let mut names = feed.entries.iter().flat_map(|entry| {
        entry
            .authors
            .iter()
            .filter_map(|person| named(&person.name))
    });
    let first = names.next()?;
    names.all(|other| other == first).then_some(first)
}

/// What the visit to the writer's site found.
struct Seen {
    looked: bool,
    contact: Option<Url>,
    address: Option<String>,
    platform: Option<Platform>,
}

/// The home page (`page`, when the page given was it), then, only if it
/// shows no address, the one contact or about page it links to.
async fn visit(state: &AppState, home: &Url, page: Option<String>) -> Seen {
    let local = state.config.local_feeds_allowed;
    let mut seen = Seen {
        looked: false,
        contact: None,
        address: None,
        platform: None,
    };
    let (page, at) = match page {
        Some(page) => (page, home.clone()),
        None => match site::page_at(&state.http, home, local).await {
            Ok(Some(found)) => found,
            _ => return seen,
        },
    };
    seen.looked = true;
    seen.platform = platform_in_page(&page);
    let read = site::read(&page, &at);
    seen.contact = read.next;
    seen.address = site::choose(&read.addresses, &at);
    if seen.address.is_none()
        && let Some(next) = &seen.contact
        && let Ok(Some((page, _))) = site::page_at(&state.http, next, local).await
    {
        seen.address = site::choose(&site::read(&page, next).addresses, &at);
    }
    seen
}

fn page_text(fetched: &Fetched) -> String {
    String::from_utf8_lossy(&fetched.body).into_owned()
}

/// Where the writer's site starts: the site the feed names, else the page
/// given (a writer gives their blog), else the given address's home page.
fn home_of(feed_site: Option<&str>, given: Option<&Url>, asked: &Url) -> Url {
    feed_site
        .and_then(|site| Url::parse(site).ok())
        .filter(|url| matches!(url.scheme(), "http" | "https") && url.host().is_some())
        .or_else(|| given.cloned())
        .unwrap_or_else(|| {
            let mut home = asked.clone();
            home.set_path("/");
            home.set_query(None);
            home.set_fragment(None);
            home
        })
}

/// The same page, whether or not its address ends in `/` or starts `www.`.
fn same_page(one: &Url, other: &Url) -> bool {
    let bare = |url: &Url| {
        let mut url = url.clone();
        url.set_fragment(None);
        if let Some(bare) = url.host_str().and_then(|host| host.strip_prefix("www.")) {
            let bare = bare.to_owned();
            url.set_host(Some(&bare)).ok();
        }
        url.as_str().trim_end_matches('/').to_owned()
    };
    bare(one) == bare(other)
}

/// A platform a feed's or page's "generator" names.
fn platform_named(generator: &str) -> Option<Platform> {
    let generator = generator.to_ascii_lowercase();
    [
        ("wordpress", Platform::WordPress),
        ("ghost", Platform::Ghost),
        ("micro.blog", Platform::MicroBlog),
        ("hugo", Platform::Hugo),
        ("jekyll", Platform::Jekyll),
        ("eleventy", Platform::Eleventy),
    ]
    .into_iter()
    .find(|(name, _)| generator.contains(name))
    .map(|(_, platform)| platform)
}

/// The platform a page's `<meta name="generator">` names.
fn platform_in_page(page: &str) -> Option<Platform> {
    let document = scraper::Html::parse_document(page);
    let generator =
        scraper::Selector::parse(r#"meta[name="generator" i]"#).expect("a fixed, valid selector");
    document
        .select(&generator)
        .filter_map(|meta| meta.value().attr("content"))
        .find_map(platform_named)
}

/// The platform a hosted blog's address names.
fn platform_of_host(home: &Url) -> Option<Platform> {
    let host = home.host_str()?.to_ascii_lowercase();
    [
        ("bearblog.dev", Platform::BearBlog),
        ("wordpress.com", Platform::WordPress),
        ("ghost.io", Platform::Ghost),
        ("micro.blog", Platform::MicroBlog),
    ]
    .into_iter()
    .find(|(name, _)| host == *name || host.ends_with(&format!(".{name}")))
    .map(|(_, platform)| platform)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn feed_from(xml: &str) -> Checkup {
        let url = Url::parse("https://hal.example/feed").unwrap();
        read_feed(&Fetched {
            final_url: url.clone(),
            lasting_url: url,
            content_type: "application/atom+xml".to_owned(),
            body: xml.as_bytes().to_vec(),
            etag: None,
            last_modified: None,
            fresh_for: None,
        })
    }

    #[test]
    fn a_feed_with_its_writers_name_and_address_is_seen_as_best() {
        let checkup = feed_from(
            r#"<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
            <title>Notes</title><link href="https://hal.example/"/>
            <author><name>Hal Berg</name><email>hal@hal.example</email></author>
            <generator>Hugo</generator>
            <entry><title>Tea</title><id>1</id><link href="https://hal.example/tea"/>
            <updated>2026-10-01T00:00:00Z</updated>
            <content type="html">&lt;a href="mailto:hal@hal.example?subject=Re: Tea"&gt;Reply by email&lt;/a&gt;</content></entry>
            </feed>"#,
        );
        let feed = checkup.feed.as_ref().unwrap();
        assert_eq!(feed.title, "Notes");
        assert_eq!(checkup.name.as_deref(), Some("Hal Berg"));
        assert_eq!(checkup.email_in_feed.as_deref(), Some("hal@hal.example"));
        assert_eq!(checkup.reply_in_posts.as_deref(), Some("hal@hal.example"));
        assert_eq!(checkup.platform, Some(Platform::Hugo));
        assert_eq!(checkup.site.as_deref(), Some("https://hal.example/"));
    }

    #[test]
    fn a_feed_naming_only_its_title_gives_no_name_or_address() {
        let checkup = feed_from(
            r#"<?xml version="1.0"?><rss version="2.0"><channel><title>Notes</title>
            <link>https://hal.example/</link>
            <item><title>Tea</title><link>https://hal.example/tea</link>
            <author>Notes</author></item></channel></rss>"#,
        );
        assert!(checkup.feed.is_some());
        assert_eq!(checkup.name, None);
        assert_eq!(checkup.email_in_feed, None);
        assert_eq!(checkup.reply_in_posts, None);
    }

    #[test]
    fn an_rss_editor_gives_the_name_in_brackets() {
        let checkup = feed_from(
            r#"<?xml version="1.0"?><rss version="2.0"><channel><title>Notes</title>
            <managingEditor>hal@hal.example (Hal Berg)</managingEditor>
            <item><title>Tea</title><link>https://hal.example/tea</link></item></channel></rss>"#,
        );
        assert_eq!(checkup.name.as_deref(), Some("Hal Berg"));
        assert_eq!(checkup.email_in_feed.as_deref(), Some("hal@hal.example"));
        let brackets = feed_from(
            r#"<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Notes</title>
            <author><name>Hal Berg (he/him)</name></author></feed>"#,
        );
        assert_eq!(brackets.name.as_deref(), Some("Hal Berg (he/him)"));
    }

    #[test]
    fn a_web_page_is_not_a_feed() {
        assert_eq!(
            feed_from("<html><body>Hi</body></html>"),
            Checkup::default()
        );
    }

    #[test]
    fn the_home_is_the_feeds_site_else_the_page_given() {
        let asked = Url::parse("https://hal.example/blog/tea?x=1").unwrap();
        let given = Url::parse("https://hal.example/blog/").unwrap();
        assert_eq!(
            home_of(Some("https://hal.example/"), Some(&given), &asked).as_str(),
            "https://hal.example/"
        );
        assert_eq!(
            home_of(Some("javascript:alert(1)"), Some(&given), &asked).as_str(),
            "https://hal.example/blog/"
        );
        assert_eq!(home_of(None, None, &asked).as_str(), "https://hal.example/");
        assert!(same_page(
            &Url::parse("https://hal.example/blog").unwrap(),
            &given
        ));
    }

    #[test]
    fn platforms_are_told_by_their_generator_or_address() {
        assert_eq!(
            platform_in_page(r#"<meta name="generator" content="WordPress 6.8">"#),
            Some(Platform::WordPress)
        );
        assert_eq!(
            platform_in_page(r#"<meta name="Generator" content="Ghost 5.0">"#),
            Some(Platform::Ghost)
        );
        assert_eq!(platform_in_page("<p>Hi</p>"), None);
        let bear = Url::parse("https://hal.bearblog.dev/").unwrap();
        assert_eq!(platform_of_host(&bear), Some(Platform::BearBlog));
        let own = Url::parse("https://notbearblog.dev/").unwrap();
        assert_eq!(platform_of_host(&own), None);
    }
}
