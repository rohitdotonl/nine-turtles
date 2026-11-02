# nine turtles' logo

Nine small turtles seen from the side, in three rows of three, the middle
row a little to the right (decision 0067), redrawn heavier in November 2026
(D2, `docs/BRAND.md` → "The logo"). One ink: the text color.

There are two weights of the same drawing:

- **Heavy (24 to 63 pixels tall):** the logo beside the name, in the app
  (`web/src/lib/Logo.svelte`) and the website's top bar
  (`website/src/_includes/base.njk`). Its box ends at the shells' feet, so it
  stands on the name's baseline.
- **Large (64 pixels and up):** a slightly lighter drawing for big sizes:
  `nine-turtles-mark.svg` (the turtles alone, on nothing, in dark ink) and
  the app icon.

`nine-turtles-icon.svg` is the app icon: a black tile `#141414` with the
large nine in light `#EFEFF1`, 46% of the tile's height, the same by day and
by night. The PNGs in `web/public/icons/` (`apple-touch-icon.png` at 180,
`icon-192.png`, `icon-512.png`) are it exported; `icon-maskable-512.png` has
the nine at 85% of that, so a circular crop keeps them whole.

The browser-tab icon is a single turtle instead (decision 0078), since nine
blur into stripes at 16 pixels: `web/public/icons/icon.svg` and `icon-32.png`,
its 32-pixel copy for browsers that don't use the SVG. It is always a light
turtle (#EFEFF1) filling most of a black rounded square (#141414), by day and
by night, since a tab icon can't see the tab's color and a bare turtle could
vanish on it (decision 0142).
