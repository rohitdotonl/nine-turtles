# 0013: Look and feel foundations

> **Partly replaced** by later look-and-feel notes: ink blue no longer marks where you are (a grey pill does, [0057](0057-grey-pill-green-star.md)); the themes are now Original and Plain ([0056](0056-nine-turtles-one-theme.md), [0063](0063-plain-theme-system-serif.md)); and the "Press ? for shortcuts" hint and the top band's height changed ([0061](0061-redesign-notes-folded.md), [0062](0062-shortcuts-in-words-find-and-one-tip.md)).

*23 October 2026, Milestone 4. Plan approved by the owner; greys chosen by the owner (warm).*

**Colors.** Each theme has six colors and two tints, all in `web/src/app.css`:
the reading area uses DESIGN.md's background, the list and sidebar are one and
two steps deeper, so the areas differ by tone and never by lines. Text, muted
grey (warm) and ink blue are checked against every area and the selected-row
tint by `web/src/lib/contrast.test.ts`, straight from `app.css`, so pairs no
screen shows yet are covered too. Text reaches 7 : 1 everywhere, muted grey
at least 4.5 : 1, and the ink blue mark at least 3 : 1 (it's drawn as a bar,
not used for text). The grey options were nearly identical, because the
contrast rule leaves little room; the owner couldn't tell them apart, and warm
was kept because it suits the papers.

**Focus outline.** A 3px outline in the text color. Ink blue already means
"where you are" in slowfeed's own places, so the keyboard's place doesn't
share it. Radio buttons use the text color too, never the browser's blue.

**Fonts.** Literata (regular, italic, bold), Atkinson Hyperlegible (regular,
italic, bold), Inter (regular, semibold) and JetBrains Mono (regular), each in
basic and extended Latin pieces, copied from the Fontsource packages of
Google Fonts' files (SIL Open Font License, a licence file per font beside
them). About 339 KB of the 400 KB budget. Bold italic isn't shipped: the
browser slants the bold instead, which is the price of staying in budget.
Nothing was added to `package.json`; the files are simply part of the
repository. Replaces the font part of 0008.

**Type scale.** Tailwind's own text sizes are switched off in `app.css` and
replaced by DESIGN.md's five, so nothing else can be used by accident.

**Reader settings live in the browser.** Theme, reading font, text size and
line width are per device (SPEC section 18), so they're kept in the
browser's own storage (`localStorage`) under `slowfeed.preferences`. Anything
unreadable falls back to the defaults, and if storage is switched off the
choices still apply until the tab closes. Settings shared across devices
(sort order, Milestone 7) will live on the server.

**Addresses without a library.** `/unread`, `/starred`, `/all` and
`/settings` use the browser's own history; the server already answers any
unknown address with the app (`server/src/assets.rs`).

**Layout.** The width steps are in rem (75rem wide, 48rem medium), so zooming
in or a larger system text size steps the layout down rather than letting
things overlap. The rules are in `web/src/lib/layout.svelte.ts`, tested on their own.

**A band that never scrolls.** The top 4rem of every area stays still and
only the content below it scrolls. The Sidebar button (top left) and "Press ?
for shortcuts" (top right) sit in that band, fixed, so they never move and
nothing ever slides underneath them.

**Keyboard.** `web/src/lib/keyboard.ts` decides what a key means; it ignores
keys while typing and alongside Ctrl, Cmd or Alt. The cheat sheet lists every
shortcut in DESIGN.md and marks those whose features don't exist yet as
"coming later".

**Revisit if:** the font budget is needed for something else (drop the
extended Latin of Inter first, the largest piece), or a screen needs a sixth
text size (change DESIGN.md first).
