//! Cleaning article content before it is stored (the engineering floor).

use std::borrow::Cow;

use reqwest::Url;

use super::*;

/// Content made safe to show: no scripts, styles, frames or event handlers;
/// no tracking images and no tracking tags on links (`without_trackers`);
/// pictures load only as the reader reaches them; links open safely, in a new tab, without telling the
/// site where the reader came from; relative addresses made whole. Plain
/// text is escaped. Footnotes keep working inside nine turtles: the article's
/// own anchors (`id`, `#note-1`) are kept, renamed with `article-` in front
/// so they can never clash with nine turtles' own page.
pub(crate) fn clean(body: &str, content_type: &str, base: &Url) -> String {
    if !content_type.contains("html") {
        return ammonia::clean_text(body);
    }
    // Trackers and YouTube players go first, so the safety cleaning always
    // has the last word.
    let body = without_youtube_players(&without_trackers(body, Some(base)));
    ammonia::Builder::default()
        .url_relative(ammonia::UrlRelative::Custom(Box::new(Whole(base.clone()))))
        .add_generic_attributes(["id"])
        .id_prefix(Some(ANCHOR_PREFIX))
        .set_tag_attribute_value("a", "target", "_blank")
        // `without_trackers` gave every picture these two; whatever else
        // they say becomes the same fixed values. (Not ammonia's own "set
        // this value", which writes them in a different order each time,
        // so a refetched article would always look edited.)
        .add_tag_attributes("img", ["loading", "decoding"])
        .attribute_filter(|element, attribute, value| match (element, attribute) {
            ("img", "loading") => Some(Cow::Borrowed(LAZY.0)),
            ("img", "decoding") => Some(Cow::Borrowed(LAZY.1)),
            _ => Some(Cow::Borrowed(value)),
        })
        .clean(&body)
        .to_string()
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
    // An embedded playlist (`embed/videoseries?list=…`) isn't one video.
    let valid = matches!(url.scheme(), "http" | "https")
        && id != "videoseries"
        && id.len() == 11
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_');
    valid.then_some(id)
}

/// Stands in for a YouTube player embedded in an article while the article
/// is rewritten: a character no article uses, the video's ID, the same
/// character again. `with_video_links` then puts a link to the video there.
const VIDEO_MARK: char = '\u{E000}';

/// The same HTML with each embedded YouTube player swapped for a mark (see
/// `VIDEO_MARK`), so the reader still finds the video: the safety cleaning
/// removes every frame, and would otherwise leave nothing in its place. The
/// links go in before the safety cleaning, which checks them like any other.
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
    with_video_links(&document.root_element().inner_html())
}

/// Puts a link to the video where each mark is; only a valid video ID
/// becomes one. A mark a feed wrote itself can at most make a link like
/// it could have written anyway, and the safety cleaning comes after.
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
pub(crate) fn paragraphs(text: &str) -> String {
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

/// Pictures from these places are never shown: they come from advertising,
/// analytics and tracking services, and only tell them that someone opened
/// the article. A name matches that domain and every address under it
/// (`doubleclick.net` also blocks `ad.doubleclick.net`); one with a path
/// (`facebook.com/tr`) matches only that path and what's below it, so the
/// same site's real pictures still show. The list is nine turtles' own,
/// short and kept by hand from the trackers most often found in feeds and
/// newsletters (SPEC section 7, decision 0112). Add to it as needed, but
/// never block a place that also serves real pictures (`i0.wp.com` is
/// WordPress's picture store, so only `pixel.wp.com` and `stats.wp.com` are
/// listed). A whole domain is listed only when it does nothing but serve
/// ads or count visits; a company that also has its own website and blog
/// (`taboola.com`, `criteo.com`) is listed by its ad and counting
/// addresses alone, so its own articles keep their pictures.
const TRACKERS: &[&str] = &[
    // Advertising
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com",
    "amazon-adsystem.com",
    "adnxs.com",
    "adform.net",
    "criteo.net",
    "dis.criteo.com",
    "sslwidget.criteo.com",
    "moatads.com",
    "ads.pubmatic.com",
    "image2.pubmatic.com",
    "simage2.pubmatic.com",
    "pixel.rubiconproject.com",
    "fastlane.rubiconproject.com",
    "cdn.taboola.com",
    "trc.taboola.com",
    "images.taboola.com",
    "widgets.outbrain.com",
    "amplify.outbrain.com",
    "tr.outbrain.com",
    "outbrainimg.com",
    // Analytics and audience measurement
    "google-analytics.com",
    "googletagmanager.com",
    "scorecardresearch.com",
    "quantserve.com",
    "static.chartbeat.com",
    "chartbeat.net",
    "pixel.parsely.com",
    "bat.bing.com",
    "px.ads.linkedin.com",
    "analytics.twitter.com",
    "facebook.com/tr",
    // Blog and newsletter platforms' own open counters
    "pixel.wp.com",
    "stats.wp.com",
    "list-manage.com/track",
    "eotrx.substackcdn.com",
    "feeds.feedburner.com/~r",
    "feeds.feedburner.com/~ff",
    "feedproxy.google.com/~r",
];

/// Whether an address belongs to a known tracker (`TRACKERS`).
fn is_tracker(url: &Url) -> bool {
    let Some(host) = url.host_str() else {
        return false;
    };
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    let path = url.path().trim_start_matches('/');
    TRACKERS.iter().any(|entry| {
        let (domain, below) = entry
            .split_once('/')
            .map_or((*entry, None), |(domain, below)| (domain, Some(below)));
        let place = host == domain
            || host
                .strip_suffix(domain)
                .is_some_and(|start| start.ends_with('.'));
        place
            && below.is_none_or(|below| {
                path == below
                    || path
                        .strip_prefix(below)
                        .is_some_and(|rest| rest.starts_with('/'))
            })
    })
}

/// What every picture in an article is given: load only once the reader
/// is nearly there (`loading`), and without holding up the text
/// (`decoding`).
const LAZY: (&str, &str) = ("lazy", "async");

/// The same HTML without trackers, ready to read:
/// - invisible tracking images (width or height set to 0 or 1 pixel, and
///   neither bigger) and pictures from known trackers (`TRACKERS`) are
///   taken out: they show nothing and only tell someone the article was
///   opened;
/// - links lose their tracking tags (`without_tracking`);
/// - every picture loads only as the reader reaches it (`LAZY`).
///
/// Relative addresses are read against `base` (the article's address);
/// without one, only whole addresses are looked at. Anything else is left
/// exactly as it was. Used on arrival (`clean`) and again whenever an
/// article is shown, for articles stored before (decision 0112).
pub fn without_trackers(html: &str, base: Option<&Url>) -> String {
    let lower = html.to_ascii_lowercase();
    if !lower.contains("<img") && !lower.contains("<a") {
        return html.to_owned();
    }
    let whole = |address: &str| {
        let address = address.trim();
        match base {
            Some(base) => base.join(address).ok(),
            None => Url::parse(address).ok(),
        }
        .filter(|url| matches!(url.scheme(), "http" | "https"))
    };
    let mut document = scraper::Html::parse_fragment(html);
    let found =
        scraper::Selector::parse("img, a[href], area[href]").expect("a fixed, valid selector");
    let changes: Vec<_> = document
        .select(&found)
        .filter_map(|element| {
            let value = element.value();
            if value.name() != "img" {
                // Only a link's own query is looked at: `#note-1` read
                // against an article address with tags must stay `#note-1`.
                let href = value.attr("href").filter(|href| href.contains('?'))?;
                let link = whole(href)?;
                let clean = without_tracking(link.clone());
                return (clean != link).then(|| (element.id(), Change::Link(clean.into())));
            }
            // A size that isn't plain pixels (`100%`, `auto`) counts as bigger.
            let sizes: Vec<Option<u32>> = ["width", "height"]
                .iter()
                .filter_map(|name| value.attr(name))
                .map(pixels)
                .collect();
            let tiny =
                !sizes.is_empty() && sizes.iter().all(|size| size.is_some_and(|size| size <= 1));
            let tracker = value
                .attr("src")
                .and_then(whole)
                .is_some_and(|url| is_tracker(&url));
            if tiny || tracker {
                return Some((element.id(), Change::Remove));
            }
            let ready =
                value.attr("loading") == Some(LAZY.0) && value.attr("decoding") == Some(LAZY.1);
            (!ready).then(|| (element.id(), Change::Lazy))
        })
        .collect();
    if changes.is_empty() {
        return html.to_owned();
    }
    // The two attributes every picture is given, taken from a picture that
    // has them.
    let lazy = scraper::Html::parse_fragment(&format!(
        r#"<img loading="{}" decoding="{}">"#,
        LAZY.0, LAZY.1
    ));
    let lazy: Vec<_> = lazy
        .select(&scraper::Selector::parse("img").expect("a fixed, valid selector"))
        .next()
        .map(|image| image.value().attrs.clone())
        .unwrap_or_default();
    for (id, change) in changes {
        let Some(mut node) = document.tree.get_mut(id) else {
            continue;
        };
        if let Change::Remove = change {
            node.detach();
            continue;
        }
        let scraper::Node::Element(element) = node.value() else {
            continue;
        };
        match change {
            Change::Link(link) => {
                for (name, value) in &mut element.attrs {
                    if &*name.local == "href" {
                        *value = link.as_str().into();
                    }
                }
            }
            Change::Lazy => {
                element
                    .attrs
                    .retain(|(name, _)| !matches!(&*name.local, "loading" | "decoding"));
                element.attrs.extend(lazy.iter().cloned());
            }
            Change::Remove => {}
        }
    }
    document.root_element().inner_html()
}

/// What `without_trackers` does to one element.
enum Change {
    /// Take it out.
    Remove,
    /// Point the link here instead.
    Link(String),
    /// Give the picture `LAZY`.
    Lazy,
}

/// What stands in for each image in a copy kept for reading offline.
pub const IMAGE_OFFLINE: &str =
    "<span class=\"offline-image\">An image shows here when you\u{2019}re back online.</span>";

/// An article's text without its images, for the copies kept on a device
/// for reading offline (SPEC section 32): only the words are kept, so the
/// copies stay small and nothing is fetched from the publisher. Each image
/// (or picture) becomes a short note saying it appears once the device is
/// back online; a figure's caption stays.
pub fn text_only(html: &str) -> String {
    let lower = html.to_ascii_lowercase();
    if !lower.contains("<img") && !lower.contains("<picture") {
        return html.to_owned();
    }
    // The note goes in as one character the text can't hold, then becomes
    // the note's own markup once the rest is written out.
    const PLACE: char = '\u{FFFC}';
    let html = html.replace(PLACE, "");
    let mut document = scraper::Html::parse_fragment(&html);
    let media = scraper::Selector::parse("img, picture").expect("a fixed, valid selector");
    let found: Vec<_> = document
        .select(&media)
        // An image inside a picture goes with the picture.
        .filter(|found| {
            !found.ancestors().any(|above| {
                above
                    .value()
                    .as_element()
                    .is_some_and(|element| element.name() == "picture")
            })
        })
        .map(|found| found.id())
        .collect();
    for id in found {
        if let Some(mut node) = document.tree.get_mut(id) {
            node.insert_before(scraper::Node::Text(scraper::node::Text {
                text: PLACE.to_string().into(),
            }));
            node.detach();
        }
    }
    document
        .root_element()
        .inner_html()
        .replace(PLACE, IMAGE_OFFLINE)
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
    fn copies_for_reading_offline_keep_the_words_and_leave_out_images() {
        let note = IMAGE_OFFLINE;
        assert_eq!(text_only("<p>Just words.</p>"), "<p>Just words.</p>");
        assert_eq!(
            text_only("<p>Before <img src=\"https://x.example/a.jpg\" alt=\"A\"> after</p>"),
            format!("<p>Before {note} after</p>")
        );
        assert_eq!(
            text_only(
                "<figure><picture><source srcset=\"b.webp\"><img src=\"b.jpg\"></picture>\
                 <figcaption>A heron</figcaption></figure>"
            ),
            format!("<figure>{note}<figcaption>A heron</figcaption></figure>")
        );
        // The stand-in character can't be smuggled in to make extra notes.
        assert_eq!(
            text_only("<p>\u{FFFC}<IMG SRC=\"c.png\"></p>"),
            format!("<p>{note}</p>")
        );
    }

    #[test]
    fn tracking_images_are_removed_and_real_images_kept() {
        let html = r#"<p>Hello</p><img src="https://t.example/open.gif" width="1" height="1">
<img src="https://t.example/b.gif" WIDTH="0" height="0px" alt=""><img src="https://t.example/c.gif" height="1">
<figure><img src="https://example.com/photo.jpg" width="800" height="600" alt="A river"></figure>
<img src="https://example.com/wide-rule.png" width="600" height="1"><img src="https://example.com/plain.png">
<img src="https://example.com/full-rule.png" width="100%" height="1">"#;
        let cleaned = without_trackers(html, None);
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
        // Without trackers, and with pictures already set to load lazily,
        // nothing changes at all.
        let plain = "<p>Just <b>words</b>, <a href=\"https://example.com/?page=2\">a link</a> and \
                     <img src=\"a.png\" width=\"40\" loading=\"lazy\" decoding=\"async\"></p>";
        assert_eq!(without_trackers(plain, None), plain);
        assert_eq!(
            without_trackers("<p>No pictures</p>", None),
            "<p>No pictures</p>"
        );
    }

    #[test]
    fn pictures_from_known_trackers_are_removed_and_others_kept() {
        let html = r#"<img src="https://ad.doubleclick.net/x.gif" alt="">
<img src="https://www.google-analytics.com/collect?v=1" width="10" height="10">
<img src="//stats.wp.com/b.gif"><img src="https://pixel.wp.com/g.gif?x=1">
<img src="https://www.facebook.com/tr?id=1&ev=PageView"><img src="https://facebook.com/tr/">
<img src="https://feeds.feedburner.com/~r/Blog/~4/abc"><img src="https://feeds.feedburner.com/~ff/Blog?d=1">
<img src="https://example.us12.list-manage.com/track/open.php?u=1">
<img src="https://eotrx.substackcdn.com/open?token=1">
<img src="HTTPS://CDN.Taboola.com/a.png">
<img src="https://i0.wp.com/example.com/photo.jpg" alt="Kept">
<img src="https://www.facebook.com/images/logo.png" alt="Also kept">
<img src="https://notdoubleclick.net/x.png" alt="Not a tracker">
<img src="https://doubleclick.net.example.com/x.png" alt="Nor this">
<img src="https://example.com/track/open.php" alt="Nor here">
<img src="https://example.us12.list-manage.com/trackers.png" alt="Not the path">
<img src="https://www.taboola.com/blog/team.jpg" alt="Their own blog">
<img src="https://www.criteo.com/wp-content/office.jpg" alt="Theirs too">
<img src="https://trc.taboola.com/p.gif"><img src="https://widgets.outbrain.com/x.png">"#;
        let cleaned = without_trackers(html, Some(&url("https://example.com/post")));
        for gone in [
            "doubleclick.net/x.gif",
            "google-analytics",
            "stats.wp.com",
            "pixel.wp.com",
            "facebook.com/tr?",
            "facebook.com/tr/",
            "feedburner",
            "open.php?u=1",
            "substackcdn",
            "cdn.taboola",
            "CDN.Taboola",
            "trc.taboola",
            "outbrain",
        ] {
            assert!(!cleaned.contains(gone), "{gone}: {cleaned}");
        }
        for kept in [
            "i0.wp.com",
            "facebook.com/images/logo.png",
            "notdoubleclick.net",
            "doubleclick.net.example.com",
            "example.com/track/open.php",
            "trackers.png",
            "www.taboola.com/blog/team.jpg",
            "www.criteo.com/wp-content/office.jpg",
        ] {
            assert!(cleaned.contains(kept), "{kept}: {cleaned}");
        }
    }

    #[test]
    fn pictures_load_as_the_reader_reaches_them() {
        let html = clean(
            r#"<p><img src="a.png" alt="A" loading="eager" decoding="sync" onload="x()"></p>"#,
            "html",
            &url("https://example.com/post"),
        );
        assert_eq!(
            html,
            r#"<p><img alt="A" src="https://example.com/a.png" decoding="async" loading="lazy"></p>"#
        );
        // The same every time, so an article fetched again isn't taken for
        // an edited one.
        for _ in 0..5 {
            let again = clean(
                r#"<p><img src="a.png" alt="A" loading="eager" decoding="sync" onload="x()"></p>"#,
                "html",
                &url("https://example.com/post"),
            );
            assert_eq!(again, html);
        }
        // An article stored before gets them when it's shown.
        let stored = r#"<p><img src="https://example.com/a.png" alt="A"></p>"#;
        let shown = without_trackers(stored, None);
        assert!(shown.contains(r#"loading="lazy""#), "{shown}");
        assert!(shown.contains(r#"decoding="async""#), "{shown}");
        // Copies kept for reading offline still hold only the words.
        assert_eq!(text_only(&html), format!("<p>{IMAGE_OFFLINE}</p>"));
    }

    #[test]
    fn youtube_addresses_name_their_video() {
        for address in [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
            "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ?t=42",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            "https://www.youtube.com/live/dQw4w9WgXcQ",
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
            "https://www.youtube.com/embed/videoseries?list=PL1",
            "javascript://youtu.be/dQw4w9WgXcQ",
        ] {
            assert_eq!(youtube_video(&url(address)), None, "{address}");
        }
    }

    #[test]
    fn an_embedded_youtube_player_becomes_a_link_to_the_video() {
        let html = clean(
            "<p>Watch this:</p><iframe src=\"//www.youtube.com/embed/dQw4w9WgXcQ\" onload=\"x()\"></iframe>\
             <iframe src=\"https://evil.example/embed/dQw4w9WgXcQ\"></iframe>\
             <iframe src=\"https://www.youtube.com/embed/videoseries?list=PL1\"></iframe>",
            "html",
            &url("https://example.com/post"),
        );
        assert_eq!(
            html,
            "<p>Watch this:</p><a href=\"https://www.youtube.com/watch?v=dQw4w9WgXcQ\" target=\"_blank\" rel=\"noopener noreferrer\">Watch the video on YouTube</a>\
             "
        );
    }

    #[test]
    fn a_feed_writing_the_video_mark_itself_never_gets_past_the_safety_cleaning() {
        // As a character and as an entity, in text and in an attribute, beside a real player.
        let html = clean(
            "<iframe src=\"https://youtu.be/dQw4w9WgXcQ\"></iframe>\
             <img alt=\"A &#xE000;dQw4w9WgXcQ&#xE000; picture\" src=\"a.png\">\
             <p title=\"\u{E000}dQw4w9WgXcQ\u{E000}\">x</p>",
            "html",
            &url("https://example.com/post"),
        );
        // Whatever the marks became, the result is exactly what the safety cleaning makes of it.
        let again = ammonia::Builder::default()
            .add_generic_attributes(["id"])
            .set_tag_attribute_value("a", "target", "_blank")
            .add_tag_attributes("img", ["loading", "decoding"])
            .clean(&html)
            .to_string();
        assert_eq!(html, again);
        assert!(!html.contains("alt=\"A <a"), "{html}");
    }
}
