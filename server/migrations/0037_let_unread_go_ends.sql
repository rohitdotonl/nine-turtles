-- "Let unread go after" goes (owner's plan, step 6, decision 0171): Mark
-- all as read is the one way to set down a backlog. A reader who had chosen
-- a week, two weeks or a month had their older unread articles counted as
-- read in each background round. So that nothing old comes back into
-- Unread once the setting is gone, their unread articles older than their
-- chosen wait, in the feeds they follow, are counted as read one last time,
-- exactly as the background round did. Then the setting is removed.
--
-- No table or column changes, and nothing is deleted except the setting:
-- every article stays in its feed, All and search, read.

UPDATE entries
SET read = 1, read_marked_at = CAST(unixepoch('subsec') * 1000 AS INTEGER)
WHERE read = 0
    AND sort_at < unixepoch() - (
        SELECT CASE value
            WHEN 'week' THEN 7 * 86400
            WHEN 'two-weeks' THEN 14 * 86400
            WHEN 'month' THEN 30 * 86400
        END
        FROM person_settings
        WHERE person_settings.person_id = entries.person_id AND name = 'let_go')
    AND feed_id IN (
        SELECT feed_id FROM subscriptions
        WHERE subscriptions.person_id = entries.person_id AND unsubscribed_at IS NULL);

DELETE FROM person_settings WHERE name IN ('let_go', 'let_go_at');
