# 0018: Read state, stars and undo

*23 October 2026, Milestone 7. Built from SPEC sections 8, 9 and 18 without a separate plan (decision 0014).*

**Two marks on each article.** Read and starred are two yes/no columns on
the `articles` table (structure change 3), not separate tables: every list
needs them, and one row per article keeps the lists simple and fast. Every
article stored before starts unread and not starred. The change only adds
columns, indexes and a table, so it can't lose data; `tests/structure_changes.rs`
tries it on a filled copy first, as the data floor asks.

**Small indexes for the views.** The Unread and Starred views and the
sidebar's counts each have a "partial" index holding only the articles they
care about, so they stay quick with a year of articles (`tests/speed.rs`
checks every list in both orders, and the counts with nothing read at all).
Oldest first reads the same indexes backwards.

**The screen changes first, the server follows.** Marks show at once and
are sent behind, one at a time in order, so an undo can never overtake the
mark it undoes. Lists and unread counts fetched next wait for them; an
article's text never does, so a slow save can't hold up reading, and a
save that takes over 15 seconds counts as failed. If a mark can't be
saved, it goes back to what the server last confirmed, unless a later
save for the same mark is still on its way (that one decides), and the
reserved line says so.

**Marks name exact articles.** `POST /api/articles/read` and
`/api/articles/starred` take a list of article IDs (at most 10,000).
"Mark all as read" sends the articles listed on screen, so ones that
arrived in the background are never touched. Undo sends the opposite mark
for the same articles; the server keeps no history, which is enough for
"the last action only".

**What counts as "your next action".** The undo line stays until the next
undoable action or until you leave the list. Moving with `j` and `k`
doesn't clear it, so `m` then `j` can still be undone.

**Read when shown.** An article is marked read when the reading area
starts showing it. `m` on the article already showing keeps it unread
until you move to another article and back.

**A feed's own list shows everything.** Unread lists only unread articles;
a feed's list shows all of them, read ones greyed, like a book's table of
contents. Read articles stay in the Unread view until you leave it.

**The sort order is shared.** It's kept in a small `settings` table on the
server, so it applies on every device; the reader controls (theme, font,
size, width) stay per device in the browser.
