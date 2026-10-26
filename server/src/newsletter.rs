//! Reading a newsletter email into what nine turtles stores as an article
//! (SPEC section 28, decision 0091).
//!
//! An email arrives whole, in the standard "raw" form every mail service
//! can hand over (RFC 5322 with MIME parts), and mail-parser reads it. Its
//! sender becomes the feed: the mailing list's own name (`List-Id`) when it
//! gives one, otherwise the From address. Its subject is the title, its
//! Message-ID the fingerprint, and its HTML (or plain text) the content.
//!
//! Emails are built for mail apps, not for reading, so before the same
//! safety cleaning as feed articles (`feed::clean`) the HTML is tidied:
//!
//! - the `<head>`, styles and anything hidden (the "preview text" mail apps
//!   show in the inbox list, and parts meant only for Outlook) go;
//! - tables used only to lay the email out become plain blocks, so the text
//!   flows in the reading view; a real table of data (one with headings)
//!   stays a table;
//! - images attached inside the email (`cid:`), invisible tracking images
//!   and empty spacer cells go;
//! - tracking parts of links (`utm_…` and friends) are taken off;
//! - the "View in browser" link becomes the article's "Open original", so
//!   it isn't repeated at the top of the text.
//!
//! Nothing is fetched: what the email contains is all nine turtles shows.

use mail_parser::{MessageParser, PartKind};
use reqwest::Url;
use scraper::ElementRef;

use crate::feed::{self, ParsedArticle};

/// One email, read and cleaned.
#[derive(Debug)]
pub struct Newsletter {
    pub sender: Sender,
    pub article: ParsedArticle,
    /// The newsletter's own web unsubscribe page (`List-Unsubscribe`), if it
    /// gives one. Its unsubscribe link in the text stays too.
    pub unsubscribe: Option<String>,
}

/// Who a newsletter comes from: the feed its emails are filed under.
#[derive(Debug, PartialEq, Eq)]
pub struct Sender {
    /// What makes two emails the same newsletter: `list:` and the mailing
    /// list's ID, or `from:` and the sender's address, in lowercase.
    pub key: String,
    /// The From address, in lowercase.
    pub address: String,
    /// The feed's name: the sender's name as the email gives it.
    pub title: String,
    /// The newsletter's website, for credit, when the email names one.
    pub site_url: Option<String>,
}

/// Phrases of a link to the email's own web page. Compared in lowercase.
const WEB_VERSION: &[&str] = &[
    "view in browser",
    "view in your browser",
    "view it in your browser",
    "view this email in your browser",
    "view email in browser",
    "view this email online",
    "view online",
    "view on the web",
    "view this post on the web",
    "view on website",
    "read online",
    "read in browser",
    "read in your browser",
    "read on the web",
    "open in browser",
    "web version",
];

/// Reads a raw email. `None` when it isn't one, or names no sender.
pub fn parse(raw: &[u8]) -> Option<Newsletter> {
    let message = MessageParser::default().parse(raw)?;
    let header = |name: &str| {
        message
            .headers()
            .get(name)
            .map(|header| {
                String::from_utf8_lossy(header.raw_value())
                    .trim()
                    .to_owned()
            })
            .filter(|value| !value.is_empty())
    };

    let from = message
        .from()
        .and_then(|from| from.first())
        .or_else(|| message.sender().and_then(|sender| sender.first()))?;
    let address = from.address()?.trim().to_lowercase();
    if !address.contains('@') {
        return None;
    }
    let list_id = header("List-Id");
    let list = list_id.as_deref().and_then(list_identity);
    let key = match &list {
        Some(id) => format!("list:{id}"),
        None => format!("from:{address}"),
    };

    // The HTML body when the email has one; otherwise its plain text.
    let html = message
        .html_body()
        .find(|part| matches!(part.kind(), PartKind::Html))
        .and_then(|part| part.text());
    let (body, web_link) = match &html {
        Some(html) => tidy(html),
        None => (
            message
                .body_text(0)
                .map(|text| feed::paragraphs(&text))
                .unwrap_or_default(),
            None,
        ),
    };
    let link = web_link.as_deref().and_then(web_address);
    // Only the list's own archive says where the newsletter lives: a "View
    // in browser" link is often the mailing service's site, not the writer's.
    let site_url = header("List-Archive")
        .as_deref()
        .and_then(first_web_address);
    let base = link
        .clone()
        .or_else(|| site_url.as_deref().and_then(|site| Url::parse(site).ok()))
        .or_else(|| {
            let domain = address.rsplit_once('@')?.1;
            Url::parse(&format!("https://{domain}/")).ok()
        })?;
    let content = Some(feed::clean(&body, "text/html", &base).trim().to_owned())
        .filter(|html| !html.is_empty());

    let title = message
        .subject()
        .map(words)
        .filter(|subject| !subject.is_empty())
        .unwrap_or_else(|| "No subject".to_owned());
    let published = message
        .date()
        .filter(|date| date.is_valid())
        .map(|date| date.to_timestamp());
    let message_id = message.message_id().unwrap_or_default();

    let sender_title = from
        .name()
        .map(words)
        .map(|name| name.trim_matches(['"', '\'']).trim().to_owned())
        .filter(|name| !name.is_empty() && !name.contains('@'))
        .or_else(|| {
            let id = list_id.as_deref()?;
            let name = words(id.split('<').next()?);
            let name = name.trim_matches(['"', '\'']).trim();
            // The header is read as written: a name still in its encoded
            // form (`=?UTF-8?B?…?=`) would show as gibberish, so it's skipped.
            (!name.is_empty() && !name.contains("=?")).then(|| name.to_owned())
        })
        .unwrap_or_else(|| {
            let domain = address
                .rsplit_once('@')
                .map_or(&*address, |(_, domain)| domain);
            domain.trim_start_matches("www.").to_owned()
        });

    Some(Newsletter {
        sender: Sender {
            key,
            address,
            title: sender_title,
            site_url,
        },
        article: ParsedArticle {
            fingerprint: feed::fingerprint(message_id, link.as_ref(), &title, published),
            title,
            link: link.map(String::from),
            author: None,
            content,
            summary: None,
            language: header("Content-Language")
                .and_then(|value| value.split(',').next().map(|tag| tag.trim().to_owned()))
                .filter(|tag| !tag.is_empty()),
            published_at: published,
        },
        unsubscribe: header("List-Unsubscribe")
            .as_deref()
            .and_then(first_web_address),
    })
}

/// The ID inside a `List-Id` header (`Name <id.example.com>`), in lowercase.
fn list_identity(value: &str) -> Option<String> {
    let id = match value.rsplit_once('<') {
        Some((_, rest)) => rest.split('>').next()?,
        None => value,
    };
    let id = id.trim().to_lowercase();
    (!id.is_empty() && !id.contains(char::is_whitespace)).then_some(id)
}

/// The first `https://` (or `http://`) address in a header like
/// `<mailto:leave@example.com>, <https://example.com/leave>`.
fn first_web_address(value: &str) -> Option<String> {
    value
        .split(',')
        .map(|part| {
            part.trim()
                .trim_start_matches('<')
                .trim_end_matches('>')
                .trim()
        })
        .find_map(web_address)
        .map(String::from)
}

/// A web address, with its tracking parts taken off.
fn web_address(text: &str) -> Option<Url> {
    let url = Url::parse(text.trim()).ok()?;
    matches!(url.scheme(), "http" | "https").then(|| without_tracking(url))
}

/// The same address without `utm_…` and the other click-tracking parts of
/// its query (`feed::TRACKING`). Everything else stays as written.
fn without_tracking(mut url: Url) -> Url {
    let tracking = |name: &str| {
        let name = name.to_ascii_lowercase();
        name.starts_with("utm_") || feed::TRACKING.contains(&name.as_str())
    };
    if !url.query_pairs().any(|(name, _)| tracking(&name)) {
        return url;
    }
    let kept: Vec<(String, String)> = url
        .query_pairs()
        .filter(|(name, _)| !tracking(name))
        .map(|(name, value)| (name.into_owned(), value.into_owned()))
        .collect();
    if kept.is_empty() {
        url.set_query(None);
    } else {
        url.query_pairs_mut().clear().extend_pairs(kept);
    }
    url
}

/// Runs of spaces and line breaks made single.
fn words(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The email's HTML tidied for reading (see the top of this file), and the
/// address of its "View in browser" link, if it has one. The result still
/// goes through the safety cleaning.
fn tidy(html: &str) -> (String, Option<String>) {
    let document = scraper::Html::parse_document(html);
    let body = scraper::Selector::parse("body").expect("a fixed, valid selector");
    let root = document
        .select(&body)
        .next()
        .unwrap_or_else(|| document.root_element());
    let mut tidier = Tidier::default();
    let mut out = String::new();
    tidier.children(root, &mut out);
    (out, tidier.web_link)
}

#[derive(Default)]
struct Tidier {
    web_link: Option<String>,
}

/// Tags whose whole content is dropped: none of it is for reading.
const DROPPED: &[&str] = &[
    "head", "style", "script", "title", "meta", "link", "base", "noscript", "template", "object",
    "embed", "applet", "form", "input", "button", "select", "textarea",
];

/// Tags with no closing tag.
const VOID: &[&str] = &["area", "br", "col", "hr", "img", "source", "track", "wbr"];

/// Tags that are only boxes around other things: left out when empty. A
/// kept table's rows and cells aren't among them: an empty cell holds its
/// place, so the cells after it stay under their headings.
const BOXES: &[&str] = &[
    "div",
    "p",
    "span",
    "center",
    "font",
    "a",
    "table",
    "section",
    "article",
    "header",
    "footer",
    "main",
    "aside",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "small",
    "big",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "ul",
    "ol",
    "blockquote",
];

impl Tidier {
    fn children(&mut self, node: ElementRef<'_>, out: &mut String) {
        for child in node.children() {
            match child.value() {
                scraper::Node::Text(text) => out.push_str(&escape(text)),
                scraper::Node::Element(_) => {
                    if let Some(element) = ElementRef::wrap(child) {
                        self.element(element, out);
                    }
                }
                // Comments (Outlook's `<!--[if mso]>` parts among them), the
                // doctype and the rest carry nothing to read.
                _ => {}
            }
        }
    }

    fn element(&mut self, node: ElementRef<'_>, out: &mut String) {
        let element = node.value();
        let name = element.name().to_ascii_lowercase();
        if DROPPED.contains(&name.as_str()) || hidden(element) {
            return;
        }
        match name.as_str() {
            "img" => {
                if let Some(image) = image(element) {
                    out.push_str(&image);
                }
                return;
            }
            "a" if self.is_web_version(node, element) => return,
            // Old centring and font tags: only their contents are kept.
            "center" | "font" => {
                self.children(node, out);
                return;
            }
            "table" if layout(node) => {
                self.unwrapped(node, out);
                return;
            }
            _ => {}
        }

        let mut inner = String::new();
        self.children(node, &mut inner);
        if BOXES.contains(&name.as_str()) && blank(&inner) {
            return;
        }
        out.push('<');
        out.push_str(&name);
        for (attribute, value) in element.attrs() {
            let attribute = attribute.to_ascii_lowercase();
            // Styles and sizes are for mail apps; the reading view sets its own.
            if matches!(
                attribute.as_str(),
                "style" | "class" | "width" | "height" | "bgcolor" | "align" | "valign"
            ) {
                continue;
            }
            let value = if attribute == "href" {
                web_address(value).map_or_else(|| value.to_owned(), String::from)
            } else {
                value.to_owned()
            };
            out.push(' ');
            out.push_str(&attribute);
            out.push_str("=\"");
            out.push_str(&escape(&value));
            out.push('"');
        }
        out.push('>');
        if VOID.contains(&name.as_str()) {
            return;
        }
        out.push_str(&inner);
        out.push_str("</");
        out.push_str(&name);
        out.push('>');
    }

    /// A layout table's contents as plain blocks: each cell becomes a
    /// `<div>`, rows and the table itself disappear. Tables inside are
    /// looked at again on their own.
    fn unwrapped(&mut self, node: ElementRef<'_>, out: &mut String) {
        for child in node.children().filter_map(ElementRef::wrap) {
            let element = child.value();
            if hidden(element) {
                continue;
            }
            match element.name().to_ascii_lowercase().as_str() {
                "tbody" | "thead" | "tfoot" | "tr" => self.unwrapped(child, out),
                "td" | "th" => {
                    let mut inner = String::new();
                    self.children(child, &mut inner);
                    if !blank(&inner) {
                        out.push_str("<div>");
                        out.push_str(&inner);
                        out.push_str("</div>");
                    }
                }
                // A caption or stray content inside the table.
                _ => self.element(child, out),
            }
        }
    }

    /// Whether this link is the email's "View in browser": its address is
    /// kept as the article's link, and the link itself left out of the text.
    fn is_web_version(&mut self, node: ElementRef<'_>, element: &scraper::node::Element) -> bool {
        let Some(href) = element.attr("href") else {
            return false;
        };
        let text = words(&node.text().collect::<String>()).to_lowercase();
        if text.is_empty()
            || text.len() > 60
            || !WEB_VERSION.iter().any(|phrase| text.contains(phrase))
        {
            return false;
        }
        if web_address(href).is_none() {
            return false;
        }
        self.web_link.get_or_insert_with(|| href.trim().to_owned());
        true
    }
}

/// An image worth showing, as HTML: a picture on the web. Images attached
/// inside the email (`cid:`) can't be shown, and images sized 0 or 1 pixel
/// in their style are tracking images. Pixel sizes written as attributes are
/// left for `feed::clean`, which removes those tracking images too.
fn image(element: &scraper::node::Element) -> Option<String> {
    let source = element.attr("src")?.trim();
    let url = Url::parse(source).ok()?;
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }
    let style = element.attr("style").unwrap_or_default();
    let tiny = |property: &str| {
        style_value(style, property)
            .and_then(|value| pixels(&value))
            .is_some_and(|size| size <= 1)
    };
    if tiny("width") || tiny("height") {
        return None;
    }
    let mut html = format!(r#"<img src="{}""#, escape(source));
    for attribute in ["alt", "width", "height", "title"] {
        if let Some(value) = element.attr(attribute) {
            html.push_str(&format!(r#" {attribute}="{}""#, escape(value)));
        }
    }
    html.push('>');
    Some(html)
}

/// Whether an element is hidden in mail apps: the inbox "preview text",
/// Outlook-only parts, and the like.
fn hidden(element: &scraper::node::Element) -> bool {
    if element.attr("hidden").is_some() {
        return true;
    }
    let Some(style) = element.attr("style") else {
        return false;
    };
    let is = |property: &str, wanted: &str| {
        style_value(style, property).is_some_and(|value| value == wanted)
    };
    let zero = |property: &str| {
        style_value(style, property)
            .and_then(|value| value.trim_end_matches("px").parse::<f32>().ok())
            .is_some_and(|value| value == 0.0)
    };
    is("display", "none")
        || is("visibility", "hidden")
        || is("mso-hide", "all")
        || zero("opacity")
        || zero("max-height")
}

/// A property's value in a `style` attribute, in lowercase, without
/// `!important`. The last one wins, as in a browser.
fn style_value(style: &str, property: &str) -> Option<String> {
    style
        .split(';')
        .filter_map(|declaration| declaration.split_once(':'))
        .filter(|(name, _)| name.trim().eq_ignore_ascii_case(property))
        .map(|(_, value)| {
            value
                .trim()
                .trim_end_matches("!important")
                .trim()
                .to_ascii_lowercase()
        })
        .next_back()
}

/// A size written as `1`, `1px` or ` 1 `, in whole pixels.
fn pixels(text: &str) -> Option<u32> {
    let text = text.trim();
    text.strip_suffix("px").unwrap_or(text).trim().parse().ok()
}

/// Whether a table only lays the email out. A table with headings of its
/// own is data and stays; so is one of several columns holding only words.
/// One holding another table, marked `role="presentation"`, of a single
/// column, or holding pictures, paragraphs or blocks is layout.
fn layout(table: ElementRef<'_>) -> bool {
    if table.value().attr("role").is_some_and(|role| {
        role.eq_ignore_ascii_case("presentation") || role.eq_ignore_ascii_case("none")
    }) {
        return true;
    }
    // A table of one column holds one thing under another: layout.
    let rows = table.select(&ROWS);
    let mut one_column = true;
    for row in rows {
        let cells = row
            .children()
            .filter_map(ElementRef::wrap)
            .filter(|cell| matches!(cell.value().name(), "td" | "th"))
            .count();
        if cells > 1 {
            one_column = false;
            break;
        }
    }
    if one_column {
        return true;
    }
    let inside = || {
        table
            .descendants()
            .skip(1)
            .filter_map(|node| node.value().as_element())
    };
    if inside().any(|element| element.name().eq_ignore_ascii_case("table")) {
        return true;
    }
    if inside().any(|element| element.name().eq_ignore_ascii_case("th")) {
        return false;
    }
    inside().any(|element| {
        matches!(
            element.name().to_ascii_lowercase().as_str(),
            "img"
                | "p"
                | "div"
                | "h1"
                | "h2"
                | "h3"
                | "h4"
                | "h5"
                | "h6"
                | "ul"
                | "ol"
                | "blockquote"
                | "center"
        )
    })
}

static ROWS: std::sync::LazyLock<scraper::Selector> =
    std::sync::LazyLock::new(|| scraper::Selector::parse("tr").expect("a fixed, valid selector"));

/// Whether HTML shows nothing: no picture, line and no words, only spaces,
/// non-breaking spaces and the invisible characters emails pad with.
fn blank(html: &str) -> bool {
    if html.contains("<img") || html.contains("<hr") {
        return false;
    }
    let mut in_tag = false;
    html.chars().all(|character| match character {
        '<' => {
            in_tag = true;
            true
        }
        '>' => {
            in_tag = false;
            true
        }
        _ if in_tag => true,
        '\u{a0}' | '\u{200b}' | '\u{200c}' | '\u{200d}' | '\u{2060}' | '\u{feff}' | '\u{34f}'
        | '\u{ad}' => true,
        character => character.is_whitespace(),
    })
}

/// Text written safely into HTML.
fn escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read(name: &str) -> Newsletter {
        let path = format!("{}/tests/emails/{name}", env!("CARGO_MANIFEST_DIR"));
        parse(&std::fs::read(path).unwrap()).unwrap()
    }

    fn content(newsletter: &Newsletter) -> &str {
        newsletter.article.content.as_deref().unwrap()
    }

    #[test]
    fn a_substack_style_email_becomes_an_article_of_its_list() {
        let email = read("substack-style.eml");
        assert_eq!(
            email.sender,
            Sender {
                key: "list:slowgarden.substack.example.com".into(),
                address: "slowgarden@substack.example.com".into(),
                title: "The slow garden".into(),
                site_url: Some("https://slowgarden.example.com/archive".into()),
            }
        );
        let article = &email.article;
        assert_eq!(article.title, "Why I stopped mowing the lawn");
        assert_eq!(
            article.fingerprint,
            "id:20261025070000.abc123@mg.slowgarden.example.com"
        );
        assert_eq!(article.published_at, Some(1_792_911_600));
        // "View in browser" is the article's link, without its tracking
        // parts, and isn't repeated in the text.
        assert_eq!(
            article.link.as_deref(),
            Some("https://slowgarden.example.com/p/why-i-stopped-mowing?r=abc")
        );
        let html = content(&email);
        assert!(!html.contains("View in browser"), "{html}");
        assert_eq!(
            email.unsubscribe.as_deref(),
            Some("https://slowgarden.example.com/action/disable_email?token=xyz")
        );
        // The inbox preview text, styles and the tracking image are gone;
        // the words, the picture and the links stay.
        assert!(!html.contains("Why I stopped mowing the lawn &"), "{html}");
        assert!(!html.contains("max-width"), "{html}");
        assert!(!html.contains("style="), "{html}");
        assert!(!html.contains("email.mg.slowgarden"), "{html}");
        assert!(
            html.contains("<h1>Why I stopped mowing the lawn</h1>"),
            "{html}"
        );
        assert!(html.contains("family of hedgehogs"), "{html}");
        assert!(html.contains(r#"src="https://cdn.slowgarden.example.com/images/meadow.jpg""#));
        assert!(
            html.contains(r#"href="https://example.org/wildflowers?id=7""#),
            "{html}"
        );
        assert!(html.contains("Unsubscribe</a>"), "{html}");
        // Layout tables become plain blocks.
        assert!(!html.contains("<table"), "{html}");
        assert!(!html.contains("<td"), "{html}");
        assert_eq!(
            html.matches("<div>").count(),
            html.matches("</div>").count()
        );
    }

    #[test]
    fn a_mailchimp_style_email_loses_its_layout_and_keeps_its_data_table() {
        let email = read("mailchimp-style.eml");
        assert_eq!(email.sender.key, "from:news@riverclub.example.org");
        assert_eq!(email.sender.title, "River Club");
        assert_eq!(email.sender.site_url, None);
        assert_eq!(email.article.title, "October at the river club 🌊");
        assert_eq!(
            email.article.link.as_deref(),
            Some("https://us1.campaign-archive.example.com/?u=abc&id=def")
        );
        let html = content(&email);
        // Outlook-only parts, the preview text, the attached logo and both
        // tracking images are gone.
        assert!(!html.contains("mso"), "{html}");
        assert!(!html.contains("OfficeDocumentSettings"), "{html}");
        assert!(!html.contains("This month: the river walk"), "{html}");
        assert!(!html.contains("cid:"), "{html}");
        assert!(!html.contains("path.jpg"), "{html}");
        assert!(!html.contains("open.php"), "{html}");
        assert!(!html.contains("<center"), "{html}");
        assert!(!html.contains("View this email"), "{html}");
        // The schedule, a real table with headings, stays a table; only it.
        assert_eq!(html.matches("<table").count(), 1, "{html}");
        assert!(html.contains("<th>Date</th><th>Walk</th>"), "{html}");
        assert!(html.contains("<td>Lantern walk</td>"), "{html}");
        // Links lose their tracking parts.
        assert!(
            html.contains(r#"href="https://riverclub.example.org/recipes/soup""#),
            "{html}"
        );
        assert!(html.contains("unsubscribe from this list</a>"), "{html}");
    }

    #[test]
    fn a_plain_text_email_becomes_paragraphs() {
        let email = read("plain-text.eml");
        assert_eq!(email.sender.title, "Lettre de Camille");
        assert_eq!(email.sender.key, "from:camille@lettre.example.fr");
        assert_eq!(email.article.title, "Trois livres sur la mer");
        assert_eq!(email.article.language.as_deref(), Some("fr"));
        assert_eq!(email.article.link, None);
        // No Message-ID: the title and date make the fingerprint.
        assert!(email.article.fingerprint.starts_with("hash:"));
        let html = content(&email);
        assert!(html.starts_with("<p>Bonjour à tous,</p>"), "{html}");
        assert!(html.contains("très beau"), "{html}");
        assert!(
            html.contains(r#"<a href="https://livres.example.fr/mer-1""#),
            "{html}"
        );
    }

    #[test]
    fn a_japanese_email_is_read_in_its_own_characters() {
        let email = read("japanese.eml");
        assert_eq!(email.sender.title, "読書だより");
        assert_eq!(email.article.title, "今週の読書");
        assert!(content(&email).contains("静かな本を三冊紹介します。"));
    }

    fn email(html: &str) -> Newsletter {
        let raw = format!(
            "From: Test <test@example.com>\r\nSubject: Test\r\nMessage-ID: <1@example.com>\r\n\
             Content-Type: text/html; charset=utf-8\r\n\r\n{html}\r\n"
        );
        parse(raw.as_bytes()).unwrap()
    }

    #[test]
    fn nothing_unsafe_survives() {
        let html = content(&email(
            r#"<p onclick="steal()">Hello <script>steal()</script><a href="javascript:steal()">link</a>
            <iframe src="https://evil.example/"></iframe><img src="https://example.com/a.png" onerror="steal()">
            <form action="https://evil.example/"><input name="password"></form>
            <svg onload="steal()"></svg><a href="https://example.com/" style="position:fixed">ok</a></p>"#,
        ))
        .to_owned();
        for unsafe_part in [
            "onclick",
            "script",
            "javascript:",
            "iframe",
            "onerror",
            "form",
            "password",
            "svg",
            "onload",
            "style",
        ] {
            assert!(!html.contains(unsafe_part), "{unsafe_part} in {html}");
        }
        assert!(html.contains("Hello"));
        assert!(html.contains(r#"<a href="https://example.com/""#));
        assert!(html.contains(r#"rel="noopener noreferrer""#));
    }

    #[test]
    fn escaped_text_stays_text() {
        let html = content(&email(
            "<p>1 &lt; 2 &amp; &lt;b&gt;bold&lt;/b&gt; &quot;quoted&quot;</p>",
        ))
        .to_owned();
        assert!(
            html.contains("1 &lt; 2 &amp; &lt;b&gt;bold&lt;/b&gt;"),
            "{html}"
        );
        assert!(!html.contains("<b>"), "{html}");
    }

    #[test]
    fn hidden_parts_and_spacers_go() {
        let html = content(&email(
            r#"<div style="display: none !important">secret preview</div>
            <div style="opacity:0">also hidden</div><div hidden>hidden too</div>
            <div style="opacity:0.8">faint but shown</div>
            <table><tr><td>&nbsp;</td></tr><tr><td style="height:20px">&#8203;</td></tr><tr><td><p>words</p></td></tr></table>
            <img src="https://example.com/spacer.gif" style="width:1px; height:1px">"#,
        ))
        .to_owned();
        assert!(!html.contains("secret"), "{html}");
        assert!(!html.contains("hidden"), "{html}");
        assert!(html.contains("faint but shown"), "{html}");
        assert!(!html.contains("spacer"), "{html}");
        assert_eq!(html.matches("<div>").count(), 2, "{html}");
    }

    #[test]
    fn the_list_name_or_address_names_the_feed_when_the_sender_has_no_name() {
        let raw = "From: news@mail.example.com\r\nList-Id: \"Morning notes\" <notes.example.com>\r\n\
                   Subject: Hi\r\n\r\nHello\r\n";
        let email = parse(raw.as_bytes()).unwrap();
        assert_eq!(email.sender.title, "Morning notes");
        assert_eq!(email.sender.key, "list:notes.example.com");

        let raw = "From: <News@Mail.Example.com>\r\nSubject:\r\n\r\nHello\r\n";
        let email = parse(raw.as_bytes()).unwrap();
        assert_eq!(email.sender.title, "mail.example.com");
        assert_eq!(email.sender.key, "from:news@mail.example.com");
        assert_eq!(email.article.title, "No subject");
        assert_eq!(content(&email), "<p>Hello</p>");
    }

    #[test]
    fn empty_cells_keep_a_data_tables_columns_in_place() {
        let html = content(&email(
            "<table><tr><th></th><th>Mon</th><th>Tue</th></tr>\
             <tr><th>Walk</th><td>&nbsp;</td><td>Weir</td></tr></table>",
        ))
        .to_owned();
        assert!(
            html.contains("<tr><th></th><th>Mon</th><th>Tue</th></tr>"),
            "{html}"
        );
        assert!(
            html.contains("<tr><th>Walk</th><td>&nbsp;</td><td>Weir</td></tr>"),
            "{html}"
        );
    }

    #[test]
    fn an_encoded_list_name_isnt_shown_as_gibberish() {
        let raw = "From: news@mail.example.com\r\nList-Id: =?UTF-8?B?TW9ybmluZw==?= <notes.example.com>\r\n\
                   Subject: Hi\r\n\r\nHello\r\n";
        assert_eq!(
            parse(raw.as_bytes()).unwrap().sender.title,
            "mail.example.com"
        );
    }

    #[test]
    fn something_that_isnt_an_email_is_refused() {
        assert!(parse(b"").is_none());
        assert!(parse(b"<rss><channel></channel></rss>").is_none());
        // No sender: there's no feed to file it under.
        assert!(parse(b"Subject: Hello\r\n\r\nNo sender here\r\n").is_none());
    }
}
