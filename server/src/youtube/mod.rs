//! YouTube as a first-class citizen (SPEC section 38, decision 0144): a
//! channel is a person who makes videos, followed through YouTube's own
//! public feeds and watched in YouTube's own player, never by scraping and
//! never with a Google key or account.
//!
//! - `addresses`: what a pasted YouTube address is, and the feeds for it.
//! - `sorting`: Shorts and live streams, marked so each reader can leave
//!   them out (they are by default).
//! - `takeout`: the subscriptions file Google Takeout gives anyone.
//!
//! Here: following any YouTube link. A channel's address is its feed. A
//! video asks "This video is by {channel}. Follow {channel}?"; a playlist
//! asks whether to follow the whole channel or only the playlist. Only the
//! page the reader pasted is read (decision 0016), and only for a video.

pub mod addresses;
pub mod sorting;
pub mod takeout;

use reqwest::Url;

use crate::{
    AppState,
    discover::Found,
    feed,
    fetch::{self, FetchError},
};
use addresses::{Link, channel_feed, channel_in_page, playlist_feed, playlist_owner};

/// What to ask the reader before following: the channel behind a video,
/// or a playlist's channel and the playlist itself, the channel first.
pub struct Question {
    /// "video" or "playlist", for the screen's words.
    pub asks: &'static str,
    /// The channel's name.
    pub maker: String,
    pub choices: Vec<Found>,
}

/// The question for a video's or a playlist's address; none if the
/// channel behind it can't be found.
pub async fn ask(
    state: &AppState,
    pasted: &Url,
    link: Link,
) -> Result<Option<Question>, FetchError> {
    let local = state.config.local_feeds_allowed;
    let video = match link {
        Link::Playlist { list, video } => {
            if let Some(question) = playlist(state, &list).await {
                return Ok(Some(question));
            }
            // A private or vanished playlist: the video alone, if there is one.
            if video.is_none() {
                return Ok(None);
            }
            pasted
        }
        Link::Video(_) => pasted,
        Link::Channel(_) | Link::Other => return Ok(None),
    };
    let page = fetch::get(&state.http, video, local).await?;
    let Some(channel) = channel_in_page(&String::from_utf8_lossy(&page.body)) else {
        return Ok(None);
    };
    let feed_url = channel_feed(&channel);
    let Some(maker) = feed_title(state, &feed_url).await else {
        return Ok(None);
    };
    Ok(Some(Question {
        asks: "video",
        choices: vec![found(maker.clone(), &feed_url)],
        maker,
    }))
}

async fn playlist(state: &AppState, list: &str) -> Option<Question> {
    let address = playlist_feed(list);
    let fetched = fetch::get(&state.http, &Url::parse(&address).ok()?, false)
        .await
        .ok()?;
    let parsed = feed::parse(&fetched.body, &fetched.final_url)?;
    let (channel, name) = playlist_owner(&String::from_utf8_lossy(&fetched.body))?;
    let maker = name.unwrap_or_else(|| parsed.title.clone());
    Some(Question {
        asks: "playlist",
        choices: vec![
            found(format!("All of {maker}’s videos"), &channel_feed(&channel)),
            found(format!("Only the playlist “{}”", parsed.title), &address),
        ],
        maker,
    })
}

/// The name a feed gives itself (a channel's feed: the channel's name).
async fn feed_title(state: &AppState, address: &str) -> Option<String> {
    let fetched = fetch::get(&state.http, &Url::parse(address).ok()?, false)
        .await
        .ok()?;
    feed::parse(&fetched.body, &fetched.final_url)
        .map(|parsed| parsed.title)
        .filter(|title| !title.trim().is_empty())
}

fn found(title: String, address: &str) -> Found {
    Found {
        title,
        url: Url::parse(address).expect("YouTube's feed addresses are well formed"),
    }
}
