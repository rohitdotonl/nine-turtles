# 0026: A real hierarchy: a type scale by role, three inks, one selection style

*24 October 2026. The owner found the overnight polish flat ("too many
elements of the same size") and approved changing DESIGN.md's look rules and
any document that stood in the way, keeping the floors.*

**Why.** An outside critic scored the app 4/10 for beauty
(`ui-polish/audit.md` in the project files). The main cause was DESIGN.md's
own five-size scale: sidebar names, list titles, buttons and labels all had
to be 16px, so nothing stood out from anything else. The selected row was a
heavy black box, opening an article made its row the quietest one on screen,
and a 100px empty band sat above every list.

**What changed.**

- **Type by role** (`web/src/app.css`): meta 13 · small 14 · interface 15 ·
  base 16 · large 20 · heading 24 (serif) · extra large 28 · display 48. The
  list's title is now a 24px serif heading, list titles 15px, meta 13px.
- **Three inks:** text, a second ink (`--ink-2`) and muted grey, all checked
  in `contrast.test.ts` (the second ink is at least 4.5 : 1 everywhere and
  sits between the other two).
- **Deeper area tones,** so the three panes separate at a squint.
- **One "where you are" style:** a 3px ink blue bar and a faint tint, in the
  sidebar and the list. A selected list row is also the keyboard's place, so
  it no longer draws a box; a row reached by Tab before anything is selected
  still gets the outline. Outlines are 2px, not 3px.
- **Headings focused by the app draw nothing** (replacing 0025's short bar,
  which looked like a stray mark).
- **A shared top line** that never scrolls: the sidebar toggle (now an
  icon) and wordmark, the list's title with Edit, and the article's tools.
  Settings moved to the bottom of the sidebar beside Add feed, with the
  shortcut hint under them (or under the list when the sidebar is hidden).
- **Search matches are underlined,** not bold.
- **Two panes from 896px,** one column below (was 768px).
- **Article lines** default to about 67 characters (57ch; a "ch" is wider
  than an average letter).

**Not done.** A medium (500) interface weight would add about 60 KB of fonts
and break the 400 KB budget; regular and semibold carry the levels instead.
