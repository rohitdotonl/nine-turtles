-- Background checking of feeds (SPEC section 11). This change only adds
-- columns and an index: every feed already followed keeps everything it
-- has, and is simply due for its first background check.
-- Times are seconds since 1970 (UTC); waits are seconds.

-- When the feed is next looked at. 0: as soon as background checking starts.
ALTER TABLE feeds ADD COLUMN next_check_at INTEGER NOT NULL DEFAULT 0;
-- The feed's own rhythm: how long to wait between checks while it works,
-- from how often it publishes (between 30 minutes and a day).
ALTER TABLE feeds ADD COLUMN check_every INTEGER NOT NULL DEFAULT 14400;
-- Checks in a row that failed; 0 while the feed works.
ALTER TABLE feeds ADD COLUMN failures INTEGER NOT NULL DEFAULT 0;
-- When the current run of failures began, and when its current run of
-- "not found" (404 or 410) answers began, or null.
ALTER TABLE feeds ADD COLUMN failing_since INTEGER;
ALTER TABLE feeds ADD COLUMN missing_since INTEGER;
-- What went wrong last, as a short word for the logs (and the V2 feed
-- health page), or null while the feed works.
ALTER TABLE feeds ADD COLUMN problem TEXT;

-- The feeds due for a check, soonest first.
CREATE INDEX feeds_due ON feeds (next_check_at);
