# 0090: The owner's Readers page, and fair limits

*26 October 2026. Milestone 5 of the plan for 100 to 200 readers
(https://claude.ai/artifact/V3GhrBxfXDG1TjPMsXQFPk): "Your admin page and
fair limits: see accounts and their problems, and limits such as 1,000 feeds
per reader and slower checking for feeds nobody opens." Built overnight
under the owner's standing approval; the choices below are the agent's,
open to change.*

**Decision.**

- **A Readers page for the owner** (`/settings/readers`, opened from
  Settings › Readers › All readers), in place of the list of readers that
  was inside Settings, so Settings stays short with 200 readers. It shows
  how this nine turtles is doing (readers, feeds, articles kept, the
  database's size, sign-ups waiting for their email, backups, email), what
  needs a look in plain sentences (backups off, email off, feeds failing for
  days), the problems logged since the last start, and one row per reader:
  email, joined, how many feeds they follow and how many of those keep
  failing. It only lists; it changes nothing.
- **Never what anyone reads.** Counts of feeds, never which feeds; nothing
  about articles, marks, searches or rules. **Not "last here" either, for
  now:** nine turtles knows the day each reader was last here (it decides
  whether their feeds rest, below), and showing it would tell the owner
  whether a tester has tried nine turtles yet. But it's new information
  about other readers' activity, which decision 0087 didn't cover and
  readers aren't told about, so it waits for the owner's yes
  (`docs/planning/questions.md`); if yes, Settings will tell readers too. (The owner said yes: decision 0093.)
- **At most 1,000 feeds per reader, the owner included.** It's well above
  what anyone reads (the owner follows about 200), and it keeps one account
  from making nine turtles fetch thousands of feeds for everyone. Following a
  1,001st feed is refused before anything is fetched; an OPML file that
  would go past it imports nothing, so a list is never half imported. Undo
  for unsubscribing and moving a feed to a new address aren't limited, so
  nothing the reader had can be lost to the limit.
- **Feeds nobody opens rest.** A reader is away after 30 days without
  opening nine turtles, signing in or syncing from another app. A feed whose
  every follower is away is checked once a day instead of on its own rhythm
  (up to every 30 minutes). When one of them comes back, their working feeds
  are checked straight away, 20 every 30 seconds as always, so the publisher
  is never asked twice within 30 minutes or sooner than a follower's Hourly
  or Daily allows. Failing feeds keep their longer wait, and feeds a WebSub
  hub delivers keep their twice-a-day backup check. Kinder to publishers, and to Render's one small server,
  as readers come and go.
- **No new database structure.** "Last here" is worked out from what's
  already stored (when the account was made, when each device was last
  used) plus one `here_at` row per reader in `person_settings`, noted at
  most once a day. So no structure change, nothing to back up first, and no
  clash with the yearly clean-up's structure change built at the same time.

**Not now.** A reader's plan and "paid until" (with payments, milestone 9);
acting on readers from the page (deleting someone, resetting a password),
which nobody has asked for and which would need the owner's choices first;
limits on folders, rules or saved searches, which cost nothing much.
