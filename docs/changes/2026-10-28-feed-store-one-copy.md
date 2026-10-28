## 28 October 2026: One copy of the feed store's lookups

- Behind the scenes, the few database questions asked when a feed is
  added, followed again, imported, checked or delivered by a hub ("does
  this reader follow the feed at this address?", "is it waiting for
  Undo?", "is anyone still following it?", "take it out of the reader's
  folders") now each live in one place instead of being written out two
  to four times.
- Nothing you see or do in the app changed.
