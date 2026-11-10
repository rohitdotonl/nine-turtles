//! The pages inside Download everything: the folder's `index.html`, and one
//! page for each kept article. Plain HTML, the same calm look as nine turtles
//! (a serif for reading, one column), light or dark as the device is set, so
//! the copy reads well wherever it's opened.

use std::fmt::Write as _;

use super::{Followed, Kept, byline, people, title_of, web_link};
use crate::{
    dates::{civil_date, day_month_year},
    feed::escape,
};

/// The look every page shares: dark words on white, or light on near-black,
/// both well past AA contrast.
const STYLE: &str = "<style>
:root{color-scheme:light dark;--page:#fff;--ink:#1d1d1f;--muted:#55555a;--line:#e3e3e6}
@media (prefers-color-scheme:dark){:root{--page:#161617;--ink:#ececec;--muted:#b0b0b5;--line:#333336}}
body{margin:0;background:var(--page);color:var(--ink);font:1.125rem/1.6 Georgia,'Iowan Old Style','Times New Roman',serif}
main{max-width:38rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}
h1{font-size:2.25rem;line-height:1.15;margin:.25rem 0 .75rem}
h2{font-size:1.4rem;line-height:1.25;margin:2.5rem 0 .75rem}
h3{font-size:1.15rem;margin:1.75rem 0 .5rem}
a{color:inherit;text-underline-offset:.2em}
.small{font:.9375rem/1.5 system-ui,sans-serif;color:var(--muted);margin:0}
ul.plain{list-style:none;padding:0;margin:0}
ul.plain li{padding:.6rem 0;border-top:1px solid var(--line)}
ul.plain .small{display:block;margin-top:.15rem}
article img,article video,article iframe{max-width:100%;height:auto}
article pre{overflow-x:auto}
blockquote{margin:1rem 0;padding-left:1rem;border-left:3px solid var(--line)}
</style>";

/// Where an article's page goes: by its year, its number and its title's
/// words, so the folder sorts sensibly and two titles never collide.
pub(super) fn article_path(id: i64, title: &str, at: i64) -> String {
    let (year, _, _) = civil_date(at);
    let mut slug = String::new();
    for word in title
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|word| !word.is_empty())
    {
        if slug.len() + word.len() > 60 {
            break;
        }
        slug.push('-');
        slug.push_str(&word.to_ascii_lowercase());
    }
    format!("articles/{year}/{id}{slug}.html")
}

fn page(language: &str, title: &str, body: &str) -> String {
    format!(
        "<!doctype html>\n<html lang=\"{}\">\n<head>\n<meta charset=\"utf-8\">\n\
         <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n\
         <title>{title}</title>\n{STYLE}\n</head>\n<body>\n<main>\n{body}</main>\n</body>\n</html>\n",
        escape(language)
    )
}

/// One kept article: its title, byline and link to the original, the text
/// the publisher sent, then the reader's highlights and notes.
pub(super) fn article(
    article: &Kept,
    text: &str,
    marks: &[(Option<String>, Option<String>)],
) -> String {
    let title = title_of(&article.title);
    let mut body =
        String::from("<p class=\"small\"><a href=\"../../index.html\">Your reading</a></p>\n");
    let _ = write!(
        body,
        "<h1>{title}</h1>\n<p class=\"small\">{}</p>\n",
        byline(article)
    );
    if let Some(link) = &article.link {
        let _ = writeln!(
            body,
            "<p class=\"small\">{}</p>",
            web_link(link, "Read it where it was published")
        );
    }
    let _ = write!(body, "<article>\n{text}\n</article>\n");
    if !marks.is_empty() {
        body.push_str("<h2>Your highlights and notes</h2>\n");
        for (quote, note) in marks {
            if let Some(quote) = quote {
                let _ = writeln!(body, "<blockquote>{}</blockquote>", escape(quote));
            }
            if let Some(note) = note {
                let _ = writeln!(body, "<p>{}</p>", escape(note));
            }
        }
    }
    page(article.language.as_deref().unwrap_or("en"), &title, &body)
}

/// The folder's front page: who the reader follows, then what they kept,
/// newest first and by year, then what the other files are for.
pub(super) fn index(
    followed: &[Followed],
    kept: &[Kept],
    listed: &[(String, bool)],
    today: i64,
) -> String {
    let mut body = format!(
        "<p class=\"small\">Saved from nine turtles on {}</p>\n<h1>Your reading</h1>\n\
         <p>Everything you kept, as plain pages. They open in any browser, with or without nine turtles or the internet.</p>\n",
        day_month_year(today)
    );
    let people = people(followed);
    body.push_str("<h2>People you follow</h2>\n");
    if people.is_empty() {
        body.push_str("<p class=\"small\">Nobody yet.</p>\n");
    } else {
        body.push_str("<ul class=\"plain\">\n");
        for ((_, name), (site, notes)) in &people {
            let name = escape(name);
            let _ = write!(
                body,
                "<li>{}",
                site.map_or(name.clone(), |site| web_link(site, &name))
            );
            for note in notes {
                let _ = write!(body, "<span class=\"small\">{}</span>", escape(note));
            }
            body.push_str("</li>\n");
        }
        body.push_str("</ul>\n");
    }

    body.push_str("<h2>What you kept</h2>\n");
    if kept.is_empty() {
        body.push_str(
            "<p class=\"small\">Nothing yet. Star an article, or highlight words in it, and it's kept here.</p>\n",
        );
    }
    let mut year = None;
    for (article, (path, marked)) in kept.iter().zip(listed) {
        let (this_year, _, _) = civil_date(article.at);
        if year != Some(this_year) {
            if year.is_some() {
                body.push_str("</ul>\n");
            }
            let _ = write!(body, "<h3>{this_year}</h3>\n<ul class=\"plain\">\n");
            year = Some(this_year);
        }
        let mut line = byline(article);
        if article.starred {
            line.push_str(" · Starred");
        }
        if *marked {
            line.push_str(" · Your notes");
        }
        let _ = writeln!(
            body,
            "<li><a href=\"{}\">{}</a><span class=\"small\">{line}</span></li>",
            escape(path),
            title_of(&article.title)
        );
    }
    if year.is_some() {
        body.push_str("</ul>\n");
    }

    body.push_str(
        "<h2>For other apps</h2>\n<ul class=\"plain\">\n\
         <li><a href=\"follows.opml\">follows.opml</a><span class=\"small\">Who you follow, in their folders. Any feed reader imports it.</span></li>\n\
         <li><a href=\"starred.json\">starred.json</a><span class=\"small\">Your starred articles as a JSON Feed file, which other feed readers import.</span></li>\n\
         <li><a href=\"notes-and-highlights.md\">notes-and-highlights.md</a><span class=\"small\">Your notes and highlights as plain text, for any notes app.</span></li>\n\
         </ul>\n",
    );
    page("en", "Your reading", &body)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kept(title: &str, who: &str, feed: &str) -> Kept {
        Kept {
            id: 7,
            title: title.to_owned(),
            link: Some("https://ivy.example/seeds?utm_source=feed".to_owned()),
            language: None,
            at: 1_793_577_600, // 2 Nov 2026
            starred: true,
            who: who.to_owned(),
            feed_title: feed.to_owned(),
        }
    }

    #[test]
    fn an_article_path_is_its_year_number_and_words() {
        assert_eq!(
            article_path(7, "Seeds & soil: a <first> look", 1_793_577_600),
            "articles/2026/7-seeds-soil-a-first-look.html"
        );
        assert_eq!(
            article_path(8, "पुस्तकालय", 1_793_577_600),
            "articles/2026/8.html"
        );
    }

    #[test]
    fn an_article_page_credits_the_writer_and_keeps_the_marks() {
        let page = article(
            &kept("Seeds <and> soil", "Ivy", "Ivy's Garden"),
            "<p>Text</p>",
            &[
                (Some("a <line>".to_owned()), Some("Ask her".to_owned())),
                (None, Some("Lovely".to_owned())),
            ],
        );
        assert!(page.contains("<title>Seeds &lt;and&gt; soil</title>"));
        assert!(page.contains("Ivy · Ivy's Garden · 2 Nov 2026"));
        assert!(
            page.contains(
                r#"<a href="https://ivy.example/seeds">Read it where it was published</a>"#
            )
        );
        assert!(page.contains("<article>\n<p>Text</p>\n</article>"));
        assert!(
            page.contains("<blockquote>a &lt;line&gt;</blockquote>\n<p>Ask her</p>\n<p>Lovely</p>")
        );
        assert!(!page.contains("<script"));
    }

    #[test]
    fn the_index_lists_people_once_and_articles_by_year() {
        let followed = [
            Followed {
                name: "Ivy".to_owned(),
                site_url: Some("https://ivy.example/".to_owned()),
                note: Some("Met at the fair".to_owned()),
            },
            Followed {
                name: "Ivy".to_owned(),
                site_url: None,
                note: None,
            },
            Followed {
                name: "ash".to_owned(),
                site_url: Some("javascript:alert(1)".to_owned()),
                note: None,
            },
        ];
        let articles = [kept("Seeds", "Ivy", "Ivy")];
        let listed = [("articles/2026/7-seeds.html".to_owned(), false)];
        let index = index(&followed, &articles, &listed, 1_793_664_000);
        assert!(index.contains("Saved from nine turtles on 3 Nov 2026"));
        assert_eq!(index.matches(">Ivy</a>").count(), 1);
        assert!(
            index.contains("<li>ash</li>"),
            "only web addresses become links"
        );
        assert!(
            index.find("<li>ash").unwrap() < index.find(">Ivy</a>").unwrap(),
            "A to Z"
        );
        assert!(index.contains("<h3>2026</h3>"));
        assert!(index.contains(r#"<a href="articles/2026/7-seeds.html">Seeds</a><span class="small">Ivy · 2 Nov 2026 · Starred</span>"#));
    }
}
