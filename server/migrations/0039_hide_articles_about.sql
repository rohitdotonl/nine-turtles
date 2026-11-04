-- Rules become one sentence (owner's plan, step 8, decision 0173): "Hide
-- articles about [words] from [everyone / this person]."
--
-- Rules that already fit (mute, words, every feed or one feed) carry on as
-- they are. A rule for a folder becomes one rule per person (or
-- publication) in that folder: one of their places stands for all of them.
-- A folder rule whose folder held nobody, or was already gone, stays as a
-- rule whose place is gone, matching nothing, as before.
--
-- Rules with an author, or that starred or marked articles read, stay in
-- the database, untouched, but nine turtles no longer shows or runs them
-- (it reads only mute rules without an author or a folder). What any rule
-- already did stays done.

INSERT INTO rules (person_id, words, title_only, author, feed_id, folder_id, place_gone,
        action, paused, created_at)
    SELECT rules.person_id, rules.words, rules.title_only, '', MIN(feed_folders.feed_id), NULL, 0,
        'mute', rules.paused, rules.created_at
    FROM rules
        JOIN feed_folders ON feed_folders.folder_id = rules.folder_id
        JOIN subscriptions ON subscriptions.person_id = rules.person_id
            AND subscriptions.feed_id = feed_folders.feed_id
            AND subscriptions.unsubscribed_at IS NULL
    WHERE rules.folder_id IS NOT NULL AND rules.action = 'mute' AND rules.author = ''
        AND rules.words != ''
    GROUP BY rules.id, COALESCE(subscriptions.writer_id, -feed_folders.feed_id)
    ORDER BY rules.id, MIN(feed_folders.feed_id);

DELETE FROM rules
WHERE folder_id IS NOT NULL AND action = 'mute' AND author = '' AND words != ''
    AND EXISTS (SELECT 1 FROM feed_folders
        JOIN subscriptions ON subscriptions.feed_id = feed_folders.feed_id
            AND subscriptions.unsubscribed_at IS NULL
        WHERE feed_folders.folder_id = rules.folder_id
            AND subscriptions.person_id = rules.person_id);

UPDATE rules SET folder_id = NULL, place_gone = 1
WHERE folder_id IS NOT NULL AND action = 'mute' AND author = '' AND words != '';
