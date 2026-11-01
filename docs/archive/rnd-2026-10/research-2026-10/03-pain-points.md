# 03: Pain points, questions and language around feeds, RSS and online reading

Research date: 25 Oct 2026. Method: web search plus page fetches.

## Limits of this research (read first)
- Reddit is blocked for fetching in this environment (SITE_BLOCKED) and domain-filtered search failed. I could not read r/rss, r/digitalminimalism, r/nosurf and so on directly. Every quote below comes from pages I actually fetched: Hacker News threads (via a mirror), blogs, a forum (MacPowerUsers), Mozilla/TechCrunch coverage and Mailbrew's feedback board. Treat the Reddit angle as a gap. A follow-up with Reddit access should mine r/rss "unread" threads and r/digitalminimalism.
- The fetch budget ran out partway through. Items marked (unverified) came from search-result titles only, not page reads.
- The real-people evidence skews to people who already use RSS or blog. The would-be reader voice (section 2) is thinner and comes mostly from essays.

---

## 1. Pain points of current RSS users, with sources

### 1.1 Unread guilt and overwhelm (the biggest one)
This is the most repeated pain and the best fit for nine turtles' "book, not feed" idea.
- Dan Q, "RSS Zero isn't the path to RSS Joy" (https://danq.me/2023/07/29/rss-zero/): Katie dropped feeds after "regularly ending up with 200+ unread items that felt overwhelming". Dave Rupert, in the comments, describes "slight anxiety from unread counts." Dan's counter-view: "Your reader is a list of things you might like to read," not a to-do list. "Zero is not the target."
- Pablo, "you can read the web seasonally" (https://pablo.bearblog.dev/you-can-read-the-web-seasonally/): "it didn't take long to accumulate hundreds of posts, most of which I had no true desire to read." "dreadful little indicator of unread posts felt like a personal failure." Will Hopkins, quoted there: "They become graveyards of good intentions and self-imposed obligations."
- Hacker News, "In Praise of RSS and Controlled Feeds of Information" (https://hn.svelte.dev/item/45459233): sph: "RSS fatigue is a thing." curiousguy stopped because they were "way too anxious trying to read everything." thaumasiotes: large unread counts push them to "mark all as read". pantulis: "The key with RSS is curation."
- Brandur, "RSS abandon" (https://brandur.org/fragments/rss-abandon): "I was treating my feeds like yet another inbox that I had to go in and zero every day." He came back to RSS "Tired of Twitter," and now reads only recent interesting items and subscribes to infrequent posters.
- Feedly itself got a dialog asking whether to confirm "mark all as read" (https://www.rssboard.org/news/208/should-feed-readers-count-unread-items, title only, unverified content).

How nine turtles solves it: product plus copy. Already fits: finite unread list, no badge, no count-as-guilt. Ideas: (a) an explicit "this is a shelf, not a to-do" message; (b) one-tap "catch up to today" that is undoable; (c) a gentle "quiet feed" nudge (feeds you never open) shown only on the health page, never as a push; (d) "seasonal" feeds: pause a feed without unsubscribing (Pablo's framing). Content: an article "Your feed reader is not an inbox." Fits the ethos fully. Do not add counters, streaks or "you have 3 days left".

### 1.2 High-volume feeds drown out small blogs
- HN (same thread): akho says readers are "generally, not flexible" about sorting, and frequent posters dominate feeds. pantulis says adding noisy feeds out of FOMO buries the relevant ones.
- Brandur: limited subscriptions "to blogs that post infrequently."
Solution: river vs inbox modes already exist. Product idea: per-feed "at most N a day" or "one a day from this feed" cap; a "slow lane" for rare posters. This is a calm, non-engagement feature. Fits.

### 1.3 Weak filtering and search
- HN (same thread): theshrike79 on FreshRSS: "the filtering system isn't especially powerful (or easy to use)." ghostpepper: most RSS clients "lack true power user features for searching and filtering." HankStallone: modern readers lack features Usenet newsreaders had.
Solution: nine turtles already has search, rules and mutes. Market this as "power hidden, never missing". Content: "mute words in your feed reader."

### 1.4 Price hikes, subscription fatigue and the "RSS should be free" argument
- MacPowerUsers thread, "Inoreader subscription costs doubled $90/yr" (https://talk.macpowerusers.com/t/rss-reader-inoreader-subscription-costs-doubled-90-yr-alternatives/36251), Feb 2024: digeratti: "I was taken back getting an email from the company about my Pro subscription going from $49 a year to $89" and "I don't mind paying but I think $50 a year would be my max." NiKoBeaR: "Now my $2.50 sub is going to $7.50 paid yearly which is a serious turnoff" and "$5 feels like the top end I would pay for Inoreader." NiKoBeaR also: "They are extremely user hostile and see you as the enemy." andy4222: "Please don't pay for a subscription for RSS lol." pantulis: "I don't see necessary to pay for a third party for the job of fetching and parsing RSS feeds." Counterpoint, onepointzero: "I still pay for inoreader despite the price rise." BazQux at about $30/yr and NewsBlur at $36/yr were named as fair prices.
- Implication for pricing: a ceiling of roughly $30 to $50 a year is stated by paying RSS people. The reason to pay has to be calm reading, polish and sync, not "fetching feeds". The "free apps exist" objection (NetNewsWire, FreshRSS) is the main objection to answer on the site. Honest answer: those are great tools; nine turtles is for people who want it hosted, designed like a book and not to run anything.

### 1.5 Feedly: AI and enterprise pivot, reliability, support
- TechCrunch, 17 Aug 2026 (https://techcrunch.com/2026/08/17/feedly-attributes-weeklong-slowdown-to-bug-not-its-ai-pivot): weeklong slowdown, paying customers called it "unusably slow", iOS app would not load, support requests went unanswered, classic mobile app shut down without notice, and Feedly is "shifting toward cyber threat intelligence (CTI) for businesses." CEO said "fixing the basic RSS functionality is still a priority." Root cause was a change to resorting logic about 12 days earlier.
- This is a live switching moment as of this month. Content opportunity: a calm, factual "Leaving Feedly: export your OPML and what to look for" page and OPML import tool. Do not trash Feedly; be useful.

### 1.6 Read-later collapse: Pocket and Omnivore
- Omnivore: founders "joining ElevenLabs", service ended end of November 2024 (https://www.zoia.org/posts/the-short-life-of-services). That author moved newsletters to Feedbin with a forwarding address "so the newsletter subscriptions don't need to be changed again."
- Pocket: Mozilla announced May 2025; first phase 8 July 2025; export deadline 8 Oct 2025, after which data was permanently deleted (https://www.techradar.com/computing/websites-apps/pocket-shuts-down-today-heres-how-to-get-your-data-before-the-app-closes-plus-the-3-best-alternatives). Mozilla said "the way people use the web has evolved" (https://erkansaka.net/2025/05/27/pocket-shutdown-2025-mozilla-alternatives/). That author: "another blow to user-centric web", and reports upset Kobo users and people frustrated by "the lack of a viable alternative."
- Where they went (named in coverage, no migration data found): Instapaper (free import plus 3 months Premium offered), Readwise Reader (imports Pocket archive; $9.99/mo per TechCrunch's list https://techcrunch.com/2026/08/14/read-it-later-app-pocket-is-shutting-down-here-are-the-best-alternatives/), Raindrop, Matter, Wallabag, Readeck, Karakeep.
- Distrust theme: "Free services or VC-funded ones can shut down overnight" (https://wallabag.it/en/blog/2026/06/15/which-read-it-later-app-to-choose-in-2026/). Same source says Instapaper "changed hands several times" and "the future of the service remains unclear."
- This is a trust opportunity: nine turtles is paid (so incentives line up), the code is public, OPML export is first-class. A "what happens if nine turtles disappears" page (export, open code, self-host option) addresses the trauma directly.
- Product gap: nine turtles is a feed reader, not a read-later app. Pocket refugees often want "save this one link". Idea: let a pasted URL become a one-off item in a "Saved" shelf without scraping (careful: never fetch article pages, per project rules, so this needs a decision; a link plus the user's note is compatible, full text is not). Raise with the owner.

### 1.7 Newsletters clutter the inbox
- Bryan Manio (https://bryanmanio.com/blog/email-newsletters-to-rss/): "I get distracted easily, and newsletters are a massive part of it." "My email acts as a to-do list for people I get back to." "Since I already have that dedicated time and space for reading, I might as well make use of it." Also asks "Do I really need to be subbed to this newsletter?" and notes the downside: it becomes "a one-way form of communication."
- Om Malik (https://om.co/2023/08/27/how-do-we-fix-the-too-many-newsletters-problem/): Dennis Crowley quip: "I subscribe to so many Substacks, and I read zero of them." Unsubscribing "feels illusory."
- Loose Wire (https://www.loosewireblog.com/2025/09/readers-revenge.html): "there are just so many good (often very good) newsletters that even if we only take the free stuff, we're still committing ourselves to hours of reading per day." Solution: "dust off an old technology: RSS." "adding their RSS feed to my reader, and then unsubscribing from the newsletters (unless they're paid ones.)"
- MacPowerUsers: "I don't like the way Inoreader manages email newsletters."
- Mailbrew feedback (https://mailbrew.featurebase.app/p/will-pay-if-solved-need-either-brews-as-rss-or): "I want to use my Kobo e-reader to read the news and other newsletters/RSS feeds in the morning." "Will pay monthly for Mailbrew if this is resolved."
Solution: the planned newsletters-to-feed inbox is the single most validated roadmap item. Shortcut idea for free tool and SEO: most Substack/Ghost/Buttondown newsletters already have an RSS feed. A free "Newsletter to RSS finder": paste a newsletter URL, get the feed URL and the unsubscribe steps. This catches a lot of search traffic ("substack rss feed url") and is on-ethos.

### 1.8 Finding blogs and feeds (discovery)
- HN "How to find non-popular blogs and forums?" (https://news.ycombinator.com/item?id=44634391): dominicq: "I cannot find my own blog, like, at all. I'm not even indexed." mmarian: "haven't come across blogs where I consistently like the posts written." muzani: "Just find people who say clever things and dig around to see if they blog." skydhash: "hang around forums for topics you're interested in."
- Matt Webb (https://interconnected.org/home/2023/12/29/recommendations): "I'd love to see some other RSS starter packs." Recommends ooh.directory. Note: the founder dropped starter packs, so lean on tools and links instead (below).
- Other HN titles on the same need (not read): "Ask HN: What's a RSS feed you would recommend?" (https://news.ycombinator.com/item?id=44407060), "Do you maintain a list of RSS links of GOAT blogs?" (https://news.ycombinator.com/item?id=32191140), "Favorite Blogs by Individuals?" (https://news.ycombinator.com/item?id=27302195).
Solution without starter packs: content such as "How to find blogs worth reading", an in-app "who does this blogger link to" (blogroll reader: parses /blogroll or OPML link from a feed the user already follows, no scraping of article pages). Check against rule 0016 on autodiscovery before building.

### 1.9 Sites without feeds, bot protection, feeds going away
- HN: renegat0x0: many mobile RSS apps can't get past protections like Cloudflare. Reddit RSS ends 13 Nov 2026 (see section 5). robin_reala: old blogs get taken over by spam.
- Quick-win: publish a "Does this site have an RSS feed? Find the address" free tool. Per project rules, autodiscovery is allowed only for a page the user pastes; a standalone website tool that does this server-side needs the same care.

### 1.10 Sync and apps (partial evidence)
- MacPowerUsers: unclekyle says iCloud sync "is just not fast enough as the hosted services like BazQux and Inoreader." andy4222 uses FreshRSS because of different iCloud accounts on work and personal machines.
- HN: ktosobcy left Inoreader after limits and UI changes.
- Take: nine turtles' Reeder/NetNewsWire-compatible API plus PWA covers this. Mention "works with Reeder and NetNewsWire" on pricing and landing pages.

Not covered because of the fetch limit (unverified, no source): YouTube/Bluesky/Twitter-to-RSS pain, podcast mixing, Readwise Reader price complaints, the Artifact shutdown reaction (a search confirmed Yahoo bought Artifact in April 2024: https://bgr.com/tech/artifact-the-ai-news-app-created-by-instagram-cofounders-was-acquired-by-yahoo/; I did not find reader reactions). Treat these as to-research.

---

## 2. Pain points of the would-be reader (non-RSS people)
Evidence here is thin and essay-based:
- Doomscrolling swap: Matt Webb: "It's not algorithmic. You see what you subscribe to (it's free)." "And it gets you off Twitter." "if your New Year's resolution is to start reading with RSS instead of doomscrolling social media" (https://interconnected.org/home/2023/12/29/recommendations). A public library even ran an event titled "Stop Doom Scrolling! Slow the Scroll with Really Simple Syndication (RSS)" (https://nnyln.org/events/stop-doom-scrolling-slow-the-scroll-with-really-simple-syndication-rss/, title only). Good signal that the pitch works with non-technical audiences.
- Newsletter overload: see 1.7. This is the most plausible door for non-RSS people: they feel the pain already.
- Not knowing where good writing is: see 1.8.
- Fear of obligation: the same unread guilt that scares lapsed RSS users will stop newcomers. Messaging must promise "nothing to keep up with."
- Quotes to search next (suggested): r/digitalminimalism "what do you do instead of scrolling", r/nosurf "replace Twitter with", Cal Newport "Slow Productivity" readers.

---

## 3. FAQ-style questions (content and SEO opportunities)
From the sources above and the search landscape (search for "how to find the RSS feed" returned a crowd of how-to pages: https://helpdeskgeek.com/how-to-find-an-rss-feed-url-for-any-website/, https://www.wprssaggregator.com/help-v4/how-to-find-an-rss-feed/, so the term is competitive but low on calm-reading angle):
1. What is RSS and do people still use it?
2. How do I find the RSS feed of a website / blog / Substack / YouTube channel?
3. What is the best RSS reader (Feedly alternative, Inoreader alternative, Pocket alternative)?
4. Is RSS dead? Is it worth it in 2026?
5. How do I stop feeling overwhelmed by unread items?
6. How do I get newsletters out of my inbox?
7. How do I export my feeds (OPML) from Feedly / Inoreader / Pocket and import them elsewhere?
8. How do I find blogs worth following?
9. Can I follow Reddit / Bluesky / Mastodon / YouTube with RSS? (Reddit RSS ends 13 Nov 2026, a timely article.)
10. Can I read RSS on my Kindle / Kobo?
11. Do I have to pay for a feed reader? Why pay when NetNewsWire is free?
12. How do I read blogs without social media?
13. What happens to my data if the app shuts down?

Tool ideas that compound: OPML converter / cleaner / deduper, "Find the feed" tool, "Substack/newsletter to RSS URL" finder, "Feed health checker" (is this feed alive, last posted), "Reading time budget" calculator (how many hours your subscriptions need per week) that honestly shows people to subscribe less. That last one is on-brand and shareable.

---

## 4. Feature requests that recur, ranked by frequency in what I read
1. Newsletter handling outside the inbox (Manio, Malik, Loose Wire, Zoia, Mailbrew, MacPowerUsers). Strongest. On the roadmap.
2. Better filtering, search, sorting (HN thread, 5+ commenters). Exists; promote.
3. Calm volume control: ways to deal with high-frequency feeds and large backlogs (HN: sph, akho, pantulis, thaumasiotes). Candidates: per-feed daily cap, pause feed, "catch up" button.
4. Get articles onto an e-reader (Mailbrew request: Kobo; Pocket-Kobo grief in Erkan Saka's post; search turned up KindleEar, r2k, inkfeed, a Fivefilters "PDF newspaper and push to Kindle" thread, and MobileRead threads, titles only). Idea: "Morning edition": a daily or weekly EPUB/RSS-friendly export, or a plain e-ink-friendly page. Fits a book-like ethos strongly. Must respect publishers: only feed content, with credit and link; check against the floors.
5. Read-later / save single link (Pocket refugees). Needs an owner decision (see 1.6).
6. Lower price / predictable price (Inoreader thread). Pricing rather than feature.
7. Stable, reliable core, not AI (Feedly coverage). Position: no AI upsell.
8. Digest / weekly edition: Om Malik prototype of an AI newsletter summary is an example of the demand, but AI summaries clash with the "never replace the writing" feel. A non-AI "weekly edition" (the best unread items of the week in one calm page) fits better.

Not found in my evidence: strong repeated requests for "daily limit". It is a plausible calm feature but I have no quotes; do not claim demand.

---

## 5. Switching moments, 2024 to 2026 and upcoming
| Date | Event | Source |
|---|---|---|
| Feb 2024 | Inoreader Pro price rise ($49 to $89 per forum post) | https://talk.macpowerusers.com/t/rss-reader-inoreader-subscription-costs-doubled-90-yr-alternatives/36251 |
| Apr 2024 | Yahoo acquires Artifact (later shut down; reaction not found) | https://bgr.com/tech/artifact-the-ai-news-app-created-by-instagram-cofounders-was-acquired-by-yahoo/ |
| Oct to Nov 2024 | Omnivore announces ElevenLabs move, ends end of Nov | https://www.zoia.org/posts/the-short-life-of-services |
| May to Oct 2025 | Pocket shutdown; exports ended 8 Oct 2025 | https://www.techradar.com/computing/websites-apps/pocket-shuts-down-today-heres-how-to-get-your-data-before-the-app-closes-plus-the-3-best-alternatives |
| Aug 2026 | Feedly weeklong slowdown, iOS app issues, classic app retired without notice, CTI pivot | https://techcrunch.com/2026/08/17/feedly-attributes-weeklong-slowdown-to-bug-not-its-ai-pivot |
| Sep to Oct 2026 | Reddit announces end of RSS | https://mjtsai.com/blog/?p=53462 and https://www.techrepublic.com/article/news-reddit-rss-public-api-shutdown/ |
| 31 Oct 2026 | Reddit stops new public API access requests | TechRepublic |
| 13 Nov 2026 | Reddit RSS feeds end (Feedly says it keeps working via the API; other readers uncertain) | TechRepublic, mjtsai |
| 30 Nov 2026 | Reddit porting bounty deadline for apps | TechRepublic |
| 12 Jan 2027 | Reddit starts removing API access for unregistered apps | TechRepublic |
| Mar 2027 | Remaining Reddit public API access ends | TechRepublic |

Action: a timely post "Reddit is ending RSS on 13 November: what to do" is a short-window, high-intent SEO win (do it before 13 Nov). Also: standing "Switching from Feedly / Pocket / Inoreader" pages with an OPML import walkthrough. Be factual; do not gloat.

---

## 6. Verbatim quotes for copywriting (all fetched pages)
1. "My RSS (Really Simple Syndication) reader is a place of joy, never of stress." Dan Q, https://danq.me/2023/07/29/rss-zero/
2. "Your reader is a list of things you might like to read," not a to-do list. Dan Q, same.
3. "Zero is not the target." Dan Q, same.
4. "A feed reader is a tool that works for you." Dan Q, same.
5. "regularly ending up with 200+ unread items that felt overwhelming" (Katie, quoted by Dan Q), same.
6. "slight anxiety from unread counts" (Dave Rupert via Dan Q), same.
7. "dreadful little indicator of unread posts felt like a personal failure." Pablo, https://pablo.bearblog.dev/you-can-read-the-web-seasonally/
8. "They become graveyards of good intentions and self-imposed obligations." Will Hopkins, same.
9. "It's not a personal failure, it's an allocation of resources like time and attention." Pablo, same.
10. "I think I'm okay knowing some RSS feeds are seasonal, same as music genres throughout the year." Pablo, same.
11. "RSS fatigue is a thing." sph, https://hn.svelte.dev/item/45459233
12. "way too anxious trying to read everything" curiousguy (paraphrase-quote fragment), same.
13. "The key with RSS is curation." pantulis, same.
14. "I was treating my feeds like yet another inbox that I had to go in and zero every day." Brandur, https://brandur.org/fragments/rss-abandon
15. "Tired of Twitter, and not finding enough consistently good content on HN, I logged into my dilapidated Feedly account." Brandur, same.
16. "I get distracted easily, and newsletters are a massive part of it." Bryan Manio, https://bryanmanio.com/blog/email-newsletters-to-rss/
17. "My email acts as a to-do list for people I get back to." Manio, same.
18. "Since I already have that dedicated time and space for reading, I might as well make use of it." Manio, same.
19. "I subscribe to so many Substacks, and I read zero of them." Dennis Crowley, via Om Malik, https://om.co/2023/08/27/how-do-we-fix-the-too-many-newsletters-problem/
20. "there are just so many good (often very good) newsletters that even if we only take the free stuff, we're still committing ourselves to hours of reading per day" Loose Wire, https://www.loosewireblog.com/2025/09/readers-revenge.html
21. "For me the solution has been to dust off an old technology: RSS." Loose Wire, same.
22. "It's not algorithmic. You see what you subscribe to (it's free)." Matt Webb, https://interconnected.org/home/2023/12/29/recommendations
23. "And it gets you off Twitter." Matt Webb, same.
24. "I don't read every single post that goes by." Matt Webb, same.
25. "I was taken back getting an email from the company about my Pro subscription going from $49 a year to $89" digeratti, MacPowerUsers thread above.
26. "I don't mind paying but I think $50 a year would be my max" digeratti, same.
27. "They are extremely user hostile and see you as the enemy" NiKoBeaR, same.
28. "Please don't pay for a subscription for RSS lol." andy4222, same.
29. "I cannot find my own blog, like, at all. I'm not even indexed." dominicq, https://news.ycombinator.com/item?id=44634391
30. "haven't come across blogs where I consistently like the posts written" mmarian, same.
31. "Free services or VC-funded ones can shut down overnight." wallabag.it blog, https://wallabag.it/en/blog/2026/06/15/which-read-it-later-app-to-choose-in-2026/
32. "I've used Pocket religiously for many years." Alex Blake, TechRadar, link in section 1.6.
33. "unusably slow" (paying Feedly customers, via TechCrunch), https://techcrunch.com/2026/08/17/feedly-attributes-weeklong-slowdown-to-bug-not-its-ai-pivot
34. "I want to use my Kobo e-reader to read the news and other newsletters/RSS feeds in the morning." Mailbrew user, https://mailbrew.featurebase.app/p/will-pay-if-solved-need-either-brews-as-rss-or
35. "Will pay monthly for Mailbrew if this is resolved." same.

Note: quotes were returned by a summarizing fetch tool, not raw HTML. A few may be lightly trimmed; check exact wording on the page before using in public copy.

### Words people use (themes for copy)
"overwhelming", "anxiety", "personal failure", "graveyard", "inbox I have to zero", "joy, never stress", "not algorithmic", "gets you off Twitter", "controlled feeds", "calm" never appears as often as "control" and "joy". Suggested copy lines in that register: "A reading list, not a to-do list." "Nothing to catch up on." "You see what you subscribe to. Nothing else." "Newsletters out of your inbox, into your reading."

---

## 7. Pain point to solution map (summary)
| Pain | Type | Fit with calm ethos |
|---|---|---|
| Unread guilt | Product (catch up, pause feed) plus content | Perfect; core brand |
| Noisy feeds drown quiet ones | Product (per-feed cap, slow lane) | Good |
| Newsletter overload | Product (inbox to feed, in progress) plus free finder tool | Perfect |
| Finding feeds | Free tool plus article | Good |
| Finding blogs | Article, blogroll-follow idea | Good; no starter packs |
| Price anger, "RSS should be free" | Pricing page honesty, comparison to free apps | Neutral; ceiling ~$30 to $50/yr |
| Feedly decline | Migration page plus OPML import | Good if factual |
| Pocket/Omnivore trauma | Trust page: open code, export, "if we vanish" plan; maybe single-link saves | Good; needs owner decision on saves |
| E-reader reading | Weekly or daily EPUB edition | Strong book fit; check publisher floors |
| Reddit RSS ending | Timely article | Good; 13 Nov deadline |
| AI bloat | Positioning: no AI | Good |
| Weekly edition / digest (non-AI) | Product | Good |

## 8. Suggested next research
Mine Reddit with real access (r/rss, r/digitalminimalism, r/nosurf, r/selfhosted); App Store reviews of Reeder, Feedly and NetNewsWire; Product Hunt comments on Matter/Readwise; Lobsters threads; YouTube-to-RSS and Bluesky-to-RSS pain; Readwise Reader price complaints; any Artifact user retrospectives.
