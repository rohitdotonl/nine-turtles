//! Finding a site's feeds: the one lookup Add a feed, "Follow this person?"
//! and the website's feed finder share (SPEC sections 3 and 30, decisions
//! 0016 and 0163).
//!
//! It fetches the address the reader gave. A feed is its own answer; a web
//! page is read for the feeds it names (`discover`). If the page names none,
//! a few more places are tried, one at a time, stopping at the first that
//! works (`elsewhere`): the usual feed addresses under the page, the site's
//! home page, and the usual addresses at the top of the site. All of it
//! happens only because someone asked, once, never in the background, and
//! never on an article's page.
//!
//! When there are several feeds, each is looked at once, one after another
//! (`look_inside`), so the reader can see how often it posts and what it
//! posted last: repeats (the same posts in another format) and feeds that
//! aren't there are left out.

use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};

use reqwest::Url;

use crate::{
    AppState, discover, feed,
    fetch::{self, FetchError, Fetched},
    frequency,
};

/// The most addresses tried beyond the page the reader gave.
const MOST_TRIED: usize = 10;
/// The usual feed addresses, most common first, from a count of feed
/// addresses across the small web (Marginalia's crawl, as tallied at
/// jamesg.blog/2025/03/08/common-paths-for-web-feeds): WordPress and Ghost
/// (`feed`), Jekyll (`feed.xml`), Hugo (`index.xml`), Wix
/// (`blog-feed.xml`), Blogger (`feeds/posts/default`) and hand-made sites.
const USUAL: &[&str] = &[
    "feed",
    "feed.xml",
    "rss",
    "rss.xml",
    "index.xml",
    "atom.xml",
    "blog-feed.xml",
    "feeds/posts/default",
];
/// Under a page inside a site, only the most common.
const USUAL_UNDER: &[&str] = &["feed"];
/// How long looking inside a site's feeds may take, all together; feeds not
/// reached by then are still offered, by name and address.
const LOOKING_INSIDE_FOR: Duration = Duration::from_secs(12);
/// The longest name or title passed on.
const LONGEST_TITLE: usize = 300;

/// What a lookup found.
pub enum Looked {
    /// One feed, fetched and read.
    Feed(Box<Fetched>, Box<feed::ParsedFeed>),
    /// Several feeds the site names, for the reader to choose from.
    Feeds(Vec<Choice>),
}

/// One of several feeds a site offers.
pub struct Choice {
    pub found: discover::Found,
    /// What was found inside it, if it was reached in time.
    pub inside: Option<Inside>,
    /// The feed as fetched then, so following it needn't fetch it again.
    pub fetched: Option<Box<Fetched>>,
}

impl Choice {
    /// A feed known only by the name and address the page gave it.
    const fn named(found: discover::Found) -> Self {
        Self {
            found,
            inside: None,
            fetched: None,
        }
    }
}

/// What a look inside a feed shows the reader.
#[derive(Default)]
pub struct Inside {
    /// "Posts about twice a week", if its articles say when they were posted.
    pub posting: Option<String>,
    /// Its newest article's title, if it has one.
    pub latest: Option<String>,
}

/// Why nothing could be followed.
#[derive(Debug)]
pub enum NotFound {
    /// The address itself couldn't be fetched.
    Fetch(FetchError),
    /// The page and the usual places name no feed.
    NoFeed,
}

impl From<FetchError> for NotFound {
    fn from(error: FetchError) -> Self {
        Self::Fetch(error)
    }
}

/// Looks up `url`. With `inside`, a site's several feeds are each looked
/// at, and a site left with one is answered as that feed; without it (other
/// apps, which follow the first feed anyway), they're only named.
pub async fn look(state: &AppState, url: &Url, inside: bool) -> Result<Looked, NotFound> {
    let local = state.config.local_feeds_allowed;
    let fetched = fetch::get(&state.http, url, local).await?;
    if let Some(parsed) = feed::parse(&fetched.body, &fetched.final_url) {
        return Ok(Looked::Feed(Box::new(fetched), Box::new(parsed)));
    }
    let page = String::from_utf8_lossy(&fetched.body);
    let mut found = discover::feeds_in(&page, &fetched.final_url);
    if found.is_empty() {
        match elsewhere(state, &fetched.final_url).await {
            Some(Elsewhere::Feed(fetched, parsed)) => return Ok(Looked::Feed(fetched, parsed)),
            Some(Elsewhere::Named(named)) => found = named,
            None => return Err(NotFound::NoFeed),
        }
    }
    if !inside || found.len() == 1 {
        return Ok(Looked::Feeds(
            found.into_iter().map(Choice::named).collect(),
        ));
    }
    let mut choices = look_inside(state, found).await;
    if let [only] = choices.as_mut_slice()
        && let Some(fetched) = only.fetched.take()
        && let Some(parsed) = feed::parse(&fetched.body, &fetched.final_url)
    {
        return Ok(Looked::Feed(fetched, Box::new(parsed)));
    }
    if choices.is_empty() {
        return Err(NotFound::NoFeed);
    }
    Ok(Looked::Feeds(choices))
}

/// What one of the other places gave.
enum Elsewhere {
    Feed(Box<Fetched>, Box<feed::ParsedFeed>),
    /// The home page named these.
    Named(Vec<discover::Found>),
}

/// Tries the other places for a page naming no feed, in order, one at a
/// time. A site that asks to slow down, or stops answering, isn't asked
/// again; an address that isn't there (or isn't a feed) moves on to the next.
async fn elsewhere(state: &AppState, page: &Url) -> Option<Elsewhere> {
    let local = state.config.local_feeds_allowed;
    for place in places(page) {
        let fetched = match fetch::get(&state.http, &place, local).await {
            Ok(fetched) => fetched,
            Err(FetchError::SlowDown(_) | FetchError::Unreachable) => return None,
            Err(_) => continue,
        };
        if let Some(parsed) = feed::parse(&fetched.body, &fetched.final_url) {
            return Some(Elsewhere::Feed(Box::new(fetched), Box::new(parsed)));
        }
        if place.path() == "/" {
            let named =
                discover::feeds_in(&String::from_utf8_lossy(&fetched.body), &fetched.final_url);
            if !named.is_empty() {
                return Some(Elsewhere::Named(named));
            }
        }
    }
    None
}

/// The places tried for a page naming no feed, in order: the usual
/// addresses under the page (so a blog inside a bigger site finds its own
/// feed first), the site's home page, then the usual addresses at its top.
/// Never more than `MOST_TRIED`, and never the page itself again.
fn places(page: &Url) -> Vec<Url> {
    let mut places: Vec<Url> = Vec::new();
    let mut add = |path: &str| {
        let mut place = page.clone();
        place.set_path(path);
        place.set_query(None);
        place.set_fragment(None);
        if place != *page && !places.contains(&place) && places.len() < MOST_TRIED {
            places.push(place);
        }
    };
    let under = page.path().trim_end_matches('/');
    // A page that looks like a file (`/about.html`) has nothing under it.
    let last = under.rsplit('/').next().unwrap_or_default();
    if !under.is_empty() && !last.contains('.') {
        for usual in USUAL_UNDER {
            add(&format!("{under}/{usual}"));
        }
    }
    add("/");
    for usual in USUAL {
        add(&format!("/{usual}"));
    }
    places
}

/// Looks inside each of a site's feeds, one at a time, for at most
/// `LOOKING_INSIDE_FOR` in all. A feed that isn't there, or isn't a feed,
/// is left out, as is one with the same newest posts as a feed before it
/// (the same posts in another format). Feeds not reached are kept as named.
async fn look_inside(state: &AppState, found: Vec<discover::Found>) -> Vec<Choice> {
    let local = state.config.local_feeds_allowed;
    let until = Instant::now() + LOOKING_INSIDE_FOR;
    let now = crate::now();
    let mut choices: Vec<Choice> = Vec::new();
    let mut seen: Vec<Vec<String>> = Vec::new();
    let mut stopped = false;
    for found in found {
        let left = until.saturating_duration_since(Instant::now());
        if stopped || left.is_zero() {
            choices.push(Choice::named(found));
            continue;
        }
        let fetched =
            match tokio::time::timeout(left, fetch::get(&state.http, &found.url, local)).await {
                Ok(Ok(fetched)) => fetched,
                Ok(Err(FetchError::Status(_) | FetchError::TooBig | FetchError::NotAllowed)) => {
                    continue;
                }
                Ok(Err(FetchError::SlowDown(_) | FetchError::Unreachable)) | Err(_) => {
                    stopped = true;
                    choices.push(Choice::named(found));
                    continue;
                }
            };
        let Some(parsed) = feed::parse(&fetched.body, &fetched.final_url) else {
            continue;
        };
        let newest = newest_links(&parsed);
        if !newest.is_empty() && seen.contains(&newest) {
            continue;
        }
        seen.push(newest);
        let inside = Inside {
            posting: frequency::of_dates(
                parsed
                    .articles
                    .iter()
                    .filter_map(|article| article.published_at),
                now,
            ),
            latest: newest_title(&parsed),
        };
        choices.push(Choice {
            found,
            inside: Some(inside),
            fetched: Some(Box::new(fetched)),
        });
    }
    choices
}

/// The links of a feed's three newest posts, sorted, to tell two formats of
/// the same feed apart from two different feeds.
fn newest_links(parsed: &feed::ParsedFeed) -> Vec<String> {
    let mut articles: Vec<&feed::ParsedArticle> = parsed.articles.iter().collect();
    articles.sort_by_key(|article| std::cmp::Reverse(article.published_at));
    let mut links: Vec<String> = articles
        .into_iter()
        .filter_map(|article| article.link.clone())
        .take(3)
        .collect();
    links.sort();
    links
}

fn newest_title(parsed: &feed::ParsedFeed) -> Option<String> {
    parsed
        .articles
        .iter()
        .filter(|article| !article.title.trim().is_empty())
        .max_by_key(|article| article.published_at)
        .map(|article| article.title.chars().take(LONGEST_TITLE).collect())
}

/// A feed's address as a person says it: `maralind.example/feed`, without
/// `https://`, `www.` or a closing `/`.
pub fn said(url: &Url) -> String {
    let host = url.host_str().unwrap_or_default();
    let host = host.strip_prefix("www.").unwrap_or(host);
    let mut said = format!("{host}{}", url.path().trim_end_matches('/'));
    if let Some(query) = url.query() {
        said.push('?');
        said.push_str(query);
    }
    said
}

/// Feeds a lookup just fetched for a reader choosing among several, kept a
/// few minutes so following the one chosen needn't ask the publisher again.
#[derive(Default)]
pub struct Recent {
    kept: Mutex<HashMap<String, (Instant, Fetched)>>,
}

/// How long a looked-at feed is kept, and how many are.
const KEPT_FOR: Duration = Duration::from_secs(10 * 60);
const KEPT_MOST: usize = 100;

impl Recent {
    /// Keeps `fetched`, the feed at `url`.
    pub fn keep(&self, url: &Url, fetched: Fetched) {
        let Ok(mut kept) = self.kept.lock() else {
            return;
        };
        let now = Instant::now();
        kept.retain(|_, (at, _)| now.saturating_duration_since(*at) < KEPT_FOR);
        if kept.len() >= KEPT_MOST {
            return;
        }
        kept.insert(url.as_str().to_owned(), (now, fetched));
    }

    /// The feed at `url`, if it was looked at in the last few minutes; it's
    /// handed over once.
    pub fn take(&self, url: &Url) -> Option<Fetched> {
        let mut kept = self.kept.lock().ok()?;
        let (at, fetched) = kept.remove(url.as_str())?;
        (at.elapsed() < KEPT_FOR).then_some(fetched)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tried(page: &str) -> Vec<String> {
        places(&Url::parse(page).unwrap())
            .into_iter()
            .map(String::from)
            .collect()
    }

    #[test]
    fn a_home_page_tries_the_usual_addresses() {
        assert_eq!(
            tried("https://example.com/"),
            [
                "https://example.com/feed",
                "https://example.com/feed.xml",
                "https://example.com/rss",
                "https://example.com/rss.xml",
                "https://example.com/index.xml",
                "https://example.com/atom.xml",
                "https://example.com/blog-feed.xml",
                "https://example.com/feeds/posts/default",
            ]
        );
    }

    #[test]
    fn a_page_inside_a_site_tries_under_itself_first_then_the_home_page() {
        let places = tried("https://medium.com/@someone/?source=x#top");
        assert_eq!(
            places[..2],
            ["https://medium.com/@someone/feed", "https://medium.com/"]
        );
        assert_eq!(places.len(), MOST_TRIED);
        assert!(places.len() <= MOST_TRIED);
    }

    #[test]
    fn a_file_has_nothing_under_it() {
        assert_eq!(
            tried("https://example.com/about.html")[0],
            "https://example.com/"
        );
    }

    #[test]
    fn addresses_are_said_as_a_person_would() {
        let said = |text: &str| said(&Url::parse(text).unwrap());
        assert_eq!(
            said("https://www.maralind.example/feed/"),
            "maralind.example/feed"
        );
        assert_eq!(
            said("http://example.com/?feed=rss2"),
            "example.com?feed=rss2"
        );
        assert_eq!(said("https://example.com/"), "example.com");
    }
}
