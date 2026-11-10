# 0194: Following someone brings their newest five into Unread

**In one line:** Following someone brings only their newest five articles into Unread; older ones are in their own list, already read; the same for imported files, at each feed's first check

*6 November 2026.*

**Decision.** When a reader follows a feed, only its five newest articles
arrive unread. Everything older that the feed still lists is stored and
shown in that feed's own list, already read. Everything published after
following arrives unread, however much (owner, 6 November 2026, choosing
option A of the onboarding review with five instead of three).

**Why.** A feed often lists ten to a hundred past posts. Following a few
people at once used to pour hundreds of old posts into Unread, which made
a calm, finite place feel like a backlog on day one ("nothing pulls").
Five is enough to get to know someone; the rest is one click away on their
page.

**How.**
- Every way of following through the app goes through the same adding path
  (`feeds::adding::follow`): + Add, the welcome's starters, Follow from
  anywhere, + Add another place and an assistant's `add_feed`. After the
  feed's articles are entered, `feeds::keep_newest_unread` marks the rest
  read. "Newest" is the list's own order (date, then number), so the five
  unread are the five at the top of their list. Rules act first, so a muted
  article doesn't take one of the five.
- An imported file (OPML or YouTube's Takeout) fetches nothing. A feed
  another reader already follows gives the reader its newest five stored
  articles unread (`feeds::enter_newest`); before, it gave none. A feed new
  to this nine turtles is trimmed to five at its first successful check
  (`checking`, when `fetched_at` is still empty).
- Undo of an unsubscribe still brings the feed back exactly as it was, and
  Find new address (moving a feed) is unchanged: neither is a new follow.
- Only readers following the feed right now are trimmed: a reader waiting
  for Undo, or one who left long ago, keeps their marks (decision 0086), and
  a starred article is never touched.
- Nothing changes for feeds already followed: no stored data is touched.
