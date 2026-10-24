# 0054: A line between panes, a dot gutter on the phone, a pressed shortcuts button, a count the menu never hides

*24 October 2026. From the seventh Apple Books critique
(`ui-polish/critic-applebooks-7.md` in the project files, section 2(b), gaps
4 to 7). Apple Books is the only design reference. Changes part of 0043 (the
phone's one 20px margin, for a list's rows), part of 0049 (the phone dot, 10px in instead of 8px) and the "Hairlines inside a page"
limit in DESIGN.md's Exceptions log ("never between panes").*

**Why.** The critic found four small gaps in the list and sidebar:

- The three panes on a computer were told apart by tone alone, and in some
  themes the list and the page are only a few shades apart (Quiet by night).
  Apple Books on a Mac divides its sidebar from its content with a 1px line.
- On a phone the unread dot sat about 8px from the glass and titles started
  at 20px, where Books and Mail on iOS keep the dot about 10px in and titles
  at about 28px.
- At the sidebar's foot the gear got a filled tile while Settings was open,
  but the keyboard button got nothing while the shortcut list was open.
- With the search options open in a list narrower than about 26rem, the menu
  covered the "28 results" line, so changing a filter hid its own effect.

**What changed.**

- **A line between panes (computers only).** The sidebar's right edge, and
  the list's right edge when the reading pane is beside it, carry one 1px
  line in the text color at 9%, the same tone as the list's row hairlines.
  It is a border, not a shadow, so nothing inside a pane (the note's band at
  the list's foot) can paint over it. Phones show one pane at a time and get
  no line. DESIGN.md's Exceptions log now lists it.
- **A dot gutter on the phone.** A phone list's title, search field and row
  titles start 28px from the screen's edge; the selection pill sits 6px in
  and the unread dot 10px in (4px into the pill), 10px clear of the title.
  The keyboard's ring, 2px inside the pill, still passes 2px clear of the dot
  (0049). Every other phone screen keeps the one 20px margin (0043), and so
  does the welcome that sits in the list's place before the first feed. The
  back button doesn't move.
- **The shortcuts button shows the list is open.** While the shortcut list
  is open, its keyboard button at the sidebar's foot sits on a faint ink
  tile (10% of the text color). Not the gear's accent fill: the gear marks
  a place (Settings), and the accent never marks a button (decision 0037).
  Screen readers hear that the button opens a dialog and whether it is open
  (`aria-haspopup`, `aria-expanded`), so the fill is never the only sign.
  The review dropped `aria-pressed`: it's for toggles, and this button
  opens a dialog.
- **The count is never hidden.** Where the search options menu would cover
  the line above the results (a list narrower than 26rem: the menu is 17rem
  wide from the field's right end, and the count needs about 6rem on the
  left), the menu repeats the count in a quiet line at its foot, under a
  faint rule, and it changes as the filters do. Wider lists show the line
  beside the menu as before, so the count never shows twice. Screen readers
  already hear the line above the results, so the menu's copy is hidden from
  them.

**Not changed.** The accent still marks only where you are, what's unread
and what a search found; the new fill is the sidebar's selection tint, not
the accent. Nothing animates.

**How to check.** On a computer, look for a faint line where the sidebar
meets the list and where the list meets the article. Open the shortcut list
from the keyboard button at the sidebar's foot: the button behind the dim has
the gear's filled tile. On a phone, an unread dot sits a little in from the
edge and titles line up with the list's title and search field. Search in a
list on a narrow window or a phone and open the options: the result count
shows at the menu's foot and changes as you tick Unread or Starred.
