# 0143: The star in the ink; oxblood for delete and errors

*2 November 2026. The owner chose this from the color mockups (brand sheet,
step 2). Replaces the green star of 0057 and the muted red of DESIGN.md
before it.*

**Decision.**

- **The star has no color of its own.** It is drawn in the theme's ink:
  filled when starred, an outline when not. The green retires, and with it
  the `--star` color in every theme.
- **Delete and errors are oxblood:** `#8C2F39` by day and `#E39AA4` by night
  (the `--danger` color), always with words that say what.

**Why.** Fewer colors (the brand's "no more colors"): each theme now has its
ink, its greys, one accent and oxblood. The filled shape already says
"starred", so the color added nothing but noise, and green and red are the
colors most often confused. Oxblood is a deeper, calmer red than the one it
replaces, still clearly "this removes something".

**Checked.** Oxblood meets AA (4.5 : 1) on every theme's page, list, grouped
list and raised surface, day and night, and the star meets everything the
ink does; `contrast.test.ts` checks both, and that no theme names a star
color.
