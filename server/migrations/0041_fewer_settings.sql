-- Fewer settings in Edit (the owner's core path, point 11, decision 0183).
-- "Check for new articles: Automatic / Daily" and "Open articles on the
-- website" leave nine turtles: every feed is checked on its own rhythm, and
-- every article opens here. The owner chose to delete what readers had set
-- (his standing permission for removed features' data, 3 November 2026).
-- The backup before every structure change holds it as it was.
--
-- What kind of source a place is ('blog', 'video', 'newsletter',
-- 'podcast') is no longer the reader's to change; nine turtles reads it
-- from the feed. Earlier corrections stay as they are.
ALTER TABLE subscriptions DROP COLUMN check_at_most;
ALTER TABLE subscriptions DROP COLUMN open_on_site;
ALTER TABLE feeds DROP COLUMN check_at_most;
