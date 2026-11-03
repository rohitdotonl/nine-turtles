//! Sorting out Shorts and live streams (decision 0144). A channel's feed
//! lists every kind of video together. YouTube also keeps, for each
//! channel, a list of its Shorts (`UUSH…`) and one of its live streams
//! (`UULV…`), each with a feed of its own. When a check brings videos nine
//! turtles hasn't stored yet, it reads those two lists once and marks each
//! new video found in one. A video is left out only when a list names it,
//! never by guessing, so if YouTube stops keeping the lists, every video
//! simply shows (the feed's screen says Shorts may slip through).
//!
//! Whether a reader sees them is their own switch on the feed's screen
//! (`feeds::store`, `SHOWN`): the article is stored for everyone either way.

use std::collections::HashSet;

use reqwest::Url;

use super::addresses::{channel_of_feed, live_feed, shorts_feed};
use crate::{
    AppState,
    feed::{self, ParsedArticle, ParsedFeed, VideoKind, youtube_video},
    fetch,
};

/// Marks the Shorts and live streams among a channel's new videos. Any
/// other feed is left as it is. Asks YouTube for the two lists only when
/// there's something new to sort, so most checks ask nothing more.
pub async fn sort(state: &AppState, feed_url: &Url, parsed: &mut ParsedFeed) {
    let Some(channel) = channel_of_feed(feed_url) else {
        return;
    };
    for article in &mut parsed.articles {
        if article
            .link
            .as_deref()
            .is_some_and(|link| link.contains("/shorts/"))
        {
            article.video_kind = Some(VideoKind::Short);
        }
    }
    let new = match unsorted_new(state, feed_url, &parsed.articles).await {
        Ok(new) => new,
        Err(error) => {
            crate::log::problem(&format!("database error while sorting videos: {error}"));
            return;
        }
    };
    if new.is_empty() {
        return;
    }
    let (shorts_list, live_list) = (shorts_feed(&channel), live_feed(&channel));
    let (shorts, live) = tokio::join!(videos_in(state, &shorts_list), videos_in(state, &live_list));
    mark(&mut parsed.articles, &new, &shorts, &live);
}

/// Each new article (by fingerprint) found in a list gets that list's kind.
pub fn mark(
    articles: &mut [ParsedArticle],
    new: &HashSet<String>,
    shorts: &HashSet<String>,
    live: &HashSet<String>,
) {
    for article in articles {
        if article.video_kind.is_some() || !new.contains(&article.fingerprint) {
            continue;
        }
        let Some(video) = video_of(article) else {
            continue;
        };
        if shorts.contains(&video) {
            article.video_kind = Some(VideoKind::Short);
        } else if live.contains(&video) {
            article.video_kind = Some(VideoKind::Live);
        }
    }
}

fn video_of(article: &ParsedArticle) -> Option<String> {
    youtube_video(&Url::parse(article.link.as_deref()?).ok()?)
}

/// The fingerprints of the articles not stored yet for this feed and not
/// already sorted (a Short's own address says so).
async fn unsorted_new(
    state: &AppState,
    feed_url: &Url,
    articles: &[ParsedArticle],
) -> Result<HashSet<String>, sqlx::Error> {
    let fingerprints: Vec<&str> = articles
        .iter()
        .filter(|article| article.video_kind.is_none())
        .map(|article| article.fingerprint.as_str())
        .collect();
    if fingerprints.is_empty() {
        return Ok(HashSet::new());
    }
    let stored: Vec<String> = sqlx::query_scalar(
        "SELECT articles.fingerprint FROM articles JOIN feeds ON feeds.id = articles.feed_id
         WHERE feeds.url_key = ? AND articles.fingerprint IN (SELECT value FROM json_each(?))",
    )
    .bind(feed::normalize(feed_url))
    .bind(serde_json::to_string(&fingerprints).unwrap_or_else(|_| "[]".to_owned()))
    .fetch_all(&state.db)
    .await?;
    let stored: HashSet<String> = stored.into_iter().collect();
    Ok(fingerprints
        .into_iter()
        .filter(|fingerprint| !stored.contains(*fingerprint))
        .map(str::to_owned)
        .collect())
}

/// The videos a list's feed names; none if it can't be read (a channel
/// with no Shorts has no Shorts list at all).
async fn videos_in(state: &AppState, address: &str) -> HashSet<String> {
    let Ok(url) = Url::parse(address) else {
        return HashSet::new();
    };
    let Ok(fetched) = fetch::get(&state.http, &url, false).await else {
        return HashSet::new();
    };
    feed::parse(&fetched.body, &fetched.final_url)
        .map(|parsed| parsed.articles.iter().filter_map(video_of).collect())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn video(fingerprint: &str, id: &str) -> ParsedArticle {
        ParsedArticle {
            fingerprint: fingerprint.to_owned(),
            title: String::new(),
            link: Some(format!("https://www.youtube.com/watch?v={id}")),
            author: None,
            content: None,
            summary: None,
            language: None,
            published_at: None,
            episode: None,
            video_kind: None,
        }
    }

    fn set(items: &[&str]) -> HashSet<String> {
        items.iter().map(|item| (*item).to_owned()).collect()
    }

    #[test]
    fn only_a_new_video_a_list_names_is_sorted_out() {
        let mut articles = vec![
            video("a", "aaaaaaaaaaa"),
            video("b", "bbbbbbbbbbb"),
            video("c", "ccccccccccc"),
            video("d", "ddddddddddd"),
        ];
        mark(
            &mut articles,
            &set(&["a", "b", "c"]),
            &set(&["aaaaaaaaaaa", "ddddddddddd"]),
            &set(&["bbbbbbbbbbb"]),
        );
        let kinds: Vec<_> = articles.iter().map(|article| article.video_kind).collect();
        assert_eq!(
            kinds,
            [Some(VideoKind::Short), Some(VideoKind::Live), None, None]
        );
    }
}
