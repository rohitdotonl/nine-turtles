-- The yearly clean-up (SPEC section 23, decision 0089): unstarred articles
-- are removed a year after nine turtles first received them, and each
-- removed article's fingerprint is remembered here, so an article its feed
-- still lists isn't stored again as new. A feed's lines go when nobody
-- follows it any more (`folders::let_go`). Nothing already stored changes.
CREATE TABLE forgotten_articles (
    feed_id INTEGER NOT NULL REFERENCES feeds (id),
    -- The article's fingerprint (ENGINEERING.md → "Duplicates").
    fingerprint TEXT NOT NULL,
    PRIMARY KEY (feed_id, fingerprint)
) STRICT, WITHOUT ROWID;

-- The clean-up finds the articles received before a time with this.
CREATE INDEX articles_by_received ON articles (received_at);
