# 0249: Watch your list arrive

**In one line:** After an import, Unread says how many feeds are still to check and fills in by itself until the reader opens an article, and the sidebar says "checking…" beside each feed not yet read.

*10 November 2026.*

Rohit's "Implement L2" (10 November 2026) on the "Close the loop" critique
(`critique-24/principle-12-close-the-loop.html`, in the project's files).

**What was wrong.** Bringing a list from another app is a new reader's first
loop, and the slowest one. Feeds from a file are checked politely, twenty
every thirty seconds (section 11), so a long list takes minutes. Meanwhile
Unread said "Nothing unread." and the sidebar showed the names from the file,
with nothing to say anything was happening. A minute after importing, a test
screen looked exactly as it did a second after.

**Decision.**

1. **Which feeds are waiting** comes from the server: `/api/feeds` gives each
   feed `waiting`, true while it has never been fetched and never failed (a
   newsletter never waits). A feed whose first try failed isn't waiting; it
   shows in Everyone you follow as any failing feed does. Nothing new is
   stored, and fetching is exactly as polite as before.
2. **Unread and All articles say how many are left**: "Bringing in your list:
   5 feeds still to check.", a quiet line above the rows, or, while nothing
   has come yet, in place of "Nothing unread." with "Their articles show here
   as each one is checked." under it. A number in words that changes in
   place, never a bar or a spinner.
3. **They fill in by themselves** while any feed waits, asking every five
   seconds instead of once a minute, **until the reader opens an article**.
   After that, new articles wait for `r` as always, and once every feed has
   been tried the list is back to normal. This bends "Instant and still"
   (SPEC 13: the list changes only when you ask), written in DESIGN.md's
   Exceptions log: right after an import there is nothing yet to move under
   the reader, and "Nothing unread." was untrue.
4. **The sidebar says "checking…"** in the muted grey after each feed still
   waiting, and loads again every five seconds until none is, so names from
   the file become the writers' own as each feed is read.

**Considered.** Adding new articles below the ones shown, so nothing moves even
after an article is opened: it would break the list's order (newest or oldest
first), so the list fills in only until the reader starts reading.
