# 0036: Toward Apple Books: type, selection and the list's rhythm

*24 October 2026. The owner made Apple Books the only reference ("The only
gold standard is Apple Books… everything is up for change except three pane
structure. New goal: 10/10"). From the Apple Books critique
(`ui-polish/critic-applebooks-1.md` in the project files, items 3, 4, 7, 9,
10 and 15).*

**What changed, and why.**

- **Interface font:** in Safari on a Mac, iPhone or iPad the interface is
  set in San Francisco (`-apple-system`), as Apple Books is; elsewhere it is
  the self-hosted Inter, as before. Nothing new is shipped. The switch sits
  behind `@supports (font: -apple-system-body)`, which only Safari passes:
  asked for by name, `-apple-system` can match some other font on Linux,
  and Chrome's `BlinkMacSystemFont` means the device's font everywhere.
  Screenshots taken on Linux (the checks) still show Inter.
- **Touch sizes:** under `pointer: coarse`, interface text is 17px and
  details 15px, the sizes a phone's own apps use.
- **Selection:** the selected row always keeps its fill. With the
  keyboard, a 2px outline in the softened text color (`--place-focus`, at
  least 3 : 1, tested) sits just outside the fill, the way a Mac draws a
  focus ring, and the accent bar steps aside meanwhile, so a row never
  shows three marks. Rows are rounded 8px; the off-white list tint is one
  step deeper (`#E0D9CB`). This refines decision 0033, which dropped the fill.
- **Sidebar:** visible section names ("Folders", "Other feeds"), feed names
  in full ink rather than the second ink, and a smaller, quieter wordmark
  on a computer.
- **List rhythm:** hairlines between rows (none beside the selected row),
  the unread dot in its own gutter, and the star after the date so titles
  and sources line up.
- **Reading rhythm:** line height 1.55 (1.5 on a phone), paragraphs 0.8em
  apart, the title at 1.15 with tighter spacing, the byline's feed name at
  medium weight so the title keeps the only bold, and a 1px quote rule.
