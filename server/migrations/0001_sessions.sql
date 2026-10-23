-- Signed-in devices. Each device holds a long random ticket in a cookie;
-- only a scrambled copy (BLAKE2s) is kept here, so a stolen copy of this
-- file can't be used to sign in. Times are seconds since 1970 (UTC).
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    token_hash BLOB NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
) STRICT;
