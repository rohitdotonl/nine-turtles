# 0095: Easing unread guilt

*October 2026.*

**Decision.** Three ways to keep Unread from turning into a debt, chosen by
the owner on 26 October 2026 from the "unread guilt" ideas. All three live in
Settings › Reading or the Unread list, change nothing until the reader asks,
and remove nothing.

- **Unread lets go by itself.** "Let unread go after: Never · 1 week ·
  2 weeks · 1 month", Never by default. An unread article older than the
  chosen time counts as read: it leaves Unread and the counts, and stays in
  its feed, All, its folders and search. "Older" is the article's date in the
  list, so the old posts of a blog just added don't fill Unread either. It
  happens in each background round (every 30 seconds), once the choice has
  stood for a minute: a segmented control saves each choice the arrow keys
  pass, and passing "1 week" on the way to "1 month" must mark nothing (a
  read mark has no undo here). It carries on in river mode, for feeds that
  flow past too: river mode shows no read state, and back in inbox mode
  Unread is as the reader chose. It's a real "read" mark, not a filter, so the feed's own
  list, the counts and syncing apps (decision 0070) all agree. Choosing Never
  again doesn't bring back what has already let go.
- **Catch me up.** In Unread's More menu: every article in Unread from before
  the start of today, on the reader's own device clock, counts as read,
  whether or not it's listed. The server answers which articles it marked,
  and Undo makes exactly those unread again (in parts of 10,000, the most one
  mark takes). It is the one mark that isn't named article by article by the
  screen: by asking for it, the reader asks for everything before today.
  Articles from today, and feeds that flow past, are left alone.
- **Unread without numbers.** "Unread counts: Show · Hide". Hidden, the
  sidebar shows no counts, and Unread, the dot and read styling stay. Each
  device remembers the choice too, so hidden numbers never flash before the
  server answers.

All three settings are shared across the reader's devices and are only shown
in inbox mode (river mode has no Unread).

**Why.** Calm over engagement: a backlog that can only grow is the kind of
pressure social media builds. Each of these lets the reader set the pile
down. None deletes anything, so the third floor holds.

**Exceptions log.** Catch me up and letting go mark articles the reader
hasn't seen, where principle 5 has "mark all as read" touch only what's on
screen; and the unread counts can now hide altogether. Both are written in
DESIGN.md's Exceptions log, as the owner asked for these features.

**Not chosen.** Letting go as a filter only (articles stay unread but hide
from Unread): the feed's own list would still show them unread while the
counts didn't, and syncing apps would disagree. A per-feed daily limit was
dropped by the owner.
