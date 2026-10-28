//! Each article's fingerprint (ENGINEERING.md → "Duplicates"), and the
//! tracking tags taken off links.

use blake2::{Blake2s256, Digest};
use reqwest::Url;

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
    format!("hash:{}", crate::encoding::hex(&digest))
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::feed::parse;

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
}
