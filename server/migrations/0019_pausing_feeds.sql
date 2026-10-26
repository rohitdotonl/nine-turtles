-- Pausing a feed (SPEC section 15, decision 0095): when the reader paused
-- it, or null while it isn't paused. While it's paused, its new articles
-- arrive already read; unpausing brings back its newest few to Unread.
-- This change only adds one column, empty for every feed, so every feed
-- carries on exactly as before. Times are seconds since 1970 (UTC).
ALTER TABLE subscriptions ADD COLUMN paused_at INTEGER;
