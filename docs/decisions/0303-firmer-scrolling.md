# 0303: Firmer scrolling: an article's pull starts only at the end, and a list's rows land

**In one line:** a pull to the next (or previous) article starts only with a stroke that begins at the article's end (or top), counts only once it's gone 160px, and a quick flick no longer counts, so reading on never opens another article by itself; and a flicked list settles with a row's top at the pane's top (scroll snapping), never half a title.

*17 November 2026. The owner said scrolling felt too smooth and slippery: up and down, the screen moved when they didn't mean it to, and asked for some resistance.*

**What was slippery.** nine turtles adds no smooth scrolling of its own; the glide after a flick is the phone's, and a web app can't change it without taking scrolling over, which breaks zoom, screen readers and the phone's own feel (the first floor). What was ours: at an article's end, a quick flick of 20px opened the next one (decision 0280 took the flick from the sideways swipes), and a scroll that reached the end carried straight on into a pull in the same stroke. A normal flick to read on did both.

**What changes.**
1. **Only a stroke that starts at the end (or top) pulls.** A scroll that reaches it stops there; the next stroke pulls.
2. **No flick.** Letting go opens the next only once the pull has gone 160px (it was a third of the width, at most 120px), and the article says "Let go for the next" first, so it's always meant.
3. Row swipes and going back keep their flick; they never ride on a scroll.
4. **A list's rows land.** Flicked up or down, a list settles with a row's top at the top of its pane, like a notched dial, so it feels as if it clicks into place. Only near a row (`proximity`), so a slow drag stops where the finger does, and the list's top is a place to land too. The owner chose it as the bold option; the settle is the browser's own, a short movement after a glide the reader started, so it's in DESIGN.md's Exceptions log (principle 8), and off with reduced motion. Articles never snap: in long text it would fight the reader.

**Considered and not taken.** Changing the scroll's own speed or friction: never, for the reason above.

**Revisit if** readers find the pull too hard to start, or still land in the next article by accident.
