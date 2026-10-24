# 0052: One phone sheet, raised night surfaces, settings and shortcuts in one shape

*24 October 2026. From the sixth Apple Books critique
(`ui-polish/critic-applebooks-6.md` in the project files, "Path to 10" rows
1, 2, 6, 8 and 10; gaps 11 to 17). Apple Books is the only design reference.
Changes part of 0049's close rule (on a phone only) and 0045's text-size
stepper.*

**Why.** The critic scored sheets, Settings and Shortcuts lowest of the
screens. On a phone the four sheets used three frames: Add a feed had a back
arrow *and* Cancel, Edit feed had Cancel with Unsubscribe alone above
half-width buttons, and Settings and Shortcuts had an X. In night mode the
sheets, menus and the note at the list's foot were as dark as the page or
darker, where Apple Books lifts them with a lighter grey. Settings' six theme
tiles wrapped four and two on a phone, and text size was two loose capsules
under rows of segmented tracks. Helper text was indented past its field's
left edge, and "Choose one:" sat 8px under the field in full ink. The
shortcut list's footnote ended its left column early (and landed mid-list on
a phone), its key caps were flat chips, and a phone's empty state showed two
headings ("Unread" over "A quiet place to read.").

**What changed.**

- **One phone sheet.** On a phone, Add a feed, Edit feed, Edit folder,
  Settings and the shortcut list are all built the same way: the large serif
  title on the 20px margin with an X at the right of the top line, and no
  back arrow or Cancel. The main action (Add feed, Save) takes the full width
  at the screen's foot, 50px tall with 12px corners and 16px above the home
  bar, and stays in view while the form scrolls. Unsubscribe (and Delete for
  a folder) is the one red row of a group of its own, at least 32px above
  Save; it keeps its tooltip, its words for screen readers and the Undo that
  follows straight afterwards, exactly as before. The X and Escape go back
  unchanged. On a computer nothing changes: sheets keep Cancel and no X
  (0049).
- **A raised surface by night.** Each theme has a `--surface-raised` color.
  By day it's the page, as before. By night it's a small lift above the page
  (Original #28282a, Quiet #36363a, Paper #31312e, Bold #1c1c1e, and warm
  #342c23 for Calm and #2b2921 for Focus), with a 1px edge of 8% white and
  grouped rows inside it 4% white over it. Sheets, the shortcut list, the
  menus, the search options, the Aa panel and the note at the list's foot
  use it. On a phone the shortcut list is a screen, so it keeps the page's
  color. `contrast.test.ts` checks every text color on it, under a pointer
  and on a chip, and in a group inside it. Original's lift is a touch below
  the critic's #2a2a2c so the muted grey keeps 4.5 : 1 on a hovered row of a
  group inside a sheet.
- **Settings on a phone.** The six theme tiles sit three to a row in two
  rows, each page 4 : 3. Text size sits on the same track as the segmented
  controls (4px round, a faint tone, 10px corners), with each A a raised cell
  as a chosen segment is drawn, and the step's name between them as plain
  words; at an end, the A that can't go further sinks into the track and
  fades. Same control in the Aa panel. 44px tall for a finger, 40px cells
  for a mouse, as the segments are.
- **Helper text on the grid.** A field's helper line is 13px in the muted
  grey, 6px under the field, starting on its left edge. "This site offers
  more than one feed. Choose one:" is set as a field's name, in the second
  ink, 20px under the field.
- **Shortcuts.** The note about Tab, Enter and Escape is a footer across
  both columns, 24px under them. Key caps have a 1px rim and a 2px lower lip
  in a soft mix of the text color, 22px tall with 12px regular letters;
  "then" is 12px muted.
- **One heading on a phone's empty state.** With no feeds yet, the list's
  "Unread" title steps aside on a phone (screen readers still hear it as the
  screen's name) and the keyboard starts on the welcome's heading, which sits
  left-aligned on the margin 96px under the top line. A computer keeps the
  centred welcome.

**Revisit if** a night theme's lift makes any text fall below its contrast
level (the test will say), or a phone form grows so long that a main action
pinned to the foot hides too much of it.
