-- Sign-up no longer sends a link (decision 0115), and the owner changes
-- their email by a link like everyone else (decision 0125), so what was
-- kept only for the old sign-up links goes: the 'sign-up' purpose, the
-- waiting password scramble (`password_hash`), and the Sign-up switch and
-- invite link's settings. SQLite can't change a table's checks in place, so
-- `email_links` is made again, every other line copied across as it is, and
-- its indexes made again. Every link is now some reader's.
--
-- What goes: sign-up links (unusable since decision 0115; each expired
-- within a day), and the settings `sign_up`, `sign_up_invite` and
-- `sign_up_invite_made_at`, which nothing has read since then.
DELETE FROM settings WHERE name IN ('sign_up', 'sign_up_invite', 'sign_up_invite_made_at');

CREATE TABLE email_links_new (
    id INTEGER PRIMARY KEY,
    -- 'reset': sets a new password for the reader.
    -- 'change': moves the reader to a new email address.
    -- 'sign-in': signs the reader in on the device that opens it.
    purpose TEXT NOT NULL CHECK (purpose IN ('reset', 'change', 'sign-in')),
    -- Whose link it is. A reader's links go with them.
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    -- The address the link was sent to.
    email TEXT NOT NULL COLLATE NOCASE,
    token_hash BLOB NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0, 1)),
    -- 0 only for a 'change' try to an address another reader has: nothing
    -- is emailed and it's spent at once, but it counts towards the reader's
    -- changes in the hour, so the answer never tells the address is taken.
    -- Only emailed lines count towards an address's emails in the hour.
    emailed INTEGER NOT NULL DEFAULT 1 CHECK (emailed IN (0, 1)),
    CHECK (emailed = 1 OR (purpose = 'change' AND used = 1))
) STRICT;
INSERT INTO email_links_new
        (id, purpose, person_id, email, token_hash, created_at, expires_at, used, emailed)
    SELECT id, purpose, person_id, email, token_hash, created_at, expires_at, used, emailed
    FROM email_links
    WHERE purpose != 'sign-up';
DROP TABLE email_links;
ALTER TABLE email_links_new RENAME TO email_links;

-- As structure change 14 made them.
CREATE INDEX email_links_by_email ON email_links (email COLLATE NOCASE, created_at);
CREATE INDEX email_links_by_purpose ON email_links (purpose, created_at);
CREATE INDEX email_links_by_person ON email_links (person_id);
