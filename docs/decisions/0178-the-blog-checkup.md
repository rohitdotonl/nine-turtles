# 0178: The blog checkup

*4 November 2026.*

**Decision.** The website gets a free tool for writers, "Is your blog easy to
follow and write to?", at nineturtles.app/blog-checkup/ (SPEC section 43). A
writer pastes their blog's address; it shows whether there's a feed, whether
the feed names them, and the ways a reader can write to them, at three
levels: a contact page (enough), their email in the feed (best), and "Reply
by email" on each post (optional, never required). Under anything missing,
the fix for their platform.

- **Built on what's there:** the feed finder's lookup and its memory and
  limits (`finder::guarded`, shared by both tools), Write back's reading of a
  feed's addresses (`write_back::named`, `in_posts`) and of a site's home and
  contact pages (`write_back::site`). New code is `server/src/checkup.rs`
  (`GET /api/checkup?address=…`) and the website's page and script.
- **The second floor** gets a third visit, shaped like Write back's: when
  someone asks the checkup about a blog, its feed found as the feed finder
  finds it, then its home page and, only if that shows no address, one
  contact or about page it links to. Anyone can ask about any blog, so it's
  held by the feed finder's limits (any one site at most six lookups in half
  an hour, shared by both tools), not "once". The page given isn't fetched
  twice.
- **No addresses handed out:** the checkup says only whether the site shows
  an address, never which, so it can't be used to collect addresses a site
  hid from bots. The feed's own address is shown: the feed is public.
- **A site that didn't answer** is remembered for five minutes, as a
  failure is, so "try again in a few minutes" is true.
- **Honest fixes:** a platform's fix says only what's known to be true;
  where no setting is known, it says so.

**Why.** Step 12 of the owner's review: Write back works best when writers
make themselves reachable, and many don't know how. The name, wording and
floor line were agreed with the owner's review thread (4 November 2026),
which Rohit asked to settle the plan's wording; the floor line was then
made more exact after the second-agent review (anyone can ask about any
blog, so "a few times in half an hour", not "once").
