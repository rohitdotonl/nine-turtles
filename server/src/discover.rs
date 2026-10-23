//! Autodiscovery: finding a site's feeds in the page the reader pasted
//! (SPEC section 3). Websites name their feeds in hidden lines such as
//! `<link rel="alternate" type="application/rss+xml" href="/feed">`.
//!
//! slowfeed reads only the one page the reader pasted, and only when they
//! add a feed (docs/decisions/0016-adding-feeds.md). It never guesses other
//! addresses on the site.

use reqwest::Url;
use scraper::{Html, Selector};

/// A feed a page points to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Found {
    pub title: String,
    pub url: Url,
}

/// Plain `application/json` isn't here on purpose: WordPress names its own
/// data that way on every page, and it isn't a feed.
const FEED_TYPES: &[(&str, &str)] = &[
    ("application/rss+xml", "RSS feed"),
    ("application/atom+xml", "Atom feed"),
    ("application/feed+json", "JSON Feed"),
];

/// The feeds a web page names, in the page's own order, without repeats.
pub fn feeds_in(html: &str, page_url: &Url) -> Vec<Found> {
    let document = Html::parse_document(html);
    let Ok(links) = Selector::parse("link[href]") else {
        return Vec::new();
    };
    // A page may say its addresses are relative to somewhere else.
    let base = Selector::parse("base[href]")
        .ok()
        .and_then(|selector| document.select(&selector).next())
        .and_then(|element| element.value().attr("href"))
        .and_then(|href| page_url.join(href).ok())
        .unwrap_or_else(|| page_url.clone());

    let mut found: Vec<Found> = Vec::new();
    for element in document.select(&links) {
        let attributes = element.value();
        let alternate = attributes.attr("rel").is_some_and(|rel| {
            rel.split_whitespace()
                .any(|word| word.eq_ignore_ascii_case("alternate"))
        });
        let kind = attributes.attr("type").and_then(|kind| {
            let kind = kind
                .split(';')
                .next()
                .unwrap_or("")
                .trim()
                .to_ascii_lowercase();
            FEED_TYPES
                .iter()
                .find(|(name, _)| *name == kind)
                .map(|(_, label)| *label)
        });
        let (true, Some(kind)) = (alternate, kind) else {
            continue;
        };
        let Some(url) = attributes
            .attr("href")
            .and_then(|href| base.join(href.trim()).ok())
            .filter(|url| matches!(url.scheme(), "http" | "https"))
        else {
            continue;
        };
        if found.iter().any(|known| known.url == url) {
            continue;
        }
        let title = attributes
            .attr("title")
            .map(|title| title.split_whitespace().collect::<Vec<_>>().join(" "))
            .filter(|title| !title.is_empty())
            .unwrap_or_else(|| kind.to_owned());
        found.push(Found { title, url });
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_every_feed_a_page_names_with_whole_addresses() {
        let page = r#"<!doctype html><html><head>
            <link rel="stylesheet" href="/style.css">
            <link rel="alternate" type="application/rss+xml" title="All posts" href="/feed.xml">
            <link rel="alternate" type="application/atom+xml" href="https://example.com/atom">
            <link rel="alternate" type="application/rss+xml" title="Again" href="/feed.xml">
            <link rel="alternate" type="application/feed+json" title="  JSON
                version " href="feed.json">
            <link rel="alternate" hreflang="fr" href="/fr/">
            <link rel="alternate" type="application/json" href="/wp-json/wp/v2/pages/2">
            <link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">
        </head><body></body></html>"#;
        let found = feeds_in(page, &Url::parse("https://example.com/blog/").unwrap());
        let summary: Vec<(&str, &str)> = found
            .iter()
            .map(|feed| (feed.title.as_str(), feed.url.as_str()))
            .collect();
        assert_eq!(
            summary,
            [
                ("All posts", "https://example.com/feed.xml"),
                ("Atom feed", "https://example.com/atom"),
                ("JSON version", "https://example.com/blog/feed.json"),
            ]
        );
    }

    #[test]
    fn a_page_without_feeds_has_none() {
        let page =
            "<html><head><title>Hi</title></head><body><a href='/feed'>feed</a></body></html>";
        assert!(feeds_in(page, &Url::parse("https://example.com/").unwrap()).is_empty());
    }
}
