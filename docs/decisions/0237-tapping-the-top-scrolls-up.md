# 0237: Tapping the top of an iPhone's screen scrolls up

*10 November 2026.*

Rohit's "implement all suggestions from rounds 1 and 2 except P03-8"
(10 November 2026), suggestion P03-9 of the critique through the principle
"Fit what people already do".

**Decision.**

1. **On an iPhone or iPad, tapping the top of the screen** (the clock and
   battery) scrolls the list, article or page on screen back to its top, as
   in every app there. At once: nothing animates (DESIGN.md, "instant and
   still").
2. **How.** iOS scrolls only the page itself to the top, and nine turtles'
   screens scroll inside panes, so the tap did nothing. In the phone layout
   on iOS, the page is one pixel taller than the screen and rests one pixel
   down. When the page reaches its top with no finger on the screen (the
   tap), the pane on screen goes to its top and the page goes back down its
   pixel. A move made by a finger, or while the page is still coasting just
   after one, is put back without moving the pane.
3. **Only iOS, only the phone layout.** Android and computers have no such
   tap, so nothing changes there.

**Why.** A habit every iPhone reader's hands already have
("Fit what people already do").

**Check after deploy.** This can only be fully checked on a real iPhone;
the browser test stands in for the tap by scrolling the page to its top. If
it misbehaves, the change is one line in `Shell.svelte` and one file,
`web/src/lib/topTap.ts`, easy to take out.
