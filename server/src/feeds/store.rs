//! Storing feeds, subscriptions, articles and each reader's entries: what
//! adding a feed, background checks, hubs, Undo and file imports all share.

use super::LATEST;
use crate::{AppState, checking, feed, fetch::Fetched, folders, rules, search};

/// Undo for unsubscribing: the reader's subscription comes back as it was,
/// if it isn't cleared yet, and a feed nobody else followed meanwhile is
/// checked again soon. Answers whether it came back.
pub async fn follow_again(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    feed_id: i64,
    now: i64,
) -> Result<bool, sqlx::Error> {
    let back = sqlx::query(
        "UPDATE subscriptions SET unsubscribed_at = NULL, kept_until = NULL
         WHERE person_id = ? AND feed_id = ? AND unsubscribed_at IS NOT NULL AND cleared = 0",
    )
    .bind(person)
    .bind(feed_id)
    .execute(&mut *connection)
    .await?;
    if back.rows_affected() == 0 {
        return Ok(false);
    }
    sqlx::query("UPDATE feeds SET next_check_at = ? WHERE id = ? AND unsubscribed_at IS NOT NULL")
        .bind(now)
        .bind(feed_id)
        .execute(&mut *connection)
        .await?;
    refresh_shared(connection, feed_id).await?;
    Ok(true)
}

/// Works out again what a feed's followers share, after any change to who
/// follows it or how: `feeds.unsubscribed_at` is null while anyone follows
/// it (so background checks and WebSub carry on), and `feeds.check_at_most`
/// is the shortest wait any follower allows (0, its own rhythm, if any
/// says so).
pub async fn refresh_shared(
    connection: &mut sqlx::SqliteConnection,
    feed_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE feeds SET
             unsubscribed_at = CASE
                 WHEN EXISTS (SELECT 1 FROM subscriptions
                              WHERE feed_id = feeds.id AND unsubscribed_at IS NULL) THEN NULL
                 ELSE COALESCE((SELECT MAX(unsubscribed_at) FROM subscriptions
                                WHERE feed_id = feeds.id),
                               feeds.unsubscribed_at, unixepoch())
             END,
             check_at_most = COALESCE((SELECT MIN(check_at_most) FROM subscriptions
                                       WHERE feed_id = feeds.id AND unsubscribed_at IS NULL), 0)
         WHERE id = ?",
    )
    .bind(feed_id)
    .execute(connection)
    .await?;
    Ok(())
}

/// The reader follows a feed already stored: a new subscription with the
/// name given and every setting as new, or their old one (kept for its
/// starred articles) started afresh.
pub async fn subscribe(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    feed_id: i64,
    title: &str,
    now: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO subscriptions (person_id, feed_id, title, added_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (person_id, feed_id) DO UPDATE SET
             title = excluded.title, added_at = excluded.added_at, unsubscribed_at = NULL,
             cleared = 0, river = 0, check_at_most = 0, open_on_site = 0,
             paused_at = NULL",
    )
    .bind(person)
    .bind(feed_id)
    .bind(title)
    .bind(now)
    .execute(&mut *connection)
    .await?;
    refresh_shared(connection, feed_id).await
}

/// Gives a reader who just followed a feed their own entry for each of its
/// articles already stored (for other readers): the ones the publisher
/// still lists (`fresh`) unread, older ones read. Entries they already have
/// (starred ones kept from before) stay as they are. Their rules then act on
/// the unread ones, as on any new article.
pub async fn enter_stored(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    feed_id: i64,
    fresh: &[feed::ParsedArticle],
) -> Result<(), sqlx::Error> {
    let mut unread = Vec::new();
    for article in fresh {
        let entered: Option<i64> = sqlx::query_scalar(
            "INSERT OR IGNORE INTO entries (person_id, article_id, feed_id, sort_at)
             SELECT ?, id, feed_id, sort_at FROM articles WHERE feed_id = ? AND fingerprint = ?
             RETURNING article_id",
        )
        .bind(person)
        .bind(feed_id)
        .bind(&article.fingerprint)
        .fetch_optional(&mut *connection)
        .await?;
        unread.extend(entered);
    }
    enter_read(connection, person, feed_id).await?;
    rules::apply_to(connection, person, feed_id, &unread).await
}

/// Gives the reader their own entry, already read, for each article of
/// this feed stored for other readers that they don't have an entry for yet.
pub async fn enter_read(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    feed_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR IGNORE INTO entries (person_id, article_id, feed_id, sort_at, read)
         SELECT ?, id, feed_id, sort_at, 1 FROM articles WHERE feed_id = ?",
    )
    .bind(person)
    .bind(feed_id)
    .execute(connection)
    .await?;
    Ok(())
}

/// The feed at this address (its `url_key`) that the reader follows, if any.
pub async fn followed_at(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    url_key: &str,
) -> Result<Option<i64>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT feeds.id FROM feeds JOIN subscriptions ON subscriptions.feed_id = feeds.id
         WHERE feeds.url_key = ? AND subscriptions.person_id = ?
             AND subscriptions.unsubscribed_at IS NULL",
    )
    .bind(url_key)
    .bind(person)
    .fetch_optional(connection)
    .await
}

/// The feed at this address (its `url_key`) that the reader unsubscribed
/// from but that isn't cleared yet, so Undo could still bring it back; with
/// `kept_only`, only one an assistant unsubscribed from (kept 30 days).
pub(super) async fn waiting_at(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    url_key: &str,
    kept_only: bool,
) -> Result<Option<i64>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT feeds.id FROM feeds JOIN subscriptions ON subscriptions.feed_id = feeds.id
         WHERE feeds.url_key = ? AND subscriptions.person_id = ?
             AND subscriptions.unsubscribed_at IS NOT NULL AND subscriptions.cleared = 0
             AND (? = 0 OR subscriptions.kept_until IS NOT NULL)",
    )
    .bind(url_key)
    .bind(person)
    .bind(kept_only)
    .fetch_optional(connection)
    .await
}

/// The number of the feed stored at this address (its `url_key`).
pub async fn stored_at(
    connection: &mut sqlx::SqliteConnection,
    url_key: &str,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM feeds WHERE url_key = ?")
        .bind(url_key)
        .fetch_one(connection)
        .await
}

/// Is anyone still following this feed? A check or a hub's delivery that
/// finishes after the last reader unsubscribed stores nothing.
pub async fn still_followed(
    connection: &mut sqlx::SqliteConnection,
    feed_id: i64,
) -> Result<bool, sqlx::Error> {
    let found: Option<i64> =
        sqlx::query_scalar("SELECT id FROM feeds WHERE id = ? AND unsubscribed_at IS NULL")
            .bind(feed_id)
            .fetch_optional(connection)
            .await?;
    Ok(found.is_some())
}

/// Does the reader follow this feed (not unsubscribed)?
pub async fn follows(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    feed_id: i64,
) -> Result<bool, sqlx::Error> {
    let found: Option<i64> = sqlx::query_scalar(
        "SELECT feed_id FROM subscriptions
         WHERE person_id = ? AND feed_id = ? AND unsubscribed_at IS NULL",
    )
    .bind(person)
    .bind(feed_id)
    .fetch_optional(connection)
    .await?;
    Ok(found.is_some())
}

/// What `follow_in` did.
pub enum Followed {
    /// The reader follows the feed now. `fresh`: it was new, or nobody
    /// followed it any more, so it was stored (or started afresh) from this
    /// fetch.
    New { feed_id: i64, fresh: bool },
    /// The reader already followed it.
    Already(i64),
}

/// Inside the caller's write: the reader follows the feed just fetched,
/// under the name given. The feed is stored once for everyone; the reader
/// gets their own subscription and entries.
pub async fn follow_in(
    transaction: &mut sqlx::SqliteConnection,
    state: &AppState,
    person: i64,
    fetched: &Fetched,
    parsed: &feed::ParsedFeed,
    title: &str,
    now: i64,
) -> Result<Followed, sqlx::Error> {
    // A feed that moved for good is remembered at its new address.
    let url = &fetched.lasting_url;
    let key = feed::normalize(url);
    let every = checking::rhythm(parsed, now);
    make_room(&mut *transaction, person, &key).await?;

    // New, or one nobody follows any more, started afresh. One that others
    // follow is left exactly as it is: their checks carry on.
    let fresh: Option<i64> = sqlx::query_scalar(
        "INSERT INTO feeds (url, url_key, title, site_url, language, etag, last_modified, added_at,
             fetched_at, check_every, next_check_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (url_key) DO UPDATE SET
             url = excluded.url, title = excluded.title, site_url = excluded.site_url,
             language = excluded.language, etag = excluded.etag,
             last_modified = excluded.last_modified, added_at = excluded.added_at,
             fetched_at = excluded.fetched_at, check_every = excluded.check_every,
             next_check_at = excluded.next_check_at, failures = 0, failing_since = NULL,
             missing_since = NULL, problem = NULL
         WHERE feeds.unsubscribed_at IS NOT NULL
         RETURNING id",
    )
    .bind(url.as_str())
    .bind(&key)
    .bind(&parsed.title)
    .bind(&parsed.site_url)
    .bind(&parsed.language)
    .bind(&fetched.etag)
    .bind(&fetched.last_modified)
    .bind(now)
    .bind(now)
    .bind(every)
    .bind(now + checking::wait(state, every))
    .fetch_optional(&mut *transaction)
    .await?;
    let feed_id = match fresh {
        Some(id) => id,
        None => stored_at(&mut *transaction, &key).await?,
    };
    if follows(&mut *transaction, person, feed_id).await? {
        return Ok(Followed::Already(feed_id));
    }
    subscribe(&mut *transaction, person, feed_id, title, now).await?;
    store_articles(&mut *transaction, feed_id, &parsed.articles, now).await?;
    enter_stored(&mut *transaction, person, feed_id, &parsed.articles).await?;
    Ok(Followed::New {
        feed_id,
        fresh: fresh.is_some(),
    })
}

/// Following again a feed the reader unsubscribed from starts it afresh:
/// whatever Undo could still have brought back is cleared first, so only
/// their starred articles carry over. Their subscription's line is then
/// reused (or made anew if nothing needed it).
pub async fn make_room(
    connection: &mut sqlx::SqliteConnection,
    person: i64,
    url_key: &str,
) -> Result<(), sqlx::Error> {
    if let Some(id) = waiting_at(&mut *connection, person, url_key, false).await? {
        folders::clear(connection, person, id).await?;
    }
    Ok(())
}

/// Stores new articles, numbered above every article ever stored, even ones
/// since removed by unsubscribing, so "anything newer than article N?"
/// never misses one and a number never means two articles. One already stored
/// (same fingerprint, same feed) that the publisher has since edited gets
/// the new words quietly: it keeps its place in the list, its read mark and
/// its star (SPEC section 11). One the yearly clean-up removed stays
/// removed (`cleanup`). Every reader whose subscription isn't
/// cleared (including one waiting for Undo) gets an entry for each new one,
/// unread (or already read, for a reader who paused the feed; SPEC section
/// 15), and each reader's rules then act on theirs (SPEC section 27).
pub async fn store_articles(
    connection: &mut sqlx::SqliteConnection,
    feed_id: i64,
    articles: &[feed::ParsedArticle],
    received_at: i64,
) -> Result<(), sqlx::Error> {
    // An article a feed lists twice counts once, as it's first listed, so
    // a check never flips it back and forth between the two.
    let mut seen = std::collections::HashSet::new();
    // Every new article is numbered above this; an edited one keeps its number.
    let before: i64 = sqlx::query_scalar(LATEST)
        .fetch_one(&mut *connection)
        .await?;
    for article in articles {
        if !seen.insert(article.fingerprint.as_str()) {
            continue;
        }
        // Removed by the yearly clean-up: still listed, but not new.
        let forgotten: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM forgotten_articles WHERE feed_id = ? AND fingerprint = ?",
        )
        .bind(feed_id)
        .bind(&article.fingerprint)
        .fetch_optional(&mut *connection)
        .await?;
        if forgotten.is_some() {
            continue;
        }
        let sort_at = article
            .published_at
            .map_or(received_at, |published| published.min(received_at));
        let episode = article.episode.as_ref();
        let stored: Option<i64> = sqlx::query_scalar(
            "INSERT INTO articles (id, feed_id, fingerprint, title, link, author, content,
                 summary, language, published_at, received_at, sort_at,
                 episode_url, episode_type, episode_bytes, episode_seconds, episode_artwork)
             VALUES (1 + MAX(COALESCE((SELECT MAX(id) FROM articles), 0),
                     COALESCE((SELECT CAST(value AS INTEGER) FROM settings
                               WHERE name = 'articles_high_water'), 0)),
                 ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (feed_id, fingerprint) DO UPDATE SET
                 title = excluded.title, link = excluded.link, author = excluded.author,
                 content = excluded.content, summary = excluded.summary,
                 language = excluded.language, episode_url = excluded.episode_url,
                 episode_type = excluded.episode_type, episode_bytes = excluded.episode_bytes,
                 episode_seconds = excluded.episode_seconds,
                 episode_artwork = excluded.episode_artwork
             WHERE articles.title IS NOT excluded.title OR articles.link IS NOT excluded.link
                 OR articles.author IS NOT excluded.author
                 OR articles.content IS NOT excluded.content
                 OR articles.summary IS NOT excluded.summary
                 OR articles.language IS NOT excluded.language
                 OR articles.episode_url IS NOT excluded.episode_url
                 OR articles.episode_type IS NOT excluded.episode_type
                 OR articles.episode_bytes IS NOT excluded.episode_bytes
                 OR articles.episode_seconds IS NOT excluded.episode_seconds
                 OR articles.episode_artwork IS NOT excluded.episode_artwork
             RETURNING id",
        )
        .bind(feed_id)
        .bind(&article.fingerprint)
        .bind(&article.title)
        .bind(&article.link)
        .bind(&article.author)
        .bind(&article.content)
        .bind(&article.summary)
        .bind(&article.language)
        .bind(article.published_at)
        .bind(received_at)
        .bind(sort_at)
        .bind(episode.map(|episode| &episode.url))
        .bind(episode.and_then(|episode| episode.media_type.as_ref()))
        .bind(episode.and_then(|episode| episode.bytes))
        .bind(episode.and_then(|episode| episode.seconds))
        .bind(episode.and_then(|episode| episode.artwork.as_ref()))
        .fetch_optional(&mut *connection)
        .await?;
        // New, or edited since: the search index gets its words.
        if let Some(id) = stored {
            search::index(
                connection,
                id,
                &article.title,
                article.content.as_deref(),
                article.summary.as_deref(),
            )
            .await?;
        }
    }
    sqlx::query(
        "INSERT OR IGNORE INTO entries (person_id, article_id, feed_id, sort_at, read)
         SELECT subscriptions.person_id, articles.id, articles.feed_id, articles.sort_at,
             subscriptions.paused_at IS NOT NULL
         FROM articles JOIN subscriptions ON subscriptions.feed_id = articles.feed_id
         WHERE articles.feed_id = ? AND articles.id > ? AND subscriptions.cleared = 0",
    )
    .bind(feed_id)
    .bind(before)
    .execute(&mut *connection)
    .await?;
    rules::apply_to_new(connection, feed_id, before).await
}
