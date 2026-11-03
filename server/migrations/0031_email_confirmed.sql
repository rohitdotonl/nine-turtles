-- Confirming an address at sign-up (SPEC section 1, decision 0154, which
-- replaced decision 0115's "no email at sign-up").
--
-- Each reader's address now says whether, and when, it was confirmed by a
-- link sent to it. Readers who signed up before this start with their
-- address not confirmed (empty); following a link sent to their address
-- confirms it. Nothing else about them changes.
--
-- A sign-up waits for its link again, as before decision 0115: the account
-- doesn't exist yet, so its address and scrambled password wait in
-- `email_links`, and the reader is made only when the link is followed.
-- SQLite can't change a table's checks in place, so `email_links` is made
-- again with the 'sign-up' purpose allowed, every line copied across as it
-- is, and its indexes made again. Nothing already stored changes.

-- When a link sent to the reader's email was followed: at sign-up, by a
-- sign-in link, or on moving to a new address. Empty while it isn't.
ALTER TABLE people ADD COLUMN email_confirmed_at INTEGER;

CREATE TABLE email_links_new (
    id INTEGER PRIMARY KEY,
    -- 'sign-up': makes a new reader's account. The account doesn't exist
    --     yet: its email and scrambled password wait here.
    -- 'reset': sets a new password for the reader.
    -- 'change': moves the reader to a new email address.
    -- 'sign-in': signs the reader in on the device that opens it.
    purpose TEXT NOT NULL CHECK (purpose IN ('sign-up', 'reset', 'change', 'sign-in')),
    -- Whose link it is; empty only for 'sign-up'. A reader's links go with them.
    person_id INTEGER REFERENCES people (id) ON DELETE CASCADE,
    -- The address the link was sent to.
    email TEXT NOT NULL COLLATE NOCASE,
    -- Only for 'sign-up': the new reader's password, scrambled (argon2id).
    password_hash TEXT,
    token_hash BLOB NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0, 1)),
    -- 0 only for a 'change' try to an address another reader has: nothing
    -- is emailed and it's spent at once, but it counts towards the reader's
    -- changes in the hour, so the answer never tells the address is taken.
    -- Only emailed lines count towards an address's emails in the hour.
    emailed INTEGER NOT NULL DEFAULT 1 CHECK (emailed IN (0, 1)),
    CHECK ((purpose = 'sign-up') = (person_id IS NULL)),
    CHECK ((purpose = 'sign-up') = (password_hash IS NOT NULL)),
    CHECK (emailed = 1 OR (purpose = 'change' AND used = 1))
) STRICT;
INSERT INTO email_links_new
        (id, purpose, person_id, email, token_hash, created_at, expires_at, used, emailed)
    SELECT id, purpose, person_id, email, token_hash, created_at, expires_at, used, emailed
    FROM email_links;
DROP TABLE email_links;
ALTER TABLE email_links_new RENAME TO email_links;

-- As structure change 14 made them.
CREATE INDEX email_links_by_email ON email_links (email COLLATE NOCASE, created_at);
CREATE INDEX email_links_by_purpose ON email_links (purpose, created_at);
CREATE INDEX email_links_by_person ON email_links (person_id);
