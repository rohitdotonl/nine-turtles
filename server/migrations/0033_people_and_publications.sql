-- People and publications (SPEC section 36, decision 0160): everything a
-- reader follows is either someone (a person) or something (a publication),
-- and the sidebar lists them under two headings. A place joined to others
-- is always a person's; for a place on its own, nine turtles guesses from
-- the feed and the reader can change it.
--
-- This change adds two empty columns, so every feed, folder, person,
-- article and mark carries on exactly as before. nine turtles fills in its
-- guesses the next time each reader's sidebar loads. It also drops the
-- record of "Is this the same person?", a question nine turtles no longer
-- asks: nothing a reader sees or keeps is in it.

-- 'person' or 'publication': the reader's choice, or nine turtles' guess;
-- null until guessed.
ALTER TABLE subscriptions ADD COLUMN kind TEXT
    CHECK (kind IN ('person', 'publication'));

-- What kind of source a place is ('blog', 'video', 'newsletter' or
-- 'podcast'): nine turtles' guess from the feed, or the reader's
-- correction; null until guessed.
ALTER TABLE subscriptions ADD COLUMN place TEXT
    CHECK (place IN ('blog', 'video', 'newsletter', 'podcast'));

ALTER TABLE subscriptions DROP COLUMN same_asked;
