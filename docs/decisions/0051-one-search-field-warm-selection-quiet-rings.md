# 0051: One search field, a selection from its own pane, rings only for the keyboard

*24 October 2026. From the sixth Apple Books critique
(`ui-polish/critic-applebooks-6.md` in the project files, gaps 6 to 10; its
rows 3, 5 and 9). Apple Books is the only design reference. Replaces 0041's
unfilled sidebar find field; adjusts 0037's selection share (13% to 12%).*

**Why.** The list's search was a 46px, strongly filled slab while the
sidebar's find field had no box at all: two search styles on one screen,
where Apple Books has one slim, lightly filled capsule. On a phone, the row
you had just tapped could show the keyboard's ring when the keyboard's place
moved back to it, since a browser may count that as "visible" focus. A long
feed name cut short with "…" left up to a letter's width of blank space
before the "·", so that row's gap looked wider than the row above it. And
with a feed below the fold, the sidebar didn't show where you were.

**What changed.**

- **One search field** (`.search-capsule` in `app.css`): the list's search
  and the sidebar's find field are the same capsule, `--search-height` tall
  (36px with a fine pointer on a window at least 56rem wide, 44px otherwise),
  10px corners, a 6% fill of the text color (`--search-fill`) and no edge,
  a 14px magnifier in the icon column, and the interface's text size (17px
  on touch screens, so a phone never zooms into the field). A chip inside
  is 24px tall with 6px corners; its Remove button keeps a 44px target. The
  options button is the field's height with a 28px tone when open. The
  options menu uses `var(--surface-raised, var(--paper))`, so it takes the
  raised surface wherever a theme defines one.
- **The selection pill from its own pane:** by day, the accent at 12% over
  the list or the sidebar (each theme's hex values are that mix, checked by
  `contrast.test.ts`, which now also checks the second ink on the pill at
  4.5 : 1). Night versions keep 0041's lift of the text color, which already
  keeps each pane's temperature.
- **Rings only for the keyboard:** a row's ring (2px, the softened text
  color, 2px inside the pill) shows only after a key press (`data-keyboard`
  from `main.ts`), never after a tap or a click. In high-contrast mode the
  selected row keeps its highlight edge.
- **The "·" hugs the "…":** `hug.ts` narrows a cut-short source name's box to
  the letters shown plus the "…" (CSS still draws the "…", and the full name
  stays in the text), measured again when the line changes width, the name
  changes or the fonts load.
- **Where you are stays in sight:** when the place changes, its sidebar row
  is scrolled into view with `scrollIntoView({ block: "nearest" })`: at once,
  only as far as needed, never smoothly, and not when counts change.

**Not done.** The critique's 8px phone margin for rows and 10px ring corners:
the row's pill keeps 0049's 4px phone inset and 8px corners, which the unread
dot's placement depends on.
