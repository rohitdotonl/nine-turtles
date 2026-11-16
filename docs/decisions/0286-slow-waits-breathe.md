# 0286: A slow wait keeps saying so, its dots breathing

**In one line:** A wait on someone else's site, YouTube or a publisher's audio says what it's doing after half a second, "Still looking… Some sites are slow to answer." after 5, and "It can take up to a minute." after 15 (with Stop where stopping changes nothing); the three dots of its "…" brighten in turn, slowly, and are still with reduced motion: the second exception to "no motion".

*16 November 2026. The owner asked whether "Looking on the site…" in Find new address should show a loading icon, saw the waits side by side (words only, words that move on, the same with breathing dots, and a spinner) and chose words that move on with breathing dots.*

**Why.** Most waits are on nine turtles' own server and end within a second;
they stay as decision 0230 made them, a word after half a second. These can
take 20 seconds to a minute, because they wait on someone else's site:
Find new address, Add and "Follow this person?", + Add a source, Write
back's and Ask them for a feed's look on their site, a video starting and
a podcast loading. Their
line never changed, so it looked stuck (principle 5, honest by default:
nothing said how long, and nothing let the reader stop waiting). A spinner
says only "busy", pulls the eye and says nothing to a screen reader.

**Decision.**
1. **One piece, `SlowWait.svelte`,** for those waits only. Nothing for half
   a second (`SAY_AFTER_MS`), then the words ("Looking on their site…",
   "Looking…", "Starting the video…", "Loading from the publisher…"); after 5
   seconds (`STILL_AFTER_MS`) "Still looking… Some sites are slow to
   answer." ("Still starting… YouTube can be slow to answer." for a video,
   "Still loading… Some sites are slow to answer." for a podcast); after 15 (`LONG_AFTER_MS`), for a look on
   someone's site, "Still looking… It can take up to a minute." (every such
   look ends within a minute).
2. **Stop,** a `TextButton` beside that last line, only where stopping
   changes nothing: Find new address. Its answer is then let go, and the
   keyboard goes back to Find new address. Add and + Add a source get no
   Stop, since their answer follows someone; Write back's box doesn't need
   one, since the field takes an address while it looks.
3. **The dots breathe** (`breathe.ts`): each of the three brightens from a
   quarter of the ink to full and back, a third of a 1.8-second breath after
   the one before, for as long as the line shows. Nothing else moves. With
   reduced motion they're a still "…". They're drawn, not written, so the
   line's words read "Looking…" to screen readers and tests, and each
   change of line is heard once.
4. **The no-motion rule gains its second exception** (DESIGN.md → Exceptions
   log): `scripts/check-motion.mjs` allows motion in `swipeMotion.ts` and
   `breathe.ts` only, and fails if either forgets reduced motion.
5. **Small fixes on the way:** Find new address says "Looking on their
   site…" as Write back does (it said "the site"), and only after half a
   second, like every other wait; + Add a source says "Looking…" and then
   "Joining…" where it said "Working…"; Add keeps "Following… 3 of 3 done"
   while the ticked feeds are joined into one, rather than a slow wait's
   "Looking…" for nine turtles' own work.
