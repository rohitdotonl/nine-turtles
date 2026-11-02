# 0141: Three typefaces: Literata, Atkinson Hyperlegible Next and its Mono

*2 November 2026. The owner chose this from the typeface mockups (brand
sheet, option 3). Replaces the font part of 0013 and the interface font
of DESIGN.md before it.*

**Decision.** nine turtles uses three typefaces, all served by nine turtles
itself:

- **Literata** for everything written: articles, the article list's titles,
  page titles and the wordmark (600). Unchanged.
- **Atkinson Hyperlegible Next** (400, 500, 600, and a 400 italic) for the
  whole interface, on every device. It is also the sans reading font in the
  Aa panel, replacing the original Atkinson Hyperlegible. The device's own
  font (San Francisco in Safari on Apple devices) and Inter retire.
- **Atkinson Hyperlegible Mono** (400) for code in articles. JetBrains Mono
  retires.

**Why.** One interface face on every device, so nine turtles looks like
itself in one screenshot instead of like the device it's on. Atkinson
Hyperlegible Next was made by the Braille Institute for legibility,
including low vision, which fits the floor "Everyone can read here". It has
a real medium (500), so Settings' row names no longer fall back to regular.
Its Mono sibling keeps code in the same family.

**How.** The files come from the Fontsource packages of Google Fonts' files
(SIL Open Font License, a licence file per family in `web/public/fonts/`),
in basic and extended Latin pieces, as before. Nothing was added to
`package.json`. The fonts went from about 339 KB to about 210 KB of the
400 KB budget. Interface italics above 400 aren't shipped: the browser
slants the upright. A reader who picked "Atkinson" as their reading font
keeps that choice; it now shows the Next design.
