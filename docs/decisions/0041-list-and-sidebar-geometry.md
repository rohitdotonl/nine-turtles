# 0041: List and sidebar geometry, a quieter first visit, and warm dark pills

*24 October 2026. From the third Apple Books critique
(`ui-polish/critic-applebooks-3.md` in the project files, items 7, 8, 9, 12
to 16, 26, 28, 30 and 32; its batches 2, 3 and 7). The owner set Apple Books
as the only standard and allowed everything but the three-pane structure to
change; the floors stay. Reverses the two-line list title of 0038, and
changes the dark themes' selection pill of 0037.*

**Why.** Checked against the code before changing anything:

- The unread dot sat 4px from its title (its 16px gutter was the pill's own
  padding), so it read as a bullet rather than a mark in a margin.
- The selection pill was already 8px in from the pane (the critique's
  "overhang" was measured from an older shot), but the hairlines between rows
  stopped 24px from the right while the pill ran to 8px: the two disagreed by
  16px on the right.
- A long feed name wrapped the list's title to two lines (0038), pushing the
  search field down and leaving More (…) mid-height.
- Two filled search wells sat side by side (the sidebar's find field and the
  list's search); Apple Books shows one.
- Every feed row kept room on the right for a folder's arrow, so feed counts
  floated in a column 24px left of the row's edge.
- The wordmark, which is focused when the app opens so screen readers start
  at the top, drew its ring tight against its letters.
- "Press ? for shortcuts" appeared under the list only when the sidebar was
  hidden; the keyboard icon at the sidebar's foot already offers the list.
- The first visit showed two empty states ("Nothing here yet." in the list
  and the welcome) and a find field with nothing to find.
- In the dark themes the pill was the accent mixed into the pane: a cool
  blue-grey on Dark's warm brown.
- On a phone the feeds screen, the root of a stack, kept Unread drawn as
  selected, its rows had no chevrons, and "Refresh" in words competed with
  the large wordmark.

**What changed.**

- **A gutter for the dot.** Rows keep the 8px pill inset; inside the pill a
  24px gutter holds the 8px dot, 8px from the pill's edge and 8px clear of
  the title. Every title starts 32px into the list pane, dot or no dot, and
  so do the list's title, the search field, "Show older items" and "That's
  everything." (the pane's left padding is now 32px; its right stays 24px).
- **Hairlines agree with the pill:** from the titles' edge (32px) to the
  pill's right edge (8px from the pane). None shows directly above or below
  the selected row, or the row under the pointer.
- **One-line list title** (reverses 0038's two lines): a long name ends in
  "…" on one line, its whole name in the tooltip and read in full by screen
  readers, so the search field and More never move. In a list pane narrower
  than 340px (a container query on the pane) it steps from 24px to 22px.
- **One search well at rest.** The sidebar's find field has no fill until it
  is pointed at, focused or holds words; its icon and placeholder still show
  it. The list's search keeps its tone.
- **Counts in one column.** A folder's show-or-hide arrow comes before its
  name, as a Mac source list's disclosure does, in the column where Unread,
  Starred and All have their icons (so folder names line up with theirs).
  Feeds inside an open folder start where its name starts. Every row's count
  ends at the same right edge, in tabular figures, right-aligned.
- **Devanagari names** in the sidebar are set a touch larger (1.0625em), found
  by their script, not a guess at the language, so they sit level with Latin
  names. No font file was added; a Devanagari serif needs the owner's
  approval first (critique item 5).
- **The wordmark** stays out of the Tab order (it always was: tabindex -1)
  and is still where the keyboard lands when the app opens. Its ring now
  stands 3px clear with 6px corners, and the phone's taller wordmark row has
  room for it.
- **No shortcut hint in the chrome**, with the sidebar shown or hidden. The
  keyboard icon at the sidebar's foot and `?` open the list, as Books never
  advertises shortcuts. (The empty reading area's ", or press j" stays.)
- **The welcome owns the first visit.** With no feeds the list says nothing
  and the sidebar has no find field. Pulling "Import an OPML file…" closer
  to the field (critique item 26) was left out: the room under the field is
  kept for a message so nothing moves when one appears (0039), and that
  field belongs to the add-feed form.
- **Dark pills from ink.** In the five dark themes the pill is the theme's
  own text color mixed into the pane at 12%, so it keeps the pane's warmth
  (Dark, Night) or coolness (Midnight), as Apple Books' dark selection is a
  lift of the page rather than a tint. The light themes keep the accent at
  13%. Where you are still never rests on color: the pill's shape and the
  semibold name (sidebar) or full-ink title (list). The accent keeps its
  meaning as the unread dot and search marks. `contrast.test.ts` now checks
  the dark recipe, that the pill keeps the pane's temperature (red above blue
  or below it, as the pane), and text at 7 : 1, muted grey at 4.5 : 1 and the
  dot at 3 : 1 on it.
- **The phone's feeds screen is a stack's root:** nothing on it is drawn as
  selected (no pill, no `aria-current`), each row ends in a chevron after its
  count, and Refresh is an icon alone in a 44px target, named "Refresh".

**Not changed.** The pill's 8px inset and corners; the three panes; the
floors (the keyboard's outline is still the text color, 2px, drawn inside a
row's edge; touch targets stay 44px, 36px with a fine pointer).
