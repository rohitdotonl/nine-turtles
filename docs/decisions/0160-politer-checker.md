# 0160: An even politer feed checker

*3 November 2026. The owner asked whether any publisher blocks nine
turtles' feed checker, whether it follows the usual standards, and how it
could go further. He chose these changes ("Implement every suggestion
except 4").*

**What was found.** No publisher blocks the checker. Every feed that kept
failing gave the checker the same answer it gave a browser (tried from the
owner's Mac): the feeds had moved, were gone, or their sites had lapsed.
The checker already met the common feed-reader rules: it names itself,
asks "anything new?" with ETag and Last-Modified, obeys 429 and
Retry-After, backs off failing feeds, fetches each feed once however many
readers follow it, and never visits article pages.

**Decision.** Four additions:
1. **Once an hour at most** (was 30 minutes): `checking::SHORTEST_WAIT`.
   Everything that used the old minimum (WebSub's empty announcements, a
   returning reader's feeds, Retry for a working feed) now uses an hour.
   WebSub still brings articles from busy sites within minutes.
2. **The publisher's `Cache-Control: max-age`** on a 200 or a 304 makes the
   next check wait at least that long, up to a day (`fetch::fresh_for`), so
   the "at least once a day" rule still holds. `no-cache` and `no-store`
   mean "ask again", never "ask sooner", so they count as saying nothing.
3. **One site at a time:** within a round, two feeds on the same site are
   never fetched at once; the later one waits for the earlier
   (`checking::site`). The site is the host's last two parts, so every blog
   on a shared platform (`*.bearblog.dev`) takes turns too; names like
   `example.co.uk` share `co.uk` with others, which only means they take
   turns. No list of such endings is kept (no new library).
4. **A page for publishers** at nineturtles.app/publishers/
   (`website/src/publishers.md`), named in the User-Agent:
   `nine-turtles/<version> (+https://nineturtles.app/publishers/)`. The
   idea came from the Artemis reader's bot page. Never an email in it.

**Not done.** Checking a feed that answers 410 "gone" weekly instead of
daily (the owner left it out). Reading robots.txt: feed readers fetch a
feed someone chose to follow, which robots.txt isn't meant for, and the
two failing sites whose robots.txt says "Disallow: /" were gone anyway.

**Left for the owner.** With an hour as the minimum, Edit feed's "Hourly"
now does the same as "Automatic" for busy feeds.
