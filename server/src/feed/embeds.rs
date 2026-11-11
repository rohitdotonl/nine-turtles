//! Frames a writer embedded (a map, a Vimeo video, a CodePen), other than
//! YouTube's (`clean`): nine turtles never shows another site's frame (the
//! engineering floor), but the reader should know something was there, so
//! "Here's the map:" doesn't point at nothing (decision 0258). Each frame
//! becomes a short note in the interface's voice naming the site it came
//! from, with a link to it, which opens in a new tab like every link in an
//! article. Invisible frames and frames from known trackers leave nothing.
//!
//! The safety cleaning comes between `marked` and `noted`: a mark is a
//! number between two characters no article uses, which the cleaning keeps
//! as text; `noted` then writes the note, from addresses it has checked
//! itself, so nothing a feed wrote reaches the page uncleaned.

use reqwest::Url;

use super::clean::{escape, is_tracker, pixels};

/// Stands either side of a frame's number while the article is cleaned.
const MARK: char = '\u{E001}';

/// An embedded frame worth a note: where it came from.
pub(super) struct Embedded {
    address: Url,
}

/// The same HTML with each frame worth a note swapped for a mark, and what
/// each mark stands for. Frames without a web address, invisible ones and
/// trackers are left for the cleaning to remove, with no note.
pub(super) fn marked(html: &str) -> (String, Vec<Embedded>) {
    if !html.to_ascii_lowercase().contains("<iframe") {
        return (html.to_owned(), Vec::new());
    }
    // A mark a feed wrote itself is taken out first, so only ours remain.
    let html = html.replace(MARK, "");
    let mut document = scraper::Html::parse_fragment(&html);
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
            let source = element.attr("src")?.trim();
            // An address starting `//` takes the article's own scheme.
            let source = source
                .strip_prefix("//")
                .map_or(source.to_owned(), |rest| format!("https://{rest}"));
            let address = Url::parse(&source).ok()?;
            let shown = matches!(address.scheme(), "http" | "https")
                && address.host_str().is_some()
                && !is_tracker(&address)
                && !tiny;
            shown.then(|| (frame.id(), address))
        })
        .collect();
    if worth.is_empty() {
        return (html, Vec::new());
    }
    let mut embedded = Vec::new();
    for (id, address) in worth {
        if let Some(mut node) = document.tree.get_mut(id) {
            node.insert_after(scraper::Node::Text(scraper::node::Text {
                text: format!("{MARK}{}{MARK}", embedded.len()).into(),
            }));
            node.detach();
            embedded.push(Embedded { address });
        }
    }
    (document.root_element().inner_html(), embedded)
}

/// The cleaned HTML with each mark written out as its note: "Something from
/// openstreetmap.org is embedded here. Open it ↗". A mark with no frame
/// behind it is dropped.
pub(super) fn noted(html: &str, embedded: &[Embedded]) -> String {
    if !html.contains(MARK) {
        return html.to_owned();
    }
    let mut parts = html.split(MARK);
    let mut out = parts.next().unwrap_or_default().to_owned();
    let rest: Vec<&str> = parts.collect();
    let mut index = 0;
    while index < rest.len() {
        let frame = rest[index]
            .parse::<usize>()
            .ok()
            .and_then(|at| embedded.get(at));
        match (frame, rest.get(index + 1)) {
            (Some(frame), Some(after)) => {
                out.push_str(&note(frame));
                out.push_str(after);
                index += 2;
            }
            _ => {
                out.push_str(rest[index]);
                index += 1;
            }
        }
    }
    out
}

/// One frame's note, in the interface's quiet type (article-text.css).
fn note(frame: &Embedded) -> String {
    let host = frame.address.host_str().unwrap_or_default();
    let site = host.strip_prefix("www.").unwrap_or(host);
    format!(
        r#"<span class="embed-note">Something from {} is embedded here. <a href="{}" target="_blank" rel="noopener noreferrer">Open it ↗</a></span>"#,
        escape(site),
        escape(frame.address.as_str())
    )
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
    fn an_embedded_map_leaves_a_note_with_a_link_to_it() {
        let html = cleaned(
            r#"<p>Here's the map:</p><iframe src="https://www.openstreetmap.org/export/embed.html?bbox=1" width="600" height="400"></iframe><p>After.</p>"#,
        );
        assert!(html.contains(r#"<span class="embed-note">Something from openstreetmap.org is embedded here. <a href="https://www.openstreetmap.org/export/embed.html?bbox=1" target="_blank" rel="noopener noreferrer">Open it ↗</a></span>"#), "{html}");
        assert!(html.starts_with("<p>Here's the map:</p>"), "{html}");
        assert!(html.ends_with("<p>After.</p>"), "{html}");
        assert!(!html.contains("iframe"), "{html}");
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
    fn a_feed_writing_the_mark_itself_gets_no_note() {
        let html = cleaned("<p>\u{E001}0\u{E001} and <script>x</script></p>");
        assert_eq!(html, "<p>0 and </p>");
    }

    #[test]
    fn an_address_with_quotes_is_written_safely() {
        let html =
            cleaned(r#"<iframe src="https://maps.example/?q=&quot;x&quot;&lt;b&gt;"></iframe>"#);
        assert!(!html.contains("<b>"), "{html}");
        assert!(html.contains("maps.example"), "{html}");
    }
}
