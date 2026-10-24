# 0035: One family for sheets, search results that show why, and a welcome in the reading area

*24 October 2026. From the Apple Books critique (`ui-polish/critic-applebooks-1.md`
in the project files, sections 8, 13 and 14) and round 6 (majors 6 and 7).
The owner set Apple Books as the one reference and approved changing
DESIGN.md for this work.*

**Why.** The three sheets didn't look like one family. On Add a feed, "Add
feed" sat beside the field while Cancel sat alone 75px lower, so the two
actions looked unrelated. Unsubscribe and Delete looked exactly like the safe
buttons above them. Search results gave no clue why most of them matched: a
word found only in an article's text left its row looking like any other, and
the field had no way to empty it but selecting the text. On a first visit the
whole welcome was squeezed into the narrow list, while the wide reading area
said "No article open. Choose one from the list, or press j", which wasn't
true: there was nothing to choose.

**What changed.**

- **Sheets are one family**, like a Mac sheet in Apple Books: a title in the
  interface font at 20px semibold, the form at full width, then **one row of
  actions at the foot: Cancel, then the main action at the right end**. On Add
  a feed the field takes the card's full width and "Add feed" moved into that
  row. Its messages appear in a space kept for two lines, so nothing jumps.
  A destructive action sits apart below a hairline, after the line saying what
  it does, as **words in a muted red** (`#A3261B` light, `#E8968A` dark; AA on
  every theme's page and list, checked by `contrast.test.ts`). The phone's
  pages for the same tasks are built the same way.
- **Sheet title in sans, not serif.** Apple Books titles its sheets in the
  system font (17pt semibold on iPad, the window's bold title on Mac) and keeps
  its book serif for reading. In slowfeed the serif already names *places*
  (the list's title, Settings); giving *tasks* the interface font makes the
  difference readable at a glance. 20px (the type scale's "large") keeps the
  title clearly above the 16px form without competing with the list behind.
- **One shadow for everything that floats.** A sheet, the search options and
  the shortcut list share a `.floating` style: 12px corners, a faint edge and
  one soft shadow. Sheets are 32rem wide with 24px padding.
- **Search results show why they matched.** Under each result whose text holds
  a searched word, one muted line shows that text around the first match: a
  few words before it (at most about 24 characters, so the word shows even in
  a narrow list), on to about 90 characters, cut between words, with "…" where
  text was left out. The searched words are semibold and in full ink: weight
  and tone together, never color alone.
- **A × clears the search field** once it has words in it ("Clear search", a
  44px target). It keeps the chips and leaves the keyboard in the field.
- **The welcome moved to the reading area**, centred: "A quiet place to read."
  in the reading serif, one sentence, a wide field with Add feed beside it, and
  "or import an OPML file" as a quiet link. The list says only "Nothing here
  yet." On a phone, where there's no reading area beside the list, the welcome
  takes the list's place.
- **"No article open."** is now a 20px serif line with a muted hint under it.
  The hint ("Choose one from the list, or press j") shows only when the list has
  something to open; its line is kept either way, so nothing moves.

**How the excerpt is made, and why not FTS5's `snippet()`.** The search index
is "contentless" (decision 0023): it keeps where each word appears, not a copy
of the text, so it stays small on the 1 GB disk. FTS5's `snippet()` needs the
text itself and returns nothing on such an index (checked). Storing a second
copy of every article to make `snippet()` work would roughly double the
index's size for one line per result. Instead, the server cuts the excerpt
from the article's stored text for just the 50 results on the page: tags
removed (the same `plain_words` the index uses), words split and compared the
way the index does (small letters, Latin accents set aside, Hindi vowel signs
kept inside their words). It goes to the screen as a list of pieces, each
plain text marked as a searched word or not, so there's no marker inside the
text and no HTML from a feed to escape; Svelte shows each piece as text and the
marked ones in `<strong>`, without `{@html}`.

**Considered and kept.** The critic suggested a large outline glyph above the
empty states, as Apple Books has. slowfeed has no illustration set and the
serif line already reads as a blank page; left out. Their "Search results ·
16" in the list's title, a compact 36px search field on mouse screens, and
hiding the sidebar's find field below eight feeds belong to other batches.

**Decided by** the agent, under the owner's direction to match Apple Books and
their approval to change DESIGN.md. No floor changed: the red passes AA and
always comes with words, every new control is a 44px target with the usual
focus outline, and the excerpt is plain text.
