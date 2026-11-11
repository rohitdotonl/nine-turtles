//! Frames a writer embedded (a map, a Vimeo video, a CodePen), other than
//! YouTube's (`clean`): nine turtles never shows another site's frame (the
//! engineering floor), but the reader should know something was there, so
//! "Here's the map:" doesn't point at nothing (decision 0260).
//!
//! Before the safety cleaning, each frame becomes an empty link to its
//! address, `<a class="embed-note" href="…"></a>`, which the cleaning then
//! checks like every other link: nothing is added after it. No words are
//! stored: the web app writes the note itself ("Something from
//! openstreetmap.org is embedded here. Open it", `web/src/lib/missing.ts`),
//! so search, rules and the list's openings never see interface words.
//! Invisible frames and frames from known trackers leave nothing.

use reqwest::Url;

use super::clean::{escape, is_tracker, pixels};

/// The class the cleaning keeps on an embedded frame's link, and the web app looks for.
pub(super) const EMBED_CLASS: &str = "embed-note";

/// The same HTML with each frame worth a note swapped for an empty link to
/// it. Frames without a web address, invisible ones and trackers are left
/// for the cleaning to remove. A relative address, or one starting `//`, is
/// made whole from the article's own (`base`).
pub(super) fn linked(html: &str, base: &Url) -> String {
    if !html.to_ascii_lowercase().contains("<iframe") {
        return html.to_owned();
    }
    let mut document = scraper::Html::parse_fragment(html);
    let frames = scraper::Selector::parse("iframe").expect("a fixed, valid selector");
    let worth: Vec<_> = document
        .select(&frames)
        .filter_map(|frame| {
            let element = frame.value();
            let tiny = ["width", "height"].iter().any(|side| {
                element
                    .attr(side)
                    .and_then(pixels)
                    .is_some_and(|size| size <= 2)
            });
            let address = base.join(element.attr("src")?.trim()).ok()?;
            let shown = matches!(address.scheme(), "http" | "https")
                && address.host_str().is_some()
                && !is_tracker(&address)
                && !tiny;
            shown.then(|| (frame.id(), address))
        })
        .collect();
    if worth.is_empty() {
        return html.to_owned();
    }
    // A character the article doesn't hold (as written or decoded) marks
    // each frame's place, so only these marks become links.
    let written = document.root_element().inner_html();
    let Some(mark) = ('\u{E001}'..='\u{E0FF}').find(|each| !written.contains(*each)) else {
        return html.to_owned();
    };
    let mut links = Vec::new();
    for (id, address) in worth {
        if let Some(mut node) = document.tree.get_mut(id) {
            node.insert_after(scraper::Node::Text(scraper::node::Text {
                text: format!("{mark}{}{mark}", links.len()).into(),
            }));
            node.detach();
            links.push(format!(
                r#"<a class="{EMBED_CLASS}" href="{}"></a>"#,
                escape(address.as_str())
            ));
        }
    }
    let marked = document.root_element().inner_html();
    let mut parts = marked.split(mark);
    let mut out = parts.next().unwrap_or_default().to_owned();
    // Marks come in pairs around a number: odd parts are numbers, even parts the article.
    for (at, part) in parts.enumerate() {
        if at % 2 == 0 {
            out.push_str(
                part.parse::<usize>()
                    .ok()
                    .and_then(|n| links.get(n))
                    .map_or("", String::as_str),
            );
        } else {
            out.push_str(part);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cleaned(html: &str) -> String {
        super::super::clean(
            html,
            "html",
            &Url::parse("https://blog.example/post").unwrap(),
        )
    }

    #[test]
    fn an_embedded_map_leaves_an_empty_link_to_it() {
        let html = cleaned(
            r#"<p>Here's the map:</p><iframe src="https://www.openstreetmap.org/export/embed.html?bbox=1" width="600" height="400"></iframe><p>After.</p>"#,
        );
        assert!(
            html.contains(r#"<a class="embed-note" href="https://www.openstreetmap.org/export/embed.html?bbox=1" target="_blank" rel="noopener noreferrer"></a>"#),
            "{html}"
        );
        assert!(html.starts_with("<p>Here's the map:</p>"), "{html}");
        assert!(html.ends_with("<p>After.</p>"), "{html}");
        assert!(!html.contains("iframe"), "{html}");
    }

    #[test]
    fn a_relative_or_schemeless_address_is_made_whole() {
        let html = cleaned(
            r#"<iframe src="/embed/map"></iframe><iframe src="//maps.example/x"></iframe>"#,
        );
        assert!(
            html.contains(r#"href="https://blog.example/embed/map""#),
            "{html}"
        );
        assert!(html.contains(r#"href="https://maps.example/x""#), "{html}");
    }

    #[test]
    fn invisible_frames_trackers_and_frames_without_an_address_leave_nothing() {
        for frame in [
            r#"<iframe src="https://example.com/pixel" width="1" height="1"></iframe>"#,
            r#"<iframe src="https://eotrx.substackcdn.com/open"></iframe>"#,
            r#"<iframe srcdoc="<p>hi</p>"></iframe>"#,
            r#"<iframe src="javascript:alert(1)"></iframe>"#,
        ] {
            let html = cleaned(&format!("<p>A.</p>{frame}"));
            assert_eq!(html, "<p>A.</p>", "{frame}");
        }
    }

    #[test]
    fn a_youtube_player_still_becomes_a_link_to_the_video() {
        let html = cleaned(r#"<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>"#);
        assert!(html.contains("Watch the video on YouTube"), "{html}");
        assert!(!html.contains("embed-note"), "{html}");
    }

    #[test]
    fn marks_a_feed_wrote_itself_never_become_links() {
        // Raw or coded, in the text or in an attribute.
        let html = cleaned(
            "<p title=\"&#xE001;0&#xE001;\">\u{E001}0\u{E001} and &#xE002;0&#xE002;</p><iframe src=\"https://maps.example/\"></iframe>",
        );
        assert_eq!(html.matches("embed-note").count(), 1, "{html}");
        assert!(html.starts_with("<p title=\"\u{E001}0\u{E001}\">\u{E001}0\u{E001} and \u{E002}0\u{E002}</p><a class=\"embed-note\""), "{html}");
    }

    #[test]
    fn an_address_with_quotes_is_written_safely() {
        let html =
            cleaned(r#"<iframe src="https://maps.example/?q=&quot;x&quot;&lt;b&gt;"></iframe>"#);
        assert!(!html.contains("<b>"), "{html}");
        assert!(html.contains("maps.example"), "{html}");
        assert_eq!(html.matches('<').count(), 2, "{html}");
    }

    #[test]
    fn the_cleaning_keeps_only_this_class() {
        let html = cleaned(
            r#"<p class="big"><a class="embed-note other" href="https://x.example/" onclick="x()">x</a></p>"#,
        );
        assert_eq!(
            html,
            r#"<p><a class="embed-note" href="https://x.example/" target="_blank" rel="noopener noreferrer">x</a></p>"#
        );
    }
}
