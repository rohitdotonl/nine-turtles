//! Export of starred articles (SPEC section 23): every starred article as a
//! JSON Feed file (<https://jsonfeed.org/version/1.1>), a standard, open
//! format other feed tools can read. With the OPML export, it's the
//! reader's safety net in V1, which has no backups.
//!
//! Each article keeps what the publisher sent, its original link and the
//! feed it came from, so the credit travels with it (the publisher floor).
//! Starred articles of feeds since unsubscribed are included too: they stay
//! in Starred.

use axum::{
    Router,
    extract::State,
    http::header,
    response::{IntoResponse, Response},
    routing::get,
};
use serde_json::{Map, Value, json};

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
};

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/starred/export", get(export))
}

/// One starred article, with the feed it came from.
#[derive(sqlx::FromRow)]
pub struct Starred {
    pub fingerprint: String,
    pub title: String,
    pub link: Option<String>,
    pub author: Option<String>,
    pub content: Option<String>,
    pub summary: Option<String>,
    pub language: Option<String>,
    pub published_at: Option<i64>,
    pub feed_title: String,
    pub feed_url: String,
    pub site_url: Option<String>,
}

/// Every article the reader starred, newest first, from the
/// `entries_starred` index, with their name for its feed. Takes the reader.
pub const EXPORT: &str =
    "SELECT articles.fingerprint, articles.title, articles.link, articles.author,
                articles.content, articles.summary,
                COALESCE(articles.language, feeds.language) AS language,
                articles.published_at, subscriptions.title AS feed_title,
                feeds.url AS feed_url, feeds.site_url
         FROM entries CROSS JOIN articles ON articles.id = entries.article_id
             CROSS JOIN feeds ON feeds.id = entries.feed_id
             CROSS JOIN subscriptions ON subscriptions.person_id = entries.person_id
                 AND subscriptions.feed_id = entries.feed_id
         WHERE entries.person_id = ? AND entries.starred = 1
         ORDER BY entries.sort_at DESC, entries.article_id DESC";

async fn export(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let starred: Result<Vec<Starred>, sqlx::Error> = sqlx::query_as(EXPORT)
        .bind(person)
        .fetch_all(&state.db)
        .await;
    match starred {
        Ok(starred) => (
            [
                (header::CONTENT_TYPE, "application/feed+json; charset=utf-8"),
                (
                    header::CONTENT_DISPOSITION,
                    "attachment; filename=\"nine-turtles-starred.json\"",
                ),
            ],
            write(&starred).to_string(),
        )
            .into_response(),
        Err(error) => database_problem("exporting starred articles", &error),
    }
}

/// The JSON Feed file for these articles, newest first as given.
pub fn write(starred: &[Starred]) -> Value {
    let items: Vec<Value> = starred.iter().map(item).collect();
    json!({
        "version": "https://jsonfeed.org/version/1.1",
        "title": "nine turtles starred articles",
        "description": "Articles starred in nine turtles, each with the feed it came from.",
        "items": items,
    })
}

fn item(article: &Starred) -> Value {
    let mut item = Map::new();
    // An ID unique across feeds: the feed's address with the feed's own ID
    // for the article. Not the link alone: the same post can come through
    // two feeds, and each starred copy must stay its own item.
    let id = format!("{}#{}", article.feed_url, article.fingerprint);
    item.insert("id".into(), id.into());
    if let Some(link) = &article.link {
        item.insert("url".into(), link.clone().into());
    }
    item.insert("title".into(), article.title.clone().into());
    // JSON Feed needs one of the two; an article with neither keeps an
    // empty body rather than being left out.
    item.insert(
        "content_html".into(),
        article
            .content
            .clone()
            .or_else(|| article.summary.clone())
            .unwrap_or_default()
            .into(),
    );
    if let (Some(summary), Some(_)) = (&article.summary, &article.content) {
        item.insert("summary".into(), summary.clone().into());
    }
    if let Some(at) = article.published_at {
        item.insert("date_published".into(), rfc3339(at).into());
    }
    if let Some(author) = &article.author {
        item.insert("authors".into(), json!([{ "name": author }]));
    }
    if let Some(language) = &article.language {
        item.insert("language".into(), language.clone().into());
    }
    // Where it came from. JSON Feed has no field for this, so it's an
    // extension, named with an underscore as the format asks.
    let mut source = Map::new();
    source.insert(
        "about".into(),
        "https://github.com/rohitdotonl/nine-turtles".into(),
    );
    source.insert("feed_title".into(), article.feed_title.clone().into());
    source.insert("feed_url".into(), article.feed_url.clone().into());
    if let Some(site) = &article.site_url {
        source.insert("home_page_url".into(), site.clone().into());
    }
    item.insert("_nine_turtles".into(), Value::Object(source));
    Value::Object(item)
}

/// A time in seconds since 1970 as RFC 3339 writes it, in UTC:
/// `2026-10-23T20:18:35Z`.
pub fn rfc3339(at: i64) -> String {
    let (days, seconds) = (at.div_euclid(86_400), at.rem_euclid(86_400));
    // Days to a calendar date (Howard Hinnant's "civil_from_days").
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        seconds / 3_600,
        seconds % 3_600 / 60,
        seconds % 60
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn times_are_written_as_rfc_3339() {
        assert_eq!(rfc3339(0), "1970-01-01T00:00:00Z");
        assert_eq!(rfc3339(951_782_400), "2000-02-29T00:00:00Z");
        assert_eq!(rfc3339(1_792_786_715), "2026-10-23T20:18:35Z");
        assert_eq!(rfc3339(-1), "1969-12-31T23:59:59Z");
    }

    #[test]
    fn an_article_keeps_its_link_and_its_source() {
        let article = Starred {
            fingerprint: "post-1".to_owned(),
            title: "Post 1".to_owned(),
            link: None,
            author: Some("A. Writer".to_owned()),
            content: None,
            summary: Some("<p>Short</p>".to_owned()),
            language: Some("hi".to_owned()),
            published_at: Some(0),
            feed_title: "Quiet Notes".to_owned(),
            feed_url: "https://quiet.example/feed.xml".to_owned(),
            site_url: Some("https://quiet.example/".to_owned()),
        };
        let file = write(&[article]);
        let item = &file["items"][0];
        assert_eq!(file["version"], "https://jsonfeed.org/version/1.1");
        assert_eq!(item["id"], "https://quiet.example/feed.xml#post-1");
        assert!(item.get("url").is_none());
        assert_eq!(item["content_html"], "<p>Short</p>");
        assert!(item.get("summary").is_none());
        assert_eq!(item["date_published"], "1970-01-01T00:00:00Z");
        assert_eq!(item["authors"][0]["name"], "A. Writer");
        assert_eq!(item["language"], "hi");
        assert_eq!(item["_nine_turtles"]["feed_title"], "Quiet Notes");
        assert_eq!(
            item["_nine_turtles"]["home_page_url"],
            "https://quiet.example/"
        );
    }
}
