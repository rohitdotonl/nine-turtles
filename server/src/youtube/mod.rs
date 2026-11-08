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
    lookup,
};
use addresses::{Link, channel_feed, channel_in_page, playlist_feed, playlist_owner};

/// What to ask the reader before following: the channel behind a video,
/// or a playlist and its channel, the playlist first (it's what was pasted).
pub struct Question {
    /// "video" or "playlist", for the screen's words.
    pub asks: &'static str,
    /// The channel's name.
    pub maker: String,
    pub choices: Vec<Offered>,
}

/// One thing to follow, as the reader sees it: its name, its newest title,
/// and where it lives as a person says it ("youtube.com/@ted"), never the
/// feed's own address.
pub struct Offered {
    pub found: Found,
    pub place: String,
    pub latest: Option<String>,
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
    let page = String::from_utf8_lossy(&page.body);
    let Some(channel) = channel_in_page(&page) else {
        return Ok(None);
    };
    let Some(mut offered) = look(state, &channel_feed(&channel)).await else {
        return Ok(None);
    };
    if let Some(handle) = handle_in_page(&page) {
        offered.place = format!("youtube.com/{handle}");
    }
    Ok(Some(Question {
        asks: "video",
        maker: offered.found.title.clone(),
        choices: vec![offered],
    }))
}

async fn playlist(state: &AppState, list: &str) -> Option<Question> {
    let address = playlist_feed(list);
    let url = Url::parse(&address).ok()?;
    let fetched = fetch::get(&state.http, &url, false).await.ok()?;
    let parsed = feed::parse(&fetched.body, &fetched.final_url)?;
    let (channel, name) = playlist_owner(&String::from_utf8_lossy(&fetched.body))?;
    let maker = name.unwrap_or_else(|| parsed.title.clone());
    let only = Offered {
        found: found(format!("Only “{}”", parsed.title), &address),
        place: "youtube.com".to_owned(),
        latest: lookup::newest_title(&parsed),
    };
    state.looked.keep(&url, fetched);
    let every = match look(state, &channel_feed(&channel)).await {
        Some(channel) => Offered {
            found: found("Every video".to_owned(), channel.found.url.as_str()),
            ..channel
        },
        None => Offered {
            found: found("Every video".to_owned(), &channel_feed(&channel)),
            place: "youtube.com".to_owned(),
            latest: None,
        },
    };
    Some(Question {
        asks: "playlist",
        choices: vec![only, every],
        maker,
    })
}

/// A channel's feed, looked at: its name and newest title. The copy is kept
/// a few minutes, so Follow needn't ask YouTube again.
async fn look(state: &AppState, address: &str) -> Option<Offered> {
    let url = Url::parse(address).ok()?;
    let fetched = fetch::get(&state.http, &url, false).await.ok()?;
    let parsed = feed::parse(&fetched.body, &fetched.final_url)?;
    let title = parsed.title.trim();
    if title.is_empty() {
        return None;
    }
    let offered = Offered {
        found: found(title.to_owned(), address),
        place: "youtube.com".to_owned(),
        latest: lookup::newest_title(&parsed),
    };
    state.looked.keep(&url, fetched);
    Some(offered)
}

/// The channel's handle ("@ted") as the video's page names its owner.
fn handle_in_page(html: &str) -> Option<String> {
    const MARK: &str = r#""ownerProfileUrl":""#;
    let start = html.find(MARK)? + MARK.len();
    let address: String = html[start..]
        .chars()
        .take_while(|char| *char != '"')
        .collect();
    let handle = address.rsplit_once("youtube.com/")?.1;
    let plain = handle.len() > 1
        && handle.len() <= 40
        && handle.starts_with('@')
        && handle[1..]
            .chars()
            .all(|char| char.is_alphanumeric() || matches!(char, '.' | '_' | '-'));
    plain.then(|| handle.to_owned())
}

fn found(title: String, address: &str) -> Found {
    Found {
        title,
        url: Url::parse(address).expect("YouTube's feed addresses are well formed"),
    }
}

#[cfg(test)]
mod tests {
    use super::handle_in_page;

    #[test]
    fn a_videos_page_names_its_channels_handle() {
        let page = r#"..."ownerProfileUrl":"http://www.youtube.com/@3blue1brown","externalChannelId":"UCYO_jab_esuFRV4b17AJtAw"..."#;
        assert_eq!(handle_in_page(page).as_deref(), Some("@3blue1brown"));
        assert_eq!(
            handle_in_page(r#""ownerProfileUrl":"http://www.youtube.com/channel/UC1""#),
            None
        );
        assert_eq!(handle_in_page("no owner here"), None);
        assert_eq!(
            handle_in_page(r#""ownerProfileUrl":"https://www.youtube.com/@TED""#).as_deref(),
            Some("@TED")
        );
    }
}
