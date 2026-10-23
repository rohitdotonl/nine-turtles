-- Read state, stars and the reader's shared settings (SPEC sections 8, 9
-- and 18). This change only adds columns, indexes and a table: every
-- article already stored starts as unread and not starred, and nothing
-- already stored is changed or removed.

-- 1 once the article has been shown or marked as read; 0 while unread.
ALTER TABLE articles ADD COLUMN read INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1));
-- 1 while the reader has it starred. Starred articles are kept forever.
ALTER TABLE articles ADD COLUMN starred INTEGER NOT NULL DEFAULT 0 CHECK (starred IN (0, 1));

-- The Unread and Starred views, in list order. "Partial" indexes: each
-- holds only the articles it's about, so they stay small and the views
-- never read past articles they don't show.
CREATE INDEX articles_unread ON articles (sort_at DESC, id DESC) WHERE read = 0;
CREATE INDEX articles_starred ON articles (sort_at DESC, id DESC) WHERE starred = 1;
-- Each feed's unread count, counted from this index alone.
CREATE INDEX articles_unread_by_feed ON articles (feed_id) WHERE read = 0;

-- Settings shared across the reader's devices (SPEC section 18), one line
-- each. So far only the sort order: `sort` is `newest` or `oldest`.
CREATE TABLE settings (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL
) STRICT;
