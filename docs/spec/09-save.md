# 9. Save

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- One concept: **Save** (decision 0281; it was called Star until then). `s` (or the **Save** button, a bookmark, in the article's toolbar) saves the current item or takes it out of Saved. It can be undone like the other marks (section 8): "Saved." or "Removed from Saved.", with Undo.
- Saved items appear in the **Saved** list and are kept forever.
- Saved is the one shelf (decision 0174): collections are gone.
- The words: the button is **Save** (one name for screen readers, pressed or not; the filled bookmark shows it's saved, and its tooltip says "Remove from Saved (S)" while it is). A row's menu says **Save** or **Remove from Saved**; a row swiped all the way left says **Save** or **Unsave**; the keys list says "Save / unsave". Starred's old address (`/starred`) opens Saved, at `/saved`.
- Inside the app (the database, the server's own addresses and the code), the mark keeps its first name, `starred` (decision 0281): only what readers and assistants see changed.

**How to check it**
1. Save an article: the bookmark fills, a small filled bookmark appears on its row, and it shows up under Saved.
2. Press Save again: it leaves Saved, with "Removed from Saved." and Undo.
3. Open `/starred`: Saved opens, and the address becomes `/saved`.
