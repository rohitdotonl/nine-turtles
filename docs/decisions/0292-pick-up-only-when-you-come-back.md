# 0292: "You were reading" only when you come back

**In one line:** The pick-up line (decision 0175) shows only on the first list you see when you come back after half an hour or more away (or on a device you've never used), and goes once you go to another list; a refresh isn't coming back.

*17 November 2026. The owner added a feed he already followed, pressed the button to read it, and its list said "You were reading" an article by someone else: "Clearly, that's not needed here." He picked "Only when you come back" over keeping it on the article's own lists too, or removing it, and asked that a refresh not count as a new visit.*

**Why.** The line is a welcome back: "you were halfway through this". Inside a list you chose on purpose, a note about another writer is noise (nothing pulls; clear at a glance). Reading apps put "Continue reading" on the screen you return to, not on every shelf.

**How.**
1. Each device writes down, in its own storage (`nine-turtles.here`), when the reader was last there: when the app opens, when the page is hidden (another app, another tab, a refresh) and when it's left. Nothing runs in the background: the time is compared once, when the app opens or is shown again.
2. Opening the app, or showing it again with no article open, after 30 minutes or more since that time is coming back; so is a device with no time written down. Only then is the line offered.
3. It sits on the first list on screen, and goes for the rest of the visit once another list shows.

The server keeps the place as before (decision 0175), so another device still offers it when you come back there.
