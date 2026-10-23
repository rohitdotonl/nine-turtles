-- Feeds the reader follows, and their articles (SPEC sections 3 and 6).
-- This change only adds tables; nothing already stored is touched.
-- Times are seconds since 1970 (UTC).

CREATE TABLE feeds (
    id INTEGER PRIMARY KEY,
    -- The feed file's address, where slowfeed fetches it.
    url TEXT NOT NULL,
    -- The same address written one standard way (see feed::normalize), so
    -- the same feed can't be followed twice.
    url_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    -- The publisher's website, for credit.
    site_url TEXT,
    language TEXT,
    -- What the publisher said about the file last time, so the next fetch
    -- can ask "anything new?" (used from Milestone 8).
    etag TEXT,
    last_modified TEXT,
    added_at INTEGER NOT NULL,
    fetched_at INTEGER
) STRICT;

CREATE TABLE articles (
    id INTEGER PRIMARY KEY,
    feed_id INTEGER NOT NULL REFERENCES feeds (id),
    -- The feed's own ID for the article, its link, or a hash of title and
    -- date (ENGINEERING.md → "Duplicates").
    fingerprint TEXT NOT NULL,
    title TEXT NOT NULL,
    link TEXT,
    author TEXT,
    -- Already cleaned of anything unsafe (feed.rs).
    content TEXT,
    summary TEXT,
    language TEXT,
    -- When the publisher says it was published, if they say.
    published_at INTEGER,
    -- When slowfeed first received it.
    received_at INTEGER NOT NULL,
    -- The time the list sorts by: the published time, but never later than
    -- when it arrived (some feeds give dates in the future).
    sort_at INTEGER NOT NULL,
    UNIQUE (feed_id, fingerprint)
) STRICT;

-- The item list, newest first, for all feeds and for one feed.
CREATE INDEX articles_newest ON articles (sort_at DESC, id DESC);
CREATE INDEX articles_newest_by_feed ON articles (feed_id, sort_at DESC, id DESC);
