//! Reading a feed file (RSS, Atom or JSON Feed) into what nine turtles stores,
//! and giving each article its fingerprint (ENGINEERING.md → "Duplicates").
//!
//! Article content is cleaned here, before it's ever stored, so nothing
//! unsafe from a feed can reach the screen later (the engineering floor).
//! Invisible 1×1 tracking images, pictures from known trackers and the
//! tracking tags on links are taken out at the same time, and pictures are
//! set to load only as the reader reaches them (DESIGN.md → "Article
//! view", decision 0102). A YouTube video's own description becomes its text, and a
//! YouTube player embedded in an article becomes a link to the video (SPEC
//! section 7, decision 0072).

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

/// Query parts that only track clicks: added by newsletters, ad networks
/// and social sites to tell them who followed a link. They never change
/// which page a link leads to. Only these well-known names are taken off
/// (plus anything starting `utm_`); an unknown part is always kept, since it
/// might matter. The list is nine turtles' own, kept by hand: the tags
/// Google, Microsoft, Meta, Mailchimp, HubSpot, Marketo, Yandex, X, TikTok,
/// LinkedIn, Vero and Kit are known to add to links.
pub(crate) const TRACKING: &[&str] = &[
    "fbclid",
    "gclid",
    "gclsrc",
    "gbraid",
    "wbraid",
    "dclid",
    "msclkid",
    "yclid",
    "twclid",
    "ttclid",
    "li_fat_id",
    "mc_cid",
    "mc_eid",
    "igshid",
    "ref_src",
    "ref_url",
    "_hsenc",
    "_hsmi",
    "__hstc",
    "__hssc",
    "__hsfp",
    "hsctatracking",
    "mkt_tok",
    "vero_id",
    "vero_conv",
    "oly_anon_id",
    "oly_enc_id",
    "ck_subscriber_id",
];

/// The tracking parts the duplicate check (`normalize`) ignores. Frozen:
/// changing it would change the fingerprint and key of things already
/// stored, so the same article or feed would be taken for a new one.
const FINGERPRINT_TRACKING: &[&str] = &[
    "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid", "ref_src",
];

/// Whether a query part's name (`utm_source`, `fbclid`) only tracks clicks.
fn is_tracking(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    name.starts_with("utm_") || TRACKING.contains(&name.as_str())
}

/// The same address without its tracking tags (`TRACKING`). Every other
/// part of the query stays exactly as written, in its order and spelling,
/// so a link that needs them still works.
pub(crate) fn without_tracking(mut url: Url) -> Url {
    let Some(query) = url.query() else {
        return url;
    };
    let name = |part: &str| part.split('=').next().unwrap_or_default().to_owned();
    if !query.split('&').any(|part| is_tracking(&name(part))) {
        return url;
    }
    let kept = query
        .split('&')
        .filter(|part| !part.is_empty() && !is_tracking(&name(part)))
        .collect::<Vec<_>>()
        .join("&");
    url.set_query((!kept.is_empty()).then_some(kept.as_str()));
    url
}

/// A stored link without its tracking tags; one that isn't a web address
/// stays as it is.
pub fn link_without_tracking(link: &str) -> String {
    if !link.contains('?') {
        return link.to_owned();
    }
    match Url::parse(link) {
        Ok(url) => {
            let clean = without_tracking(url.clone());
            if clean == url {
                link.to_owned()
            } else {
                clean.into()
            }
        }
        Err(_) => link.to_owned(),
    }
}

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
            !name.starts_with("utm_") && !FINGERPRINT_TRACKING.contains(&name.as_str())
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
/// newsletters (SPEC section 7, decision 0102). Add to it as needed, but
/// never block a place that also serves real pictures (`i0.wp.com` is
/// WordPress's picture store, so only `pixel.wp.com` and `stats.wp.com` are
/// listed).
const TRACKERS: &[&str] = &[
    // Advertising
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com",
    "amazon-adsystem.com",
    "adnxs.com",
    "adform.net",
    "criteo.com",
    "criteo.net",
    "moatads.com",
    "pubmatic.com",
    "rubiconproject.com",
    "taboola.com",
    "outbrain.com",
    // Analytics and audience measurement
    "google-analytics.com",
    "googletagmanager.com",
    "scorecardresearch.com",
    "quantserve.com",
    "chartbeat.com",
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
/// article is shown, for articles stored before (decision 0102).
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
<img src="https://example.us12.list-manage.com/trackers.png" alt="Not the path">"#;
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
            "aboola",
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
        ] {
            assert!(cleaned.contains(kept), "{kept}: {cleaned}");
        }
    }

    #[test]
    fn tracking_tags_come_off_links_and_everything_else_stays() {
        for (before, after) in [
            (
                "https://example.com/a?utm_source=rss&utm_medium=feed",
                "https://example.com/a",
            ),
            (
                "https://example.com/a?id=7&UTM_Campaign=x&fbclid=y#part",
                "https://example.com/a?id=7#part",
            ),
            // Other parts keep their order and spelling exactly.
            (
                "https://example.com/s?q=a+b%20c&mc_cid=1&lang=en&_hsenc=2&flag",
                "https://example.com/s?q=a+b%20c&lang=en&flag",
            ),
            (
                "https://example.com/a?ref=home",
                "https://example.com/a?ref=home",
            ),
            (
                "https://example.com/a?page=2&&x=",
                "https://example.com/a?page=2&&x=",
            ),
        ] {
            assert_eq!(
                String::from(without_tracking(url(before))),
                after,
                "{before}"
            );
        }
        assert_eq!(link_without_tracking("not a link"), "not a link");
        assert_eq!(
            link_without_tracking("https://example.com/a?gclid=1"),
            "https://example.com/a"
        );
    }

    #[test]
    fn a_feeds_links_lose_their_tracking_tags_but_keep_their_fingerprint() {
        let rss = br##"<?xml version="1.0"?>
<rss version="2.0"><channel><title>T</title><link>https://example.com/</link>
<item><title>First</title><link>https://example.com/first?utm_source=rss&amp;id=3</link>
<description><![CDATA[<p><a href="https://other.example/x?fbclid=1&amp;page=2">x</a> <a href="/y?utm_medium=email">y</a> <a href="#fn1">1</a> <a href="https://other.example/z?q=1">z</a></p><p id="fn1">Note</p>]]></description>
</item></channel></rss>"##;
        let feed = parse(rss, &url("https://example.com/feed.xml")).unwrap();
        let article = &feed.articles[0];
        assert_eq!(
            article.link.as_deref(),
            Some("https://example.com/first?id=3")
        );
        // The same fingerprint as before tags were taken off the stored link.
        assert_eq!(
            article.fingerprint,
            fingerprint(
                "",
                Some(&url("https://example.com/first?utm_source=rss&id=3")),
                "",
                None
            )
        );
        let summary = article.summary.as_deref().unwrap();
        for kept in [
            r#"href="https://other.example/x?page=2""#,
            r#"href="https://example.com/y""#,
            r##"href="#article-fn1""##,
            r#"href="https://other.example/z?q=1""#,
        ] {
            assert!(summary.contains(kept), "{kept}: {summary}");
        }
        assert!(
            !summary.contains("fbclid") && !summary.contains("utm_"),
            "{summary}"
        );
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
