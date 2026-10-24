# 0038: Toolbars and chrome, and the reading pane's type

*24 October 2026. From the second Apple Books critique
(`ui-polish/critic-applebooks-2.md` in the project files, sections B6, C, D
and H), under the owner's goal that Apple Books is the only standard, with
their approval to change DESIGN.md and SPEC.md in everything except the
three-pane structure.*

*Superseded in part by decision 0040: the see-through, blurred top bar was
withdrawn (scrolled text ghosted through it), and the article's bars are now
solid in the page's color. The summary note moved under the closing rule as
small centred end matter, and the title no longer balances its lines.*

**Why.** The article's tools were lined up with the text column rather than
the pane, so on a very wide screen they floated in the middle of the page,
and five icons sat in a loose row (one, Mark unread, an opaque ring). The
list's title shared its line with three icons and was cut to "The M…" even
with room to spare. Text scrolling up was sliced under a hard line. On a
phone the article's bottom bar was six equal icons and the back button a
bare arrow. The article's title and its first heading competed, the byline
was as loud as the title's neighbourhood, and a summary-only article ended
with a centred sans "system message". Hiding the sidebar with `[` left a
focus ring around the list's title.

**What changed.**

- **The reading pane's top bar is anchored to the pane,** not the text: Open
  original at its left edge; Aa, Star and More (…) at its right. More holds
  Copy link (Share on phones) and Mark unread (its key, `m`, shown beside
  it). Four icons instead of five; every key is unchanged.
- **One More (…) beside the list's title,** as Apple Books has one per
  collection. It holds Mark all as read, Refresh (its key, `r`), the sort
  order, and Edit feed… or Edit folder… in a feed's or folder's own list.
  Choosing Edit puts the keyboard on More, so closing the sheet gives it back
  there. The title has the line to itself and wraps to a second line before
  ending in "…".
- **Translucent top bars.** The article's top bar (on a computer and a
  phone) is the page's own color at 85%, blurred, so the text fades under it
  rather than being cut off; the faint line under it still shows only once
  the text has scrolled. Where the system asks for less transparency
  (`prefers-reduced-transparency`), and in high-contrast modes, it is solid.
  This bends "no blur" in DESIGN.md, logged in its Exceptions log.
- **The phone's article bars.** At the top, the back button says the list's
  name in words ("‹ Tech"), with Open original at the right. At the bottom,
  five quiet icons: Previous, Next, Aa, Star and More (…), which opens
  upwards with Share (or Copy link) and Mark unread. Refresh moved into the
  list's More menu on phones too, so the "New items" note on a touch screen
  has its own **Show** button instead of "tap Refresh".
- **Reading type.** The title about 32px at the default size (1.6 times the
  text), line height 1.12, balanced; headings inside an article about 22px
  (1.1 times) with more room above; the byline quieter, at 13px in the second
  ink, 12px under the title, with the publisher's name in full ink and
  semibold (the interface fonts ship only regular and semibold).
- **A summary-only article's note** is its last paragraph, in the reading
  font, italic, in the second ink, left-aligned: "This feed shares only a
  summary. Read the full article on {publisher} ›", linking the original.
- **After `[` hides the sidebar** with the keyboard in it, the keyboard
  moves to the list itself (the selected article, or the first), not to the
  list's title; with no articles, to the sidebar button just used.

**Kept.** The three panes, every key and accessible name except those of
the moved buttons (now menu items with the same names), 44px touch targets,
the text-colored focus outline, Open original always at the same place on
every article, and the credit and link to the publisher.
