//! Bringing your YouTube subscriptions (decision 0144). Google Takeout
//! gives anyone their subscriptions as `subscriptions.csv`: a header line,
//! then one channel a line (its number, its address and its name). Each
//! becomes the channel's own feed, imported exactly as an OPML file's feeds
//! are (`subscriptions`), so nothing is fetched until the background checks.

use super::addresses::{channel_feed, is_channel};
use crate::{folders::clean_name, subscriptions::Listed};

/// Reads Takeout's `subscriptions.csv`. None if it isn't one.
pub fn read(text: &str) -> Option<Vec<Listed>> {
    let mut lines = text.trim_start_matches('\u{feff}').lines();
    let header = fields(lines.next()?);
    let named = |name: &str| {
        header
            .iter()
            .position(|field| field.trim().eq_ignore_ascii_case(name))
    };
    let (id, address, title) = (
        named("Channel Id")?,
        named("Channel Url"),
        named("Channel Title"),
    );
    let mut listed = Vec::new();
    for line in lines.filter(|line| !line.trim().is_empty()) {
        let row = fields(line);
        let field = |at: Option<usize>| at.and_then(|at| row.get(at)).map(|text| text.trim());
        let channel = field(Some(id)).unwrap_or_default();
        listed.push(Listed {
            name: field(title).and_then(clean_name),
            // An unreadable line keeps what it said, so the summary can name it.
            address: if is_channel(channel) {
                channel_feed(channel)
            } else {
                channel.to_owned()
            },
            site: field(address)
                .map(str::to_owned)
                .filter(|site| !site.is_empty()),
            folder: None,
        });
    }
    Some(listed)
}

/// One CSV line's fields: separated by commas, a field in quotes may hold
/// commas, and `""` inside quotes is one quote.
fn fields(line: &str) -> Vec<String> {
    let mut fields = vec![String::new()];
    let mut quoted = false;
    let mut chars = line.chars().peekable();
    while let Some(char) = chars.next() {
        let field = fields.last_mut().expect("there is always a field");
        match (char, quoted) {
            ('"', true) if chars.peek() == Some(&'"') => {
                field.push('"');
                chars.next();
            }
            ('"', _) => quoted = !quoted,
            (',', false) => fields.push(String::new()),
            (char, _) => field.push(char),
        }
    }
    fields
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn takeouts_subscriptions_become_channel_feeds() {
        let file = "\u{feff}Channel Id,Channel Url,Channel Title\n\
             UCabcdefghijklmnopqrstuv,http://www.youtube.com/channel/UCabcdefghijklmnopqrstuv,\"Walks, talks and \"\"maps\"\"\"\r\n\
             \n\
             not-a-channel,,Broken\n";
        let listed = read(file).unwrap();
        assert_eq!(
            listed,
            [
                Listed {
                    name: Some("Walks, talks and \"maps\"".to_owned()),
                    address: "https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv".to_owned(),
                    site: Some("http://www.youtube.com/channel/UCabcdefghijklmnopqrstuv".to_owned()),
                    folder: None,
                },
                Listed {
                    name: Some("Broken".to_owned()),
                    address: "not-a-channel".to_owned(),
                    site: None,
                    folder: None,
                },
            ]
        );
    }

    #[test]
    fn any_other_file_is_not_takeouts() {
        assert_eq!(read("<opml></opml>"), None);
        assert_eq!(read(""), None);
        assert_eq!(read("Name,Address\nA,b"), None);
    }
}
