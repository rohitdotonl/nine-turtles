# 0073: Saved searches in the sidebar

*25 October 2026. Built in V2 at the owner's request (planning thread of 25 October 2026).*

**Decision.** A search can be saved under a name and opened again from the
sidebar, where saved searches are listed under a small **Saved searches**
heading. It's built on the search that already exists: no new library and
no new kind of search.

**Choices made along the way** (the spec left them open):

- **Where in the sidebar:** right under Unread, Starred and All, before the
  folders, because a saved search is a view across feeds, like those three.
  The heading shows only once there's a saved search, so nothing moves for
  a reader who never saves one (principles 5 and 6). Saved searches are
  listed A to Z, like everything else there, each with a small search icon
  in the icon column and **no unread count** (counts stay on feeds and
  folders only, as the Exceptions log says).
- **How you save one:** **Save search…** in the list's More (…) menu while a
  search shows results. It opens a sheet like Edit folder: a Name, started
  from the searched words (or the chips, "In Tech, Unread"), and a line
  saying in words what it searches for. Opening a saved search
  (`/searches/3`) shows its results under its name, with its chips and
  words in the search field, so it's always clear what it looks for.
- **Changing one:** on a saved search, More has **Edit saved search…**:
  rename it, and Save keeps whatever the search field holds now, so you
  change its chips, then save. Escape puts the field back as it was saved.
  **Delete** removes only the search, never an article, with Undo straight
  afterwards (it's saved again), as deleting a folder is.
- **What's kept:** the search field's own description (words, where it
  searches, Unread, Starred and dates), as JSON in one small new table
  (`saved_searches`, structure change 8). A date from "Past week" is kept as
  the date it was, as its chip shows it. A saved search scoped to a feed or
  folder that's since gone finds nothing rather than quietly searching
  everything.
