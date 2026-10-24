# 0055: iOS page sheets, a flat text-size capsule, Mac key caps and a softer field ring

*24 October 2026. From the seventh Apple Books critique
(`ui-polish/critic-applebooks-7.md` in the project files, section 2(c), gaps
8 to 14). Apple Books on macOS and iOS is the only design reference. Changes
parts of 0045 (the chosen theme tile's edge), 0049 (where Settings' sample
sits on a phone) and 0052 (the text-size stepper's raised cells). Approved by
the owner as part of the polish batch.*

**Why.** The critic found the phone's Add a feed and Edit feed were a white
full screen with grey groups and much empty space, where Books uses a page
sheet. Text size showed two raised cells, which is exactly how the app draws
a *chosen* segment, so it read as two choices chosen. The chosen theme's
ring sat 2px from a tile that had lost its edge, so ring and tile fused into
one thick border and the chosen tile looked bigger. Settings' sample floated
outside its card, flush left. Fields drew a 2px near-black ring on load, the
heaviest line on sign-in and Add a feed. The shortcut list printed "Shift+A"
and lower-case caps, where macOS prints ⇧A. The welcome's "Import an OPML
file…" sat 10px off the margin and read as loose text.

**What changed.**

- **Phone page sheets.** On a phone, Add a feed, Edit feed and Edit folder
  are drawn as an iOS page sheet: a 10px strip of the dimmed screen (the
  sheet's own dim, black at 18% by day and 45% by night) shows above it, its
  top corners are 12px, and its ground is grouped: by day the list's grey
  with each group (the folders, Unsubscribe, Add a feed's choice of feeds) a
  card in the page's color, as iOS sets white cards on #f2f2f7; by night the
  page itself with each group a step lighter (the group tone), as iOS lifts
  its dark cards. The title in the top line is a step smaller (20px), so the
  field sits higher. The X, the full-width main action at the foot and
  Unsubscribe in its own group with its Undo are unchanged. It appears at
  once, with no slide.
- **A flat text-size capsule.** One flat capsule on the segmented track:
  small A, the step's name, large A, parted by hairlines in a faint tone of
  the text color, nothing raised and no shadow. The A that can't go further
  fades to the muted grey, as before. 44px tall to touch, 40px cells with a
  mouse. Same control in the Aa panel.
- **The chosen theme.** Every tile keeps its own faint 1px edge (14% of the
  text color), chosen or not; the chosen one adds a 2px ring in the text
  color with a 3px gap, and its name is semibold. Tiles sit 16px apart, and
  the keyboard's ring is 6px out from its tile, clear of the chosen ring.
- **The sample inside its group.** Settings' sample paragraph is the first
  row of the Look and feel group: 16px round it, its words on the rows'
  words, a hairline under it. It is a row, not a card inside a card.
- **A softer field ring.** A field in use drops its edge for one 2px ring in
  `--place-focus` (the text color at 65%, as rows use), 1px clear of the
  field. The "New folder…" row rings in the same tone. Still the text color
  and never the accent. `contrast.test.ts` checks it at 3 : 1 or more against
  the field's fill and every surface a field sits on (page, list, sidebar,
  raised surface, a group and a group inside a sheet), in all six themes by
  day and by night and on a dark device before the script runs. It passes
  everywhere.
- **Mac key caps.** The shortcut list and the More menu print keys as macOS
  does: letters in capitals, Shift as ⇧ (⇧A). In the shortcut list a
  shifted cap is hidden from screen readers and followed by "Shift A" in
  words; in the More menu the cap is hidden and the item's
  `aria-keyshortcuts` says the key. The keys pressed are unchanged.
- **Import an OPML file…** is a link in the text color, underlined as the
  article's note links are (1px, 3px below the letters, the line at 65%),
  with no side padding, so its words start on the heading's margin, and a
  44px-tall target.

**Not done: hiding shortcuts on touch.** The critic also suggested hiding
the shortcut entry and list on a touch screen until a hardware keyboard has
been used. On a phone the keyboard icon is already not shown, and the list
opens only with `?`, which needs a hardware keyboard, so a phone already
never offers it. On a tablet with no keyboard, hiding the icon would also
hide the list's search filters, the one place they're documented, against
"power is hidden, never missing"; and slowfeed only notes the keyboard while
it's in use (it forgets on the next tap), so "has a keyboard been used" isn't
something it knows reliably. Left as it is.

**Floors.** Contrast is checked automatically; the focus ring stays the text
color family, never the accent; no state is shown by color alone (the chosen
theme is semibold, a disabled A also says "Smallest" or "Largest" in the
step's name and to screen readers); every target stays 44px to touch; no
animation or transition; Unsubscribe's Undo is untouched; no new library or
font.
