# 0023: Search

*23 October 2026, Milestone 10. Built from SPEC section 14 without a separate plan (decision 0014).*

**One small index, no second copy.** Every article's title and plain text go
into an FTS5 search table (`articles_search`, structure change 6) with the
word-splitting setting of decision 0004. The table is "contentless": it keeps
only where each word appears, not the text itself, so it adds little to the
1 GB disk. Each line's number is its article's number. Plain text means the
article's HTML without its tags, so tag names and link addresses (`href`,
`https`) are never found as words. Articles enter the index as they arrive
or are edited (`feeds::store_articles`); a rule in the database removes an
article's line when the article is deleted. Articles stored before search
existed are added once, in the background, after the first start
(`search::catch_up`), 200 at a time, so the reader is never kept waiting.
Rejected: a copy of every article's text inside the index, which roughly
doubles the database for nothing the screen needs.

**What a search finds.** Every word typed must appear, in the title or the
text; each also finds longer words it begins ("read" finds "reading"), and
words in double quotes are found together. Everything typed is quoted
before it reaches FTS5, so its own syntax (`OR`, `NEAR`, `*`) is just words
and can never cause an error. Articles whose title holds every word come
first, then the rest, each part in the reader's sort order, 50 at a time
with the same "Show older items" as every list.

**Filters are plain settings.** The screen turns chips and typed filters
into a feed or folder, unread only, starred only and a date range, and the
server takes only those. `after:` and `before:` are strict, on the reader's
own calendar: `after:2026-01-31` starts on 1 February. Starting from Unread
or Starred, the search keeps that view as its scope ("in: Unread"). An
unsubscribed feed's articles are left out, except starred ones (SPEC
section 15). With no words, filters alone list what they match.

**Speed.** On the made-up library of 500 feeds and 100,000 articles
(`tests/speed.rs`), searches take a few milliseconds to about 60 in the
slower test build. A word in every single article is the one slow case: the
whole of that word's list is read and sorted, about 40 to 70 ms in the real
build. It's checked separately with more room, rather than made complicated
for a search nobody makes.

**Bold.** The screen marks words in result titles that begin with a
searched word. Unread titles are already semibold, and not every font has a
heavier weight, so a matched word's letters are also drawn slightly thicker
in the text's own color. Never a colored highlight.
