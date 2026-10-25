# 0075: An open tab switches to a new version on the next move

*25 October 2026. Part of making nine turtles ready for more readers (the SaaS plan): a tab left open while a new version goes live should keep working, without stale-page errors.*

**Decision.** When a tab learns that a newer nine turtles is live, it
switches to it the next time the reader goes to another place: a sidebar
place, Settings, a feed's edit page, or Back and Forward. That move becomes
a full page load of the address the reader was going to, instead of a
switch inside the old page.

- **Noticing.** Every answer already names the version that sent it
  (decision 0022). A tab also asks `/api/session` when it comes back into
  view and every 5 minutes while in view, so a tab left alone for days
  notices too.
- **Never under the reader.** Nothing reloads while they read, scroll or
  type. Opening and closing a sheet over a place, and opening an article,
  stay inside the page.
- **Nothing lost.** It waits while a mark is still being saved (including
  marks trying again during a restart, decision 0073), and when the move
  carries an Undo notice (such as after unsubscribing). The next move after
  that switches instead.
- **Keyboard.** If the keyboard was in use, its place goes to the new
  page's heading, as it would have without the switch.
- **Kept:** "A new version is ready · Reload" in Settings, and "nine turtles
  was updated. Reload to continue." for a request the newer server no
  longer understands.

**Why.** The old page's code can drift from the server's: a request it
sends may no longer be understood. Reloading at once would move the screen
under the reader (DESIGN.md → "Nothing moves unless you move it"); a move
to another place redraws the screen anyway, so it's the calm moment. The
app's code is one file loaded at the start, and fonts and icons have fixed
addresses, so nothing else in an old tab goes missing after a deploy.
