# 0304: An article's pull shows only an arrow; a list's rows no longer land

**In one line:** pulling past an article's end (or top) shows only the toolbar's ↓ (or ↑) in a thin ring, which fills in once letting go opens the next (or previous) article, with no words, title or writer; and the rows that landed on a touch screen (decision 0303, point 4) are taken out: nothing in nine turtles snaps into place.

*18 November 2026. The owner tried the live rows that land and said it doesn't feel good; and asked for the pull's "Next" and "Let go for the next", and the title under them, to become simple up and down arrows. Shown the arrows side by side with the words (real screenshots), before building.*

**The arrow.** The toolbar's own chevrons, so the pull and the button it's a shortcut for look the same. While pulling: the chevron in the second ink inside a 44px ring of the hairline. Far enough: the ring fills with the ink and the chevron turns to the paper's colour, a change of shape as well as of tone, so it never relies on colour alone. It stays `aria-hidden`: the toolbar's Next and Previous already say it in words. Where there's no next (or previous), the short words stay ("That's the last one so far."): an arrow there would promise an article that isn't.

**No snapping.** Decision 0303's point 4 and its Exceptions log row are gone, and `scripts/check-motion.mjs` now fails on any scroll snapping, in CSS or as a Tailwind class, so it doesn't come back by accident. Decision 0303's firmer pulls stay.

**Revisit if** readers don't know what the arrow means, or miss knowing which article comes next.
