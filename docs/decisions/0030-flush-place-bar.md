# 0030: A flush "where you are" bar, and no ring on the selected article

*24 October 2026. From the outside critic's round 5 (`ui-polish/critic-round5.md`
in the project files, item M1), under the owner's "taste first" direction
(decision 0027). Refines decision 0028.*

**Why.** The selected article row had three marks at once: a fill, a short
blue pill inside the rounded fill, and (whenever the keyboard was on it,
which is most of the time with j and k) a thin outline round the whole row.
Together they read as a bordered card, the usual sign of a template, and the
outline was the strongest line in the dark list. The sidebar's selection
looked a little different again.

**What changed.**

- The ink blue bar now sits flush against the pane's own left edge, outside
  the row's fill, rounded only on its inner side. The sidebar and the list
  use the same shape; the fill's corners are 6px.
- When the keyboard is on the selected article, there is no outline. The
  bar grows to the row's full height instead. That is a change of shape, so
  it shows without color, and it disappears when the keyboard moves on (to
  the article, say), which is how you tell the two apart.
- Every other row, and every other control, keeps the usual 2px focus
  outline. In high-contrast mode the selected article still draws a 3px
  outline, since the system's colors replace the bar's.

**Decided by** the agent, under the owner's standing approval to override
the documents where taste calls for it.
