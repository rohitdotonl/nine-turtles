-- Writing back, reworked with the owner on 16 November 2026 (SPEC section
-- 37, decision 0286).
--
-- This only adds two columns, both empty or off for everything already
-- here: every person keeps Write back on, and an article's Comments link
-- arrives the next time its feed brings it.

-- The reader switched Write back off for this person: no Write back at an
-- article's end, no paper plane, no `w` and no Write to on their page. Kept
-- on every place of the person, as the address typed for them is.
ALTER TABLE subscriptions ADD COLUMN write_back_off INTEGER NOT NULL DEFAULT 0;

-- Where the article's comments are, as its feed says (RSS's `<comments>`,
-- Atom's `rel="replies"` to a web page): an address on the publisher's
-- site, only ever linked to, never fetched.
ALTER TABLE articles ADD COLUMN comments_url TEXT;
