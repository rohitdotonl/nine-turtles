# 25. Speed

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- Every action feels instant (under about a tenth of a second).
- No spinners for things the app already has.
- Actions happen on screen first; saving to the server happens quietly behind.
- The app's download size is kept under a budget checked automatically: at most 150 KB of app code and styles, and 400 KB of fonts (downloaded once, then kept by the browser).

**How to check it**
1. Use the app for a few minutes: you never wait for it.
2. On a slow phone connection, star an article: the star appears immediately. If saving fails, you're told plainly and the star is taken back, rather than silently lost.
