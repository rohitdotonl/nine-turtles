# 0247: Footnotes where you are, and proper punctuation

**In one line:** Footnotes where you are, and proper punctuation: a footnote's number opens its note in a small card just under the line (Escape, × or a press elsewhere closes it; the notes stay at the end); an English article's straight quotes, double hyphens and three dots are shown as curly quotes, dashes and ellipses, never inside code, with the stored text unchanged and highlights found either way

*10 November 2026.*

Rohit's "go" (10 November 2026) on the fresh typography critique
(`critique-24/typography-2.html`, in the project's files), ideas 6 and 7,
built after the look (decision 0246) in a change of their own because they
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
     (`server/src/feed/clean.rs`), so a footnote is a link to another
     place in the same article that is a superscript, holds one, or is only
     a short number or mark ("1", "[2]", "*"). Its note is the place it
     points to, or, when that is only a word or the note's own number (as
     Substack and many hand-written notes do), the paragraph or item
     around it. That covers the usual Markdown, WordPress and Substack
     shapes without a list of publishers. The card is a copy of the note,
     set as the article's text is, without its way back (a link of only ↩,
     ↑ or "back", or any link back to the number pressed) or the number it
     starts with. It opens in view, and closes when the column's width
     changes or another article opens, as it would sit over the wrong line.
     Its closing on a press elsewhere or Escape is shared with the
     highlight menu (`web/src/lib/dismiss.ts`).
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
     (`web/src/lib/highlights.ts`). A highlight keeps the words as they were
     shown, so one made from now on holds the curly marks.
   - *Each line starts afresh.* A quote mark at the start of a paragraph,
     item, cell or line opens, whatever ended the line before.
   - *Left as they are, for now.* A range like "2--3" becomes an em dash
     where a typesetter would use an en dash; "rock 'n' roll" opens its
     first mark; and an HTML comment written in a post's prose (not in
     code) has its two hyphens set as a dash. All are rare in feeds.

**Why.** Principle 9's last steps nearer a well-set book: a note read
without losing your place, and the marks a typesetter would set. Both are
"the writer comes first": the words are theirs, only the setting changes.

**Where.** `web/src/lib/footnotes.ts`, `FootnoteCard.svelte` and
`punctuation.ts`, used by `ArticleView.svelte`; SPEC section 7.
