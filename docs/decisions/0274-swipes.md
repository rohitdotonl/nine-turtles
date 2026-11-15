# 0274: Swipes on a touch screen

**In one line:** Swipe right goes back from anywhere, swipe left goes on (next article, or a row's Read and Star), pulls past an article's ends move through the list, and a sheet closes when swiped down

*15 November 2026. Asked for by the owner ("I want to implement swipes on mobile… going back is an important part of the app… don't make cookie-cutter suggestions… what about up and down?"). Replaces SPEC section 20's "No custom swipes on list items".*

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

**Within the floors.** Every swipe is a shortcut for a button that stays
(DESIGN.md's checklist: gestures only as shortcuts). Nothing slides: a row
follows the finger, which is the reader moving it, and is back at once when
it lifts. Before letting go, a quiet card says where it goes or what it does
(the icon and word under a row), never color alone. The phone's own edge
gestures stay the phone's: in a browser the left edge is its back, and only
an app installed on the home screen, which iOS gives no back gesture, takes
a stroke from the left edge too.

**How it's built.** One small helper (`web/src/lib/swipe.ts`) follows a
finger with pointer events, leaves up-and-down to the browser
(`touch-action: pan-y pinch-zoom` on the scrolling areas, so zooming stays
the reader's), and lets the place nearest the finger take a stroke first, so
a row's swipe left and the screen's swipe right never both act. The pulls
past an article's ends use touch events, which keep coming while the phone
scrolls and stretches.

**Weighed.** Left for next and right for previous in an article (the usual
reader app), with back only from the edge: it leaves back where it is today,
in the corner, and makes right mean three things on three screens. A row's
swipe right for Read: right is back. Revealed buttons under a row that stay
open: a state to close, and more to press.
