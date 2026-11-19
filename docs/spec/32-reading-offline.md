# 32. Reading offline

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

*Built 26 October 2026 (decision 0101): the lighter version the owner chose, words only.*

**What's kept.** While nine turtles can be reached, each device quietly keeps a copy of the reader's **first 200 unread articles** (in their sort order; with Unread off, the first 200 of All articles) and their **newest 200 saved articles**. Only the words: each image becomes a short line, "An image shows here when you're back online", a YouTube article's player says "The video plays here when you're back online.", and a podcast episode's says "The episode plays here when you're back online." (section 35; the audio is never kept). For most readers that's a few megabytes. Online too, a kept article whose copy is its whole text (it has no pictures) opens from the copy at once, and the server's version, with any highlight made elsewhere, replaces it quietly (decision 0314). The copies are brought up to date once nine turtles has opened (when the browser is next idle, so the reader's first taps never wait for them), when the connection comes back, when it comes back into view after a while, and after Refresh, a few dozen at a time, a moment apart, so nothing waits for them. Nothing extra is fetched from publishers.

**Without a connection**
- nine turtles opens as usual, signed in (on an iPhone, reliably once it's added to the home screen: in a Safari tab the phone may clear the copies after about a week without a visit).
- Unread, Saved, All articles, each feed and each folder list the kept articles, with a quiet line above the list: "You're offline. Showing the articles kept on this device." Such a list ends with "That's everything kept on this device."; one with nothing kept says only "You're offline. Nothing here is kept on this device; it shows once you're back online." The sidebar shows the feeds and folders as they were last seen, Unread's dot following what's marked here.
- Articles open from their copy. One that isn't kept says "You're offline. This article isn't kept on this device; it opens once you're back online."
- **Reading, marking read or unread, and saving work as usual**, with nothing said: each mark waits on the device and is sent once the connection is back. Each says when it was made, and **the latest mark wins**: a mark made offline at 10:00 doesn't undo one made on another device at 11:00. Undo works too.
- **What waits for a connection says so:** each starts with why (BRAND.md → "Messages"): search ("You're offline. Search works again once you're back online."), adding a feed ("You're offline. Adding a feed works again once you're back online."), Settings ("You're offline. Settings open once you're back online."), Refresh ("You're offline. This is what's kept on this device."). Everyone you follow says "You're offline. Everyone you follow shows once you're back online." and shows them by itself once the connection is back; Not working says nothing until then.
- **Online, but nine turtles doesn't answer at all** (an outage, or a fault on the way; a "busy" answer isn't this, and a list then says it couldn't be loaded, with Try again): the same, with the kept articles, but every line starts "nine turtles can't be reached right now." and ends "…once it's back" instead, because the reader's connection is fine (decision 0312). "You're offline." is said only when the device itself says it has no connection.

**Always on, and privacy**
- Keeping articles is always on, on phones and computers alike, with no switch (decision 0187; it was Settings › Your data › Keep articles for reading offline). Without a connection, Settings shows only its line.
- **Signing out deletes the copies**, after sending any marks still waiting, as does being signed out any other way (an expired sign-in, a deleted account), so nothing is left on a shared computer. When another reader signs in on the device without passing the sign-in page (an emailed sign-in, new-password or new-email link), the last reader's copies, waiting marks, chosen keys and player go before anything is shown or sent: their marks are never saved as the new reader's. A tab the last reader left open can't send anything as the new reader either: nine turtles refuses what it sends (its waiting marks included), and the note at the bottom of its list says "Someone else signed in on this browser. Reload to continue." with **Reload**. A mark that tab leaves waiting on the device is never sent by the new reader's tabs.

**How it works:** the copies live in the browser's own database for nine turtles (IndexedDB), in `web/src/lib/offline.ts`; the server gives up to 50 at once, words only, at `GET /api/articles/several?ids=…`. Each reader's entries remember when the read mark and the saved mark were last set, and a late mark older than that changes nothing (ENGINEERING.md → "Data", decision 0101).

**How to check it**
1. Open nine turtles online and wait a minute. Switch on airplane mode.
2. Open Unread and Saved: the line says "You're offline. Showing the articles kept on this device." and your articles are there. Open one: its words are there, with a short line where each image was.
3. Read one, save another, mark one unread. Nothing complains.
4. Try search, + Add, Settings and Refresh: each says you're offline and what that means there.
5. In a computer's browser, block nine turtles' address in its developer tools (the device stays online) and reload a list: it says "nine turtles can't be reached right now. Showing the articles kept on this device.", never "You're offline.".
5. Close nine turtles and open it again, still in airplane mode: it opens with the same articles.
6. Switch airplane mode off. On another device (or after a reload), the marks from step 3 are there.
7. Sign out, then switch airplane mode on and open nine turtles: it says it can't be reached, because the copies are gone.
