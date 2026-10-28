# 11. Background fetching (being polite to publishers)

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- The server checks feeds in the background, each on its own rhythm: often for frequent publishers, rarely for quiet blogs. Never more often than every 30 minutes, and at least once a day.
- Checks are spread out over time, never all at once.
- It tells the publisher what it already has (using "ETag" and "Last-Modified", standard web labels), so unchanged feeds cost them almost nothing.
- It identifies itself clearly as nine turtles.
- If a publisher says "slow down" (HTTP 429, or 503 with a time), it waits as long as asked, up to a week (so a mistaken answer can't silence a feed for good).
- Each fetch has a time limit and a size limit.
- If a feed has moved permanently, nine turtles updates its stored address.
- A failing feed is retried less and less often (twice as long after each failure, up to once a day) and never affects other feeds. A feed that keeps failing still looks normal in the sidebar; it simply shows nothing new.
- It never visits article pages.
- **Feeds nobody opens are checked once a day** (decision 0090): a reader is *away* once nine turtles hasn't seen them for 30 days (no device of theirs opened it, no other app synced). A feed whose every follower is away is checked at most once a day. When one of them comes back (opens nine turtles, signs in or syncs), their feeds that are working are checked again straight away, a few at a time as always, unless a feed was checked in the last 30 minutes or a follower chose Hourly or Daily for it.
- **A feed can be checked less often** (decision 0082): Edit feed's **Check for new articles: Automatic · Hourly · Daily**. Automatic is the rhythm above; Hourly and Daily check that feed no more often than once an hour or once a day, for feeds that post a lot. Choosing a longer wait applies at once. WebSub announcements still arrive as they come.
- If a publisher edits an article you've already seen, the text is updated quietly and it stays read.
- The same article published in two different feeds appears in both.

**How to check it**
Most of this is checked by the automatic tests rather than by eye. You can see it working:
1. Leave the app closed for a day, then open it: the feeds you follow have new articles that arrived on their own.
2. When a feed keeps failing for three days or more, the daily check mentions it ("Some feeds keep failing"), without naming it; the feed health page (section 17) names it.
