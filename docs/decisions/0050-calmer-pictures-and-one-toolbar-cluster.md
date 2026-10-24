# 0050: Calmer pictures at night, quieter captions and tables, one toolbar cluster

*24 October 2026. From the sixth Apple Books critique
(`ui-polish/critic-applebooks-6.md` in the project files, gaps 1 to 5,
rows 4 and 7 of its "Path to 10"), under the owner's goal that Apple Books
is the only standard. Changes part of decision 0038 (Open original at the
left edge) and the byline size in decision 0047.*

**Why.** Five things in the article view still looked unlike a book:

- In the night themes a pale picture glared at full brightness on the dark
  page. Apple Books dims pictures at night.
- A caption was nearly the size and ink of the text, so it read as a
  paragraph.
- A table's first column was indented from the text's left edge, under a
  heavy header line.
- On a computer, Open original sat alone at the left of the top bar while
  the other tools sat at the right, so it looked stranded.
- The byline was 13px under a 32px title, a little small beside it.

**What changed.**

- **Pictures at night** (`img` and `svg` in the article text) are dimmed to
  82% brightness in every night theme, and under "Match device" when the
  device is dark. Never inverted. A linked picture shows at full brightness
  under the pointer or the keyboard.
- **Captions** are seven-eighths of the text size, 8px under the picture,
  in the second ink. The second ink reaches 7 : 1 on the page in all twelve
  theme versions (the lowest is Quiet by night, about 7.9 : 1), so captions
  stay at AAA like the text; `contrast.test.ts` now checks this, so a future
  theme can't quietly lower it.
- **Tables** start flush with the text's left edge (no padding before the
  first column). The header is a step heavier than the text over a 1px rule
  in the text color at 30%; the rows sit over 1px rules at 12%. The rules
  are decoration, not the only sign of anything, so they need no contrast
  minimum.
- **One toolbar cluster.** On a computer, Open original joins Aa, Star and
  More at the right of the top bar, in that order, 4px apart, each still a
  44px target. The left stays empty, as in Apple Books' reading toolbar. A
  phone is unchanged (Open original alone at the right of its top bar).
- **Byline at 14px** in every pointer type (it no longer follows the 15px
  touch meta size), with the feed's name semibold in full ink and the rest
  in the second ink. The pause under the title stays as decision 0047 set
  it.

**Not done.** The critique suggested a fixed 10px between title and byline;
decision 0047's proportional pause (about 20px) is kept, since it already
scales with the text size.
