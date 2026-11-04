# 0170: Fewer settings in the way: no Change keys, no Up Next

*Up Next's table and readers' old keys were deleted by [0174](0174-keep-starred.md).*

*3 November 2026. Step 5 of the owner's review plan. Rohit said go on the
whole plan and permitted removing these features and their data; the owner's
critique thread, deciding for him, approved the removal and the one new line.*

**Why.** Both were settings in the way of reading. Choosing keys of your own
(decision 0110) made the `?` list a place to edit, and every tooltip, menu and
tip depend on a per-reader table, for a need nobody had. Up Next (decision
0113) was a second list to tend, a sidebar row that came and went, and an
episode starting by itself when another ended: something pulling at you.

**Decision.**

- **Every shortcut stays; nobody can change them.** The `?` list only lists.
  Settings › Keyboard goes. A reader who had chosen keys is told once, at the
  list's foot: "You can't choose your own keys any more, so every shortcut is
  back to the key shown here. If you miss it, write to hello@nineturtles.app."
  Seeing it deletes their old `keys` row in `person_settings`.
- **Up Next goes.** You play the episode you opened; when it ends it says
  "Finished." and nothing else starts. The player, the Now playing bar, the
  lock-screen controls and your place in each episode stay. Up Next leaves
  the sidebar, the episode's More menu, the player and Settings › Show in the
  sidebar, and `/api/up-next` and `view=upnext` are gone.
- **The `up_next` table stays, unused** (no structure change), as the plan
  says, until the owner says the old data can go. Every episode in it is
  still in its podcast's list.

Replaces the key-changing part of decision 0110 (its new keys stay) and the
Up Next part of decision 0113.
