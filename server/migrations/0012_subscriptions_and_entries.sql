-- Many readers in one nine turtles, part two (decision 0086): following a
-- feed, each feed's own settings, the reader's name for it, and the read,
-- starred and muted marks become each reader's own. A feed and its articles
-- stay stored once, however many readers follow it.
--
-- Nothing is lost: every feed line becomes reader number 1's subscription,
-- with its name, settings and unsubscribing as they were (so Undo for a feed
-- unsubscribed just before the change still works), and every article
-- becomes an entry for reader 1 with its read, starred and muted marks.
-- Only then are the old columns removed. Times are seconds since 1970 (UTC).

-- Who follows which feed. One line per reader and feed.
CREATE TABLE subscriptions (
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    feed_id INTEGER NOT NULL REFERENCES feeds (id),
    -- The reader's name for the feed (they can rename it); `feeds.title`
    -- keeps the publisher's.
    title TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    -- When the reader unsubscribed; null while they follow it.
    unsubscribed_at INTEGER,
    -- 1 once Undo has passed and their unstarred entries are gone; the line
    -- stays only while their starred articles need its name.
    cleared INTEGER NOT NULL DEFAULT 0 CHECK (cleared IN (0, 1)),
    -- Edit feed's settings (SPEC section 15), now the reader's own.
    river INTEGER NOT NULL DEFAULT 0 CHECK (river IN (0, 1)),
    check_at_most INTEGER NOT NULL DEFAULT 0,
    open_on_site INTEGER NOT NULL DEFAULT 0 CHECK (open_on_site IN (0, 1)),
    PRIMARY KEY (person_id, feed_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX subscriptions_by_feed ON subscriptions (feed_id);

INSERT INTO subscriptions (person_id, feed_id, title, added_at, unsubscribed_at, cleared, river,
        check_at_most, open_on_site)
    SELECT 1, id, title, added_at, unsubscribed_at, cleared != 0, river != 0, check_at_most,
        open_on_site != 0
    FROM feeds;

-- One line per article a reader can see, with their marks. Its feed and
-- place in the list are copied from the article, so each list reads one
-- index of the reader's own lines, already in order.
CREATE TABLE entries (
    person_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL REFERENCES articles (id),
    feed_id INTEGER NOT NULL,
    sort_at INTEGER NOT NULL,
    read INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
    starred INTEGER NOT NULL DEFAULT 0 CHECK (starred IN (0, 1)),
    -- Muted by a rule or the reader: kept, counted as read, shown only on
    -- the Muted page, in search and in Starred (SPEC section 27).
    muted INTEGER NOT NULL DEFAULT 0 CHECK (muted IN (0, 1)),
    PRIMARY KEY (person_id, article_id),
    -- A subscription can't be removed while it still has entries.
    FOREIGN KEY (person_id, feed_id) REFERENCES subscriptions (person_id, feed_id)
) STRICT, WITHOUT ROWID;

INSERT INTO entries (person_id, article_id, feed_id, sort_at, read, starred, muted)
    SELECT 1, id, feed_id, sort_at, read != 0, starred != 0, muted != 0 FROM articles;

-- The lists, newest (or, read backwards, oldest) first: All and folders,
-- one feed, Unread, Starred and the Muted page; and the sidebar's counts.
CREATE INDEX entries_newest ON entries (person_id, sort_at, article_id);
CREATE INDEX entries_newest_by_feed ON entries (person_id, feed_id, sort_at, article_id);
CREATE INDEX entries_unread ON entries (person_id, sort_at, article_id) WHERE read = 0;
CREATE INDEX entries_starred ON entries (person_id, sort_at, article_id) WHERE starred = 1;
CREATE INDEX entries_muted ON entries (person_id, sort_at, article_id) WHERE muted = 1;
CREATE INDEX entries_unread_by_feed ON entries (person_id, feed_id) WHERE read = 0;
-- Whether anyone still has an article, when its feed's last reader leaves.
CREATE INDEX entries_by_article ON entries (article_id);

-- The old marks on the shared articles. Their indexes go first: SQLite
-- can't remove a column an index uses.
DROP INDEX articles_unread;
DROP INDEX articles_starred;
DROP INDEX articles_unread_by_feed;
DROP INDEX articles_muted;
ALTER TABLE articles DROP COLUMN read;
ALTER TABLE articles DROP COLUMN starred;
ALTER TABLE articles DROP COLUMN muted;

-- The old per-reader columns on feeds. `title` stays as the publisher's
-- name; `unsubscribed_at` (null while anyone follows the feed) and
-- `check_at_most` (the shortest any follower allows) stay too, worked out
-- from the subscriptions whenever one changes (`feeds::refresh_shared`),
-- so background checking and WebSub read them as before.
ALTER TABLE feeds DROP COLUMN cleared;
ALTER TABLE feeds DROP COLUMN river;
ALTER TABLE feeds DROP COLUMN open_on_site;
