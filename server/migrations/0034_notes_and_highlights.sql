-- Notes and highlights (SPEC section 42, decision 0164): a private note on
-- each person, and highlights and notes on articles, each reader's alone.
--
-- This change only adds a table and two columns, empty for everything
-- already stored, so every feed, subscription, article and mark carries on
-- exactly as before. Times are seconds since 1970 (UTC).

-- A reader's highlights and their notes on articles. A line with a `quote`
-- is a highlight: the words the reader marked, as plain text, with a few
-- characters either side (`before`, `after`) so the screen finds the right
-- place when the words come more than once. Its `note` is optional. A line
-- with no `quote` is the reader's note on the whole article (at most one
-- per article), and always has a `note`.
--
-- Each line points at the reader's own entry for the article, so a marked
-- article is always one the reader has. That entry can't be deleted while a
-- line points at it (no ON DELETE here, on purpose): a marked article is
-- kept forever, like a starred one, and the clean-up and unsubscribing leave
-- it (`cleanup`, `folders::clear`), unless the reader chose to remove what
-- they kept when unsubscribing (`subscriptions.drop_kept` below).
CREATE TABLE notes (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    quote TEXT,
    before TEXT NOT NULL DEFAULT '',
    after TEXT NOT NULL DEFAULT '',
    note TEXT,
    made_at INTEGER NOT NULL,
    changed_at INTEGER NOT NULL,
    CHECK (quote IS NOT NULL OR note IS NOT NULL),
    FOREIGN KEY (person_id, article_id) REFERENCES entries (person_id, article_id)
) STRICT;

-- An article's highlights and note (the reading area, and whether the
-- clean-up must keep it), read from the entry's side.
CREATE INDEX notes_by_entry ON notes (person_id, article_id);
-- One note on the whole article, at most.
CREATE UNIQUE INDEX notes_one_per_article ON notes (person_id, article_id) WHERE quote IS NULL;

-- The reader's note on a person, set on every place of theirs at once (as
-- `write_to` is). It stays on a place the reader unsubscribed from, keeping
-- the place's line, so following them again brings it back.
ALTER TABLE subscriptions ADD COLUMN note TEXT;

-- 1 when the reader, unsubscribing, chose to remove the articles they
-- starred or marked and their note on the person too. It's done only when
-- the unsubscribe is cleared for good (`folders::clear`), so Undo before
-- then brings everything back; following again sets it back to 0.
ALTER TABLE subscriptions ADD COLUMN drop_kept INTEGER NOT NULL DEFAULT 0
    CHECK (drop_kept IN (0, 1));
