# 0047: One-line rows, plain chips, one empty state

*24 October 2026. From the fifth Apple Books critique
(`ui-polish/critic-applebooks-5.md` in the project files, items 4 to 8 and
18 to 21; its batches 2, 6 and 7). Apple Books is the only design reference.
Changes parts of 0028 (where the note floats), 0039 (the search options'
last row), 0041 (the welcome beside an empty list) and 0045 (the welcome's
import button lined up with the field's edge, and sign-in's message room).*

**Why.** The critic saw, on screenshots, a phone list whose meta line wrapped
("21 / Oct", a star on a line of its own); digits that looked spaced out in
that line; a search chip that said `is:unread` while the menu said "Unread";
a drop-down row among the menu's checkmarks, cut off on a phone; an Undo note
lying over the list's rows; a sign-in with a wider phone margin and a loose
gap kept for a message; a welcome with a centred title over left-aligned
lines, which reflowed when the Add a feed sheet opened over it; and on a
first visit an empty list column beside the welcome. Each was checked
against the code before changing it:

- the meta line was inline text, free to wrap anywhere, and set in tabular
  figures (`tabular-nums`), which give every digit the same width;
- the chip labels were built from the typed syntax;
- the sign-in message kept a line's room *between* the field and the button
  (48px of gap with no message), and the form was capped at 320px even on a
  phone, so it started about 35 to 45px in;
- the welcome swapped its field for a lone import link while the sheet was
  open, so the column changed height and recentred.

**What changed.**

- **The meta line is one line.** Source, time and star sit in one row: the
  source shrinks and ends in "…" (screen readers still hear it whole), the
  time and the star never wrap. Its figures are proportional, as in running
  text; only the sidebar's right-aligned counts keep tabular figures.
- **Chips in plain words.** A filter's chip says what the menu says:
  "Unread", "Starred", "After 1 Oct 2026", "Before 1 Mar 2026". The typed
  form (`is:unread`) is its tooltip and the description screen readers hear
  after its Remove button. The scope chip keeps `in: Tech`, as DESIGN.md
  already drew it. Typing filters is unchanged.
- **A submenu row, not a drop-down.** "Another feed or folder…" with a down
  arrow becomes **Other feed or folder ›**, drawn as a Mac menu's submenu
  row, in the words' full ink. It still opens the device's own list (the
  native list, which keyboards and screen readers already know), so no new
  menu code; its name for screen readers is unchanged. The shorter words fit
  a phone's menu, and wrap rather than cut off if they don't.
- **The note never lies over the rows.** It still sits at the foot of the
  list pane (decision 0028) with its soft shadow, but in a band of the list's
  own tone across the pane's width, which the rows end above, as they end at
  the pane's foot. The band takes no room while there's nothing to say. We
  kept it in the list rather than centring it on the window or the reading
  pane, as the critique suggested: Undo stays until your next action, and a
  note left over the article would cover the text being read (reading
  first), while across the panes' join it would belong to neither.
- **Sign-in: one centred column at the one phone margin.** The field says
  "Password" inside it (and keeps its label for screen readers), so nothing
  sits left-aligned under the centred wordmark; the button is 12px under the
  field, with the field's 8px corners. The room for a message moves below
  the button, as in the welcome (0045): a message moves only the button. On
  a phone the column runs between the same 20px margins as every screen.
- **The welcome: one alignment, still under the sheet.** Its field's name is
  its placeholder (the label stays for screen readers), and "Import an OPML
  file…" is centred under the field rather than lined up with its left edge
  (0045). Add feed's corners match the field's. While the Add a feed sheet is
  open, the welcome keeps its exact shape under the dim: a still, unreachable
  picture of its field, so the page holds one field of that name (the
  sheet's) and nothing behind the sheet moves.
- **One empty state on a first visit.** With a reading area beside the list,
  the list steps aside and the welcome takes both, as Apple Books shows one
  empty library rather than empty columns. The keyboard lands on the
  welcome's title where it would have landed on the list's. Starred keeps
  its own empty list, as before; phones are unchanged.

**Not changed.** The sign-in and welcome buttons take the field's 8px
corners locally; the app's other buttons keep 6px (their sheets belong to
another change). Theme colors are untouched.

**How to check.** On a phone, open All with a long feed name: each row's
source ends in "…", the date and any star stay on its line. Type `is:unread`
in search: the chip says "Unread". Open the search options: the last
"Search in" row reads "Other feed or folder ›". Star an article in a long
list: the note sits in its band, with no row under it. Sign in on a phone:
the field runs between the same margins as every other screen, the button
12px under it. On a fresh installation, the welcome fills everything beside
the sidebar, all centred; press `a` and nothing behind the sheet moves.
