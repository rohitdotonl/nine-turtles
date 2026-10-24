# 0028: One "where you are" shape, an unread dot, and a floating note

*24 October 2026. From the outside critic's second pass
(`ui-polish/critic-round4.md` in the project files), under the owner's
"taste first" direction (decision 0027).*

**Decided by:** the owner, who set the order "taste first, good UI and UX
principles next, my rules last" and approved overriding the design documents
wherever that serves it (24 October 2026). The unread dot, the note's shadow
and the scroll hairline are recorded as exceptions in DESIGN.md's
Exceptions log.

**Why.** The critic found three things that made the app feel less finished
than the apps it's compared with (Things, Linear, Apple Mail):

- The sidebar and the list marked "where you are" in two different ways, and
  the list's was a hard-edged band.
- Unread and read titles differed only by weight and ink, which is hard to
  scan in a long list.
- A reserved empty line sat at the top of every list, waiting for "New
  items" or "Undo", and the add and edit pages started their titles lower
  than every other page.

**What changed** (replacing the bar from decision 0026 and the reserved
lines from the earlier SPEC):

- **One shape for "where you are"**: a rounded, faint tint with a short ink
  blue pill at its left edge, the same in the sidebar and the list
  (`.place` in `web/src/app.css`). Hovering a row gives a fainter tint on
  devices with a pointer. In high-contrast mode the pill takes the system's
  highlight colour and the row keeps its outline.
- **A small dot** in the margin before an unread title, on top of the
  semibold weight, so unread is never told by tone alone.
- **A floating note** at the bottom of the list carries "New items",
  Undo, failed saves and "slowfeed was updated". It floats over the list,
  so nothing moves when it appears; screen readers hear it as before.
- **A faint line under a pane's top line** appears only once its content has
  scrolled under it (`web/src/lib/edge.ts`).
- **One top line for pages** (Settings, Add a feed, Edit feed, Edit folder):
  the serif title and an X (`web/src/lib/PageHead.svelte`).
- **One feed's own list** leaves the feed's name off each row; screen
  readers still hear it.
