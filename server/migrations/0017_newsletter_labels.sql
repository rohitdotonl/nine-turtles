-- Newsletters as feeds, part three (SPEC section 28, decision 0091): labels
-- on a reader's address, and each newsletter's one-click unsubscribe. This
-- change only adds two tables; nothing already stored changes. Times are
-- seconds since 1970 (UTC).

-- The labels a reader's address has had mail at (`name+label@…`), each
-- with its switch: mail to a label switched off is refused. A label goes
-- with its address.
CREATE TABLE newsletter_labels (
    name TEXT NOT NULL REFERENCES newsletter_addresses (name) ON DELETE CASCADE,
    -- In lowercase, as it was written after the +.
    label TEXT NOT NULL,
    first_at INTEGER NOT NULL,
    -- When the reader switched it off; null while it's on.
    off_at INTEGER,
    PRIMARY KEY (name, label)
) STRICT, WITHOUT ROWID;

-- What nine turtles knows of a newsletter feed's sender: the web address
-- that unsubscribes in one step (RFC 8058), from its newest email that
-- offers one, and when nine turtles used it after the reader unsubscribed.
CREATE TABLE newsletter_senders (
    feed_id INTEGER PRIMARY KEY REFERENCES feeds (id) ON DELETE CASCADE,
    one_click TEXT,
    told_at INTEGER
) STRICT;
