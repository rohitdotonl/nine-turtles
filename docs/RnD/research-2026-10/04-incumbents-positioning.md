# 04. Incumbents, positioning, pricing, moats (research as of 25 Oct 2026)

Confidence note: facts marked [V] were read on the cited page. [S] = from a search snippet or an SEO roundup (treat as approximate). [K] = my prior knowledge, not re-verified. The web-fetch budget ran out before I could verify Meco/Stoop pricing, Readwise complaints, Ries/Trout and Play Bigger primary sources, and Opal/one sec figures. Several roundup sites (readless.app sells its own digest product; bolao.belgo.com.br, jingtea.com look like SEO spam) are biased or low quality; I leaned on them only for list prices.

## 0. The five things to know

1. **There is a direct calm competitor, and it is real: Current by Terry Godier** (launched 17-19 Feb 2026). "An RSS reader that doesn't count." No unread counts; articles sit in a "river" and fade. $9.99 one-time, Apple-only, no web yet, reportedly in maintenance mode since ~mid-2026. It proves the demand and hands nine turtles a gap: web + Windows/Android + sync + subscription-grade service + newsletters. (TechCrunch, 19 Feb 2026: https://www.techcrunch.com/2026/02/19/current-is-a-new-rss-reader-thats-more-like-a-river-than-an-inbox/ [V]; https://terrygodier.com/current [V])
2. **The incumbent price band is $50-$100/yr** (Feedbin $50-70, NewsBlur $36, Feedly Pro $60-72, Inoreader $90, Readwise $100-120). A calm reader can sit at $36-60 without looking cheap or expensive.
3. **Incumbents are drifting away from the calm reader**: Feedly toward enterprise threat/market intelligence, Inoreader toward power-user/team/AI, Readwise toward "everything inbox + AI". Nobody is shipping "finite, quiet, typographic" for web.
4. **Biggest positioning insight**: your ideal customer does not search for "RSS reader". The category name is a liability for them. Position on the outcome (a finished, quiet place to read the writers you chose) and treat RSS as the plumbing, not the pitch.
5. **Recommended position**: "The reading room for the open web" (a reader that ends), enemy = the feed (not other RSS apps). Details in section 2.

---

## 1. Competitor map (2026)

Prices USD. Sources in brackets.

### Directly relevant: calm / slow / minimalist

**Current (Terry Godier)** [V]
- Price: $9.99 one-time, no subscription (TechCrunch; MacMagazine/Moonwriting confirm). 4.5 stars from ~99 ratings; App Store updates paused ~111 days at time of an AI-generated analysis (marlvel.ai, low reliability) [S].
- Positioning: "RSS reader that doesn't count." Thesis: unread counts are "a measure of social debt"; "we imported the anxiety without the cause" (Godier, via TechCrunch).
- Mechanics: per-feed "velocity" (3 hours to 7 days); items fade; "Voices" (follow individual writers), Read Later, custom "currents"; full-text fetch; syncs Feedbin/Miniflux or iCloud local.
- Target: Apple-device people who feel RSS guilt.
- Weaknesses: Apple-only, no web (planned), one developer, reported UI freezes with big feed counts, maintenance-mode signs. Fading content is the opposite of "finite and complete": things vanish. nine turtles' "finite list you finish" is a different, arguably kinder promise (you decide it's done; nothing is quietly lost).
- Why it matters: it got a TechCrunch story and 9to5/appgefahren-style coverage for an RSS app. Proof that "calm RSS" is press-worthy in 2026. Also proof that a $9.99 price anchors "calm RSS" as cheap, which you must address (service vs app).

**Artemis** [V, Moonwriting blog: https://moonwriting.bearblog.dev/artemis-and-current-bringing-calmness-into-rss/]
- Free (donations), invite code, web-only, feeds refresh once a day, "Roll-up" groups busy feeds into one weekly entry, passkeys, no built-in reader (links out). Not open source. A hobby project; shows the same "refresh less, count nothing" instinct.

**NetNewsWire** [V via ttlab roundup]: free, MIT, Apple-only; the unofficial "calm default". 6.x stable, 7.0 beta on iOS. Competitor only in the sense of "free and good enough" for Mac/iPhone people.

**Unread (Golden Hill Software)** [V iMore, 2021; K]: minimalist, typography-led iOS/Mac reader; free with an annual premium (originally $19.99/yr). Closest *aesthetic* peer; native Apple only, needs a sync backend.

**Reeder, new (2024-) vs Reeder Classic** [V readless.app Oct 2026]
- New Reeder: $1.99/mo or $14.99/yr; free up to 10 feeds (no OPML import); iCloud sync; mixed-media timeline with a Today view; no Feedly sync. Classic (Reeder 5): $4.99 iOS / $9.99 Mac one-time, still maintained.
- Weakness: Apple-only; timeline model is feed-like (the "Today" stream is explicitly a timeline).

**Feeeed, Lire, Fiery Feeds, ReadKit, Folo**: indie Apple/cross-platform clients, mostly one-time or low subscriptions [K]. Not verified this session. Folo is the opposite of calm: "AI-powered information browser" on RSSHub (scraping-adjacent), crypto-style $POWER tokens, 76% of traffic from China (toolmage page, promotional) [S].

### Hosted RSS services (the sync/back-end incumbents)

| Product | Price | Position | Notes |
|---|---|---|---|
| **Feedly** | Free 100 sources/3 folders (with sponsored ads); Pro ~$6/mo billed yearly ($72); Pro+ $99 first year, $144 list (~$12/mo); Enterprise/Threat/Market Intelligence from ~$1,600/mo | "AI tools on top of your feeds" | Free tier tightened; AI search terms and multilingual limited to Enterprise; UI "increasingly targets teams and enterprises, which adds clutter" (Nubia review 1.4/5, a weak source but consistent with the pricing pages) [S]; feeder.co prices [V] |
| **Inoreader** | Free 150 feeds; Pro $7.50/mo yearly ($90) or $9.99/mo; Teams $45-630/mo | Power-user hosted reader, automation, EU-based (Innologica, Bulgaria) | Pro was $49/yr and went to ~$89-90 (Feb 2024 thread: "extremely user hostile", grandfathered $2.50/mo to $7.50). 2026 changes: merged filters, AI "Mentions" (Sep 2026), added Raindrop/Readwise save targets (PricingSaaS, 19 Oct 2026) [V] [MPU thread V] |
| **Feedbin** | $5/mo or $50/yr (feeder.co lists $7/$70, conflicting; ttlab says $5/$50); no free plan, 30-day trial | "No ads, no tracking", clean web reader, newsletters, open-source MIT, powers Reeder/NNW/Current | Solo dev Ben Ubois; trial signups roughly doubled summer 2025 [S]. The most direct "solo, paid, honest" peer. |
| **NewsBlur** | Free 64 sites; Premium $36/yr; Archive $99/yr; Pro $29/mo | Trains on what you like; social blurblogs; open source | "Not ideal if you want a modern, polished UI" [S]. Solo (Samuel Clay). |
| **BazQux** | ~$30/yr (MPU thread) [V] | Fast, serious, comment-aware | Plain UI; niche loyal base. |
| **The Old Reader** | Free 100 feeds; Premium $5/mo | Simple Google-Reader-style, social | Web-only, no apps [S] |
| **Miniflux hosted** | $15/yr; self-host free (Apache) | Minimalist power tool | Hosted refresh 1-2h; no mobile app; developer-audience [V feeder.co] |
| **FreshRSS** | Free, AGPL, self-host | Self-hoster default | Needs a server; not your customer. |
| **Feeder.co** | Free 200 feeds; Plus $7.99/mo yearly | Web/mobile, alerts | Alerts = anti-calm. |

### Read-later / "reading inbox"

- **Readwise Reader** (Readwise ships Reader inside the full subscription): $9.99/mo billed yearly or $12.99 monthly; $119.88/yr list; ttlab quotes ~$99.99/yr; 30-day trial; no permanent free plan [V readless.app 16 Oct 2026]. Reader's user base reportedly ~quadrupled Jun-Aug 2025 after Pocket's closure [S, ttlab]. Strength: highlights, PDFs, newsletters, YouTube, AI (Ghostreader), and your target readers *already pay* for it. Weakness: breadth equals complexity, a to-do-list feel (an "inbox of obligations"), AI everywhere. Not verified this session beyond price.
- **Matter**: ~$8/mo or $60-70/yr; heavier over time [S]. **Pocket**: shut down 8 Jul 2025, data deleted 8 Oct 2025 (Mozilla). **Omnivore**: shut down Oct 2024, team to ElevenLabs. **Instapaper**: stagnant. **Karakeep (ex-Hoarder)**: self-host, doubled GitHub stars in 2025 (ttlab roundup [V]). Lesson: read-later tools keep dying, so "will it still exist in five years" and "your data leaves with you" are real selling points. Publish the open code, the OPML promise and an explicit wind-down/export commitment.
- **Raindrop**: bookmark manager, ~$28/yr [K].

### Newsletter readers

- **Substack app**: a destination for Substack-hosted writers; its feed/notes are exactly the engagement mechanics you oppose [K]. 
- **Kill the Newsletter**: free, converts email newsletters to Atom feeds; the open-source plumbing; named in the MPU thread [V]. 
- **Meco, Stoop**: newsletter-only inbox apps; Meco is a subscription mobile app [S]. I could not verify current prices. Your "newsletters to feed" feature should be framed as "read newsletters in the same quiet place" and compete with Meco/Stoop's clutter-free inbox promise, but without a separate app.
- **Feedbin** already has an email-to-feed address, so newsletters are table stakes there.

### What nobody has combined
Web-first, finite, typographic (Apple Books feel), accessible to the floor of WCAG AAA text, open source, synced with Reeder/NNW, newsletters, priced as a service. Current has the philosophy but not the platform; Feedbin has the trust but not the soul; Readwise has the audience but not the calm.

---

## 2. Positioning for nine turtles (Dunford method)

Source for the method: Nat Eliason's notes on *Obviously Awesome* (https://www.nateliason.com/notes/obviously-awesome-april-dunford) [V]. Order: best-fit customers, then competitive alternatives (group into 2-5 clusters), then unique attributes (with proof), value, target characteristics, market category, optional trends. "Understand what a customer might replace you with in order to understand how they categorize your solution." The segment must be big enough and share a specific unmet need.

### 2.1 Competitive alternatives (what a Newport/Clear reader does today)
Cluster these, because only cluster 3 is "RSS":
1. **The feed**: Instagram/X/LinkedIn/YouTube/Reddit/Hacker News doomscrolling, plus "I quit" cycles. Cost: attention, anxiety, never finished.
2. **Inbox newsletters / Substack app**: subscribed to 40, reads 4, guilt folder. Cost: inbox clutter, unread-shame (the same problem Godier names).
3. **Other readers**: Feedly/Inoreader (power tools), Reeder/NetNewsWire/Unread (Apple apps), Current (calm, Apple-only).
4. **Read-later and AI curation**: Readwise Reader, Pocket (dead), Instapaper, Apple News, Kindle (Send to Kindle), Matter. Cost: another backlog; AI summaries replace reading.
5. **Doing nothing / bookmarks / "I'll read the blog when I remember"**.

### 2.2 Unique attributes (needs proof, not adjectives)
- Reading list that ends (finite unread, no counts-as-debt; no infinite scroll). Proof: product behavior and public design document.
- Apple Books-level typography and WCAG floor. Proof: public DESIGN.md; screenshots; contrast numbers.
- No notifications, badges, streaks, likes, ranking, ever. Proof: written "Never" list in a public repo.
- Respects publishers: only shows what the feed contains, links the original. Proof: public rule, "never scrapes".
- Open code and portable data: OPML in/out, standard APIs (Reeder/NNW sync). Proof: GitHub.
- Newsletters join the same finite list.

### 2.3 Value (as the customer's goal)
"I read what I chose to read, then I'm done, and I feel calm, not behind." Secondary: "My reading survives any one company" (portability).

### 2.4 Best-fit customers
People who have already felt the cost of feeds and already pay for reading tools: Kindle, Readwise, Notion, Substack/Ghost paying readers; people who tried Feedly once and abandoned it because of the unread number. Characteristics: reads long text, follows 10-60 writers, has quit or limited social media, owns an Apple/Android phone, tolerates a subscription. They do not know RSS but understand "subscribe to a writer directly".

### 2.5 Five positioning options evaluated

| # | Option | Category frame | Enemy | Strength | Risk |
|---|---|---|---|---|---|
| A | **"The reading room for the open web"**, a reader that ends | New-ish category: "slow reader" / "reading room" | The feed | Gives lapsed readers an outcome; rides Current's press; differs on finite vs fading; fits Books ethos | Needs a one-line explanation of what you actually *do* (it is RSS); "room" metaphor must be concrete |
| B | **"Apple Books for the web"** | Analogy to a known best-in-class | Cluttered readers | Instantly communicates look/feel for Apple-minded buyers | Trademark/imitation risk (careful: don't imply affiliation); Android/Windows readers don't resonate; "Apple" borrowed equity can read as derivative |
| C | **"The anti-AI, human-written web reader"** | Trend-led (relevant trends step) | AI summaries and slop | Timely, shareable, conveys values; supports "no summaries" stance | Narrow; trend-fragile; AI features are what some buyers want; Readwise/Feedly can ship an "AI off" toggle |
| D | **"For people who quit social media"** | Use-case: "where the quit people go instead" | Social platforms | Clear, huge emotional pull, matches Newport/Clear audience | Defines you by absence; hard to explain *what you do*; risk of sounding like a wellness app |
| E | **"The newsletter reading room"**: all your newsletters and blogs, out of your inbox, finished daily | Newsletter reader | Inbox overload | Biggest existing behavior (people already subscribe by email), no need to teach RSS | Meco, Stoop, Substack, Readwise, Feedbin all play here; newsletters are not your edge, the calm is; depends on a feature not yet shipped |

### 2.6 Recommendation: A, with D as the audience hook and E as the first on-ramp

Why:
- Category of one is available now. Dunford: choosing a category sets all the assumptions; head-to-head vs Feedly/Inoreader means being compared on feature count (you lose). Positioning as a "reading room" makes the comparison "does it end / does it feel like a book", where you win.
- Ries & Trout idea [K, partly verified via snippets only]: own one word in the prospect's mind and be first in a ladder. Candidate words: "finished" (the unique, ownable one; "finish your reading"), "quiet" (taken by many wellness products), "calm" (Calm app owns it; Current uses "doesn't count"), "slow" (Slow movement, but slows read as "late"). Recommended owned word: **finished** (you can be done). Close second: "ends".
- Play Bigger / category design [K]: name the problem before the product. The problem name could be "feed fatigue" / "unread debt" (Godier used "social debt", cite him, don't copy). Define a point of view, "a good reader has an end", and gather others around it (Newport/Clear-type writers).
- Blue ocean [K]: eliminate (counts, ranking, notifications, infinite scroll), reduce (settings), raise (typography, accessibility, finishing), create (end-of-list state, publisher-first).
- Enemy framing: HEY vs Gmail's "email is broken" (HEY launched June 2020 as "time for another revolution", $99/yr; BuiltIn Chicago https://www.builtinchicago.org/articles/basecamp-launches-hey-email [S]); Kagi vs ad-funded search ("users are the customer"; no regional pricing, with $5 minimum plans because of card fees, kagifeedback.org [V]); Glass vs Instagram (no ads, algorithms, public likes; $5/mo or $50/yr; "We are a home for photographers", PetaPixel https://petapixel.com/2021/08/12/glass-is-a-subscription-based-photo-sharing-app-for-photographers [V]). **Pattern**: the enemy is a *behavior/model*, not a competitor, and the price is a statement. Your enemy: the feed that never ends.
- Pinboard [V]: "pay to keep a system small", started as a rising one-time fee; moved to $11/yr in 2015 for simplicity. Indie lesson: a clear, steady, slightly premium price signals seriousness (https://blog.pinboard.in/2014/12/new_pricing_policy/).

### 2.7 Sample homepage copy (Option A)
- H1: **A reader that ends.**
  Sub: nine turtles brings the writers you chose into one quiet place. When you've read what's there, you're done.
- H1: **Read the web like a book.**
  Sub: Follow writers and newsletters you love. No counts, no streaks, no ranking. Just good type and a finish line.
- H1: **Your reading, finished by lunch.**
  Sub: A calm reading room for blogs and newsletters. Nothing pings. Nothing scrolls forever.
- H1 (D hook): **Quit the feed. Keep the writers.**
  Sub: Follow the people worth reading directly. We show you what they published, nothing else.
- H1 (E hook): **Get newsletters out of your inbox.**
  Sub: They arrive in a quiet reading room instead, with the blogs you follow, and they end.
- Trust line under every CTA: "Open source. Export everything, anytime. Pay once a year; no ads, no tracking, no AI summaries."
- Explain RSS in one sentence, low on the page: "Behind the scenes it uses RSS, the open standard writers have used for 25 years, so nobody can take your subscriptions away."

---

## 3. Pricing intelligence

### 3.1 Anchors
- Reeder new $14.99/yr (cheapest serious Apple option) [V]; NewsBlur $36; BazQux ~$30; Feedbin $50-70; Feedly Pro $60-72; Inoreader $90; Readwise $100-120; Glass $50; HEY $99 [S]; Miniflux hosted $15 (devs only) [V]. Current $9.99 once [V].
- **Suggestion**: **$48/yr ($4/mo equivalent)**, monthly $5, or $60 if you want to signal Feedbin-class seriousness. Under $50 sits clearly below Feedbin/Feedly/Inoreader/Readwise yet well above "cheap tool" territory, and it matches Glass's $50. Do not go below $36 (NewsBlur): the margin math with card fees (Kagi says it won't sell under $5/mo because of processing fees [V]) and the support burden of a 200-user business argues for annual-first.
- Show annual by default; offer monthly at ~25% premium. Pinboard's lesson: explain pricing in one sentence.

### 3.2 Lifetime deals (LTD)
- Pros: cash up-front for a solo founder, loyal early adopters, "no subscription" resonates with the calm audience, Current sells at $9.99 once.
- Cons: your costs are ongoing (fetching, storage, backups, support); LTD buyers are the heaviest support users; caps future revenue; Dodo's "double-edged sword" write-up and Freemius's structuring guide cover this (https://dodopayments.com/blogs/lifetime-deals-saas-pros-cons [titles seen only; fetch failed], https://freemius.com/blog/saas-lifetime-deals/ [S]).
- **Recommendation**: do not offer a true lifetime tier. Instead offer **Founding Member**: first 100-200 people pay a discounted annual rate (e.g. $36/yr) **locked for life as long as they stay subscribed**, with a public founders' list (opt-in) and a say in the roadmap. This gets the cash-and-loyalty benefit without an unbounded liability, and aligns with Inoreader's cautionary tale: grandfathered users went from $2.50/mo to $7.50 and called it "user hostile" [V MPU thread]. A written price-lock promise is a trust asset competitors lack.

### 3.3 Regional / India pricing
- Kagi refuses regional pricing because hard costs are the same everywhere [V]. nine turtles' marginal cost per reader is tiny (fetching feeds), so PPP is feasible; the real cost is support and fraud.
- Practical: Indian users are a small share of your Newport/Clear target but are your home market and network. Options: an India price around Rs 1,500-2,000/yr (~$18-24) via Razorpay/Stripe India or Lemon Squeezy/Paddle PPP tools (ParityDeals, Dodo Payments exist for this: https://www.paritydeals.com/ppp-pricing [S]). Cap it with country-of-card detection, no coupons stacking, and say it plainly: "We price fairly for where you live."
- Keep it quiet: do not advertise PPP in the main funnel (arbitrage), put it on the pricing page footnote.

### 3.4 Free tier
Feedly/Inoreader/Feeder give free tiers; Feedbin and Readwise give 30-day trials only. A calm product with no ads has no free-forever economic model; use a **30-day full trial without a card** (Feedbin/Readwise precedent) plus a permanent read-only export. A tiny free "10 feeds" (Reeder's model) is optional for sharing links.

---

## 4. Incumbent weaknesses a solo calm product can exploit

| Weakness | Evidence | Your move |
|---|---|---|
| Enterprise drift | Feedly's top plans are Market/Threat Intelligence from ~$1,600/mo; Nubia: UI "increasingly targets teams" [S] | Page: "nine turtles is for one person." |
| Paywall confusion | Pro+ advertises AI search but key terms Enterprise-only; pricing differs between pages [S] | One plan, one price, listed everywhere. |
| Price hikes against loyalty | Inoreader $49 to ~$89; prepaid grandfathered users hit [V] | Price-lock promise for founders; no surprise hikes. |
| Power-user/AI creep | Inoreader added AI "Mentions" Sept 2026; filters, Teams tiers [V] | "No AI summaries. Ever." (supports the "never" list). |
| Ads in free tier | Feedly free tier shows sponsored items [V feeder.co] | "No ads, no tracking" (Feedbin's line; make it bolder). |
| Ugly / dated | NewsBlur "not for a modern, polished UI" [S] | Typography as hero in screenshots. |
| Complexity / backlog | Readwise Reader = inbox + library + feed + highlights (breadth) [K] | "One list, one finish line." |
| Apple-only calm | Current, Unread, Reeder are Apple-only [V] | Web + PWA = Android, Windows, Linux, Chromebook readers. |
| Dying read-later | Pocket, Omnivore dead [V] | Open code, export, written wind-down promise. |
| Solo-dev fragility | Current in maintenance mode [S, weak source] | Public roadmap, frequent changelog, visible commits. |

---

## 5. Moats for a tiny product

1. **Taste as brand (effort low, payoff high).** Public DESIGN.md "Never" list and the "book vs feed" test are a manifesto; publish it as a page. Current, Glass, Things, Bear and iA Writer all win on taste being visible. Make every screenshot and error message on-brand.
2. **Trust through openness (effort low).** Public repo, no tracking, data export, price-lock, wind-down commitment. Competitors' reputations (Inoreader hike, Pocket death) make these real differentiators.
3. **A point of view with a name (effort medium).** Own "finished" and a coined problem name; write 5-10 essays ("The unread count is a debt", "What an end-of-feed feels like"). Newport/Clear-type audiences share essays, not feature lists.
4. **Curated starter packs (effort medium, payoff high).** Hand-picked "first 20 writers" bundles by interest (essays, science, design, India). Solves the "I don't know what to follow" cold start that kills RSS onboarding for the non-RSS audience, and is human taste that AI-bloated readers cannot match. Respect publishers: only link feed URLs.
5. **Community (effort medium).** A tiny, closed reader community (founding members, monthly reading list email via Buttondown/Ghost). Not a social feature in-app. Keep outside the product, per your anti-engagement ethos.
6. **Switching-cost reversal: portability as a promise.** Counterintuitive moat: be the easiest to leave. Reeder/NNW sync means users keep their clients; that is trust, and reduces fear of buying from a solo founder.
7. **Integrations that match their stack.** Save to Readwise/Notion/Kindle (Inoreader just added Raindrop/Readwise saves, so users expect it) [V]. Meets lapsed readers where they already pay.
8. **Distribution moats**: partner with a few digital-minimalism newsletters; "Works with Reeder/NetNewsWire" pages; a "Current vs nine turtles" and "Feedly alternative for calm readers" comparison page (Paddle's homepage teardown cites dedicated switcher pages as a pattern [V]: https://paddle.com/studios/shows/pricing-page-teardown/teardown-heycom-a-bold-and-opinionated-pricing-strategy).

### How small products beat giants (pattern summary)
- HEY: named an enemy (Gmail), loud manifesto, premium price ($99/yr) [S].
- Kagi: "you are the customer" + paying users; refuses discounts that break the model [V].
- Glass: subscription instead of ads, explicit anti-features (no public likes), invite-only scarcity, "home for photographers" niche [V].
- Pinboard: tiny, ugly, loved; price-as-filter; honest blog voice [V].
- Things/Bear/iA Writer: one-time or modest price, taste, platform-native polish [K].
- Opal/one sec: sell *friction* as the feature [K]; for you, the finish line is the equivalent friction. (Not verified this session.)
- Light Phone: "a tool, not a lifestyle" scarcity of features is the marketing [K].

---

## 6. Prioritised ideas (what / why / effort / payoff)

1. **Adopt "A reader that ends" as the core position; own the word "finished".** Why: category of one, differentiates from Current's "fading". Effort: low (copy). Payoff: high. Sources: Dunford notes; Current coverage.
2. **Build a "nine turtles vs Current" and "vs Feedly/Inoreader/Readwise" comparison page, honest and short.** Effort: low-medium. Payoff: high for search intent ("Current alternative", "Feedly alternative calm").
3. **Founding Member price-lock at ~$36/yr for the first 100-200; standard $48/yr; no lifetime tier.** Effort: low. Payoff: cash plus trust. Sources: Inoreader backlash; LTD articles.
4. **Starter packs (curated writer bundles) to solve cold start for non-RSS people.** Effort: medium. Payoff: high conversion.
5. **Web + PWA on Android/Windows as explicit counter to Apple-only Current/Unread/Reeder.** Already your architecture; say it on the homepage.
6. **Publish the manifesto page (the Never list) and a data/wind-down promise.** Effort: low. Payoff: trust moat.
7. **India price (~Rs 1,500-2,000/yr) quietly, with card-country check.** Effort: medium. Payoff: home-market goodwill and early users.
8. **Newsletters-to-feed as the on-ramp copy ("get newsletters out of your inbox").** Effort: depends on feature. Payoff: biggest top-of-funnel.

## 7. Risks and open questions
- Current might ship web and a subscription or a sync service; watch Terry Godier's site and App Store (updates paused summer 2026 per weak source).
- Don't claim "anti-AI" too hard if the roadmap will later include any AI; "no AI summaries" is safer than "no AI".
- "Apple Books" is best as an internal north star; avoid using Apple's name in marketing.
- Verify before publishing comparisons: Feedbin's current price ($5/$50 vs $7/$70 conflict), Meco/Stoop pricing, Readwise complaints, Unread's current model.

## Sources (all fetched or surfaced via search)
- TechCrunch on Current: https://www.techcrunch.com/2026/02/19/current-is-a-new-rss-reader-thats-more-like-a-river-than-an-inbox/
- Current site: https://terrygodier.com/current
- Artemis vs Current: https://moonwriting.bearblog.dev/artemis-and-current-bringing-calmness-into-rss/
- Current analysis (low reliability): https://marlvel.ai/intel-report/news/current-reader
- Inoreader pricing history: https://pricingsaas.com/companies/inoreader
- Prices comparison (Readless): https://www.readless.app/blog/readwise-vs-feedly-vs-inoreader-pricing-2026
- Reeder new vs Classic: https://www.readless.app/blog/reeder-vs-feedly-2026
- Feedly alternatives with prices (Feeder): https://feeder.co/knowledge-base/rss-basics/feedly-alternatives/
- Feedly review (weak source): https://nubiapage.com/feedly-review-2026-ai-app-pricing-login-alternativ/
- Roundup with ownership/shutdown dates: https://ttlab.hopto.org/blog/culture/2026-05-16-rss-readers-read-later-2026-reeder-netnewswire-inoreader-feedbin-miniflux-freshrss-karakeep-deep-dive?lang=en
- Old Reader/NewsBlur/Feedbin summary: https://usedigest.com/blog/how-to-choose-the-best-rss-feed-reader/
- Inoreader price backlash: https://talk.macpowerusers.com/t/rss-reader-inoreader-subscription-costs-doubled-90-yr-alternatives/36251
- Folo: https://www.toolmage.com/en/tool/folo/
- Unread free + premium: https://www.imore.com/unread-25-sees-rss-reader-go-free-first-time
- Glass: https://petapixel.com/2021/08/12/glass-is-a-subscription-based-photo-sharing-app-for-photographers
- Kagi regional pricing: https://kagifeedback.org/d/687-implement-regional-pricing/29
- Pinboard pricing: https://blog.pinboard.in/2014/12/new_pricing_policy/
- Dunford method notes: https://www.nateliason.com/notes/obviously-awesome-april-dunford
- Paddle homepage teardown: https://paddle.com/studios/shows/pricing-page-teardown/teardown-heycom-a-bold-and-opinionated-pricing-strategy
- HEY launch: https://www.builtinchicago.org/articles/basecamp-launches-hey-email
- Lifetime deals: https://dodopayments.com/blogs/lifetime-deals-saas-pros-cons , https://freemius.com/blog/saas-lifetime-deals/ (titles/snippets only)
- PPP tools: https://www.paritydeals.com/ppp-pricing
