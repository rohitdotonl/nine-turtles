-- Replies you started (SPEC section 37, decision 0307): on a person's page,
-- the articles of theirs the reader started a reply to, each with the day.
--
-- This only adds a table, empty to begin with: nothing already stored
-- changes. A line is written when the reader presses any way back at an
-- article's end (Write back, Gmail, Outlook.com, Copy address, Comment):
-- one per article, the latest day only, never what was written. nine turtles
-- can't know whether anything was sent, and the page says so.
--
-- Each line points at the reader's own entry for the article, and goes with
-- it: when the article leaves their library, so does the line. Times are
-- seconds since 1970 (UTC).
CREATE TABLE replies (
    person_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    PRIMARY KEY (person_id, article_id),
    FOREIGN KEY (person_id, article_id) REFERENCES entries (person_id, article_id) ON DELETE CASCADE
) STRICT;
