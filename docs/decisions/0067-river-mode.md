# 0067: River mode

*October 2026.*

**Decision.** River mode (SPEC section 10) is one setting for the whole app,
saved on the server beside the sort order (`mode` in the `settings` table:
`inbox` or `river`), so it's the same on every device. No database structure
change: the table already holds named settings. A save names only what
changed, so an older open tab that changes the sort order can't switch the
mode back. In river mode the Unread view is gone: its address and `/` lead to
All, in place. Each device keeps the last mode it saw, so it opens straight
in it instead of showing Unread for a moment; the server's answer decides:
if it differs, an untouched home (`/` or Unread) moves to the right view, in
place.

**Kept as they are.** Read state is still recorded, and "Mark unread" and `m`
stay: SPEC hides only "Mark all as read", and marking unread costs nothing.
Search's "Show only: Unread" filter stays (power hidden, never missing); only
searching *in* Unread goes, as there's no Unread view.

**Why.** Calm over engagement: in river mode nothing counts what's waiting,
so there's nothing to get through. Every title looks alike (full ink,
regular), as a book's contents do.

**Revisit if** per-feed modes (DESIGN.md parking lot) are built: the setting
would move to each feed.
