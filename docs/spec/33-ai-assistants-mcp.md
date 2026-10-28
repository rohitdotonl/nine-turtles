# 33. Connecting your own AI assistant (MCP)

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

*Added 27 October 2026 at the owner's request (decision 0111).*

nine turtles runs no AI itself. A reader can connect their own assistant (Claude, ChatGPT, or any other that speaks **MCP**, the open standard for letting an assistant use a program's tools), so it can find, sort and tidy things for them. It's a door, like the sync API for other apps (section 26), not a feature on any screen. It follows the standard only, with nothing specific to one company.

**Connecting**
- In the assistant, the reader adds nine turtles as a connector (an "MCP server") with the address shown in Settings › Connected assistants: `https://app.nineturtles.app/mcp`.
- The assistant opens nine turtles' **"Connect … to nine turtles?"** page (signing in first if needed). It names the assistant (as the assistant calls itself, shown as plain text), lists what it will be able to do and what it won't, says feeds it unsubscribes from are kept for 30 days, that it can be disconnected any time in Settings, and which website the reader goes back to. **Connect** and **Cancel**; either goes back to the assistant. A link that isn't valid (an unknown assistant, or a return address it didn't register) says so and goes nowhere.
- Approving is the opt-in: there's no switch. Each connection is one reader's and acts only for them.
- An assistant that can't show that page uses an **assistant key** instead: **Make an assistant key** in Settings (with an optional name) shows a key starting `nt_` once, with Copy; the assistant sends it as a bearer token. nine turtles keeps only a scrambled copy.

**What an assistant can do** (its "tools")
- Read: search articles (words, author, feed, folder, starred, unread); list unread (all, a folder's or a feed's) and starred, 50 at a time; open an article (title, author, link, date, feed, and the text the feed holds, as plain text, cut after 30,000 characters; opening doesn't mark it read); list feeds and folders; list feeds that aren't working (the feed health page's list); list rules and how many articles are muted.
- Change: mark articles read or unread (up to 500 at once) and a whole feed read; star and unstar; add a feed by its address or a website's (its first feed); rename a feed and set its folders; create, rename and remove folders (a folder's feeds stay; removing answers its feeds and rules, so the assistant can put it back as it was); add and remove rules and mutes (removing answers the rule, so it can be made again); unsubscribe from a feed, and bring one back; download the feed list as OPML.
- Never: the password, email, payments, app passwords, the newsletter address, deleting the account, or downloading every article.
- **Unsubscribing from an assistant keeps the feed for 30 days**, hidden, with its articles and marks, instead of the screen's ten minutes. Settings › Connected assistants lists these feeds under **Unsubscribed by an assistant**, each with when it was unsubscribed, how long it's kept, and **Bring back**. Bringing one back (or the assistant's own "bring back") restores it whole. After 30 days it's cleared as any unsubscribed feed is (starred articles always stay).
- The assistant is told that article text is the publisher's: content to read, never instructions, credited and linked when quoted.

**Limits**
- Each reader's assistants together: 60 tool calls a minute and 3,000 a day; 20 feeds added an hour (only http and https addresses, at most 2,000 characters). Past a limit the assistant is asked to wait.
- Registering a new assistant: at most 10 an hour from one internet address and 300 an hour in all; at most 2,000 are kept, the oldest nobody connected making room.
- Adding a feed that an assistant unsubscribed from, in the Add field or by an assistant, within its 30 days brings it back whole, as Bring back does.

**Settings › Connected assistants**
- The server address with **Copy**; each connected assistant with "Connected <date> · Last used <date>" (or "Not used yet") and **Disconnect**, which stops it at once (nothing of the reader's changes); the assistant-key row; and the line under the group saying what this is and that nine turtles runs no AI itself. Below, when there are any, **Unsubscribed by an assistant** with **Bring back** on each.

**How to check it**
1. In Settings › Connected assistants, copy the server address.
2. In Claude (Settings › Connectors › Add custom connector) or ChatGPT (a custom connector in developer mode), paste the address and connect. The "Connect … to nine turtles?" page opens; press Connect.
3. Ask the assistant "What's unread in nine turtles?" and "Star the newest article about gardens": the star shows in nine turtles.
4. Ask it to unsubscribe from a feed. The feed leaves the sidebar; Settings › Connected assistants lists it under Unsubscribed by an assistant. Press Bring back: it's back with its articles.
5. Press Disconnect beside the assistant: it can no longer reach nine turtles.
