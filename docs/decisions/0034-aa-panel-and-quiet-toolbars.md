# 0034: An "Aa" reading panel, and quiet icon toolbars

*24 October 2026. From the Apple Books critique (`ui-polish/critic-applebooks-1.md`
in the project files, sections 1, 2, 5, 6, 7 and 12), under the owner's goal
of matching Apple Books, with their approval to change DESIGN.md.*

**Why.** The reader's own controls (text size, theme, font, line width) lived
only in Settings, which takes over the list and the article: you had to leave
what you were reading to change how it looked. Apple Books keeps them one
press from the text, in its "Aa" panel. The article's top line led with
"Open original" in semibold words, the loudest thing above the title; the
phone's bottom bar looked like a tab bar of five labelled icons; and the
list's "Refresh" and "Mark all as read" sat as a row of words between the
search field and the list.

**What changed.**

- **The Aa panel.** An Aa icon button above every article (in the phone's
  bottom bar on a phone) opens a small panel under it, or a sheet along the
  bottom of a phone's screen. It holds text size (a small A and a large A,
  the same six steps as `+` and `-`), the themes as round-cornered "Aa" tiles
  on each theme's own page and ink (all eleven plus Automatic for now; the
  owner prunes later, decision 0032), the reading font (each name in its own
  face) and the line width. Every change applies at once through the same
  preferences as Settings › Look and feel, which stays, with a line saying
  the Aa button does the same. It isn't modal; Escape closes it and returns
  the keyboard to Aa.
- **Quiet toolbars.** The desktop article line is icons only, each named in
  its tooltip with its key and for screen readers: Open original on the left
  (still always in the same place, still named "Open original"), then Aa,
  Copy link, Star and Mark unread on the right. On a phone the top bar has a
  back arrow and Open original, and the bottom bar has previous, next, Aa,
  star, mark unread and share, as icons without words.
- **The list's actions** moved beside its title as a Refresh icon and a
  "More" (…) menu holding Mark all as read and the sort order. `Shift+A` and
  `r` are unchanged. A search's "1 result" line sits quietly above the
  results.

**Kept.** The three panes, every key, every accessible name, the 44px touch
floor, the text-colored focus outline, and Open original on every article.
Previous and Next stay in the phone's bottom bar, since a phone has no `j`
and `k`.

**Bent, and logged.** The Aa panel and the More menu float over the page, so
each gets the one soft shadow such things get (DESIGN.md → Exceptions log).
DESIGN.md's "words for the way to the publisher" becomes an icon, with its
name kept for screen readers and in its tooltip.
