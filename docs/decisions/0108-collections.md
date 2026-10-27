# 0108: Collections, the reader's own shelves for articles

*27 October 2026.*

**Decision.** Readers can put articles on **collections**: named shelves of
their own ("To cite", "Recipes"), as Apple Books has collections of books.
The owner approved the design "as suggested" on 27 October 2026 (SPEC
section 34), including keeping collected articles like starred ones
(point 6), which changes the Data rules (ENGINEERING.md) and the floor's
wording in AGENTS.md.

1. **What they are.** A name and a set of the reader's articles. An article
   can be on several. Each reader's collections are theirs alone (decision
   0086): names are unique per reader whatever their capitals, and every
   request reads and changes only the signed-in reader's lines (tested in
   `server/tests/collections.rs`). **Stars stay separate**: starring and
   collecting are two different things, and neither changes the other.
2. **Putting an article on one.** The article's More menu has **Add to
   collection…**, and the key **l** does the same for the open or selected
   article. It opens a sheet built like Edit feed's folders (decision 0045):
   the reader's collections as 44px rows ending in square tick boxes, ticked
   where the article already is, and **New collection…** as the last row, a
   text box. Save puts the article on exactly the ticked ones; Cancel or
   Escape changes nothing. Taking an article off a collection never removes
   the article, but it can leave one kept only by that collection (say of a
   feed since unsubscribed) to the yearly clean-up, so a Save that took the
   article off any collection is followed by the list's quiet line, "Took
   the article off Recipes" (or "… off 2 collections"), with **Undo**, as
   other removals are; Undo puts it back on those, keeping whatever else
   it's on by then. Inside a collection, an article taken off it keeps its
   row until the list is next loaded (nothing moves unless you move it). On
   a phone it's the same sheet over the article, not a
   screen of its own (the "one phone sheet" build is for the sheets that
   have an address; this one belongs to the article on screen, as the Aa
   panel does). `l` was free, and sits beside `s` (star) and `m` (unread) as
   another thing done to the article in hand.
3. **In the sidebar,** under Saved searches and before Folders, A to Z, under
   a small **Collections** heading, each with a small shelf of books in the
   icon column (drawn in the same 1.5px line as the other icons) and **no
   count**, as saved searches have none. Settings › Show in the sidebar can
   hide them (`hidden` gains the word `collections`, decision 0105).
4. **Opening one** (`/collections/3`) lists its articles **by the article's
   date, in the reader's sort order** (newest first by default), like every
   other list, not by when each was added. Chosen because it reuses the one
   list everyone already knows (the sort order in More applies, "Show older
   items" works the same), keeps no second order to explain, and makes Undo
   after deleting simple (nothing about the order is lost). Unlike All, a
   collection shows muted articles and articles of feeds since unsubscribed,
   as Starred does: they were put there on purpose. Nothing ever arrives on
   a collection by itself, so it never says "New items".
5. **Renaming and deleting** come from the collection's own More menu:
   **Rename…** (a sheet with the name, Cancel and Save) and **Delete**, which
   removes the collection and deletes no article at once, then goes home
   with "Deleted the collection …" and Undo, as deleting a saved search
   does. An article kept only by that collection (of a feed since
   unsubscribed) is then reachable only through search, and the yearly
   clean-up treats it as usual. The server answers the articles the
   collection held and the saved searches limited to it, and Undo makes it
   again with the same name and the same articles, and limits those saved
   searches to it again. Until then a saved search limited to a deleted
   collection finds nothing (`saved_searches::forget`), as for a deleted
   folder, since a new collection may get its number.
6. **Kept forever, like a star.** An article on any of the reader's
   collections is never removed by the yearly clean-up (decision 0089), and
   **unsubscribing keeps it**, exactly as it keeps starred articles: the
   reader's unstarred, uncollected entries for the feed go, the collected
   ones stay (with the subscription's line, for the feed's name) and stay
   in their collection and in search. Every place that deletes entries was
   checked: `cleanup::run`, `folders::clear` (unsubscribing, and everything
   that leads to it), `health::carry_entries_over` ("Find new address"
   carries an article's collections to its new copy) and `people::delete`
   (deleting an account empties the reader's collections first, so nothing
   of theirs is kept). As a safety net the database itself refuses to delete
   an entry a collection still points at (a foreign key with no `ON
   DELETE`), so a future deletion that forgets collections fails loudly
   rather than losing what the reader kept. Like a star, one reader's
   collection keeps the article only for that reader.
7. **Search** gains `in:name`, which limits a search to one of the reader's
   collections. It's the same "where" as `feed:` and `folder:`, so it
   becomes the same scope chip (`in: Recipes`), is suggested as it's typed,
   and the Search options' "Other feed or folder" list has the collections
   too. Searching from inside a collection starts limited to it.
8. **Exports** (SPEC section 23): Settings › Your data › **Export
   collections** gives a JSON Feed 1.1 file, built like the starred export,
   with each article's collections as the item's `tags` (JSON Feed's own
   field) and every collection's name, empty ones too, in a `_nine_turtles`
   extension. Nothing is locked in.
9. **Offline** (SPEC section 32): the sidebar still lists the collections
   (their names are kept with the device's copies, and go when it signs
   out), and opening one says "Collections need a connection. They show once
   you're back online." Keeping their articles on the device too wasn't
   trivial, so it waits.
10. **The byline doesn't list an article's collections.** It was optional;
    the byline stays the publisher's credit, quiet, and the sheet already
    shows them in one press.

**Structure change 23** adds two tables, `collections` (the reader, the
name, when made) and `collection_articles` (collection, reader, article,
when added; its line points at the reader's entry for the article). Nothing
already stored changes, and nine turtles backs itself up before the change,
as for every structure change (decision 0076). A collection's list reads its
own lines through their primary key and sorts them on the spot: a shelf is
short, and walking every entry in date order to find a few would be slower
(checked in `tests/speed.rs`).

**Why it fits.** Shelves are what a reader does with books: Apple Books'
collections are the reference (decision 0059). They are the reader's own,
quiet (no counts), never fill themselves, and add no pull to come back.
