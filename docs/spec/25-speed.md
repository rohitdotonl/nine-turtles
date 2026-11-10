# 25. Speed

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- Every action feels instant (under about a tenth of a second).
- No spinners for things the app already has.
- A main button that waits on the server (Sign in, Save, Done, Follow, Send link, Move…) says what it's doing in its own word once the wait passes half a second: "Signing in…", "Saving…", "Following…" (decision 0229). A word changing, never a spinner or a fade; the button keeps its look.
- A press is felt: while a finger or mouse button is down on a row or a button, a still tone of the ink (10%) sits behind it, a step deeper than the pointer's; the main action steps to the full ink. No fade or ripple, and the browser's own tap flash is off (decision 0229).
- Actions happen on screen first; saving to the server happens quietly behind.
- The app's download size is kept under a budget checked automatically: at most 200 KB of app code and styles, and 400 KB of fonts (downloaded once, then kept by the browser).

**How to check it**
1. Use the app for a few minutes: you never wait for it. On a slow connection, Sign in says "Signing in…" while it waits. On a phone, a row under your finger takes a faint tone.
2. On a slow phone connection, star an article: the star appears immediately. If saving fails, you're told plainly and the star is taken back, rather than silently lost.
