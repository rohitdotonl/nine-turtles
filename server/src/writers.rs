//! People (SPEC section 36, decision 0146): a person is one human with one
//! or more places on the web (a blog, a channel, a newsletter). In the code
//! they're "writers", because the readers are already `people`; on screen
//! they're always "people", and the word "feed" stays off their screens.
//!
//! A place the reader hasn't joined to another has no writer: it's a person
//! with one place, and looks as it always did. Joining places ("Add another
//! place" on the person's page, a yes to "Is this the same person?", or
//! "This is one person" on a folder) makes a writer, or adds to one, and
//! puts every place of the person in the same folders. Each join, and each
//! "Not the same person", answers what the places were like before, so the
//! screen's Undo can put them back (`put_back`).
//!
//! A person's list is any of their places' lists: `GET /api/articles?feed=3`
//! for a place of a person with two or more places lists all of them
//! (`widen`). nine turtles never joins places by itself: it only asks, once,
//! when two places are on the same website (`same`).

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::SqliteConnection;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    feeds::List,
    folders::{self, clean_name},
    now, refused,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/writers/join", post(join_places))
        .route("/api/writers/put-back", post(put_places_back))
        .route("/api/writers/separate", post(separate_place))
        .route("/api/writers/same", get(same_person))
        .route("/api/writers/same/no", post(not_the_same))
        .route("/api/folders/{id}/person", post(folder_to_person))
}

/// The people the reader has joined places into, A to Z, each with at least
/// one place they still follow, for the sidebar. Takes the reader.
pub const PEOPLE: &str = "SELECT id, name FROM writers
     WHERE person_id = ?1 AND EXISTS (SELECT 1 FROM subscriptions
         WHERE subscriptions.person_id = ?1 AND subscriptions.writer_id = writers.id
             AND subscriptions.unsubscribed_at IS NULL)
     ORDER BY name COLLATE NOCASE, id";

#[derive(Serialize, sqlx::FromRow)]
pub struct Writer {
    pub id: i64,
    pub name: String,
}

/// A place as it was before a join or a separation: its person (none for a
/// place on its own) and its folders, for Undo.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct Before {
    pub feed: i64,
    pub writer: Option<i64>,
    pub folders: Vec<i64>,
}

/// A place's list becomes its person's when they have two or more places
/// the reader still follows; every other list stays as it is. A place on
/// its own keeps its own quick list (`entries_newest_by_feed`).
pub async fn widen(db: &sqlx::SqlitePool, person: i64, list: List) -> Result<List, sqlx::Error> {
    let List::Feed(feed) = list else {
        return Ok(list);
    };
    let writer: Option<i64> = sqlx::query_scalar(
        "SELECT writer_id FROM subscriptions AS place
         WHERE person_id = ?1 AND feed_id = ?2 AND writer_id IS NOT NULL
             AND (SELECT COUNT(*) FROM subscriptions
                  WHERE person_id = ?1 AND writer_id = place.writer_id
                      AND unsubscribed_at IS NULL) > 1",
    )
    .bind(person)
    .bind(feed)
    .fetch_optional(db)
    .await?;
    Ok(writer.map_or(list, List::Writer))
}

fn ids(list: &[i64]) -> String {
    Value::from(list).to_string()
}

/// The places among `feeds` the reader still follows, with their person
/// and folders.
async fn before_of(
    connection: &mut SqliteConnection,
    person: i64,
    feeds: &[i64],
) -> Result<Vec<Before>, sqlx::Error> {
    let places: Vec<(i64, Option<i64>)> = sqlx::query_as(
        "SELECT feed_id, writer_id FROM subscriptions
         WHERE person_id = ? AND unsubscribed_at IS NULL
             AND feed_id IN (SELECT value FROM json_each(?))
         ORDER BY feed_id",
    )
    .bind(person)
    .bind(ids(feeds))
    .fetch_all(&mut *connection)
    .await?;
    let mut before = Vec::with_capacity(places.len());
    for (feed, writer) in places {
        let folders: Vec<i64> = sqlx::query_scalar(
            "SELECT feed_folders.folder_id FROM feed_folders
             JOIN folders ON folders.id = feed_folders.folder_id
             WHERE feed_folders.feed_id = ? AND folders.person_id = ?
             ORDER BY feed_folders.folder_id",
        )
        .bind(feed)
        .bind(person)
        .fetch_all(&mut *connection)
        .await?;
        before.push(Before {
            feed,
            writer,
            folders,
        });
    }
    Ok(before)
}

/// Joins `feeds` (places the reader follows) into one person, with every
/// other place of the people they already belong to. The person is the
/// first of those people, renamed to `name` if one is given; with none, a
/// new person called `name`, or the first place's name. Every place ends up
/// in every folder any of them was in, and is never asked about again.
/// Answers the person and what the places were like before; `None` when
/// the reader follows none of `feeds`.
pub async fn join(
    connection: &mut SqliteConnection,
    person: i64,
    feeds: &[i64],
    name: Option<&str>,
) -> Result<Option<(i64, Vec<Before>)>, sqlx::Error> {
    let given = before_of(connection, person, feeds).await?;
    // The person first named, in the reader's order.
    let target = feeds
        .iter()
        .find_map(|feed| given.iter().find(|place| place.feed == *feed)?.writer);
    let Some(first) = feeds
        .iter()
        .find(|feed| given.iter().any(|place| place.feed == **feed))
    else {
        return Ok(None);
    };
    let writers: Vec<i64> = given.iter().filter_map(|place| place.writer).collect();
    let others: Vec<i64> = sqlx::query_scalar(
        "SELECT feed_id FROM subscriptions
         WHERE person_id = ? AND unsubscribed_at IS NULL
             AND writer_id IN (SELECT value FROM json_each(?))",
    )
    .bind(person)
    .bind(ids(&writers))
    .fetch_all(&mut *connection)
    .await?;
    let mut places: Vec<i64> = given.iter().map(|place| place.feed).collect();
    places.extend(others);
    places.sort_unstable();
    places.dedup();
    let before = before_of(connection, person, &places).await?;
    let writer = match target {
        Some(writer) => {
            if let Some(name) = name {
                sqlx::query("UPDATE writers SET name = ? WHERE id = ? AND person_id = ?")
                    .bind(name)
                    .bind(writer)
                    .bind(person)
                    .execute(&mut *connection)
                    .await?;
            }
            writer
        }
        None => {
            let name = match name {
                Some(name) => name.to_owned(),
                None => {
                    sqlx::query_scalar(
                        "SELECT title FROM subscriptions WHERE person_id = ? AND feed_id = ?",
                    )
                    .bind(person)
                    .bind(first)
                    .fetch_one(&mut *connection)
                    .await?
                }
            };
            sqlx::query_scalar(
                "INSERT INTO writers (person_id, name, created_at) VALUES (?, ?, ?) RETURNING id",
            )
            .bind(person)
            .bind(name)
            .bind(now())
            .fetch_one(&mut *connection)
            .await?
        }
    };
    sqlx::query(
        "UPDATE subscriptions SET writer_id = ?, same_asked = 1
         WHERE person_id = ? AND feed_id IN (SELECT value FROM json_each(?))",
    )
    .bind(writer)
    .bind(person)
    .bind(ids(&places))
    .execute(&mut *connection)
    .await?;
    let mut folders: Vec<i64> = before
        .iter()
        .flat_map(|place| place.folders.clone())
        .collect();
    folders.sort_unstable();
    folders.dedup();
    sqlx::query(
        "INSERT OR IGNORE INTO feed_folders (folder_id, feed_id)
         SELECT folder.value, place.value FROM json_each(?) AS folder, json_each(?) AS place",
    )
    .bind(ids(&folders))
    .bind(ids(&places))
    .execute(&mut *connection)
    .await?;
    Ok(Some((writer, before)))
}

/// Undo for a join or a separation: each place the reader still follows
/// goes back to the person it had (if that person is still theirs) and to
/// exactly the folders it was in. People left with no place at all go.
pub async fn put_back(
    connection: &mut SqliteConnection,
    person: i64,
    before: &[Before],
) -> Result<(), sqlx::Error> {
    for place in before {
        let changed = sqlx::query(
            "UPDATE subscriptions SET writer_id =
                 (SELECT id FROM writers WHERE id = ?1 AND person_id = ?2)
             WHERE person_id = ?2 AND feed_id = ?3 AND unsubscribed_at IS NULL",
        )
        .bind(place.writer)
        .bind(person)
        .bind(place.feed)
        .execute(&mut *connection)
        .await?;
        if changed.rows_affected() > 0 {
            folders::file_in(connection, person, place.feed, &place.folders).await?;
        }
    }
    forget_empty(connection, person).await
}

/// Removes the reader's people who have no place left, followed or kept
/// for its starred articles.
async fn forget_empty(connection: &mut SqliteConnection, person: i64) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM writers WHERE person_id = ?1 AND NOT EXISTS (SELECT 1 FROM subscriptions
             WHERE subscriptions.person_id = ?1 AND subscriptions.writer_id = writers.id)",
    )
    .bind(person)
    .execute(connection)
    .await?;
    Ok(())
}

/// The person a followed place belongs to, if any.
async fn writer_of(
    connection: &mut SqliteConnection,
    person: i64,
    feed: i64,
) -> Result<Option<i64>, sqlx::Error> {
    Ok(sqlx::query_scalar(
        "SELECT writer_id FROM subscriptions WHERE person_id = ? AND feed_id = ?",
    )
    .bind(person)
    .bind(feed)
    .fetch_optional(connection)
    .await?
    .flatten())
}

/// Edit person's name: the person's, for a place joined to others; the
/// place's own otherwise. The name is already cleaned (`clean_name`).
pub async fn rename_place(
    connection: &mut SqliteConnection,
    person: i64,
    feed: i64,
    name: &str,
) -> Result<(), sqlx::Error> {
    match writer_of(connection, person, feed).await? {
        Some(writer) => {
            sqlx::query("UPDATE writers SET name = ? WHERE id = ? AND person_id = ?")
                .bind(name)
                .bind(writer)
                .bind(person)
                .execute(&mut *connection)
                .await?;
            Ok(())
        }
        None => folders::rename_feed(connection, person, feed, name).await,
    }
}

/// Edit person's folders: every place of the person goes in exactly these.
pub async fn file_places(
    connection: &mut SqliteConnection,
    person: i64,
    feed: i64,
    chosen: &[i64],
) -> Result<(), sqlx::Error> {
    let places: Vec<i64> = match writer_of(connection, person, feed).await? {
        Some(writer) => {
            sqlx::query_scalar(
                "SELECT feed_id FROM subscriptions
                 WHERE person_id = ? AND writer_id = ? AND unsubscribed_at IS NULL",
            )
            .bind(person)
            .bind(writer)
            .fetch_all(&mut *connection)
            .await?
        }
        None => vec![feed],
    };
    for place in places {
        folders::file_in(connection, person, place, chosen).await?;
    }
    Ok(())
}

#[derive(Deserialize)]
struct JoinForm {
    feeds: Vec<i64>,
    #[serde(default)]
    name: Option<String>,
}

/// "Add another place" and a yes to "Is this the same person?".
async fn join_places(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<JoinForm>,
) -> Response {
    let name = match form.name.as_deref() {
        None => None,
        Some(name) => match clean_name(name) {
            Some(name) => Some(name),
            None => return refused(StatusCode::BAD_REQUEST, "no-name"),
        },
    };
    let joined = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let joined = join(&mut transaction, person, &form.feeds, name.as_deref()).await?;
        transaction.commit().await?;
        Ok::<_, sqlx::Error>(joined)
    }
    .await;
    match joined {
        Ok(Some((writer, before))) => {
            Json(json!({ "writer": writer, "before": before })).into_response()
        }
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("joining places", &error),
    }
}

#[derive(Deserialize)]
struct PutBackForm {
    before: Vec<Before>,
}

async fn put_places_back(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<PutBackForm>,
) -> Response {
    let done = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        put_back(&mut transaction, person, &form.before).await?;
        transaction.commit().await
    }
    .await;
    match done {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => database_problem("putting places back", &error),
    }
}

#[derive(Deserialize)]
struct PlaceForm {
    feed: i64,
}

/// "Not the same person": one place leaves its person and stands on its own
/// again, in the folders it's in. Only a person with another place left can
/// lose one. Answers what it was like before, for Undo.
async fn separate_place(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<PlaceForm>,
) -> Response {
    let separated = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let before = before_of(&mut transaction, person, &[form.feed]).await?;
        let Some(writer) = before.first().and_then(|place| place.writer) else {
            return Ok(None);
        };
        sqlx::query(
            "UPDATE subscriptions SET writer_id = NULL, same_asked = 1
             WHERE person_id = ? AND feed_id = ?",
        )
        .bind(person)
        .bind(form.feed)
        .execute(&mut *transaction)
        .await?;
        let left: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM subscriptions
             WHERE person_id = ? AND writer_id = ? AND unsubscribed_at IS NULL",
        )
        .bind(person)
        .bind(writer)
        .fetch_one(&mut *transaction)
        .await?;
        if left == 0 {
            // Their only place: nothing to separate it from.
            return Ok(None);
        }
        transaction.commit().await?;
        Ok::<_, sqlx::Error>(Some(before))
    }
    .await;
    match separated {
        Ok(Some(before)) => Json(json!({ "before": before })).into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("separating a place", &error),
    }
}

/// "This is one person", on a folder that holds one person's places: its
/// places become one person, named as the folder was, and the folder goes.
/// Answers what Undo needs: the places as they were, and the folder's rules
/// and saved searches (as deleting a folder does).
async fn folder_to_person(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    let made = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        let places: Vec<i64> = sqlx::query_scalar(
            "SELECT subscriptions.feed_id FROM feed_folders
             JOIN folders ON folders.id = feed_folders.folder_id
             JOIN subscriptions ON subscriptions.person_id = folders.person_id
                 AND subscriptions.feed_id = feed_folders.feed_id
             WHERE folders.id = ? AND folders.person_id = ?
                 AND subscriptions.unsubscribed_at IS NULL
             ORDER BY subscriptions.added_at, subscriptions.feed_id",
        )
        .bind(id)
        .bind(person)
        .fetch_all(&mut *transaction)
        .await?;
        let name: Option<String> =
            sqlx::query_scalar("SELECT name FROM folders WHERE id = ? AND person_id = ?")
                .bind(id)
                .bind(person)
                .fetch_optional(&mut *transaction)
                .await?;
        let (Some(name), false) = (name, places.is_empty()) else {
            return Ok(None);
        };
        let Some((writer, before)) = join(&mut transaction, person, &places, Some(&name)).await?
        else {
            return Ok(None);
        };
        let Some(deleted) = folders::delete(&mut transaction, person, id).await? else {
            return Ok(None);
        };
        transaction.commit().await?;
        Ok::<_, sqlx::Error>(Some(json!({
            "writer": writer,
            "before": before,
            "rules": deleted.rules,
            "searches": deleted.searches,
        })))
    }
    .await;
    match made {
        Ok(Some(answer)) => Json(answer).into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => database_problem("making a folder one person", &error),
    }
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
