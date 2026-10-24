# 0045: Controls that say what they are

*24 October 2026. From the fourth Apple Books critique
(`ui-polish/critic-applebooks-4.md` in the project files, items 11 to 16 and
20; its batches 3 and 4). Apple Books is the only design reference. Supersedes
0042's "A | Medium | A" text size on one track, its ringed-disc folder marks,
and 0039's checkmark badge on the chosen theme tile.*

**Why.** Several controls looked like something they weren't. The text size
control drew "A | Medium | A" on the same grey track as the segmented
controls beside it, but with nothing raised, so it read as a three-way switch
with nothing chosen (and "Medium" looked pressable). The chosen theme tile
carried three marks (a ring, the page's own edge inside it and a check badge),
which on a dark phone showed as two rings. Edit feed's folders ended in empty
circles, which read as "pick one", although a feed can be in several folders,
and their rows were 36 to 40px tall. The sign-in button looked paler, as if
switched off, after a wrong password. And on a first visit "Import an OPML
file…" sat 75px under the field, like a footer rather than another way in.

**What changed.**

- **Text size is a stepper.** A small A and a large A, each its own
  round-ended button (56px wide) in the faint tone a sheet's Cancel has, at
  the two ends of the control, with the step's name between them as plain
  second-ink words on no track. It's the same control in Settings and the Aa
  panel, the same six steps as `+` and `-`, still said aloud when it changes,
  and the A that can't go further still fades.
- **One ring on the chosen theme.** The chosen tile keeps the 2px ring in the
  text color, 2px clear of the page, and its semibold name. The check badge is
  gone and the chosen page drops its own faint edge, so only one line rings
  it. Two marks (ring and weight) still mean it's never told by color alone.
- **Tick boxes for folders.** Each folder in Edit feed ends in a rounded
  square, as a Mac draws a tick box: empty with a muted edge when the feed
  isn't in it, filled in the text color with a check when it is. We kept a
  mark in the "off" state (rather than iOS's checkmark-only list) because
  0042 found that a lone unticked folder with no mark gave no hint it could be
  chosen. Every folder row and the "New folder…" row are 44px, on a computer
  too, the same height as the fields above them.
- **A steady main button.** A pointer over the main action (Sign in, Save,
  Add feed) now takes its fill a step nearer the text color instead of a step
  paler, so it never looks disabled. Sign in says it's busy with
  `aria-disabled`, like every other main action, so it keeps its look and the
  keyboard's place.
- **Importing beside the field.** In the welcome, "Import an OPML file…"
  sits just under the field, its words lined up with the field's left edge.
  The room kept for a two-line message (so a message arriving moves nothing
  above it on the centred page) is now below the button: a message appears
  between the field and the button and moves only the button down.
- **A true minus.** The shortcut list's key cap for smaller text shows "−"
  (U+2212); the key you press is still the hyphen key.

**Checked, no change needed.** Menu rows (critique item 14) are already 44px
on touch screens; the 36px rows in the screenshot are the mouse-pointer size
the first floor allows.

**How to check it.** Open Settings › Look and feel: text size shows two
round buttons with "Medium" in plain words between them; the chosen theme has
one ring and a semibold name, no tick. Open a feed's Edit feed: each folder
ends in a small square box, ticked or empty, and the rows are as tall as the
name field. On a fresh slowfeed, "Import an OPML file…" sits right under the
field, starting where the field starts.
