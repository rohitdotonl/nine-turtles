# 0032: Eight more themes, to try and prune

*Superseded by decision 0046: six themes as in Apple Books, each by day and
by night.*

*24 October 2026. The owner asked for "abundant options" ("Create multiple.
I'll get themes removed later") and said themes can change completely.*

**Why.** Three themes (off-white, sepia, dark) left little to choose from, and
the owner wants to live with more before deciding which to keep.

**What changed.**

- Eight themes join the first three: **Porcelain, Linen, Mist, Sage** (light)
  and **Graphite, Night, Midnight, Black** (dark). Their colors are in
  DESIGN.md → "Color".
- **The accent is per theme.** "Where you are" keeps one color and one
  meaning in each theme, but it's no longer always ink blue: Linen and Sage
  use green, Night amber, the others blues. The focus outline stays in the
  text color everywhere.
- Each theme's name and picture colors live in one place,
  `web/src/lib/themes.ts` (`LOOKS`); a unit test checks they match `app.css`,
  and the browser's bar color is derived from them.
- Every theme runs the full accessibility and contrast checks on every screen.
  To keep pull request screenshots small, the new themes are photographed
  only on the list and article screens.
- Automatic still means off-white or dark.

**Later.** When the owner picks favourites, remove the others from `THEMES`,
`LOOKS` and `app.css`; the tests follow `THEMES`.
