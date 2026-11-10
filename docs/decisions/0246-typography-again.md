# 0246: Typography, again

**In one line:** Typography, again: an article's headings in three clear steps (26, 22px, then the text's size), real bold italics, a plain zero in the interface's dates, two weights (Settings' rows regular, replacing 0120's medium), titles in Literata's display cut with the article's title in regular weight at 38px, every part of a post set (highlighting, keys, definitions, number tables, footnotes), line spacing that eases as the text grows, and stand-in fonts so nothing moves while the fonts arrive

*10 November 2026.*

Rohit's "go" (10 November 2026) on the fresh typography critique
(`critique-24/typography-2.html`, in the project's files), ideas 1–5 and
9–12; 6 and 7 (footnotes in place, proper punctuation) follow in their own
change. He turned down 8 (a Spacing choice in Aa): the app should choose the
best spacing for everyone, and a bigger text size already brings more room.
Principle 9 asks that type carry the interface. The reading was already
good (20px text, 18 : 1 contrast, about 53 letters a line on a laptop); what
was left was inside the article, and a few steps nearer a well-set book.

**Decision.**

1. **Headings in three clear steps.** An article's headings were 22, 21 and
   20px beside 20px text. Now 1.3 times the text (26px), 1.1 times (22px),
   then the text's own size, all semibold. The title stays the largest.
2. **Real bold italic.** Literata's and Atkinson's semibold italics are
   shipped (from Fontsource, as the others, decision 0141), so a writer's
   bold inside italics is drawn, not faked by slanting the upright.
3. **A plain zero in dates** (Dieter Rams' critique, Rohit's to-do). Every
   `<time>` in the interface uses `--font-dates`: a one-letter font holding
   Atkinson's zero with its slash taken out (its inner counter redrawn as
   the outer shape, scaled into the slashed halves' box), in front of
   Atkinson. Addresses, codes and the article's own text keep the crossed
   zero, where it tells 0 from O. A date written inside a sentence ("kept
   until 10 Dec", "Nothing new has arrived since 10:05.") is text, not a
   `<time>`, so its date alone is found and marked `.dated`
   (`web/src/lib/dated.ts`, `Dated.svelte`) and takes the same face
   (Rohit, 10 November: every date, in a small change of its own). The
   words around it keep Atkinson's own zero, as they may hold an address,
   a title or a code. The licence (SIL OFL 1.1, no reserved
   name) allows a changed copy under its own name.
4. **Two weights.** Settings' row names lose their medium weight (decision
   0120) and are regular, as the sidebar's rows; the 500 files go.
5. **Literata's display cut for titles.** Every title of 24px and more uses
   `--font-display`: Literata at its 36pt optical size, made from Google's
   variable Literata (Fontsource's `literata-latin-opsz-normal`) at weights
   400 and 600, basic Latin only. The article's title is regular weight at
   1.9 times the text (38px by default), whatever the reading font, as a
   book sets a chapter's title (Rohit's pick of the bold option). Its face
   comes from `--reading-title-font`, set with the reading font
   (`web/src/lib/preferences.ts`): the display cut with Literata, while
   Atkinson and System serif keep their own face for the title.
6. **Every part of a post** (`web/src/article-text.css`, split from app.css):
   a writer's `mark` in a soft tone of the ink, never yellow or the accent;
   `kbd` as key caps; `dt` semibold over an indented `dd`; tables in
   digits of one width; footnotes known by their shape (the cleaning keeps
   no class names): their numbers padded, and underlined as every article link is, their list a
   step smaller in the second ink, their ↩ drawn as text
   (`font-variant-emoji`); on Apple's browsers, a paragraph's opening
   quote mark hangs outside the column (`hanging-punctuation`).
7. **Line spacing follows the size**: 1.6, 1.58, 1.55, 1.52, 1.5 and 1.5
   for the six text sizes (`--reading-leading`), a twentieth less on a
   phone as before but never under 1.5 (WCAG 1.4.8's line spacing, AAA as
   article text aims for). The usual size is unchanged.
8. **Nothing moves while the fonts arrive.** Each face is followed by
   stand-ins, the device's Georgia or Noto Serif for Literata and Arial or
   Roboto for Atkinson, resized with `size-adjust` and the ascent, descent
   and line-gap overrides to take the same room: size-adjust is our average
   letter width over theirs, the others ours divided by it (the figures are
   Capsize's published metrics). They carry only the Latin our own fonts
   do (`unicode-range`), so any other script keeps the device's own font.

**Not done, and why.** Numbers in a table aren't moved to the right: which
column holds numbers can't be told without reading it. The display cut has
no extended-Latin piece (a title's rare letter uses the text cut), which
keeps the fonts at about 297 of their 400 KB.

**How the two fonts of our own were made** (fontTools, run once by hand):

```python
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
# Literata's display cut: the variable Literata at optical size 36.
t = TTFont("literata-latin-opsz-normal.woff2")
cut = instancer.instantiateVariableFont(t, {"opsz": 36, "wght": 600})  # and 400
# then renamed "Literata Display" in its name table and saved as woff2.
# The plain zero: from atkinson-hyperlegible-next-400-latin.woff2 (and 600),
# glyph "zero": keep its outer contour, replace the two inner halves with
# the outer contour scaled into their bounding box and reversed; subset to
# U+0030 only; rename "Atkinson Hyperlegible Next Plain Zero".
```
