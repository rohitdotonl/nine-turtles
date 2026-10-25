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

**Part two: structure change 12.** What was still shared moves to tables
for each reader:

- **`subscriptions`**: one line per reader and feed they follow, with their
  name for it (`feeds.title` keeps the publisher's), when they followed it,
  when they unsubscribed (for Undo), whether it's cleared, and the feed's
  settings (river, check at most, open on site), now each reader's own.
- **`entries`**: one line per article a reader has, with their read,
  starred and muted marks and a copy of its feed and place in the list, so
  every list reads one index of that reader's lines, in order, as before
  (`tests/speed.rs`, now with a second reader in the library).
- Everything already stored became reader 1's: every feed line a
  subscription with its name, settings and unsubscribing as they were (a
  feed unsubscribed just before the change can still be undone), every
  article an entry with its marks. Then the old columns went
  (`articles.read`, `starred`, `muted` and their indexes; `feeds.cleared`,
  `river`, `open_on_site`). `feeds.unsubscribed_at` and
  `feeds.check_at_most` stay, worked out from the subscriptions whenever
  one changes (`feeds::refresh_shared`): null while anyone follows the
  feed, and the shortest wait any follower allows, so background checks
  and WebSub read them as before.
- **Following a feed someone already follows** stores no second copy: the
  reader gets a subscription and an entry for each stored article (the
  ones the publisher still lists unread, older ones read). From an OPML
  file, which fetches nothing, the stored ones arrive read.
- **New articles** get an entry for every reader whose subscription isn't
  cleared; each reader's rules then act on their own entries only.
- **Unsubscribing** hides only that reader's subscription; checks stop when
  nobody follows the feed. Clearing (ten minutes later, or at their next
  unsubscribe) removes that reader's unstarred entries, their folder pairs
  for it, their rules' and saved searches' hold on it, and their line if
  no starred entry needs its name. When nobody follows or waits on a feed
  any more, its articles nobody has go, then its hub subscription, then
  the feed's line once no article is left. A database rule refuses to
  delete an article someone still has, or a subscription that still has
  entries.
- **Use this address** (feed health) changes the shared address only when
  the reader is the feed's only follower; otherwise they follow the new
  address instead, with their name, settings, folders, rules and saved
  searches, and leave the old one as unsubscribing does.
- Gaps closed: reading an article, an app's "items by number" and every
  mark now need the reader to have that article; "anything new?" for All
  leaves out unsubscribed feeds; following again from an OPML file resets
  the feed's own settings; apps are told the reader's own number.

**Part three (later).** Signing in by email, and making a second account to
try it.

**Safety.** The backup before every structure change (decision 0076) runs
first: if backup storage is set and that copy fails, nothing changes.

**Rejected.** A separate database file per reader (each feed fetched once
per reader, and many files to back up and move); copying articles for each
reader (the database would grow with every reader, for the same text).
