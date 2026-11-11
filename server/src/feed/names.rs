//! Names and titles as the reader should see them (decision 0258).
//!
//! Real feeds send their names and titles messily. A blog's own name often
//! comes wrapped in words that only describe the feed ("Blog – Pete's Site »
//! Latest Posts", "Maren Holt's Blog RSS Feed"), and blog software, WordPress
//! most of all, codes the symbols in a title twice, so `&` arrives as
//! `&amp;amp;` and an apostrophe as `&amp;#8217;`. `tidy_name` takes a feed's
//! name out of its wrapping, and `plain_title` turns twice-coded symbols back
//! into themselves. Neither ever changes the words themselves, and neither
//! ever leaves a name or title empty.

/// What may stand between the parts of a feed's name, spaces around it.
const SEPARATORS: &[&str] = &[
    " – ", " — ", " - ", " | ", " » ", " « ", " :: ", " · ", " • ", " › ",
];

/// A part of a feed's name that only says it's a feed, never a name.
const FILLER: &[&str] = &[
    "blog",
    "the blog",
    "weblog",
    "feed",
    "rss",
    "rss feed",
    "atom",
    "atom feed",
    "posts",
    "all posts",
    "latest posts",
    "recent posts",
    "posts feed",
    "articles",
    "all articles",
    "latest articles",
    "entries",
    "home",
    "homepage",
    "home page",
    "latest",
];

/// Words before the name, as static-site makers write them ("Posts on Pete's Site").
const BEFORE: &[&str] = &[
    "all posts on ",
    "posts on ",
    "blog on ",
    "articles on ",
    "latest posts from ",
    "latest posts on ",
    "posts from ",
    "the latest from ",
    "latest from ",
    "articles from ",
];

/// Words after the name ("Maren Holt's Blog RSS Feed").
const AFTER: &[&str] = &[
    " rss feed",
    " atom feed",
    " rss",
    "'s blog",
    "\u{2019}s blog",
    "'s weblog",
    "\u{2019}s weblog",
];

/// A feed's own name without the words around it that only say it's a feed.
/// "Blog – Pete's Site » Latest Posts" is "Pete's Site", "Posts on Small
/// Kitchen" is "Small Kitchen", "Maren Holt's Blog RSS Feed" is "Maren Holt".
/// A name that is all such words stays as it is.
pub fn tidy_name(name: &str) -> String {
    let kept: Vec<(&str, &str)> = parts(name)
        .into_iter()
        .filter(|(_, part)| !FILLER.contains(&part.trim().to_lowercase().as_str()))
        .collect();
    let Some(((_, first), rest)) = kept.split_first() else {
        return name.trim().to_owned();
    };
    let mut joined = first.trim().to_owned();
    for (separator, part) in rest {
        joined.push_str(separator);
        joined.push_str(part.trim());
    }
    let mut tidy = joined.as_str();
    loop {
        let before = tidy;
        tidy = without(tidy, BEFORE, true);
        tidy = without(tidy, AFTER, false);
        if tidy == before {
            break;
        }
    }
    if tidy
        .chars()
        .filter(|letter| letter.is_alphanumeric())
        .count()
        < 2
    {
        return joined;
    }
    tidy.to_owned()
}

/// The name's parts, each with the separator before it ("" for the first).
fn parts(name: &str) -> Vec<(&str, &str)> {
    let mut found = Vec::new();
    let mut separator = "";
    let mut rest = name;
    loop {
        let next = SEPARATORS
            .iter()
            .filter_map(|each| rest.find(each).map(|at| (at, *each)))
            .min_by_key(|(at, _)| *at);
        match next {
            Some((at, each)) => {
                found.push((separator, &rest[..at]));
                separator = each;
                rest = &rest[at + each.len()..];
            }
            None => {
                found.push((separator, rest));
                return found;
            }
        }
    }
}

/// `text` without one of `words` at its start (or end), matched whatever the
/// case; the same text when none is there.
fn without<'a>(text: &'a str, words: &[&str], start: bool) -> &'a str {
    let lower = text.to_lowercase();
    // Lowercasing can change a text's length (rarely, outside English): then nothing is cut.
    if lower.len() != text.len() {
        return text;
    }
    for each in words {
        if start && lower.starts_with(each) {
            return text[each.len()..].trim();
        }
        if !start && lower.ends_with(each) {
            return text[..text.len() - each.len()].trim();
        }
    }
    text
}

/// Formatting a title may come wrapped in once its symbols are decoded: it
/// can't be shown in a plain title, so the words stay and the marks go.
const FORMATTING: &[&str] = &[
    "em", "i", "b", "strong", "code", "sup", "sub", "small", "mark", "u", "s", "cite", "q",
];

/// A title with symbols coded twice turned back into themselves: "Tom &amp;
/// Jerry&#8217;s" is "Tom & Jerry’s". Twice-coded formatting (`&lt;em&gt;`)
/// leaves only its words. A title with nothing coded is returned as it is, so a
/// title that is about `<video>` keeps it.
pub fn plain_title(title: &str) -> String {
    if !has_coded_symbol(title) {
        return title.to_owned();
    }
    // Coded once more, so the decoding below sees `<` as a letter, never as a tag.
    let protected = title.replace('<', "&lt;").replace('>', "&gt;");
    let decoded: String = scraper::Html::parse_fragment(&protected)
        .root_element()
        .text()
        .collect();
    let mut plain = decoded;
    for tag in FORMATTING {
        let (open, close) = (format!("<{tag}>"), format!("</{tag}>"));
        if plain.contains(&open) && plain.contains(&close) {
            plain = plain.replace(&open, "").replace(&close, "");
        }
    }
    let plain = plain.split_whitespace().collect::<Vec<_>>().join(" ");
    if plain.is_empty() {
        title.to_owned()
    } else {
        plain
    }
}

/// Whether a title holds `&amp;`, `&#8217;`, `&#x2019;` or another coded symbol.
fn has_coded_symbol(title: &str) -> bool {
    title.match_indices('&').any(|(at, _)| {
        let rest = &title[at + 1..];
        let Some(end) = rest.find(';').filter(|end| *end > 0 && *end <= 10) else {
            return false;
        };
        let code = &rest[..end];
        match code.strip_prefix('#') {
            Some(number) => number.strip_prefix(['x', 'X']).map_or_else(
                || !number.is_empty() && number.bytes().all(|byte| byte.is_ascii_digit()),
                |hex| !hex.is_empty() && hex.bytes().all(|byte| byte.is_ascii_hexdigit()),
            ),
            None => code.len() >= 2 && code.bytes().all(|byte| byte.is_ascii_alphabetic()),
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_feeds_name_loses_the_words_that_only_say_its_a_feed() {
        assert_eq!(
            tidy_name("Blog – Pete's Site » Latest Posts"),
            "Pete's Site"
        );
        assert_eq!(tidy_name("Maren Holt's Blog RSS Feed"), "Maren Holt");
        assert_eq!(tidy_name("Posts on Small Kitchen"), "Small Kitchen");
        assert_eq!(tidy_name("Field Notes | Home"), "Field Notes");
        assert_eq!(tidy_name("Low Tide - RSS"), "Low Tide");
        assert_eq!(tidy_name("Asha’s Blog"), "Asha");
    }

    #[test]
    fn a_real_name_stays_as_it_is() {
        for name in [
            "Pete's Site",
            "The Feed",
            "Daring Fireball",
            "Notes on Camp",
            "Signal v. Noise",
            "Field Notes – Thoughts on walking",
            "Blog",
            "RSS",
            "Hacker News",
            "مدونة سارة",
            "ゆっくり日記",
            "A-Z of Gardening",
        ] {
            assert_eq!(tidy_name(name), name, "{name}");
        }
    }

    #[test]
    fn several_real_parts_keep_their_own_separators() {
        assert_eq!(
            tidy_name("Blog – Field Notes | Walks and weather"),
            "Field Notes | Walks and weather"
        );
    }

    #[test]
    fn tidying_twice_changes_nothing_more() {
        for name in [
            "Blog – Pete's Site » Latest Posts",
            "Maren Holt's Blog RSS Feed",
            "Low Tide",
        ] {
            assert_eq!(tidy_name(&tidy_name(name)), tidy_name(name));
        }
    }

    #[test]
    fn symbols_coded_twice_are_shown_as_themselves() {
        assert_eq!(
            plain_title("Tom &amp; Jerry&#8217;s guide"),
            "Tom & Jerry\u{2019}s guide"
        );
        assert_eq!(plain_title("Caf&#xE9; notes"), "Café notes");
        assert_eq!(
            plain_title("A guide to &lt;em&gt;HTML&lt;/em&gt;"),
            "A guide to HTML"
        );
        assert_eq!(plain_title("Fish &amp;amp; chips"), "Fish &amp; chips");
    }

    #[test]
    fn a_title_with_nothing_coded_is_left_alone() {
        for title in [
            "Using <video> in a page",
            "Tom & Jerry",
            "R&D; the long way",
            "Ampersands & semicolons; together",
            "",
        ] {
            assert_eq!(plain_title(title), title, "{title}");
        }
    }

    #[test]
    fn a_coded_title_about_a_tag_keeps_the_tag() {
        assert_eq!(
            plain_title("Using &lt;video&gt; &amp; sound"),
            "Using <video> & sound"
        );
    }
}
