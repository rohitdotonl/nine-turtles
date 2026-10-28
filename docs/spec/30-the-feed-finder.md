# 30. The feed finder (on the website)

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

*Built 26 October 2026 (decision 0099). A free page at nineturtles.app/feed-finder/, for anyone, with no account.*

- One field, **A website's address**, and **Find its feed**. Leaving off `https://` is fine. The line under it says the home page usually works, or a blog's own page inside a bigger site.
- While it looks, a line says "Looking at example.com…". Then it shows **Its feed** (or **Its feeds**): each feed's name and address, with a **Copy address** button (where copying isn't possible, the address is selected instead), and "Found 2 feeds. The first is usually the main one." when there are several. Under them, **Newest in** the first feed's name (linking to the publisher's site), its five newest titles, each linking to the article on the publisher's own website, with its date. A pasted feed address is its own answer.
- Problems are a plain sentence in the same line: not an address, a private address, the site not answering, the page not there, the page too large, no feed named ("Try the site's home page, or look on the site for a link called RSS, Atom or Feed. Some sites don't have one."), the finder busy ("Try again in a minute"), or that one site looked up a lot lately ("Try again in half an hour").
- It looks exactly as Add feed does (section 3): the one page given, once, and the first feed it names, once, for the titles. It never guesses addresses or visits articles. The same answer is remembered for half an hour (a failure for five minutes), and one site is looked up at most six times in half an hour, so asking again doesn't bother the publisher; nothing about who asked is kept. At most ten of a page's feeds are shown.
- The page's own address carries what was asked (`?address=…`), so a lookup can be shared or reloaded. **Find feed**, a button to drag to the bookmarks bar, opens the finder with the page you're on (pressed on the finder's own page, it says how to keep it). Its address is shown too, with **Copy bookmark address**, for a bookmark made by hand without dragging.
- The app's own Add a feed uses the same lookup when a page is shared to it (section 3, "Adding from anywhere"; decision 0104), with the same limits.
- Below: what it looks at, then "Paste the feed's address into any feed reader. In nine turtles it goes in Add feed," with a link to "New to feeds?". Linked from the website's footer and from "New to feeds?".
