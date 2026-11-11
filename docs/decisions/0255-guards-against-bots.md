# 0255: A site's guard against bots is named as such

**In one line:** When a guard in front of a site (Cloudflare's bot check, Vercel's, Sucuri's, Imperva's, Akamai's, Amazon's) turns nine turtles away, the fetch says `Blocked` (by the guard's own headers, or for a 403 or a 503 with no time to wait, by the first 32 KB of its page), the reader sees "The site's guard against bots turns nine turtles away. Only the site can let it in.", a guarded site isn't asked again in the same lookup, and the publishers' page tells site owners how to let nine turtles in

*11 November 2026.*

Rohit's to-do: "check that publishers' websites don't block our feed
checker". He said go on 11 November 2026.

**What was found.** Among the owner's feeds that had failed for three
days or more, none was turned away by a guard: no 401, 403 or guard's
answer among them. The rest were addresses that had moved or gone, and
YouTube channels whose feeds YouTube keeps answering "not found"
although the channels exist (decision 0159). And the checker already
introduced itself the way well-behaved feed readers do: its name,
version and the publishers' page in the User-Agent, never pretending to
be a browser, "anything new?" questions, compressed answers, one request
per site at a time, and obeying "slow down".

**What was missing.** Had a guard turned it away, nobody would have
known. A Cloudflare check answering 403 read as "The site refuses to share
this feed", one answering 503 as "The site has a problem of its own", and
Vercel's check, which answers 429, as "The site asked nine turtles to slow
down", so it waited as if asked. Adding such a site said "The site didn't
answer". Each points the reader at the wrong cause.

**What changed.**

- `fetch::guard` recognises a guard by the headers guards send only when
  they act (`cf-mitigated: challenge`, `x-vercel-mitigated`,
  `x-amzn-waf-action`, `x-sucuri-block`), and, for a 403 or a 503 without
  `Retry-After`, by words only a guard's page carries, reading at most
  32 KB of it. A 429's page is never read: that's a site asking to slow
  down. Recognised, it's `FetchError::Blocked`, the problem word `blocked`.
- Everyone you follow: "The site's guard against bots turns nine turtles
  away. Only the site can let it in." For a person, the card already adds
  "… may not know." and Write to.
- Add, Follow this person?, Find new address, the website's feed finder
  and the blog checkup say it in their own words. A lookup stops at a
  guarded site rather than trying its other addresses.
- The publishers' page explains how to let nine turtles in: best, let
  everyone reach the feed's address past the bot checks; or else let
  user agents starting `nine-turtles/` through.

**Not done, on purpose.** nine turtles still never pretends to be a
browser to get past a guard: that would break "fetch politely" and the
publisher's choice. The User-Agent keeps no "Mozilla": guards such as
Anubis, popular on small blogs, check only visitors that claim to be a
browser, and let honest feed readers through.
