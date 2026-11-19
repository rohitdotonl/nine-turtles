# 25. Speed

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- Every action feels instant (under about a tenth of a second).
- No spinners for things the app already has.
- A main button that waits on the server (Sign in, Save, Done, Follow, Send link, Move…) says what it's doing in its own word once the wait passes half a second: "Signing in…", "Saving…", "Following…" (decision 0229). A word changing, never a spinner or a fade; the button keeps its look.
- Every wait over half a second says so in words where the answer will appear: a list "Loading Outdoors…", an article "Loading the article…", a video "Starting the video…", a podcast "Loading from the publisher…" (decision 0230). A slow wait, on someone else's site, YouTube or a publisher's audio, keeps saying so: after 5 seconds "Still looking… Some sites are slow to answer." ("Still starting… YouTube can be slow to answer." for a video; "Still loading… Some sites are slow to answer." for a podcast), after 15, for a look on someone's site, "It can take up to a minute.", with **Stop** where stopping changes nothing (Find new address); the three dots of its "…" brighten in turn, slowly, and are still with reduced motion (decision 0287).
- A press is felt: while a finger or mouse button is down on a row or a button, a still tone of the ink (10%) sits behind it, a step deeper than the pointer's; the main action steps to the full ink. No fade or ripple, and the browser's own tap flash is off (decision 0229).
- Actions happen on screen first; saving to the server happens quietly behind.
- Opening waits for one answer from the server, not several in a row. A list fetched in the last minute (Unread and Saved are fetched as the app opens) and an article whose whole text is kept on the device (section 32) show at once, without asking the server again; the server's answer replaces the article quietly when it comes. Fonts come from the device's copy, so text never changes face as it loads. Settings and other pages most visits never open load just after the first screen; opened before they've come, their place says "Loading Settings…" after half a second, or, if they can't be fetched, "You're offline. Settings open once you're back online." (decision 0314).
- The app's download size is kept under a budget checked automatically: at most 250 KB of app code and styles, and 400 KB of fonts (downloaded once, then kept by the browser).

**How to check it**
1. Use the app for a few minutes: you never wait for it. On a slow connection, Sign in says "Signing in…" while it waits. On a phone, a row under your finger takes a faint tone.
2. On a slow phone connection, save an article: the bookmark fills immediately. If saving fails, you're told plainly and the bookmark is taken back, rather than silently lost.
