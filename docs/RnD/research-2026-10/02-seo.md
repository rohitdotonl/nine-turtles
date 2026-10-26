# SEO for nine turtles (research, 25 Oct 2026)

Honesty note: the search tool here gave titles only and I could not reach Ahrefs, Semrush or Google Trends, so I have NO verified monthly search volumes. Where I rank demand, it is inference from who is writing about what; I mark it "inferred". Everything with a URL was actually read.

## 0. Headlines

1. Informational "how to" search is shrinking in clicks. Expect to win with (a) free tools, (b) comparison/"alternative" pages, (c) a small number of excellent evergreen guides, and (d) links and word of mouth, not volume blogging.
2. A live opening: Reddit is ending RSS on 13 Nov 2026 and closing its public API to new requests from 31 Oct (https://mjtsai.com/blog/2026/10/06/reddit-to-remove-rss/). Anyone who followed subreddits in a reader is about to search "reddit rss alternative". A calm, honest page now is timely (see 4.1). Note nine turtles' "feed health" and any Reddit feeds should be checked before promising anything.
3. Google itself says no special "AI optimisation" is needed: indexed, snippet-eligible, good text content (https://developers.google.com/search/docs/appearance/ai-features). No llms.txt or special schema required. So the plan is plain, good SEO plus being worth citing.
4. Programmatic SEO is risky: John Mueller (Bluesky, 7 Sep 2026, via https://www.techwyse.com/news/search-seo/google-john-mueller-programmatic-seo-site-trust-recovery) said it "often leads to a site that's either spam, borderline spam, or low quality", that trust is judged site-wide, and recovery takes significant time. Do a small, hand-curated version only.

## 1. What AI Overviews did to clicks (and what that implies)

- Pew (68,879 real searches, Mar 2025): click on a normal result 8% with an AI summary vs 15% without; 1% click a link in the summary; 18% of searches showed one. https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/
- Ahrefs (300k keywords, Dec 2023 vs Dec 2025): position-one CTR down about 58% where an AI Overview appears (0.073 to 0.016); lower positions lose less (about 51% at #2, 19% at #10). https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/
- Seer Interactive (3,119 informational queries, 42 clients): Q3 2025 organic CTR 1.45% without an AIO, 0.52% with an AIO and not cited, 0.70% when cited. Sept 2025: 0.61% vs 1.62%. https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-september-2025-update
- Google claims clicks from AIOs are "higher quality" (same Google doc above). Treat as marketing, but fewer, warmer visitors is plausible.

What still wins (my synthesis from the above): queries that need a tool or an action (a validator, a finder, an OPML converter); comparison and "alternative" queries where people want a human opinion and a product to try; brand/navigational searches ("nine turtles", "nine turtles vs Feedly"); pages that carry a distinctive point of view; and being cited inside AIOs/ChatGPT (cited pages did ~35% better in the Seer data). Definitions like "what is RSS" are the most AIO-exposed; do not make them the centrepiece.

## 2. Keyword landscape (all inferred; verify with free Google Search Console + Bing Webmaster after launch, or Ahrefs Webmaster Tools free)

Evidence of demand: every competitor writes "best RSS reader 2026" listicles (Feeder, smry.ai, usedigest, hushread, claritybriefs, yourtrace; results from my search, e.g. https://feeder.co/knowledge-base/rss-basics/best-rss-readers/). That crowd of affiliates and vendors implies the head term is both valuable and saturated. Feedly alone is about #4054 US, 11.3M monthly visits per Semrush's public page (https://www.semrush.com/website/feedly.com/overview/, a mostly security/enterprise audience now). AlternativeTo lists 336 Feedly alternatives, with Inoreader first (https://alternativeto.net/software/feedly/), so "Feedly alternative" is a real, contested intent.

Tiers for nine turtles:
- Tier A (too hard now): "RSS reader", "best RSS reader", "Feedly alternative". Aim for page two then later top 10 via links; do not expect early traffic.
- Tier B (winnable with a good page + tool): "RSS feed for [platform]" (Substack, YouTube, Medium, Bluesky, Mastodon, podcast, Google News, Tumblr, Blogger); "how to follow a Substack without email"; "read newsletters outside your inbox"; "Reddit RSS alternative" (new, time-limited); "Google Reader alternative"; "Pocket/Instapaper alternative for reading" is another adjacent door but outside scope here.
- Tier C (the founder's own audience, low volume but exactly right): "digital minimalism apps", "replace social media with", "how to read more online", "how to stop doomscrolling and read", "finite feed", "calm RSS reader", "RSS reader without notifications / without AI", "RSS for people who have never used it". Incumbents ignore these because they sell speed, AI and team features (Feeder pitches AI and MCP, Feedly pitches threat intelligence). The "calm / book-like" angle is genuinely unclaimed in listicles.
- Brand: "nine turtles" will be the main long-run source of conversions; make sure the brand name page and about page rank for it, and consider a name-disambiguation line (turtles are a generic word).

Platform feed formats (the raw material for Tier B; all verified in sources):
- Substack: `https://{name}.substack.com/feed` (https://docs.feedly.com/article/645-how-to-find-substack-rss-feeds). Substack Notes/user feed only via OpenRSS (https://openrss.org/blog/substack-feeds).
- Medium: `medium.com/feed/{name}` or `{name}.medium.com/feed`; Tumblr `/rss`; Blogger `/feeds/posts/default`; WordPress `/feed` (https://zapier.com/blog/how-to-find-rss-feed-url.md).
- Mastodon: profile URL + `.rss`; Bluesky: profile + `/rss`; Pixelfed `.atom`; Lemmy `/feeds/c/Name.xml`; PeerTube `/feeds/videos.xml?videoChannelId=ID`; Threads: no RSS (https://kvibber.com/tech-tips/fediverse-feeds/).
- Competitors' readers already auto-detect Bluesky, Mastodon, Reddit, YouTube handles (https://goldenhillsoftware.com/2025/01/unread-44-makes-it-easier-to-subscribe-to-feeds-offered-by-bluesky-mastodon-reddit-and-youtube). So "paste a handle" is a table-stakes feature to mention.

## 3. How competitors get traffic (what I could verify)

- rss.app: a programmatic grid of generator tool pages, one per platform (YouTube, Instagram, X, Reddit, TikTok, Facebook, Telegram, Bluesky, Threads, Google News, eBay, Craigslist…), plus conversion tools (RSS to JSON/CSV/HTML/email, Email to RSS) and spin-off single-purpose domains rssfinder.app, rssvalidator.app, rssviewer.app. Also bot pages ("YouTube Slack bot") and "solutions" pages. Source: https://rss.app/. Lesson: tool pages per platform + sister micro-domains. Caution: much of it is scraping-based (Instagram/X/Facebook feeds), which nine turtles must not copy.
- Feeder: a "knowledge base" with a dated "Best RSS readers in 2026" page, honest self-disclosure, comparison table, FAQ, head-to-head pages ("Feeder vs Feedly", "Feedly alternatives"), topic pages and "State of RSS" data report (https://feeder.co/knowledge-base/rss-basics/best-rss-readers/). This is the template to beat on tone.
- Feedly: huge via brand and a Help Center article per platform ("How to find Substack RSS feeds", https://docs.feedly.com/article/645-how-to-find-substack-rss-feeds), i.e. help docs double as SEO. I could not read its directory pages.
- Inoreader: blog categories (How-to, Pro tips, Learn), platform-change explainers (e.g. Reddit ending RSS), "Feed finder" as a tool, "Inoreader alternatives" only in footer (https://www.inoreader.com/blog/). Blog titles are older (2021-22), suggesting the blog is not their growth engine.
- WP RSS Aggregator: "RSS Feed URLs by Platform" directory with one templated page per platform, status labels (Native/Limited/No native RSS) and URL format table (https://finder.wprssaggregator.com/rss-feeds/platform). Small, tidy, genuinely useful programmatic design; closest model for us.
- Open RSS (501(c)(3), donation-funded) generates feeds for Substack, YouTube, Reddit, GitHub (https://openrss.org/blog/substack-feeds). Kill the Newsletter (open source, one developer, donations) turns an email address into an Atom feed; entries expire after a month (https://kill-the-newsletter.com/). Both are link magnets in newsletter-to-RSS conversations; our coming email inbox feature competes in this space and should be described honestly as a built-in alternative.
- Plenary's awesome-rss-feeds (2.8k stars, CC0, about 500 feeds + OPMLs) and AboutRSS/ALL-about-RSS (5.9k stars) show that a curated, open-licensed OPML list is a link and star magnet (https://github.com/plenaryapp/awesome-rss-feeds, https://github.com/AboutRSS/ALL-about-RSS).

## 4. Page and idea list (what / why / effort / payoff)

### 4.1 "Reddit is ending RSS: what to do" (timely guide)  
What: short, factual page: date (13 Nov 2026), what changes, what will and will not keep working, how to follow subreddits' replacements (Lemmy, mailing, other sites). Why: spike in intent, competitors will post (Inoreader already writes platform-change explainers). Effort: 1 day. Payoff: moderate, short-lived but earns links and cites; update when facts settle. Be careful not to claim nine turtles supports Reddit unless it does. Source: mjtsai link above.

### 4.2 Free tool: Feed finder + previewer (high priority)
What: paste any site, handle or URL, get the feed address(es) and a preview of the latest titles, with "open in nine turtles" button and also "copy address for any reader". Autodiscovery on a page the user pastes is explicitly allowed by decision 0016, so no floor conflict; never crawl article pages. Why: tool queries are AIO-resistant; competitors (rss.app/rssfinder.app, Inoreader feed finder) prove demand. Effort: medium (reuse backend discovery code; rate limit; a stand-alone page on nineturtles.app calling the server). Payoff: highest of any tool. Risk: abuse, so rate-limit and cache.

### 4.3 Free tool: OPML tidy-up (merge, dedupe, check dead feeds, convert)
What: upload OPML, see which feeds are dead/moved, download a cleaned file. Why: switching-reader moments ("export OPML from Feedly") are the exact acquisition moment. Effort: low-medium; do in-browser to avoid storing anything. Payoff: good, plus a natural entry to "import into nine turtles". Never ask for the owner's own OPML in the repo.

### 4.4 Feed validator
What: check an RSS/Atom/JSON Feed for errors in plain language. Why: webmasters and bloggers link to validators; rssvalidator.app exists, W3C validator is dated. Effort: low-medium. Payoff: backlinks from the blog/IndieWeb crowd, which also serves the "blogroll culture" goal.

### 4.5 "RSS feed URL formats" reference (small directory, 15-25 pages max)
What: one hand-written page per platform: Substack, YouTube, Medium, Tumblr, Blogger, WordPress, Ghost, Bluesky, Mastodon, Lemmy, PeerTube, podcasts, GitHub, Google News, Hacker News, Wikipedia, arXiv, Letterboxd, etc. Each page: exact format, a verified example, the gotchas, and the honest "no native RSS" cases (Threads, Instagram, X, LinkedIn: say so, link to the publisher, do not offer scrapers). Why: Feedly and WP RSS Aggregator rank for these; the angle "and here is what to read instead" is ours. Effort: 2-3 days for 20 pages, then verify each URL quarterly. Payoff: moderate and steady. Quality rule: each page needs original, verified information. If a page cannot say anything beyond a pattern, merge it into a hub table.

### 4.6 Comparison pages (the commercial core)
What: "nine turtles vs Feedly / Inoreader / NetNewsWire / Reeder / Readwise Reader / Feedbin" plus one honest "Best RSS reader for reading, not monitoring" page, dated and updated. Why: AlternativeTo and Feeder show this intent is live; calm-vs-power framing is differentiated. Follow Feeder's pattern (disclose, table, FAQ, "who should not use us") but with the book metaphor. Effort: 1 day each, 4-6 pages. Payoff: best for conversions per visitor, even at low traffic.

### 4.7 Feeling-led essays (Tier C)
What: 5-8 strong pieces: "A quiet place to read the web", "How to replace your scroll with a finite reading list", "What reading blogs instead of social feels like", "How to read more online", "Reading list rituals". Why: your ideal readers search these; also what newsletter writers and podcasters link to; AI summaries cannot replace voice. Effort: high (writing quality matters). Payoff: slow but compounds; this is also the content most likely to be cited by AI search.

### 4.8 "Does [site] have an RSS feed?" pages
What: a lookup page per well-known site. Assessment: this is the textbook thin-content template; do not generate hundreds. A hand-checked hub of roughly 100 top sites in one table (name, feed URL, last checked), as a single long page plus OPML download, is allowed and useful, and fits "show only what the feed contains". Individual pages only for a handful with unusual stories (Substack, Reddit, Medium). Risk per Mueller: site-wide trust loss. Effort: 2 days. Payoff: moderate links (OPML downloads get starred; see the awesome lists).

### 4.9 Downloadable OPML bundles
Founder dropped "starter packs", so keep this to a quiet resource (one page, no promotion) or skip. If done, publish CC0 like Plenary's list so lists and curators link to it.

### 4.10 Things I would not do
- Webpage-to-RSS generator (rss.app's biggest idea): it is scraping; conflicts with the floor "show only what the feed contains / never scrape". Say plainly in the FAQ that nine turtles doesn't do it and point to publishers' own feeds or OpenRSS instead. Honest differentiation.
- "Feed reading time estimator" and other gimmicks: low demand, off-brand.
- Mass-generated pages, AI-written lists, doorway pages.

## 5. Backlink targets for a tiny site (concrete)

- AlternativeTo: add nine turtles as an alternative to Feedly, Inoreader, Reeder (https://alternativeto.net/software/feedly/ lists 336; "suggest new app" is on the site's menu, I did not see it on that page).
- Awesome lists: ALL-about-RSS (5.9k stars, PR-based, https://github.com/AboutRSS/ALL-about-RSS); Plenary awesome-rss-feeds is for feeds not readers (https://github.com/plenaryapp/awesome-rss-feeds), but a PR adding good feeds (or a link from our OPML) is a goodwill route. awesome-selfhosted only if nine turtles is self-hostable and meets its license rules, which I did not check; the repo is public, so ask the owner whether self-hosting is a goal.
- Blog directories with human curation: ooh.directory (https://ooh.directory/, submission process not stated on page; the founder's personal blog www.rohit.onl could be listed first).
- Tools lists: wikis such as "RSS reader" pages, Wikipedia's comparison of feed readers (edits need independent sources; do not self-promote there).
- Product Hunt and Hacker News "Show HN": one-time launches; fits an open-source, calm positioning; no fake scarcity. I did not research current rules; check each site's self-promotion rules.
- Reader apps: Feedly/NetNewsWire/Reeder are partners as much as competitors (sync works); a note in their communities that "works with Reeder and NetNewsWire" is genuine.
- IndieWeb and blogroll culture: put your own /blogroll and /feed (OPML) on the site; link to the writers you read; write to a few bloggers who have /blogroll pages. People return links if you link first.
- "Follow in nine turtles" button for publishers: a link that opens "add this feed" in the app (needs an add-by-URL route). Offer it in the feed validator and as a copy-paste snippet for bloggers. Real compounding backlinks, if bloggers adopt it. Effort medium; payoff uncertain but unique.
- Digital PR: the Reddit story (4.1), a short "State of reading blogs" mini-survey or dataset (Feeder does a "State of RSS" report), newsletters in the digital-minimalism circle (Cal Newport, James Clear audiences) via email to writers, not mass pitching.

## 6. Technical SEO checklist (Eleventy on GitHub Pages + PWA app)

- Separate hosts: nineturtles.app indexable; `app.nineturtles.app` and `slowfeed.onrender.com` noindex (header `X-Robots-Tag: noindex` or meta) and ideally robots-blocked for the legacy domain plus canonical to the marketing site. Note: a robots.txt disallow prevents Google seeing a noindex tag; use noindex on pages, not Disallow, for pages already known. Also make sure the old slowfeed.onrender.com address does not duplicate the app in search.
- Sitemap.xml generated by Eleventy (a template that lists collections), referenced in robots.txt; submit in Google Search Console and Bing Webmaster Tools.
- Atom feed of the blog, using the official plugin `@11ty/eleventy-plugin-rss` (virtual template, `type: "atom"`; v3 requires Eleventy 3, ESM) per https://www.11ty.dev/docs/plugins/rss/. Add `<link rel="alternate" type="application/atom+xml">` on every page. This is a must for a feed reader's marketing site; note plugin lists are governed by `docs/libraries.md`, so ask the owner before adding.
- Titles and descriptions unique per page; one H1; canonical tags; clean URLs; Open Graph and Twitter card images.
- Structured data: Google says none is required for AI features; do what matches the visible text: `SoftwareApplication` (or `WebApplication`) with offers on pricing, `FAQPage` markup is no longer rewarded in rich results for most sites (my recollection; verify), `Organization`, `BreadcrumbList`, `Article` for posts. Keep it matching on-page content.
- Core Web Vitals: static Eleventy is already good; self-host the fonts; no third-party scripts (matches ethos; also privacy-friendly analytics like a cookieless one for the founder's needs).
- Bing: verify in Bing Webmaster Tools. Evidence on ChatGPT search relying on Bing is mixed: OpenAI says it "sometimes partners with other search providers" including Microsoft; IndexNow does not reach OpenAI, and Bing's AI Performance report does not show ChatGPT (https://geotoolbox.ai/blog/bing-webmaster-tools, a third-party writer, treat as indicative). So do Bing for Bing/Copilot/DuckDuckGo reach, not as a ChatGPT guarantee.
- IndexNow: a key file `{key}.txt` at site root and POST to `https://<engine>/indexnow` with `host`, `key`, `urlList` (up to 10,000) (https://www.indexnow.org/documentation). A tiny GitHub Action on deploy can ping it. Cheap, optional; Google does not use it.
- Allow AI crawlers in robots.txt if you want citations (Google-Extended only controls training use in other systems). The ethos choice is the owner's.
- Accessibility = SEO: semantic HTML, alt text, readable text (already a floor).
- Search Console: AIO and AI Mode clicks appear in the normal Performance "Web" report (Google doc above), so there is no separate AI report to wait for.

## 7. Which pages to build first (order)

1. Home + pricing + about, rewritten to lead with "a quiet place to read the web" and the brand name, with the SoftwareApplication data (they exist; refine).
2. Blog Atom feed, sitemap, robots, noindex on app subdomains, Search Console and Bing verification (1 day, prerequisite).
3. Reddit-RSS-ending guide (time-boxed; before 13 Nov).
4. Feed finder + previewer (the first real "free tool").
5. Two comparison pages: vs Feedly, vs Inoreader; then one "best for calm reading" page.
6. Platform feed-format hub with about 10-20 hand-verified pages.
7. OPML tidy tool, validator.
8. Feeling-led essays at a slow, steady rhythm (one a fortnight is enough).

## 8. Timelines and conversion expectations (realistic, not promised)

- New domain, low authority: expect indexing in days to weeks, first impressions in 1-3 months, first meaningful organic clicks (tens a week) in 3-6 months for Tier B/C queries, and several hundred a month by 9-12 months only if tools and comparison pages earn links. Tier A terms take longer than a year. (Experience-based estimate; no source.) Mueller also says trust is slow to rebuild after spammy pages, so build slowly.
- Conversion: ChartMogul/ProductLed (via Userpilot, https://userpilot.com/blog/saas-average-conversion-rate) report per 1,000 visitors roughly 35-90 signups and 3.6-10.5 paying customers across freemium and trial models, i.e. 0.36-1.05% visitor-to-paid. That is a thought experiment, with huge spread; a paid-only reader with sign-ups currently closed will behave differently. A waitlist with a double opt-in email (no dark patterns) is a good local metric: 3-10% of engaged visitors joining a waitlist for a niche, high-intent page (tool/comparison) is plausible but is my guess.
- Arithmetic for first 100-200 payers: at 0.5% visitor-to-paid you need 20,000-40,000 qualified visits. That is ambitious for SEO alone in year one, which is why backlinks, directories, the newsletter-writer circle and personal-site referrals must carry part of it. SEO is a slow compounding channel here, not the launch.
- Track in Search Console: impressions, clicks per page, queries; in a cookieless analytics tool: tool use → waitlist → paid.

## 9. Risks / flags

- Scaled-content abuse: Google targets mass-produced pages "primarily to manipulate rankings", including AI-written ones (see https://ppc.land/scaled-content-abuse/ and the Aug 2025 spam-update summary https://seeders.com/blog/august-2025-google-spam-update/, which I did not read in detail). Cap the number of platform pages and hand-check them.
- Scraping: avoid Instagram/X/Facebook "feed generators". Link to publishers' own feeds.
- Reddit RSS is going away; do not publish Reddit feed-format pages as evergreen without a clear warning and date.
- Brand collision: "nine turtles" is a phrase with mythological meanings; claim the brand on search with a distinctive subtitle ("nine turtles reader").
- All volume numbers above are unverified; get real data from Search Console and Bing after 4-8 weeks before building more pages.

## Sources (read)
Pew; Ahrefs; Seer; Google AI features doc; Mueller via techwyse; mjtsai (Reddit); Feeder; rss.app; Inoreader blog; Feedly Help; OpenRSS; Kill the Newsletter; Kvibber fediverse feeds; Zapier feed URL guide; WP RSS Aggregator platform finder; Golden Hill Unread 4.4; Userpilot conversion benchmarks; 11ty RSS plugin; IndexNow docs; geotoolbox Bing/ChatGPT; AlternativeTo; GitHub AboutRSS and plenaryapp lists; ooh.directory; Semrush Feedly overview.
