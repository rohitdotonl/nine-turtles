-- Search (SPEC section 14). This change only adds a search index and one
-- rule that keeps it tidy: nothing already stored is changed or removed.
-- Articles already stored are added to the index in the background when
-- slowfeed starts (search::index_missing).

-- Every article's title and plain text, split into words for SQLite's FTS5
-- search engine. "Contentless" (content=''): the index keeps only the
-- words' positions, not a second copy of each article, so it stays small on
-- the 1 GB disk. Each line's number (rowid) is its article's number. The
-- word-splitting setting is FTS5_TOKENIZER in src/search.rs (decision 0004);
-- tests/search.rs checks the two match.
CREATE VIRTUAL TABLE articles_search USING fts5(
    title,
    body,
    content = '',
    contentless_delete = 1,
    tokenize = "unicode61 remove_diacritics 2 categories 'L* N* Co M*'"
);

-- An article deleted (an unsubscribed feed's unstarred articles, once Undo
-- has passed) leaves the index with it.
CREATE TRIGGER articles_search_delete AFTER DELETE ON articles BEGIN
    DELETE FROM articles_search WHERE rowid = old.id;
END;
