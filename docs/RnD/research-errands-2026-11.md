# Research errands report for nine turtles

Date: 3 November 2026. Written for Rohit, in plain English.

**How to read this report.** Each errand gives the answer first, then the evidence. Estimates carry a confidence level (low, medium, high). Honest warning up front: my tools could fetch live pages but could not open Similarweb's detailed numbers cleanly, Reddit was not tried, and several social-media pages blocked automated reading. Where I could not confirm something, I say so rather than guess quietly. "Similarweb" below means the free public page for each site (September or August 2026 data, which Similarweb itself calls estimated).

A quick guide to Similarweb "global rank": a smaller number means more visitors. Rank 8,000 is a giant site; rank 3,000,000 is a tiny one. I used the sites where I could read both a rank and a visit count (inoreader.com, rss.app, fetchrss.com) to guess visits for sites that showed only a rank.

---

## 1. Feedbro

**Answer.** Feedbro is a feed reader that lives mainly as a browser extension (Chrome, Firefox, Edge, Brave, Vivaldi), now also with a web version and an Android app (no iPhone app). It earns from a paid plan called "Coffee Club" at $4.99 a month, and probably some ads on the free plan. My estimate: roughly **$20,000 to $90,000 a year** in revenue (low confidence). Its website traffic is tiny (about 5,000 visits a month, low confidence); the real audience is in the browser stores.

**Evidence.**
- Feedbro's own site: Free plan = 50 feeds, 10 collections, 5 rules, 3 watched websites checked daily. Coffee Club ($4.99/month) = unlimited feeds, hourly checks on 10 watched sites, smart summaries, daily or weekly digests, no ads, premium fetching for sites that block servers, feeds behind a sign-in, full history and search. The page shows an "Advertisement" label, which suggests the free plan has ads (my inference, not stated). [feedbro.com](https://feedbro.com)
- Extra features that matter as competition: "Website Watch" (tracks pages that have no feed), read-aloud, YouTube import, 10 interface languages.
- AlternativeTo lists it as free, proprietary (not open source), developer Nodetics, 101 likes. [AlternativeTo](https://alternativeto.net/software/feedbro/about) The Chrome Web Store page is here, but my tool could not read the install count: [Chrome Web Store](https://chromewebstore.google.com/detail/feedbro/mefgmmbdailogpfhfblcnnjfmnpnmdfa). Please check that number yourself (open the page and look under the name). From memory it was in the low hundreds of thousands of users, but I did not verify this.
- Traffic: Similarweb shows feedbro.com at global rank about #4.34 million, with US 71% and Japan 29% of a very small base. [Similarweb](https://www.similarweb.com/website/feedbro.com/) By comparison with fetchrss.com (rank 460K, about 56K visits a month), this implies roughly **3,000 to 8,000 visits a month**. Confidence: low.
- Earnings reasoning: assume 150,000 to 300,000 people have ever installed it, about 70,000 to 150,000 are active, and 0.5% to 1% of active users pay $4.99 a month ($60 a year). That is about 400 to 1,500 payers, so $24,000 to $90,000 a year. A one-person developer product usually sits near the lower end. Confidence: low. If the Chrome Web Store count turns out far higher or lower, scale the estimate in proportion.

---

## 2. Traffic to RSS-tool websites

**Answer.** These tool sites are mostly small. Only Inoreader's whole site is big, and the RSS tools are a small slice of it.

| Site | Rough monthly visits | Confidence | Basis |
|---|---|---|---|
| inoreader.com (entire site) | about 4.9 million | medium | Similarweb chart, Sept 2026, rank #8,254 |
| inoreader.com/rss-tools only | about 50,000 to 150,000 (guess: 1% to 3% of the site) | low | My guess; Similarweb shows no per-page numbers |
| rss.app | about 125,000 | medium | 372.9K visits over three months, rank #94K |
| feedspot.com | about 1 to 2 million | low | Rank #21K, between inoreader and rss.app |
| fetchrss.com | about 56,000 | medium | Similarweb states it (rank #461K) |
| rssgizmos.com | about 5,000 to 15,000 | low | Rank #2.67M. The page showed "1,089,479" next to the rank but did not label it, and it is inconsistent with the rank, so I discounted it |
| feedfry.com | about 3,000 to 8,000 | low | Rank #3.03M; a chart showed about "3K"; other unlabeled numbers (461,710 and 175,751) conflict, so I ignored them |
| politepol.com | under 5,000 | low | Similarweb has no data for it, which means very low traffic |

**Evidence.**
- Inoreader: 4.9M visits, down 7.8% on the month; US 26%, Japan 13%, China 11%, UK 6%, France 6%; 89% of desktop visits are direct (people typing or bookmarking the address). [Similarweb inoreader.com](https://www.similarweb.com/website/inoreader.com/)
- rss.app: rank #94K, US 29%, India 7%, Brazil 7%, Spain 5%, UK 5%. [Similarweb rss.app](https://www.similarweb.com/website/rss.app/)
- Ranks of rivals (from the rss.app competitor page): inoreader #8,254, feedspot #21,235, feeder.co #80,995, feedly #4,089, fetchrss #460,886, feedfry #3,026,667. [Similarweb competitors](https://www.similarweb.com/website/rss.app/competitors/)
- What Inoreader's tools are: five free tools needing no account, namely a feed validator, a podcast validator, feed analytics (how many Inoreader readers follow a feed), a feed finder and an OPML checker. [inoreader.com/rss-tools](https://www.inoreader.com/rss-tools) These are a marketing funnel for Inoreader's paid reader.
- RSS Gizmos: free tools for making feeds from keywords, finding feeds via Wikipedia, and making and converting OPML files. Built by Calishat, no ads or payment shown. [rssgizmos.com](https://rssgizmos.com) It looks like a hobby project.
- fetchrss: [Similarweb](https://www.similarweb.com/website/fetchrss.com/). politepol: [Similarweb](https://www.similarweb.com/website/politepol.com/).

---

## 3. feedfry.com and the "make a feed from any site" products

**Answer.** They exist because many sites have no feed, and the "turn a page into a feed" job is easy to start, hard to do well, and people will pay to have it done reliably. Most earn from monthly subscriptions that scale with how many pages they check and how often. They are small businesses (a few thousand to low hundreds of thousands of visits). They matter to nine turtles in a limited way: readers will paste their feed addresses, so nine turtles should read them well, but should never build the scraping itself, which would break the "show only what the feed contains" floor.

**Evidence.**
- feedfry: finds repeated blocks in an HTML page (such as article previews) and turns them into an RSS feed. Sign-in optional. Pricing was not shown on the page I could read. [feedfry.com](https://feedfry.com) It is tiny: traffic fell about 21% last month. [Similarweb](https://www.similarweb.com/website/feedfry.com/)
- Others: rss.app (about 125K visits a month, the biggest of this group), fetchrss, politepol, getrssfeed.com (rank about #2.6M), Open RSS (which also publishes feeds for GitHub, Mastodon and others: [openrss.org](https://openrss.org/feeds/mastodon)) and fivefilters' createfeed. [Similarweb competitor list](https://www.similarweb.com/website/rss.app/competitors/)
- Why so many (my reasoning, medium confidence): (1) the problem is real, because lots of sites dropped their feeds; (2) a first version is a weekend project; (3) the paid tier can be priced on usage, so each customer pays steadily; (4) search engines send people looking for "RSS feed for [site]". Why most stay small: scrapers break whenever a site redesigns, and big sites block them.
- Relevance: a reader pasting `rss.app/feeds/...` or a feedfry address gives nine turtles an ordinary feed, so nothing special is needed. Two things to watch: such feeds can vanish when the reader stops paying, and the publisher is not the author of the feed. nine turtles should keep crediting the original site's link, which the feed items usually carry.

---

## 4. What these are

- **RSS Guard** (github.com/martinrotter/rssguard). A free, open-source desktop reader for Windows, Linux, BSD, OS/2 and macOS (GPL v3). Reads RSS, Atom, JSON, and connects to Feedly, Inoreader, FreshRSS and others; plays podcasts. About 2.7K GitHub stars; latest release 5.2.5 (20 August 2026). [GitHub](https://github.com/martinrotter/rssguard), [releases](https://github.com/martinrotter/rssguard/releases)
- **Feedspot** (feedspot.com). Two businesses in one: a reader for blogs, podcasts and YouTube, and a directory of about 750K blogs and creators with a "Media Contact Database" (about 250K contacts) sold to PR and marketing teams. Claims 120M visits to its lists. Prices weren't shown; the contact database is the likely money maker (my inference). [feedspot.com](https://www.feedspot.com)
- **Bubbles** (bubbles.town). "Independent blog posts, ranked by the community": a Hacker News style list that pulls posts from blog feeds, with upvotes and views for top, new, hot, random and "my". The page does not say who runs it or how blogs are added. One forum user called it "Hacker News but for non techy blogs." [bubbles.town](https://bubbles.town), [forum post](https://discourse.32bit.cafe/t/bubbles-town/4450)
- **NewsBlur popular** (popular.newsblur.com). A public "blurblog" called "The People Have Spoken": stories that NewsBlur users have shared, about 66,000 followers, with comments. Comments on old items are spammy. [popular.newsblur.com](https://popular.newsblur.com) NewsBlur itself is a paid reader (free tier 64 sites; Premium $36 a year, per [Feeder's comparison](https://feeder.co/knowledge-base/rss-basics/rss-feed-readers-for-android/)).
- Related and useful: **Ye Olde Blogroll** (blogroll.org), a hand-picked list of 1,308 personal blogs, sponsored by Micro.blog, no algorithms. [blogroll.org](https://blogroll.org)

---

## 5. zacusca.net

**Answer.** A beta service that tries to "separate signal from noise" in your feeds. You give it an OPML file (the export file from your current reader), pick the categories you care about, and it hands back new feeds containing only the matching items. How it decides what matches is **not explained on its public page**, so I cannot say whether it uses keywords or AI.

**Evidence.**
- The four steps on the page: import your feeds, choose categories, it fetches and sorts items into those categories, it returns new feeds. [zacusca.net](https://zacusca.net) No pricing, accuracy claims or output format are given. A second page (about) could not be opened, so details are missing.
- Confidence that it is "filter by category and republish as feeds": high. Confidence about the method: none. Worth a hands-on test by signing up with a small OPML file.
- Fit: the idea (a quieter, filtered stream) matches nine turtles' calm aim, but nine turtles already has rules and folders (its own MCP tools include add_rule and list_rules). The part to note is the delivery: output as plain feeds, which any reader can use.

---

## 6. diffbot/rss-anything

**Answer.** A small open-source (MIT) web tool that turns a page which lists links into an RSS feed, using Diffbot's paid Extract API (an AI service that reads web pages) to find the list. Not useful to nine turtles directly, and in conflict with its rule of never reading article web pages.

**Evidence.**
- Python/Flask app, Docker setup with Redis caching; it powers rss.diffbot.com. 98 stars, 7 forks, 4 open issues, 21 commits; no visible dates. [GitHub](https://github.com/diffbot/rss-anything)
- Why not useful: it needs a Diffbot account, it is a scraper, and the repository looks inactive. It is one more example of the "feed from any site" group in errand 3. Readers can still paste its output feeds. Licence is MIT (permissive), but the repo itself is of no use to nine turtles' code.

---

## 7. Google Play: how feed readers rank

**Answer.** Feedly is far ahead in installs (5M+, rating 4.5). Inoreader follows (500K+, rating about 3.4). Feeder and NewsBlur each sit at 100K+ (3.8 and 4.3). I could read only these four Play pages. Others (FocusReader, Read You, Capy Reader, Flym) were blocked. Play shows installs in bands only (100K+, 500K+, 5M+), and only three reviews were visible to my tool each, so the "what reviewers say" notes are a thin sample (low confidence).

| App | Rating | Installs | Praised | Complained about |
|---|---|---|---|---|
| Feedly | 4.5 (about 273K to 317K ratings) | 5M+ | (small sample, none praised) | New design is worse than "Feedly Classic"; back gesture and settings; feeds stop loading in outages; no in-app support; AI and cybersecurity focus over plain reading |
| Inoreader | about 3.3 to 3.4 (about 9K) | 500K+ | Opening in browser; 150 free sources | Big background data use; stuck "new article" counter that covers the top article; reported rise in ads (developer says there are none) |
| NewsBlur | about 4.2 to 4.3 (about 2.6K) | 100K+ | (small sample) | Items marked read silently; feeds muted after trial ends; adding a feed to a folder removed others on Android 12 |
| Feeder | 3.8 (about 2.2K) | 100K+ | Reliable notifications, simple and clean, smooth, draggable scrollbar | Hard to find "add feed"; list layout; wants favicons and sort by source; hard to find feeds |

Sources: [Feedly](https://play.google.com/store/apps/details?id=com.devhd.feedly), [Inoreader](https://play.google.com/store/apps/details?id=com.innologica.inoreader), [NewsBlur](https://play.google.com/store/apps/details?id=com.newsblur), [Feeder](https://play.google.com/store/apps/details?id=com.nononsenseapps.feeder.play). Pricing and the wider field: [Feeder's Android comparison](https://feeder.co/knowledge-base/rss-basics/rss-feed-readers-for-android/) (Feeder free 200 feeds, Plus $7.99 a month billed yearly; Feedly Pro $6; Inoreader Pro $7.50; FocusReader, Capy Reader, Twine free) and [Android Authority's list](https://www.androidauthority.com/best-rss-reader-apps-for-android-2-174770/) (Feeder, Feedly, Flipboard, Flym, FocusReader and others; this article is older).

Pattern across reviews: people complain about trust (things marked read, data used, ads, redesigns) and about confusing basics (where to add a feed). They praise simplicity and reliability. Both match nine turtles' calm, forgiving principles.

---

## 8. Communities on Mastodon, Lemmy and Bluesky

**Answer.** I could not verify activity levels with my tools (Mastodon hashtag pages hide counts, Lemmy and Bluesky pages blocked or returned nothing). So the honest answer is: **communities very likely exist, but I have no measured numbers.** Please treat everything below as leads to check by hand.

**Evidence and leads.**
- Mastodon: the hashtag page exists at [mastodon.social/tags/rss](https://mastodon.social/tags/rss) but showed no counts to my tool. Likely related tags (from background knowledge, unverified): #rss, #feedreader, #smallweb, #indieweb, #blogroll.
- Mastodon feeds are themselves RSS: every account and hashtag has an RSS feed, so a reader can follow people on Mastodon without joining. [Feeder guide](https://feeder.co/knowledge-base/rss-feed-creation/mastodon-rss-feeds/), [Open RSS](https://openrss.org/feeds/mastodon)
- Lemmy: a post listing the RSS feeds each fediverse software offers exists on The Lemmy Club. [thelemmy.club](https://thelemmy.club/post/42153521) A guide on finding Lemmy communities after Reddit ended some RSS use exists: [muuted.com](https://muuted.com/reddit-rss-ending/). I could not open lemmy.world/c/rss to check subscriber numbers.
- Bluesky: could not be searched without signing in. Bluesky also offers RSS per profile (background knowledge, unverified).
- Related living communities: Micro.blog sponsors the hand-picked blogroll at [blogroll.org](https://blogroll.org); [RSS Parrot](https://rss-parrot.net/) turns RSS feeds into fediverse accounts. Reddit's r/rss exists (not fetched, per instructions).
- Suggested next step: Rohit or a helper searches these by hand on Mastodon (#rss, #smallweb), Lemmy (search "rss", "feedreader") and Bluesky (search "rss reader"), and notes follower counts of the accounts of NetNewsWire, Feedbin, Inoreader, FreshRSS and Miniflux (names from memory).

---

## 9. Ways RSS is stretched beyond the two- or three-pane reader

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
