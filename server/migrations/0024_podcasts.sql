-- Podcasts (SPEC section 34, decision 0111): an article whose feed attaches
-- an audio file (an RSS <enclosure>, an Atom rel="enclosure" link or a JSON
-- Feed attachment) is an episode. Only the publisher's own address for the
-- file is kept, never the file: the reader's browser plays it straight from
-- the publisher. Nothing already stored changes: every article starts as no
-- episode, and becomes one at its feed's next check if it is.

-- The episode's audio file, as the feed gives it (an http or https address).
ALTER TABLE articles ADD COLUMN episode_url TEXT;
-- Its type, such as audio/mpeg, if the feed says.
ALTER TABLE articles ADD COLUMN episode_type TEXT;
-- Its size in bytes, if the feed says.
ALTER TABLE articles ADD COLUMN episode_bytes INTEGER;
-- How long it plays, in seconds (iTunes' <itunes:duration>), if the feed says.
ALTER TABLE articles ADD COLUMN episode_seconds INTEGER;
-- Its picture (the episode's own, else the podcast's), if the feed has one.
ALTER TABLE articles ADD COLUMN episode_artwork TEXT;

-- Where each reader stopped in each episode, so it carries on from there on
-- any of their devices. Each line points at the reader's own entry for the
-- article, and goes with it (unsubscribing, the yearly clean-up, deleting
-- an account). `position` and `duration` are seconds; `saved_at` is
-- milliseconds by the server's clock, so the latest save wins.
CREATE TABLE episode_progress (
    person_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    position REAL NOT NULL,
    duration REAL,
    finished INTEGER NOT NULL DEFAULT 0,
    saved_at INTEGER NOT NULL,
    PRIMARY KEY (person_id, article_id),
    FOREIGN KEY (person_id, article_id) REFERENCES entries (person_id, article_id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

-- Each reader's Up Next: the episodes they lined up to play, in their order
-- (`place`, smallest first). A line goes with the reader's entry, as above.
CREATE TABLE up_next (
    person_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    place INTEGER NOT NULL,
    PRIMARY KEY (person_id, article_id),
    FOREIGN KEY (person_id, article_id) REFERENCES entries (person_id, article_id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

CREATE INDEX up_next_in_order ON up_next (person_id, place);
