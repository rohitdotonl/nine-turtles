-- People are called by their names (owner's plan, step 2, decision 0167):
-- a person whose feed signs every article with the same one author's name
-- is called by that name, not by the blog's title ("Tomas Berg", not
-- "Notes from Tomas"). The blog's title still shows under the name on
-- their page.
--
-- People followed before this change get their name at their feed's next
-- check, once nine turtles has the publisher's title fresh from the feed
-- (`writers::kind::name_by_author`): only a person on their own (not
-- joined to others, who keep the name the reader chose) whose name is
-- still exactly that title. A name the reader typed, or brought from
-- another app, stays. A publication keeps its title.
--
-- This change adds one column and changes nothing else, so every feed,
-- article, mark, folder and note carries on exactly as before.

-- 1 while this reader's person still waits for the check that names them.
ALTER TABLE subscriptions ADD COLUMN name_pending INTEGER NOT NULL DEFAULT 0;

UPDATE subscriptions SET name_pending = 1
WHERE kind = 'person' AND writer_id IS NULL AND unsubscribed_at IS NULL;
