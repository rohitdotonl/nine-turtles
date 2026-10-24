# 0043: One top line, one left edge, and steady phone screens

*24 October 2026. From the fourth Apple Books critique
(`ui-polish/critic-applebooks-4.md` in the project files, items 1, 2, 4, 5,
6, 17, 18 and 19; its batches 1, 2 and 5). Apple Books is the only
standard; the floors and the three-pane structure stay.*

**Why.** Each screen had been built on its own, and it showed:

- The three panes' top lines had three heights. The article's icons sat
  8px higher than the list's More and the sidebar button, and the faint
  lines that appear under them once you scroll fell at different heights.
  Books keeps every toolbar item on one line across the window.
- The article's toolbar buttons filled their bar, so a keyboard ring on
  Aa touched the window's top edge.
- The sidebar had two left edges: Unread, Starred, All and folders started
  their names at 46px, feeds at 20px, and a folder's feeds at the folder's
  own edge, so the hierarchy rested on the arrow alone. The find field's
  icon and words sat off the rows' grid.
- The selected sidebar row was a pill of the accent at 13% over a beige or
  brown sidebar, which reads as a neutral grey. A Mac source list marks it
  with the pill and an icon in the accent.
- On a phone the back button moved about 15px between the list and the
  article, each screen had its own side margin (about 20, 31 and 23px),
  and a folder row showed two chevrons, its show-or-hide arrow and the
  chevron that leads on.

**What changed.**

- **One band for every top line.** A single token, `--bar-h` (56px), sets
  the height of the sidebar's, the list's and the article's top lines, and
  of a page that opens in their place (Settings, Edit feed). Each centres
  its controls; the sidebar button sits 6px from the top. The sidebar's
  wordmark now stays put like the other top lines, with the faint line
  under it once its places scroll. The list's title stays in its top line,
  beside More, as DESIGN.md's "shared top line" has it (the critique
  offered a large title below the line; one line across the window is
  closer to Books' toolbar and keeps the list's search where it was).
- **Rings inside the button.** A button in a top line draws its keyboard
  ring 2px inside its own edge with 10px corners, so with 6px clear above,
  it never reaches the window's top.
- **One left edge.** Every sidebar name starts 46px in, after a 38px icon
  column that holds the places' icons, a folder's arrow and the find
  field's search icon. Section names stay at the 20px margin. A folder's
  feeds start one step in, at 64px. On a touch screen the arrow's target
  reaches 6px into the pane's margin, so it is still 44px wide.
- **The place's icon in the accent.** Unread's, Starred's or All's icon
  takes the accent when you're there, beside the pill and the semibold
  name. That is the accent's own meaning, "where you are"; the accent
  already passes 3 : 1 on the pill in every theme (contrast.test.ts).
- **Phone: one back button, one margin, one chevron.** The back button has
  one class (`nav-back`) in one bar (`nav-bar`): its arrow 8px from the
  edge, the same size, on the list, the article and Add a feed. Names,
  titles and text start 20px in on every phone screen; in a list the pill
  sits 4px in and the unread dot hangs in the margin, 6px from the edge
  and 6px clear of the title (CSS variables on `.list-pane`). Folders on
  the phone's feeds screen have no arrow: their feeds are always listed
  under them, a step in, and a tap on the name opens the folder's list, so
  every feed is still reachable with one chevron per row.

**Not done here.** The critique's item 3 (the list header's hairline and a
row's separator showing close together when scrolled) is left for a later
change. Between 768 and 895px wide the phone layout's article keeps its
40px margin.
