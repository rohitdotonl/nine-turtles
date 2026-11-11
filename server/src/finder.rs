//! The feed finder on the website (SPEC section 30, decision 0099): anyone,
//! signed in or not, gives the address of a site and gets back the feeds the
//! page names, with the newest few titles of the first one.
//!
//! It looks exactly as adding a feed does (`lookup`, decisions 0016 and
//! 0165): the page given, a few usual places if it names no feed, and each
//! of a site's several feeds once, never an article's page. The first feed
//! gives the preview.
//!
//! Nothing about who asked is kept or written to the log. An answer is
//! remembered in memory for half an hour (a failure for five minutes), and
//! any one site is looked up at most `PER_SITE` times in half an hour
//! however its address is written, with limits on how many lookups run at
//! once and in a minute, so the finder can't be used to make nine turtles
//! hammer a site or itself. The blog checkup (`checkup`) runs under the
//! same memory and limits (`guarded`). The page's feeds are capped by `discover`
//! (`MOST_FEEDS`), so a page can't make an answer huge.

use std::{
    collections::{HashMap, VecDeque},
    sync::Mutex,
    time::{Duration, Instant},
};

use axum::{
    Json, Router,
    extract::{Query, State},
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::get,
};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::Semaphore;

use crate::{
    AppState, feed, feeds, fetch,
    lookup::{self, Choice, Looked, NotFound},
};

/// The website, the only other site whose pages a browser lets read the
/// finder's answers ("cross-origin resource sharing"). This stops other
/// websites using the finder from their pages; it doesn't stop a program
/// asking directly, which the limits below are for. Change it if the
/// website moves (docs/operations/website-and-domain.md).
pub const WEBSITE: &str = "https://nineturtles.app";

/// Lookups that may fetch at the same time; one more is told to wait.
const AT_ONCE: usize = 4;
/// Lookups that may fetch in a minute, from everyone together.
const PER_MINUTE: usize = 60;
/// How long an answer is remembered, and how many are.
const REMEMBERED_FOR: Duration = Duration::from_secs(30 * 60);
const FAILURE_REMEMBERED_FOR: Duration = Duration::from_secs(5 * 60);
const REMEMBERED_MOST: usize = 500;
/// Lookups that may fetch from one site (its host name) in `REMEMBERED_FOR`.
/// Each fetches the page, then at most ten other places if it names no feed
/// and at most ten feeds if it names several, one at a time; most fetch two
/// (the blog checkup, up to two more: the home page and one contact page).
const PER_SITE: usize = 6;
/// The longest article title shown in the preview.
const LONGEST_TITLE: usize = 300;
/// Titles in the preview.
const PREVIEW_ARTICLES: usize = 5;

/// The finder's memory and limits, shared by every lookup.
pub struct Finder {
    fetching: Semaphore,
    inner: Mutex<Inner>,
}

#[derive(Default)]
struct Inner {
    /// When each lookup in the last minute started.
    recent: VecDeque<Instant>,
    /// Answers by the address asked about, with when they were found.
    answers: HashMap<String, (Instant, Answer)>,
    /// When each site was looked up in the last `REMEMBERED_FOR`.
    sites: HashMap<String, VecDeque<Instant>>,
}

impl Answer {
    fn lasts(&self) -> Duration {
        match self {
            // A checkup whose site didn't answer is a failure for its contact page.
            Self::Checked(checkup) if !checkup.site_looked => FAILURE_REMEMBERED_FOR,
            Self::Address { looked: false, .. } => FAILURE_REMEMBERED_FOR,
            Self::Found(_)
            | Self::Checked(_)
            | Self::Address { .. }
            | Self::Problem(Problem::NoFeed) => REMEMBERED_FOR,
            Self::Problem(_) => FAILURE_REMEMBERED_FOR,
        }
    }
}

impl Default for Finder {
    fn default() -> Self {
        Self {
            fetching: Semaphore::new(AT_ONCE),
            inner: Mutex::default(),
        }
    }
}

impl Finder {
    fn remembered(&self, address: &str, now: Instant) -> Option<Answer> {
        let inner = self.inner.lock().ok()?;
        inner
            .answers
            .get(address)
            .filter(|(found_at, answer)| now.saturating_duration_since(*found_at) < answer.lasts())
            .map(|(_, answer)| answer.clone())
    }

    fn remember(&self, address: String, answer: Answer, now: Instant) {
        let Ok(mut inner) = self.inner.lock() else {
            return;
        };
        inner.answers.retain(|_, (found_at, answer)| {
            now.saturating_duration_since(*found_at) < answer.lasts()
        });
        if inner.answers.len() >= REMEMBERED_MOST {
            // Full of fresh answers: forget the oldest one.
            let oldest = inner
                .answers
                .iter()
                .min_by_key(|(_, (found_at, _))| *found_at)
                .map(|(address, _)| address.clone());
            if let Some(oldest) = oldest {
                inner.answers.remove(&oldest);
            }
        }
        inner.answers.insert(address, (now, answer));
    }

    /// Counts a lookup of `site` at `now`, or says which limit is used up.
    pub(crate) fn try_one(&self, site: &str, now: Instant) -> Result<(), Problem> {
        let Ok(mut inner) = self.inner.lock() else {
            return Err(Problem::Busy);
        };
        while inner
            .recent
            .front()
            .is_some_and(|started| now.saturating_duration_since(*started) >= MINUTE)
        {
            inner.recent.pop_front();
        }
        if inner.recent.len() >= PER_MINUTE {
            return Err(Problem::Busy);
        }
        inner.sites.retain(|_, times| {
            while times
                .front()
                .is_some_and(|at| now.saturating_duration_since(*at) >= REMEMBERED_FOR)
            {
                times.pop_front();
            }
            !times.is_empty()
        });
        let times = inner.sites.entry(site.to_owned()).or_default();
        if times.len() >= PER_SITE {
            return Err(Problem::SiteBusy);
        }
        times.push_back(now);
        inner.recent.push_back(now);
        Ok(())
    }
}

const MINUTE: Duration = Duration::from_secs(60);

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/find-feeds", get(find_feeds))
}

#[derive(Deserialize)]
struct Asked {
    #[serde(default)]
    address: String,
}

/// What the finder found, as the website shows it.
#[derive(Clone, Debug, Serialize)]
pub struct Found {
    feeds: Vec<FeedLink>,
    preview: Option<Preview>,
}

#[derive(Clone, Debug, Serialize)]
struct FeedLink {
    title: String,
    url: String,
    /// Its newest title, when the site has several.
    latest: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
struct Preview {
    title: String,
    /// The publisher's website, if the feed names one.
    site: Option<String>,
    articles: Vec<Article>,
}

#[derive(Clone, Debug, Serialize)]
struct Article {
    title: String,
    /// The article on the publisher's website.
    link: Option<String>,
    /// Seconds since 1970 (UTC), as the feed says.
    published: Option<i64>,
}

/// The publisher's answer: worth remembering for a while either way.
#[derive(Clone, Debug)]
pub(crate) enum Answer {
    Found(Found),
    /// The blog checkup's (`checkup`).
    Checked(Box<crate::checkup::Checkup>),
    /// Ask them for a feed's (`write_back::unfollowed`): the address their site gives, and whether it was looked at.
    Address {
        address: Option<String>,
        looked: bool,
    },
    Problem(Problem),
}

/// Why nothing was found, in words the website turns into a sentence.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Problem {
    NotAnAddress,
    NotAllowed,
    Unreachable,
    /// The site's guard against bots turned nine turtles away (decision 0255).
    Blocked,
    PageNotFound,
    TooBig,
    NoFeed,
    Busy,
    /// This one site has been looked up `PER_SITE` times lately.
    SiteBusy,
}

impl From<fetch::FetchError> for Problem {
    fn from(error: fetch::FetchError) -> Self {
        match error {
            fetch::FetchError::NotAllowed => Self::NotAllowed,
            fetch::FetchError::Status(404 | 410) => Self::PageNotFound,
            fetch::FetchError::TooBig => Self::TooBig,
            fetch::FetchError::Blocked => Self::Blocked,
            fetch::FetchError::Unreachable
            | fetch::FetchError::Status(_)
            | fetch::FetchError::SlowDown(_) => Self::Unreachable,
        }
    }
}

async fn find_feeds(State(state): State<AppState>, Query(asked): Query<Asked>) -> Response {
    let state = &state;
    let answer = guarded(state, "", &asked.address, |url| async move {
        look(state, &url).await.unwrap_or_else(Answer::Problem)
    })
    .await;
    for_website(match answer {
        Ok(Answer::Found(found)) => Ok(found),
        Ok(Answer::Problem(problem)) | Err(problem) => Err(problem),
        // Never: the finder's answers are kept apart from the checkup's.
        Ok(Answer::Checked(_) | Answer::Address { .. }) => Err(Problem::Busy),
    })
}

/// The answer as the website reads it: found, or a problem's name with its
/// status; readable only from the website's own pages.
pub(crate) fn for_website(answer: Result<impl Serialize, Problem>) -> Response {
    let mut response = match answer {
        Ok(found) => Json(found).into_response(),
        Err(problem) => {
            let (status, error) = match problem {
                Problem::NotAnAddress => (StatusCode::BAD_REQUEST, "not-an-address"),
                Problem::NotAllowed => (StatusCode::BAD_REQUEST, "not-allowed"),
                Problem::Unreachable => (StatusCode::BAD_GATEWAY, "unreachable"),
                Problem::Blocked => (StatusCode::BAD_GATEWAY, "blocked"),
                Problem::PageNotFound => (StatusCode::BAD_GATEWAY, "not-found"),
                Problem::TooBig => (StatusCode::BAD_GATEWAY, "too-big"),
                Problem::NoFeed => (StatusCode::UNPROCESSABLE_ENTITY, "no-feed"),
                Problem::Busy => (StatusCode::TOO_MANY_REQUESTS, "busy"),
                Problem::SiteBusy => (StatusCode::TOO_MANY_REQUESTS, "site-busy"),
            };
            (status, Json(json!({ "error": error }))).into_response()
        }
    };
    let headers = response.headers_mut();
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        HeaderValue::from_static(WEBSITE),
    );
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

/// Runs one of the website's lookups of `address` under the finder's memory
/// and limits, shared by the feed finder and the blog checkup: a fresh
/// answer is given again without asking the site; otherwise `work` runs only
/// if a place is free and the site hasn't been looked up `PER_SITE` times
/// lately, and its answer is remembered. `kind` keeps each tool's answers
/// apart.
pub(crate) async fn guarded<Work, Done>(
    state: &AppState,
    kind: &str,
    address: &str,
    work: Work,
) -> Result<Answer, Problem>
where
    Work: FnOnce(Url) -> Done,
    Done: Future<Output = Answer>,
{
    let url = feeds::parse_address(address).ok_or(Problem::NotAnAddress)?;
    let finder = &state.finder;
    let key = format!("{kind}{url}");
    if let Some(answer) = finder.remembered(&key, Instant::now()) {
        return Ok(answer);
    }
    let Ok(_slot) = finder.fetching.try_acquire() else {
        return Err(Problem::Busy);
    };
    let site = url.host_str().unwrap_or_default().to_ascii_lowercase();
    finder.try_one(&site, Instant::now())?;
    let answer = work(url).await;
    finder.remember(key, answer.clone(), Instant::now());
    Ok(answer)
}

/// Looks the address up as Add feed does (`lookup`): a feed is its own
/// answer; for a site with several, each is looked at once, and the first
/// gives the preview.
async fn look(state: &AppState, url: &Url) -> Result<Answer, Problem> {
    let choices = match lookup::look(state, url, true).await {
        Ok(Looked::Feed(fetched, parsed)) => {
            let link = FeedLink {
                title: parsed.title.chars().take(LONGEST_TITLE).collect(),
                url: fetched.lasting_url.to_string(),
                latest: None,
            };
            return Ok(Answer::Found(Found {
                feeds: vec![link],
                preview: Some(preview(*parsed)),
            }));
        }
        Ok(Looked::Feeds(choices)) => choices,
        Err(NotFound::NoFeed) => return Ok(Answer::Problem(Problem::NoFeed)),
        Err(NotFound::Fetch(error)) => return Err(error.into()),
    };
    // The first feed, looked at already, gives the preview; nothing is
    // fetched again for it.
    let preview = match choices.first() {
        Some(Choice {
            fetched: Some(fetched),
            ..
        }) => feed::parse(&fetched.body, &fetched.final_url).map(preview),
        _ => None,
    };
    let feeds = choices
        .into_iter()
        .map(|choice| {
            let inside = choice.inside.unwrap_or_default();
            FeedLink {
                title: choice.found.title,
                url: choice.found.url.to_string(),
                latest: inside.latest,
            }
        })
        .collect();
    Ok(Answer::Found(Found { feeds, preview }))
}

fn preview(parsed: feed::ParsedFeed) -> Preview {
    let mut articles = parsed.articles;
    // Newest first, whatever order the feed is in; undated ones last.
    articles.sort_by_key(|article| std::cmp::Reverse(article.published_at));
    Preview {
        title: parsed.title.chars().take(LONGEST_TITLE).collect(),
        site: parsed.site_url.as_deref().and_then(web_address),
        articles: articles
            .into_iter()
            .take(PREVIEW_ARTICLES)
            .map(|article| Article {
                title: article.title.chars().take(LONGEST_TITLE).collect(),
                link: article.link.as_deref().and_then(web_address),
                published: article.published_at,
            })
            .collect(),
    }
}

/// Only `http` and `https` links leave the finder, so a feed can't slip a
/// `javascript:` link onto the website.
fn web_address(text: &str) -> Option<String> {
    Url::parse(text)
        .ok()
        .filter(|url| matches!(url.scheme(), "http" | "https"))
        .map(String::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_minute_holds_only_so_many_lookups() {
        let finder = Finder::default();
        let start = Instant::now();
        for number in 0..PER_MINUTE {
            assert_eq!(finder.try_one(&format!("{number}.example"), start), Ok(()));
        }
        assert_eq!(
            finder.try_one("new.example", start + Duration::from_secs(59)),
            Err(Problem::Busy)
        );
        assert_eq!(finder.try_one("new.example", start + MINUTE), Ok(()));
    }

    #[test]
    fn one_site_is_looked_up_only_so_often() {
        let finder = Finder::default();
        let start = Instant::now();
        for _ in 0..PER_SITE {
            assert_eq!(finder.try_one("quiet.example", start), Ok(()));
        }
        let later = start + Duration::from_secs(29 * 60);
        assert_eq!(
            finder.try_one("quiet.example", later),
            Err(Problem::SiteBusy)
        );
        assert_eq!(finder.try_one("other.example", later), Ok(()));
        assert_eq!(
            finder.try_one("quiet.example", start + REMEMBERED_FOR),
            Ok(())
        );
    }

    #[test]
    fn failures_are_remembered_for_five_minutes() {
        let finder = Finder::default();
        let start = Instant::now();
        let gone = Answer::Problem(Problem::Unreachable);
        finder.remember("https://gone.example/".to_owned(), gone, start);
        let soon = start + Duration::from_secs(60);
        assert!(finder.remembered("https://gone.example/", soon).is_some());
        let later = start + FAILURE_REMEMBERED_FOR;
        assert!(finder.remembered("https://gone.example/", later).is_none());
    }

    #[test]
    fn answers_are_forgotten_after_half_an_hour() {
        let finder = Finder::default();
        let start = Instant::now();
        finder.remember(
            "https://quiet.example/".to_owned(),
            Answer::Problem(Problem::NoFeed),
            start,
        );
        assert!(
            finder
                .remembered("https://quiet.example/", start + Duration::from_secs(60))
                .is_some()
        );
        assert!(
            finder
                .remembered("https://quiet.example/", start + REMEMBERED_FOR)
                .is_none()
        );
    }

    #[test]
    fn a_full_memory_forgets_its_oldest_answer() {
        let finder = Finder::default();
        let start = Instant::now();
        for number in 0..=REMEMBERED_MOST {
            let at = start + Duration::from_secs(u64::try_from(number).unwrap_or(0));
            finder.remember(
                format!("https://{number}.example/"),
                Answer::Problem(Problem::NoFeed),
                at,
            );
        }
        let later = start + Duration::from_secs(1000);
        assert!(finder.remembered("https://0.example/", later).is_none());
        assert!(finder.remembered("https://1.example/", later).is_some());
    }

    #[test]
    fn only_web_links_are_passed_on() {
        assert_eq!(
            web_address("https://quiet.example/1").as_deref(),
            Some("https://quiet.example/1")
        );
        assert_eq!(web_address("javascript:alert(1)"), None);
        assert_eq!(web_address("/relative"), None);
    }
}
