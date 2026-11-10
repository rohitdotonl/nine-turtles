# 0238: Ways back: Undo for Disconnect, for an import, and a Mark all as read noticed later

*10 November 2026.*

Rohit's "Implement every suggestion from round 1. From round 2, implement
10, 11, 12, 13, 14" (10 November 2026), suggestions 5, 10 and 13 of the
critique through the principle "Forgiving"
(`critique-24/principle-04-forgive-mistakes.html` and its round 2, in the
project's files).

**Decision.**

- **Disconnecting an assistant has Undo** (SPEC section 33). The line says
  "Claude is disconnected. It can no longer reach your nine turtles." with
  Undo and ×, drawn as every Undo line is. The assistant is refused from
  the first moment; Undo brings the same connection back, tickets and all,
  so the reader never has to connect again from inside the assistant
  because of a slip. This replaces the old "no Undo: only the connection
  goes" in Settings.
- **An import has Undo** (SPEC section 16): "Wrong file? Undo the import"
  under the summary in Settings › Your data, for OPML files and YouTube
  subscriptions alike. It takes away exactly what that import added (the
  feeds it followed, the folders it made, and the folders it put feeds
  already followed into) and nothing that was there before.
- **Mark all as read's Undo outlives the list** (SPEC section 8). Its note
  names the list ("Marked 3 articles as read in Reading Room.") and
  follows the reader to the next list, or waits on `u` if they closed it,
  until they do something else that can be undone. Other list actions
  (a star, Mark unread) keep their Undo until the list is left, as before:
  without the article's name, their note would mean nothing elsewhere.

**Why.** Undo beats "Are you sure?", and each of these was a one-way door
that cost far more than the slip: connecting an assistant again means its
connector settings and the connect page; a wrong file meant dozens of
unsubscribes; a list marked read by mistake was usually noticed one step
later, in another list, when Undo had already gone.

**How.**

- *Disconnect:* `assistant_connections.disconnected_at` (migration 0048).
  Every ticket check (`Assistant` in `assistants.rs`, and swapping a
  refresh ticket) refuses a disconnected connection; `POST
  /api/assistants/{id}/reconnect` clears it within ten minutes. The line is
  deleted for good, tickets and all, after that, or at the reader's next
  disconnect (Undo reverses the last action only), or when the same
  assistant is connected again from scratch. The Settings handlers moved
  to `server/src/assistants/settings.rs`.
- *Import:* `follow_all` records what it added; the reader's last import
  that added something is held in memory only (`subscriptions::Imports`,
  ten minutes), and `POST /api/opml/undo` takes it away in one
  transaction: out of folders that were there before first, then the
  feeds cleared at once (`folders::hide` and `clear`: a star stays, as on
  every unsubscribe), then the folders it made, if nothing else is in
  them. Held in memory, so a restart (a new version going live) makes it
  "too late", which the line says plainly; every feed can still be
  unsubscribed from as usual. Nothing new is stored, and the client never
  says what to remove: the server only removes what it recorded.
- *Mark all as read:* `web/src/lib/lastMarkAll.ts` keeps the last Mark all
  as read with its articles, which `ItemList.svelte` hands to the next list
  it makes; any other undoable action, an Undo, or a notice arriving with
  its own Undo (unsubscribing, deleting a folder) ends it. Undo there marks
  the articles unread on that list's rows too, and the sidebar follows.
