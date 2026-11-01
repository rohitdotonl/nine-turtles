# AI-era marketing for nine turtles (research, 25 Oct 2026)

Honesty note: most GEO/AEO data comes from vendors selling GEO tools, often via secondary blogs. Treat numbers as directional. I flag where evidence is weak.

## 0. Bottom line

1. AI answers are an unusually good fit for nine turtles' niche. The query "calm RSS reader" or "Feedly alternative without AI" is small, specific and answered from a handful of listicles and Reddit threads. A new product can get into that set in weeks, not years.
2. The cheap, compounding plan: (a) make the site crawlable and quotable (plain facts, comparison pages, FAQ, schema); (b) get named in the 10-15 listicles and 3-5 Reddit/forum threads LLMs already draw on; (c) measure monthly with ~20 hand-run prompts plus a GA4/analytics referrer filter.
3. Skip: llms.txt as a growth lever (evidence is weak; fine as a 10-minute hygiene task), paid GEO tools, anything involving fake reviews or astroturfed Reddit.
4. One bigger bet worth considering later: a small remote MCP server ("add this feed", "what's unread") listed in Claude connectors / ChatGPT apps. Fits "agent adds feeds for a user" and is distribution nobody else in calm-RSS has.

## 1. How AI engines pick what to recommend

### What studies say (directional)
- Citations are spread thin: Evertune's 200M-prompt analysis found the top domain rarely exceeds ~5% of citations; Peec AI's 30M-source analysis ranked Reddit #1 across ChatGPT, AI Mode, Gemini, Perplexity and AI Overviews; on Perplexity Reddit is up to ~1 in 5 citations (via Contently's roundup, itself secondary and with internally inconsistent figures): https://contently.com/2026/04/29/top-sources-llms-cite/
- Same roundup: SE Ranking (129K domains) found domains with heavy Reddit presence averaged ~7 ChatGPT citations vs 1.8 with little (3.9x); domains on multiple review platforms averaged 4.6-6.3 vs 1.8; Quora ~4.1x; Ahrefs (75K brands, Dec 2025) found YouTube mentions correlated 0.737 with AI appearances; LinkedIn climbed from ~#11 to #5 in ChatGPT citations (Profound). Treat as correlation, not proof.
- Engine differences (Averi 2026 benchmark): ChatGPT leans on Wikipedia (7.8% of citations) and "best X" listicles (43.8% of page types cited), with forum share declining; Perplexity leans on Reddit (6.6% of all, 46.7% of its top-10); Google AI Overviews lean on YouTube (~23%), Reddit (~21%), Wikipedia (~18%): https://www.averi.ai/how-to/chatgpt-vs.-perplexity-vs.-google-ai-mode-the-b2b-saas-citation-benchmarks-report-(2026)
- Brand mentions beat backlinks: same source cites r=0.664 for mentions vs AI visibility. An unlinked mention in a respected article still counts. This is vendor-reported; the direction is plausible and widely repeated.
- Freshness: 60.5% of ChatGPT's most-cited pages were published in the last two years; Perplexity cites regularly-updated pages ~30% more (Averi, above). Implication: put real "Updated October 2026" dates on comparison pages and actually update them. Do NOT fake dates (the same source notes fake refreshes work, which is exactly the dark pattern to avoid).
- Citations vs clicks: ChatGPT cites only ~15% of pages it retrieves; OpenAI's crawl-to-referral ratio is 425:1 (Cloudflare Radar, via https://blog.mean.ceo/?p=11346). ChatGPT referrals reportedly convert ~7.1% (Similarweb via Happy Cog, same page), treated there as an upper bound. Total volume is still tiny: ChatGPT was ~0.5% of crawler-observed referrals in Aug 2026 (same page). The 7 May 2026 update that added clickable brand links in answers raised referral volume sharply (same page; vendor data).
- Mix shift: in Goodie's B2B panel Claude's share of AI referrals rose from 11.8% to 18.5% Jan-Apr 2026 (same page). Claude users skew toward the thoughtful-reader audience nine turtles wants.

### Practical reading for a small product
- Engines assemble answers from "what the web says about the category". If five listicles, a Reddit thread and your own comparison page agree that nine turtles is "the calm, paid, book-like reader", the model repeats it.
- Comparison pages on your own site are cited heavily for branded and "X vs Y" queries (Google AI cites brand-owned sites in roughly 50-60% of unbranded objective queries per Averi, weak sourcing). So write honest "nine turtles vs Feedly / Inoreader / Feedbin / Reeder / NetNewsWire / Readwise Reader" pages, including where the others are better. Honesty is on-brand and also what gets quoted.

## 2. Making the site and app AI-friendly

### 2a. robots.txt and crawler access (do this; effort 30 min; payoff: prerequisite)
Allow search/retrieval bots (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot/Claude-User, Google-Extended optional) so you can be cited. Training bots (GPTBot, ClaudeBot) are a values decision; for a pro-publisher product allowing them is defensible but optional. Check that Cloudflare/GitHub Pages settings are not silently blocking AI crawlers; one developer found managed Cloudflare rules were blocking crawlers they wanted: https://dev.to/hey_atlas_5d684863e9b069a/i-audited-my-own-robotstxt-and-found-cloudflare-was-blocking-the-ai-crawlers-i-wanted-4b77 . Overview of bot types: https://www.parse.gl/blog/robots-txt-ai-crawlers-configuration . Note the website is on GitHub Pages (static), so crawlability is easy; just confirm there is no JS-only content.

### 2b. llms.txt (honest verdict: weak evidence, cheap, optional)
- Adoption: llms.txt files grew from 4,088 (Jun 2025) to 36,120 (May 2026) across 3M+ monitored sites (Originality.ai). But Ahrefs server-log research on 137K domains found 97% of llms.txt files got zero requests, and AI retrieval bots were only 1.1% of requests to them; Google says it has no effect on Search and added (15 Jun 2026) a note that it isn't required; OpenAI's crawler docs don't mention it; John Mueller said in June 2025 no AI system uses it: https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/
- Recommendation: if the Eleventy site can emit one in ~10 minutes, fine (it helps coding agents reading docs). Don't expect traffic from it. More valuable: clean, server-rendered HTML with the facts in plain sentences.

### 2c. Structured data and plain facts (effort 2-4 h; payoff: modest, durable)
- JSON-LD: Organization, SoftwareApplication (with offers/price), FAQPage on the FAQ, Article on posts. Helps Google; LLM benefit is plausible but unproven.
- A "facts" page: what it costs, what it does and does not do (no AI summaries, no notifications), supported platforms, sync services, import/export, open-source link, founder name. Written in the quotable declarative style LLMs lift ("nine turtles is a paid RSS reader with no notifications, badges or algorithmic ranking").
- Offer `.md` versions of key pages (Eleventy can output them). Low cost; Zapier already serves a `.md` of its listicle (seen in search results: https://zapier.com/blog/best-rss-feed-reader-apps.md), suggesting agents fetch these. Evidence for effect: anecdotal.

### 2d. MCP servers and agent directories (bigger bet; effort 1-3 weeks; payoff uncertain but unique)
- ChatGPT now has an in-chat app directory and accepts third-party submissions. Requirements (from OpenAI's submission docs): verified individual/business identity, a stable public HTTPS remote MCP server, domain-verification token at `/.well-known/openai-apps-challenge`, OAuth or no auth only (no API keys), short name limit 30 chars, privacy/terms/support URLs, 5 positive + 3 negative test cases and a video walkthrough: https://developers.openai.com/apps-sdk/deploy/submission . Announcement: https://openai.com/blog/developers-can-now-submit-apps-to-chatgpt
- Claude has a connectors directory for remote MCP servers (same technical object). One MCP server serves both.
- Fit: tools like `add_feed(url)`, `list_unread()`, `search_articles(q)`, `star(id)`, plus a read-only mode. A user could say in ChatGPT/Claude "follow these five blogs in nine turtles" or "what did my feeds publish this week". Matches the "agent-ready" idea and the founder's existing Google-Reader-style API. Risk to design ethos: an MCP that summarises feeds drifts toward feed-like behavior; keep it to add/organize/search/open-original, no digests, no push.
- Payoff: discovery inside the assistant app store is real but unmeasured; value is mostly existing-customer convenience and press ("first RSS reader with an MCP server" angle). Do after launch, not before.

### 2e. Shopping/product listings
OpenAI and Perplexity shopping feeds target physical goods; not relevant to a subscription web app. Skip. Directories that matter instead: AlternativeTo (it ranks in "Feedly alternatives" queries: https://alternativeto.net/software/feedly/), Product Hunt, G2/Capterra/Slant (cheap listing), Wikipedia is not realistic yet (needs independent coverage).

## 3. Measuring AI visibility cheaply

1. Prompt panel (free, 1 hr/month): write 20-30 prompts (list in section 6). Run each in ChatGPT (search on), Perplexity, Claude (web search on), Gemini, Google AI Mode in a logged-out/private window. Record in a spreadsheet: is nine turtles named, what rank, which URLs were cited, which competitors. Repeat monthly (answers vary; run each twice). The sources cited are the outreach list.
2. Ahrefs free AI Visibility Checker: queries ChatGPT, Gemini, Perplexity, Copilot, AI Overviews/AI Mode; free, no signup; shows top 5 topics, cited domains, cited pages; limited preview, no history, no custom prompts: https://ahrefs.com/free-ai-visibility . Good for a baseline once the brand exists.
3. Referral analytics: filter referrers chatgpt.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com. Walkthrough for GA4: https://echai.ventures/how-founders-use-ai/aeo-geo/how-do-i-measure-traffic-signups-and-revenue-coming-from-ai-search . If using privacy-friendly analytics (Plausible/Umami), referrers appear directly. Many AI clicks arrive with no referrer (dark traffic), so also add "How did you hear about us?" with an "asked an AI" option on the waitlist form. Cheap and honest.
4. Server/CDN logs: count hits by OAI-SearchBot, PerplexityBot, Claude-SearchBot to see whether you are even being fetched.
5. Skip paid trackers (Profound, Peec etc.) until there are revenue and budget.

## 4. Case studies (with caveats)

- Tally (form builder, bootstrapped): reported ChatGPT as its top referral source, ~25% of new signups. Secondary citation only (https://blog.mean.ceo/?p=11346); I did not verify the primary tweet. Tally is a strong analogue: free/cheap, clear category, large Reddit/community footprint.
- Gumlet (video/image infra, B2B): claims ChatGPT mentions turned into ~20% of inbound revenue. Source is an agency's own marketing post with no baseline or timeline, so low reliability; the useful part is the method: find pages AI already cites, write adjacent-question pages, re-test prompts every 30 days: https://derivatex.agency/blog/traffic-flat-demo-requests-mention-chatgpt/
- WorkLounge: ChatGPT traffic up 20x in five months after raising AI sentiment score (vendor case, via mean.ceo page above).
- Jotform: OpenAI-published case study about a new discovery/acquisition playbook (an OpenAI ads page, so promotional): https://ads.openai.com/customers/jotform
- Plausible Analytics (bootstrapped, community-driven, closest in spirit): grew to $1M ARR without ads via content, open source and word of mouth rather than GEO: https://churnkey.co/subscription-heroes/how-plausible-grew-to-1m-arr-without-ads-or-investors-marko-saric-co-founder-of-plausible/ . Lesson: the same things that make humans recommend a product (clear positioning, open-source credibility, written-out philosophy) feed LLMs.
- Caution: no solid public case of a sub-$10K MRR consumer SaaS reporting precise ChatGPT signup share that I could verify. Sample sizes at your scale will be tiny: 100 paying users is plausible from AI if 2-5% of the traffic is AI and conversion is 5-7%.

## 5. Other AI-era tactics

### 5a. "Human-made" positioning (effort low; payoff high for this audience)
nine turtles is already "no AI summaries, no ranking". Competitors push AI: Feeder summaries on every plan, Inoreader Pro summaries, NewsBlur "Ask AI", Readwise Ghostreader (https://feeder.co/knowledge-base/rss-basics/feedly-alternatives/). Make "no AI between you and the writer" a visible, specific claim (the app never summarises, rewrites or ranks; it shows exactly what the publisher published). Also this is a "Feedly alternative without AI" query answer in waiting. Careful: say what it does not do, don't sneer at AI users. A short pledge page ("What nine turtles will never do") is both brand and quotable fact.

### 5b. Reddit (compounding, but founder dislikes manual posting)
Reddit is the single most cited source type in several studies (above), so threads like "best RSS reader 2026" in r/rss, r/selfhosted-adjacent, r/digitalminimalism, r/ObsidianMD, r/Kindle often feed answers. Honest, low-effort approach: answer questions in 1-2 subreddits only where the product genuinely fits, disclose you're the maker, never astroturf. Even 2-3 helpful threads per month for a year is meaningful; and one genuine "I built this" post with the story. This is the one place manual effort has a direct, measurable AI payoff. If the founder refuses, Reddit presence will come mostly from happy users, so prompt (not nag) them in the app's welcome email: "if you like it, a mention in r/rss helps."

### 5c. Free tools as link/citation magnets (compounding; effort medium)
- "Does this site have an RSS feed?" finder: paste a URL, get the feed address (uses the same autodiscovery on user-pasted page, consistent with the never-scrape rule since the user supplies the URL).
- "Feed health checker" (public version of the health page).
- OPML cleaner/validator, "Export your Feedly/Inoreader OPML and see which subscriptions are dead".
- "How to find RSS feeds for X" pages per platform (Substack, YouTube, Mastodon, Reddit, Bluesky, Medium). These evergreen how-to pages are what LLMs cite for how-to queries and produce natural CTAs. Low competition for specific platform pages.
Payoff: slow, compounding; best SEO+GEO investment for the stated preference.

### 5d. Newsletters-to-feed as a content hook
"How to read newsletters outside my inbox" is a real, growing query. Pre-launch, publish the guide ("Read Substack and newsletters without email") with RSS-based methods that work today; when the email-inbox feature ships, it becomes the answer. Substack's built-in feeds make this easy to cover.

### 5e. Wikipedia/Wikidata
Wikipedia is ChatGPT's top single domain (7.8% per Averi). A product page needs independent significant coverage; not achievable at launch and self-created pages get deleted. Wikidata is easier (structured item with official website, software type, license) but low influence. Defer; instead aim for a mention in the existing Wikipedia "Comparison of feed aggregators" page only if independent press exists. Low priority.

### 5f. AI to scale outreach ethically
Use an LLM to draft individualised, short notes to listicle authors and bloggers, but each needs a human read and a real reason (e.g. "your 2026 roundup lists X, which closed; nine turtles is a calm paid reader, free year for you to try"). Send to a few dozen people, not thousands. Effort: low; payoff: the single highest-yield action because listicle authors update posts.

### 5g. Content for LLMs without slop
Answer the literal questions: "What is RSS?" in two sentences at top, "How do I get Substack in an RSS reader", "Is Feedly worth it?", each with a date, an author byline (Rohit, with link to rohit.onl), and real specifics. Named human authorship plus first-person testing is both anti-slop and an E-E-A-T signal.

## 6. Applying this to nine turtles

### 6a. Prompts to win (use for monthly tracking)
Category/feeling:
- "calm RSS reader", "quiet RSS reader with no notifications", "minimalist RSS reader for Mac/iPhone/web"
- "RSS reader that feels like Apple Books / a book"
- "best RSS reader for people who want to read more and scroll less"
- "digital minimalism tools for reading blogs"
Alternatives:
- "Feedly alternative without AI", "Feedly alternative that is calm", "Inoreader alternative simple", "Reeder alternative for web / Android", "Google Reader replacement 2026", "Pocket alternative with RSS" (Pocket closed in 2025, readers are looking), "Readwise Reader alternative cheaper"
Problem-led:
- "how to read newsletters outside my inbox", "how to follow Substack without email", "how to follow blogs without social media", "how to follow YouTube channels without algorithm", "how to get my reading list back after quitting Twitter/X", "how to read the web slowly"
Technical/trust:
- "RSS reader open source paid hosted", "RSS reader that syncs with NetNewsWire/Reeder", "RSS reader with OPML import export", "RSS reader with mute rules".

### 6b. What LLMs name now
Current listicles name: Feedly, Inoreader, NewsBlur, Feedbin, NetNewsWire, Reeder, Readwise Reader, FreshRSS, Miniflux, The Old Reader, Feeder, Fluent Reader, Tiny Tiny RSS, selfoss, Flipboard. No calm-positioned new entrant appears. Feedbin is the only one described as "calm, paid" (Feeder's roundup), which is nine turtles' closest competitor in the model's mind: the comparison page "nine turtles vs Feedbin" matters most.

Outreach targets (roundups LLMs likely draw on; verify each is open to updates):
- https://feeder.co/knowledge-base/rss-basics/best-rss-readers/ (Feeder's own product; also /feedly-alternatives/ and /inoreader-alternatives/; company blog, so ask to be listed in "other readers", low odds but the pages are heavily cited)
- https://zapier.com/blog/best-rss-feed-reader-apps/ (updated Oct 2026; high authority, hard to get into; names Feedly, NewsBlur, Inoreader, Fluent Reader, Flipboard, Reeder, FreshRSS, Miniflux, Tiny Tiny RSS, selfoss)
- https://bgr.com/2057396/best-rss-reader-apps/ (Dec 2025, Inoreader, Feedly, Readwise Reader)
- https://www.miniloop.ai/blog/best-rss-feed-readers-2026 (could not fetch, exists in search)
- https://bloggingwizard.com/free-rss-feed-readers/ (free-readers listicle; wrong fit for paid, but can pitch)
- https://daily.dev/blog/best-rss-readers-feed-tools-developers/ (developer audience)
- https://alternativeto.net/software/feedly/ and Inoreader alternatives (user-submitted: list nine turtles yourself, free)
- https://artemis.jamesg.blog/alternatives/feedly (an indie-web alternatives list by James; personal blog, receptive to indie products)
- https://www.youngju.dev/transcribe/culture/2026-05-16-rss-readers-read-later-2026-reeder-netnewswire-inoreader-feedbin-miniflux-freshrss-karakeep-deep-dive (deep-dive guide; low authority)
Also to find by hand: Lifehacker/How-To Geek/MakeUseOf "best RSS readers", Reddit r/rss "best reader" threads, "awesome-rss" GitHub lists, Matt Mullenweg/Kottke/indie-web "blogroll" folks, digital-minimalism newsletters (Cal Newport's readers, Fast Company "Digital detox" pieces), Product Hunt, Hacker News "Show HN: calm RSS reader".

### 6c. 90-day plan (solo, mostly one-off effort with compounding)
Week 1-2 (≈1 day): robots.txt check; facts page; JSON-LD; `.md` page variants; llms.txt as optional; analytics referrer filters; waitlist "how did you hear" field; baseline prompt panel.
Week 2-6: five comparison pages (Feedly, Inoreader, Feedbin, Reeder/NetNewsWire, Readwise Reader) written honestly; three how-to pages (newsletters outside inbox, Substack via RSS, YouTube without the algorithm); "What nine turtles will never do" page.
Week 4-10: submit to AlternativeTo, Product Hunt, G2/Capterra/Slant; 30 personalised outreach emails to roundup authors; 2-3 honest Reddit/HN threads with disclosure; pursue 2-3 indie-web blogs/newsletters (Cal Newport-adjacent) for reviews.
Week 6-12: first free tool (feed finder); re-run prompt panel; double down on pages that got cited.
Later: MCP server / ChatGPT app and Claude connector.

### 6d. Risks and what not to do
- Don't fabricate reviews, fake-refresh dates, mass-produce AI pages, or astroturf Reddit; it conflicts with the product's principles and engines are getting better at discounting such content.
- Don't over-index: AI referrals are ~0.5% of referrals overall (mean.ceo page); but niche, high-intent queries like yours are exactly where it is concentrated.
- Waitlist closed: AI answers will point to a site that can't sign up; make the waitlist CTA obvious and honest ("opening to a few readers at a time") with no fake scarcity.
