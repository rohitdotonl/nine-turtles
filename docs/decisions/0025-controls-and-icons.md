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
with the same 1.5px line, so they read as one set (the star included, filled
when starred). The phone's previous and next arrows and the sidebar button
are still drawn in place; they move into the set when next touched. No icon
library was added.

**Smaller fixes in the same pass.**

- A heading that receives the keyboard's place when a screen opens (for
  screen readers) shows it as a short bar in the text color just left of the
  title, instead of a box around it: still visible (SPEC section 19), not
  boxed, because it can't be pressed. Anything that can be pressed still
  shows the full outline.
- Rows in the list and the sidebar draw the outline just inside themselves
  on three sides, so the area's edge no longer cuts it into two lines and the
  row's own ink blue bar on the left stays uncovered. In high-contrast mode,
  where shadows aren't drawn, it's a plain inside outline.
- Rows, toolbar actions and everyday buttons deepen slightly under a mouse
  pointer (never on touch screens, where a tint would stick after a tap).
  Nothing moves or fades. Both faint tones (`--hover`, and `--tone` behind
  search chips and key caps) are the text color, never the selected row's
  ink blue tint, and `contrast.test.ts` checks text on them.
- The search field stays one line tall with its `in:` chip: the chip is a
  soft tone instead of a box, and a long name is shortened with "…" (the
  whole name shows on hover and in the list's heading just below; screen
  readers hear all of it from the remove button, a full 44px target).
- The "Marked … · Undo" line is one text line tall, like the "New items"
  line above it, so the list starts higher. Undo still answers a 44px tap.
- Selected text and the typing caret follow the theme.

**Why.** Heavy black boxes on every action made each screen look busy and
dated, against "calm over engagement" and "clear at a glance". Toolbars
with words and icons read faster, and one main action per form says where
to go next.

**Revisit if:** a screen needs a fifth kind of control, or the owner finds
the toolbar actions too quiet to notice (give them the muted edge of `.btn`).
