# Research errands report for nine turtles

Date: 3 November 2026. Written for Rohit, in plain English.

---

## 1. Bubbles and NewsBlur popular

- **Bubbles** (bubbles.town). "Independent blog posts, ranked by the community": a Hacker News style list that pulls posts from blog feeds, with upvotes and views for top, new, hot, random and "my". The page does not say who runs it or how blogs are added. One forum user called it "Hacker News but for non techy blogs." [bubbles.town](https://bubbles.town), [forum post](https://discourse.32bit.cafe/t/bubbles-town/4450)
- **NewsBlur popular** (popular.newsblur.com). A public "blurblog" called "The People Have Spoken": stories that NewsBlur users have shared, about 66,000 followers, with comments. Comments on old items are spammy. [popular.newsblur.com](https://popular.newsblur.com) NewsBlur itself is a paid reader (free tier 64 sites; Premium $36 a year, per [Feeder's comparison](https://feeder.co/knowledge-base/rss-basics/rss-feed-readers-for-android/)).
- Related and useful: **Ye Olde Blogroll** (blogroll.org), a hand-picked list of 1,308 personal blogs, sponsored by Micro.blog, no algorithms. [blogroll.org](https://blogroll.org)

---

## 2. Communities on Mastodon, Lemmy and Bluesky

**Answer.** I could not verify activity levels with my tools (Mastodon hashtag pages hide counts, Lemmy and Bluesky pages blocked or returned nothing). So the honest answer is: **communities very likely exist, but I have no measured numbers.** Please treat everything below as leads to check by hand.

**Evidence and leads.**
- Mastodon: the hashtag page exists at [mastodon.social/tags/rss](https://mastodon.social/tags/rss) but showed no counts to my tool. Likely related tags (from background knowledge, unverified): #rss, #feedreader, #smallweb, #indieweb, #blogroll.
- Mastodon feeds are themselves RSS: every account and hashtag has an RSS feed, so a reader can follow people on Mastodon without joining. [Feeder guide](https://feeder.co/knowledge-base/rss-feed-creation/mastodon-rss-feeds/), [Open RSS](https://openrss.org/feeds/mastodon)
- Lemmy: a post listing the RSS feeds each fediverse software offers exists on The Lemmy Club. [thelemmy.club](https://thelemmy.club/post/42153521) A guide on finding Lemmy communities after Reddit ended some RSS use exists: [muuted.com](https://muuted.com/reddit-rss-ending/). I could not open lemmy.world/c/rss to check subscriber numbers.
- Bluesky: could not be searched without signing in. Bluesky also offers RSS per profile (background knowledge, unverified).
- Related living communities: Micro.blog sponsors the hand-picked blogroll at [blogroll.org](https://blogroll.org); [RSS Parrot](https://rss-parrot.net/) turns RSS feeds into fediverse accounts. Reddit's r/rss exists (not fetched, per instructions).
- Suggested next step: Rohit or a helper searches these by hand on Mastodon (#rss, #smallweb), Lemmy (search "rss", "feedreader") and Bluesky (search "rss reader"), and notes follower counts of the accounts of NetNewsWire, Feedbin, Inoreader, FreshRSS and Miniflux (names from memory).

---

## 3. Ways RSS is stretched beyond the two- or three-pane reader

Examples first, with a verdict on fit for a calm "read people, write back" reader.

1. **Podcasting 2.0 `socialInteract`** (links an episode to a social post so replies can happen on the fediverse). Fit: **strong.** It is the most direct "write back" mechanism in a feed. nine turtles could show a "reply" link when present. [Podcast namespace](https://github.com/podcastindex-org/podcast-namespace/blob/main/docs/1.0.md)
2. **Podcasting 2.0 `transcript`, `chapters`, `person`.** Text of audio, chapter marks, credited people. Fit: **good.** Transcripts make audio readable, which suits a reading app and accessibility. Same source.
3. **Podcasting 2.0 `funding` and `value`** (a "support this" link; small payments to creators). Fit: **partial.** A plain "support the writer" link fits "the writer comes first"; the payment streaming part probably does not.
4. **JSON Feed 1.1 extensions** (any field starting with `_`, plus `authors`, `language`, `attachments`). Fit: **good.** Readers must ignore unknown extensions, so nine turtles can use rich fields safely and does not need to invent its own. [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/)
5. **WebSub** (the publisher's hub pushes new items instead of readers asking again and again). Fit: **useful behind the scenes.** Fresher articles with fewer requests, which helps "fetch politely". No visible interface needed. [W3C WebSub](https://www.w3.org/TR/websub/)
6. **OPML blogrolls and shared lists** (blogroll.org lists 1,308 independent blogs; Feedspot's directory). Fit: **strong.** Sharing "who I read" as a list is how people meet new writers without an algorithm. [blogroll.org](https://blogroll.org), [feedspot.com](https://www.feedspot.com)
7. **Feed-based social posting: Micro.blog** (a blogging service that publishes feeds and takes replies; background knowledge, only partly verified: its help site confirms it redirects feed paths) and **RSS Parrot / Mastodon feeds** (turn fediverse accounts into feeds, or feeds into fediverse accounts). Fit: **medium to strong.** People can be followed in the same list as blogs. [RSS Parrot](https://rss-parrot.net/), [Mastodon RSS](https://feeder.co/knowledge-base/rss-feed-creation/mastodon-rss-feeds/)
8. **Ranked or community views of feeds: bubbles.town** (upvotes on blog posts) and **NewsBlur blurblogs** (shared stories with comments). Fit: **weak to partial.** Votes and counts pull attention, which clashes with "nothing pulls". A hand-chosen, unranked "what my friends shared" list could fit. [bubbles.town](https://bubbles.town), [popular.newsblur.com](https://popular.newsblur.com)
9. **Filtering into new feeds (zacusca) and website watching (Feedbro's Website Watch).** Fit: **filtering fits** (nine turtles already has rules); **website watching does not** (it fetches pages, which nine turtles forbids).
10. **AI assistants over MCP** (nine turtles already has this; Feedbro and Feedly lean on AI summaries). Fit: **already there.** Keep it opt-in and reader-controlled, since the Feedly reviews show some readers resent AI-first redesigns.

---

## What this means for nine turtles

- **The market for plain reading is real but small per product.** Feedbro, by my low-confidence estimate, probably earns tens of thousands of dollars a year at $4.99 a month. A calm paid reader can be a one-person business, but expect gradual growth, not a spike.
- **Tool and feed-maker sites are weak competitors and a possible discovery channel.** Almost all of them have under 130,000 visits a month. Inoreader's tools are a funnel into its reader. nine turtles' website could do the same with a small, honest feed finder (it already allows this under its rules) that helps people find feeds, not scrape pages.
- **Never scrape, but read scraped feeds well.** Feeds from rss.app, feedfry and similar services are ordinary feeds. Make sure they import cleanly, and consider a small gentle note when a feed stops (these services lapse when someone stops paying).
- **Android reviews show what readers resent:** things silently marked read, surprise data use, ads, big redesigns, and a hard-to-find "add feed". Each is a promise nine turtles can make plainly (forgiving, honest by default, nothing pulls). Feedly at 4.5 stars with 5M+ installs also shows how large the audience is.
- **"Write back" has real building blocks:** `socialInteract`, Mastodon feeds and RSS Parrot. Worth a design trial: show a reply link when a feed supplies one, and credit the publisher.
- **Blogrolls beat rankings.** Hand-picked lists (blogroll.org, shared OPML) fit nine turtles; upvote lists (bubbles.town) clash with "nothing pulls". Consider making reader-to-reader sharing of "who I read" the way to discover people.
- **Use quiet standards behind the scenes:** WebSub and JSON Feed extensions improve freshness and richness without adding any visible noise. Transcripts from podcast feeds help accessibility.
- **Things still to check by hand:** Feedbro's real Chrome install count; whether zacusca uses keywords or AI (sign up with a small OPML); and the actual size of the Mastodon, Lemmy and Bluesky RSS communities. My tools could not confirm them.
