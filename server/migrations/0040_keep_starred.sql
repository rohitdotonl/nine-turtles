-- Keep Starred, remove the other shelves (owner's plan, step 9, decision
-- 0174). Collections, saved searches and Recently read leave nine turtles.
--
-- Every article on any of a reader's collections gets that reader's star,
-- so it stays kept forever and easy to find in Starred. One already
-- starred keeps its star and its time. The star's time is now, so a sync
-- app's older "unstarred" can't take it off (decision 0101).
--
-- The collections' names and lines stay in the database, unused, so
-- Settings › Your data can still export them; saved searches stay too, as
-- the remembered words they are. Nothing here is deleted.

UPDATE entries SET starred = 1,
    starred_marked_at = MAX(starred_marked_at, CAST(unixepoch('subsec') * 1000 AS INTEGER))
WHERE starred = 0 AND EXISTS (SELECT 1 FROM collection_articles AS kept
    WHERE kept.person_id = entries.person_id AND kept.article_id = entries.article_id);
