# 0247: Footnotes where you are, and proper punctuation

*10 November 2026.*

Rohit's "go" (10 November 2026) on the fresh typography critique
(`critique-24/typography-2.html`, in the project's files), ideas 6 and 7,
built after the look (decision 0245) in a change of their own because they
are behaviours, not styles.

**Decision.**

1. **A footnote opens where you are.** Pressing a footnote's number used to
   jump to the end of the article, and the reader had to find their way back.
   Now its note shows in a small card just under the line: the column's
   width, a step smaller than the text, the number on its left and × on its
   right, in the family of things that float (12px corners, faint edge, the
   one shadow). It is a dialog named "Footnote 2"; the keyboard goes into
   it, and Escape or × closes it and gives the keyboard back to the number;
   a press elsewhere or Tab past it closes it too. Nothing moves or fades.
   The notes stay at the end, and a note's own way back still jumps.
   - *Found by shape.* The cleaning keeps no class names
     (`server/src/feed/clean.rs`), so a footnote is a link inside a
     superscript to another place in the same article. That covers the
     usual Markdown, WordPress and Substack footnotes without a list of
     publishers. The card is a copy of the note, without its way back (a
     link of only ↩, ↑ or "back") or the number it starts with.
2. **Proper punctuation, on screen.** When an English article is shown
   (its feed names English or no language), straight quotes are curled to
   face the right way, an apostrophe curls, two hyphens become an em dash
   and three dots an ellipsis. Three or more hyphens and four or more dots
   are left alone, as are code, keys and preformatted text. Other languages
   keep their marks, since their quotes are their own.
   - *Only what's shown.* Changing the stored article would make every
     re-cleaned article look edited, and would break the highlights already
     made. So the stored text, search and what an assistant reads keep the
     writer's characters, and highlights compare punctuation folded (a curly
     quote as a straight one, a dash as two hyphens, an ellipsis as three
     dots), so a highlight kept either way is found either way
     (`web/src/lib/highlights.ts`).

**Why.** Principle 9's last steps nearer a well-set book: a note read
without losing your place, and the marks a typesetter would set. Both are
"the writer comes first": the words are theirs, only the setting changes.

**Where.** `web/src/lib/footnotes.ts`, `FootnoteCard.svelte` and
`punctuation.ts`, used by `ArticleView.svelte`; SPEC section 7.
