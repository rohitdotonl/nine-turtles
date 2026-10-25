# 0063: A second theme, Plain, and the device's own serif

*25 October 2026. The owner's request: "Go to www.rohit.onl. Pick the font
and offer that as an option in the app. And pick the bare HTML-ish look and
ship that as a theme (don't copy font size)." Adds to decision 0056 (one
theme) and DESIGN.md → "Typography".*

**Where it comes from.** rohit.onl, the owner's own site, sets almost
nothing: one font list, `ui-serif, Georgia, Cambria, "Times New Roman",
Times, serif`, and no colors at all, so it shows the browser's own: black
words on white, links in the browser's blue (`#0000EE`), purple once
visited (`#551A8B`), always underlined.

**What changed.**

- **A reading font, System serif.** The same font list as rohit.onl. It is
  the device's own serif (New York on a Mac, iPhone or iPad; Georgia on most
  other computers), so nothing is downloaded and no font service is asked.
  It joins Literata and Atkinson Hyperlegible in Settings and the Aa panel.
  To fit three choices on one row, Atkinson Hyperlegible shows as
  "Atkinson"; screen readers still hear its full name.
- **A theme, Plain**, beside Original, chosen in Settings and the Aa panel.
  Black text (`#000000`) on white, all three areas within a few shades of
  white, greys with no warmth or coolness. Links in articles are the
  browser's blue and visited purple, underlined, the only color on the page.
  By night: the colors a browser gives a plain page in dark mode, white text
  on `#121212`, links `#9E9EFF`, visited `#D0ADF0`. The automatic checks
  hold the links to 7 : 1 like the article text.
- **Plain's accent is the text color** (the unread dot, search matches), so
  blue means only "a link", and the rule "the accent is never a link"
  still holds. The selection pill, star green and destructive red are as in
  Original.
- **Not copied:** rohit.onl's text size and line spacing. The reader's own
  text size, line width and fonts apply as always.

**Bent rule.** DESIGN.md said links in articles are "never blue". In Plain
they are, because blue underlined links are the plain-HTML look the owner
asked for; Original's links stay in the text color.
