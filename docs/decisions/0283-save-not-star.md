# 0283: Star became Save

**In one line:** What readers and assistants see says **Save** and **Saved** (with a bookmark) instead of Star and Starred; old addresses, old assistant tool names and old arguments still work, and inside the app the mark keeps its first name, `starred`.

*16 November 2026. The owner said Star didn't feel nice and asked for Save/Saved, everywhere.*

**Why.** A star reads as rating something, but readers use it to keep an
article to come back to. Save says exactly that, and a bookmark is the
shape everyone knows for it.

**Decision.**
1. **The words.** The article's button is **Save** (a bookmark, an outline,
   filled while saved; one name for screen readers, pressed or not; its
   tooltip says "Remove from Saved (S)" while it's saved). The list is
   **Saved**. A row's menu says **Save** or **Remove from Saved**; a row
   swiped all the way left says **Save** or **Unsave** (short, as the swipe's
   Read and Unread are); the keys list says "Save / unsave". The note says
   "Saved." or "Removed from Saved." with Undo. The key stays `s`, and
   `g` then `s` still goes to the list. Everything else follows: empty list,
   search, import, download (`saved.json`), Help, the website's pages.
2. **Offline says "kept".** "Showing the articles kept on this device" (it
   said "saved"), so "saved" means only the Saved list.
3. **Old addresses.** `/starred` opens Saved and the address becomes
   `/saved`; the Help page `/help/star-an-article/` sends readers to
   `/help/save-an-article/`.
4. **Assistants (MCP).** `tools/list` names `save` (argument `saved`) and
   `list_saved`, and articles carry `saved`. An assistant that learned the
   old names keeps working: `star`, `list_starred` and the `starred`
   argument are still answered, though no longer listed. That is the usual
   way to rename a tool: list only the new name, keep answering the old one.
5. **Inside stays `starred`.** The database column, the server's own
   addresses (`/api/articles/starred`), the views' key, offline copies and
   the code keep the first name. Renaming them would touch the database and
   every device's saved copies for no difference a reader sees; the one
   rule is that whatever a reader or an assistant sees says Save.

**Revisit if** the internal name starts to mislead the next agent more than
a rename would cost.

**Also.** A note's box said **Save** too, right beside the article's Save
at its end, so its button now says **Save note**: two buttons with one
name on one screen is a puzzle for a screen reader.
Renaming someone said "Saved." under their name too; it now says "Name
changed.", so "Saved." only ever answers saving an article.
