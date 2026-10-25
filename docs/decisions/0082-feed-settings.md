# 0082: Settings for each feed

*October 2026.*

**Decision.** Edit feed gains three settings for one feed, chosen by the
owner on 25 October 2026: its reading mode (Inbox or River), how often it's
checked (Automatic, at most Hourly, at most Daily) and "Open articles on the
website". They are three columns on `feeds` (structure change 9), each
defaulting to how every feed already behaved, so nothing changes until the
owner changes it.

- **River for one feed** means "skips Unread and counts nothing": the Unread
  list and its "new items" question leave the feed out, its sidebar count is
  0, and its rows look as in river mode wherever they're listed. The app-wide
  river mode (decision 0068) still applies to every feed. Read state is still
  recorded, so switching back shows what was read. Syncing apps (decision
  0070) keep their own unread rules and still see the feed's articles as
  unread or read.
- **Hourly and Daily** are a floor under the feed's own rhythm, applied after
  every check, failing ones too, and after an empty WebSub announcement.
  Choosing a longer wait moves the next check at once. Automatic is the
  rhythm as before. Every feed is still checked at least once a day.
- **Open on the website** opens the publisher's page in a new tab when an
  article is *opened* (Enter, `o`, a tap on a phone), and marks it read.
  Choosing it in the list still shows the summary, so `j` and `k` never open
  tabs. nine turtles itself fetches nothing from the site: the publisher
  floor holds.

**Why.** Calm over engagement: busy news feeds can flow past while blogs wait
to be read, and chatty feeds can be asked less often (fetching politely).
Power is hidden, never missing: every setting sits in Edit feed, and a feed
nobody touches behaves exactly as before.

**Revisit if** the owner wants a feed's mode chosen while adding it.
