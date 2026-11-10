# 0252: The phone's own text size grows the whole app

**In one line:** On an iPhone or iPad, nine turtles follows the system's Text Size, growing or shrinking the whole app as native apps do (up to twice its size), with Aa still the article's own control on top.

*11 November 2026.*

Rohit's "4" on the "Design for decades, again" critique, as changed in the
thread: follow the device's setting, the familiar way, rather than make Aa
grow everything.

**What was wrong.** The first floor says nine turtles respects the system's
text size. On a computer it does (browser zoom scales the whole app, which is
measured in rem) and Android's browsers scale pages with the phone's font
size. But on an iPhone or iPad a web page only follows Text Size if it asks,
and nine turtles didn't: someone who set larger text for their eyes got it
everywhere except here.

**Decision.** At start, and each time the reader comes back to the app,
`web/src/lib/systemText.ts` measures the system's body text
(`-apple-system-body`, 17px at the default size) and sets the root font size
to the same proportion, so everything sized in rem follows. Only on touch
devices whose browser knows that font (Apple's); capped at 200%, where the
first floor promises everything still works. Smaller settings shrink it, as
they do native apps. Aa's six steps are unchanged and apply on top.
