# 0056: Renamed nine turtles, and one theme, Original

> **Partly replaced:** [0058](0058-renamed-everywhere.md) renamed the names this note kept (program, settings, database, repository); [0063](0063-plain-theme-system-serif.md) added a second theme, Plain.

*24 October 2026. The owner's request, in their own words: "We are completely
deviating from Apple Books theming. Change the name to nine turtles (from
slowfeed). Remove all the current themes except original." Replaces the
theme list of 0046 and the theme tiles of 0045 and 0055.*

**Why.** The owner found the six Apple Books themes copied rather than
chosen, and wants the app to have a look of its own. Bold in particular did
little that a device's own "Bold Text" setting and the text-size control
don't already do. The new name is the owner's.

**What changed.**

- **The name.** Everything the reader sees says "nine turtles", always in
  lowercase as the old name was: the wordmark, the sign-in page, the
  browser tab's title, the home-screen name, messages, the status page
  ("nine turtles is running"), the exported file names
  (`nine-turtles-feeds.opml`, `nine-turtles-starred.json`) and the name the
  app gives publishers when it fetches a feed (`nine-turtles/<version>`).
  The documents use the new name too, except the decisions and changelog
  entries written before this one, which are history.
- **What keeps the old name, on purpose.** The program file (`slowfeed`), its
  settings (`SLOWFEED_*`), the database file (`slowfeed.sqlite`), the
  sign-in cookie, the browser's saved preferences, the repository and the
  Render service. Renaming them would break the live app's settings on
  Render, sign the owner out, or reset their reading preferences, for no
  visible gain. The starred export keeps its `_slowfeed` field so files
  already exported still read the same way.
- **One theme.** Quiet, Paper, Bold, Calm and Focus are removed, with their
  "Aa" tiles in Settings and the Aa panel, Bold's heavier article text and
  Literata's 800 weight (two font files), which only Bold used. Original
  stays, by day and by night, with the Light, Dark and Match device switch.
- **Nobody loses a choice.** A removed theme saved on a device opens as
  Original and keeps the Appearance saved with it; a theme from before 0046
  opens by day if it was light and by night if it was dark.

**Still open.** The owner is considering small touches of color, as GitHub
uses (a colored bar for where you are, a gold star for starred). That would
loosen 0037's one accent with one job, so it gets its own decision.
