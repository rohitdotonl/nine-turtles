//! What a YouTube address is, and the feeds YouTube keeps for it (decision
//! 0144). Only YouTube's own public feeds are used: a channel's
//! (`feeds/videos.xml?channel_id=UC…`) and a playlist's
//! (`feeds/videos.xml?playlist_id=…`). No key, no account, no API.

use reqwest::Url;

use crate::feed::youtube_video;

/// What a pasted YouTube address points at.
#[derive(Debug, PartialEq, Eq)]
pub enum Link {
    /// A channel by its number (`/channel/UC…`): its feed is known at once.
    Channel(String),
    /// A playlist (`/playlist?list=…`, or a video played from one).
    Playlist { list: String, video: Option<String> },
    /// One video (a watch page, a short link, a Short or a live video).
    Video(String),
    /// Anything else on YouTube (an `@handle`, `/c/…`, a feed) or not on
    /// YouTube at all: added the usual way.
    Other,
}

/// YouTube's own addresses, with or without `www.` or `m.`.
fn on_youtube(url: &Url) -> bool {
    url.host_str().is_some_and(|host| {
        matches!(
            host.trim_start_matches("www.").trim_start_matches("m."),
            "youtube.com" | "youtu.be"
        )
    })
}

/// What a pasted address is, as far as YouTube goes.
pub fn link(url: &Url) -> Link {
    if !on_youtube(url) || !matches!(url.scheme(), "http" | "https") {
        return Link::Other;
    }
    let mut path = url.path_segments().into_iter().flatten();
    if path.next() == Some("channel")
        && let Some(id) = path.next().filter(|id| is_channel(id))
    {
        return Link::Channel(id.to_owned());
    }
    let video = youtube_video(url);
    let list = url
        .query_pairs()
        .find(|(name, _)| name == "list")
        .map(|(_, list)| list.into_owned())
        .filter(|list| is_list(list));
    match (list, video) {
        (Some(list), video) => Link::Playlist { list, video },
        (None, Some(video)) => Link::Video(video),
        (None, None) => Link::Other,
    }
}

/// A channel's number: `UC` and 22 more letters, digits, `-` or `_`.
pub fn is_channel(id: &str) -> bool {
    id.len() == 24 && id.starts_with("UC") && id.bytes().all(allowed)
}

/// A playlist that has a feed. A "mix" (`RD…`) is made up for each viewer
/// and Watch later (`WL`) and Liked (`LL`) are private, so none of them has
/// one.
fn is_list(list: &str) -> bool {
    (10..=64).contains(&list.len())
        && list.bytes().all(allowed)
        && !list.starts_with("RD")
        && !matches!(list, "WL" | "LL")
}

const fn allowed(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_'
}

/// The feed of a channel's latest videos.
pub fn channel_feed(channel: &str) -> String {
    format!("https://www.youtube.com/feeds/videos.xml?channel_id={channel}")
}

/// The feed of a playlist's latest videos.
pub fn playlist_feed(list: &str) -> String {
    format!("https://www.youtube.com/feeds/videos.xml?playlist_id={list}")
}

/// The channel whose feed this is, if it's a channel's feed (not a
/// playlist's, and not on any other site).
pub fn channel_of_feed(url: &Url) -> Option<String> {
    let host = url.host_str()?.trim_start_matches("www.");
    if host != "youtube.com" || url.path() != "/feeds/videos.xml" {
        return None;
    }
    url.query_pairs()
        .find(|(name, _)| name == "channel_id")
        .map(|(_, id)| id.into_owned())
        .filter(|id| is_channel(id))
}

/// The lists YouTube keeps of a channel's Shorts (`UUSH…`) and of its live
/// streams (`UULV…`), each with a feed. Neither is documented by YouTube,
/// so either may stop answering; then nothing is sorted out (`sorting`).
pub fn shorts_feed(channel: &str) -> String {
    playlist_feed(&format!("UUSH{}", &channel[2..]))
}

pub fn live_feed(channel: &str) -> String {
    playlist_feed(&format!("UULV{}", &channel[2..]))
}

/// The channel a YouTube page belongs to, read from the page the reader
/// pasted (a video's page names its channel's number in a few places).
/// The video's own details come first in the page, before any other
/// channel it suggests, so the first one named is the video's.
pub fn channel_in_page(html: &str) -> Option<String> {
    const MARKS: [&str; 3] = [
        r#"itemprop="channelId" content=""#,
        r#""channelId":""#,
        r#""externalChannelId":""#,
    ];
    MARKS.iter().find_map(|mark| {
        let start = html.find(mark)? + mark.len();
        let id = html.get(start..start + 24)?;
        is_channel(id).then(|| id.to_owned())
    })
}

/// A playlist feed's channel and its name, as the feed says them
/// (`<yt:channelId>` and its author's `<name>`), read straight from the
/// file: the feed reader keeps neither.
pub fn playlist_owner(feed: &str) -> Option<(String, Option<String>)> {
    let inside = |open: &str, close: &str, from: usize| -> Option<String> {
        let start = feed.get(from..)?.find(open)? + from + open.len();
        let end = feed.get(start..)?.find(close)? + start;
        Some(feed[start..end].trim().to_owned())
    };
    let channel = inside("<yt:channelId>", "</yt:channelId>", 0).filter(|id| is_channel(id))?;
    let name = feed
        .find("<author>")
        .and_then(|at| inside("<name>", "</name>", at))
        .map(|name| unescape(&name))
        .filter(|name| !name.is_empty());
    Some((channel, name))
}

/// The five escapes XML has, so a name like "Tom &amp; Jerry" reads right.
fn unescape(text: &str) -> String {
    text.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
}

#[cfg(test)]
mod tests {
    use super::*;

    const CHANNEL: &str = "UCabcdefghijklmnopqrstuv";

    fn url(text: &str) -> Url {
        Url::parse(text).unwrap()
    }

    #[test]
    fn a_pasted_youtube_address_says_what_it_points_at() {
        assert_eq!(
            link(&url(&format!("https://www.youtube.com/channel/{CHANNEL}"))),
            Link::Channel(CHANNEL.to_owned())
        );
        assert_eq!(
            link(&url(&format!(
                "https://m.youtube.com/channel/{CHANNEL}/videos"
            ))),
            Link::Channel(CHANNEL.to_owned())
        );
        for video in [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ?si=share",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            "https://www.youtube.com/live/dQw4w9WgXcQ",
            // A mix is made up for each viewer: just the video.
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ",
        ] {
            assert_eq!(
                link(&url(video)),
                Link::Video("dQw4w9WgXcQ".to_owned()),
                "{video}"
            );
        }
        assert_eq!(
            link(&url("https://www.youtube.com/playlist?list=PLabcdefghij")),
            Link::Playlist {
                list: "PLabcdefghij".to_owned(),
                video: None
            }
        );
        assert_eq!(
            link(&url(
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghij"
            )),
            Link::Playlist {
                list: "PLabcdefghij".to_owned(),
                video: Some("dQw4w9WgXcQ".to_owned())
            }
        );
        for other in [
            "https://www.youtube.com/@someone",
            "https://www.youtube.com/c/someone",
            "https://www.youtube.com/channel/UCshort",
            "https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv",
            "https://example.com/watch?v=dQw4w9WgXcQ",
            "https://www.youtube.com/playlist?list=WL",
        ] {
            assert_eq!(link(&url(other)), Link::Other, "{other}");
        }
    }

    #[test]
    fn only_a_channels_own_feed_names_its_channel() {
        assert_eq!(
            channel_of_feed(&url(&channel_feed(CHANNEL))).as_deref(),
            Some(CHANNEL)
        );
        assert_eq!(channel_of_feed(&url(&playlist_feed("PLabcdefghij"))), None);
        assert_eq!(
            channel_of_feed(&url(&format!(
                "https://example.com/feeds/videos.xml?channel_id={CHANNEL}"
            ))),
            None
        );
        assert_eq!(
            shorts_feed(CHANNEL),
            "https://www.youtube.com/feeds/videos.xml?playlist_id=UUSHabcdefghijklmnopqrstuv"
        );
        assert_eq!(
            live_feed(CHANNEL),
            "https://www.youtube.com/feeds/videos.xml?playlist_id=UULVabcdefghijklmnopqrstuv"
        );
    }

    #[test]
    fn a_video_page_names_its_channel() {
        let page = format!(
            r#"<html><script>var ytInitialPlayerResponse = {{"videoDetails":{{"videoId":"dQw4w9WgXcQ","channelId":"{CHANNEL}"}}}};
            var ytInitialData = {{"channelId":"UCzzzzzzzzzzzzzzzzzzzzzz"}};</script></html>"#
        );
        assert_eq!(channel_in_page(&page).as_deref(), Some(CHANNEL));
        let meta = format!(r#"<meta itemprop="channelId" content="{CHANNEL}">"#);
        assert_eq!(channel_in_page(&meta).as_deref(), Some(CHANNEL));
        assert_eq!(channel_in_page(r#"{"channelId":"UCshort"}"#), None);
        assert_eq!(channel_in_page("<html></html>"), None);
    }

    #[test]
    fn a_playlist_feed_names_its_channel() {
        let feed = format!(
            "<feed><yt:playlistId>PLabcdefghij</yt:playlistId><yt:channelId>{CHANNEL}</yt:channelId>\
             <title>Walks</title><author><name>Tom &amp; Jerry</name><uri>x</uri></author>\
             <entry><author><name>Someone else</name></author></entry></feed>"
        );
        assert_eq!(
            playlist_owner(&feed),
            Some((CHANNEL.to_owned(), Some("Tom & Jerry".to_owned())))
        );
        assert_eq!(playlist_owner("<feed></feed>"), None);
    }
}
