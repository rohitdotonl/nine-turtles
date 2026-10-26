//! The feed finder on the website (SPEC section 30, decision 0095): anyone,
//! signed in or not, gives the address of a site and gets back the feeds the
//! page names, with the newest few titles of the first one.
//!
//! It follows the same rules as adding a feed (decision 0016): it fetches the
//! one page given, reads the `<link rel="alternate">` lines it names, and
//! never guesses other addresses or fetches an article's page. It then
//! fetches the first feed once, for the preview.
//!
//! Nothing about who asked is kept or written to the log. An answer is
//! remembered in memory for half an hour, so a site many people look up is
//! still visited at most twice an hour, and there are limits on how many
//! lookups run at once and in a minute, so the finder can't be used to make
//! nine turtles hammer a site or itself.

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

use crate::{AppState, discover, feed, feeds, fetch};

/// The website, the only other site whose pages may read the finder's
/// answers (in browsers' words, "cross-origin resource sharing").
pub const WEBSITE: &str = "https://nineturtles.app";

/// Lookups that may fetch at the same time; one more is told to wait.
const AT_ONCE: usize = 4;
/// Lookups that may fetch in a minute, from everyone together.
const PER_MINUTE: usize = 60;
/// How long an answer is remembered, and how many are.
const REMEMBERED_FOR: Duration = Duration::from_secs(30 * 60);
const REMEMBERED_MOST: usize = 500;
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
            .filter(|(found_at, _)| now.saturating_duration_since(*found_at) < REMEMBERED_FOR)
            .map(|(_, answer)| answer.clone())
    }

    fn remember(&self, address: String, answer: Answer, now: Instant) {
        let Ok(mut inner) = self.inner.lock() else {
            return;
        };
        inner
            .answers
            .retain(|_, (found_at, _)| now.saturating_duration_since(*found_at) < REMEMBERED_FOR);
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

    /// Counts a lookup at `now`, or answers false if the minute's are used up.
    fn try_one(&self, now: Instant) -> bool {
        let Ok(mut inner) = self.inner.lock() else {
            return false;
        };
        while inner
            .recent
            .front()
            .is_some_and(|started| now.saturating_duration_since(*started) >= MINUTE)
        {
            inner.recent.pop_front();
        }
        if inner.recent.len() >= PER_MINUTE {
            return false;
        }
        inner.recent.push_back(now);
        true
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
enum Answer {
    Found(Found),
    NoFeed,
}

/// Why nothing was found, in words the website turns into a sentence.
#[derive(Debug, PartialEq, Eq)]
enum Problem {
    NotAnAddress,
    NotAllowed,
    Unreachable,
    PageNotFound,
    TooBig,
    NoFeed,
    Busy,
}

impl From<fetch::FetchError> for Problem {
    fn from(error: fetch::FetchError) -> Self {
        match error {
            fetch::FetchError::NotAllowed => Self::NotAllowed,
            fetch::FetchError::Status(404 | 410) => Self::PageNotFound,
            fetch::FetchError::TooBig => Self::TooBig,
            fetch::FetchError::Unreachable
            | fetch::FetchError::Status(_)
            | fetch::FetchError::SlowDown(_) => Self::Unreachable,
        }
    }
}

async fn find_feeds(State(state): State<AppState>, Query(asked): Query<Asked>) -> Response {
    let mut response = match find(&state, &asked.address).await {
        Ok(found) => Json(found).into_response(),
        Err(problem) => {
            let (status, error) = match problem {
                Problem::NotAnAddress => (StatusCode::BAD_REQUEST, "not-an-address"),
                Problem::NotAllowed => (StatusCode::BAD_REQUEST, "not-allowed"),
                Problem::Unreachable => (StatusCode::BAD_GATEWAY, "unreachable"),
                Problem::PageNotFound => (StatusCode::BAD_GATEWAY, "not-found"),
                Problem::TooBig => (StatusCode::BAD_GATEWAY, "too-big"),
                Problem::NoFeed => (StatusCode::UNPROCESSABLE_ENTITY, "no-feed"),
                Problem::Busy => (StatusCode::TOO_MANY_REQUESTS, "busy"),
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

async fn find(state: &AppState, address: &str) -> Result<Found, Problem> {
    let url = feeds::parse_address(address).ok_or(Problem::NotAnAddress)?;
    let finder = &state.finder;
    let key = url.as_str().to_owned();
    if let Some(answer) = finder.remembered(&key, Instant::now()) {
        return match answer {
            Answer::Found(found) => Ok(found),
            Answer::NoFeed => Err(Problem::NoFeed),
        };
    }
    let Ok(_slot) = finder.fetching.try_acquire() else {
        return Err(Problem::Busy);
    };
    if !finder.try_one(Instant::now()) {
        return Err(Problem::Busy);
    }

    let answer = look(state, &url).await?;
    finder.remember(key, answer.clone(), Instant::now());
    match answer {
        Answer::Found(found) => Ok(found),
        Answer::NoFeed => Err(Problem::NoFeed),
    }
}

/// Fetches the page given and, if it's a web page naming feeds, the first
/// of them, for the preview.
async fn look(state: &AppState, url: &Url) -> Result<Answer, Problem> {
    let local = state.config.local_feeds_allowed;
    let fetched = fetch::get(&state.http, url, local).await?;

    if let Some(parsed) = feed::parse(&fetched.body, &fetched.final_url) {
        // The address given is a feed itself.
        let link = FeedLink {
            title: parsed.title.clone(),
            url: fetched.lasting_url.to_string(),
        };
        return Ok(Answer::Found(Found {
            feeds: vec![link],
            preview: Some(preview(parsed)),
        }));
    }

    let page = String::from_utf8_lossy(&fetched.body);
    let found = discover::feeds_in(&page, &fetched.final_url);
    let Some(first) = found.first() else {
        return Ok(Answer::NoFeed);
    };
    // A preview that can't be made isn't a failure: the addresses still help.
    let preview = match fetch::get(&state.http, &first.url, local).await {
        Ok(fetched) => feed::parse(&fetched.body, &fetched.final_url).map(preview),
        Err(_) => None,
    };
    let feeds = found
        .into_iter()
        .map(|found| FeedLink {
            title: found.title,
            url: found.url.to_string(),
        })
        .collect();
    Ok(Answer::Found(Found { feeds, preview }))
}

fn preview(parsed: feed::ParsedFeed) -> Preview {
    let mut articles = parsed.articles;
    // Newest first, whatever order the feed is in; undated ones last.
    articles.sort_by_key(|article| std::cmp::Reverse(article.published_at));
    Preview {
        title: parsed.title,
        site: parsed.site_url.as_deref().and_then(web_address),
        articles: articles
            .into_iter()
            .take(PREVIEW_ARTICLES)
            .map(|article| Article {
                title: article.title,
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
        for _ in 0..PER_MINUTE {
            assert!(finder.try_one(start));
        }
        assert!(!finder.try_one(start + Duration::from_secs(59)));
        assert!(finder.try_one(start + MINUTE));
    }

    #[test]
    fn answers_are_forgotten_after_half_an_hour() {
        let finder = Finder::default();
        let start = Instant::now();
        finder.remember("https://quiet.example/".to_owned(), Answer::NoFeed, start);
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
            finder.remember(format!("https://{number}.example/"), Answer::NoFeed, at);
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
