# 0110: Keys of your own, and five more keys

*27 October 2026.*

**Decision.** The owner approved five more keys, and keys the reader can
change "in a quiet way, with good UI and UX that goes well with nine turtles".

**The new keys.**

- **Shift+J / Shift+K: next / previous feed**, as SPEC section 19 always
  listed. They follow the sidebar's order: folders A to Z, each with its
  feeds *while it's open*, then the feeds in no folder. A folded folder's
  feeds are passed over, since you can't see them; a feed in two folders
  counts once, where it's first listed (otherwise the keys would loop).
  Folders, saved searches and Unread, Starred and All aren't stops: from a
  folder's list, Shift+J goes to the first feed listed after the folder's
  row; from Unread, Starred, All or a saved search (all above the folders)
  Shift+J goes to the first feed and Shift+K does nothing. At either end
  nothing happens: lists end. On a phone every folder counts as open, as
  the phone's feeds screen shows them all. They work only in a list, never
  from Settings or a sheet.
- **Home / End: first / last article in the list.** End goes to the last
  article *loaded so far*; it never loads more itself, as `j` doesn't. On a
  control that moves by Home and End itself (a field, a row of choices, a
  menu) those keys stay the control's. They choose from the list only while
  a list is in view and the keyboard isn't in the open article: there they
  scroll the article, and on a page that isn't a list they scroll the page,
  as a reader expects of a book.
- **g then f: Your feeds** (Settings › Feeds › Your feeds, `/settings/feeds`),
  and **g then , : Settings**.
- **g then r: Recently read.** That place is being built in a change of its
  own, so the key is written in the table now (`soon(...)` in
  `web/src/lib/keyboard.ts`, going to `/recent`) but isn't listed and does
  nothing. When `/recent` opens Recently read, changing `soon` to `shortcut`
  on that one line makes it work and appear in the `?` list; the checks
  then expect it.

**Keys of your own.**

- **Where.** The `?` list stays read-only. A quiet **Change keys…** text
  link at its foot (and **Settings › Keyboard › Change keys…**) turns the
  same sheet into its editing mode, titled "Change keys": each key that can
  change becomes a button (44px) around its key cap. Pressing one says
  "Press the new key…" in its place; the next key (with Shift if held)
  becomes the key; Escape cancels and Tab leaves without changing anything.
  A key another shortcut has is asked about in place, under the row
  ("Shift+O already marks older as read. Use it here instead?") with
  **Use it** / **Cancel**; Use it leaves the other with "No key". A key
  that can't be used says why there, and it keeps waiting. Each changed
  key has a quiet **Reset** after it; the sheet's foot has **Reset all
  keys** and **Done**. Screen readers hear each step through a status line.
  Nothing moves or animates. Only screens with a keyboard show the way in.
- **What can't change.** Enter, Escape and `?` (so the list can always be
  opened), and the `g then …` keys, which stay fixed whole (the simpler
  choice: changing only their second key would need a second kind of
  conflict). None of those, nor `g` alone (it starts them), Tab, keys held
  with ⌘, Ctrl or Option (the browser's), Shift or another modifier on its
  own (it keeps waiting), or a key other than one character, Space, Home or
  End, can be chosen.
- **What follows.** The key reader, the `?` list, the tooltips ("Star (X)";
  just "Star" with no key), the More menus and the welcome tip all read the
  reader's keys, so they never disagree. `=` stands in for `+` only while
  `+` keeps its key and nothing else has `=`. The check that the key reader
  and the list agree (decision 0103) now also runs with several sets of
  changed keys.
- **Where it's kept.** For the reader's account, so the keys follow them to
  every device: `keys` in `person_settings` (a name/value table that already
  exists, so **no database structure change**), as JSON of only the changed
  keys by stable names (`{"star": "x", "mark-older-read": ""}`). The server
  checks only size and shape (at most 100, short lowercase names, keys of
  20 characters or fewer, no control characters); the browser decides what
  they mean, and ignores names it doesn't know. Each device keeps a copy,
  so a changed key works from the first press, before the server answers,
  and offline; signing out forgets that copy, so the next reader on a
  shared browser starts from nine turtles' own keys. Saves go one after
  another, each with the whole set; if the newest fails, the keys go back
  to the last set the server has. Each reader's keys are their own.

**Three columns.** With four more rows and the Change keys… link, the `?`
list no longer fit an 800px-tall window in two columns (decision 0049
promised it would). On a window at least 1024px wide it now widens to at
most 1152px (32px clear of the sides) with three columns: Reading; Getting
around and Anywhere; Tidying up and the search filters. Medium windows keep
two columns and may scroll; phones are unchanged.

**Why.** Power hidden, never missing (principle 6): nothing changes for a
reader who never presses Change keys…, and the list stays a reference card.
Editing in place, in the same sheet, is how Apple's own keyboard settings
do it, and it keeps one place for keys.
