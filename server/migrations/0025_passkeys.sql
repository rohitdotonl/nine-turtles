-- Passkey sign-in (SPEC sections 1 and 18, decision 0109): each reader may
-- add passkeys in Settings › Passkeys and sign in with one instead of a
-- password. Only the passkey's public half is stored: what's needed to
-- check its signature, never anything that could sign. A new table:
-- nothing already stored changes.
CREATE TABLE passkeys (
    id INTEGER PRIMARY KEY,
    -- Whose passkey it is. A reader's passkeys go with them.
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    -- The passkey's own number, chosen by the device that made it. Unique,
    -- so one passkey can never belong to two readers.
    credential_id BLOB NOT NULL UNIQUE,
    -- The random number the reader's passkeys carry for them (a UUID), the
    -- same for all of one reader's; a passkey hands it back at sign-in.
    user_handle TEXT NOT NULL,
    -- The public key, its counter and flags, as the webauthn-rs library
    -- writes them (JSON).
    passkey TEXT NOT NULL,
    -- The reader's own name for it; empty means "Passkey added <the day>".
    name TEXT,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER,
    -- Set when the reader removes it: it no longer signs in, and Undo can
    -- bring it back for ten minutes; after that it's deleted for good.
    removed_at INTEGER
) STRICT;

CREATE INDEX passkeys_by_person ON passkeys (person_id);
