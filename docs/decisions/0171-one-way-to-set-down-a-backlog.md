# 0171: One way to set down a backlog

**In one line:** One way to set down a backlog: Mark all as read (with Undo) stays; Catch me up, Let unread go after, Mark all above / below as read and Mark older as read (`Shift+O`) go; readers who had let unread go have their older unread marked read once, and the setting is deleted (structure change 37)

*4 November 2026. Step 6 of the owner's review plan. Rohit said go on the
whole plan and permitted removing these features and their data, including
the one-time data path below.*

**Why.** There were five ways to set down unread articles: Mark all as read,
Catch me up (everything before today), Let unread go after (a setting: a
week, two weeks or a month), Mark all above and Mark all below as read, and
Mark older as read (`Shift+O`). They overlapped and each needed explaining.
With no counts anywhere (decision 0148), a backlog weighs much less than in
other readers. One quiet way is enough.

**Decision.**

- **Mark all as read stays**, in the list's More menu and on `Shift+A`, with
  Undo. It still marks only what the list shows (DESIGN.md, principle 8).
- **Removed:** Catch me up, Settings › Reading › Let unread go after, Mark
  all above as read, Mark all below as read and Mark older as read
  (`Shift+O`, which now does nothing). Their server routes
  (`/api/articles/catch-up`, `/api/articles/read-past`), the background
  round's letting go and the file that held them (`unread.rs`) go with them, and so do the
  two DESIGN.md exceptions they needed.
- **The data path (structure change 37, no table changes):** for each reader
  who had chosen a wait, their unread articles older than that wait, in
  feeds they follow, are counted as read once, exactly as the background
  round did, so nothing old comes back into Unread when the setting goes.
  Then the `let_go` and `let_go_at` settings are deleted. Nothing else
  changes; every article stays in its feed, All and search. nine turtles
  backs itself up before the change (decision 0076).
- **Assistants** keep `mark_feed_read`: it marks a whole place, or its
  person's list, through `marks::whole_feed`.

Replaces "Catch me up" and letting unread go in decision 0097, and Mark
older, above and below as read in decision 0103 (its other keys stay).
