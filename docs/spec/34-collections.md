# 34. Collections

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

*Built 27 October 2026 (decision 0108), as the owner approved.*

**What it does**
- **Collections** are your own named shelves for articles, such as "To cite" or "Recipes", as Apple Books has collections of books. An article can be on several. They're yours alone: another reader on the same nine turtles never sees them, and can use the same names for their own. Stars stay a separate thing (section 9).
- **Adding an article:** the article's More (…) menu has **Add to collection…**, and `l` does the same for the open or selected article. It opens a sheet, "Add to collection", built like Edit feed's folders: your collections as rows (44px) ending in square tick boxes, ticked where the article already is, and **New collection…** as the last row, a text box ("Optional: a new collection is made when you save, with this article on it."). **Save** puts the article on exactly the ticked collections (and the new one, if you named one); **Cancel** or Escape changes nothing, and the keyboard goes back where it was. Unticking takes the article off a collection; the article itself stays where it was. If Save took it off any collection, the list's quiet line says "Took the article off Recipes" (or "… off 2 collections") with **Undo**, as other removals do: an article kept only by a collection would otherwise be left to the yearly clean-up. Undo puts it back on them. Inside a collection, an article you take off it keeps its row until the list is next loaded (nothing moves unless you move it). Two collections can't share a name ("There's already a collection with that name."). On a phone it's the same sheet, over the article.
- **In the sidebar,** under Saved searches (section 5), A to Z, each with a small shelf of books and no count. It can be hidden in Settings › Show in the sidebar.
- **Opening one** (`/collections/3`) lists its articles like any list: by each article's date, in your sort order (newest first unless you chose oldest first), 50 at a time. Its name is the list's title. It also lists muted articles and articles of feeds you've since unsubscribed from, as Starred does: you put them there. Nothing arrives on a collection by itself, so it never says "New articles". Empty, it says what collections are for: "Nothing in this collection yet. Articles you put here stay, even after a year. Add one from an article's More menu."
- **Its More (…) menu** has, after Mark all as read, Refresh and the sort order, **Rename…** (a sheet with its name, Cancel and Save) and **Delete**. Delete removes the collection and deletes no article at once, and takes you to Unread (All in river mode) with "Deleted the collection …" and **Undo**, which brings it back with the same articles on it, and your saved searches limited to it limited to it again. An article that only that collection kept (of a feed you've since unsubscribed from) is then found only by search, and the yearly clean-up removes it once it's over a year old, unless it's starred or on another collection.
- **Kept forever:** an article on any of your collections is never removed by the yearly clean-up (section 23), and unsubscribing from its feed keeps it, as it keeps starred ones: it stays on its collections and in search. Taking it off every collection (or deleting the collection) lets the clean-up treat it as usual again.
- **Search:** `in:name` searches one collection (section 14).
- **Exports:** Settings › Your data › **Export collections** (section 23).
- **Offline:** the sidebar lists your collections as last seen; opening one says it needs a connection (section 32).
- The article's byline doesn't list its collections: the sheet shows them in one press.

**How to check it**
1. Open an article and press `l`. Type "Recipes" in New collection… and press Enter. "Recipes" appears in the sidebar under Collections.
2. Open another article, choose More › Add to collection…, tick Recipes and Save.
3. Choose Recipes in the sidebar: both articles are there, newest first, with no number anywhere.
4. In Recipes, More › Rename…: call it "Soups" and Save. The sidebar follows.
5. More › Delete: you're back at Unread with "Deleted the collection Soups"; both articles are still in their feed. Press Undo: Soups is back with both articles.
6. Unsubscribe from the feed of an article on Soups: after the Undo has passed, the article is still in Soups.
7. In Soups, open an article, press `l`, untick Soups and Save: the line at the foot of the list says "Took the article off Soups" with Undo, and the article's row stays until you reload. Press Undo: it's on Soups again.
8. Sign in as another reader: none of these collections are there.
