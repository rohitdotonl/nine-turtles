//! Adding a feed (SPEC section 3): the reader pastes a feed's address or a
//! website's. nine turtles fetches it once; if it's a web page, it looks in
//! it for the feeds the site names (autodiscovery). One feed is followed
//! straight away; several are offered as a choice; none gets a plain
//! message. After that, `checking` looks at the feed again in the
//! background, on its own rhythm.

use axum::{
    Json,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use reqwest::Url;
use serde::Deserialize;
use serde_json::json;

use super::{FEEDS, FeedRow, Followed, follow_again, follow_in, followed_at, waiting_at};
use crate::{
    AppState, admin,
    auth::{SignedIn, database_problem},
    discover, feed,
    fetch::{self, FetchError, Fetched},
    log, now, websub,
};

#[derive(Deserialize)]
pub(super) struct AddFeed {
    address: String,
}

/// Why adding didn't work, in words the screen turns into a calm sentence.
#[derive(Debug, PartialEq, Eq)]
pub enum NotAdded {
    NotAnAddress,
    NotAllowed,
    Unreachable,
    NotFound,
    TooBig,
    NoFeed,
    Already(i64),
    /// The reader follows as many feeds as one reader can (`admin::MOST_FEEDS`).
    TooMany,
    /// The reader's trial or plan has ended (`payments`).
    PlanEnded,
    Database,
}

impl IntoResponse for NotAdded {
    fn into_response(self) -> Response {
        let (status, error) = match self {
            Self::NotAnAddress => (StatusCode::BAD_REQUEST, "not-an-address"),
            Self::NotAllowed => (StatusCode::BAD_REQUEST, "not-allowed"),
            Self::Unreachable => (StatusCode::BAD_GATEWAY, "unreachable"),
            Self::NotFound => (StatusCode::BAD_GATEWAY, "not-found"),
            Self::TooBig => (StatusCode::BAD_GATEWAY, "too-big"),
            Self::NoFeed => (StatusCode::UNPROCESSABLE_ENTITY, "no-feed"),
            Self::TooMany => (StatusCode::CONFLICT, "too-many"),
            Self::PlanEnded => (StatusCode::PAYMENT_REQUIRED, "plan-ended"),
            Self::Already(id) => {
                return (
                    StatusCode::CONFLICT,
                    Json(json!({ "error": "already", "feed_id": id })),
                )
                    .into_response();
            }
            Self::Database => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        };
        (status, Json(json!({ "error": error }))).into_response()
    }
}

impl From<FetchError> for NotAdded {
    fn from(error: FetchError) -> Self {
        match error {
            FetchError::NotAllowed => Self::NotAllowed,
            FetchError::Unreachable => Self::Unreachable,
            FetchError::Status(404 | 410) => Self::NotFound,
            FetchError::Status(_) | FetchError::SlowDown(_) => Self::Unreachable,
            FetchError::TooBig => Self::TooBig,
        }
    }
}

impl From<sqlx::Error> for NotAdded {
    fn from(error: sqlx::Error) -> Self {
        database_problem("adding a feed", &error);
        Self::Database
    }
}

pub(super) async fn add_feed(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<AddFeed>,
) -> Response {
    match add(&state, person, &form.address).await {
        Ok(Added::Feed(feed)) => {
            (StatusCode::CREATED, Json(json!({ "feed": feed }))).into_response()
        }
        Ok(Added::Choices(choices)) => {
            let choices: Vec<_> = choices
                .into_iter()
                .map(|found| json!({ "title": found.title, "url": found.url.as_str() }))
                .collect();
            Json(json!({ "choices": choices })).into_response()
        }
        Err(not_added) => not_added.into_response(),
    }
}

enum Added {
    Feed(FeedRow),
    /// The page names several feeds; the reader picks one.
    Choices(Vec<discover::Found>),
}

async fn add(state: &AppState, person: i64, address: &str) -> Result<Added, NotAdded> {
    let url = parse_address(address).ok_or(NotAdded::NotAnAddress)?;
    // A feed an assistant unsubscribed from is kept 30 days (SPEC section
    // 33): adding it again brings it back whole, as Bring back does, rather
    // than starting it afresh.
    if let Some(id) = bring_back(state, person, &url, true).await? {
        let feeds: Vec<FeedRow> = sqlx::query_as(FEEDS)
            .bind(person)
            .fetch_all(&state.db)
            .await?;
        if let Some(feed) = feeds.into_iter().find(|feed| feed.id == id) {
            return Ok(Added::Feed(feed));
        }
    }
    already_followed(state, person, &url).await?;
    if !crate::payments::may_add_feeds(state, person).await? {
        return Err(NotAdded::PlanEnded);
    }
    // Asked before anything is fetched, so no publisher is bothered for
    // nothing; asked again as the feed is followed.
    if !admin::room_for_one_more(&mut *state.db.acquire().await?, person).await? {
        return Err(NotAdded::TooMany);
    }
    let local = state.config.local_feeds_allowed;
    let fetched = fetch::get(&state.http, &url, local).await?;

    if let Some(parsed) = feed::parse(&fetched.body, &fetched.final_url) {
        return Ok(Added::Feed(follow(state, person, &fetched, parsed).await?));
    }

    // Not a feed, so a web page: look for the feeds it names.
    let page = String::from_utf8_lossy(&fetched.body);
    let found = discover::feeds_in(&page, &fetched.final_url);
    match found.as_slice() {
        [] => Err(NotAdded::NoFeed),
        [only] => {
            already_followed(state, person, &only.url).await?;
            let fetched = fetch::get(&state.http, &only.url, local).await?;
            let parsed = feed::parse(&fetched.body, &fetched.final_url).ok_or(NotAdded::NoFeed)?;
            Ok(Added::Feed(follow(state, person, &fetched, parsed).await?))
        }
        _ => Ok(Added::Choices(found)),
    }
}

/// Following a feed from another app (`greader`, SPEC section 26): as the
/// Add field does, except that a page naming several feeds follows the
/// first, a feed already followed is simply answered, and a feed unfollowed
/// in the last few minutes (not yet cleared) comes back as it was, with its
/// articles, read marks and folders, as Undo would bring it back.
pub async fn add_for_app(state: &AppState, person: i64, address: &str) -> Result<i64, NotAdded> {
    let url = parse_address(address).ok_or(NotAdded::NotAnAddress)?;
    if let Some(id) = bring_back(state, person, &url, false).await? {
        return Ok(id);
    }
    let address = match add(state, person, url.as_str()).await {
        Ok(Added::Feed(feed)) => return Ok(feed.id),
        Err(NotAdded::Already(id)) => return Ok(id),
        Err(not_added) => return Err(not_added),
        Ok(Added::Choices(choices)) => match choices.into_iter().next() {
            Some(first) => first.url,
            None => return Err(NotAdded::NoFeed),
        },
    };
    if let Some(id) = bring_back(state, person, &address, false).await? {
        return Ok(id);
    }
    match add(state, person, address.as_str()).await {
        Ok(Added::Feed(feed)) => Ok(feed.id),
        Err(NotAdded::Already(id)) => Ok(id),
        Ok(Added::Choices(_)) => Err(NotAdded::NoFeed),
        Err(not_added) => Err(not_added),
    }
}

/// Follows again a feed at this address that the reader unfollowed but
/// that isn't cleared yet, as Undo does; with `kept_only`, only one an
/// assistant unsubscribed from (kept 30 days).
async fn bring_back(
    state: &AppState,
    person: i64,
    url: &Url,
    kept_only: bool,
) -> Result<Option<i64>, sqlx::Error> {
    let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
    let waiting = waiting_at(&mut transaction, person, &feed::normalize(url), kept_only).await?;
    if let Some(id) = waiting {
        follow_again(&mut transaction, person, id, now()).await?;
    }
    transaction.commit().await?;
    Ok(waiting)
}

/// What the reader typed, as a web address. `example.com` means
/// `https://example.com`.
pub(crate) fn parse_address(address: &str) -> Option<Url> {
    let address = address.trim();
    if address.is_empty() || address.chars().any(char::is_whitespace) {
        return None;
    }
    let url = if address.contains("://") {
        Url::parse(address).ok()?
    } else {
        Url::parse(&format!("https://{address}")).ok()?
    };
    let named = url
        .host_str()
        .is_some_and(|host| host.contains('.') || host.starts_with('[') || host == "localhost");
    (matches!(url.scheme(), "http" | "https") && named).then_some(url)
}

async fn already_followed(state: &AppState, person: i64, url: &Url) -> Result<(), NotAdded> {
    let mut connection = state.db.acquire().await?;
    let id = followed_at(&mut connection, person, &feed::normalize(url)).await?;
    id.map_or(Ok(()), |id| Err(NotAdded::Already(id)))
}

/// Remembers the feed and stores its articles, all at once or not at all.
/// A feed someone else already follows isn't stored twice: the reader gets
/// their own subscription to it, and their own entries for its articles.
async fn follow(
    state: &AppState,
    person: i64,
    fetched: &Fetched,
    parsed: feed::ParsedFeed,
) -> Result<FeedRow, NotAdded> {
    let now = now();
    let hub = parsed.hub.clone();
    let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
    if !admin::room_for_one_more(&mut transaction, person).await? {
        return Err(NotAdded::TooMany);
    }
    let (feed_id, fresh) = match follow_in(
        &mut transaction,
        state,
        person,
        fetched,
        &parsed,
        &parsed.title,
        now,
    )
    .await?
    {
        Followed::New { feed_id, fresh } => (feed_id, fresh),
        Followed::Already(feed_id) => {
            // Followed after all, by an address that led to the same feed.
            transaction.rollback().await?;
            return Err(NotAdded::Already(feed_id));
        }
    };
    let unread = sqlx::query_scalar(
        "SELECT COUNT(*) FROM entries WHERE person_id = ? AND feed_id = ? AND read = 0",
    )
    .bind(person)
    .bind(feed_id)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    // Signing up with the feed's hub, if it has one, needn't hold up adding
    // it. A feed others already follow has its checks and its hub.
    if fresh {
        offer_hub(state, feed_id, hub, now);
    }

    Ok(FeedRow {
        id: feed_id,
        title: parsed.title,
        site_url: parsed.site_url,
        unread,
        river: false,
        check_at_most: 0,
        open_on_site: false,
        paused_at: None,
        failing_since: None,
        folders: Vec::new(),
    })
}

/// Signs up with a feed's hub, if it names one, in the background.
pub fn offer_hub(state: &AppState, feed_id: i64, hub: Option<feed::Hub>, now: i64) {
    let background = state.clone();
    tokio::spawn(async move {
        if let Err(error) = websub::offered(&background, feed_id, hub.as_ref(), now).await {
            log::problem(&format!(
                "database error while signing up with a hub: {error}"
            ));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn typed_addresses_become_web_addresses() {
        let parsed = |text: &str| parse_address(text).map(String::from);
        assert_eq!(
            parsed("example.com").as_deref(),
            Some("https://example.com/")
        );
        assert_eq!(
            parsed("  http://example.com/blog  ").as_deref(),
            Some("http://example.com/blog")
        );
        assert_eq!(parsed(""), None);
        assert_eq!(parsed("hello"), None);
        assert_eq!(parsed("two words.com"), None);
        assert_eq!(parsed("ftp://example.com/"), None);
        assert_eq!(parsed("javascript:alert(1)"), None);
    }
}
