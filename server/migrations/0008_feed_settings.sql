-- Settings for each feed, in Edit feed (SPEC section 15, decision 0073).
-- This change only adds columns, each with the value that keeps the feed
-- working exactly as before: nothing already stored is touched.
-- Waits are seconds.

-- 1: the feed flows past, as in river mode (no Unread, no count), even
-- while the app is in inbox mode. 0: it follows the app's reading mode.
ALTER TABLE feeds ADD COLUMN river INTEGER NOT NULL DEFAULT 0;
-- The shortest wait between background checks the reader allows this feed:
-- 0 (its own rhythm, as before), an hour or a day.
ALTER TABLE feeds ADD COLUMN check_at_most INTEGER NOT NULL DEFAULT 0;
-- 1: opening one of its articles opens the publisher's page in a new tab.
ALTER TABLE feeds ADD COLUMN open_on_site INTEGER NOT NULL DEFAULT 0;
