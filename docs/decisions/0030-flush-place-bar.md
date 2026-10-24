# 0030: A flush "where you are" bar, and one focus outline for every row

*24 October 2026. From the outside critic's round 5 (`ui-polish/critic-round5.md`
in the project files, item M1), under the owner's "taste first" direction
(decision 0027). Refines decision 0028.*

**Why.** The selected article row had three marks at once: a fill, a short
blue pill inside the rounded fill, and (whenever the keyboard was on it,
which is most of the time with j and k) a thin grey hairline round the whole
row. Together they read as a bordered card with a stripe inside it, the
usual sign of a template, and the hairline was the strongest line in the
dark list. The sidebar's selection looked a little different again.

**What changed.**

- The ink blue bar now sits flush against the pane's own left edge, outside
  the row's fill, rounded only on its inner side. The sidebar and the list
  use the same shape; the fill's corners are 6px.
- The selected article's special grey hairline is gone. When the keyboard is
  on it, it gets the same 2px outline in the text color as every other row
  and control, inside the fill, so the bar is never inside a ring.

**Considered and dropped.** Showing the keyboard on the selected article only
by growing the blue bar. It looked calmer, but it would have used ink blue
for focus and dropped the focus outline, which DESIGN.md's floors and its
"ink blue means where you are and nothing else" rule don't allow.

**Decided by** the agent, under the owner's standing approval to override
the documents where taste calls for it. No floor changed.
