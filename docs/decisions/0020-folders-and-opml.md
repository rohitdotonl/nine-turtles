# 0020: Folders, unsubscribing and OPML

*23 October 2026, Milestone 9. Built from SPEC sections 5, 15 and 16 without a separate plan (decision 0014). The owner hadn't yet answered whether V1 should allow only one folder per feed (the "scope trim" question), so this follows the spec as written: a feed can be in several folders, and sidebar search is in.*

**Folders are a small table and a list of pairs.** `folders` holds each
folder's name (unique, whatever its capitals); `feed_folders` holds which
feed is in which folder (structure change 5). A feed in two folders is two
pairs, so deleting a folder only removes pairs, never feeds. A folder's
unread count is its feeds' counts added up on screen, since every article
belongs to exactly one feed.

**A folder's list walks the articles in order.** Like the other lists, it
reads articles newest first from the `articles_newest` index and keeps
those whose feed is in the folder, so there's never a sort done on the spot.
The slowest case, a folder holding one quiet feed, is in `tests/speed.rs`.

**Unsubscribing hides first and clears later.** Undo has to bring a feed
back "with its read history", so unsubscribing can't delete straight away.
It sets `unsubscribed_at`: the feed leaves the sidebar, Unread, All and its
folders, and background checks skip it. After ten minutes, or as soon as
the reader unsubscribes from another feed (Undo only ever reverses the last
action), it's cleared for good: its unstarred articles and folder pairs are
deleted. If starred articles remain, the feed's line stays (marked
`cleared`) only so Starred can still name their source; otherwise it goes
too. Rejected: deleting at once and sending everything back on Undo (a big
feed's articles are megabytes); a separate "trash" table (more structure
for the same result).

**Following a feed again starts it afresh.** Adding or importing a feed
that was unsubscribed reuses its line, so starred articles rejoin it and
nothing is duplicated; everything else arrives new and unread.

**Deleting a folder is undone by creating it again** with the same name and
feeds. The screen remembers which feeds were in it, so the server keeps no
history.

**Edit pages have their own addresses** (`/feeds/3/edit`, `/folders/2/edit`),
like Settings and "+ Add feed", instead of a pop-up: Escape and the
browser's Back button work as everywhere else, and nothing covers the
screen.

**The sidebar.** Folders are listed A to Z with a button that shows or
hides their feeds (closed by default, remembered per device), then feeds in
no folder. The search field filters both by name, ignoring capitals and
accents, into one flat list; Escape empties it.

**OPML import writes down, then fetches in the background.** Importing
fetches nothing: each new feed is due for a background check straight
away, and rounds of 20 fetch them over the next few minutes, as politely as
any other check. A feed's name comes from the file until the reader
renames it. A feed listed in several folders becomes one feed in all of
them; one already followed joins the file's folders; folders inside folders
become the innermost one. Lines that aren't web addresses are listed back
by name. Uses the approved `opml` library, which was checked at this
milestone: it reads OPML 1.0, 1.1 and 2.0 and writes 2.0, and is small
enough that replacing it later would be easy.

**Measuring the database.** The diagnostics page already shows the
database's size. After the owner imports their OPML file on the live app,
the daily check reports that size once, and again a week later
(`docs/operations/daily-check.md`), which tells us how long the 1 GB disk
lasts with every article kept. Measuring needs the owner's real feeds, so it
can only happen once this milestone is live.
