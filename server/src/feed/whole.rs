//! Whether a feed's text is the whole piece or only its beginning (SPEC
//! section 7, decision 0218).
//!
//! Atom and JSON Feed keep a summary and the full text in two different
//! places, so a summary there is a summary. RSS has one place,
//! `<description>`, which many blogs fill with the whole post: its text is
//! only the beginning when it shows a sign of being cut, an ellipsis at its
//! end ("…", "[…]", WordPress's usual cut) or a "Read more" link.

use feed_rs::model::FeedType;

/// Words a link uses to say "the rest is on the website".
const READ_MORE: [&str; 6] = [
    "read more",
    "continue reading",
    "keep reading",
    "read the rest",
    "read the full",
    "more…",
];

/// Whether an entry's summary, the only text it has, is the whole piece.
pub fn summary_is_whole(kind: &FeedType, summary_html: &str) -> bool {
    matches!(kind, FeedType::RSS0 | FeedType::RSS1 | FeedType::RSS2) && !is_cut_short(summary_html)
}

/// A sign that the text stops before the piece does, looked for only in its
/// last two blocks: "[…]" inside a quotation or a "read the full report"
/// link in the middle of a post are no cut.
fn is_cut_short(html: &str) -> bool {
    let end = ending(html);
    let words = crate::search::plain_words(&end);
    let words = words.trim_end();
    let ends_cut = ["…", "...", "[…]", "[...]", "(…)", "(...)"]
        .iter()
        .any(|cut| words.ends_with(cut));
    // WordPress adds "The post … appeared first on …" after its "[…]".
    let wordpress_cut = words.contains("[…]") || words.contains("[...]");
    let lower = end.to_lowercase();
    let read_more = lower.split("<a ").skip(1).any(|link| {
        let text = link.split_once('>').map_or("", |(_, rest)| rest);
        let text = crate::search::plain_words(text.split("</a").next().unwrap_or(""));
        READ_MORE.iter().any(|words| text.starts_with(words))
    });
    ends_cut || wordpress_cut || read_more
}

/// The text's last two blocks (paragraphs, list items, quotations), or all
/// of it when it has fewer.
fn ending(html: &str) -> String {
    let blocks: Vec<&str> = html
        .split_inclusive('\n')
        .flat_map(|line| line.split_inclusive("</p>"))
        .flat_map(|part| part.split_inclusive("</li>"))
        .flat_map(|part| part.split_inclusive("</blockquote>"))
        .filter(|block| !crate::search::plain_words(block).is_empty())
        .collect();
    blocks[blocks.len().saturating_sub(2)..].concat()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_rss_description_is_the_whole_post_unless_it_looks_cut() {
        let whole = "<p>For eleven years I kept a notebook.</p><p>I stop when the page ends.</p>";
        assert!(summary_is_whole(&FeedType::RSS2, whole));
        assert!(summary_is_whole(
            &FeedType::RSS1,
            "<p>A short note today.</p>"
        ));
        for cut in [
            "<p>For eleven years I kept a notebook, one page a day, written before…</p>",
            "<p>For eleven years I kept a notebook...</p>",
            "<p>For eleven years I kept a notebook [&hellip;]</p><p>The post Notebooks appeared first on Tomas.</p>",
            "<p>For eleven years I kept a notebook.</p><p><a href=\"https://example.com/1\">Read more</a></p>",
            "<p>For eleven years. <a href=\"https://example.com/1\" class=\"more\">Continue reading <span>→</span></a></p>",
        ] {
            assert!(!summary_is_whole(&FeedType::RSS2, cut), "{cut}");
        }
    }

    #[test]
    fn a_link_that_merely_mentions_reading_is_not_a_cut() {
        let html =
            "<p>I wrote about <a href=\"https://example.com\">my reading list</a> last week.</p>";
        assert!(summary_is_whole(&FeedType::RSS2, html));
    }

    #[test]
    fn atom_and_json_feed_summaries_are_summaries() {
        let whole = "<p>For eleven years I kept a notebook.</p>";
        assert!(!summary_is_whole(&FeedType::Atom, whole));
        assert!(!summary_is_whole(&FeedType::JSON, whole));
    }
}
