//! Notes and highlights as a file (SPEC section 42): everything the reader
//! wrote, as one Markdown file any notes app reads, inside Download
//! everything (`everything`, decision 0251). People A to Z,
//! each with their note, then their highlighted or noted articles, newest
//! first: the title linked to the original, the date, each highlight as a
//! quote with its note under it, then the note on the whole article. People
//! the reader has since unsubscribed from are in it too, with what was kept.

use std::collections::BTreeMap;
use std::fmt::Write as _;

use crate::{dates::civil_date, feed::link_without_tracking};

/// One highlight or note, with the article it's on and whose that is.
#[derive(sqlx::FromRow)]
struct Line {
    who: String,
    article: i64,
    title: String,
    link: Option<String>,
    at: i64,
    quote: Option<String>,
    note: Option<String>,
}

#[derive(Default)]
struct Person {
    notes: Vec<String>,
    /// Each article's lines, newest article first.
    articles: Vec<Vec<Line>>,
}

/// The whole file for reader `person`.
pub async fn markdown(
    db: &sqlx::SqlitePool,
    person: i64,
    today: i64,
) -> Result<String, sqlx::Error> {
    let notes: Vec<(String, String)> = sqlx::query_as(
        "SELECT COALESCE(writers.name, subscriptions.title), subscriptions.note FROM subscriptions
         LEFT JOIN writers ON writers.id = subscriptions.writer_id
         WHERE subscriptions.person_id = ? AND subscriptions.note IS NOT NULL
         ORDER BY subscriptions.feed_id",
    )
    .bind(person)
    .fetch_all(db)
    .await?;
    let lines: Vec<Line> = sqlx::query_as(
        "SELECT COALESCE(writers.name, subscriptions.title) AS who, articles.id AS article,
                articles.title, articles.link, entries.sort_at AS at, notes.quote, notes.note
         FROM notes
             JOIN entries ON entries.person_id = notes.person_id AND entries.article_id = notes.article_id
             JOIN articles ON articles.id = notes.article_id
             JOIN subscriptions ON subscriptions.person_id = entries.person_id
                 AND subscriptions.feed_id = entries.feed_id
             LEFT JOIN writers ON writers.id = subscriptions.writer_id
         WHERE notes.person_id = ?
         ORDER BY entries.sort_at DESC, articles.id DESC, notes.quote IS NULL, notes.made_at, notes.id",
    )
    .bind(person)
    .fetch_all(db)
    .await?;
    let mut people: BTreeMap<(String, String), Person> = BTreeMap::new();
    let key = |name: &str| (name.to_lowercase(), name.to_owned());
    for (who, note) in notes {
        let notes = &mut people.entry(key(&who)).or_default().notes;
        if !notes.contains(&note) {
            notes.push(note);
        }
    }
    for line in lines {
        let articles = &mut people.entry(key(&line.who)).or_default().articles;
        match articles.last_mut() {
            Some(last)
                if last
                    .first()
                    .is_some_and(|first| first.article == line.article) =>
            {
                last.push(line);
            }
            _ => articles.push(vec![line]),
        }
    }
    Ok(write(&people, today))
}

fn day(at: i64) -> String {
    let (year, month, day) = civil_date(at);
    format!("{year}-{month:02}-{day:02}")
}

/// Markdown's own characters in a title, kept as text.
fn plain(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        if "\\`*_[]<>#".contains(c) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

/// Each line of a quote starts with "> ", so it stays one quote.
fn quoted(text: &str) -> String {
    text.lines()
        .map(|line| {
            if line.trim().is_empty() {
                ">".to_owned()
            } else {
                format!("> {line}")
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn write(people: &BTreeMap<(String, String), Person>, today: i64) -> String {
    let mut out = format!(
        "# Notes and highlights\n\nFrom nine turtles, {}. Only you can see these.\n",
        day(today)
    );
    if people.is_empty() {
        out.push_str("\nNothing yet: highlight words in an article, or write a note on someone.\n");
    }
    for ((_, name), person) in people {
        let _ = write!(out, "\n## {}\n", plain(name));
        for note in &person.notes {
            let _ = write!(out, "\n{note}\n");
        }
        for article in &person.articles {
            let Some(first) = article.first() else {
                continue;
            };
            let title = plain(if first.title.trim().is_empty() {
                "Untitled"
            } else {
                &first.title
            });
            match first.link.as_deref() {
                Some(link) => {
                    let _ = write!(out, "\n### [{title}](<{}>)\n", link_without_tracking(link));
                }
                None => {
                    let _ = write!(out, "\n### {title}\n");
                }
            }
            let _ = write!(out, "\n{}\n", day(first.at));
            for line in article {
                match (&line.quote, &line.note) {
                    (Some(quote), note) => {
                        let _ = write!(out, "\n{}\n", quoted(quote));
                        if let Some(note) = note {
                            let _ = write!(out, "\nNote: {note}\n");
                        }
                    }
                    (None, Some(note)) => {
                        let _ = write!(out, "\nYour note: {note}\n");
                    }
                    (None, None) => {}
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(who: &str, article: i64, quote: Option<&str>, note: Option<&str>) -> Line {
        Line {
            who: who.to_owned(),
            article,
            title: "Seeds *and* soil".to_owned(),
            link: Some("https://ivy.example/seeds?utm_source=feed".to_owned()),
            at: 1_793_577_600,
            quote: quote.map(str::to_owned),
            note: note.map(str::to_owned),
        }
    }

    #[test]
    fn the_file_reads_as_people_then_their_articles() {
        let mut people = BTreeMap::new();
        people.insert(
            ("ivy".to_owned(), "Ivy".to_owned()),
            Person {
                notes: vec!["Met at the fair.".to_owned()],
                articles: vec![vec![
                    line(
                        "Ivy",
                        1,
                        Some("Bring back more\nthan you took"),
                        Some("Ask her"),
                    ),
                    line("Ivy", 1, None, Some("Lovely piece")),
                ]],
            },
        );
        let text = write(&people, 1_793_664_000);
        assert!(text.starts_with("# Notes and highlights\n\nFrom nine turtles, 2026-11-03."));
        assert!(text.contains("\n## Ivy\n\nMet at the fair.\n"));
        assert!(
            text.contains(
                "\n### [Seeds \\*and\\* soil](<https://ivy.example/seeds>)\n\n2026-11-02\n"
            )
        );
        assert!(text.contains("\n> Bring back more\n> than you took\n\nNote: Ask her\n"));
        assert!(text.ends_with("\nYour note: Lovely piece\n"));
    }

    #[test]
    fn an_empty_export_says_how_to_start() {
        let text = write(&BTreeMap::new(), 0);
        assert!(text.contains("Nothing yet"));
    }
}
