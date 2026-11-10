# 0242: Get out of the way: the phone's bars step aside, one search field, one dot, a quieter Write back

*10 November 2026.*

Rohit's "Implement GW-1, 2, 3 (with a dot only on Unread folder), and 5"
(10 November 2026), for the critique through the principle "Get out of the
way" (`critique-24/principle-06-get-out-of-the-way.html`, in the project's
files): the interface is the frame, not the picture.

**Decision.**

- **The phone's bars step aside** (GW-1): in an article on a phone, one tap
  on the text (not on a link, a button, a highlight, a picture or a player,
  and not while words are chosen) puts the top bar and the bottom toolbar
  away, so the page is only the writer's words. Another tap brings them
  back, as do the keyboard reaching them (Tab), a new article, and
  scrolling to the article's end (so Next and Write back are there when
  you've finished). The text stays where it was on the screen: the scroll
  moves by the top bar's height. Only the reader's own tap or scroll
  changes anything, never a timer; nothing slides or fades. Put away, the
  bars stay in place for screen readers (drawn as `sr-only`), so nothing is
  lost to them. Scrolling never hides them by itself (principle 8). On a
  computer, full-screen reading (`f`, decision 0241) is the same idea.
- **One search field at a time** (GW-2): on a computer too, the list's
  search waits behind a Search button (a magnifier, tooltip "Search (/)")
  beside More, as on a phone since decision 0060; `/` opens it as before.
  The list starts right under its title, and the sidebar's find field,
  always shown by the owner's choice (Exceptions log), is the only field on
  screen until a search is asked for. While a search is on, the field
  always shows.
- **One dot in the sidebar, on Unread** (GW-3, with Rohit's "a dot only on
  Unread"): folders, people and publications no longer carry an unread dot.
  Unread carries the one dot, while anything anywhere is unread; screen
  readers hear it described as "Something new", and the link's name stays
  "Unread", so voice control always finds it. Articles in a list keep their dot
  and semibold title. This replaces decision 0148's dot at the end of every
  sidebar row with something new (its no-numbers rule stands).
- **A quieter Write back** (GW-5): at the end of a person's article, Write
  back is outlined, as Mark all as read ends a list, instead of solid ink:
  still clearly the way on, quieter than the writing it follows (principle
  2). This replaces decision 0183's "only solid button in the reading pane"
  for the article's end; Start reading stays the reading pane's one solid
  button, and Write to on their page stays solid.

**Not done.** GW-4 (no note after starring) and GW-6 (no drawn Start
reading button in a phone's list) weren't asked for.

**Why.** Each was a small piece of frame that stayed on screen while the
reader was there for the writing: an eighth of a phone's height in bars, a
second search field, a column of dots that read as a to-do list, and the
heaviest shape on the page under the last paragraph. Principle 1 (nothing
pulls) and principle 2 (the writer comes first) outrank keeping them.
