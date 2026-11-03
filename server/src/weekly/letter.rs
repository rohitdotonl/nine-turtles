//! What the weekly email says (SPEC section 39): the people the reader
//! follows who wrote something they haven't read yet, each by name, then
//! their newest titles with a line from each and the publisher's own link.
//! Plain text, never a count: no "12 new articles", no "and 9 more".

/// At most this many people in one email, so it stays a short read.
pub const MOST_PEOPLE: usize = 30;
/// At most this many titles under one person.
pub const MOST_TITLES: usize = 3;
/// A line from an article is cut at about this many characters.
const LINE_LENGTH: usize = 140;

/// One person with something new, their articles newest first.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Person {
    pub name: String,
    pub articles: Vec<Article>,
}

/// One article as the email shows it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Article {
    pub title: String,
    /// A line from it, already plain text; empty when it has no words.
    pub line: String,
    /// The publisher's own address for it, if the feed gave one.
    pub link: Option<String>,
}

/// The subject every weekly email has.
pub const SUBJECT: &str = "New from the people you read";

/// The email's words. `since` finishes "Here's what the people you read
/// wrote …" ("this week", "since Wednesday"); `home` opens nine turtles;
/// `stop` is the link that turns the email off.
pub fn compose(people: &[Person], since: &str, home: &str, stop: &str) -> String {
    let mut body = format!("Here's what the people you read wrote {since}.\n");
    for person in people.iter().take(MOST_PEOPLE) {
        body.push('\n');
        body.push_str(&one_line(&person.name));
        body.push('\n');
        for article in person.articles.iter().take(MOST_TITLES) {
            body.push('\n');
            body.push_str("  ");
            body.push_str(&one_line(&article.title));
            body.push('\n');
            if !article.line.is_empty() {
                body.push_str("  ");
                body.push_str(&article.line);
                body.push('\n');
            }
            if let Some(link) = &article.link {
                body.push_str("  ");
                body.push_str(link);
                body.push('\n');
            }
        }
    }
    if people.len() > MOST_PEOPLE
        || people
            .iter()
            .any(|person| person.articles.len() > MOST_TITLES)
    {
        body.push_str("\nThe rest is in nine turtles.\n");
    }
    body.push_str(&format!(
        "\nRead them in nine turtles: {home}\n\n\
         You turned this email on in Settings. To stop it, open this link and press Stop:\n\
         {stop}"
    ));
    body.push_str(crate::email::SIGN_OFF);
    body
}

/// A name or title on one line, its spaces tidied.
fn one_line(text: &str) -> String {
    let tidy = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if tidy.is_empty() {
        "Untitled".to_owned()
    } else {
        tidy
    }
}

/// The first line of an article's words (its summary, else its content,
/// both HTML), cut at a word near `LINE_LENGTH` with "…".
pub fn line_from(summary: Option<&str>, content: Option<&str>) -> String {
    let text = [summary, content]
        .into_iter()
        .flatten()
        .map(crate::mcp::plain_text)
        .find(|text| !text.trim().is_empty())
        .unwrap_or_default();
    let first = text.lines().next().unwrap_or("").trim();
    if first.chars().count() <= LINE_LENGTH {
        return first.to_owned();
    }
    let cut: String = first.chars().take(LINE_LENGTH).collect();
    let cut = match cut.rfind(' ') {
        Some(space) if space > LINE_LENGTH / 2 => &cut[..space],
        _ => cut.as_str(),
    };
    format!("{}…", cut.trim_end_matches([',', ';', ':', '.', ' ']))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn article(title: &str) -> Article {
        Article {
            title: title.to_owned(),
            line: String::new(),
            link: None,
        }
    }

    #[test]
    fn each_person_has_their_titles_lines_and_links_and_the_email_is_signed() {
        let people = [Person {
            name: "Alpha".to_owned(),
            articles: vec![Article {
                title: "On  walking".to_owned(),
                line: "I walked to the sea.".to_owned(),
                link: Some("https://alpha.example/walking".to_owned()),
            }],
        }];
        let body = compose(
            &people,
            "this week",
            "https://app.test/",
            "https://app.test/weekly-email#ticket=ab",
        );
        assert!(body.starts_with("Here's what the people you read wrote this week.\n\nAlpha\n\n  On walking\n  I walked to the sea.\n  https://alpha.example/walking\n"), "{body}");
        assert!(
            body.contains("Read them in nine turtles: https://app.test/"),
            "{body}"
        );
        assert!(
            body.contains("https://app.test/weekly-email#ticket=ab"),
            "{body}"
        );
        assert!(body.ends_with("\n\nRohit\nnine turtles\n"), "{body}");
        assert!(!body.contains("There's more"), "{body}");
    }

    #[test]
    fn a_long_list_is_cut_without_a_count() {
        let many = Person {
            name: "Busy".to_owned(),
            articles: (1..=9).map(|n| article(&format!("Post {n}"))).collect(),
        };
        let body = compose(&[many], "this week", "h", "s");
        assert!(
            body.contains("Post 3") && !body.contains("Post 4"),
            "{body}"
        );
        assert!(body.contains("The rest is in nine turtles."), "{body}");
        assert!(
            !body.contains('6') && !body.contains("9 "),
            "no count: {body}"
        );
    }

    #[test]
    fn a_line_is_the_first_of_the_words_cut_at_a_word() {
        assert_eq!(line_from(Some("<p>One.</p><p>Two.</p>"), None), "One.");
        assert_eq!(
            line_from(Some("  "), Some("<p>From the content</p>")),
            "From the content"
        );
        assert_eq!(line_from(None, None), "");
        let long = "word ".repeat(60);
        let line = line_from(Some(&long), None);
        assert!(line.ends_with("word…"), "{line}");
        assert!(line.chars().count() <= LINE_LENGTH + 1, "{line}");
    }
}
