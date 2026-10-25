-- WebSub: instant updates from publishers whose feed names a hub (SPEC
-- section 12, decision 0069). This change only adds a table; nothing
-- already stored is touched. Times are seconds since 1970 (UTC).

-- One line per followed feed that offers a hub: what nine turtles asked
-- the hub for, and whether the hub said yes.
CREATE TABLE websub (
    feed_id INTEGER PRIMARY KEY REFERENCES feeds (id),
    -- The hub's address, and the feed's address as the hub knows it.
    hub TEXT NOT NULL,
    topic TEXT NOT NULL,
    -- The last part of the address the hub delivers to: random and
    -- unguessable, so nobody else can find it.
    token TEXT NOT NULL UNIQUE,
    -- Shared only with the hub; it signs every delivery with it, so nine
    -- turtles can tell a real one from a forgery.
    secret TEXT NOT NULL,
    -- When nine turtles last asked the hub.
    asked_at INTEGER NOT NULL,
    -- Until when the hub has promised to deliver, and for how long it
    -- promised (seconds); both null until it confirms.
    active_until INTEGER,
    lease INTEGER
) STRICT;
