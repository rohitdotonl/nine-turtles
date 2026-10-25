-- Saved searches in the sidebar (SPEC section 14). This change only adds a
-- table; nothing already stored is touched. Times are seconds since 1970
-- (UTC).

-- The reader's saved searches. Two can't share a name, whatever its
-- capital letters. `query` is what the search field held when it was saved
-- (its words, where it searched and its filters), as the screen writes it,
-- in JSON.
CREATE TABLE saved_searches (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    query TEXT NOT NULL CHECK (json_valid(query) AND json_type(query) = 'object'),
    created_at INTEGER NOT NULL
) STRICT;
