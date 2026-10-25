-- Rules and mutes (SPEC section 27, decision 0077). This change only adds a
-- table and a column: every article already stored starts as not muted,
-- and nothing already stored is changed or removed. Times are seconds since
-- 1970 (UTC).

-- The reader's rules: "when a new article matches this, do that".
CREATE TABLE rules (
    id INTEGER PRIMARY KEY,
    -- A word or phrase to look for, as the reader typed it; '' for none.
    words TEXT NOT NULL DEFAULT '',
    -- 1 to look only in the title; 0 for the title or the text.
    title_only INTEGER NOT NULL DEFAULT 0 CHECK (title_only IN (0, 1)),
    -- An author's name to look for; '' for any author.
    author TEXT NOT NULL DEFAULT '',
    -- Where it applies: one feed, one folder, or (both null) every feed.
    -- No foreign keys: when the feed or folder goes, the rule stays, paused
    -- and saying so, rather than vanishing or spreading to every feed.
    feed_id INTEGER,
    folder_id INTEGER,
    -- 1 once the feed or folder it applied to is gone; it then matches
    -- nothing until the reader chooses somewhere else.
    place_gone INTEGER NOT NULL DEFAULT 0 CHECK (place_gone IN (0, 1)),
    -- What it does: 'mute', 'star' or 'read'.
    action TEXT NOT NULL CHECK (action IN ('mute', 'star', 'read')),
    -- 1 while the reader has paused it.
    paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
    created_at INTEGER NOT NULL,
    CHECK (words != '' OR author != ''),
    CHECK (feed_id IS NULL OR folder_id IS NULL)
) STRICT;

-- 1 while a rule (or the reader) has muted the article: it's kept, and
-- counts as read, but only the Muted page, search and Starred show it.
ALTER TABLE articles ADD COLUMN muted INTEGER NOT NULL DEFAULT 0 CHECK (muted IN (0, 1));

-- The Muted page, newest first, reading only muted articles.
CREATE INDEX articles_muted ON articles (sort_at DESC, id DESC) WHERE muted = 1;
