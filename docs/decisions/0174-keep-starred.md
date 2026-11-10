# 0174: Keep Starred, remove the other shelves

**In one line:** Keep Starred, remove the other shelves: Collections, saved searches and Recently read go (sidebar, Settings, search `in:`, keys `l` and `g r`, their addresses) and their data is deleted outright, as are earlier leftovers (Up Next, switched-off rules, old keys), since nine turtles is still being built; the Notes list stays (structure change 40)

*4 November 2026. Step 9 of the owner's review plan. Rohit said go on the
whole plan and permitted removing these features and their data; on the
day, he chose to delete the data outright. The plan settled its one
question: the Notes list stays.*

**Why.** "Just keep Starred and remove other fluff." Three shelves did one
job: keeping what you want to come back to. Starred does it in one press,
and is already kept forever. Collections, saved searches and Recently read
each added a sidebar section, a Settings row, sheets and keys to learn.

**Decision.**

- **Gone:** Collections (the sidebar section, Add to collection… and `l`,
  Rename and Delete, `/collections/3`, `in:` in search and the search
  options' Collections group), Saved searches (Save search…, Edit saved
  search…, the sidebar section, `/searches/3`) and Recently read (the
  sidebar list, `g r`, `/recent`, its day headings, and noting which
  article was opened). Their rows leave Settings › Show in the sidebar,
  which keeps Starred, Notes and All. Old addresses lead to "Wrong turn?".
- **Stays:** Starred, exactly as it is, and the Notes list (a highlighted
  line becomes the first line of a letter, decision 0164).
- **The data (structure change 40):** nine turtles is still being built,
  so the owner chose to act as if there were no readers and no data yet
  (4 November 2026): the removed features' data is deleted outright, with
  nothing carried over and no export. The `collections`,
  `collection_articles` and `saved_searches` tables and the opening times
  (`entries.opened_at`) go. So does what earlier steps had left unused:
  the `up_next` table (decision 0170), the rules step 8 switched off
  (decision 0173) and readers' old keys (decision 0170), with any backlog
  or reading-mode settings left from steps 6 and 7. Stars, notes and
  marks are untouched. The backup before every structure change
  (decision 0076) still holds everything as it was. With the old keys
  gone, the `?` list's one-time line about them goes too.
- **Folders:** deleting a folder (or making it one person) no longer
  answers saved searches, so its Undo hands back only its feeds; the
  assistants' `delete_folder` and `create_folder` lose `search_ids`.
- **Fixed on the way:** Settings › Show in the sidebar offered Notes, but
  the server didn't know the word, so hiding Notes couldn't be saved. It
  can now.
