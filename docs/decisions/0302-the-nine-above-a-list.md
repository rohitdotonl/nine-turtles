# 0302: The nine above a list

**In one line:** On a phone, a list pulled down past its top shows the nine turtles waiting above it, coming out one by one, then when nine turtles last looked; letting go puts the list back and nothing refreshes.

*17 November 2026. Rohit: nine turtles is "super utilitarian"; he wants software to be fun again, without gimmicks. Of eight ideas shown as mockups on the real app, he chose this one.*

**What changes.** The list follows a finger pulled down at its top at half its pace (at most 128px). The room it opens shows the logo's turtle, unchanged, in one row: one more for every 12px, up to nine. Once all nine are out, the line under them is the empty feed's own: "Last checked today at 20:56.", for the newest check of any of the reader's feeds. Letting go, the list slides back with the swipes' glide (`swipeMotion.ts`), at once with reduced motion. It's `web/src/lib/NineAbove.svelte`.

**Rules it bends, with Rohit's yes.**
1. BRAND.md → "The turtles' only job": no turtle inside the app (decision 0290). This is the one place, beside "four out in front" (0291). The turtles still never move by themselves, act or feel; the reader's finger brings them out.
2. "No pull-to-refresh": still true. The pull refreshes nothing, so it never pulls the reader back for more (principle "nothing pulls"); Refresh stays in More.
3. The swipes' rule that each is a shortcut for a button on the screen: this one is an Easter egg instead (DESIGN.md → "Easter eggs"), only for the reader who pulls.

**Not chosen (for now):** turtle species as release names, turtle-paced words for slow waits and a search Easter egg (Rohit: "not fun"); the tab icon's turtle tucking its head in offline (too hard to notice). A second round (a turtle walking with your reading, the nine asleep at night above an empty Unread, turtles all the way down past a list's end) is waiting for his pick.

**Revisit if** readers take the pull for a refresh and expect new articles from it.
