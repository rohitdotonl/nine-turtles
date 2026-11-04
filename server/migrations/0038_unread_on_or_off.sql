-- Inbox and River go as names (owner's plan, step 7, decision 0172): one
-- switch, Settings › Reading › Unread, On or Off. A reader who chose River
-- has Unread off; everyone else has it on, as nothing stored means.
--
-- A single feed could also be set to flow past (river), so its articles
-- skipped Unread. That goes too. So that Unread doesn't suddenly fill with
-- them, their unread articles are counted as read once, quietly, as they
-- already looked. Then the column goes.
--
-- Nothing else is deleted: every article stays in its feed, All and
-- search, and stars, notes and highlights stay as they are.

UPDATE entries
SET read = 1, read_marked_at = CAST(unixepoch('subsec') * 1000 AS INTEGER)
WHERE read = 0
    AND feed_id IN (
        SELECT feed_id FROM subscriptions
        WHERE subscriptions.person_id = entries.person_id AND river = 1);

INSERT INTO person_settings (person_id, name, value)
    SELECT person_id, 'unread', 'off' FROM person_settings
    WHERE name = 'mode' AND value = 'river';

DELETE FROM person_settings WHERE name = 'mode';

ALTER TABLE subscriptions DROP COLUMN river;
