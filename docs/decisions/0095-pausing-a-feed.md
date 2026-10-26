# 0095: Pausing a feed

*26 October 2026. One of the ways to ease "unread guilt" the owner chose
(with "Unread lets go by itself", "Catch me up" and "Unread without
numbers"); he dropped the daily limit for busy feeds.*

## Decision

- **Where:** Edit feed › Settings, **Pause this feed**, a tick box row like
  "Open articles on the website" (not a switch: Edit feed's settings are
  saved together with Save, and a tick box says "on" the same way as its
  neighbour). The helper line says since when.
- **While paused:** the feed is still checked as usual and its new articles
  are stored, but the reader's entries for them arrive already read. They
  show in its own list, its folders, All and search, never in Unread or the
  counts. Nothing already unread changes. Keeping the checks means nothing
  the publisher lists is missed, and costs them nothing extra.
- **Unpausing:** the newest three of the articles received while it was
  paused go back to Unread, unless muted; the reader's rules run on them
  again. The rest stay read.
- **The reader's own** (`subscriptions.paused_at`, structure change 19):
  other readers of the feed see no change. "Find new address" keeps it;
  following again after unsubscribing starts it unpaused.

## Why

"Nothing piles up, and on return you get only the newest few" was the
promise. Marking the entries read rather than holding them back keeps
every article findable and loses nothing, and needs no new place to keep
them. One known edge: an article from the pause the reader opened in the
feed's own list and that is among the newest three comes back as unread.
Telling those apart would need another mark on every entry; it isn't worth
it.

## Not done

- A pause that ends by itself on a date. Untick it when you're back.
- The sidebar doesn't mark a paused feed (other threads are changing the
  counts there); Edit feed says it.
