-- People (SPEC section 36, decision 0146): a person is one human with one
-- or more places on the web (a blog, a channel, a newsletter), and each
-- person is one row in the sidebar. In the code they're "writers", because
-- the readers are already `people`.
--
-- A place the reader hasn't joined to another stays as it is, with no
-- writer: it's a person with one place, and looks exactly as before. Only
-- when the reader joins places ("Add another place", or "This is one
-- person" on a folder) is a writer made, holding the person's name.
--
-- This change only adds a table and two columns, empty for everything
-- already stored, so every feed, folder, article and mark carries on exactly
-- as before. Times are seconds since 1970 (UTC).

-- The people a reader has joined places into. Each is one reader's.
CREATE TABLE writers (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    -- The person's name, as the reader calls them.
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX writers_by_reader ON writers (person_id);

-- Which person a followed place belongs to; null for a place on its own.
-- Removing a person leaves their places followed, each on its own again.
ALTER TABLE subscriptions ADD COLUMN writer_id INTEGER REFERENCES writers (id) ON DELETE SET NULL;
CREATE INDEX subscriptions_by_writer ON subscriptions (writer_id) WHERE writer_id IS NOT NULL;

-- 1 once nine turtles has asked "Is this the same person?" about this
-- place, whatever the answer, so it asks only once.
ALTER TABLE subscriptions ADD COLUMN same_asked INTEGER NOT NULL DEFAULT 0
    CHECK (same_asked IN (0, 1));
