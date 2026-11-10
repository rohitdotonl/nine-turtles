# 0172: Unread, on or off

**In one line:** Unread, on or off: Inbox and River go as names; Settings › Reading has one switch, Unread (on is the old inbox, off the old river); a single feed's River goes; readers on River get Unread off, and each feed set to River has its unread marked read once (structure change 38)

*4 November 2026. Step 7 of the owner's review plan. Rohit said go on the
whole plan and permitted removing these features and their data, including
the one-time data path below. The plan's open question (does a single
feed's River go too?) was settled by its suggestion: yes.*

**Why.** "Inbox" and "River" were two names to learn for one idea: is there
an Unread list or not? A feed could also be set to River on its own, a
third thing to explain. One plain switch says it all.

**Decision.**

- **Settings › Reading › Unread**, a switch (as Apple draws one, decision
  0077), on by default. On is what inbox mode was: the Unread list, read
  styling and the sidebar's dots. Off is what river mode was: none of those,
  the app opens on All, and read state is still recorded quietly. Its
  description says which ("An Unread list, and a dot where something is
  new." / "No Unread list and no dots. What you've read is still
  remembered."). Everything else river mode did stays the same with Unread
  off (SPEC section 10).
- **A single feed's River goes**, from Edit and a source's settings, with
  its column (`subscriptions.river`) and its handling in Unread, search,
  the sidebar's dots and the assistants' `list_feeds` (`flows_past`).
- **Stored as** `unread` in `person_settings`, `off` or `on`; nothing stored
  means on. The API's `mode` (`inbox` / `river`) becomes `unread`
  (`true` / `false`). Each device remembers it as `nine-turtles.unread`; the
  old `nine-turtles.mode` is deleted, not read.
- **The data path (structure change 38):** readers on River get Unread off;
  everyone else on. For each feed a reader had set to River, its unread
  articles are counted as read once, as they already looked, so Unread
  doesn't suddenly fill. Then the `mode` settings and the `river` column
  are deleted. Nothing else changes; every article stays in its feed, All
  and search. nine turtles backs itself up before the change (decision
  0076).
- **The Help page** moves from /help/inbox-or-river/ to
  /help/unread-on-or-off/, the old address sending readers on.

Replaces the names in decision 0068 (its behavior stays, as Unread off) and
the per-feed reading mode in decision 0082 (its other settings stay).
