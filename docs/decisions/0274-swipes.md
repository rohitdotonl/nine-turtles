# 0274: Swipes on a touch screen

**In one line:** Swipe right goes back from anywhere, swipe left goes on (next article, or a row's Read and Star), pulls past an article's ends move through the list, a sheet closes when swiped down, a quick flick counts, and letting go finishes with a short glide (the one motion in nine turtles)

> **Partly replaced by [0276](0276-article-pulls-only.md):** in an article, a swipe left no longer opens the next one; next and previous are pulls only, each sliding in the way it was pulled.

*15 November 2026. Asked for by the owner ("I want to implement swipes on mobile… going back is an important part of the app… don't make cookie-cutter suggestions… what about up and down?"), who chose "Keep one rule: right is back" over rows as in Mail, and then, having tried both side by side, the slide-and-spring version over the instant one ("Implement swipes with motion"), knowing it breaks "no animations or transitions, ever". Replaces SPEC section 20's "No custom swipes on list items".*

**One rule for the sideways ones.** Right is back, left is on, on every
screen, so there's one thing to learn. Back is the move made most, and its
button sits in the top-left corner, the hardest place for a thumb; a swipe
right from anywhere presses that same button, so it always goes where the
button says. Left in an article is the next article; left on a row is what
its menu does to it (a little way Read, all the way Star), since right is
already taken by back.

**Up and down move through the articles.** Up and down already scroll, so
they act only where scrolling has nowhere left to go: pulled on past an
article's end, the next one; past its top, the previous one, matching the
toolbar's ↑ and ↓. Previous has no sideways swipe, since right is back.
A sheet (Aa, an opened picture) closes when swiped down, as sheets do.
Pull-to-refresh on lists was left out on purpose: it's the slot machine's
pull, against "nothing pulls", and new articles arrive by themselves.

**Rows: one rule, not Mail's habit.** Mail, Gmail and Outlook use a row's
swipe right for Read. The owner weighed that against one rule and chose one
rule: right is back everywhere, rows too, so a row's marks are both on the
left (a little way Read, all the way Star).

**Pace, and the one motion.** The big apps slide the screen with the finger
and finish with a glide of about a third of a second. The owner tried an
instant version and this one side by side and chose the glide: a swipe is
the reader throwing the screen, and a screen that vanishes the moment the
finger lifts feels like it was dropped. So while the finger is down the
screen follows it exactly, over the screen it goes back to (held back a
little and dimmed, as if beneath); once it lifts, it finishes in 320ms,
fast first and easing to rest: off the rest of the way (and a new article
slides in from its side), or back into place. A quick flick counts however
short (faster than 600px a second, at least 20px). This is the only motion
in nine turtles, and it's written in DESIGN.md's Exceptions log with its
limits: only to finish a stroke the reader's finger started, never by
itself; no bounce or overshoot; none at all with the phone set to reduce
motion; and only in `web/src/lib/swipeMotion.ts`, the one file
`scripts/check-motion.mjs` lets move.

**Within the floors.** Every swipe is a shortcut for a button that stays
(DESIGN.md's checklist: gestures only as shortcuts). A phone set to reduce
motion gets no glide: everything lands at once. Before letting go, the
reader sees where it goes (the screen under the one they drag, or a quiet
card naming it) or what it does (the icon and word under a row), never by
color alone. The phone's own edge
gestures stay the phone's: in a browser the left edge is its back, and only
an app installed on the home screen, which iOS gives no back gesture, takes
a stroke from the left edge too.

**How it's built.** One small helper (`web/src/lib/swipe.ts`) follows a
finger with pointer events, leaves up-and-down to the browser
(`touch-action: pan-y pinch-zoom` on the scrolling areas, so zooming stays
the reader's), and lets the place nearest the finger take a stroke first, so
a row's swipe left and the screen's swipe right never both act. Zoomed in
with two fingers (`visualViewport.scale` over 1), no swipe or pull starts
and sideways panning is the browser's again, so a reader who zooms can still
move about the page (the first floor). Back by swipe works only where one
screen fills the window, for a stroke on that screen. A back
button names the pane it goes back to (`data-behind`), so the swipe can show
it under the screen; the glide itself is `swipeMotion.ts`. The pulls
past an article's ends use touch events, which keep coming while the phone
scrolls and stretches.

**Weighed.** Left for next and right for previous in an article (the usual
reader app), with back only from the edge: it leaves back where it is today,
in the corner, and makes right mean three things on three screens. A row's
swipe right for Read: right is back. Revealed buttons under a row that stay
open: a state to close, and more to press.
