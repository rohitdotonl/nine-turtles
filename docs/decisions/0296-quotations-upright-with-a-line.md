# 0296: Quotations are upright, in full ink, with a 2px line

**In one line:** A quotation inside an article is upright and in the text's full ink, set off by a 2px line in the strong tone at its start, the same line the quotes under "Your highlights" use, instead of grey italic beside a 1px line.

*17 November 2026. The owner, reviewing the reading experience (tracker item 9), saw ten versions on his Substack articles, then 2 and 4 on a computer with five short quotes close together, and chose 2: "okay, build and merge 2".*

**What changes.**
1. `blockquote` in an article: upright, the text's ink, size and face; a 2px line in `--strong` at its inline start; 1.1em between the line and the words; 1.4em above and below; no extra room inside at its first and last paragraph.
2. Scripts without italics no longer need their own upright rule for quotations, so it's removed from `scripts.css`.
3. The writer's own quotation marks are never added or removed.

**Why.** Best practice (Butterick, Bringhurst) is no italic for long quotations, since it's slower to read and hides the writer's own italics, and full contrast, since our floor asks AAA for article text and the second ink is weaker. A line at the start is the sign every reader knows from email and the web, and it holds up when quotes come every paragraph or two. It's also the line the article's own "Your highlights" already draw, so the app has one look for a quote.

**Considered.** A small quotation mark in the margin (4): calm and bookish, but it's ours, so it doubles up when a writer types their own marks. Indented and smaller, as books do: hard to read on a phone. A big mark above each quote, the title's face, rules, a tinted panel: wallpaper or boxes when quotes come close together. A colored line: waits for the color work (tracker Part C). Pull quotes are a separate change.

**Revisit if** the color work gives quotes a color of their own.
