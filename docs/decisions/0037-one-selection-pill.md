# 0037: One selection pill, an accent unread dot, one search highlight

*24 October 2026. The owner made Apple Books the only standard and let
agents change the documents to reach it, keeping the floors and the three
panes. From the second Apple Books critique
(`ui-polish/critic-applebooks-2.md` in the project files, sections A, B
and E: "selection and state", plus the list's rhythm).*

**What changed, and why.**

- **One selection recipe, sidebar and list alike:** a pill with 8px
  corners, set 8px in from the pane's edges, filled with the theme's
  accent mixed into the pane (13% in the light themes, 20% in the dark
  ones; `--tint-list` and `--tint-sidebar`). No border, no outline at rest
  and no bar: the bar flush against the pane's edge read as a clipped stub
  and the list's box overhung its own hairlines. The title stays in full
  ink. The filled shape is the non-color sign, with full ink in the list
  and semibold in the sidebar; screen readers hear "current". In
  high-contrast mode the fill gives way to an edge in the system's
  highlight color. This replaces the bar of decisions 0033 and 0036.
- **Shares, and the muted grey:** the critique asked for 12–14% light and
  about 22% dark. At 22% the dark themes' muted grey fell to about 3.8 : 1,
  so the dark share is 20% and the muted grey moved a step towards the text
  color where needed to stay at 4.5 : 1 on the pill: off-white `#60554A`,
  sepia `#5B4F3F`, mist `#515D6A`, dark `#B9AF9C`, graphite `#AEACA5`,
  night `#B5A78E`, midnight `#A3ADC0`. The others are unchanged.
  `contrast.test.ts` recomputes each pill from its accent and checks text
  (7 : 1), the second ink and muted grey (4.5 : 1) and the accent (3 : 1)
  on it.
- **Keyboard focus:** the softened ink outline (`--place-focus`) shows only
  on `:focus-visible`, now drawn 2px *inside* the row's edge, so it never
  reaches over the hairlines or the pane's edge. It keeps at least 3 : 1 on
  every area and on the pill (tested).
- **Hover** is a faint neutral tone of the text color (5%), never the
  accent, and tested to stay lighter than the pill.
- **Hairlines** between list rows now run inside the pill's edges (24px in
  on both sides) and still hide directly above and below the selected row.
- **Unread:** a drawn 8px dot in the theme's accent, centred in a 16px
  gutter at the row's left, level with the title's first line. The title
  stays semibold: the self-hosted Inter has only 400 and 600, and a
  synthesized or smaller title would look worse than one honest weight.
  Read titles stay in the second ink at 400.
- **The accent's meaning widens,** as in Apple Books: it marks what's yours
  to look at (where you are, what's unread, what a search found). It is
  still never a button, a link, a focus outline or decoration. AGENTS.md's
  hard rule and DESIGN.md's "One accent" rule say so now.
- **Row rhythm:** 10px above and 11px below, title line height 1.3, the
  line under it 2px below.
- **"That's everything."** loses its rule and sits as a quiet small caption
  at the titles' left edge.
- **Search matches:** one style for titles and excerpts, a `<mark>` with
  the accent at 12% behind it, 3px corners, in the text's own weight and
  color (excerpt matches in full ink). No underline, no bold. Text keeps
  7 : 1 on it, even inside the pill (tested). Three typed dots in a
  publisher's text show as one "…" in an excerpt, like slowfeed's own cuts.

**Alternatives considered.** Keeping the bar inside the pill (a 3px rounded
bar at its left): a second mark for the same state, which Apple Books
doesn't use. Lighter unread weights (500, 560): not shipped with Inter, and
adding font files is a library-size question for the owner.
