-- Folders, and unsubscribing with undo (SPEC sections 15 and 16). This
-- change only adds tables, columns and an index: every feed already
-- followed stays followed, in no folder, with all its articles and marks.
-- Times are seconds since 1970 (UTC).

-- The reader's folders. Two folders can't share a name, whatever its
-- capital letters.
CREATE TABLE folders (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
) STRICT;

-- Which feeds are in which folders. A feed can be in several; deleting a
-- folder (or a feed) removes only these lines, never the feeds.
CREATE TABLE feed_folders (
    folder_id INTEGER NOT NULL REFERENCES folders (id) ON DELETE CASCADE,
    feed_id INTEGER NOT NULL REFERENCES feeds (id) ON DELETE CASCADE,
    PRIMARY KEY (folder_id, feed_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX feed_folders_by_feed ON feed_folders (feed_id);

-- When the reader unsubscribed, or null while they follow the feed. For a
-- few minutes the feed is only hidden, so Undo can bring it back whole.
ALTER TABLE feeds ADD COLUMN unsubscribed_at INTEGER;
-- 1 once an unsubscribed feed's unstarred articles and folders are gone for
-- good. The line itself stays only while starred articles need its name.
ALTER TABLE feeds ADD COLUMN cleared INTEGER NOT NULL DEFAULT 0 CHECK (cleared IN (0, 1));
