# 0226: Settings' Page choices show the paper

**In one line:** Settings' Page choices show the paper: a small square of each page with an "A" in its words' color above its name, in the usual segmented control (from the owner's Kenya Hara critique, version A)

*9 November 2026.*

Rohit's pick ("Implement A") from the Kenya Hara critique's suggestion 4,
in the box-style version he asked for on 9 November 2026: boxes that match
the rest of Settings rather than round swatches, keeping today's grey cards.

**What changed.** In Settings, Page's four choices stay the segmented
control that Sort order and Font use (the same track, the same raised
chosen tile). Each choice is now a column: a 28px square of that page,
with 5px corners, a faint edge (the text color at 25%) so White shows on
white, and an "A" in Literata 600 in that page's own words' color; its name
under it. Match device is half White, half Night, with no letter.

**How.** The square is a picture only: `aria-hidden`, and its "A" is drawn
by CSS (`::before`), so each choice's name stays its word alone ("Paper",
never "A Paper") for screen readers and for tests. The colors come from
`LOOKS` in `themes.ts`, which now holds each page's words' color as well as
its page color; `contrast.test.ts` checks both against `themes.css`. The
swatch drawing (`swatch()`) moved from the Aa panel into `themes.ts` so
the Aa panel and Settings share one copy. In forced colors the square gets
an outline in the system's text color.

**Why.** You choose a paper by seeing it, not only by reading its name
(principle 3), and the same choice now shows its paper in both places that
offer it, Settings and the Aa panel (principle 6). The Aa panel keeps its
round swatches for now; one look for each kind of choice in both places is
a later question.
