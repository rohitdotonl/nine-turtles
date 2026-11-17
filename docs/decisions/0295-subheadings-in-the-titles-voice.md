# 0295: An article's headings speak in the title's voice

**In one line:** Headings inside an article are set in the title's face at regular weight, on the left, stepping down by size alone (31px, then 24px, then the text's size in semibold), so no heading is heavier than the title above it.

*17 November 2026. The owner, reviewing the reading experience (tracker item 8), saw ten versions on his own Substack articles, then three as pages in his browser (1, 2, and 1 with a semibold title), and chose 2: "Implement B".*

**What changes.**
1. `h1` and `h2` inside an article: the title's face (Literata's display cut for Literata; the chosen font for Atkinson and the device's serif), regular weight, 1.55 times the text (31px by default), line height 1.15, 2.4em above and 0.4em below.
2. `h3`: the same face and weight, 1.2 times (24px), line height 1.25, 1.9em above and 0.35em below.
3. `h4` to `h6`: the text's own size and face, semibold (weight is their only sign), 1.6em above and 0.3em below.
4. On a phone (up to 40rem) the first step is 1.35 times (about 24px), so it stays clearly under a long title (1.6 times) even in Arabic, whose text is set a tenth larger. Italics inside a heading use the text face's own italic, the display cut having none. Scripts that loosen the title's lines and tracking (decision 0223) loosen the headings' the same way.
5. All stay on the text's left edge with balanced lines. Replaces decision 0246's semibold 26px and 22px steps.

**Why.** Once the title became regular and centred (decision 0294), semibold headings were the heaviest type on the page, louder than the title over them. Best practice (Butterick, Bringhurst) is one signal per step and no heading heavier than the title; books set their headings in the title's voice. The web's standard (bold, left) exists for skimming, so the headings keep the left edge, where a skimming eye looks, and gain size instead of weight.

**Considered.** Keeping semibold and making the title semibold to match ("C"): the web's standard and the most skimmable, but a long title becomes a heavy block on a phone and the page reads as news. Centred headings: a zigzag with many sections, ragged when long. Small capitals, italic, rules, a sans-serif, headings in the margin: see the tracker's item 8.

**Revisit if** readers find headings hard to spot while skimming: make them larger, not bolder.
