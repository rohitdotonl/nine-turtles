-- Newsletters as feeds, part two (SPEC section 28, decision 0091): each
-- reader's private address, and newsletter feeds that belong to one reader.
-- This change only adds a table and a column; nothing already stored
-- changes. Times are seconds since 1970 (UTC).

-- Each reader's newsletter addresses: the part before the @, in lowercase.
-- One is current; a replaced one is kept, retired, so mail to it is refused
-- rather than mistaken for someone else's (names are never given twice).
CREATE TABLE newsletter_addresses (
    name TEXT PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    -- When New address replaced it; null while it's the reader's current one.
    retired_at INTEGER
) STRICT, WITHOUT ROWID;
CREATE UNIQUE INDEX newsletter_addresses_current ON newsletter_addresses (person_id)
    WHERE retired_at IS NULL;

-- The reader a newsletter feed belongs to; null for every web feed. A
-- newsletter feed is never shared: each reader's copy of an email is their
-- own (its unsubscribe link carries their token). It is never checked in
-- the background, and its line stays after unsubscribing, so the sender's
-- later emails stay away. (No foreign key: a deleted reader's newsletter
-- feeds are removed by `people::delete`.)
ALTER TABLE feeds ADD COLUMN newsletter_of INTEGER;
CREATE INDEX feeds_newsletters ON feeds (newsletter_of) WHERE newsletter_of IS NOT NULL;
