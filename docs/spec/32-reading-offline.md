# 32. Reading offline

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

*Built 26 October 2026 (decision 0101): the lighter version the owner chose, words only.*

**What's kept.** While nine turtles can be reached, each device quietly keeps a copy of the reader's **first 200 unread articles** (in their sort order; in river mode, the first 200 of All) and their **newest 200 starred articles**. Only the words: each image becomes a short line, "An image shows here when you're back online", a YouTube article's player says "The video plays here when you're back online.", and a podcast episode's says "The episode plays here when you're back online." (section 35; the audio is never kept). For most readers that's a few megabytes. The copies are brought up to date when nine turtles opens, when the connection comes back, when it comes back into view after a while, and after Refresh, a few dozen at a time, a moment apart, so nothing waits for them. Nothing extra is fetched from publishers.

**Without a connection**
- nine turtles opens as usual, signed in (on an iPhone, reliably once it's added to the home screen: in a Safari tab the phone may clear the copies after about a week without a visit).
- Unread, Starred, All, each feed and each folder list the kept articles, with a quiet line above the list: "Offline. Showing the articles saved on this device." Such a list ends with "That's everything saved on this device."; one with nothing kept says "Nothing here is saved on this device. It will show when you're back online." The sidebar shows the feeds and folders as they were last seen, its counts following what's marked here.
- Articles open from their copy. One that isn't kept says "This article isn't saved on this device. It opens when you're back online."
- **Reading, marking read or unread, and starring work as usual**, with nothing said: each mark waits on the device and is sent once the connection is back. Each says when it was made, and **the latest mark wins**: a mark made offline at 10:00 doesn't undo one made on another device at 11:00. Undo works too.
- **What waits for a connection says so:** search ("Search needs a connection. It works again once you're back online."), adding a feed ("Adding a feed needs a connection. Try again once you're back online."), Settings ("Settings need a connection. They open once you're back online."), Refresh ("Refresh needs a connection. This is what's saved on this device."), Catch me up, Recently read ("Recently read needs a connection. It shows once you're back online."; section 5) and collections: the sidebar still lists them, as last seen, and opening one says "Collections need a connection. They show once you're back online." (section 34). Add to collection… needs a connection too; its sheet says it couldn't load. So does Up Next ("Up Next needs a connection. It shows once you're back online."; section 35).

**Switching it off, and privacy**
- Settings › Your data › **Keep articles for reading offline**, a switch, on by default on phones and computers alike. It's for that device only; switching it off deletes its copies at once, after sending any marks still waiting. Without a connection, Settings shows only this switch under its line.
- **Signing out deletes the copies**, after sending any marks still waiting, as does being signed out any other way (an expired sign-in, a deleted account), so nothing is left on a shared computer.

**How it works:** the copies live in the browser's own database for nine turtles (IndexedDB), in `web/src/lib/offline.ts`; the server gives up to 50 at once, words only, at `GET /api/articles/several?ids=…`. Each reader's entries remember when the read mark and the star were last set, and a late mark older than that changes nothing (ENGINEERING.md → "Data", decision 0101).

**How to check it**
1. Open nine turtles online and wait a minute. Switch on airplane mode.
2. Open Unread and Starred: the line says "Offline. Showing the articles saved on this device." and your articles are there. Open one: its words are there, with a short line where each image was.
3. Read one, star another, mark one unread. Nothing complains.
4. Try search, Add feed, Settings and Refresh: each says it needs a connection.
5. Close nine turtles and open it again, still in airplane mode: it opens with the same articles.
6. Switch airplane mode off. On another device (or after a reload), the marks from step 3 are there.
7. Sign out, then switch airplane mode on and open nine turtles: it says it can't be reached, because the copies are gone.
