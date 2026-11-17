//! Whether a feed's text is the whole piece or only its beginning (SPEC
//! section 7, decision 0218).
//!
//! Atom and JSON Feed keep a summary and the full text in two different
//! places, so a summary there is a summary. RSS has one place,
//! `<description>`, which many blogs fill with the whole post: its text is
//! only the beginning when it shows a sign of being cut, an ellipsis at its
//! end ("…", "[…]", WordPress's usual cut) or a "Read more" link, or when
//! it's a teaser: one short line of bare words, with no markup at all, under
//! a title of its own, the way some sites fill `<description>` with a post's
//! subtitle; or it ends with "The post … appeared first on …", which the
//! Yoast SEO plugin adds to a WordPress excerpt (decision 0306).

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
/// An episode's short show notes are its notes, never a teaser: the episode
/// is the sound.
pub fn summary_is_whole(kind: &FeedType, summary_html: &str, title: &str, episode: bool) -> bool {
    matches!(kind, FeedType::RSS0 | FeedType::RSS1 | FeedType::RSS2)
        && !is_cut_short(summary_html)
        && (episode || !is_teaser(summary_html, title))
}

/// The longest a teaser's one line runs, in characters: a subtitle or a
/// search engine's description runs to about 160; a post longer than this
/// one line comes with paragraphs or line breaks.
const TEASER_LENGTH: usize = 300;

/// One short line of bare words, no paragraph, link or line break, under a
/// title of its own: a post's subtitle, not the post (decision 0306). A
/// writer's own short note comes wrapped in a paragraph, and a post with no
/// title (a Bluesky post, sent as bare words) or one whose title is its
/// words is the whole post, so both stay whole.
fn is_teaser(html: &str, title: &str) -> bool {
    let text = html.trim();
    let title = title.trim();
    !title.is_empty()
        && !text.eq_ignore_ascii_case(title)
        && !text.contains('<')
        && !text.contains('\n')
        && text.chars().count() <= TEASER_LENGTH
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
    // WordPress cuts an excerpt with "[…]", and the Yoast SEO plugin adds
    // "The post … appeared first on …" to it; with no full text beside it,
    // that line marks an excerpt even when the "[…]" is missing.
    let lower_words = words.to_lowercase();
    let yoast_footer = lower_words
        .split_once("the post ")
        .is_some_and(|(_, rest)| rest.contains(" appeared first on "));
    let wordpress_cut = words.contains("[…]") || words.contains("[...]") || yoast_footer;
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
        assert!(summary_is_whole(&FeedType::RSS2, whole, "A title", false));
        assert!(summary_is_whole(
            &FeedType::RSS1,
            "<p>A short note today.</p>",
            "A title",
            false
        ));
        for cut in [
            "<p>For eleven years I kept a notebook, one page a day, written before…</p>",
            "<p>For eleven years I kept a notebook...</p>",
            "<p>For eleven years I kept a notebook [&hellip;]</p><p>The post Notebooks appeared first on Tomas.</p>",
            "<p>For eleven years I kept a notebook.</p><p><a href=\"https://example.com/1\">Read more</a></p>",
            "<p>Monday, sunny.</p>\n<p>The post <a href=\"https://example.com/1\">Notebooks</a> appeared first on <a href=\"https://example.com\">Tomas</a>.</p>",
            "<p>For eleven years. <a href=\"https://example.com/1\" class=\"more\">Continue reading <span>→</span></a></p>",
        ] {
            assert!(
                !summary_is_whole(&FeedType::RSS2, cut, "A title", false),
                "{cut}"
            );
        }
    }

    #[test]
    fn one_short_bare_line_is_a_teaser() {
        assert!(!summary_is_whole(
            &FeedType::RSS2,
            "Going slowly",
            "A title",
            false
        ));
        assert!(!summary_is_whole(
            &FeedType::RSS2,
            "what a quiet week taught me about leaving things alone",
            "A title",
            false
        ));
        // In a paragraph, or longer than a subtitle, it's the writer's whole note.
        assert!(summary_is_whole(
            &FeedType::RSS2,
            "<p>Going slowly</p>",
            "A title",
            false
        ));
        assert!(summary_is_whole(
            &FeedType::RSS2,
            &"A long plain post. ".repeat(20),
            "A title",
            false
        ));
        // With no title of its own (a Bluesky post), or as its own title, a bare line is the post.
        assert!(summary_is_whole(&FeedType::RSS2, "Going slowly", "", false));
        assert!(summary_is_whole(
            &FeedType::RSS2,
            "Going slowly",
            "going slowly",
            false
        ));
        // An episode's short notes are its notes.
        assert!(summary_is_whole(
            &FeedType::RSS2,
            "Going slowly",
            "A title",
            true
        ));
    }

    #[test]
    fn an_earlier_version_appearing_elsewhere_is_no_cut() {
        let html = "<p>I stop when the page ends.</p><p>An earlier version appeared first on Tomas's blog.</p>";
        assert!(summary_is_whole(&FeedType::RSS2, html, "A title", false));
    }

    #[test]
    fn a_link_that_merely_mentions_reading_is_not_a_cut() {
        let html =
            "<p>I wrote about <a href=\"https://example.com\">my reading list</a> last week.</p>";
        assert!(summary_is_whole(&FeedType::RSS2, html, "A title", false));
    }

    #[test]
    fn atom_and_json_feed_summaries_are_summaries() {
        let whole = "<p>For eleven years I kept a notebook.</p>";
        assert!(!summary_is_whole(&FeedType::Atom, whole, "A title", false));
        assert!(!summary_is_whole(&FeedType::JSON, whole, "A title", false));
    }
}
