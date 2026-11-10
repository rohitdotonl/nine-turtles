# 0253: No false alarms, no waiting

**In one line:** Fewer rounds per change: browser tests wait for a save before leaving the page and never take "the first article" of a shared list; the building agent brings in main and goes through the reviewer's list before opening, hears the moment the checks finish (never a timer), renumbers a taken decision only in a push it needs anyway, and runs `node scripts/decisions.mjs --free` just before merging

*10 November 2026.*

Rohit's "yes" (10 November 2026), after a minute-by-minute look at one
thread (pick up and drop, pull requests #348 and #352). It took 1 hour 42
minutes from his idea to ideas 1 and 2 being live; building took 16 minutes.
Three of its four check runs failed, and none of those failures was a bug in
the app.

**Decision.** Nothing any check enforces changes; the checks stop raising
false alarms, and agents stop losing time around them.

- **A test waits for the save.** Write back's publication test pressed Done
  and moved on as soon as "Edit Blog …" showed the name, which it does
  before the save, so the next page sometimes loaded the old choice. It now
  waits for their page to come back. `docs/operations/checks.md` says so for
  Done in Edit, and says that All articles, Unread and Starred are shared by
  every test: a test finds its own article by name, never "the first
  article" there (the marking test's failure, fixed in #348).
- **Before opening:** bring in the latest main (a pull request with a
  conflict runs no checks at all, which left #352 unchecked for about ten
  minutes), and go through the full reviewer's list yourself: the review
  found contrast while held and the keyboard's place, both on that list.
- **Hear the checks finish.** After each push, something that wakes the agent
  when they end (a command waiting in the background, or the tool's
  notifications), never a timer: twice a finished result sat unread for
  about eight minutes.
- **Decision numbers.** Renumbered only in a push the change needs anyway.
  `node scripts/decisions.mjs --free` fetches main and fails if another
  change has since taken one of this branch's numbers; each change's own
  checks ran before the other merged, so they can't see it.

Automatic retries of failed tests stay out (decision 0114, "Not done"):
they would hide real bugs, like the sidebar's save clash that one "random"
failure found the same day (decision 0019).

The steps are in `docs/operations/second-agent-review.md`.
