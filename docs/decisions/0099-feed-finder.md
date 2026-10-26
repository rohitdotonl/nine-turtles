# 0099: The feed finder on the website

*26 October 2026. The first free tool from the marketing plan, part of the
owner's plan for 100 to 200 readers (decision 0086).*

## Decision

- **A page on the website, nineturtles.app/feed-finder/,** where anyone pastes
  a site's address and gets the feeds the page names, each with a Copy
  button, and the five newest titles of the first, each linking to the
  publisher's own page. A bookmark button ("bookmarklet": a bookmark that
  runs a line of JavaScript) opens the finder with the page you're on; its
  address is also shown with a Copy button, so someone who can't drag
  (keyboard, screen reader) can make the bookmark by hand.
- **The app does the looking** (`GET /api/find-feeds?address=…`,
  `server/src/finder.rs`), because a browser won't let one site's page read
  another site's files. It's the same autodiscovery as Add feed (decision
  0016): the one page given, once, its `<link rel="alternate">` lines, never
  a guessed address, never an article's page; then the first feed once, for
  the preview. Same downloader, same limits, same refusal of private
  addresses. Anyone may ask, signed in or not.
- **Only the website's pages may use it in a browser:** the answer carries
  `Access-Control-Allow-Origin: https://nineturtles.app` ("cross-origin
  resource sharing", CORS), so other websites' pages can't read it. That
  doesn't stop a program asking directly; the limits below are for that.
  The website's script sends no cookies or referrer. If the website moves,
  change `WEBSITE` in `finder.rs`. It's a GET that changes nothing, so the check against other
  sites' actions (`security.rs`) doesn't apply.
- **Polite and hard to misuse:** an answer is remembered in memory for 30
  minutes (a failure for 5), at most 500 of them; one site (its host name,
  however the address is written) is looked up at most 6 times in half an
  hour, each fetching at most two files (the page, then its first feed); at
  most 4 lookups fetch at once and 60 in a minute, from everyone together.
  Past a limit the website says the finder or that site is busy. Limits
  are per site and for everyone together, not per visitor, so nothing
  about a visitor (not even an IP address) is held.
- **A page can't make an answer huge:** `discover::feeds_in` (for Add feed
  too) reads at most 10 feeds a page names, skips addresses over 2,048
  characters (a `<base>` too) and cuts names at 200 characters; the
  preview's titles are cut at 300. Without this, a page naming thousands
  of feeds under a long `<base>` could fill the server's memory.
- **Nothing is written down:** no address looked up goes in the database or
  the log, and the memory goes with each restart.
- **Links in the answer are web links only** (`http`/`https`), and the website
  builds the result with plain text, never the feed's HTML.

## Why not

- *A page inside the app:* the website is where people searching for "find
  RSS feed" land, and it should work without an account.
- *Doing it in the visitor's browser:* browsers block reading other sites'
  pages, so it can't.
- *Limits per visitor:* would mean holding IP addresses; the shared limits
  are enough for a tool this size.
- *Guessing `/feed` or `/rss.xml` when the page names nothing:* breaks
  decision 0016; the page says where else to look instead.
