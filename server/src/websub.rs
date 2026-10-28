//! WebSub: instant updates from publishers who offer them (SPEC section 12,
//! ENGINEERING.md → "Fetching feeds", decision 0069).
//!
//! Some feeds name a "hub", a service that announces new articles the moment
//! they're published. nine turtles signs up with it, and the hub then sends
//! each new article to nine turtles' own address for that feed.
//!
//! - **Signing up:** when a check finds a hub (`offered`), nine turtles asks
//!   it to deliver to `/websub/{token}`, where the token is random and
//!   unguessable, and gives it a secret of its own for that one feed.
//! - **Verifying:** the hub then visits that address to make sure nine turtles
//!   really asked (`verify`). Only then does the subscription count, for as
//!   long as the hub promised (its "lease").
//! - **Deliveries:** each one is signed with the feed's secret; one without
//!   a correct signature is ignored (`deliver`). A delivery holding articles
//!   stores them at once; one that only says "something changed" makes the
//!   feed due for a check in the next round.
//! - **Renewing:** a day before the lease ends (halfway through a lease of
//!   two days or less), nine turtles asks again (`renew`). A hub that never confirms is asked again only once a week.
//! - **Backup:** while a hub delivers, regular checking continues, less often
//!   (at most twice a day; `checking::worked`), in case a delivery is lost.
//!
//! Without `NINE_TURTLES_PUBLIC_URL`, hubs couldn't reach nine turtles, so it
//! doesn't sign up at all and every feed is simply checked as before.

use axum::{
    Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
    routing::get,
};
use hmac::{Hmac, KeyInit, Mac};
use reqwest::Url;
use serde::Deserialize;

use crate::{
    AppState,
    checking::{DAY, HOUR, SHORTEST_WAIT},
    encoding::{from_hex, random_hex},
    feed::{self, Hub},
    feeds::{self, store_articles},
    fetch::{self, SIZE_LIMIT},
    log, now,
};

/// How long nine turtles asks hubs to deliver for. Hubs may give less.
pub const LEASE: i64 = 10 * DAY;
/// The shortest and longest leases nine turtles believes, so an odd answer
/// can't have it asking every minute, or trusting a hub forever.
const SHORTEST_LEASE: i64 = HOUR;
const LONGEST_LEASE: i64 = 30 * DAY;
/// Renewed this long before the lease ends, at most once a day.
pub const RENEW_BEFORE: i64 = DAY;
/// A hub that never confirmed (or stopped) is asked again after this long.
pub const ASK_AGAIN_AFTER: i64 = 7 * DAY;
/// While a hub delivers, the backup check comes at most this often.
pub const BACKUP_WAIT: i64 = 12 * HOUR;
/// Renewals sent per round of background checking, so they're spread out.
const RENEWALS_PER_ROUND: i64 = 5;

pub fn routes() -> Router<AppState> {
    Router::new().route(
        "/websub/{token}",
        get(verify)
            .post(deliver)
            // A delivery may be a whole feed file: as big as a download may be.
            .layer(DefaultBodyLimit::max(SIZE_LIMIT)),
    )
}

/// Whether a hub currently delivers this feed's new articles.
pub async fn delivering(
    db: &sqlx::SqlitePool,
    feed_id: i64,
    now: i64,
) -> Result<bool, sqlx::Error> {
    let until: Option<i64> = sqlx::query_scalar(
        "SELECT active_until FROM websub WHERE feed_id = ? AND active_until > ?",
    )
    .bind(feed_id)
    .bind(now)
    .fetch_optional(db)
    .await?
    .flatten();
    Ok(until.is_some())
}

#[derive(sqlx::FromRow)]
struct Subscription {
    feed_id: i64,
    hub: String,
    topic: String,
    token: String,
    secret: String,
}

/// A check of the feed found `hub` (or none). Signs up when the feed names
/// a hub nine turtles hasn't asked yet, or a different one than before;
/// forgets the subscription when the feed stops naming one. Renewals are
/// `renew`'s job.
pub async fn offered(
    state: &AppState,
    feed_id: i64,
    hub: Option<&Hub>,
    now: i64,
) -> Result<(), sqlx::Error> {
    let Some(public_url) = &state.config.public_url else {
        return Ok(());
    };
    let known: Option<Subscription> = sqlx::query_as("SELECT * FROM websub WHERE feed_id = ?")
        .bind(feed_id)
        .fetch_optional(&state.db)
        .await?;
    let Some(hub) = hub else {
        if known.is_some() {
            sqlx::query("DELETE FROM websub WHERE feed_id = ?")
                .bind(feed_id)
                .execute(&state.db)
                .await?;
        }
        return Ok(());
    };
    if let Some(known) = &known
        && known.hub == hub.hub.as_str()
        && known.topic == hub.topic.as_str()
    {
        return Ok(());
    }
    // New, or the hub changed: a fresh address and secret, so nothing the
    // old hub sends is believed any more.
    let (Ok(token), Ok(secret)) = (random_hex(16), random_hex(32)) else {
        return Ok(());
    };
    sqlx::query(
        "INSERT INTO websub (feed_id, hub, topic, token, secret, asked_at)
         SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS
             (SELECT 1 FROM feeds WHERE id = ? AND unsubscribed_at IS NULL)
         ON CONFLICT (feed_id) DO UPDATE SET hub = excluded.hub, topic = excluded.topic,
             token = excluded.token, secret = excluded.secret, asked_at = excluded.asked_at,
             active_until = NULL, lease = NULL",
    )
    .bind(feed_id)
    .bind(hub.hub.as_str())
    .bind(hub.topic.as_str())
    .bind(&token)
    .bind(&secret)
    .bind(now)
    .bind(feed_id)
    .execute(&state.db)
    .await?;
    ask(
        state, feed_id, &hub.hub, &hub.topic, &token, &secret, public_url,
    )
    .await;
    Ok(())
}

/// Asks again the hubs whose lease ends within a day (once a day at most),
/// and those that never confirmed or have stopped (once a week). A short
/// lease is renewed in its second half instead, at most once per half, so
/// even an hour's lease never lapses. A few per round, so they're spread
/// out, and in the background, so a slow hub never holds up feed checks.
pub async fn renew(state: &AppState, now: i64) -> Result<(), sqlx::Error> {
    let Some(public_url) = &state.config.public_url else {
        return Ok(());
    };
    let due: Vec<Subscription> = sqlx::query_as(
        "SELECT websub.* FROM websub JOIN feeds ON feeds.id = websub.feed_id
         WHERE feeds.unsubscribed_at IS NULL AND (
             (active_until > ? AND active_until - ? <= MIN(?, COALESCE(lease, ?) / 2)
                 AND asked_at <= ? - MIN(?, COALESCE(lease, ?) / 2))
             OR ((active_until IS NULL OR active_until <= ?) AND asked_at <= ?))
         ORDER BY asked_at LIMIT ?",
    )
    .bind(now)
    .bind(now)
    .bind(RENEW_BEFORE)
    .bind(LEASE)
    .bind(now)
    .bind(DAY)
    .bind(LEASE)
    .bind(now)
    .bind(now - ASK_AGAIN_AFTER)
    .bind(RENEWALS_PER_ROUND)
    .fetch_all(&state.db)
    .await?;
    for subscription in due {
        sqlx::query("UPDATE websub SET asked_at = ? WHERE feed_id = ?")
            .bind(now)
            .bind(subscription.feed_id)
            .execute(&state.db)
            .await?;
        let (Ok(hub), Ok(topic)) = (
            Url::parse(&subscription.hub),
            Url::parse(&subscription.topic),
        ) else {
            continue;
        };
        let (state, public_url) = (state.clone(), public_url.clone());
        tokio::spawn(async move {
            ask(
                &state,
                subscription.feed_id,
                &hub,
                &topic,
                &subscription.token,
                &subscription.secret,
                &public_url,
            )
            .await;
        });
    }
    Ok(())
}

/// Sends the hub nine turtles' request. The hub answers "accepted" and then
/// confirms separately (`verify`), so only failures are logged here.
async fn ask(
    state: &AppState,
    feed_id: i64,
    hub: &Url,
    topic: &Url,
    token: &str,
    secret: &str,
    public_url: &Url,
) {
    let form = form(&[
        ("hub.mode", "subscribe"),
        ("hub.topic", topic.as_str()),
        ("hub.callback", callback(public_url, token).as_str()),
        ("hub.secret", secret),
        ("hub.lease_seconds", &LEASE.to_string()),
    ]);
    match fetch::post_form(&state.http, hub, state.config.local_feeds_allowed, form).await {
        Ok(200..=299) => log::info(&format!("asked feed {feed_id}'s hub for instant updates")),
        Ok(status) => log::info(&format!(
            "feed {feed_id}'s hub said no to instant updates ({status}); it's checked as usual"
        )),
        Err(error) => log::info(&format!(
            "couldn't reach feed {feed_id}'s hub ({error:?}); it's checked as usual"
        )),
    }
}

/// The address a hub delivers one feed's articles to.
pub fn callback(public_url: &Url, token: &str) -> String {
    format!(
        "{}/websub/{token}",
        public_url.as_str().trim_end_matches('/')
    )
}

/// A form's fields, encoded the way a web form sends them.
fn form(fields: &[(&str, &str)]) -> String {
    let mut url = Url::parse("http://form.invalid/").expect("a fixed, valid address");
    url.query_pairs_mut().extend_pairs(fields);
    url.query().unwrap_or_default().to_owned()
}

#[derive(Deserialize)]
struct Verification {
    #[serde(rename = "hub.mode")]
    mode: String,
    #[serde(rename = "hub.topic")]
    topic: Option<String>,
    #[serde(rename = "hub.challenge")]
    challenge: Option<String>,
    #[serde(rename = "hub.lease_seconds")]
    lease_seconds: Option<String>,
}

/// The hub checks that nine turtles really asked: it sends a random word
/// (the "challenge"), and nine turtles sends it back only if this address
/// and feed are one it signed up for. A hub that refused says "denied".
async fn verify(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Query(asked): Query<Verification>,
) -> Response {
    let found = followed(&state.db, &token).await;
    let subscription = match found {
        Ok(Some(subscription)) => subscription,
        Ok(None) => return StatusCode::NOT_FOUND.into_response(),
        Err(error) => return database_problem(&error),
    };
    let now = now();
    match asked.mode.as_str() {
        "subscribe" => {
            let (Some(topic), Some(challenge)) = (asked.topic, asked.challenge) else {
                return StatusCode::BAD_REQUEST.into_response();
            };
            if topic != subscription.topic {
                return StatusCode::NOT_FOUND.into_response();
            }
            let lease = asked
                .lease_seconds
                .and_then(|seconds| seconds.trim().parse::<i64>().ok())
                .unwrap_or(LEASE)
                .clamp(SHORTEST_LEASE, LONGEST_LEASE);
            let saved =
                sqlx::query("UPDATE websub SET active_until = ?, lease = ? WHERE feed_id = ?")
                    .bind(now + lease)
                    .bind(lease)
                    .bind(subscription.feed_id)
                    .execute(&state.db)
                    .await;
            if let Err(error) = saved {
                return database_problem(&error);
            }
            log::info(&format!(
                "feed {}'s hub now sends its new articles straight away",
                subscription.feed_id
            ));
            (
                [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
                challenge,
            )
                .into_response()
        }
        "denied" => {
            let saved = sqlx::query("UPDATE websub SET active_until = NULL WHERE feed_id = ?")
                .bind(subscription.feed_id)
                .execute(&state.db)
                .await;
            if let Err(error) = saved {
                return database_problem(&error);
            }
            log::info(&format!(
                "feed {}'s hub refused instant updates; it's checked as usual",
                subscription.feed_id
            ));
            StatusCode::OK.into_response()
        }
        // nine turtles never asks to stop while it follows the feed.
        _ => StatusCode::NOT_FOUND.into_response(),
    }
}

/// A delivery from the hub. Only one signed with this feed's secret is
/// believed; anything else is ignored, though still answered "received", as
/// the standard asks, so a forger learns nothing.
async fn deliver(
    State(state): State<AppState>,
    Path(token): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let subscription = match followed(&state.db, &token).await {
        Ok(Some(subscription)) => subscription,
        Ok(None) => return StatusCode::NOT_FOUND.into_response(),
        Err(error) => return database_problem(&error),
    };
    let signature = headers
        .get("x-hub-signature")
        .and_then(|value| value.to_str().ok());
    if !signed(subscription.secret.as_bytes(), &body, signature) {
        log::info(&format!(
            "ignored a delivery for feed {} without a correct signature",
            subscription.feed_id
        ));
        return StatusCode::ACCEPTED.into_response();
    }
    match store_delivery(&state, &subscription, &body).await {
        Ok(()) => StatusCode::ACCEPTED.into_response(),
        Err(error) => database_problem(&error),
    }
}

/// Stores the delivered articles. A delivery that isn't a feed (some hubs
/// only say "it changed") makes the feed due for a check in the next round
/// (or 30 minutes after its last one), which costs the publisher one
/// ordinary check. A failing feed keeps its longer wait.
async fn store_delivery(
    state: &AppState,
    subscription: &Subscription,
    body: &[u8],
) -> Result<(), sqlx::Error> {
    let now = now();
    let parsed = Url::parse(&subscription.topic)
        .ok()
        .and_then(|topic| feed::parse(body, &topic));
    let Some(parsed) = parsed.filter(|parsed| !parsed.articles.is_empty()) else {
        // Never sooner than 30 minutes after the last check (or the hour or
        // day the reader chose in Edit feed), however often a hub says so:
        // the publisher is still asked politely.
        // A feed that is failing, or was told to slow down, keeps its wait.
        sqlx::query(
            "UPDATE feeds SET next_check_at =
                 MIN(next_check_at, MAX(?, COALESCE(fetched_at, 0) + MAX(?, check_at_most)))
             WHERE id = ? AND unsubscribed_at IS NULL AND failures = 0",
        )
        .bind(now)
        .bind(SHORTEST_WAIT)
        .bind(subscription.feed_id)
        .execute(&state.db)
        .await?;
        return Ok(());
    };
    // As in `checking::worked`: take the right to write first, and store
    // nothing if the reader unsubscribed in the meantime.
    let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
    if feeds::still_followed(&mut transaction, subscription.feed_id).await? {
        store_articles(
            &mut transaction,
            subscription.feed_id,
            &parsed.articles,
            now,
        )
        .await?;
    }
    transaction.commit().await?;
    log::info(&format!(
        "feed {}'s hub delivered {} articles",
        subscription.feed_id,
        parsed.articles.len()
    ));
    Ok(())
}

/// The subscription this address belongs to, if its feed is still followed.
async fn followed(db: &sqlx::SqlitePool, token: &str) -> Result<Option<Subscription>, sqlx::Error> {
    sqlx::query_as(
        "SELECT websub.* FROM websub JOIN feeds ON feeds.id = websub.feed_id
         WHERE websub.token = ? AND feeds.unsubscribed_at IS NULL",
    )
    .bind(token)
    .fetch_optional(db)
    .await
}

/// Whether `signature` (the `X-Hub-Signature` header, such as
/// `sha256=` and a long number in hex) was made from `body` with `secret`.
/// The comparison takes the same time however much matches, so a forger
/// can't guess it bit by bit.
pub fn signed(secret: &[u8], body: &[u8], signature: Option<&str>) -> bool {
    let Some((method, hex)) = signature.and_then(|signature| signature.trim().split_once('='))
    else {
        return false;
    };
    let Some(expected) = from_hex(hex) else {
        return false;
    };
    // The same check for each kind of signature the standard allows.
    macro_rules! matches {
        ($hash:ty) => {
            <Hmac<$hash> as KeyInit>::new_from_slice(secret).is_ok_and(|mut mac| {
                mac.update(body);
                mac.verify_slice(&expected).is_ok()
            })
        };
    }
    match method.to_ascii_lowercase().as_str() {
        "sha1" => matches!(sha1::Sha1),
        "sha256" => matches!(sha2::Sha256),
        "sha384" => matches!(sha2::Sha384),
        "sha512" => matches!(sha2::Sha512),
        _ => false,
    }
}

fn database_problem(error: &sqlx::Error) -> Response {
    log::problem(&format!(
        "database error while handling a WebSub hub: {error}"
    ));
    StatusCode::INTERNAL_SERVER_ERROR.into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::encoding::hex;

    #[test]
    fn only_a_delivery_signed_with_the_feeds_secret_is_believed() {
        let secret = b"a secret for one feed";
        let body = b"<feed>...</feed>";
        let sign = |method: &str| {
            let mut mac = <Hmac<sha2::Sha256> as KeyInit>::new_from_slice(secret).unwrap();
            mac.update(body);
            format!("{method}={}", hex(&mac.finalize().into_bytes()))
        };
        assert!(signed(secret, body, Some(&sign("sha256"))));
        assert!(signed(secret, body, Some(&sign("SHA256"))));
        // Another body, another secret, another method, or none at all.
        assert!(!signed(
            secret,
            b"<feed>forged</feed>",
            Some(&sign("sha256"))
        ));
        assert!(!signed(b"another secret", body, Some(&sign("sha256"))));
        assert!(!signed(secret, body, Some(&sign("sha1"))));
        assert!(!signed(secret, body, Some(&sign("md5"))));
        assert!(!signed(secret, body, None));
        assert!(!signed(secret, body, Some("sha256=")));
        assert!(!signed(secret, body, Some("sha256=zz")));
        assert!(!signed(secret, body, Some("nonsense")));
    }

    #[test]
    fn sha1_signatures_from_older_hubs_are_checked_too() {
        // From the HMAC standard's own examples (RFC 2202, case 2).
        assert!(signed(
            b"Jefe",
            b"what do ya want for nothing?",
            Some("sha1=effcdf6ae5eb2fa2d27416d5f184df9c259a7c79")
        ));
        assert!(!signed(
            b"Jefe",
            b"what do ya want for nothing!",
            Some("sha1=effcdf6ae5eb2fa2d27416d5f184df9c259a7c79")
        ));
    }

    #[test]
    fn the_hub_is_sent_a_proper_form_and_the_right_address() {
        assert_eq!(
            form(&[
                ("hub.mode", "subscribe"),
                ("hub.topic", "https://a.example/feed?x=1&y")
            ]),
            "hub.mode=subscribe&hub.topic=https%3A%2F%2Fa.example%2Ffeed%3Fx%3D1%26y"
        );
        let public = Url::parse("https://app.nineturtles.app").unwrap();
        assert_eq!(
            callback(&public, "abc"),
            "https://app.nineturtles.app/websub/abc"
        );
    }
}
