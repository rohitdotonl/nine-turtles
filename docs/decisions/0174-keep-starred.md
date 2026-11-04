# 0174: Keep Starred, remove the other shelves

*4 November 2026. Step 9 of the owner's review plan. Rohit said go on the
whole plan and permitted removing these features and their data, with the
data path below. The plan settled its one question: the Notes list stays.*

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
- **The data path (structure change 40):** every article on any of a
  reader's collections gets that reader's star, so it stays kept forever
  and easy to find; one already starred keeps its star. The collections'
  names and lines stay in the database, unused, and Settings › Your data
  keeps **Export collections** for a while, for anyone who wants the list.
  Saved searches stay in their table as the remembered words they are.
  Recently read was worked out from what was opened (`entries.opened_at`),
  which stays too; nothing new is noted. Nothing is deleted. Since a
  collection's line still points at its entry, the yearly clean-up and
  unsubscribing still leave those articles (decision 0108's rule stays in
  the database).
- **Folders:** deleting a folder (or making it one person) no longer
  answers saved searches, so its Undo hands back only its feeds; the
  assistants' `delete_folder` and `create_folder` lose `search_ids`.
- **Fixed on the way:** Settings › Show in the sidebar offered Notes, but
  the server didn't know the word, so hiding Notes couldn't be saved. It
  can now.
- **Later:** when the unused collections, saved searches and opening times
  can be deleted for good is Rohit's call (the plan's "Later" row).
