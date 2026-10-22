# 0008: Fonts served in pieces; placeholder colors until Milestone 4

*October 2026, Milestone 1. Font choice approved by the owner.*

**Fonts.** Literata (regular weight) is served by slowfeed itself from
`web/public/fonts/`, in two pieces: basic Latin, and extended Latin (for
letters like ā, ł, ő). A browser downloads a piece only when the page uses
one of its letters. The pieces come from Google Fonts' own subsets of the
Literata project (SIL Open Font License; the licence file sits beside them
and is served with them). Together they're about 37 KB of the 400 KB budget.
Other weights and the other fonts (Atkinson Hyperlegible, Inter, JetBrains
Mono) arrive in Milestone 4. Devanagari and other scripts use the device's
own fonts (DESIGN.md → "Typography").

**Colors.** `web/src/app.css` uses DESIGN.md's backgrounds and ink blue. The
text and muted greys are placeholders that pass WCAG AA (checked
automatically); the owner chooses the real greys in Milestone 4.

**Themes in tests.** Until Settings exists, the tests choose a theme the way
Settings will: by setting `data-theme` on the page. Without it, the device's
light/dark setting decides.
