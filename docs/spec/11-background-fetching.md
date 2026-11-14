# 11. Background fetching (being polite to publishers)

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- The server checks feeds in the background, each on its own rhythm: often for frequent publishers, rarely for quiet blogs. Never more often than once an hour, and at least once a day (decision 0161).
- If the publisher says how long its feed stays the same (`Cache-Control: max-age`), the next regular check waits at least that long, up to a day. Two things can still bring it forward to an hour after the last check, since the value isn't stored: the publisher's own WebSub hub announcing a change, and a reader coming back after a month away.
- Two feeds on the same site are never checked at the same moment: they take turns. Sites that share a host (every blog on one platform, like Bear Blog) take turns too.
- Checks are spread out over time, never all at once.
- It tells the publisher what it already has (using "ETag" and "Last-Modified", standard web labels), so unchanged feeds cost them almost nothing.
- It identifies itself clearly as nine turtles, with a link to a page for publishers (nineturtles.app/publishers) that explains all of this and how to ask for something different.
- If a publisher says "slow down" (HTTP 429, or 503 with a time), it waits as long as asked, up to a week (so a mistaken answer can't silence a feed for good).
- Each fetch has a time limit and a size limit.
- If a feed has moved permanently, nine turtles updates its stored address.
- A failing feed is retried less and less often (twice as long after each failure, up to once a day) and never affects other feeds. A YouTube feed YouTube answers "not found", a server error or nothing is the exception: it's asked again within 3 to 6 hours, at a random time, so it doesn't keep landing in the same spell of YouTube refusing (decision 0273). A feed that keeps failing still looks normal in the sidebar; it simply shows nothing new.
- It never visits article pages.
- **Feeds nobody opens are checked once a day** (decision 0090): a reader is *away* once nine turtles hasn't seen them for 30 days (no device of theirs opened it). A feed whose every follower is away is checked at most once a day. When one of them comes back (opens nine turtles or signs in), their feeds that are working are checked again straight away, a few at a time as always, unless a feed was checked in the last hour.
- **Every feed is checked on its own rhythm** (decision 0183): Edit's "Check for new articles: Automatic · Daily" went in the owner's core path (point 11), with what readers had chosen.
- If a publisher edits an article you've already seen, the text is updated quietly and it stays read.
- The same article published in two different feeds appears in both.

**How to check it**
Most of this is checked by the automatic tests rather than by eye. You can see it working:
1. Leave the app closed for a day, then open it: the feeds you follow have new articles that arrived on their own.
2. When a feed keeps failing for three days or more, the daily check mentions it ("Some feeds keep failing"), without naming it; the top of Everyone you follow (a row in the sidebar, under All articles; on a phone, on Home), section 15, names it.
