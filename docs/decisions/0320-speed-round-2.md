# 0320: Speed, round 2: opening never waits on a bad signal, and taps go first

**In one line:** After the second speed check of 19 November 2026, nine turtles opens from the phone's kept page at once and, on a device with kept copies, waits at most 2.5 seconds for the server before showing them ("The connection is slow."); the page itself asks for the first screen's answers before the app's code arrives; copies for reading offline come 10 at a time and stop whenever the reader presses something; and pressing a link to a list asks for its first page before the finger lifts.

*19 November 2026. From the round-2 speed report (the live version 2026-11-19-c15b611, measured on the owner's Mac in Chrome's and Safari's engines: a cheap Android phone and an iPhone on slow phone data, 0.3 s per round trip and 1.6 Mbps, and a bad signal where every answer takes 5 s). The owner chose all four items ("all 4, build and merge").*

**What was slow.**
1. **A bad signal.** Opening asked the server for the page first, then for the first screen's answers, and waited as long as they took, though about 200 articles were kept on the phone: a blank screen for 10.2 s on Android and 16.2 s on an iPhone when every answer took 5 seconds.
2. **Tapping just after opening.** The copies for reading offline came 25 at a time, one request after another; on slow data each took about 2 seconds to download, and a tap's answer queued behind it: a person tapped a few seconds after first opening took 0.5 to 2.6 seconds instead of about 0.37 s, depending on where the download was.
3. **Reopening.** The page waited one round trip for the server's page, and the first screen's questions waited for the app's code to run: 0.93 s on Android and 1.0 s on an iPhone, on slow data.
4. **Opening a person or folder** is one round trip, which started only when the finger lifted.

**What changes.**
1. **The kept page at once** (`web/public/sw.js`). The service worker opens its kept copy of the page and asks the server for the newest behind it, keeping that for next time. The server's own pages (`/status`, the owner's report and the like) and files always come from the server, and only the app's own page is kept. So a page opened from an older copy still knows its version, the server writes its version into the page (`<meta name="nine-turtles-version">`, `server/src/assets.rs`), and the page's label (`ETag`) names it too, so "unchanged" never hands back an older version's page. The app compares answers with the page's own version (`updates.svelte.ts`): after an update it notices the newer server on its first answer and switches at the next move to another place (decision 0085). Every reload for a new version lets go of the kept page first (`switchTo`, `reloadNewest`), so it opens the server's: the switch itself, Settings' Reload, "nine turtles was updated. Reload to continue." and a page whose file couldn't load (`PageWait.svelte`; an older version's files may be gone).
2. **At most 2.5 seconds** (`early.ts`). On a device someone was signed in on (so there are copies), the first screen's answers that haven't come within 2.5 seconds of opening fail as a timeout, which the app already treats as no connection: the kept session, everyone they follow, their order and the kept list show (decision 0101), with "The connection is slow. Showing the articles kept on this device." (`away()` in `connection.svelte.ts`; BRAND.md). The answers still count when they come: the first one says the connection is back, and the app carries on as after being offline. A device never signed in waits as before, since it has nothing to show. The settings' fallback keeps the order this device last saw, not always Newest first (`reading.ts`).
3. **Asking before the app's code arrives** (`index.html`). A second script in the page (its fingerprint in `server/src/security.rs`, checked by `firstPage.test.ts`) asks for the session, settings, everyone they follow and the list this address opened last time, as `early.ts` noted it on this device (`nine-turtles.early`, at most 30 addresses; only nine turtles' own `/api/` addresses). `askEarly` takes those answers instead of asking again.
4. **Taps go first** (`presses.ts`, `offline.ts`). Copies for reading offline come 10 at a time. A press (pointer or key) stops the request under way, and the next waits until the reader hasn't pressed anything for 1.5 seconds; a stopped request is asked again, so nothing is lost.
5. **On the press** (`askAhead`, `lists.ts`). Pressing a link to another list (a person, a folder, Saved, Unread) asks for its first page at once; the list takes that answer when it opens, as a recent page (`recent.ts`), and a change the reader makes meanwhile forgets it, as before. A press that becomes a scroll costs one small request.

**Measured** (median of 3 runs each, the same data, before and after; a tap held for 0.1 s):

| | Android (Chrome's engine, CPU 4 times slower) | iPhone (Safari's engine) |
|---|---|---|
| Reopening with a bad signal (every answer 5 s) | 10.2 s → 2.7 s | 16.2 s → 2.8 s |
| Reopening, Unread | 0.93 s → 0.70 s | 1.03 s → 0.76 s |
| Reopening, Saved | 0.87 s → 0.63 s | 1.46 s → 0.71 s |
| Opening a person, from the finger's touch | 0.46 s → 0.34 s | 0.49 s → 0.37 s |
| Opening Saved after reading, from the touch | 0.43 s → 0.31 s | 0.45 s → 0.33 s |
| A person tapped 0.3 to 5 s after first opening | 0.37–0.74 s → 0.36–0.37 s | 0.36–0.73 s → 0.35–0.65 s |
| First visit ever | 2.95 s → 2.84 s | 2.63 s → 2.47 s |

Opening an article, Home and Settings were already under 0.2 s and are unchanged.

**Considered and not taken.** Showing the kept copy of every list first and the server's after (round 1 left it out: rows would change while the reader looks). Here the kept list shows only when the server is too slow to wait for, and says so. Asking for every link's list on hover: a computer is on fast connections, and a press is enough.

**Revisit if** readers on good connections see "The connection is slow." (2.5 s too short for a large account), or a new version takes more than one move to arrive.
