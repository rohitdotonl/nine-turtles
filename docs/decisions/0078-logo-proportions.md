# 0078: The logo beside the name, and a one-turtle tab icon

*October 2026. First numbered 0073, which marks trying again also took.*

**Decision.** A review of the logo (decision 0067) everywhere it appears
found it fine in drawing but off in a few places, and the owner accepted
these fixes:

- **No cut-off edges.** The inline logo's frame was a hair too tight, which
  sliced the right-hand heads and the left shells' corners. Its frame is
  now `7 16 86 68`, a little room on every side.
- **Sized to the name.** The logo had been sized on its own, 1.2 to 1.75
  times the name's size, so the name looked small beside it. Now one rule:
  the logo is 1.15 times the name's size (a touch taller, so the turtles
  stay readable), and the name is semibold everywhere, as the website's
  already was. Sidebar 23px tall beside 20px, phone 32px beside 28px,
  website 28px beside 24px (its name grew from 20px). Sign-in is unchanged.
- **One turtle in the browser tab.** At 16px nine turtles read as a menu
  button's stripes. The tab icon (`icon.svg`, and a new 32px PNG copy for
  browsers that don't use SVG) is a single turtle on the rounded tile. The
  home-screen and install icons keep the nine.
- **Room in the home-screen icon.** The turtles nearly touched its left and
  right edges; they are now drawn at 84%.

**Why.** The owner asked for the review and accepted the proposals on a
canvas comparing now and proposed, in light and dark.

**Not done.** An installed copy on Android opens on a white screen even at
night: the web app manifest has one background color, with no night
version that browsers honor.
