# 0106: Fixing a dead feed where you are

*October 2026.*

**Decision.** A feed that isn't working now says so where the reader
already is, and Find new address can be pressed there, not only on the feed
health page (decision 0071). When the site names just one feed, the reader
is asked one plain question instead of being shown a list of one.

- **When:** only while the feed health page lists the feed (two failed
  checks in a row, `health::LISTED_AFTER`). The feeds list (`GET /api/feeds`)
  now carries `failing_since` for exactly those feeds, and nothing for the
  rest, so the screens need no extra request.
- **Where:** one quiet line above the feed's own list, in the second ink
  and the small size, under the search field where a search's count sits:
  "This feed hasn't worked since 12 October." and a text button, "Find its
  new address" (SPEC section 6). The same line starts Edit feed, with "Find
  new address" (section 15). No accent, no red, no icon: it is information,
  not an alarm (DESIGN.md: one accent, one family of meanings; calm over
  engagement). Folders, the views and search results show no such line.
- **Still only on request:** nothing is fetched until the reader presses
  the button, and then only the one page decision 0016 allows (the site the
  feed names, or its address's home page). It never runs on its own.
- **One way, three places:** `NewAddress.svelte` shows what the find
  answered, in place, identically on the health page, above the list and in
  Edit feed (`FailingLine.svelte` is the line for the last two). One feed:
  "Use https://… instead?", "Its name, folders, articles and stars stay.",
  Cancel and Use it, with the keyboard on Use it (screen readers hear the
  question with it). Several: the existing choice of one with Use this
  address. None: the existing plain sentence. One status line announces
  each step; Cancel returns the keyboard to the button that started it;
  after a move the keyboard goes to the list's or sheet's title, since the
  button has gone.
- **Edit feed moves at once,** as the health page does, not on Save: the
  move is its own action with its own answer, and the form's other changes
  wait for Save as before.
- **A feed others follow too** gets a new number when the reader moves
  (decision 0071, `follow_elsewhere`): the list or Edit feed goes to the new
  number, in the same step as the feeds reload. Its success line stays on
  the list, and Edit feed stays the same sheet (it isn't rebuilt for the new
  number), so its success line and anything typed in it stay too.
- **On the health page,** a moved feed stays in its group and keeps its
  place until the page is opened again, even a dead one that now works or
  one whose number changed, so its success line stays with it.
