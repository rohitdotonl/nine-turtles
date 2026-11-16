# 0279: An article's pull follows the finger, with the next one hung beyond

**In one line:** A pull past an article's end or top moves the article with the finger, the next (or previous) one hanging just beyond it with its title and writer; far enough or a quick flick says "Let go", and letting go carries straight on into it

*16 November 2026. The owner, after 0276 went live: the pulls up and down didn't feel as good as the swipes sideways. Chosen on a decision card: "Bold: next article peeks up". Refines 0276.*

**Why the pulls felt worse.** Sideways, the screen follows the finger and
the one it goes to shows beneath it; a pull moved nothing, a card appeared
only at the point letting go counted, the old article vanished and the new
one slid in from off the screen, and a flick didn't count.

**What changed.** The article now follows the finger past its end (or
top), as a screen does sideways. The article a pull opens hangs just beyond
it on the same paper, past a hairline, and comes into view with it: "Next"
(or "Previous"), its title and who wrote it, nearest the edge that shows
first. Far enough, the first line says "Let go for the next" (words, never
color alone). Letting go carries the article on a whole screen, so the one
hung beyond fills it, and opens; short of that, it slides back. A quick
flick (the same as sideways: at least 20px, faster than 600px a second)
counts, measured as the finger lifts (held still first, it isn't one). A
stroke that goes sideways first is back's, never a pull, and while pulled,
the text stays still, so the article follows the finger back as well as
on. The phone's own stretch at an article's ends is off
(`overscroll-behavior-y: none` on the article's text), since the article
itself moves there now.

**Motion.** The same glide as 0274's Exceptions log entry, 320ms, easing to
rest, only finishing a stroke the finger started, and none with the phone
set to reduce motion (it lands at once). While the finger is down,
everything follows it exactly, as sideways. Only `swipeMotion.ts` moves
anything (`pull` and `letGo`, which replace `slideIn`).
