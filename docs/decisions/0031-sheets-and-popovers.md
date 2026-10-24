# 0031: Sheets for short tasks, a popover for search options

*24 October 2026. From the outside critic's round 5 (`ui-polish/critic-round5.md`
in the project files, items M3, M4, M5, M6 and M7), under the owner's "taste
first" direction (decision 0027) and their choice of bigger batches.*

**Why.** Adding a feed took over two thirds of the screen for one field, and
the list and article vanished for a two-second task. Edit feed had three ways
out (Save, Cancel and an X). The search options pushed the whole list down
260px and showed the browser's `mm/dd/yyyy` date boxes. Long feed names
wrapped the list's title onto two lines, so the search box jumped between
feeds. On a phone, the theme pictures and reading fonts stacked awkwardly, and
in the dark theme the chosen setting looked pressed in.

**What changed.**

- On a window wide enough for the list, **Add a feed, Edit feed and Edit
  folder open as a sheet**: a 480px card in the middle of the window, over a
  faint warm dim, with the list and article still behind it. It's a native
  modal dialog, so the keyboard stays inside; Escape, Cancel or a press on
  the dim closes it. There's no X. The address still changes (`/add-feed`,
  `/feeds/3/edit`), so Back and reload work as before. The article you were
  reading stays open behind it. On a phone they stay screens of their own.
- **Add feed in the sidebar is an action**, so it no longer takes the
  "where you are" bar.
- **Search options are a popover** under their button, floating over the
  list: Search in (a list), Show only (Unread, Starred) and Published (Any
  time, Past week, Past month, Custom). Only Custom shows date boxes. A
  press outside closes it.
- **The list's title is one line**, ending in "…" with the whole name as its
  tooltip. The search box's placeholder is just "Search".
- **Segmented choices** moved from Settings into the shared styles. In the
  dark theme the chosen tile is lighter than its track.
- **On a phone:** four theme pictures in one row, the two reading fonts side
  by side, segmented choices at full width, and a faint line above the
  article toolbar, which clears the home indicator.

**Considered and kept.** The critic suggested one Folder list instead of
tick boxes. A feed can be in more than one folder (SPEC section 15), so the
tick boxes stay. Their icon-only phone toolbar also stays labelled: the
words now fit on one line and make each button plain.

**Decided by** the agent, under the owner's standing approval to override
the documents where taste calls for it. No floor changed: the sheet keeps
the keyboard inside, every control has a visible focus outline, and touch
targets stay 44px.
