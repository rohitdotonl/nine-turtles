# 0288: One column width in every font

**In one line:** The reading column is 32.5em wide (about 70 letters in Literata, 75 in Atkinson) instead of 57ch, so changing the reading font no longer moves the column; refines decision 0187.

*16 November 2026. The owner noticed that switching the reading font from Literata to Atkinson made the column much wider, and asked to see it steady.*

**Context.** Decision 0187 set one line width for everyone, written as 57ch.
A "ch" is the width of the font's zero, so the column was measured in a
different ruler for each font. Atkinson Hyperlegible Next has a wide zero
(0.65em against Literata's 0.58em) but narrower letters on average (0.43em
against 0.47em). So in Atkinson the column grew an eighth wider and held
about 85 letters a line, past the 45 to 75 that reads best and past WCAG
1.4.8's 80.

**Decision.** The column is measured in the text's size (em), not in its
zero: 32.5em for every font. Literata gets about 70 letters a line (71
before), Atkinson about 75 (85 before). Switching fonts in the Aa panel
leaves the column, the list beside it and the article's bar where they are.
A larger text size still makes lines shorter by itself; a phone's column is
still the screen's width.

**Why.** Cohesive and instant and still: the reader changes the letters, not
the page. One width rather than one per font, because a font switch that
moves the column (even by a little) reads as the page jumping, and both
fonts land inside the guidance at one width.
