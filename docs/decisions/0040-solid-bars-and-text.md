# 0040: Solid bars and text correctness

*24 October 2026. From the third Apple Books critique
(`ui-polish/critic-applebooks-3.md` in the project files, items 1, 2, 3, 4,
6, 10, 11, 27 and 31), under the owner's goal that Apple Books is the only
standard. Supersedes the see-through top bar of decision 0038.*

**Why.** The article's top bar was the page's color at 85% with a blur
(decision 0038), so the text would fade under it as in Apple Books. Without
the system's own material it read as a rendering bug: scrolled text ghosted
faintly through the bar, on a computer and on a phone. The phone's bottom
toolbar had no edge, so a line of text looked sliced in half where it met
the bar. A strip in a different tone showed at the right of the reading
pane (the scrollbar's track). The summary-only note was italic and
underlined across two lines; the title's balanced lines left it narrower
than the text; body text set "pretty" left visibly short lines; search
results put the source and time between the title and the text that
matched; and the empty reading pane carried a hint with a key cap sitting
low on its line.

**What changed.**

- **Solid bars.** The article's top bar, on a computer and a phone, is the
  page's own color, never see-through or blurred. It sits above the
  scrolling text rather than over it, across the whole pane (the scrollbar
  starts below it), and the faint line between them shows only once the
  text has scrolled, the same rule as every other pane's top line
  (decision 0028). This withdraws the "see-through top bar" exception from
  DESIGN.md's Exceptions log.
- **The phone's bottom toolbar** is solid, with a hairline along its top
  and room for the home indicator below. That hairline is a new, narrow
  entry in the Exceptions log ("Regions by tone, no lines").
- **No gutter strip.** The reading pane keeps room for a scrollbar, so the
  text column doesn't shift, but the scrollbar's track is see-through and
  its thumb a faint tone of the text, so the gutter is the page's own color
  in every theme.
- **End matter.** A summary-only article's note sits under the closing
  rule, as a book sets its end matter: small upright interface type (14px),
  centred, in the second ink; only the link is underlined. The copy is
  unchanged.
- **Title measure.** The article's title fills the text's measure; it
  avoids only a lone last word (`text-wrap: pretty`) instead of balancing
  its lines, which made it visibly narrower than the text.
- **Body text** wraps normally; only a paragraph that ends the article
  avoids a lone last word, so no line is pulled visibly short.
- **Search results** read as Apple Books orders them: the title, then up to
  two lines of the text around the match, then the source and time. The
  highlight is unchanged (a faint accent tone with an underline, in the
  text's own weight), so it never relies on color alone.
- **The empty reading pane** says only "No article open.", like a blank
  page in Apple Books. The hint "Choose one from the list, or press j" is
  kept for screen readers, where it helps someone who can't see the list,
  and dropped from view, where the list beside it already says what to do
  and the shortcut list (`?`, or the keyboard button in the sidebar) teaches
  the keys. This also removes the key cap that sat low on its line.

**Already true on this commit.** The summary note's missing space (item 3)
was fixed before this change. The search options menu's rows are 44px on
touch screens and 36px with a mouse (the fine-pointer floor), its Show only
toggles have a checkmark slot like the radio groups, and "Another feed or
folder…" already ends in "…" (item 11). No interface string types "..."
for "…"; the dots in screenshots came from feed text, which the server
already turns into "…" in excerpts.

**Kept.** The three panes, every key and accessible name, the bars' icons
and their places, 44px touch targets, the text-colored focus outline, no
animation, and all eleven themes.
