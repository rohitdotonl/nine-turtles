# 0274: Swipes on a touch screen

**In one line:** Swipe right goes back from anywhere, swipe left opens the next article, a row swipes as in Mail (right read, left star), pulls past an article's ends move through the list, a sheet closes when swiped down, and a quick flick counts

*15 November 2026. Asked for by the owner ("I want to implement swipes on mobile… going back is an important part of the app… don't make cookie-cutter suggestions… what about up and down?… is this the industry standard, not just in feed readers?"). Replaces SPEC section 20's "No custom swipes on list items".*

**Sideways: back and on, as the big apps do.** Back is the move made most,
and its button sits in the top-left corner, the hardest place for a thumb. A
swipe right from anywhere presses that same button, so it always goes where
the button says; Instagram, X, Threads and Telegram work this way. Left in an article is the next article, as in
Apple News. A list's rows keep the habit every thumb has from Mail, Gmail and
Outlook: right marks read, left stars; back from a list is its title or the
screen's edge, as in Mail.

**Up and down move through the articles.** Up and down already scroll, so
they act only where scrolling has nowhere left to go: pulled on past an
article's end, the next one; past its top, the previous one, matching the
toolbar's ↑ and ↓. Previous has no sideways swipe, since right is back.
A sheet (Aa, an opened picture) closes when swiped down, as sheets do.
Pull-to-refresh on lists was left out on purpose: it's the slot machine's
pull, against "nothing pulls", and new articles arrive by themselves.

**Pace.** The big apps slide the screen with the finger and finish with a
spring of about a third of a second. nine turtles has no animation, so it
works as a phone does with Reduce Motion on: the change is instant. What
carries over without motion: the row follows the finger (the reader moving
it), a quick flick counts however short (faster than 600px a second, at
least 20px), and a card says where letting go goes, as Android's predictive
back previews the screen behind.

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
in the corner. One rule with right as back on rows too (a row's left a
little way Read, all the way Star): tried first, then dropped for the habit
Mail and Gmail have taught. Revealed buttons under a row that stay open: a
state to close, and more to press. The screen sliding and springing as in
the big apps: it would break "no motion"; the screen following the finger,
with the screen behind showing, was offered to the owner as a later step.
