# 0067: A logo of nine turtles

*October 2026.*

**Decision.** nine turtles has a logo: nine small turtles seen from the
side (a half-circle shell and a round head each), in three rows of three,
the middle row a little to the right. It is drawn in one ink, the text
color: dark on white, light on near-black. It is the app icon on a phone's
home screen and the icon in the browser tab, for the app and the website
(which copies the app's icons, decision 0066). On the website it also
stands before the name in the top bar, because a phone's browser shows no
tab icon (added at the owner's request). Inside the app, the wordmark
stays words. This replaces the "no logo shape" line of "Name and signature"
in DESIGN.md and the lowercase letter icon of decision 0022.

**Why.** The owner asked for a minimal logo, chose "nine dots, but
simple turtles" from a page of options, then the side view, with more
space between the turtles. A bigger group fills the icon so it holds its
own beside other apps, and the nudged middle row keeps the three rows from
reading as a menu button's stripes at small sizes.

**Where.** The drawings are in `docs/logo/` (the turtles alone, a light
icon and a dark icon). The app uses `web/public/icons/`: `icon.svg` for the
browser tab (it switches to night by itself; its day colors are plain
attributes, so it still shows by day where a page's rules block its style), and PNG pictures for phones
and installing (`apple-touch-icon.png` 180px, `icon-192.png`,
`icon-512.png`, and `icon-maskable-512.png` with the turtles a little
smaller, so a phone that crops icons to a circle keeps them whole).

**Easy to change:** redraw the SVGs and export the PNGs at those sizes.
