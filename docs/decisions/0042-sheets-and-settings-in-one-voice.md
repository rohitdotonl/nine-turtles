# 0042: Sheets and Settings in one voice

*24 October 2026. From the third Apple Books critique
(`ui-polish/critic-applebooks-3.md` in the project files, items 17 to 25 and
29; its batches 4 and 5). The owner set Apple Books as the only standard and
allowed everything but the three-pane structure to change; the floors stay.
Supersedes the sans sheet title of 0035 and 0039, 0039's fading shortcut
list, its edged segments and its "name beside the As" text size.*

**Why.** The sheets spoke in a different voice from the rest of the app: their
titles were 20px sans while every other title (the list's, Settings', the
sign-in wordmark) is the serif. The URL field sat 8px above its buttons, and
Cancel had the same outlined weight as the main action. A refused field drew
a red edge inside the dark focus ring. In Edit feed, a feed in no folder
showed its one folder as a grey box with nothing in it: no tick, no ring, no
hint that it could be chosen. The shortcut list put a ring round its own
title, as if it were a button, and was cut off mid-row at its foot. In
Settings the preview paragraph was a card inside the group's card, the data
rows looked like plain text until you hovered them, "Medium" floated loose
beside the A/A control, the chosen segment carried an edge Apple doesn't draw,
and in the dark themes the groups were barely a tone off the page.

**What we checked first.** Two of the critique's claims didn't hold in the
code: Edit feed's folders were already a checklist (the grey box was a
checklist of one, unticked, whose mark was simply hidden when off), and the
hairlines in Settings were already inset 16px in every group. The first is
fixed below; the second needed no change.

**What changed.**

- **One title voice.** A sheet's title (`.sheet-title` in `app.css`) is the
  serif at 24px semibold, the same as the list's and Settings' (and the sheet's
  own page on a phone). So is the shortcut list's.
- **Headings in a sheet draw no ring.** A sheet's title still takes the
  keyboard's place as it opens, so screen readers start there, but shows no
  outline: a heading can't be pressed, and a ring makes it look like a button.
  The first Tab lands on a real control, which rings as always (the floor: a
  visible outline in the text color whenever a control has the keyboard). The
  shortcut list's own scrolling region rings just inside its edge, so the
  card never clips it. Titles outside dialogs (an opened article, a list) keep
  their quiet ring.
- **Sheet actions breathe.** 20px between the form and its row of actions,
  12px between buttons. Cancel loses its edge and keeps only a faint tone, so
  the main action is the one thing with weight; its word says what it does,
  and in high-contrast modes it gets the system's button edge back.
- **One line on a refused field.** While the keyboard is in a refused field,
  the focus outline takes its red edge's place, as it does on any field. The
  alert icon and red words under it still say what's wrong, so the red never
  works alone.
- **Folder checklist marks both states.** Each folder ends in an empty ring
  when the feed isn't in it and a filled disc with a check when it is: shape
  and fill differ, not only colour. "New folder…" is now the checklist's last
  row, a text box with its hint under the group, instead of a separate field.
  Its accessible name stays "New folder".
- **The shortcut list fits.** The search filters sit in two columns of three,
  and the card may grow to the window less 2rem, so on most windows nothing
  scrolls. When it does, a hairline shows under the title only once the list
  has moved, and one above a 16px band at the foot only while more lies below,
  so a row cut there reads as scrolling, not clipping. The fade is gone.
- **Settings grouping.**
  - The preview paragraph sits on the page straight under "Look and feel",
    before its controls, as Books puts the sample at the top of its Aa panel.
    It's no longer a card inside a card.
  - Rows that act end in a quiet glyph in the muted grey: › for Import OPML…
    (it opens the file chooser), a download tray for the two exports, a door
    for Sign out. New icons `chevron-right`, `download` and `sign-out` in
    `Icon.svelte`, on the same 20px grid and 1.5px line.
  - The text size control holds the current step between its two As on one
    track (A | Medium | A), the same in Settings and the Aa panel.
- **Segments rise without an edge.** The chosen segment is a raised fill with
  a 1px soft shadow and no border, in light and dark, and its word stays
  semibold. In the dark themes the fill is the text color mixed 24% into the
  page, a clear step above its track.
- **Dark groups separate.** In the six dark settings (dark, graphite, night,
  midnight, black and the device's dark) a grouped list is the text color
  mixed 7% into the page (`--group`), clearly lighter than the page.
  `contrast.test.ts` checks text, second ink, muted grey and the red on it
  and under a pointer, and that the raised segment is lighter than its track
  with its words at 4.5 : 1.

**Choices made.**

- **The accent stays reserved.** Books marks action rows with its tint; here
  the accent means only where you are, what's unread and what a search found.
  The glyphs carry the "this acts" signal instead.
- **Sign out is not red.** Apple often sets Sign Out in red, but in slowfeed
  red means "something goes" (Unsubscribe, Delete), always with an Undo after
  it. Signing out removes nothing: your feeds, stars and settings are all
  there when you sign back in. Painting it red would teach the reader that red
  doesn't mean loss, which weakens the one warning colour we have. It stays in
  the text color with its door glyph.
- **A small shadow on the chosen segment** is a new entry in DESIGN.md's
  Exceptions log. With no edge, the lift is what shows the chosen tile's
  shape. It's 1 to 2px, static, and only on a chosen segment.

**How to check it.** Press `a`: "Add a feed" is in the serif, Cancel has no
edge, and there's a clear gap above the buttons. Type "nonsense" and press
Enter: one dark line round the field, no red edge inside it, and the red alert
below. Open a feed's Edit feed: each folder ends in an empty ring or a filled
check, and "New folder…" is the list's last row. Press `?`: the title is
serif with no ring, Tab rings the X, then the list; on a normal laptop window
nothing is cut off. Open Settings: the sample sits under "Look and feel", the
data rows end in › or a download mark, Sign out ends in a door, "Medium" sits
between the two As, and the chosen segments have no edge. Switch to Night:
the groups stand clearly off the page.
