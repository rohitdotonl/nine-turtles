-- Collections (SPEC section 34, decision 0108): the reader's own named
-- shelves for articles ("To cite", "Recipes"). An article can be on several.
-- This change only adds two tables; nothing already stored is touched.
-- Times are seconds since 1970 (UTC).

-- Each reader's collections. One reader's names are unique whatever their
-- capital letters; another reader may use the same name.
CREATE TABLE collections (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    name TEXT NOT NULL COLLATE NOCASE,
    created_at INTEGER NOT NULL,
    UNIQUE (person_id, name)
) STRICT;

-- Which of the reader's articles are on which collection. Each line points
-- at the reader's own entry for the article, so an article in a collection
-- is always one the reader has. That entry can't be deleted while a line
-- points at it (no ON DELETE here, on purpose): an article in a collection
-- is kept forever, like a starred one, and the clean-up and unsubscribing
-- leave it (`cleanup`, `folders::clear`). Deleting a collection deletes its
-- lines, never an entry or an article.
CREATE TABLE collection_articles (
    collection_id INTEGER NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (collection_id, article_id),
    FOREIGN KEY (person_id, article_id) REFERENCES entries (person_id, article_id)
) STRICT, WITHOUT ROWID;

-- An entry's collections (the sheet's tick boxes, and whether the clean-up
-- must keep it), read from the entry's side.
CREATE INDEX collection_articles_by_entry ON collection_articles (person_id, article_id);
