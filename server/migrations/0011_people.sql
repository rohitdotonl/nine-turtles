-- Many readers in one nine turtles, part one (decision 0086): a `people`
-- table, and an owner on every small personal table (signed-in devices,
-- settings, the app password, folders, saved searches and rules). Feeds,
-- articles, read marks and stars get theirs in the next structure change.
--
-- Nothing is lost: everything already stored becomes reader number 1's,
-- the owner's. Signed-in devices stay signed in. Tables whose rules change
-- ("two folders can't share a name" becomes "one reader's two folders
-- can't") are copied into a new table of the new shape and the old one
-- removed, in the order SQLite needs so that no folder pair is lost.
-- Times are seconds since 1970 (UTC).

-- The readers. Number 1 is the owner: the person who set nine turtles up,
-- who signs in with NINE_TURTLES_PASSWORD_HASH.
CREATE TABLE people (
    id INTEGER PRIMARY KEY,
    -- 1 for the owner only.
    owner INTEGER NOT NULL DEFAULT 0 CHECK (owner IN (0, 1)),
    created_at INTEGER NOT NULL
) STRICT;
-- Only one reader can be the owner; nine turtles knows them as number 1
-- (auth::OWNER).
CREATE UNIQUE INDEX people_one_owner ON people (owner) WHERE owner = 1;
INSERT INTO people (id, owner, created_at) VALUES (1, 1, unixepoch());

-- Signed-in devices, now each someone's.
CREATE TABLE sessions_new (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    token_hash BLOB NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
) STRICT;
INSERT INTO sessions_new (id, person_id, token_hash, created_at, last_used_at, expires_at)
    SELECT id, 1, token_hash, created_at, last_used_at, expires_at FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

-- Each reader's settings shared across their devices (the sort order and
-- the reading mode), one line each. `settings` keeps only what belongs to
-- nine turtles itself (the highest article number ever given).
CREATE TABLE person_settings (
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (person_id, name)
) STRICT, WITHOUT ROWID;
INSERT INTO person_settings (person_id, name, value)
    SELECT 1, name, value FROM settings WHERE name IN ('sort', 'mode');

-- Each reader's app password for other feed readers (SPEC section 26):
-- only its scrambled copy (BLAKE2s, as hex), which is unique, so an app's
-- password says whose it is.
CREATE TABLE app_passwords (
    person_id INTEGER PRIMARY KEY REFERENCES people (id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL UNIQUE,
    made_at INTEGER NOT NULL
) STRICT;
INSERT INTO app_passwords (person_id, password_hash, made_at)
    SELECT 1, hash.value, CAST(COALESCE(made.value, unixepoch()) AS INTEGER)
    FROM settings AS hash LEFT JOIN settings AS made ON made.name = 'app_password_made_at'
    WHERE hash.name = 'app_password';
DELETE FROM settings WHERE name IN ('sort', 'mode', 'app_password', 'app_password_made_at');

-- Folders, now each someone's: one reader's two folders can't share a name,
-- whatever its capital letters. The (folder, feed) pairs are put aside
-- first, since removing the old folders table would remove them with it.
CREATE TABLE feed_folders_kept AS SELECT folder_id, feed_id FROM feed_folders;
DROP TABLE feed_folders;
CREATE TABLE folders_new (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    name TEXT NOT NULL COLLATE NOCASE,
    UNIQUE (person_id, name)
) STRICT;
INSERT INTO folders_new (id, person_id, name) SELECT id, 1, name FROM folders;
DROP TABLE folders;
ALTER TABLE folders_new RENAME TO folders;
-- Which feeds are in which folders, as before; the folder says whose.
CREATE TABLE feed_folders (
    folder_id INTEGER NOT NULL REFERENCES folders (id) ON DELETE CASCADE,
    feed_id INTEGER NOT NULL REFERENCES feeds (id) ON DELETE CASCADE,
    PRIMARY KEY (folder_id, feed_id)
) STRICT, WITHOUT ROWID;
INSERT INTO feed_folders (folder_id, feed_id) SELECT folder_id, feed_id FROM feed_folders_kept;
DROP TABLE feed_folders_kept;
CREATE INDEX feed_folders_by_feed ON feed_folders (feed_id);

-- Saved searches, now each someone's, unique by name for each reader.
CREATE TABLE saved_searches_new (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    name TEXT NOT NULL COLLATE NOCASE,
    query TEXT NOT NULL CHECK (json_valid(query) AND json_type(query) = 'object'),
    created_at INTEGER NOT NULL,
    UNIQUE (person_id, name)
) STRICT;
INSERT INTO saved_searches_new (id, person_id, name, query, created_at)
    SELECT id, 1, name, query, created_at FROM saved_searches;
DROP TABLE saved_searches;
ALTER TABLE saved_searches_new RENAME TO saved_searches;

-- Rules, now each someone's; otherwise exactly as structure change 10 made them.
CREATE TABLE rules_new (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    words TEXT NOT NULL DEFAULT '',
    title_only INTEGER NOT NULL DEFAULT 0 CHECK (title_only IN (0, 1)),
    author TEXT NOT NULL DEFAULT '',
    feed_id INTEGER,
    folder_id INTEGER,
    place_gone INTEGER NOT NULL DEFAULT 0 CHECK (place_gone IN (0, 1)),
    action TEXT NOT NULL CHECK (action IN ('mute', 'star', 'read')),
    paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
    created_at INTEGER NOT NULL,
    CHECK (words != '' OR author != ''),
    CHECK (feed_id IS NULL OR folder_id IS NULL)
) STRICT;
INSERT INTO rules_new (id, person_id, words, title_only, author, feed_id, folder_id, place_gone,
        action, paused, created_at)
    SELECT id, 1, words, title_only, author, feed_id, folder_id, place_gone, action, paused,
        created_at
    FROM rules;
DROP TABLE rules;
ALTER TABLE rules_new RENAME TO rules;
CREATE INDEX rules_by_person ON rules (person_id);
