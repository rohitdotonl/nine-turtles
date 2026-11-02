-- Writing back (V1 item 2, decision 0147): the address a reader writes to a
-- person at. nine turtles only fills in the reader's own email app; it never
-- sends or reads that email.
--
-- This change only adds two columns, empty for everything already stored,
-- so every feed, subscription, article and mark carries on exactly as
-- before. A feed's address arrives with its next change; a newsletter's with
-- its next email.

-- The address the publisher gives: a feed's own (its author's or editor's
-- email), or a newsletter's Reply-To or From address. Never a "no-reply"
-- one. Shared by everyone who follows the feed, as its title is.
ALTER TABLE feeds ADD COLUMN email TEXT;

-- The address the reader typed for this person, which wins over the
-- feed's. Set on every place of a person at once, so it stays with them.
ALTER TABLE subscriptions ADD COLUMN write_to TEXT;
