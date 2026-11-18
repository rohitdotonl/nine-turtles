-- "One person?" and people's own names (SPEC section 36, decision 0308).
--
-- 1. A new table, empty to begin with: two places the reader said to keep
--    apart, when nine turtles asked whether two follows sharing one website
--    are one person ("Keep apart"). It's never asked about them again.
--    `feed_a` is always the smaller number, so each pair is kept once.
--
-- 2. A person is now called by their own name when the articles that carry
--    a name all carry the same one, even if some carry none. People already
--    followed get it at their feed's next check, once, exactly as structure
--    change 35 did: only a person on their own whose name is still exactly
--    their feed's own title (a name the reader gave, or brought from
--    another app, stays). This only sets a flag; nothing is renamed here.
--
-- Nothing already stored is removed or rewritten.
CREATE TABLE kept_apart (
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    feed_a INTEGER NOT NULL REFERENCES feeds (id) ON DELETE CASCADE,
    feed_b INTEGER NOT NULL REFERENCES feeds (id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, feed_a, feed_b),
    CHECK (feed_a < feed_b)
) STRICT;

UPDATE subscriptions SET name_pending = 1
WHERE kind = 'person' AND writer_id IS NULL AND unsubscribed_at IS NULL;
