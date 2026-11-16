# 0276: In an article, pulls only: up for the next, down for the previous

**In one line:** An article's next and previous are pulls past its end and top, each sliding in the way it was pulled, its card naming who wrote it; a swipe left in an article does nothing, and the browser's own pull to refresh is off

*16 November 2026. The owner, trying swipes on Android after decision 0274 went live: there was no working way to the previous article (a pull down at the top refreshed the page), two ways to the next (swipe left and pull up), and a pull up slid the next article in from the side, as if swiped. Chosen on a decision card: "Pulls only (up next, down back)". Partly replaces 0274.*

> **Refined by [0280](0280-pulls-follow-the-finger.md):** the article now follows the finger, the next one hangs just beyond it, and letting go carries on into it instead of it sliding in.

**Each way means one thing.** Sideways is for going back (right) and a
row's marks (left); up and down move through the articles. A swipe left in
an article no longer opens the next one, so next and previous are a pair,
on one axis, matching the toolbar's ↓ and ↑.

**It comes in the way it was pulled.** Pulled up past the end, the next
article rises from below; pulled down past the top, the previous one comes
down from above. The glide is the one 0274 put in the Exceptions log, and,
as there, none with the phone set to reduce motion.

**No pull to refresh.** Chrome on Android refreshed the page on a pull
down at the top, before nine turtles could take it. `overscroll-behavior-y`
is `none` on the page and `contain` on each scrolling area, which turns
that off. Nothing is lost: new articles come in by themselves, and 0274
already left pull to refresh out ("nothing pulls").

**The card names who wrote it.** Under the next or previous article's
title, the writer, or the feed's name when the feed names none, as the
article's row names them (the owner's suggestion: "the writer comes
first").

**A pull counts only on its own side of where the finger started**, so a
short article, at both its ends at once, never takes a pull up and back for
a pull down.
