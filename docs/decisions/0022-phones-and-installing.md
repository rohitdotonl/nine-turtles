# 0022: Phones and installing the app

> **Partly replaced by [0067](0067-turtle-logo.md):** the lowercase "s" icon gave way to the turtle; and by [0085](0085-open-tabs-switch-on-the-next-move.md) on tabs left open across an update.

*23 October 2026, Milestone 13. Built from SPEC section 20 and DESIGN.md → "Mobile" without a separate plan (decision 0014). The owner chose to keep all of it in V1, including installing and opening without a connection.*

**Back is history.** On a phone each move (Feeds → list → article) is an
entry in the browser's history, and the entry's state names its screen and
the screen before it. The system back gesture just goes back in history; the
labeled back arrow does the same when the screen before is the one it names,
and otherwise (after arriving from a link or a reload) moves there in place.
So both always agree. Rejected: separate addresses for "the feeds screen"
and "an open article", which would add addresses that mean nothing on a
computer.

**One top bar per screen, inside its area.** The feeds screen keeps the
wordmark and Settings and gains Refresh; a list's bar holds "‹ Feeds",
Refresh and the list's name (which stops scrolling on phones); an article's
holds the back arrow and Mark unread, with Previous, Next, Star, Share and
Open original in a bottom toolbar. The desktop sidebar toggle and the
keyboard hint are not shown on phones.

**A page-first service worker.** The page always comes from the server when
it can, so opening slowfeed starts the newest version without any "waiting"
step, and the kept copy is only for opening without a connection. The app's
code in `/assets/` never changes under a name, so a kept copy is always
right; copies the current page doesn't use are removed. API answers are never
kept: the reader's articles stay on the server. Rejected: keeping the page
first and updating it in the background, which can leave a phone a version
behind for a day and needs more machinery for no gain to one reader.

**A version on every answer.** The server adds `x-slowfeed-version` to every
answer. The first one a tab sees is its own version. A different one means a
newer slowfeed is live (Settings: "A new version is ready · Reload"); a
different one on a "didn't understand" refusal (400, 404, 405, 415, 422)
means this tab can't carry on, and the list's reserved line says so. So that
a dropped read address counts too, an unknown `/api/` address is now "not
found" rather than the app's page. The service worker leaves every `/api/`
address alone, so a download such as the OPML export is never swapped for
the kept page.

**Back from pages, too.** Close settings, Escape on Settings or Add a feed,
and Cancel or Save on the edit pages go back one step on a phone, like the
back arrow, so the system back gesture never reopens them.

**The icon.** (Replaced by the turtle logo, decision 0067.) A lowercase "s" in Literata, text color on off-white: the
wordmark's first letter, no logo shape (DESIGN.md → "Name and signature").
Easy to change: three PNG files in `web/public/icons/`.
