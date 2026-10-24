# 0044: Quiet endings and blank paper in the reading pane

*24 October 2026. From the fourth Apple Books critique
(`ui-polish/critic-applebooks-4.md` in the project files, items 7, 8, 9 and
10, batches 4 and 6 of its "Path to 10"), under the owner's goal that Apple
Books is the only standard. Replaces two parts of decision 0040: titles
"filling the measure" and the visible "No article open." line.*

**Why.** Four small things in the reading pane still looked unlike a book:

- The summary-only note's link, "Read the full article on {publisher}",
  broke across two lines with a long publisher's name, leaving a lone word
  and an underline split in two.
- Titles used the rule "avoid only a lone last word" (decision 0040). In
  practice that gave a long line over a short stub ("Apple's new reading
  mode is / quietly excellent").
- At a 1280px window, the text came within 40px of the pane's edge. Apple
  Books on a Mac never brings body text closer than about 56px.
- The empty reading pane said "No article open." Apple Books shows blank
  paper.

**What changed.**

- **The note's link is short and never breaks.** The publisher is already
  named in full ink in the byline under the title, so the link now reads
  "Read the full article ›". Screen readers still hear "Read the full
  article on {publisher}", so the credit is never lost. Each of the note's
  two sentences stays whole on a line wherever it fits, so a narrow column
  breaks between them and never strands a word; a sentence wider than the
  column on its own (very large text on a small phone) wraps evenly rather
  than running off the page. The underline stays (the link is the same color
  as the words around it, so the underline is what shows it's a link), but
  it is a fine 1px line, a little below the letters and softer than the
  text (the text color at 65%, which keeps it at 3 : 1 or more against the
  page in every theme); it darkens under the pointer.
- **Titles are balanced.** A title's lines are evened out, so a two-line
  title reads as two similar lines ("Apple's new reading mode / is quietly
  excellent"), as Apple Books sets a title. The title still sits in the
  same column as the text, starting where the text starts; only its lines
  are evened. Titles are short, so this costs nothing.
- **At least 56px of paper beside the text on a computer.** The reading
  pane's side margins grew from 40px to 56px on anything wider than a
  phone. When the pane is narrow, the line of text gets shorter rather than
  the margins thinner. Phones keep the one 20px phone margin (decision 0043).
- **The empty reading pane is blank paper.** Nothing is drawn until you
  choose an article. Screen readers still hear "No article open." and, when
  the list has something to open, "Choose one from the list, or press j."

**What it means for the owner.** Open a summary-only article: the note at
the end reads "Read the full article ›" and never breaks inside the link.
Long titles wrap into even lines. At a laptop-sized window the text has
wider margins. With no article chosen, the reading pane is simply empty.

**Floors.** The link still carries an underline, not color alone; its
words, the note and the text keep their contrast; the publisher is still
credited (byline, link name for screen readers, Open original). Nothing
moves or animates.
