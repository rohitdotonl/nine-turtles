# 12. WebSub (instant updates from publishers who offer it)

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

*Built in V2 (25 October 2026, decision 0069).*

**What it does**
- Some publishers announce new articles the moment they publish, through a service called a "hub" (the standard is called WebSub). When a feed names a hub, nine turtles signs up with it, and the hub sends each new article to nine turtles as it's published.
- Nothing on screen changes: new articles wait for the reader as always ("New articles · press r", section 13). They simply arrive sooner.
- nine turtles checks that announcements are genuine: each feed's subscription has its own secret, and an announcement without the right signature is ignored.
- Subscriptions are renewed a day before they expire (halfway through a short one). A hub that never confirms is asked again once a week.
- Regular checking continues as a backup, at most twice a day while the hub delivers.
- It only works where hubs can reach nine turtles: the live app, at `https://app.nineturtles.app` (the setting `NINE_TURTLES_PUBLIC_URL`). A copy running on a computer without it checks feeds as before.

**How to check it**
1. Follow a blog that uses WebSub: most blogs on WordPress.com or Blogger do, and so does a YouTube channel's feed.
2. When it publishes, "New articles · press r" appears within a few minutes rather than hours.
