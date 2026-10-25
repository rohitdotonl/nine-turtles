//! Reading a feed file (RSS, Atom or JSON Feed) into what nine turtles stores,
//! and giving each article its fingerprint (ENGINEERING.md → "Duplicates").
//!
//! Article content is cleaned here, before it's ever stored, so nothing
//! unsafe from a feed can reach the screen later (the engineering floor).
//! Invisible 1×1 tracking images are taken out at the same time (DESIGN.md →
//! "Article view"). A YouTube video's own description becomes its text, and a
//! YouTube player embedded in an article becomes a link to the video (SPEC
//! section 7, decision 0067).

use std::borrow::Cow;

use blake2::{Blake2s256, Digest};
use reqwest::Url;

/// One feed, as read from its file.
#[derive(Debug)]
pub struct ParsedFeed {
    pub title: String,
    /// The publisher's website, for credit and "Open original".
    pub site_url: Option<String>,
    pub language: Option<String>,
    pub articles: Vec<ParsedArticle>,
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
}

/// Reads a feed file. `None` means it isn't a feed (often a web page).
pub fn parse(body: &[u8], feed_url: &Url) -> Option<ParsedFeed> {
    // An empty ID means "the feed gave none", so nine turtles' own fingerprint
    // rules decide, rather than feed-rs's made-up one.
    let parser = feed_rs::parser::Builder::new()
        .base_uri(Some(feed_url.as_str()))
        .id_generator(|_, _, _| String::new())
        .build();
    let feed = parser.parse(body).ok()?;

    let site_url = feed
        .links
        .iter()
        .find(|link| link.rel.as_deref().is_none_or(|rel| rel == "alternate"))
        .and_then(|link| feed_url.join(&link.href).ok())
        .filter(|url| matches!(url.scheme(), "http" | "https"))
        .map(String::from);
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
            let link = entry
                .links
                .iter()
                .find(|link| link.rel.as_deref().is_none_or(|rel| rel == "alternate"))
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
            ParsedArticle {
                fingerprint: fingerprint(&entry.id, link.as_ref(), &title, published),
                title,
                link: link.map(String::from),
                author: entry
                    .authors
                    .first()
                    .and_then(|person| person.name.as_deref())
                    .and_then(author_name),
                content,
                summary,
                language: entry.language.or_else(|| feed.language.clone()),
                published_at: published,
            }
        })
        .collect();

    Some(ParsedFeed {
        title,
        site_url,
        language: feed.language,
        articles,
    })
}

/// The feed's own item ID; otherwise the normalized link; otherwise a hash
/// of title plus date.
pub fn fingerprint(id: &str, link: Option<&Url>, title: &str, published: Option<i64>) -> String {
    let id = id.trim();
    if !id.is_empty() {
        return format!("id:{id}");
    }
    if let Some(link) = link {
        return format!("link:{}", normalize(link));
    }
    let digest = Blake2s256::digest(format!("{title}\n{}", published.unwrap_or(0)).as_bytes());
    let hex: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
    format!("hash:{hex}")
}

/// Query parts added by newsletters and social sites to track clicks. They
/// don't change which page a link leads to.
const TRACKING: &[&str] = &[
    "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid", "ref_src",
];

/// The same page written two ways becomes one text: `http` and `https` are
/// treated alike, as are a trailing `#part`, tracking parts of the query and
/// a final slash.
pub fn normalize(url: &Url) -> String {
    let mut url = url.clone();
    url.set_fragment(None);
    let kept: Vec<(String, String)> = url
        .query_pairs()
        .filter(|(name, _)| {
            let name = name.to_ascii_lowercase();
            !name.starts_with("utm_") && !TRACKING.contains(&name.as_str())
        })
        .map(|(name, value)| (name.into_owned(), value.into_owned()))
        .collect();
    if kept.is_empty() {
        url.set_query(None);
    } else {
        url.query_pairs_mut().clear().extend_pairs(kept);
    }
    let text = String::from(url);
    let text = text
        .strip_prefix("https://")
        .or_else(|| text.strip_prefix("http://"))
        .unwrap_or(&text);
    text.trim_end_matches('/').to_owned()
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

/// Content made safe to show: no scripts, styles, frames or event handlers;
/// no tracking images; links open safely, in a new tab, without telling the
/// site where the reader came from; relative addresses made whole. Plain
/// text is escaped. Footnotes keep working inside nine turtles: the article's
/// own anchors (`id`, `#note-1`) are kept, renamed with `article-` in front
/// so they can never clash with nine turtles' own page.
fn clean(body: &str, content_type: &str, base: &Url) -> String {
    if !content_type.contains("html") {
        return ammonia::clean_text(body);
    }
    // Tracking images and YouTube players go first, so the safety cleaning
    // always has the last word. Marks only nine turtles writes (below).
    let body = body.replace(VIDEO_MARK, "");
    let body = without_youtube_players(&without_tracking_images(&body));
    let cleaned = ammonia::Builder::default()
        .url_relative(ammonia::UrlRelative::Custom(Box::new(Whole(base.clone()))))
        .add_generic_attributes(["id"])
        .id_prefix(Some(ANCHOR_PREFIX))
        .set_tag_attribute_value("a", "target", "_blank")
        .clean(&body)
        .to_string();
    with_video_links(&cleaned)
}

/// The video a YouTube address shows, as its 11-character ID: a watch page
/// (`youtube.com/watch?v=…`), a short link (`youtu.be/…`), a Short, a live
/// video or an embedded player. Anything else is `None`.
pub fn youtube_video(url: &Url) -> Option<String> {
    let host = url
        .host_str()?
        .trim_start_matches("www.")
        .trim_start_matches("m.");
    let mut path = url.path_segments()?;
    let id = match (host, path.next()?) {
        ("youtu.be", id) => id.to_owned(),
        ("youtube.com", "watch") => url
            .query_pairs()
            .find(|(name, _)| name == "v")
            .map(|(_, id)| id.into_owned())?,
        ("youtube.com" | "youtube-nocookie.com", "shorts" | "live" | "embed" | "v") => {
            path.next()?.to_owned()
        }
        _ => return None,
    };
    let valid = id.len() == 11
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_');
    valid.then_some(id)
}

/// Stands in for a YouTube player embedded in an article until the safety
/// cleaning is done: a character no article uses, the video's ID, the same
/// character again. `with_video_links` then puts a link to the video there.
const VIDEO_MARK: char = '\u{E000}';

/// The same HTML with each embedded YouTube player swapped for a mark (see
/// `VIDEO_MARK`), so the reader still finds the video: the safety cleaning
/// removes every frame, and would otherwise leave nothing in its place.
fn without_youtube_players(html: &str) -> String {
    if !html.contains("<iframe") && !html.contains("<IFRAME") {
        return html.to_owned();
    }
    let mut document = scraper::Html::parse_fragment(html);
    let frames = scraper::Selector::parse("iframe").expect("a fixed, valid selector");
    let players: Vec<_> = document
        .select(&frames)
        .filter_map(|frame| {
            let source = frame.value().attr("src")?;
            // An address starting `//` takes the article's own scheme.
            let source = source
                .strip_prefix("//")
                .map_or(source.to_owned(), |rest| format!("https://{rest}"));
            Some((frame.id(), youtube_video(&Url::parse(&source).ok()?)?))
        })
        .collect();
    if players.is_empty() {
        return html.to_owned();
    }
    for (id, video) in players {
        if let Some(mut node) = document.tree.get_mut(id) {
            node.insert_after(scraper::Node::Text(scraper::node::Text {
                text: format!("{VIDEO_MARK}{video}{VIDEO_MARK}").into(),
            }));
            node.detach();
        }
    }
    document.root_element().inner_html()
}

/// Puts a link to the video where each mark is. Any mark a feed wrote itself
/// was taken out before, so each one left is in plain text, where a link can
/// go; only a valid video ID becomes one.
fn with_video_links(html: &str) -> String {
    if !html.contains(VIDEO_MARK) {
        return html.to_owned();
    }
    let mut parts = html.split(VIDEO_MARK);
    let mut out = parts.next().unwrap_or_default().to_owned();
    let mut rest: Vec<&str> = parts.collect();
    rest.reverse();
    while let Some(part) = rest.pop() {
        let watch = Url::parse(&format!("https://www.youtube.com/watch?v={part}")).ok();
        let closed = !rest.is_empty();
        match watch.as_ref().and_then(youtube_video) {
            Some(video) if closed && video == part => {
                out.push_str(&format!(
                    r#"<a href="https://www.youtube.com/watch?v={video}" target="_blank" rel="noopener noreferrer">Watch the video on YouTube</a>"#
                ));
                out.push_str(rest.pop().unwrap_or_default());
            }
            _ => out.push_str(part),
        }
    }
    out
}

/// Plain text with line breaks (a video's description) as HTML paragraphs,
/// its web addresses as links. The result still goes through the safety
/// cleaning.
fn paragraphs(text: &str) -> String {
    let escape = |text: &str| {
        text.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
    };
    let line = |line: &str| {
        line.split(' ')
            .map(|word| match Url::parse(word) {
                Ok(url) if matches!(url.scheme(), "http" | "https") => {
                    format!(r#"<a href="{0}">{0}</a>"#, escape(word))
                }
                _ => escape(word),
            })
            .collect::<Vec<_>>()
            .join(" ")
    };
    text.replace("\r\n", "\n")
        .split("\n\n")
        .map(str::trim)
        .filter(|paragraph| !paragraph.is_empty())
        .map(|paragraph| {
            format!(
                "<p>{}</p>",
                paragraph.lines().map(line).collect::<Vec<_>>().join("<br>")
            )
        })
        .collect()
}

/// Makes an article's relative addresses whole, using its own address;
/// `#anchor` links stay inside the article, renamed like the anchors.
struct Whole(Url);

impl<'a> ammonia::UrlRelativeEvaluate<'a> for Whole {
    fn evaluate<'url>(&self, url: &'url str) -> Option<Cow<'url, str>> {
        if let Some(anchor) = url.strip_prefix('#') {
            return Some(Cow::Owned(format!("#{ANCHOR_PREFIX}{anchor}")));
        }
        self.0.join(url).ok().map(|url| Cow::Owned(url.into()))
    }
}

/// Put in front of every anchor in an article. The screen scrolls to these
/// itself rather than opening a new tab (ArticleView.svelte).
const ANCHOR_PREFIX: &str = "article-";

/// The same HTML without invisible tracking images: images whose width or
/// height is set to 0 or 1 pixel, and neither bigger. They show nothing and
/// only tell someone that the article was opened. Anything else is left
/// exactly as it was.
pub fn without_tracking_images(html: &str) -> String {
    if !html.contains("<img") && !html.contains("<IMG") {
        return html.to_owned();
    }
    let mut document = scraper::Html::parse_fragment(html);
    let images = scraper::Selector::parse("img").expect("a fixed, valid selector");
    let pixels: Vec<_> = document
        .select(&images)
        .filter(|image| {
            // A size that isn't plain pixels (`100%`, `auto`) counts as bigger.
            let sizes: Vec<Option<u32>> = ["width", "height"]
                .iter()
                .filter_map(|name| image.value().attr(name))
                .map(pixels)
                .collect();
            !sizes.is_empty() && sizes.iter().all(|size| size.is_some_and(|size| size <= 1))
        })
        .map(|image| image.id())
        .collect();
    if pixels.is_empty() {
        return html.to_owned();
    }
    for id in pixels {
        if let Some(mut node) = document.tree.get_mut(id) {
            node.detach();
        }
    }
    document.root_element().inner_html()
}

/// A size written as `1`, `1px` or ` 1 `, in whole pixels.
fn pixels(text: &str) -> Option<u32> {
    let text = text.trim();
    text.strip_suffix("px").unwrap_or(text).trim().parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(text: &str) -> Url {
        Url::parse(text).unwrap()
    }

    #[test]
    fn the_same_page_written_differently_gets_one_fingerprint() {
        let plain = normalize(&url("https://example.com/post/1"));
        for variant in [
            "http://example.com/post/1",
            "https://example.com/post/1/",
            "https://EXAMPLE.com/post/1#comments",
            "https://example.com/post/1?utm_source=rss&utm_medium=feed",
            "https://example.com/post/1?fbclid=abc",
        ] {
            assert_eq!(normalize(&url(variant)), plain, "{variant}");
        }
        assert_ne!(normalize(&url("https://example.com/post/1?page=2")), plain);
    }

    #[test]
    fn fingerprints_prefer_the_feeds_id_then_the_link_then_title_and_date() {
        let link = url("https://example.com/a");
        assert_eq!(fingerprint(" tag:1 ", Some(&link), "A", None), "id:tag:1");
        assert_eq!(
            fingerprint("", Some(&link), "A", None),
            "link:example.com/a"
        );
        let first = fingerprint("", None, "A", Some(1));
        assert!(first.starts_with("hash:"));
        assert_eq!(first, fingerprint("", None, "A", Some(1)));
        assert_ne!(first, fingerprint("", None, "A", Some(2)));
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
    fn tracking_images_are_removed_and_real_images_kept() {
        let html = r#"<p>Hello</p><img src="https://t.example/open.gif" width="1" height="1">
<img src="https://t.example/b.gif" WIDTH="0" height="0px" alt=""><img src="https://t.example/c.gif" height="1">
<figure><img src="https://example.com/photo.jpg" width="800" height="600" alt="A river"></figure>
<img src="https://example.com/wide-rule.png" width="600" height="1"><img src="https://example.com/plain.png">
<img src="https://example.com/full-rule.png" width="100%" height="1">"#;
        let cleaned = without_tracking_images(html);
        for pixel in ["open.gif", "b.gif", "c.gif"] {
            assert!(!cleaned.contains(pixel), "{cleaned}");
        }
        for kept in [
            "<p>Hello</p>",
            "photo.jpg",
            "A river",
            "wide-rule.png",
            "plain.png",
            "<figure>",
        ] {
            assert!(cleaned.contains(kept), "{kept}: {cleaned}");
        }
        // Without tracking images, nothing changes at all.
        let plain = "<p>Just <b>words</b>, and <img src=\"a.png\" width=\"40\"></p>";
        assert_eq!(without_tracking_images(plain), plain);
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
    fn youtube_addresses_name_their_video() {
        for address in [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
            "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ?t=42",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0",
            "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
        ] {
            assert_eq!(
                youtube_video(&url(address)).as_deref(),
                Some("dQw4w9WgXcQ"),
                "{address}"
            );
        }
        for address in [
            "https://www.youtube.com/",
            "https://www.youtube.com/@channel",
            "https://www.youtube.com/watch?v=short",
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ%22onload",
            "https://example.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be.example.com/dQw4w9WgXcQ",
        ] {
            assert_eq!(youtube_video(&url(address)), None, "{address}");
        }
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
    fn an_embedded_youtube_player_becomes_a_link_to_the_video() {
        let html = clean(
            "<p>Watch this:</p><iframe src=\"//www.youtube.com/embed/dQw4w9WgXcQ\" onload=\"x()\"></iframe>\
             <iframe src=\"https://evil.example/embed/dQw4w9WgXcQ\"></iframe>\
             <p title=\"\u{E000}dQw4w9WgXcQ\u{E000}\">\u{E000}abc\u{E000}</p>",
            "html",
            &url("https://example.com/post"),
        );
        assert_eq!(
            html,
            "<p>Watch this:</p><a href=\"https://www.youtube.com/watch?v=dQw4w9WgXcQ\" target=\"_blank\" rel=\"noopener noreferrer\">Watch the video on YouTube</a>\
             <p title=\"dQw4w9WgXcQ\">abc</p>"
        );
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
