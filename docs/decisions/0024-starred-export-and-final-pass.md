# 0024: Starred export, and the final V1 pass

*23 October 2026, Milestone 14. Built from SPEC sections 22, 23 and 25 without a separate plan (decision 0014).*

**The starred export is a JSON Feed 1.1 file** (`starred.rs`, decided in Q23),
downloaded from Settings → Your data at `/api/starred/export`. It holds every
starred article, newest first, including those of feeds since unsubscribed
(they stay in Starred). Each item keeps the cleaned text the feed sent, its
summary, original link, author, publication time (RFC 3339, in UTC) and
language. JSON Feed has no field for the feed an item came from, so that
goes in an extension named `_slowfeed` (the format asks extensions to start
with an underscore): the feed's name, its address and the publisher's site.
That keeps the credit with the article (the publisher floor) and lets a
later slowfeed, or any tool, put stars back where they came from. The
item's ID is the feed's address with the feed's own ID for the article, so
it's unique across feeds even when the same post arrives through two feeds
(the link alone isn't); the link goes in `url`. Rejected: OPML (it
carries feeds, not articles), and a slowfeed-only format (the export is
for leaving, so it must be one other tools read).

**Opening an article is announced to screen readers.** Showing an article
marks it read with no words on screen (the title turns grey). A screen
reader user can't see that, so a hidden, polite announcement says "Marked
as read" (SPEC section 22). It's kept out of the visible line above the
list, so that line still offers Undo for the last real action.

**Speed.** The export walks the starred articles' own index, already in
order, and the speed tests hold it to a second for 2,000 starred articles in
a library of 100,000. The app's download stayed at about 48 KB of code and
styles (budget 150 KB) and 339 KB of fonts (budget 400 KB).
