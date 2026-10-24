# 0048: One sheet, one close rule, a choice you can see

*24 October 2026. From the fifth Apple Books critique
(`ui-polish/critic-applebooks-5.md` in the project files, items 9 to 16; its
batches 3, 4 and 5). Apple Books is the only design reference. Item 17 (the
chosen theme tile) and the theme picker are left to the themes work.*

**Why.** The critic found the sheets and Settings good, but not yet one
family. Add a feed's choice between the feeds a site offers showed which one
was "chosen" by a faint tint alone (it was really a pointer's hover tone), and
pressing Add feed under it searched again rather than adding one, which broke
the "never color alone" floor and left the reader unsure what would happen.
On a phone, Edit feed and Edit folder had both an X and Cancel, while the
computer's sheets have only Cancel; the shortcut list was a floating card with
the screen behind it showing past its edge, where every other sheet is a
screen of its own; Edit feed's form started about 56px under its title,
against Settings' 20px; and the Settings preview sat 16px further in than the
groups under it, so it read as indented text. On an 800px-tall computer
window the shortcut list ran to 17px from the window's top and foot, with its
search filters cut by the scroll edge. And on a phone a list row's keyboard
ring touched the unread dot hanging beside it.

**What changed.**

- **A choice of one has a round mark.** When a site offers several feeds,
  they're a grouped list of rows (name, then address), each ending in a round
  mark: empty, or filled in the text color with a dot of the page when it's
  chosen, as a Mac draws a radio button. Round, because only one can be added
  (Edit feed's folders keep their square tick boxes, which say "any of
  these", decision 0045). They're real radio buttons: the first is chosen,
  the arrow keys move the choice, and **Add feed adds the chosen one** while
  the field still holds the address it was found at. Change the address and
  Add feed looks again.
- **One close rule.** A sheet you commit (Add a feed, Edit feed, Edit folder:
  they have a Save or Add feed) closes with **Cancel only**, on a computer
  and on a phone; Escape still works, and on a phone the system's back too.
  A sheet you only look at (Settings, the shortcut list) closes with **an X
  only**. So the phone's Edit feed and Edit folder lose their X, and Add a
  feed's phone page keeps its back button and Cancel.
- **On a phone every sheet is a screen of its own,** the shortcut list
  included: at the phone-narrow width (the one where the app shows one screen
  at a time) it fills the screen with no card edge, corners or dim, its title
  and X on the phone's 56px top line and its words on the one 20px margin.
  The keyboard button stays off the phone's sidebar, as before; `?` from an
  attached keyboard still opens the list.
- **The same 20px under every top line.** Edit feed, Edit folder and Add a
  feed's phone pages start their form 20px under the top line, as Settings'
  first group does.
- **The shortcut list fits a computer window.** It's never taller than 720px
  and always at least 48px clear of the window's top and foot. Its two
  columns are now stacks of their own: Moving around and Your articles on the
  left, with the line about Tab, Enter and Escape under them; Reading,
  Everywhere and the search filters (in one column of six) on the right. Rows
  are 4px shorter. At 1280 × 800 the whole list shows without scrolling; the
  hairlines that mark scrolling stay for smaller windows.
- **The Settings preview on a phone** starts on the groups' own outer edge,
  the screen's 20px margin; the small group headers stay inset on the rows'
  words, as iOS sets them.
- **The phone's unread dot moves 2px in,** to 8px from the screen's edge and
  4px clear of the title, so a row's keyboard ring (drawn 2px inside a pill
  that sits 4px in) passes 2px clear of it.

**Not changed.** The critique's "one field style" (item 11) was checked
against the code: every form field (sign-in, the welcome, Add a feed, Edit
feed, Edit folder, the search options' dates) already uses the one text field
(a 1px edge over a faint fill), and the two search fields already share
one edgeless search style (decision 0041). The list search's height belongs
to the search work and is left to it. The critic's idea of hiding the
shortcut button on every touch screen was not taken: it is already off the
phone, and a tablet with a keyboard can use it.

**Checked by.** `tests/feeds.spec.ts` (the radio marks, the first chosen, Add
feed adding the chosen one, with the mouse and with the keyboard alone),
`tests/app.spec.ts` (the shortcut list full-screen on a 320px phone, and at
1280 × 800 at least 48px clear, the filters under Everywhere, nothing to
scroll), `tests/phone.spec.ts` (no X on the phone's Edit feed and its form
20px under the top line, the Settings preview on the 20px margin, the row
ring clear of the dot).
