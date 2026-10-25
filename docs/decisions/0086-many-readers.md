# 0086: Many readers in one nine turtles

*25 October 2026. At the owner's request, milestone 3 of the plan for 100 to
200 readers, "Many readers in one app"
(https://claude.ai/artifact/V3GhrBxfXDG1TjPMsXQFPk). Builds on decision 0076
(backups).*

**Decision.** One nine turtles holds many readers, each with their own
things, in the one SQLite file:

- **One shared copy of each feed and its articles.** A feed is fetched once,
  however many readers follow it, so publishers are asked no more often than
  today (the publisher floor), and the database grows with the number of
  feeds, not readers.
- **Everything personal gets an owner:** a reader's number on each line,
  and every page and app request reads and changes only the signed-in
  reader's lines. Tests (`server/tests/walls.rs`) have a second reader try,
  on purpose, to read and change the first reader's things.
- **A `people` table** lists the readers. Reader 1 is the owner, who signs
  in with `NINE_TURTLES_PASSWORD_HASH` as before.

**Part one: structure change 11 (this change).** An owner on the small
personal tables:

- **Signed-in devices** (`sessions`): each belongs to a reader.
- **Settings shared across devices** (sort order, reading mode) move to a new
  `person_settings` table, one line per reader and setting. `settings` keeps
  only what belongs to nine turtles itself (the highest article number ever
  given).
- **App passwords** move to a new `app_passwords` table, one per reader. The
  scrambled copy is unique, so an app's password says whose it is.
- **Folders** and **saved searches**: names are unique per reader, not across
  the app.
- **Rules** belong to a reader, and run per reader on new articles. (The
  `muted` mark they set is still on the shared article until part two.)

Everything already stored becomes reader 1's, and devices stay signed in.
Tables whose rules change are copied into a table of the new shape, so
nothing is lost. Nothing on screen changes.

**Part two: structure change 12 (next).** What's still shared moves to tables
for each reader: following a feed, each feed's settings (river, open on
site, check at most), the reader's own name for a feed, and the read,
starred and muted marks. Unsubscribing then removes only that reader's
marks; an article is deleted only when nobody follows its feed and nobody
has starred it.

**Part three (later).** Signing in by email, and making a second account to
try it.

**Safety.** The backup before every structure change (decision 0076) runs
first: if backup storage is set and that copy fails, nothing changes.

**Rejected.** A separate database file per reader (each feed fetched once
per reader, and many files to back up and move); copying articles for each
reader (the database would grow with every reader, for the same text).
