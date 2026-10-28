# 13. Refresh: the view waits for you

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- The list on screen changes only when you ask: press `r` or choose Refresh in the list's More (…) menu.
- When new items are waiting, a quiet note floats at the bottom of the list: **"New articles · press r"** (on touch screens: **"New articles"** with a **Show** button, which does the same as `r`). It shows no number. It sits at the foot of the list in a band of the list's own tone, which the rows end above, so nothing shifts when it appears and it never covers a row (decision 0048). The list asks the server about once a minute, and only about its own articles (none ever arrive in Starred).
- **Refresh** (its key, `r`, shown beside it) is in the More (…) menu beside every list's title, on phones too (section 6).
- Because fetching already happened in the background, pressing `r` is instant. It shows the list from the top again, with the new items, and updates the sidebar's unread numbers. Those numbers also wait for `r`, so nothing in the sidebar changes under you either.
- Opening or reloading the app always shows the latest state.
- No pull-to-refresh on phones; there's Refresh in the list's More menu, and Show in the "New articles" note, instead.

**How to check it**
1. Leave the app open. When the "New articles" note appears at the bottom, check the list hasn't moved.
2. Press `r`: new items appear at once, with no spinner.
3. Close and reopen the app: you see everything new without pressing anything.
