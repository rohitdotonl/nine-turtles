# 0103: More keys, marking past an article, and one list of keys

*27 October 2026.*

**Decision.** The owner asked for these keys, and chose how each behaves:

- **Space / Shift+Space** move the open article down / up one screen. At the
  end it stops; it never opens the next article. It works wherever the
  keyboard is while an article is open, except on a control that takes
  Space itself (a button, a tick box, a switch, a menu, a field). The
  article's own row in the list counts as no such control, since pressing
  it again would only show the same article.
- **n / Shift+N**: the next / previous unread article listed, passing over
  read ones.
- **Shift+O, "Mark older as read"** (`o` already opens), and **Mark all above
  as read** / **Mark all below as read** in the list's More menu: every
  unread article on that side of the chosen one counts as read, *including
  those not loaded yet*, with Undo for exactly those. Above and below follow
  the list's order; older goes by date, so the menu shows `Shift+O` beside
  "below" when newest first and beside "above" when oldest first.
- **e** folds or unfolds, in the sidebar, the folder you're viewing (or the
  first folder of the feed you're viewing); **Shift+E** opens Edit feed or
  Edit folder for it.
- **c** copies the open article's link, as More › Copy link does.
- **\\** keeps its job, named "Full-screen reading (hide sidebar and list)".
  No new key.
- **One list of keys.** `web/src/lib/keyboard.ts` has one table: for each
  shortcut, its words, its group, and each default key with the action it
  does. The key reader and the `?` cheat sheet are both built from it. A
  test (the owner asked for it) presses every key a keyboard can type, alone
  and after `g`, and fails if one does something the sheet doesn't list, or
  a listed key doesn't do what its row says. Menus take their keys from the
  same table. Keys can't be changed by the reader yet; the table holds the
  defaults a later change can let them choose.

**How "not loaded yet" works.** When part of the side to mark isn't loaded,
the screen asks the server (`POST /api/articles/read-past`) with the list,
the chosen article's place (date and number) and the list's `latest`. The
server marks that reader's unread entries in that list past the place, by
the same rules as the list itself (muted articles, feeds that flow past and
feeds in their Undo time stay out as they do there), but only articles
numbered no higher than `latest`, so nothing that arrived in the background
since is touched. It answers their numbers, and Undo sends "unread" for
exactly those, in parts as Catch me up's Undo does. Search results can't be
named to the server as one list, so the screen fetches the rest page by page
(at most 190 pages) and marks them by name. When everything on that side is
already listed, the screen marks by name as Mark all as read does, which
also works offline.

**Why.** The keys are the ones readers know from other feed readers and
from reading on the web. Marking past an article is the quick way to set a
backlog down from where you are, and the owner chose for it to reach the
whole list, not only what has loaded: it bends "mark all as read only
affects what you've seen", written in DESIGN.md's Exceptions log with its
limits. Writing each key once means the cheat sheet can't drift from what
the keys do, which had already happened once (Shift+J/K listed, never
built).

**Wording.** The note reads "Marked 14 items as read", the same words as
Mark all as read, so the two read as one family.

**Room.** With six more rows, the cheat sheet's rows are a little tighter
(3px above and below instead of 6px), so it still fits a 1280 × 800 window
without scrolling.
