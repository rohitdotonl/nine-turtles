-- Recently read (SPEC section 5, decision 0105): the sidebar's list of the
-- last 50 articles the reader opened, newest-opened first. Each of a
-- reader's lines now remembers when they last opened that article
-- (milliseconds since 1970, by the server's clock), or nothing. Only the
-- latest 50 of each reader keep a time (`recent::opened`), so this stays
-- tiny. Nothing already stored changes: every line starts with no time.
ALTER TABLE entries ADD COLUMN opened_at INTEGER;

-- The list, newest-opened first, reading only the reader's few opened lines.
CREATE INDEX entries_opened ON entries (person_id, opened_at) WHERE opened_at IS NOT NULL;
