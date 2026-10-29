# 0130: The owner report

*29 October 2026.*

**Decision.** nine turtles has a hidden, read-only owner report at
`GET /owner-report` for the owner's own manual, which lives apart from
nine turtles in a private repository (AGENTS.md → "Project facts"). It
answers only to its own key, `NINE_TURTLES_OWNER_REPORT_KEY`, sent as
`Authorization: Bearer <key>`; without that setting it answers "not
found", as if it didn't exist. The key must be at least 32 characters, or
nine turtles doesn't start, as for the newsletter secret.

It gives counts and dates only: the version, the database's size, how many
problems were logged since start (never their text), the backups kept of
each kind (count, newest copy's name, size), readers in all and those who
joined or were here in the last 30 days, the feed and article counts the
Readers page shows, how many readers are free, on a trial, paid, on hold or
ended, and the days in the next 30 that a plan renews or ends or a trial
ends, sorted by day. Never a name, an email, a reader's number, or anything
about what anyone reads. What it gives is in
[`docs/operations/owner-report.md`](../operations/owner-report.md).

**Why.** The owner wants real numbers in their manual without any agent
holding the keys to the host, the backup storage or Dodo. A key that can
only read counts is the smallest thing that does it. It is a key of its
own, not the diagnostics key, so the daily check and the manual can each
be cut off without the other, and the diagnostics page's problem texts
(which can be detailed) never reach the manual.

**Rejected.** Reading the backup storage or Dodo from the manual directly
(more keys in more places); adding fields to the diagnostics page (one key
for two jobs).

**Revisit** if the manual needs something that isn't a count or a date: ask
the owner first.
