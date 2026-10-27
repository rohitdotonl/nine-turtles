# 0120: A shorter Settings, with icons and a clearer hierarchy

*27 October 2026.*

**Decision.** The owner chose the "My pick" versions of three findings from
the design try-outs: M2 (a shorter Settings), M2's icons, and S1 (a clearer
hierarchy of names and descriptions, in Settings and Edit feed). What it
looks like is in `docs/SPEC.md` section 18 and `docs/DESIGN.md` Part 2; this
note records the rules and the choices the try-outs left open.

1. **Settings' first page keeps only the everyday settings:** Reading
   (reading mode, unread counts, letting unread go, sort order) and Look and
   feel (Appearance, Text size, and a row for Font, theme and line width).
   Everything else is a row ending in › that opens a page of its own in place
   of Settings, as Feed health and Your feeds already did. Nothing was
   removed; every setting only moved.
2. **Each page has its own address**, `/settings/<name>` (`SETTINGS_PAGES`
   in `web/src/lib/router.ts`), so reloads, links and the browser's Back and
   Forward work. A page has "‹ Settings" above its title and no X; it and
   Escape go back to the page it was opened from, and the keyboard returns to
   the row that opened it (`parentOf` and `rowFor` in `router.ts`, the rows'
   `data-settings-row`). Muted articles goes back to Rules, All readers to
   Readers. Each row that opens a page is a link, and screen readers hear
   "Opens its own page." after its name.
3. **Icons:** each row on the first page starts with a line drawing (20px
   grid, 1.5 stroke, round caps and joins, no tile) in the muted grey, never
   the accent, chosen by the owner one by one. Its box is exactly the name's
   first line tall, so its centre sits on that line's centre with or without
   a description; the browser tests measure this to within 1px on a computer
   and a phone. Existing drawings were reused where they were the same
   (clock, sort, download, keyboard, sliders, sign-out).
4. **S1:** a setting's name is about 0.98rem at weight 500 in the text
   color, its description straight under it at 0.8rem in the muted grey
   (line height 1.35); group names small uppercase muted letters (0.72rem,
   letter-spacing 0.07em); rows 12px above and below on a computer, 14px on
   a phone; the control at the right on a computer, under the words at full
   width on a phone. Weight 500 is new: before, the interface used only 400
   and 600. The self-hosted Inter has no 500, so where the device's own
   font is missing the names show in Inter's regular.

**Choices the try-outs left open** (each the one closest to the mock-up):

- **Font, theme and line width** is a page of its own (`/settings/font`):
  the sample paragraph, Theme, Reading font and Line width. The row shows the
  reading font's name before its ›.
- **Newsletters** (not in the mock-up) is a row in More, after Rules, while
  nine turtles takes them; its icon is the mock-up's newspaper.
- **Your plan** (not in the mock-up) is the first row of Account while
  nine turtles takes payments, for readers who aren't free, showing where
  they stand ("Free trial") before its ›; its icon is a card, drawn in the
  same style.
- **Delete data… and Delete account…** (not in the mock-up) stay in Account
  after Sign out, in red words, with a bin icon in the muted grey.
- **Readers** keeps its address, `/settings/readers`, for the owner's Readers
  page (their email and All readers ›); the list of readers moved to
  `/settings/readers/all`, titled "All readers".
- **"Only you"**, the small outlined word beside "Your nine turtles" in the
  mock-up, is kept.
- **Feed health, Your feeds, Muted articles and All readers** keep their X
  (the Feed health page's layout was not to change); their X and Escape go
  back to the row that opened them.
- The descriptions that used to sit under the groups moved under each
  setting's name where the mock-up shows one; the pages' own explanations
  stay under their groups.
- The mock-up's Readers row showed how many readers there are; that figure
  stays on All readers ›, one step in, so Settings' first page asks the
  server for nothing more.
