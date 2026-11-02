//! "Is this the same person?" (SPEC section 36, decision 0146): nine turtles
//! asks once per place, and only on clear evidence: two places on one website
//! of a person's own, never on a site many people share. It never fetches a
//! page to look for evidence.

use axum::{
    Json, Router,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::json;

use super::ids;
use crate::{
    AppState,
    auth::{SignedIn, database_problem},
};

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/writers/same", get(same_person))
        .route("/api/writers/same/no", post(not_the_same))
}

/// Websites where many people each have a place, so sharing one says
/// nothing about being the same person.
const SHARED_SITES: &[&str] = &[
    "youtube.com",
    "m.youtube.com",
    "medium.com",
    "substack.com",
    "wordpress.com",
    "blogspot.com",
    "tumblr.com",
    "github.com",
    "github.io",
    "gitlab.com",
    "bsky.app",
    "mastodon.social",
    "twitter.com",
    "x.com",
    "reddit.com",
    "news.ycombinator.com",
    "vimeo.com",
    "soundcloud.com",
    "anchor.fm",
    "spotify.com",
    "open.spotify.com",
    "podcasts.apple.com",
    "feeds.feedburner.com",
    "feedburner.com",
    "buttondown.com",
    "buttondown.email",
    "ghost.io",
    "micro.blog",
    "write.as",
    "bearblog.dev",
    "patreon.com",
    "instagram.com",
    "linkedin.com",
    "facebook.com",
    "itch.io",
    "dev.to",
    "hashnode.dev",
    "neocities.org",
];

/// The website part of an address that can be told apart from others,
/// without "www.": none for an address on a shared site.
fn own_site(address: &str) -> Option<String> {
    let host = reqwest::Url::parse(address)
        .ok()?
        .host_str()?
        .to_ascii_lowercase();
    let host = host.strip_prefix("www.").unwrap_or(&host).to_owned();
    (!SHARED_SITES.contains(&host.as_str())).then_some(host)
}

#[derive(Deserialize)]
struct SameQuery {
    feed: i64,
}

#[derive(sqlx::FromRow)]
struct Place {
    feed_id: i64,
    title: String,
    site_url: Option<String>,
    writer_id: Option<i64>,
    same_asked: bool,
    name: Option<String>,
}

/// "Is this the same person?": another place the reader follows, of another
/// person, on the same website as this one, while nine turtles hasn't asked
/// about this place yet. Clear evidence only: two places on one shared site
/// (YouTube, Substack…) are no evidence at all.
async fn same_person(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Query(query): Query<SameQuery>,
) -> Response {
    let places: Result<Vec<Place>, sqlx::Error> = sqlx::query_as(
        "SELECT subscriptions.feed_id, subscriptions.title, feeds.site_url,
                subscriptions.writer_id, subscriptions.same_asked, writers.name
         FROM subscriptions JOIN feeds ON feeds.id = subscriptions.feed_id
             LEFT JOIN writers ON writers.id = subscriptions.writer_id
         WHERE subscriptions.person_id = ? AND subscriptions.unsubscribed_at IS NULL
         ORDER BY subscriptions.added_at, subscriptions.feed_id",
    )
    .bind(person)
    .fetch_all(&state.db)
    .await;
    let places = match places {
        Ok(places) => places,
        Err(error) => return database_problem("looking for the same person", &error),
    };
    let same = same_as(&places, query.feed).map(|other| {
        json!({ "feed": other.feed_id, "name": other.name.as_ref().unwrap_or(&other.title) })
    });
    Json(json!({ "same": same })).into_response()
}

fn same_as(places: &[Place], feed: i64) -> Option<&Place> {
    let this = places.iter().find(|place| place.feed_id == feed)?;
    if this.same_asked {
        return None;
    }
    let site = own_site(this.site_url.as_deref()?)?;
    places.iter().find(|other| {
        other.feed_id != feed
            && (this.writer_id.is_none() || other.writer_id != this.writer_id)
            && other.site_url.as_deref().and_then(own_site).as_deref() == Some(site.as_str())
    })
}

#[derive(Deserialize)]
struct NotTheSame {
    feeds: Vec<i64>,
}

/// A no to "Is this the same person?": neither place is asked about again.
async fn not_the_same(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<NotTheSame>,
) -> Response {
    let answered = sqlx::query(
        "UPDATE subscriptions SET same_asked = 1
         WHERE person_id = ? AND feed_id IN (SELECT value FROM json_each(?))",
    )
    .bind(person)
    .bind(ids(&form.feeds))
    .execute(&state.db)
    .await;
    match answered {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("answering is this the same person", &error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn place(feed_id: i64, site: &str, writer_id: Option<i64>, same_asked: bool) -> Place {
        Place {
            feed_id,
            title: format!("Place {feed_id}"),
            site_url: Some(site.to_owned()),
            writer_id,
            same_asked,
            name: None,
        }
    }

    #[test]
    fn only_a_site_of_ones_own_is_evidence() {
        assert_eq!(
            own_site("https://www.Example.com/blog"),
            Some("example.com".to_owned())
        );
        assert_eq!(
            own_site("https://jane.substack.com/"),
            Some("jane.substack.com".to_owned())
        );
        assert_eq!(own_site("https://www.youtube.com/@jane"), None);
        assert_eq!(own_site("https://medium.com/@jane"), None);
        assert_eq!(own_site("not an address"), None);
    }

    #[test]
    fn two_places_on_one_website_are_asked_about_once() {
        let places = [
            place(1, "https://example.com/", None, false),
            place(2, "https://www.example.com/newsletter", None, false),
            place(3, "https://other.example/", None, false),
        ];
        assert_eq!(same_as(&places, 2).map(|other| other.feed_id), Some(1));
        assert!(same_as(&places, 3).is_none());
        let asked = [
            place(1, "https://example.com/", None, false),
            place(2, "https://example.com/", None, true),
        ];
        assert!(same_as(&asked, 2).is_none());
        let joined = [
            place(1, "https://example.com/", Some(7), true),
            place(2, "https://example.com/", Some(7), false),
        ];
        assert!(same_as(&joined, 2).is_none());
        let youtube = [
            place(1, "https://www.youtube.com/channel/a", None, false),
            place(2, "https://www.youtube.com/channel/b", None, false),
        ];
        assert!(same_as(&youtube, 2).is_none());
    }
}
