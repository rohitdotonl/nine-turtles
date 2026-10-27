# 0105: Recently read, hiding sidebar lists, and how often a feed posts

*27 October 2026.*

**Decision.** Three small things the owner asked for, built together (SPEC
sections 5, 15, 17 and 18).

1. **Recently read** (`/recent`), a fixed list in the sidebar after All, with
   a clock whose rim turns back (a history sign, so it isn't confused with
   Let unread go's plain clock face) as its icon: the last 50 articles the
   reader opened, the one opened last first.
   - **Opened** means the reading area showed it (or its page opened on the
     publisher's site, for a feed set to do that), whether that marked it
     read or it was read already. The app tells the server each time
     (`POST /api/articles/opened`).
   - **Stored** on the reader's own entry for the article (`entries.opened_at`,
     milliseconds, structure change 22, with a partial index), and only for
     their latest 50 that the list can show: each new opening clears the
     oldest, and a muted article or one of a feed since left keeps no place,
     so the list always fills. A column rather
     than a table, because the entry is already walled off per reader and
     already goes when the article or the reader does. nine turtles backs
     itself up before the change, as for every structure change (decision
     0076); nothing already stored changes.
   - **Nothing about habits.** DESIGN.md's "Never" list rules out reading
     stats and streaks. Recently read is only the plain list: no count in
     the sidebar or above it, no "read today", no totals, and only the last
     opening of each article is remembered. It answers "what was that thing
     I read?", which is a book's back-flip, not a feed's pull.
   - **Not offline.** It isn't kept on the device (decision 0101): without a
     connection it says it needs one, in the same words as search. Articles
     opened offline don't join it. This was simpler and honest; showing a
     stale copy could look like the latest.
   - Its More menu has only Refresh; it never says "New items"; searching
     from it searches everything. `g` then `r` opens it (decision 0110).

2. **Show in the sidebar**, a group in Settings after Reading: tick boxes for
   Starred, All, Recently read and Saved searches, all ticked by default.
   Unread, folders and feeds can't be hidden, and All stays in river mode,
   where it's home. Stored in `person_settings` as `hidden`, so it follows
   the reader to every device; each device remembers the last answer, so the
   lists don't flash before the server replies. A hidden list still opens by
   its address and by `g s` / `g a`. Placed after Reading rather than in
   Look and feel because Look and feel is this device's only, and this
   setting is shared, as Unread counts is.

3. **How often a feed posts, in words**, under the name in Edit feed (a
   field's helper line, its space kept from the start so nothing moves) and
   in each listed feed's quiet line on the feed health page. Worked out on
   the server when asked, never stored, from the feed's articles of the last
   90 days, by `sort_at` (the published time, or the arrival time if the
   feed gives none; it uses the `articles_newest_by_feed` index directly).
   - The rate is counted over 90 days, or the feed's own history if shorter.
     Rounded to the nearest whole: "about 12 a day", "about once a day",
     "about 3 times a week", "about twice a month", "about once a month",
     "less than once a month".
   - Nothing in 90 days: "Hasn't posted in 4 months"; from a year on, only
     "Hasn't posted in over a year", because the yearly clean-up (decision
     0089) may have removed later posts, and a surviving starred article
     could overstate the silence. A feed with no articles left (emptied by
     the clean-up) is counted from when nine turtles started fetching it
     (`feeds.added_at`), so Feed health never calls a long-dead feed "too
     new".
   - Fewer than 3 articles, or under two weeks since its oldest: "Too new to
     tell".
   - No chart, no decimals, no judgement ("quiet", "busy"): the words describe,
     they don't nudge the reader to unsubscribe.

**Why.** The owner asked for all three. Each passes DESIGN.md's rules about
the rules: no floor touched, nothing that pulls the reader back, nothing
that moves on its own, and the power (hiding lists) is in Settings, out of
the way.
