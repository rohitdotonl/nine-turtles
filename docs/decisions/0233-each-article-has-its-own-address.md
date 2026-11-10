# 0233: Each article has its own address

*10 November 2026.*

Rohit's "implement all suggestions from rounds 1 and 2 except P03-8"
(10 November 2026), suggestion P03-3 of the critique through the principle
"Fit what people already do".

**Decision.**

1. **An open article's address sits under its list's:** `/people/5/articles/29`,
   `/unread/articles/29`, `/folders/3/articles/29`. The address bar shows it
   while the article is open (on a phone, while its screen is showing).
   Opening that address, by reloading, from a bookmark or in a new tab, opens
   the list with the article chosen and open; on a phone, Back from it goes to
   its list. Choosing another article changes the address in place, so j and
   k don't fill the browser's history; Back and Forward open the article an
   address names again. An address whose article can't be opened opens its
   list, whose note says so. An article address under anything but a list of
   articles is a wrong turn.
2. **Command-click, Ctrl-click or a middle click on a row** opens the
   article in a new tab, as on a link. A plain click does what it did.
3. **A row's own menu** gains a group: on a computer **Open in a new tab**
   and **Copy link**; on a phone **Share**. Copy link and Share give the
   original's address, the publisher's, as the article's More does (the
   second floor); a nine turtles address opens only for its own reader.

**Rows stay buttons.** The critique suggested making each row a real link.
That would change what screen readers say about every row, and the row's
keys (Enter opens, Space reads, the arrows move) already behave as a
button's. The browser habits people expect from a link (a new tab, reload,
bookmarks) all work through the address and points 2 and 3, so the rows
keep their role.

**How.** `web/src/lib/router.ts` (`withArticle`, `articleIn`) builds and
reads the address; `parse` ignores the article part, so a place is still
its list. `Shell.svelte` writes the address beside the tab's title
(decision 0231) and opens an article named by the address on arrival.
`web/src/lib/articleLinks.ts` has the row's new-tab handling and menu items,
and the Copy link and Share that the article's More also uses.
