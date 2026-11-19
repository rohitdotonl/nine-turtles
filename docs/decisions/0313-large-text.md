# 0313: Every screen is laid out for large text

**In one line:** After the accessibility check of 19 November 2026, nine turtles marks the page `data-text="large"` from one and a half times the usual text size and lays every screen out for it (rows stack, words wrap in buttons and choices, titles grow less than their words, icons grow with their words), so at an iPhone's largest text nothing runs off a phone's edge; a test opens every phone screen at twice the text size to keep it so; and the report's smaller fixes go in with it.

*19 November 2026. From the accessibility report (keyboard, focus, screen readers, contrast, text size and zoom, touch targets, reduced motion). The owner asked for every fix as suggested ("Fix everything as per your suggestion").*

**What changes.**
1. **Large text.** At an iPhone's largest sizes (decision 0252 grows the app up to twice its size) Choose, Settings › Page and the article's bar pushed things past the screen's edge, and titles split mid-word ("pleasur / e"). `systemText.ts` now marks the page `data-text="large"` whenever the page's text is one and a half times the usual or more, on any device, and `large-text.css` lays screens out for it; the rules are in DESIGN.md Part 2 → "Large text". Rules that change nothing at the usual sizes are always on instead: a switch's row keeps its words at least 9rem wide, three pages' columns may shrink (`min-w-0`), the article bar's places are 44px (not 2.75rem, which became 88px), and an article's title is never more than 14%, 12% or 10% of the window's width, and its headings never more than 9% (8% for the second level), so a heading never outweighs the title (decision 0038).
2. **The test.** `web/tests/large-text.spec.ts` opens every phone screen at twice the text size, at an iPhone's 375px width, and fails if anything goes past the right edge, apart from an article's code and tables, which scroll sideways on purpose, and words cut with "…".
3. **The keyboard leaves Text and page closed.** Tab past its last choice went out of the page and back in under the panel; it now closes wherever the keyboard lands outside it (WCAG 2.4.11).
4. **Choose at 400% zoom.** In a window under 30rem tall and under 40rem wide, Everyone you follow's Choose bar no longer sticks to the foot of the screen but sits at the list's end, so it never covers the rows (WCAG 1.4.10). A phone on its side is wider than that and keeps the bar in view, so a long list never has to be scrolled to its end to reach Move to….
5. **Taps.** On a touch screen a footnote's number and its way back (↩) have an unseen 44px area to press; the field for a new assistant key is a 44px row.
6. **On a computer with large text** the sidebar's usual width is 16rem (256px at the usual size) and its drag limits follow the text size; icons grow with the words beside them.
7. **Screen readers.** On a computer the list and article are the page's `main` and the sidebar sits beside it (on a phone, one screen at a time, the whole screen still is); the titles of One person? and a not-working box are headings.
8. **The website.** Inline code breaks where it must, so For publishers and Help › Newsletters never scroll sideways at 320px.

**Considered and not taken.** Making every icon button grow with the text: on a phone it pushed list titles to a word a line, and a phone's own bars keep theirs the same. Shrinking titles to fit with no floor: at 8% of the width they were barely larger than the words under them.

**Revisit if** a reader at large text finds a screen that still overflows (add it to `tests/screens.ts` and the test covers it), or the 1.5 threshold switches the layout on for someone who reads comfortably without it.
