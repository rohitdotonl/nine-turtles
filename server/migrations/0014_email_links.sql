-- Links sent by email (decision 0088): confirming a new account's address,
-- setting a new password, and confirming a changed address.
--
-- Each link carries a long random ticket (32 bytes, as a device's sign-in
-- ticket); only its BLAKE2s scramble is kept here, so a copy of the
-- database can't be used to follow one. A link works once, until it
-- expires (a day, or an hour for a new password). Used lines are kept
-- until they expire, so the emails an address was sent in the last hour
-- can be counted; expired lines are deleted every round of background
-- checking. A confirmed sign-up's waiting password scramble is blanked at
-- once. Nothing already stored changes.
CREATE TABLE email_links (
    id INTEGER PRIMARY KEY,
    -- 'sign-up': confirms an account made while sign-up is Open. The
    --     account doesn't exist yet: its email and scrambled password wait
    --     here, and the reader is made only when the link is followed.
    -- 'reset': sets a new password for the reader.
    -- 'change': moves the reader to a new email address.
    purpose TEXT NOT NULL CHECK (purpose IN ('sign-up', 'reset', 'change')),
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

-- How many emails went to one address, or for one purpose, in the last hour.
CREATE INDEX email_links_by_email ON email_links (email COLLATE NOCASE, created_at);
CREATE INDEX email_links_by_purpose ON email_links (purpose, created_at);
CREATE INDEX email_links_by_person ON email_links (person_id);
