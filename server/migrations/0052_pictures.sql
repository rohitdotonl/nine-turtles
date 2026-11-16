-- A picture for each person and publication (SPEC section 36, decision
-- 0283): the one the feed gives, and the one a reader chose for them.
--
-- This only adds a column and a table, both empty for everything already
-- followed: until a feed is next fetched with something new, or a reader
-- chooses a picture, each shows their site's icon, or their initials.

-- The picture the feed itself names (RSS `<image>`, `itunes:image`, Atom's
-- logo or icon, JSON Feed's icon): an address on the publisher's site, which
-- the reader's browser loads as it loads an article's pictures.
ALTER TABLE feeds ADD COLUMN picture_url TEXT;

-- A picture the reader chose for someone they follow, kept on one of that
-- person's places (any of them stands for the person, as a note does).
-- Made small in the reader's browser before it arrives, so each is a few
-- kilobytes. Each reader's own: no one else sees it.
CREATE TABLE pictures (
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    feed_id INTEGER NOT NULL REFERENCES feeds (id) ON DELETE CASCADE,
    image BLOB NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('image/jpeg', 'image/png', 'image/webp')),
    -- When it was chosen, seconds since 1970 (UTC): also the picture's version,
    -- so a browser that kept an older one asks again.
    chosen_at INTEGER NOT NULL,
    PRIMARY KEY (person_id, feed_id)
) STRICT;
