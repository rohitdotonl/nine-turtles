# 0039: Settings as grouped lists, and one family for sheets, menus and fields

*24 October 2026. From the second Apple Books critique
(`ui-polish/critic-applebooks-2.md` in the project files, sections F, G and
I; its batches 3 and 5). The owner set Apple Books as the only standard,
allowed everything but the three-pane structure to change, and asked to keep
all eleven themes for now (he prunes later). Supersedes the Settings cards
and theme pictures of 0027, the sheet position of 0031 and 0033, and the
separate destructive zone and reserved message space of 0035.*

**Why.** Settings read as a web form: a bordered card per section, bold
labels in a left column and controls of three different widths floating to
the right; the themes were twelve small pictures of the app; the text size was
a six-segment bar; the data actions were three outlined buttons. Sheets sat
high up at a fixed distance with empty space kept for a message that wasn't
there, Save and Cancel sat mid-sheet with Unsubscribe in a zone below them,
and the dim greyed out the warm paper. The search options read as a form (a
dropdown, two chips that looked like a segmented control, a 2×2 grid), and
the shortcut list was cut off mid-row at its foot.

**What changed.**

- **Settings is a grouped inset list,** as in Books' and the system's
  settings: one centred column no wider than 560px; four groups (Reading,
  Look and feel, Your data, Account), each a rounded block a tone off the page
  with no edge, a small muted header above and its explaining line below. Rows
  are at least 44px, the name on the left in regular weight, the control at
  the right end, and every control is 22rem wide so the column reads as one
  (on a phone the control sits under its name). Hairlines between rows are
  inset from the left. Shared classes in `app.css`: `.inset-group`, `.inset-row`,
  `.inset-head`, `.inset-foot`, `.inset-action`.
- **Themes are "Aa" tiles** (`ThemeTiles.svelte`), the same in Settings and
  the Aa panel: a square page with "Aa" in the reading font, in the theme's own
  paper and ink, its name under it; Automatic half light, half dark. The
  chosen one is ringed in the text color, carries a checkmark on its corner and
  has a semibold name, so it never shows by color alone. The grid fills the
  width with tiles of at least 72px (six to a row in Settings, four in the
  panel). The ring is the text color, not the accent: the accent means only
  "where you are". All eleven themes stay.
- **Text size is a stepper** (`TextSize.svelte`): a small A and a large A on
  one track, with the step's name beside them, the same control as the Aa
  panel. Why not keep the segmented bar: six steps made it the one control
  three times wider than the others, and the reader thinks "a bit bigger",
  not "Large"; the sample under it shows the result live. The step's name is
  spoken when it changes, and the A that can't go further fades and says so.
- **Your data and Account are rows,** not buttons: "Import OPML…", "Export
  OPML", "Export starred articles" and "Sign out", in the text color (the
  critique suggested accent-colored text; the accent is kept for "where you
  are"). Sign out is not red: it removes nothing. Import's summary appears
  under the group.
- **Sheets** open a little above the middle of the window (two fifths of the
  space left over sits above them), measured as they open, and are as tall as
  what's in them. Their top then stays put, so a message appearing grows the
  sheet downwards and nothing you're looking at moves (truly centring it
  would shift it up by half a line each time). The dim is black at 18% in
  light themes and 45% in dark ones (`--scrim`), so the paper stays warm.
- **One row of actions, in a Mac sheet's order:** the destructive action
  (Unsubscribe, Delete) at the far left in muted-red words, then Cancel, then
  the main action at the right end. What it removes moved into its tooltip
  and screen-reader description; Undo follows straight after, as before
  (nothing deletes without undo). On a narrow screen it takes its own row.
  Edit feed's folders are a checklist in a grouped list (a checkmark at the
  end of each folder the feed is in), still real tick boxes underneath.
- **Fields** have a 1px edge at 55% of the text color over a 3% fill and 8px
  corners. The critique proposed 22%, which would fall under WCAG's 3 : 1 for
  a control's edge; 55% is the softest that passes on every theme's page,
  list and sidebar, and `contrast.test.ts` now checks it. Focus is the usual
  2px outline in the text color, taking the edge's place. A refused field's
  edge turns the muted red; the message is red words after an alert icon,
  never a thicker black ring. Room for a message is kept only where the page
  is centred (sign-in, the welcome); in a sheet the line appears when needed.
- **Search options are a menu:** three sections of rows (Search in, Show
  only, Published), a checkmark at the start of each row that holds and its
  words semibold. Search in offers "This list" and All feeds (and the place
  now searched, if another), with "Another feed or folder…" opening the
  device's own list of every view, folder and feed. Rows are radio buttons and
  tick boxes underneath; Tab from the field lands on the place being searched.
- **The shortcut list** fades out over its last 32px while more lies below,
  and opens with the keyboard on its title, so its X isn't ringed at once.
- **A calmer first visit:** the welcome is one 420px column with "Import an
  OPML file…" as a quiet button under the field; the list's "Nothing here
  yet." sits muted in the middle of its pane; "No article open." is 17px in
  the second ink with a 13px hint.

**Not done here.** Pruning the themes to Books' six (owner's call, later),
and a sheet-like Settings over the panes (the critique's G36): Settings keeps
its place in the panes, now as a narrower centred column.
