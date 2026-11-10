# 0168: Write back visits the writer's site once

**In one line:** The second floor's new line: a site is visited only when the reader asks, never an article's page; Write back with no known address looks once on the writer's home page and one contact or about page it links to, never twice for the same writer; what it finds fills the field for the reader to check (structure change 36)

*3 November 2026, the owner's review plan, step 4 (item 15, part 2). Rohit's
yes, in his own words, 3 November 2026; the floor's wording settled by the
owner's critique thread, which Rohit asked to decide copy and floors for
this plan ("Anything that touches a floor, use your discretion; we have
talked about everything").*

**The question.** Write back needs the writer's email address. Feeds give it
about a third of the time (decision 0147, and step 3 of the plan finds more
in posts' text), but a writer's site often shows it on its home, contact or
about page. Reading those pages is a page the reader didn't paste, which the
second floor ("respect the publisher") didn't allow. Floors have no
exceptions; only the owner can change a floor's wording (DESIGN.md → "Rules
about the rules"), so this is a new wording, not an Exceptions log entry
(that log is for principles).

**The new line in the second floor** (DESIGN.md):

> **Visit a site only when the reader asks, and never an article's page.**
> There are two visits: to find a feed when the reader adds one (the page
> they give, and if it names none, its home page and a few usual feed
> addresses), and, when they press Write back and no address is known, to
> look once on the writer's home page and one contact or about page it links
> to. Never in the background, and never twice for the same writer.

**How it works** (SPEC section 37, `server/src/write_back/site.rs`):

- Only when the reader presses Write back and no address is known. The box
  says "Looking on their site…" in plain words, nothing moving.
- The site the feed names, else the home page of its newest article's site.
  Never an article's page.
- The home page first; if it gives no address, the one contact page it links
  to on the same site, else its about page. Two pages at most, 8 seconds at
  most in all; after that the box asks.
- An address counts from an email link, Cloudflare's hidden form, or the
  page's shown text. One at the site's own name wins; else the page's only
  one; several others give none. "No-reply" addresses never count.
- What's found only **fills in the field**: the reader checks it and presses
  Write back, which keeps it as their own (a page can show someone else's
  address, like a theme maker's). The bold alternative, opening the email
  app straight away, was turned down: the visit is a guess, and honesty by
  default wins.
- **Never twice for the same writer:** what was found, or that nothing was,
  is kept on the feed (structure change 36: `feeds.site_looked_at`,
  `feeds.site_email`), for everyone who follows it, and for every place of
  the reader's person, once the visit is over. A site that didn't answer in
  time isn't counted, so a later press tries again, and the box says nine
  turtles couldn't look ("honest by default"); a site that answered with an
  error or "slow down" is counted, and never asked again.
- Only a link whose whole words name a contact or about page ("Contact",
  "About me"), or a short address such as `/contact`, counts: a post called
  "About time" is never taken for one.
- The publishers' page (nineturtles.app/publishers) says so.

**Also changed to match:** `AGENTS.md`'s "Never fetch an article's web page"
rule, `ENGINEERING.md` → "Fetching feeds", and decision 0016's list of
visits.
