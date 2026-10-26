-- Signing in with an email address and a password (decision 0087).
--
-- Each reader gets an email address to sign in with, and the scrambled form
-- of their password (argon2id, as `nine-turtles set-password` makes it; the
-- password itself is never stored). Both start empty: the owner (reader 1)
-- keeps signing in with NINE_TURTLES_PASSWORD_HASH until they give
-- themselves an email in Settings, and their own password line stays empty
-- unless one is set for them. Nothing already stored changes.

ALTER TABLE people ADD COLUMN email TEXT COLLATE NOCASE;
ALTER TABLE people ADD COLUMN password_hash TEXT;

-- Two readers can't share an email address, however it's capitalised
-- ("Rohit@Example.com" is "rohit@example.com"). Readers without one (empty)
-- don't clash.
CREATE UNIQUE INDEX people_email ON people (email COLLATE NOCASE);
