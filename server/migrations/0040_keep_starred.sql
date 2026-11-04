-- Keep Starred, remove the other shelves (owner's plan, step 9, decision
-- 0174). Collections, saved searches and Recently read leave nine turtles,
-- and so does what earlier steps of the plan had left unused. nine turtles
-- is still being built, so the owner chose to delete it all outright, with
-- nothing carried over and no export (4 November 2026). The backup before
-- every structure change holds it as it was.
--
-- Collections and saved searches go, and Recently read's opening times.
DROP TABLE collection_articles;
DROP TABLE collections;
DROP TABLE saved_searches;
DROP INDEX entries_opened;
ALTER TABLE entries DROP COLUMN opened_at;

-- Up Next, unused since step 5 (decision 0170).
DROP TABLE up_next;

-- Rules switched off in step 8 (decision 0173): those with an author, for a
-- folder, or that starred or marked articles read. What they did stays done.
DELETE FROM rules
WHERE NOT (action = 'mute' AND author = '' AND words != '' AND folder_id IS NULL);

-- Readers' own keys (decision 0170), and the backlog and reading-mode
-- settings steps 6 and 7 replaced (decisions 0171, 0172), if any are left.
DELETE FROM person_settings WHERE name IN ('keys', 'let_go', 'let_go_at', 'mode');
