# 0095: The feed finder on the website

*26 October 2026. The first free tool from the marketing plan, part of the
owner's plan for 100 to 200 readers (decision 0086).*

## Decision

- **A page on the website, nineturtles.app/feed-finder/,** where anyone pastes
  a site's address and gets the feeds the page names, each with a Copy
  button, and the five newest titles of the first, each linking to the
  publisher's own page. A bookmark button ("bookmarklet": a bookmark that
  runs a line of JavaScript) opens the finder with the page you're on.
- **The app does the looking** (`GET /api/find-feeds?address=…`,
  `server/src/finder.rs`), because a browser won't let one site's page read
  another site's files. It's the same autodiscovery as Add feed (decision
  0016): the one page given, once, its `<link rel="alternate">` lines, never
  a guessed address, never an article's page; then the first feed once, for
  the preview. Same downloader, same limits, same refusal of private
  addresses. Anyone may ask, signed in or not.
- **Only the website may read the answers:** the answer carries
  `Access-Control-Allow-Origin: https://nineturtles.app` ("cross-origin
  resource sharing", CORS), and the website's script sends no cookies or
  referrer. It's a GET that changes nothing, so the check against other
  sites' actions (`security.rs`) doesn't apply.
- **Polite and hard to misuse:** an answer is remembered in memory for 30
  minutes (at most 500), so a site many people look up is visited at most
  twice an hour (the page, then the feed); at most 4 lookups fetch at once
  and 60 in a minute, from everyone together; past that the website says
  "The finder is busy just now". Limits are for everyone together, not per
  visitor, so nothing about a visitor (not even an IP address) is held.
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
