# 0012: V1 is for one reader: no backups, and six features moved to V2

*23 October 2026, before Milestone 3. Decided by the owner.*

**What.** V1 is used only by the owner, so it leaves out what one reader
can do without. Moved to V2:

- **Backups and recovery** (Milestone 3), including `backups.md` and
  `moving-hosts.md`.
- **River mode.** V1 has inbox mode only.
- **WebSub** (Milestone 12). Regular, polite checking finds new posts within
  the hour, which suits a slow reader.
- **The feed health page** (Milestone 11). In V1, failing feeds are reported
  by the daily check instead, as a count from the diagnostics page (from
  Milestone 8).
- **The yearly clean-up** of unstarred articles (part of Milestone 14). V1
  keeps every article; Milestone 9 measures whether the 1 GB disk is enough.
- **The "New to feeds?" guide page.**
- **Keeping a tab left open across an update working.** In V1 such a tab is
  told plainly to reload.

**Why.** The owner keeps their own OPML file, so their feeds and folders can
always be rebuilt. Fewer features means V1 arrives sooner and has less that
can break.

**What it costs, said plainly to the owner before deciding.** The
engineering floor says data is backed up before structure changes and
nothing deletes without undo or a backup. Without backups, if Render's disk
is lost, stars and reading history are lost too. Stars can be saved with the
starred export. Render keeps its own daily disk copies for at least a week,
but warns they may not restore a database cleanly, so they're a last resort.
So the owner changed the floor's wording for V1 (a change, not an
exception, since floors have none): nothing deletes without undo; any change
that could lose data (such as a structure change that drops or rewrites data)
is raised with the owner first. Asked directly, the owner chose that
unsubscribing still deletes the feed's unstarred articles and read history
(stars are kept), knowing undo only reaches back one action, so after the
next action they're gone for good.

Taking WebSub out touches the publisher floor's "fetch politely" line, but
politeness is still met: each feed is checked on its own rhythm with
ETag / Last-Modified, `Retry-After` and backoff.

**Rejected for now.** The Milestone 3 plan (nightly copies to Cloudflare R2
with the `object_store` library); relying on Render's disk copies as the
backup; and the low-cost middle option: slowfeed saving one clean copy of its
database on its own disk each night, so Render's daily disk copies always hold
a version that restores cleanly (no library, no account).

**Revisit** when V2 starts, when anyone besides the owner uses slowfeed, or
if the owner's reading history becomes something they'd mind losing.
