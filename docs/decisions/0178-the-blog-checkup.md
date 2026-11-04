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
- **The second floor** gets a third visit, with the same shape as Write
  back's: when a writer asks the checkup to look at their own blog, the page
  they give, its home page and one contact or about page it links to, once.
  The page given isn't fetched twice, and the contact page is fetched only
  when the home page shows no address.
- **Honest fixes:** a platform's fix says only what's known to be true;
  where no setting is known, it says so.

**Why.** Step 12 of the owner's review: Write back works best when writers
make themselves reachable, and many don't know how. The name, wording and
floor line were agreed with the owner's review thread (4 November 2026),
which Rohit asked to settle the plan's wording.
