# 10. Reading modes: inbox and river

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

*V1 had inbox mode only. River mode arrived in V2 (25 October 2026, decision 0068).*

**What it does**
- A single setting for the whole app.
- **Inbox (default):** things to get through. Unread view, read/unread styling and unread counts are all present.
- **River:** things flowing past. No Unread view, no read/unread styling, no counts. Read state is still recorded quietly.
- In river mode the sidebar shows **Starred · All** only, `g u` does nothing, and "Mark all as read" (in the More menu, and `Shift+A`) is hidden. The app opens on **All** in river mode and on **Unread** in inbox mode.
- In river mode every title in the list looks the same: full ink, regular weight, with no unread dot, and screen readers don't hear "unread". The feeds and folders show no numbers.
- The Unread address (and `/`) leads to All in river mode, without a step in the browser's history. Switching to river mode while on Unread moves you to All the same way.
- The `?` list leaves out "Go to Unread" and "Mark all as read" in river mode, and search can't be limited to Unread (there's no Unread view), though its "Show only: Unread" filter stays. "Mark unread" (and `m`) stay: read state is still recorded, and shows again back in inbox mode.
- Chosen in Settings › Reading, as **Reading mode: Inbox · River**. Each device remembers the mode it last saw, so it opens in it before the server answers; the server's answer decides.
- **One feed in river mode** (since 25 October 2026, decision 0082): in Edit feed (section 15), a feed's own **Reading mode: Inbox · River**. A river feed flows past while the app is in inbox mode: its articles never appear in Unread, it has no count (and adds nothing to its folders' counts), and its rows look as in river mode, wherever they're listed. Its own list, All, its folders and search still show everything, except a search for unread articles only. When the whole app is in river mode, every feed flows past whatever its own setting says.

**How to check it**
1. In Settings, switch to river mode. The Unread view, the counts and the grey "read" titles all disappear.
2. Read a few articles, switch back to inbox. The ones you read are shown as read.
3. In inbox mode, open a busy feed's Edit feed and choose River: its count goes, its articles leave Unread, and its list shows every title alike.
