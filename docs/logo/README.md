# nine turtles' logo

Nine small turtles seen from the side, in three rows of three, the middle
row a little to the right (decision 0067). One ink: the text color.

- `nine-turtles-mark.svg`: the turtles alone, on nothing, in dark ink.
- `nine-turtles-icon-light.svg`: the app icon by day, dark on white.
- `nine-turtles-icon-dark.svg`: the app icon by night, light on near-black.

The turtles in the icons are drawn at 84% so they have room on every side
(decision 0078). The app's own copies are in `web/public/icons/`. The PNGs
there are these drawings exported at 180, 192 and 512 pixels; the maskable
one has the turtles at 75% so a circular crop keeps them whole.

The browser-tab icon is a single turtle instead (decision 0078), since nine
blur into stripes at 16 pixels: `web/public/icons/icon.svg` (it switches to
night by itself) and `icon-32.png`, its 32-pixel copy for browsers that don't
use the SVG.
