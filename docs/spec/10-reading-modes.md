# 10. Unread, on or off

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

*V1 always had Unread. Switching it off arrived in V2 as "river mode" (25 October 2026, decision 0068); Inbox and River became one switch, Unread on or off, on 4 November 2026 (decision 0172).*

**What it does**
- A single switch for the whole app, shared across the reader's devices: **Settings › Reading › Unread**, on by default.
- **On:** things to get through. The Unread view, read/unread styling and the sidebar's unread dots are all present (no numbers, decision 0148).
- **Off:** things flowing past. No Unread view, no read/unread styling, no dots in the sidebar. Read state is still recorded quietly.
- With Unread off the sidebar has no Unread, `g u` does nothing, and "Mark all as read" (in the More menu, and `Shift+A`) is hidden. The app opens on **All articles** with Unread off and on **Unread** with it on.
- With Unread off every title in the list looks the same: full ink, regular weight, with no unread dot, and screen readers don't hear "unread". The feeds and folders show no dots.
- The Unread address (and `/`) leads to All articles with Unread off, without a step in the browser's history. Switching Unread off while on Unread moves you to All the same way.
- The `?` list leaves out "Go to Unread" and "Mark all as read" with Unread off, and search can't be limited to Unread (there's no Unread view). "Mark unread" (and `m`) stay: read state is still recorded, and shows again once Unread is back on.
- The switch's description says what it does: "An Unread list, and a dot where something is new." when on, "No Unread list and no dots. What you've read is still remembered." when off. Each device remembers what it last saw, so it opens that way before the server answers; the server's answer decides.
- The switch is for everything at once: there's no per-feed choice (a single feed's River went with decision 0172). To see less from one busy source, a rule hides its topics (section 27) or Pause sets it aside (section 15).

**How to check it**
1. In Settings › Reading, switch Unread off. The Unread view, the sidebar's dots and the grey "read" titles all disappear, and the app opens on All articles.
2. Read a few articles, switch Unread back on. The ones you read are shown as read.
3. Open anyone's Edit: there's no Reading mode, Inbox or River there.
