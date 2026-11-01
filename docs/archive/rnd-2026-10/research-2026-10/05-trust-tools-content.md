# nine turtles: free tools, content and trust (research 05)

Date: 2026-10-25. Evidence labels: [V] = verified by fetching the cited page this session; [K] = from my background knowledge, not re-verified (check before quoting publicly).

## 0. Bottom line (read this first)

1. The best free tool for nine turtles is not a generic "RSS tool". It is a tool that fixes a problem the ideal reader already feels and that ends in a file the reader keeps (an OPML, an .epub, a feed URL). Tools that end in a file are trustworthy because they leave no hook behind. That is the book-not-feed principle applied to marketing.
2. Free tools win through search intent, not virality. Ahrefs says about half its site traffic comes from free tools, yet it admits it barely measures their signups [V]. Expect traffic first and small, slow conversion. Plan on 2-5% of tool users ever visiting the pricing page (my estimate), so a tool needs hundreds of uses a week to matter at 100-200 users.
3. The most valuable trust assets for an unknown, solo, India-based seller are not features. They are: (a) one-click full export and OPML at all times, (b) a written "if I disappear" page with a concrete mechanism, (c) public code and a public changelog, (d) a real, working refund, (e) a founder letter with a face and a name. The Pinboard decline of 2024 [V] shows why (b) now matters to exactly your audience.
4. Recommended first three builds, in order: **YouTube/Bluesky/Mastodon "follows to OPML" converter**, **OPML cleaner / dead-feed checker / reading-list-to-blogroll page**, **"Does this site have a feed?" finder + bookmarklet** (the last may already exist as your feed finder; fold it in). Then one editorial series, "How I read the web" interviews, monthly.

## 1. Case studies: what free tools actually did

| Case | What it was | Evidence | Pattern |
|---|---|---|---|
| Ahrefs free tools | ~100 free writing tools (last year) ~700k visits; wordcount.com ~500k visits; "top websites" tool expected to reach "several million" visits with "extremely low conversion". About half of ahrefs.com traffic is from free tools. | Tim Soulo, March 2024 talk [V: https://getlatka.com/interviews/ahrefs-tim-soulo-2024]. He also said "we don't really measure stuff", and abuse forced them to scale back some free tools and kill a $7 trial. | Free tools are a top-of-funnel traffic machine on tool-intent keywords. Conversion is low and poorly measured. Abuse is real: cap or rate-limit anything expensive. |
| Ahrefs Webmaster Tools | Free site audit/backlink product for site owners | Launched free, widely cited as feeding paid conversion [K]. I could not find signup numbers. | Give the other side of the market (site owners) a free tool; they later become buyers or advocates. |
| HubSpot Website Grader | Paste a URL, get a score; made in 2006 by Dharmesh Shah before HubSpot existed | The widely told numbers (millions of sites graded, large share of early leads) come from founder talks [K]. The one source I fetched (customerthink, HubSpot's own inbound results) shows only ~220 leads over a year, ~15/month, and +700% inbound links [V: https://customerthink.com/hubspot_inbound_marketing_performance_review_year_2/], so treat the mythical numbers with caution. | A tool that produces a shareable result for someone else's site earns links and a reason to return. |
| Plausible | Open-source analytics, open public stats dashboard, opinionated blog | MRR $415 (Apr 2020) to $22,010 (Apr 2021), 3,085 subscribers; ~50 mostly opinionated posts in year one; 5-6 Hacker News front-page hits; first post brought tens of thousands of visitors; no ads or referral programme [V: https://www.indiehackers.com/post/from-400-to-22k-mrr-in-one-year-with-plausible-a-google-analytics-alternative-ama-776a4803b7]. The founder does not quantify the effect of openness itself. | Trust-as-position plus a strong essay engine. Their "free tool" was the public dashboard and the repo. |
| Buffer / Baremetrics "Open" | Buffer went public with Baremetrics stats | One week after: ~30,000 visitors (18,000 in 24 hours), ~35 new paying customers, ~$2,000 MRR for Baremetrics [V: https://baremetrics.com/blog/buffer-a-week-later]. | Transparency is newsworthy once, and sticks only if you keep doing it. A one-week spike, not a channel. |
| Kill the Newsletter! | Free tool: email address in, Atom feed out; open source; no tracking; donations; old entries deleted after a month | [V: https://kill-the-newsletter.com/] | A tiny, single-purpose, credible tool that spreads through "how to read newsletters in RSS" blog posts. It is also your competitor and your hoped-for traffic source for the email-inbox feature: a better, kinder, paid version of its promise is a clear story. |
| Kagi Small Web | Curated list of personal blogs, with a public RSS feed and public OPML; strict criteria (personal, no ads, no undisclosed affiliate links, post in last 12 months, no LLM spam); self-submission requires recommending two other sites | [V: https://github.com/mlncn/smallweb] | A curated, rule-bound list as a trust asset. Note: you dropped starter packs, but this shows a different thing: it is a public standard, not a bundle. A "slow web" criteria page costs nothing. |
| Blogroll network | Dave Winer's `<source:blogroll>` and `<link rel="blogroll">` pointing to OPML; Micro.blog adopted it; one author found 20 OPML blogrolls leading to 150 sites | [V: https://alexsci.com/blog/blogroll-network/] | A live, small, enthusiastic standards community exists that nobody commercial serves. Early and cheap to join. |
| Readwise | Bootstrapped; dropped freemium for 30-day trial then paid; targets serious nonfiction readers; explains its reasoning in public | [V: https://blog.readwise.io/why-were-bootstrapping-readwise/] | Same audience as nine turtles. Their trust came from explaining the business model and from integrations, not free tools. Worth copying: write the "why we charge" page. |
| Pinboard (cautionary) | One-person paid bookmarking | Sept 2024: slower, flakier, support silence, throttled API, users leaving for Raindrop and Linkding [V: https://mjtsai.com/blog/2024/09/20/the-end-of-pinboard/]. | The trust risk for a solo paid product is silence, not bugs. Regular public status/changelog and a documented succession plan counter this. |
| Others named in the brief (Hotjar, Pablo, Tally, Carrd, Typefully, Kit, Beehiiv, Raindrop, Coolors, ColorHunt) | | I did not find reliable numbers in this session; do not cite figures for them. The qualitative pattern from [K]: Pablo (image tool) and Coolors/ColorHunt were standalone utilities that outgrew the parent or became the product; Tally and Carrd grew through "made with" footers on free tiers. | A "made with / powered by" credit on free output is the cheapest backlink loop. |

### Patterns extracted

1. **Intent match.** Tools rank because they answer a literal search ("youtube subscriptions to opml", "bluesky rss feed", "opml to blogroll"). Pick tools by searching the exact query and checking that the top results are weak, outdated or ad-ridden.
2. **Output is a file, not a funnel.** The tools that built trust (Kill the Newsletter, Kagi's OPML) leave you with something portable.
3. **Free tool plus shareable artifact.** HubSpot, blogrolls: the result lives on the user's own site with a small credit. That is a backlink and a recommendation.
4. **Low and unmeasured conversion.** Plan to measure with a single question on signup ("how did you hear?") and the tool name in the referrer. Do not use trackers; use your own privacy-respecting counts.
5. **Abuse costs money.** Rate limit, no accounts, no storage of what people paste.
6. **Transparency is a one-off spike and then a posture.** Buffer/Baremetrics gave a week; Plausible's openness compounded because it was embedded in positioning.

## 2. Free tool and content ideas, evaluated

Rating key: Effort (S = a day or two with agents, M = a week, L = more). Payoff 1-5 for trust+traffic. Floor check: "never scrape, never fetch article pages". Tools that only fetch feeds, or a page the person pastes (as autodiscovery already does, decision 0016), are fine; tools that read other people's HTML pages to build feeds are not.

| # | Idea | What | Why it earns trust or traffic | Effort | Payoff | Floor check |
|---|---|---|---|---|---|---|
| 1 | **YouTube subscriptions to OPML** | Upload `subscriptions.csv` from Google Takeout (columns: channel id, URL, title [K]); output OPML using `youtube.com/feeds/videos.xml?channel_id=` [K]. Runs fully in the browser, nothing uploaded. | Real search demand, mostly stale tools. Ideal audience (people trying to leave the YouTube algorithm). You already play YouTube in its own player. | S | 5 | Fine: builds feed URLs from IDs the user supplies; no scraping. |
| 2 | **Bluesky follows to OPML** | Enter a handle; use the public AT Protocol follows endpoint, emit `https://bsky.app/profile/[DID]/rss` per account (official RSS exists: https://openrss.org/blog/bluesky-has-launched-rss-feeds; note posts limited to logged-in users are excluded and links are omitted, so mention the openrss.org variant). | Timely, shareable ("take your timeline with you"). | S-M | 4 | Uses a public API, not scraping. Caveat: caching and API rate limits. |
| 3 | **Mastodon follows to OPML** | Mastodon exports `following_accounts.csv`; profile URL plus `.rss` gives a feed [K]. | Tiny but passionate audience and very cheap given #1. | S | 3 | Fine. |
| 4 | **OPML cleaner / dead-feed checker** | Paste an OPML; fetch only the feed URLs (HEAD/GET of the feed, politely), report dead, redirected (301 to a new address), duplicate, https-upgradable, stale (no post in 12+ months). Download a cleaned OPML. | Directly uses your feed health engine. Appeals to anyone who has a 5-year-old Feedly export. Natural upsell: "import the clean one". | M | 5 | Fine: fetches feeds only, with your polite-fetch rules. Cap size (e.g. 500 feeds) against abuse (Ahrefs lesson). |
| 5 | **OPML to blogroll page** | Paste or upload OPML; get a one-file HTML blogroll and an OPML to host, with `<link rel="blogroll">` snippet. Also an optional hosted, public page `nineturtles.app/@name/reads` (this overlaps your public reading lists; the file version needs no account). | Bloggers link to it from their own site: a permanent backlink plus a recommendation. Fits the blogroll standard [V: alexsci]. | S | 4 | Fine: user's own list. |
| 6 | **"Does this site have a feed?" finder and bookmarklet** | You have the finder. Add a bookmarklet that opens it with the current page URL (no fetch of the article; it only reads the page the person is on and sends the URL). Also a per-platform feed URL cheat sheet: Substack `/feed`, Ghost `/rss/`, WordPress `/feed`, Medium `/feed/@name`, Beehiiv, Buttondown, Reddit `.rss`, YouTube, Bluesky, Mastodon, GitHub releases `.atom` [K for patterns; verify each before publishing]. | The cheat sheet is the SEO asset: pages like "RSS feed for Substack" pull exactly the lapsed-reader audience. | S | 5 | The finder fetches only the page the user pasted (per decision 0016). The bookmarklet must send only the URL. Keep the cheat sheet static. |
| 7 | **Newsletter detox calculator** | Inputs: newsletters per week, average read time, percent opened. Output: hours per year, and "what a calm weekly reading list would look like". Shareable result card. | Fits Newport/Clear audience, shareable, short. Weak search intent, so it only works as a social/newsletter hook, not SEO. | S | 2-3 | Fine. Beware claiming made-up statistics; show formulas. |
| 8 | **Reading diet quiz** | 8 questions: sources, volume, mood; result is a "reading profile" and a suggested weekly rhythm. | Fun, but quizzes pull curiosity traffic, not intent. Risk of feeling like engagement bait, against the book-not-feed tiebreaker. | S | 2 | Fine. Suggest skipping. |
| 9 | **"RSS-ify your inbox" guide plus tool comparison** | Honest guide: Kill the Newsletter [V], Feedbin-style inboxes, your own inbox when it ships. Include a table of what works for Substack (which has native feeds), Beehiiv, Ghost. | High-intent searches ("subscribe to newsletters in RSS reader"). Honest competitor mentions (Kill the Newsletter) build trust. | M | 5 | Fine. Timing: publish before the email-inbox feature so the page already ranks at launch. |
| 10 | **Printable weekly edition / epub "send your week to Kindle/Kobo"** | Export your unread-this-week as a clean epub or PDF. As a free tool: paste up to N feed URLs and get an epub of their latest posts (using only feed content). | Very on-brand (a book, finite), differentiated from every feed reader, and press-friendly. | M-L | 4 | Only feed content is used, with original links and credits (floor: credit and link the original). Do not pull full pages; if a feed is summary-only, the epub carries the summary and a link. |
| 11 | **Slow web / "I have a feed" badge and pledge** | A page with an embeddable badge ("This blog has a feed, and I like readers who use it") and a short pledge: full-text feed, no tracking pixels in feeds, no clickbait titles. Includes the checker (#6/#12). | Creates backlinks from small blogs, matches Kagi Small Web ethos [V]. Risk: looks like a badge-for-badge (your own rule bans badges inside the app only, not on others' sites). | S | 3-4 | Fine. |
| 12 | **Blog/feed health and accessibility checker for bloggers** | Pasted feed URL: valid? full text or summary? has dates, authors, stable IDs, correct content-type, autodiscovery link tag, HTTP caching headers (ETag), https, correct encoding. Scored list of fixes. | Builds on the planned feed health check; reaches publishers (who then recommend readers). Credibility with the respect-the-publisher floor. Competes with W3C's feed validator, which is dated [K]. | M | 4 | Fine: user-supplied feed only. |
| 13 | **"How [writer] reads the web" pages** | Interviews rather than scraped lists: ask 5 writers for their OPML and a paragraph. Publish OPML download. | Best content asset; see section 4. | M (ongoing) | 5 | Fine; needs the writer's consent. Do NOT build "best feeds of [famous writer]" by inferring. Only consented lists. |
| 14 | **"Best feeds of [famous writer]" (unconsented)** | Pages guessing a famous person's reading. | Likely cheap traffic, but unverifiable and risks misrepresenting a real person. | S | 1 | Avoid. Fails the trust test and may breach the no-impersonation spirit. |
| 15 | **Email course "7 days to a calmer reading life"** | One short email a day (plain text, no tracking pixels): day 1 what RSS is, day 2 first five feeds, day 3 inbox vs river, ... day 7 weekly review. | Fits a Newport/Clear audience that already takes courses. Email list is a compounding owned asset. | M | 4 | Fine. Use plain-text, no open tracking, to match brand. Needs an email provider (check free tier and lock-in; export list). |
| 16 | **"What is RSS" explainer that ranks** | The 2,000-word definitive explainer in plain language, with a 90-second video or diagram. | The "most have never heard of RSS" problem solved at the root. Evergreen. | S | 4 | Fine. |
| 17 | **Now-reading widget** | Embed showing the last 3 items a user starred/finished. | Backlinks, but conflicts with "single-user, calm". Public by design is a privacy risk. | M | 2 | Fine if opt-in; defer. |
| 18 | **AI-free web directory** | A list of sites declaring no AI-written content. | Hot topic, but needs moderation forever and verification is impossible. Kagi already filters LLM spam [V]. | L | 2 | Avoid; a solo founder cannot verify claims. |
| 19 | **Google Scholar / Wikipedia alerts as feeds** | Turn page changes into feeds. | Wikipedia exposes official feeds [K]; Scholar has no feed and building one means scraping. | M | 1-2 | Wikipedia only via its official API. Skip Scholar (scraping, violates the floor). |
| 20 | **Public changelog and "state of the reader" stats** | See section 3. | Trust asset, regular content. | S | 4 | Fine. |
| 21 | **"Feed or no feed" site list / audit of top 100 essay sites** | Check which popular essayists' sites publish full-text feeds. Annual report. | Original data, press-friendly, builds goodwill with publishers who do it right. | M | 4 | The audit would fetch only feeds and the homepage link tag. Fetching a homepage to find the feed link goes beyond "page the owner pastes" in decision 0016, so use a known list of feed URLs or a self-submitted list instead. |
| 22 | **Bookmarks/Pocket-style export to feeds** | Convert browser bookmark folders to OPML where feed URLs are known. | Weak; bookmarks rarely hold feed URLs. | M | 2 | Needs page fetching to discover feeds; skip. |
| 23 | **Blogroll directory crawler (like ooh.directory)** | A discovery site of blogrolls. | Large effort; explicitly the starter-pack territory you dropped. | L | 2 | Only via consent. Skip. |

### Ranking for a solo founder

- Build now (days each): #1 (YouTube), #6 (feed cheat sheet and finder bookmarklet), #5 (OPML to blogroll), #4 (OPML cleaner).
- Build next (a week each): #9 (inbox/newsletter guide ahead of the email feature), #12 (feed health for bloggers), #2 (Bluesky), #16 (RSS explainer).
- Longer bets: #10 (epub of your week; most differentiated), #15 (email course), #13 (interviews).
- Skip: #8, #14, #17, #18, #19-Scholar, #22, #23.

One shared infrastructure idea: all of tools 1-5 and 12 are the same pipeline (input list, normalise, check feeds politely, output OPML). Build it once as a "feed toolkit" section of the website (website/ is Eleventy on GitHub Pages; heavier tools such as #4 and #12 need the Rust server, so put them at `app.nineturtles.app/tools` with strict rate limits, no accounts, and no storage). The free tier of GitHub Pages cannot run the fetchers; the browser-only tools (#1, #3, #5) can live on the static site at zero cost.

## 3. Trust-building practices for a tiny paid product

Weighted for: solo founder, India, selling globally, unknown brand, audience who pays Readwise, Notion and Kindle and has been burned by shutdowns (Pocket, Google Reader, Pinboard's slide [V]).

**Credibility gaps specific to your situation**

- Unknown individual versus known company: solved by a name, a face, a story, and public work (the repo, the decisions folder).
- "Is this safe to pay?": solved by using a recognised payment processor and merchant of record. Search results suggest Indian sellers commonly use Paddle, Lemon Squeezy (now part of Stripe) or Dodo Payments to handle global tax and collect in USD [V search: https://dodopayments.com/blogs/top-merchant-of-record-for-saas-india, https://pymnts.com/?p=2018528]. Check the current India-specific terms before choosing; this is outside my verified evidence and the decision affects lock-in (you need to be able to leave).
- "Will it exist next year?": the biggest worry for a one-person paid product after Pinboard [V].
- Time zone and support: promise a response time you can keep (e.g. two working days) rather than "instant".

**Practices, ordered by value for you**

1. **Export promise and shutdown plan (highest).** A page "If nine turtles ever shuts down": at least 90 days notice, one-click export of subscriptions (OPML), stars and folders, the full database dump on request, a refund of the unused period, and the code is already public so anyone can self-host (your stack is one program plus one SQLite file, which makes that real). Name a trusted person who has the keys and the instructions ("dead man's switch" arrangement); keep that detail generic in public. Pinboard-style silence is what to avoid, so also promise a monthly "still here" note.
2. **Open code, decisions and docs.** You already have public code and a decisions folder. Link them prominently: "Read why we made every decision." It is rare for a product this small and costs nothing.
3. **Public changelog and roadmap.** Short weekly or fortnightly dated entries. Since the repo has `docs/changes/`, render that on the website automatically. A steady cadence signals "alive".
4. **Honest comparison pages.** "nine turtles vs Feedly / Inoreader / NetNewsWire / Readwise Reader / Miniflux / Feedbin" that say when the other is better (NetNewsWire is free; Reader is better for highlights; Miniflux is self-hosted; Kill the Newsletter is free for inbox-to-feed [V]). Comparison queries are high-intent and honest ones earn links. Hold each fact to a dated source.
5. **Money pledges.** Plain language: no ads, no selling data, no investors, no tracking in the app, no notifications. One page, dated, with consequences ("if this ever changes, you get a refund and 90 days"). Back it with the architecture: no analytics SDKs, so the privacy claim is checkable in the code.
6. **Refund guarantee.** 30 days, no questions, honoured within days. Cheap for a small product; Readwise's choice of a 30-day trial then paid [V] shows the audience accepts paying without a free tier.
7. **Founder letter.** A plain page, first person: why you built it, the book-versus-feed idea, who you are in Mumbai/wherever, how long you plan to run it ("built to last ten years" from your engineering principles). Include the honest note that AI agents help build it; your audience will find out anyway and the openness protects you. Link to www.rohit.onl.
8. **Open metrics (optional, later).** Buffer/Baremetrics produced a one-week spike [V]; Plausible's embedded openness compounds [V]. For you: a monthly "State of nine turtles" with subscriber count, uptime, and costs, once there are numbers you are comfortable with. At 20 users it is thin, but "we are 37 readers" is itself endearing; avoid revenue until it is flattering enough not to harm negotiation of nothing. Not a priority before 100 users.
9. **Privacy stance.** Collect minimum, publish a one-page policy in plain language, state where data lives (Render, R2 backups) and who the processors are. Mention data location honestly given the India/US split.
10. **Status page.** A free status page (uptime check) reduces anxiety. Free tiers exist; ensure you can export.

**Ranking for credibility-gap closure:** 1 (shutdown plan), 7 (founder letter), 6 (refund), 2 (open code), 3 (changelog), 4 (comparisons), 5 (pledges), 9, 10, 8.

## 4. Content strategy

**What earns trust with digital-minimalism readers.** They distrust growth tactics and urgency. They reward: long-form opinion with a point of view (Plausible's 50 opinionated posts in year one drove HN hits and the first wave [V]), practical how-tos with no pitch, plain explanations of trade-offs, and visible restraint (no popups, no countdown timers, no "limited offer").

**Formats, ranked**

1. **"How I read the web" interviews** (inspired by Uses This and similar series [K]). Ask a writer: what do you read, how often, where, what do you ignore? Publish with their OPML for download and a "subscribe to all in nine turtles" link. Each interviewee tends to share it, which is distribution you cannot buy. Target: bloggers with 1k-50k readers, not celebrities, to keep response rates high. Start with people already visible in the small-web/blogroll circles [V: alexsci, Kagi].
2. **Evergreen guides** that rank: What is RSS; RSS for Substack/YouTube/Bluesky/Reddit; moving from Feedly/Inoreader; how to read newsletters outside your inbox; inbox zero for feeds; river vs inbox. These double as the tool landing pages.
3. **Essays** with a single argument: "Why a reader should end", "The case for finite unread lists", "What a feed owes a publisher". Aim for one or two a quarter that are worth submitting to Hacker News. Ask yourself whether you would forward it.
4. **Annual "state of the small web / state of feeds" report** (original data): e.g. of 1,000 essayist sites, how many publish full-text feeds, how many offer an OPML blogroll, how many feeds are dead. The audit tool (#21) generates the data; the blogroll network article counted only 20 OPML blogrolls leading to 150 sites at the time [V], so any larger measured number is news. Publishers love being counted favourably; journalists cite data.
5. **Newsletter** (your own, ironically). Monthly, plain text, 400 words: one essay link, one great blog found, one product update. It is the retention and trust channel and respects the brief by being finite. Offer it also as a feed (dogfood).
6. **Video**: skip for now.

**Sustainable cadence for one person with AI agents**

- Weekly (1 hour): changelog entry; one "blog worth reading" short post (also the newsletter seed).
- Monthly: one interview or one evergreen guide; the newsletter.
- Quarterly: one considered essay, one tool launch (Product Hunt-style launch is optional; Hacker News "Show HN" for the OPML tools is a better fit for the audience).
- Annually: the state report.
- Use agents for first drafts of guides and for the data pipeline, but write the essays and the founder letter yourself, and disclose AI help; your audience is allergic to generic AI prose, and Kagi Small Web explicitly excludes LLM-generated content [V: https://github.com/mlncn/smallweb], so a nine-turtles essay that reads as machine-written would harm exactly the trust you want.

## 5. Suggested 90-day sequence

- Weeks 1-2: shutdown-plan page, founder letter, refund text, public changelog (all text, near-zero cost).
- Weeks 2-4: YouTube-to-OPML (static, browser-only), feed-URL cheat sheet, RSS explainer.
- Weeks 4-6: OPML cleaner and OPML-to-blogroll, with a "Show HN".
- Weeks 6-8: "RSS-ify your newsletters" guide (publishes before the inbox feature), honest comparison pages.
- Weeks 8-12: first three "How I read the web" interviews; feed health checker for bloggers; start the monthly newsletter and email course outline.
- Measure: one "how did you hear about us" field, tool-name referrers, and weekly counts of tool uses. Review at day 90; kill any tool that has neither traffic nor links.

## 6. Caveats

- I found no solid public conversion numbers for most listed tools; Ahrefs explicitly says it does not measure them [V]. Treat my 2-5% conversion estimate as a planning guess.
- Items marked [K] (YouTube Takeout columns, YouTube feed URL pattern, Mastodon `.rss`, platform feed patterns, W3C validator state, Uses This) need a quick check before publication.
- The merchant-of-record and tax questions for an India-based seller are outside this research; verify with a current source or accountant before deciding.
