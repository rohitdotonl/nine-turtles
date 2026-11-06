# 8. Read state, marking unread, "mark all as read", undo

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- An item counts as read as soon as it's shown in the reading pane, by click or by `j`/`k`.
- `m` marks the current item unread again. **Mark unread** in the article's More (…) menu does the same (in the top bar on desktop, in the bottom bar on phones).
- **Mark all as read** (`Shift+A`, or **Mark all as read** in the More (…) menu beside the list's title, section 6): happens instantly, no "are you sure?". It affects **only the items shown on screen right now** (every item listed, including older ones loaded as you scrolled). Items that arrived in the background but aren't displayed yet are never touched.
- **Undo** (`u`, or a visible **Undo**): after an undoable action, a note such as "Marked 23 articles as read" with an **Undo** button floats at the bottom of the list (nothing in the list moves), in a band of the list's own tone that the rows end above, so it never covers them (decision 0048). The words sit on the left (wrapping when long) and the buttons on the right, centred beside them, with a **Close** button (×) last. The note goes when you close it, when you open another article with a keyboard to hand (you've moved on; a touch screen has no `u`, so there it stays), when you do something else it then describes, or when you leave the list; never on a timer. Pressing `r` doesn't clear it. Once it's gone, `u` still undoes until you leave the list. After an undo it says "Undone."; there's no undoing an undo. If the undo can't reach nine turtles, it says "That couldn't be undone. Try again in a moment." A save that failed (with **Try again**) stays when you open another article: it still matters.
- **One way to set a backlog down** (decision 0171): Mark all as read, with Undo, is the only one. There's no "Catch me up", no setting that lets unread go by itself, and no marking above, below or older than an article. With no counts anywhere (decision 0148), a backlog weighs little; mark what's shown as read, or simply leave it.
- Undo reverses **the last action only**, of these: mark all as read, mark unread, star/unstar, unsubscribe, delete folder.
- Read state is recorded whether Unread is on or off, so switching never loses it.
- The feed's dot in the sidebar comes or goes at the same moment (decision 0148).
- If nine turtles can't be reached when a mark is made (the connection dropped, or a new version is going live and the server is restarting), it quietly tries again for about a minute, so a short gap loses nothing and says nothing. With no connection at all, the mark waits on the device and is sent once the connection is back, the latest mark winning (section 32).
- If a mark still can't be saved, it's taken back and the note at the bottom of the list says so plainly, such as "The star couldn't be saved.", with a **Try again** button in the Undo's place. The message goes as soon as a later mark is saved (the connection is back), or when you press Try again. A failure never takes back a later action on the same article.

**How to check it**
1. Click an unread item: it turns grey and the feed's unread number drops by one.
2. Press `m`: it's unread again and the number goes back up.
3. Press `Shift+A` in a feed: everything shown turns grey at once. Press `u`: they're unread again.
4. Wait until "New articles · press r" appears, then mark all as read *without* pressing `r`. Press `r`: the new items are still unread.
5. Turn the Wi-Fi off, open an unread article, and turn it back on within half a minute: the article stays read and nothing is said. Leave it off longer: "An article couldn't be marked as read. It's still unread." appears with Try again; once the Wi-Fi is back, opening another unread article (or pressing Try again) clears it.
6. Open a list's More (…) menu: it has Mark all as read and Refresh, and nothing else for marking. Settings › Reading has Unread and Sort order only. `Shift+O` does nothing.
