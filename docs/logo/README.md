# nine turtles' logo

Nine small turtles seen from the side, a half-circle shell and a round head
each, in three rows of three, the middle row a little to the right
(decision 0067). One ink: the text color. This is the original drawing; the
heavier redrawn nine (D2) was live from 2 to 4 November 2026 and was
dropped at the owner's request (decision 0179).

One drawing at every size. Its box ends at the turtles' edges and the
shells' feet, so beside the name it stands on the name's baseline:

- the logo beside the name, in the app (`web/src/lib/Logo.svelte`) and the
  website's band (`website/src/_includes/base.njk`);
- `nine-turtles-mark.svg`: the turtles alone, on nothing, in dark ink.

`nine-turtles-icon.svg` is the app icon: a black tile `#141414` with the
nine in light `#EFEFF1`, 46% of the tile's height, the same by day and by
night. The PNGs in `web/public/icons/` (`apple-touch-icon.png` at 180,
`icon-192.png`, `icon-512.png`) are it exported; `icon-maskable-512.png` has
the nine at 85% of that, so a circular crop keeps them whole. The share
picture (`website/src/images/share.png`) has the same nine, 132 pixels tall.

The browser-tab icon is a single turtle instead (decision 0078), since nine
blur into stripes at 16 pixels: `web/public/icons/icon.svg` and `icon-32.png`,
its 32-pixel copy for browsers that don't use the SVG. It is always a light
turtle (#EFEFF1, the original half-circle shell and round head) filling most of a black rounded square (#141414), by day and
by night, since a tab icon can't see the tab's color and a bare turtle could
vanish on it (decision 0142).
