# 0014: Adding feeds

*23 October 2026, Milestone 5. Plan approved by the owner, including both choices below.*

**Autodiscovery looks at exactly the page you paste.** The earlier rule said
slowfeed only ever visits a site's home page. Some blogs live inside bigger
sites (`medium.com/@someone`), where the site's home page names a different
feed, so the owner chose: slowfeed visits the one page pasted, once, because
they asked. It reads the `<link rel="alternate">` lines the page names and
never guesses other addresses (`/feed`, `/rss.xml`). It's still never done in
the background, and still never for an article's text. `AGENTS.md` and
`ENGINEERING.md` were reworded to match.

**Removing a feed stays in Milestone 9,** as planned (the owner's choice).
Removing needs an undo, which Milestone 9 builds; test feeds added before
then can be removed at that point.

**Private addresses are refused.** slowfeed fetches whatever address the
reader pastes, so without a check a pasted `http://169.254.169.254/` or
`http://10.0.0.5/` would make it visit the host's private network (a
"server-side request forgery"). The downloader (`server/src/fetch.rs`) looks
names up itself and keeps only public addresses, checks written-out number
addresses directly, and repeats both on every redirect. Only the tests turn
this off, with `SLOWFEED_ALLOW_LOCAL_FEEDS=yes`, to read made-up feeds.

**Redirects are followed by hand** (at most five), so slowfeed knows whether
every step said "moved for good" and only then remembers the new address.

**Content is cleaned before it's stored,** not when shown: the database never
holds anything unsafe, whichever screen later shows it. Milestone 6 adds the
reading clean-up (tracking images) on top.

**Article times:** the publisher's date, but never later than when slowfeed
received it, so a feed with dates in the future can't pin an article to the
top. Stored as `sort_at`, which the list and its indexes use.

**The list asks the database in list order** (`CROSS JOIN` in
`server/src/feeds.rs`). Written the ordinary way, SQLite chose to read every
article and sort afterwards; the new speed test (`server/tests/speed.rs`,
500 feeds and 100,000 articles) caught it. It now checks that the list
always uses its index and answers in under 100 ms.

**Pages of 50 use a cursor** (the last article's time and number), not "skip
the first 100", so a page deep in the past is as quick as the first.

**Certificates in the container image.** The runtime image now installs
Debian's `ca-certificates` package, the list of trusted authorities reqwest
uses to check publishers' `https://` addresses. It's part of the operating
system, not a library in the code.

**No "system proxy".** reqwest is used without its feature that reads proxy
settings from the host, so slowfeed always talks to publishers directly.
