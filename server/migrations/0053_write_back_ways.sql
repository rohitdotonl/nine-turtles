-- Writing back, reworked with the owner on 16 November 2026 (SPEC section
-- 37, decision 0286).
--
-- This only adds columns, empty or off for everything already here: every
-- person keeps Write back on, by email, and an article's comments page
-- arrives the next time its feed brings it.

-- The reader switched Write back off for this person: no Write back at an
-- article's end, no paper plane, no `w` and no Write to on their page. Kept
-- on every place of the person, as the address typed for them is.
ALTER TABLE subscriptions ADD COLUMN write_back_off INTEGER NOT NULL DEFAULT 0;

-- The way the reader last answered this person at an article's end, which
-- its main button then offers: 'copy' (copying their address) or 'comment'
-- (their site's comments); empty is by email. Kept on every place of the
-- person, as above.
ALTER TABLE subscriptions ADD COLUMN write_back_way TEXT
    CHECK (write_back_way IN ('copy', 'comment'));

-- Where the article's comments are, as its feed says (RSS's `<comments>`,
-- Atom's `rel="replies"` to a web page): an address on the publisher's
-- site, only ever linked to, never fetched.
ALTER TABLE articles ADD COLUMN comments_url TEXT;
