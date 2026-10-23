//! Reading a feed file (RSS, Atom or JSON Feed) into what slowfeed stores,
//! and giving each article its fingerprint (ENGINEERING.md → "Duplicates").
//!
//! Article content is cleaned here, before it's ever stored, so nothing
//! unsafe from a feed can reach the screen later (the engineering floor).
//! Milestone 6 adds the rest of the reading clean-up (tracking images).

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
    // An empty ID means "the feed gave none", so slowfeed's own fingerprint
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
                    .map(|name| name.trim().to_owned())
                    .filter(|name| !name.is_empty()),
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
/// links open safely; relative addresses made whole. Plain text is escaped.
fn clean(body: &str, content_type: &str, base: &Url) -> String {
    if !content_type.contains("html") {
        return ammonia::clean_text(body);
    }
    ammonia::Builder::default()
        .url_relative(ammonia::UrlRelative::RewriteWithBase(base.clone()))
        .clean(body)
        .to_string()
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
