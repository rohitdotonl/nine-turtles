## 27 October 2026: Small fixes found in the code survey

- Connecting an assistant (like Claude) twice at the same moment could list it twice in Settings; now it's always one line.
- After "Find new address" moved a feed that others follow too, articles you'd opened dropped out of Recently read, and a late offline mark could undo a newer star. Opened times and mark times now move with the article.
- Podcast show notes that quote iTunes tags (for example, tips on adding artwork) no longer get a stray "-" or a changed duration in them.
- An Undo that can't reach nine turtles now says "That couldn't be undone. Try again in a moment." instead of nothing.
- Behind the scenes: feeds are never fetched through a proxy (which would weaken the "public addresses only" guard), and the one-time move of the old database file moves its unsaved-changes file first.
