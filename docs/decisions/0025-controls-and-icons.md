# 0025: Four kinds of control, and one set of icons

*23 October 2026, the first UI and UX polish pass after V1, under the
owner's standing approval.*

**What.** Every button and text box now comes from four shared styles in
`web/src/app.css`, instead of each screen drawing its own black box:

- **Everyday button** (`.btn`): edged in the muted grey, not the text color.
- **Main button** (`.btn-primary`): the one main action of a form (Sign in,
  Add feed, Save), filled with the text color. Never ink blue.
- **Toolbar action** (`.btn-quiet`): Refresh, Mark all as read, Edit feed,
  Open original, Copy link, Star, Mark unread. An icon beside its word, no
  edge; a pointer over it deepens the tone a little.
- **Field** (`.field`): text boxes, dates and lists to choose from, edged in
  the muted grey (at least 4.5 : 1 on every area, so the edge is clear).

The icons live in `web/src/lib/Icon.svelte`: drawn by hand on one 20px grid
with the same 1.5px line, so they read as one set. No icon library was added.

**Smaller fixes in the same pass.**

- A heading that receives the keyboard's place when a screen opens (for
  screen readers) no longer draws the outline: it can't be pressed. Anything
  that can be pressed still shows it.
- Rows in the list and the sidebar draw the outline just inside themselves,
  so the area's edge no longer cuts it into two lines.
- Rows, toolbar actions and everyday buttons deepen slightly under a
  pointer. Nothing moves or fades.
- The search field stays one line tall with its `in:` chip: the chip is a
  soft tone instead of a box, and a long name is shortened with "…" (the
  whole name shows on hover; screen readers hear all of it from the remove
  button).
- The "Marked … · Undo" line is one text line tall, like the "New items"
  line above it, so the list starts higher. Undo still answers a 44px tap.
- Selected text and the typing caret follow the theme.

**Why.** Heavy black boxes on every action made each screen look busy and
dated, against "calm over engagement" and "clear at a glance". Toolbars
with words and icons read faster, and one main action per form says where
to go next.

**Revisit if:** a screen needs a fifth kind of control, or the owner finds
the toolbar actions too quiet to notice (give them the muted edge of `.btn`).
