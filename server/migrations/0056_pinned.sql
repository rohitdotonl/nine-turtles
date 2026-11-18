-- Pinned (SPEC section 5, decision 0310): the people and publications a
-- reader pinned to the top of Home, up to nine.
--
-- One new column on what a reader follows: when they pinned it, in seconds
-- since 1970, which orders Pinned (the first pinned first); none for
-- everything already followed, so nothing is pinned until the reader pins
-- someone. A person's pin is kept on each of their places, as Write back's
-- switch is. Nothing already stored is removed or rewritten.
ALTER TABLE subscriptions ADD COLUMN pinned_at INTEGER;
