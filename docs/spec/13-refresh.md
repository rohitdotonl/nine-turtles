# 13. Refresh: the view waits for you

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- The list on screen changes only when you ask: press `r` or choose Refresh in the list's More (…) menu.
- When new items are waiting, a quiet note floats at the bottom of the list: **"New articles · press r"** (on touch screens: **"New articles"** with a **Show** button, which does the same as `r`). It shows no number. It sits at the foot of the list in a band of the list's own tone, which the rows end above, so nothing shifts when it appears and it never covers a row (decision 0048). The list asks the server about once a minute, and only about its own articles (none ever arrive in Starred).
- **Refresh** (its key, `r`, shown beside it) is in the More (…) menu beside every list's title, on phones too (section 6).
- Because fetching already happened in the background, pressing `r` is instant. It shows the list from the top again, with the new items, and updates the sidebar's unread numbers. Those numbers also wait for `r`, so nothing in the sidebar changes under you either. When nothing new has arrived, the note says so: "Nothing new has arrived since 14:05." (when the list last loaded; a day for an older load), with ×, so a refresh is never silent (decision 0229). It's a passing line: it never takes away an Undo (`u` still undoes the last action) or covers a failed save's line.
- Opening or reloading the app always shows the latest state.
- On a phone, the feeds screen (section 20) has no Refresh of its own: Unread's dot catches up as you arrive on it (back from a list, or coming back to the app), and then stay still while you look at it (decision 0188).
- **While a list brought from a file is being checked** (decision 0249): right after an import (section 16), each new feed waits for its first check, a few minutes for a long list. Until every one has been tried, Unread and All articles say how many are left, in a quiet line above the rows ("Bringing in your list: 5 feeds still to check."), or, while nothing has come yet, in place of "Nothing unread." (with "Their articles show here as each one is checked." under it). They ask about every five seconds instead of once a minute, and **fill in by themselves** as articles arrive (screen readers hear "New articles are in the list."), until the reader opens an article or loads older ones; from then on new ones wait for `r` as always. In the sidebar, each feed still waiting says **checking…** in the muted grey after its name (screen readers hear ", checking…"); the sidebar loads again only along with those fill-in asks, so names from the file become the writers' own as each is read, and it stays still once the reader is reading. A feed whose first try failed isn't waiting: it shows in Everyone you follow as usual. Nothing is asked while the tab is hidden. Nothing moves or spins: only words and rows that appear.
- No pull-to-refresh on phones; there's Refresh in the list's More menu, and Show in the "New articles" note, instead.

**How to check it**
1. Leave the app open. When the "New articles" note appears at the bottom, check the list hasn't moved.
2. Press `r`: new items appear at once, with no spinner. Press it again: "Nothing new has arrived since …".
3. Close and reopen the app: you see everything new without pressing anything.
4. On a phone, open a list, wait for "New articles", then go back: the feeds screen's dots already count the new articles, with no Refresh button there.
