# 0237: Tapping the top of an iPhone's screen scrolls up

**In one line:** Tapping the top of an iPhone's or iPad's screen scrolls the list, article or page on screen back to its top, at once, as in every app there; iOS only, phone layout only

*10 November 2026.*

Rohit's "implement all suggestions from rounds 1 and 2 except P03-8"
(10 November 2026), suggestion P03-9 of the critique through the principle
"Fit what people already do".

**Decision.**

1. **On an iPhone, tapping the top of the screen** (the clock and battery)
   scrolls what's on screen back to its top, as in every app there: an open
   sheet, or else the list, article or page (the list behind a sheet keeps
   its place). At once: nothing animates (DESIGN.md, "instant and
   still").
2. **How.** iOS scrolls only the page itself to the top, and nine turtles'
   screens scroll inside panes, so the tap did nothing. In the phone layout
   on iOS, the page has one spare pixel above the app and rests one pixel
   down, so the app still fills the screen exactly. When the page reaches its top with no finger on the screen (the
   tap), the pane on screen goes to its top and the page goes back down its
   pixel. A move made by a finger, or while the page is still coasting just
   after one, or while the reader is typing (the keyboard closing moves the
   page too), is put back without moving anything.
3. **Only iOS, only the phone layout:** an iPhone, and an iPad showing one
   screen at a time. A full-width iPad shows the three panes, where a tap
   couldn't say which to scroll; Android and computers have no such tap.

**Why.** A habit every iPhone reader's hands already have
("Fit what people already do").

**Check after deploy.** This can only be fully checked on a real iPhone;
the browser test stands in for the tap by scrolling the page to its top. If
it misbehaves, the change is one line in `Shell.svelte` and one file,
`web/src/lib/topTap.ts`, easy to take out.
