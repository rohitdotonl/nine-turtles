# 0124: The article list in the reading serif, with more room

*28 October 2026.*

**Decision.** The owner looked at twenty versions of the article list,
compared four of them in the real app, and chose version 7, "airy". What the
list looks like is in `docs/SPEC.md` section 6 and `docs/DESIGN.md` Part 2;
this note records the choice.

- Titles are set in the reading serif (Literata in Original), 19px with a
  mouse and the interface size on a touch screen, line height 1.35, so the
  list reads like a book's contents page rather than a feed.
- Each row has 22px above its title, 8px between the title and its meta
  line, and 28px below (was 14, 4 and 15, decision 0123). The meta line is
  spaced a little (0.06em). The unread dot stays centred on the title's
  first line.

**Why.** The tiebreaker: it makes nine turtles feel more like a book. The
serif was already in the app for article text and every screen's title, so
nothing new is downloaded.

**Trade-off.** Fewer rows fit on a screen (about five on a laptop instead
of nine). The owner chose calm over density. Version 8 (the same serif at
16px, the publisher in small capitals) was the denser alternative.
Version 2 was turned down because it hid the publisher's name on most rows,
which the "respect the publisher" floor doesn't allow.
