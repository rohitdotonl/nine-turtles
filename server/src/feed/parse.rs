//! Reading a feed file (RSS, Atom or JSON Feed) into articles and episodes.

use std::borrow::Cow;

use reqwest::Url;

use super::*;

/// One feed, as read from its file.
#[derive(Debug)]
pub struct ParsedFeed {
    pub title: String,
    /// The publisher's website, for credit and "Open original".
    pub site_url: Option<String>,
    pub language: Option<String>,
    pub articles: Vec<ParsedArticle>,
    /// The publisher's WebSub hub, if the feed names one (SPEC section 12).
    pub hub: Option<Hub>,
}

/// Where a feed's WebSub hub is, and the address the publisher announces
/// the feed under there (its `rel="self"` link, or where it was fetched).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Hub {
    pub hub: Url,
    pub topic: Url,
}

#[derive(Debug)]
pub struct ParsedArticle {
    pub fingerprint: String,
    pub title: String,
    pub link: Option<String>,
    pub author: Option<String>,
    /// Cleaned HTML, safe to show.
    pub content: Option<String>,
    pub summary: Option<String>,
    pub language: Option<String>,
    /// Seconds since 1970 (UTC), as the feed says.
    pub published_at: Option<i64>,
    /// The audio file attached to it, if it's a podcast's episode (SPEC
    /// section 35). Only the publisher's address is kept, never the file.
    pub episode: Option<Episode>,
}

/// A podcast episode's audio file, as its feed describes it (decision 0113).
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Episode {
    /// The publisher's own address for the file: http or https only.
    pub url: String,
    /// Its type, such as `audio/mpeg`, if the feed says.
    pub media_type: Option<String>,
    /// Its size in bytes, if the feed says.
    pub bytes: Option<i64>,
    /// How long it plays, in whole seconds (`itunes:duration`), if the feed says.
    pub seconds: Option<i64>,
    /// The episode's picture, else the podcast's, if either is a web address.
    pub artwork: Option<String>,
}

/// Reads a feed file. `None` means it isn't a feed (often a web page).
pub fn parse(body: &[u8], feed_url: &Url) -> Option<ParsedFeed> {
    // An empty ID means "the feed gave none", so nine turtles' own fingerprint
    // rules decide, rather than feed-rs's made-up one.
    let parser = feed_rs::parser::Builder::new()
        .base_uri(Some(feed_url.as_str()))
        .id_generator(|_, _, _| String::new())
        .build();
    let feed = parser.parse(with_itunes_kept(body).as_ref()).ok()?;

    let site_url = feed
        .links
        .iter()
        .find(|link| link.rel.as_deref().is_none_or(|rel| rel == "alternate"))
        .and_then(|link| feed_url.join(&link.href).ok())
        .filter(|url| matches!(url.scheme(), "http" | "https"))
        .map(String::from);
    let web_link = |rel: &str| {
        feed.links
            .iter()
            .find(|link| link.rel.as_deref() == Some(rel))
            .and_then(|link| feed_url.join(link.href.trim()).ok())
            .filter(|url| matches!(url.scheme(), "http" | "https"))
    };
    let hub = web_link("hub").map(|hub| Hub {
        hub,
        topic: web_link("self").unwrap_or_else(|| feed_url.clone()),
    });
    // The podcast's own picture (`itunes:image`, or the RSS `<image>`), for
    // episodes that have none of their own.
    let feed_artwork = feed
        .logo
        .as_ref()
        .and_then(|logo| web_address(feed_url, &logo.uri));
    let title = feed
        .title
        .as_ref()
        .map(plain_text)
        .filter(|title| !title.is_empty())
        .unwrap_or_else(|| {
            feed_url
                .host_str()
                .unwrap_or("Untitled feed")
                .trim_start_matches("www.")
                .to_owned()
        });

    let articles = feed
        .entries
        .into_iter()
        .map(|entry| {
            // A JSON Feed's attachments come as links too, with their type:
            // the article's own link is a page, never its audio file.
            let link = entry
                .links
                .iter()
                .find(|link| {
                    link.rel.as_deref().is_none_or(|rel| rel == "alternate")
                        && link
                            .media_type
                            .as_deref()
                            .is_none_or(|kind| kind.contains("html"))
                })
                .and_then(|link| feed_url.join(&link.href).ok())
                .filter(|url| matches!(url.scheme(), "http" | "https"));
            let title = entry.title.as_ref().map(plain_text).unwrap_or_default();
            let published = entry.published.or(entry.updated).map(|at| at.timestamp());
            let base = link.as_ref().unwrap_or(feed_url);
            let content = entry
                .content
                .as_ref()
                .and_then(|content| {
                    let body = content.body.as_deref()?;
                    Some(clean(body, content.content_type.as_ref(), base))
                })
                .filter(|html| !html.trim().is_empty())
                .or_else(|| {
                    // A YouTube channel's feed carries each video's description
                    // in its media details, not as content: that is its text.
                    link.as_ref().and_then(youtube_video)?;
                    let description = entry
                        .media
                        .iter()
                        .find_map(|media| media.description.as_ref())?;
                    Some(clean(&paragraphs(&description.content), "text/html", base))
                })
                .filter(|html| !html.trim().is_empty());
            let summary = entry
                .summary
                .as_ref()
                .map(|text| clean(&text.content, text.content_type.as_ref(), base))
                .filter(|html| !html.trim().is_empty());
            let episode = episode(&entry, base, feed_artwork.as_deref());
            ParsedArticle {
                // The fingerprint comes from the link as the feed wrote it,
                // so it stays what it always was (`normalize` ignores the
                // tracking tags it has always ignored); what's stored and
                // shown is the link without any tracking tags.
                fingerprint: fingerprint(&entry.id, link.as_ref(), &title, published),
                title,
                link: link.map(without_tracking).map(String::from),
                author: entry
                    .authors
                    .first()
                    .and_then(|person| person.name.as_deref())
                    .and_then(author_name),
                content,
                summary,
                language: entry.language.or_else(|| feed.language.clone()),
                published_at: published,
                episode,
            }
        })
        .collect();

    Some(ParsedFeed {
        title,
        site_url,
        language: feed.language,
        articles,
        hub,
    })
}

/// What stands before each episode's `itunes:duration` and `itunes:image`,
/// so feed-rs keeps them. It drops an item's iTunes details unless they
/// include a title or a summary, which many podcasts leave out; a title of
/// its own makes them count. nine turtles never shows that title.
const ITUNES_KEEP: &[u8] = b"<itunes:title>-</itunes:title>";

/// The feed file with `ITUNES_KEEP` before each `<itunes:duration` and
/// `<itunes:image` (unchanged, and not copied, when it has neither, or is a
/// JSON Feed). At the channel's level feed-rs ignores an iTunes title, so
/// the podcast's own picture is read as before.
fn with_itunes_kept(body: &[u8]) -> Cow<'_, [u8]> {
    const TAGS: [&[u8]; 2] = [b"<itunes:duration", b"<itunes:image"];
    let starts = |at: usize| TAGS.iter().any(|tag| body[at..].starts_with(tag));
    // A JSON Feed has no iTunes tags: words in its text are left alone.
    let json = body
        .iter()
        .find(|byte| !byte.is_ascii_whitespace())
        .is_some_and(|byte| *byte == b'{');
    if json || !body.windows(8).any(|window| window == b"<itunes:") {
        return Cow::Borrowed(body);
    }
    let mut out = Vec::with_capacity(body.len() + 1024);
    // A duration written as minutes and seconds ("30:00") would be read as
    // 30 seconds: it gets its hours ("0:30:00").
    let mut hours_missing: Option<&[u8]> = None;
    // Inside CDATA (show notes quoting the tags) nothing is added.
    let mut in_cdata = false;
    for (at, byte) in body.iter().enumerate() {
        if *byte == b'<' && body[at..].starts_with(b"<![CDATA[") {
            in_cdata = true;
        } else if in_cdata && *byte == b']' && body[at..].starts_with(b"]]>") {
            in_cdata = false;
        }
        if in_cdata {
            out.push(*byte);
            continue;
        }
        if *byte == b'<' && starts(at) {
            out.extend_from_slice(ITUNES_KEEP);
        }
        if let Some(hours) = hours_missing.filter(|_| !byte.is_ascii_whitespace()) {
            out.extend_from_slice(hours);
            hours_missing = None;
        }
        out.push(*byte);
        if *byte == b'>' {
            hours_missing = match minutes_and_seconds_follow(body, at) {
                Some(1) => Some(b"0:0"),
                Some(_) => Some(b"0:"),
                None => None,
            };
        }
    }
    Cow::Owned(out)
}

/// If the tag ending at `at` is an `<itunes:duration>` holding minutes and
/// seconds alone, such as `30:00` or ` 5:07 `, how many digits its minutes
/// have.
fn minutes_and_seconds_follow(body: &[u8], at: usize) -> Option<usize> {
    const TAG: &[u8] = b"<itunes:duration";
    let start = at.checked_sub(TAG.len())?;
    if &body[start..at] != TAG {
        return None;
    }
    let rest = &body[at + 1..];
    let end = rest
        .iter()
        .position(|byte| *byte == b'<')
        .unwrap_or(rest.len());
    let text = String::from_utf8_lossy(&rest[..end]);
    let (minutes, seconds) = text.trim().split_once(':')?;
    let digits = |part: &str| part.bytes().all(|byte| byte.is_ascii_digit());
    (!minutes.is_empty()
        && minutes.len() <= 4
        && digits(minutes)
        && seconds.len() == 2
        && digits(seconds))
    .then_some(minutes.len())
}

/// The longest address kept for an episode's file or picture. Real ones
/// are far shorter; a longer one is left out rather than stored.
const LONGEST_ADDRESS: usize = 2048;

/// Endings of audio files, for an attachment whose feed doesn't say its type.
const AUDIO_ENDINGS: &[&str] = &[".mp3", ".m4a", ".aac", ".ogg", ".opus"];

/// An address from a feed made whole against `base`, if it's a web address
/// (http or https) of a sensible length. Anything else is left out.
fn web_address(base: &Url, text: &str) -> Option<String> {
    let url = base.join(text.trim()).ok()?;
    (matches!(url.scheme(), "http" | "https") && url.as_str().len() <= LONGEST_ADDRESS)
        .then(|| url.into())
}

/// Whether an attachment is audio: its type says so (`audio/…`), or, when
/// the feed gives no type, its address ends like an audio file.
fn is_audio(media_type: Option<&str>, url: &Url) -> bool {
    match media_type.map(str::trim).filter(|kind| !kind.is_empty()) {
        Some(kind) => kind.to_ascii_lowercase().starts_with("audio/"),
        None => {
            let path = url.path().to_ascii_lowercase();
            AUDIO_ENDINGS.iter().any(|ending| path.ends_with(ending))
        }
    }
}

/// The article's audio file, if it has one (SPEC section 35): the first
/// audio attachment among an RSS `<enclosure>` (or Media RSS content), an
/// Atom `rel="enclosure"` link and a JSON Feed attachment, with its type and
/// size, how long it plays (`itunes:duration`) and its picture (the
/// episode's own `itunes:image`, else the podcast's). A video or a picture
/// attached isn't an episode. Only http and https addresses are kept.
fn episode(
    entry: &feed_rs::model::Entry,
    base: &Url,
    feed_artwork: Option<&str>,
) -> Option<Episode> {
    struct Found {
        url: Url,
        media_type: Option<String>,
        bytes: Option<u64>,
        seconds: Option<u64>,
    }
    let from_media = entry.media.iter().flat_map(|media| {
        media.content.iter().filter_map(|content| {
            Some(Found {
                url: content.url.clone()?,
                media_type: content.content_type.as_ref().map(ToString::to_string),
                bytes: content.size,
                seconds: content.duration.map(|duration| duration.as_secs()),
            })
        })
    });
    let from_links = entry
        .links
        .iter()
        // An Atom enclosure, or a JSON Feed attachment (a link with a type and no rel).
        .filter(|link| match link.rel.as_deref() {
            Some(rel) => rel == "enclosure",
            None => link.media_type.is_some(),
        })
        .filter_map(|link| {
            Some(Found {
                url: base.join(link.href.trim()).ok()?,
                media_type: link.media_type.clone(),
                bytes: link.length,
                seconds: None,
            })
        });
    let found = from_media
        .chain(from_links)
        .find(|found| is_audio(found.media_type.as_deref(), &found.url))?;
    let url = web_address(base, found.url.as_str())?;
    let seconds = found.seconds.or_else(|| {
        entry
            .media
            .iter()
            .find_map(|media| media.duration)
            .map(|duration| duration.as_secs())
    });
    let artwork = entry
        .media
        .iter()
        .flat_map(|media| &media.thumbnails)
        .find_map(|thumbnail| web_address(base, &thumbnail.image.uri))
        .or_else(|| feed_artwork.map(ToOwned::to_owned));
    let media_type = found
        .media_type
        .map(|kind| kind.trim().to_ascii_lowercase())
        .filter(|kind| !kind.is_empty() && kind.len() <= 100);
    Some(Episode {
        url,
        media_type,
        bytes: found.bytes.and_then(|bytes| i64::try_from(bytes).ok()),
        seconds: seconds
            .filter(|seconds| *seconds > 0)
            .and_then(|seconds| i64::try_from(seconds).ok()),
        artwork,
    })
}

/// The author's name as people write it. RSS often gives
/// `someone@example.com (Name)`; only the name is kept, never the address.
fn author_name(text: &str) -> Option<String> {
    let text = text.trim();
    // Only the `address (Name)` form: "Jane Doe (Editor)" stays as written.
    let name = match text.rsplit_once('(') {
        Some((before, inside))
            if inside.ends_with(')') && (before.trim().is_empty() || before.contains('@')) =>
        {
            inside.trim_end_matches(')')
        }
        _ => text,
    };
    let name = name.trim();
    (!name.is_empty() && !name.contains('@')).then(|| name.to_owned())
}

/// A title or name as plain words: tags removed, `&amp;` and friends turned
/// back into characters, runs of spaces made single.
fn plain_text(text: &feed_rs::model::Text) -> String {
    let words = if text.content_type.to_string().contains("html") {
        scraper::Html::parse_fragment(&text.content)
            .root_element()
            .text()
            .collect::<String>()
    } else {
        text.content.clone()
    };
    words.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(text: &str) -> Url {
        Url::parse(text).unwrap()
    }

    #[test]
    fn a_feeds_websub_hub_and_its_own_address_are_found() {
        let rss = br#"<?xml version="1.0"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>A</title>
<link>https://example.com/</link>
<atom:link rel="hub" href="https://hub.example/" />
<atom:link rel="self" href="https://example.com/feed.xml" type="application/rss+xml" />
</channel></rss>"#;
        let parsed = parse(rss, &url("https://example.com/feed")).unwrap();
        assert_eq!(
            parsed.hub,
            Some(Hub {
                hub: url("https://hub.example/"),
                topic: url("https://example.com/feed.xml"),
            })
        );
        // No self link: the address it was fetched from.
        let atom = br#"<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<title>B</title><id>b</id><updated>2026-10-01T00:00:00Z</updated>
<link rel="hub" href="/hub" /></feed>"#;
        let parsed = parse(atom, &url("https://example.com/atom.xml")).unwrap();
        assert_eq!(
            parsed.hub,
            Some(Hub {
                hub: url("https://example.com/hub"),
                topic: url("https://example.com/atom.xml"),
            })
        );
        // No hub, or one that isn't a web address: none.
        let plain =
            br#"<?xml version="1.0"?><rss version="2.0"><channel><title>C</title></channel></rss>"#;
        assert_eq!(
            parse(plain, &url("https://example.com/c")).unwrap().hub,
            None
        );
        let odd = br#"<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<title>D</title><id>d</id><updated>2026-10-01T00:00:00Z</updated>
<link rel="hub" href="mailto:hub@example.com" /></feed>"#;
        assert_eq!(parse(odd, &url("https://example.com/d")).unwrap().hub, None);
    }

    #[test]
    fn unsafe_content_is_cleaned_before_it_is_stored() {
        let rss = br#"<?xml version="1.0"?>
<rss version="2.0"><channel><title>A &amp; B</title><link>https://example.com/</link>
<item><title>First</title><link>/first</link>
<description><![CDATA[<p onclick="x()">Hi <script>alert(1)</script><a href="/more">more</a></p><iframe src="https://evil.example"></iframe>]]></description>
</item></channel></rss>"#;
        let feed = parse(rss, &url("https://example.com/feed.xml")).unwrap();
        assert_eq!(feed.title, "A & B");
        assert_eq!(feed.site_url.as_deref(), Some("https://example.com/"));
        let article = &feed.articles[0];
        assert_eq!(article.link.as_deref(), Some("https://example.com/first"));
        let summary = article.summary.as_deref().unwrap();
        for unsafe_part in ["script", "onclick", "iframe", "alert"] {
            assert!(!summary.contains(unsafe_part), "{summary}");
        }
        assert!(
            summary.contains(r#"href="https://example.com/more""#),
            "{summary}"
        );
        assert!(summary.contains("noopener"), "{summary}");
        assert!(summary.contains(r#"target="_blank""#), "{summary}");
    }

    #[test]
    fn authors_are_names_never_email_addresses() {
        assert_eq!(
            author_name("a@b.example (Asha Rao)").as_deref(),
            Some("Asha Rao")
        );
        assert_eq!(author_name("(Asha Rao)").as_deref(), Some("Asha Rao"));
        assert_eq!(author_name(" Asha Rao ").as_deref(), Some("Asha Rao"));
        assert_eq!(
            author_name("Jane Doe (Editor)").as_deref(),
            Some("Jane Doe (Editor)")
        );
        assert_eq!(author_name("a@b.example"), None);
        assert_eq!(author_name("  "), None);
    }

    #[test]
    fn footnotes_keep_working_inside_the_article() {
        let rss = br##"<?xml version="1.0"?>
<rss version="2.0"><channel><title>T</title><link>https://example.com/</link>
<item><title>First</title><link>https://example.com/first</link>
<description><![CDATA[<p>Words<sup><a href="#fn1" id="ref1">1</a></sup></p><p id="fn1">The note. <a href="#ref1">Back</a></p>]]></description>
</item></channel></rss>"##;
        let feed = parse(rss, &url("https://example.com/feed.xml")).unwrap();
        let summary = feed.articles[0].summary.as_deref().unwrap();
        for kept in [
            r##"href="#article-fn1""##,
            r#"id="article-fn1""#,
            r##"href="#article-ref1""##,
            r#"id="article-ref1""#,
        ] {
            assert!(summary.contains(kept), "{kept}: {summary}");
        }
    }

    #[test]
    fn relative_addresses_are_made_whole_from_the_article_then_the_feed() {
        let rss = br#"<?xml version="1.0"?>
<rss version="2.0"><channel><title>T</title><link>https://example.com/</link>
<item><title>Linked</title><link>https://blog.example/posts/2026/first</link>
<description><![CDATA[<img src="//cdn.example/x.png" alt="1"><img src="../pics/y.png" alt="2"><img src="z.png" alt="3"><a href="/about">a</a><a href="../up">b</a>]]></description>
</item>
<item><title>Unlinked</title>
<description><![CDATA[<img src="//cdn.example/x.png" alt="1"><img src="../pics/y.png" alt="2"><a href="more">c</a>]]></description>
</item></channel></rss>"#;
        let feed = parse(rss, &url("http://feeds.example/blog/rss.xml")).unwrap();
        let linked = feed.articles[0].summary.as_deref().unwrap();
        for whole in [
            r#"src="https://cdn.example/x.png""#,
            r#"src="https://blog.example/posts/pics/y.png""#,
            r#"src="https://blog.example/posts/2026/z.png""#,
            r#"href="https://blog.example/about""#,
            r#"href="https://blog.example/posts/up""#,
        ] {
            assert!(linked.contains(whole), "{whole}: {linked}");
        }
        // With no link of its own, the feed's address is used.
        let unlinked = feed.articles[1].summary.as_deref().unwrap();
        for whole in [
            r#"src="http://cdn.example/x.png""#,
            r#"src="http://feeds.example/pics/y.png""#,
            r#"href="http://feeds.example/blog/more""#,
        ] {
            assert!(unlinked.contains(whole), "{whole}: {unlinked}");
        }
    }

    #[test]
    fn a_feeds_tracking_image_never_reaches_the_database() {
        let rss = br#"<?xml version="1.0"?>
<rss version="2.0"><channel><title>T</title><link>https://example.com/</link>
<item><title>First</title><link>/first</link>
<description><![CDATA[<p>Words<img src="https://pixel.example/p.gif?id=7" width="1" height="1" /></p><img src="/photo.jpg" alt="Photo">]]></description>
</item></channel></rss>"#;
        let feed = parse(rss, &url("https://example.com/feed.xml")).unwrap();
        let summary = feed.articles[0].summary.as_deref().unwrap();
        assert!(!summary.contains("pixel.example"), "{summary}");
        assert!(
            summary.contains(r#"src="https://example.com/photo.jpg""#),
            "{summary}"
        );
    }

    #[test]
    fn a_youtube_videos_description_is_its_text() {
        let atom = br#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>A Channel</title>
 <link rel="alternate" href="https://www.youtube.com/channel/UC123"/>
 <entry>
  <id>yt:video:dQw4w9WgXcQ</id>
  <yt:videoId>dQw4w9WgXcQ</yt:videoId>
  <title>A video</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"/>
  <published>2026-10-01T10:00:00+00:00</published>
  <media:group>
   <media:title>A video</media:title>
   <media:content url="https://www.youtube.com/v/dQw4w9WgXcQ?version=3" type="application/x-shockwave-flash" width="640" height="390"/>
   <media:description>First line &lt;b&gt;not bold&lt;/b&gt;
More at https://example.com/notes

Second paragraph</media:description>
  </media:group>
 </entry>
</feed>"#;
        let feed = parse(
            atom,
            &url("https://www.youtube.com/feeds/videos.xml?channel_id=UC123"),
        )
        .unwrap();
        let content = feed.articles[0].content.as_deref().unwrap();
        assert!(content.starts_with("<p>First line &lt;b&gt;not bold&lt;/b&gt;<br>More at <a href=\"https://example.com/notes\""), "{content}");
        assert!(content.contains("noopener"), "{content}");
        assert!(content.ends_with("<p>Second paragraph</p>"), "{content}");
    }

    #[test]
    fn a_media_description_is_text_only_for_a_youtube_video() {
        let rss = br#"<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Photos</title>
<item><title>A photo</title><link>https://example.com/photo</link>
<media:content url="https://example.com/a.jpg" medium="image"><media:description>A caption</media:description></media:content>
</item></channel></rss>"#;
        let feed = parse(rss, &url("https://example.com/feed.xml")).unwrap();
        assert_eq!(feed.articles[0].content, None);
    }

    #[test]
    fn an_rss_enclosure_with_itunes_tags_is_an_episode() {
        let rss = br#"<?xml version="1.0"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
<title>Slow Radio</title><link>https://radio.example/</link>
<itunes:image href="https://radio.example/show.jpg"/>
<item><title>Episode 1</title><link>https://radio.example/1</link><guid>ep-1</guid>
<description>Show notes</description>
<enclosure url="/audio/1.mp3" length="12345678" type="audio/mpeg"/>
<itunes:duration>1:02:03</itunes:duration>
<itunes:image href="https://radio.example/1.jpg"/>
</item>
<item><title>Episode 2</title><guid>ep-2</guid>
<enclosure url="https://cdn.example/2.m4a" length="" type=""/>
<itunes:duration>754</itunes:duration>
</item>
<item><title>A video</title><guid>v</guid>
<enclosure url="https://cdn.example/v.mp4" length="9" type="video/mp4"/>
</item>
<item><title>Not on the web</title><guid>f</guid>
<enclosure url="ftp://cdn.example/f.mp3" type="audio/mpeg"/>
</item>
</channel></rss>"#;
        let feed = parse(rss, &url("https://radio.example/feed.xml")).unwrap();
        assert_eq!(
            feed.articles[0].episode,
            Some(Episode {
                url: "https://radio.example/audio/1.mp3".to_owned(),
                media_type: Some("audio/mpeg".to_owned()),
                bytes: Some(12_345_678),
                seconds: Some(3723),
                artwork: Some("https://radio.example/1.jpg".to_owned()),
            })
        );
        // No type: its ending says audio. No picture of its own: the podcast's.
        assert_eq!(
            feed.articles[1].episode,
            Some(Episode {
                url: "https://cdn.example/2.m4a".to_owned(),
                media_type: None,
                bytes: None,
                seconds: Some(754),
                artwork: Some("https://radio.example/show.jpg".to_owned()),
            })
        );
        // A video, and an address that isn't on the web, are no episodes.
        assert_eq!(feed.articles[2].episode, None);
        assert_eq!(feed.articles[3].episode, None);
        // The show notes are the article's text, as for any article.
        assert!(
            feed.articles[0]
                .summary
                .as_deref()
                .unwrap()
                .contains("Show notes")
        );
    }

    #[test]
    fn show_notes_that_quote_itunes_tags_are_left_as_written() {
        // Show notes explaining how to add a picture quote the tag in CDATA
        // (survey A9.10): the workaround for feed-rs must leave it alone.
        let rss = br#"<?xml version="1.0"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
<title>Podcasting tips</title><link>https://tips.example/</link>
<item><title>Artwork</title><guid>a</guid>
<description><![CDATA[<p>Add <code><itunes:image href="..."/></code> and <code><itunes:duration>30:00</itunes:duration></code> to each episode.</p>]]></description>
<enclosure url="https://tips.example/a.mp3" type="audio/mpeg"/>
<itunes:duration>30:00</itunes:duration>
</item>
</channel></rss>"#;
        let feed = parse(rss, &url("https://tips.example/feed.xml")).unwrap();
        let notes = feed.articles[0].summary.as_deref().unwrap();
        assert!(!notes.contains("<code>-"), "{notes}");
        assert!(!notes.contains("0:30:00"), "{notes}");
        // Outside the notes the workaround still works.
        assert_eq!(
            feed.articles[0].episode.as_ref().unwrap().seconds,
            Some(1800)
        );
    }

    #[test]
    fn itunes_durations_are_read_in_every_usual_form() {
        let seconds = |duration: &str| {
            let rss = format!(
                r#"<?xml version="1.0"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
<title>P</title><item><title>E</title><guid>e</guid>
<enclosure url="https://p.example/e.mp3" type="audio/mpeg"/>
<itunes:duration>{duration}</itunes:duration></item></channel></rss>"#
            );
            parse(rss.as_bytes(), &url("https://p.example/feed"))
                .unwrap()
                .articles[0]
                .episode
                .as_ref()
                .unwrap()
                .seconds
        };
        assert_eq!(seconds("1:02:03"), Some(3723));
        assert_eq!(seconds("30:00"), Some(1800));
        assert_eq!(seconds(" 5:07 "), Some(307));
        assert_eq!(seconds("754"), Some(754));
        assert_eq!(seconds(""), None);
        assert_eq!(seconds("soon"), None);
    }

    #[test]
    fn an_atom_enclosure_link_is_an_episode() {
        let atom = br#"<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<title>Talks</title><id>t</id><updated>2026-10-01T00:00:00Z</updated>
<entry><title>A talk</title><id>talk-1</id><updated>2026-10-01T00:00:00Z</updated>
<link rel="alternate" type="text/html" href="https://talks.example/1"/>
<link rel="enclosure" type="audio/ogg" length="2048" href="https://talks.example/1.ogg"/>
<content type="html">&lt;p&gt;Notes&lt;/p&gt;</content>
</entry>
<entry><title>Slides</title><id>talk-2</id><updated>2026-10-01T00:00:00Z</updated>
<link rel="enclosure" type="application/pdf" href="https://talks.example/2.pdf"/>
</entry></feed>"#;
        let feed = parse(atom, &url("https://talks.example/feed")).unwrap();
        let first = &feed.articles[0];
        assert_eq!(first.link.as_deref(), Some("https://talks.example/1"));
        assert_eq!(
            first.episode,
            Some(Episode {
                url: "https://talks.example/1.ogg".to_owned(),
                media_type: Some("audio/ogg".to_owned()),
                bytes: Some(2048),
                seconds: None,
                artwork: None,
            })
        );
        assert_eq!(feed.articles[1].episode, None);
    }

    #[test]
    fn a_json_feed_audio_attachment_is_an_episode_and_never_the_articles_link() {
        let json = br#"{"version": "https://jsonfeed.org/version/1.1", "title": "Pod",
            "icon": "https://pod.example/icon.png",
            "items": [
              {"id": "1", "url": "https://pod.example/1", "content_html": "<p>Notes</p>",
               "attachments": [{"url": "https://pod.example/1.opus", "mime_type": "audio/opus",
                                "size_in_bytes": 999, "duration_in_seconds": 61}]},
              {"id": "2", "content_text": "Only audio",
               "attachments": [{"url": "https://pod.example/2.mp3", "mime_type": "audio/mpeg"}]},
              {"id": "3", "content_text": "A picture",
               "attachments": [{"url": "https://pod.example/3.jpg", "mime_type": "image/jpeg"}]}
            ]}"#;
        let feed = parse(json, &url("https://pod.example/feed.json")).unwrap();
        let first = &feed.articles[0];
        assert_eq!(first.link.as_deref(), Some("https://pod.example/1"));
        let episode = first.episode.as_ref().unwrap();
        assert_eq!(episode.url, "https://pod.example/1.opus");
        assert_eq!(episode.media_type.as_deref(), Some("audio/opus"));
        assert_eq!(episode.bytes, Some(999));
        // An item with no page of its own has no link: its audio file never stands in for one.
        assert_eq!(feed.articles[1].link, None);
        assert_eq!(
            feed.articles[1]
                .episode
                .as_ref()
                .map(|episode| episode.url.as_str()),
            Some("https://pod.example/2.mp3")
        );
        assert_eq!(feed.articles[2].episode, None);
    }

    #[test]
    fn only_audio_counts_and_only_web_addresses_are_kept() {
        let base = url("https://example.com/feed");
        assert!(is_audio(Some("audio/mpeg"), &url("https://example.com/a")));
        assert!(is_audio(Some(" Audio/MP4 "), &url("https://example.com/a")));
        assert!(!is_audio(
            Some("video/mp4"),
            &url("https://example.com/a.mp3")
        ));
        for ending in ["a.mp3", "a.M4A", "a.aac", "a.ogg", "a.opus"] {
            assert!(is_audio(None, &base.join(ending).unwrap()), "{ending}");
        }
        assert!(!is_audio(None, &url("https://example.com/a.mp4")));
        assert_eq!(
            web_address(&base, "/a.mp3").as_deref(),
            Some("https://example.com/a.mp3")
        );
        assert_eq!(web_address(&base, "javascript:alert(1)"), None);
        assert_eq!(web_address(&base, "data:audio/mpeg;base64,AAAA"), None);
        let long = format!("https://example.com/{}.mp3", "a".repeat(3000));
        assert_eq!(web_address(&base, &long), None);
    }

    #[test]
    fn a_web_page_is_not_a_feed() {
        assert!(
            parse(
                b"<!doctype html><html><body>Hi</body></html>",
                &url("https://example.com/")
            )
            .is_none()
        );
    }
}
