# 08 - Business model, viability, distribution (nine turtles)

## READ THIS FIRST: evidence quality
The research tools were badly limited. WebSearch returned only titles and URLs (no snippets). WebFetch was refused on every call because the shared 100-per-hour budget was exhausted. So I read no page bodies this session.
Everything below is therefore one of:
- [URL-LISTED] a page that exists and is the right place to verify; I did not read it.
- [MEMORY] from my training knowledge (to about mid-2026), not re-verified today. Treat figures as approximate and re-check before they go in any doc.
- [MATH] arithmetic I did myself.
Nothing here should be quoted to the owner as a sourced fact until re-verified. Section 8 lists exactly what to re-check first.

## 1. Market sizing and viability

### What is known about comparable businesses [MEMORY unless noted]
- Feedbin (Ben Ubois): bootstrapped for years, tiny team, $5/month or $50/year. Public "first year" post exists [URL-LISTED: https://feedbin.com/blog/2014/03/11/feedbins-first-year] and Ben talked about the business on Changelog [URL-LISTED: https://changelog.com/podcast/499]. I recall it sustaining a very small team, with a 2020s RSS resurgence; no precise current revenue is public to my knowledge. Takeaway: a $5 flat price, no free tier (only a trial), has lasted a decade.
- NewsBlur (Samuel Clay): effectively a one-person, open-source, YC-backed product. Premium is about $36/year, with higher "Premium Archive" and "Pro" tiers. Samuel has written publicly about funding the whole thing from subscribers [URL-LISTED: https://forum.newsblur.com/t/an-outsized-thank-you-and-a-small-worry/4569, https://newsblur.com/about]. Takeaway: proof that a solo, open-code, subscription RSS reader survives for 10+ years, without getting rich.
- Inoreader (Bulgarian company, a team of dozens) and Feedly (venture-funded, enterprise "threat intel" pivot) are the scaled players. Both earn mostly from business/power users. Not comparable for a solo calm reader.
- Readwise/Reader: Daniel Doherty runs Readwise as a small team and has publicly said it is profitable and bootstrapped, at about $10-13/month. It is the closest "reader who pays for reading tools" audience. Re-verify the revenue figure.
- Matter: venture-funded, about $8/month, a read-it-later and newsletter reader. Reeder (Silvio Rizzi): one-person; classic apps were one-time purchases, and the new Reeder moved to a low-cost subscription with a free tier. Unread (Jared Sinclair, then sold): one-time or low subscription. Exact current prices: verify.
- Lesson across all of them: the paying audience for RSS is real but small and loyal. Nobody in this niche is a venture-scale business. Several are sustainable one- to three-person businesses. Churn is low because readers keep years of subscriptions and read state.

### Viability maths for a solo founder in India [MATH]
Assume net revenue per subscriber is about 90% of the sticker price (merchant of record fee about 5% plus a fixed per-transaction fee; see section 6). Assume roughly Rs 85-90 per US dollar (verify the rate). Dollar subscribers pay in dollars, so a stronger dollar helps.

| Target MRR | At $4/mo | At $5/mo | At $6/mo | At $8/mo | Approx INR/month before costs |
|---|---|---|---|---|---|
| $1,000 | 280 | 225 | 185 | 140 | ~Rs 85,000 |
| $3,000 | 830 | 665 | 555 | 415 | ~Rs 2.5 lakh |
| $10,000 | 2,800 | 2,225 | 1,850 | 1,390 | ~Rs 8.5 lakh |

(Subscribers = MRR / (price x 0.9), rounded.)
Reading it:
- The first 100-200 paying users is about $500-$1,200 MRR at $5-6. That is real money for covering hosting and tools, and Rs 40,000-100,000 per month. It is a part-time income, not a living, for most Indian cities except in a lean household. Rough guide [MEMORY, indicative only]: a single person in a Tier-1 Indian city comfortably lives on Rs 60,000-1,00,000 per month; a family wants Rs 1.5 lakh and more. So about $1,500-2,000 MRR (about 300-400 subscribers at $5-6) is "quits-the-day-job-if-frugal" territory, and $3,000+ is comfortable.
- Annual-heavy mix improves cash flow. Dollar income is also taxed under Indian rules (GST on exports of services, income tax): consult an accountant. Dodo being the merchant of record handles the buyer-side VAT and sales tax, not your own Indian tax.

### Churn benchmarks [MEMORY + URL-LISTED]
RevenueCat's State of Subscription Apps is the reference [URL-LISTED: https://www.revenuecat.com/state-of-subscription-apps, https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026]. From the 2024-25 editions as I remember them (verify the 2026 numbers): median trial-to-paid conversion around 35-40% for opt-in trials (highest for the longest, 17-32 day trials); direct download-to-paid conversion for freemium only about 2% (median, with top quartile around 5%); monthly plans lose roughly 30% of subscribers in the first month, and annual plans retain far better but about 30% of annual subscribers still cancel at the first renewal. Productivity/Business categories sit in the middle. A reading/RSS tool with sticky data and a calm, habit-forming use likely beats the median. Use a planning churn of 4-6% per month for monthly subscribers in year 1 and 25-35% annual non-renewal as the pessimistic case, 2-3% monthly as the optimistic one. RevenueCat's trial-length post [URL-LISTED: https://www.revenuecat.com/blog/growth/free-trial-length] is the one to read for the 7 vs 14 vs 30 day question.

## 2. Pricing models

Recommendation in one line: one plan, two billing periods (about $5-6/month, about $48-60/year), a 14-day free trial with no card, a "founding reader" price lock for the first 200, and PPP pricing for India and similar markets. No freemium, no lifetime deals.

| Model | Evidence / reasoning | Fit for nine turtles | Verdict |
|---|---|---|---|
| Monthly + annual | Annual-only raises cash up front but cuts conversion; Feedbin/NewsBlur/Inoreader all offer both [MEMORY]. | Fits. Show annual as the default, with two months free. | Do |
| Free trial, 14 days, no card | RevenueCat data suggests trials of 17-32 days convert best among opt-in trials, but a no-card trial attracts more tire-kickers. For a reader whose value shows after a week of habit (read an inbox, feel the finite list), 14 days is the compromise [URL-LISTED trial-length post]. | Fits the "finite, calm" story: the trial is a calm experiment, "read nine turtles for two weeks". | Do: 14 days, extend to 30 on request (concierge) |
| Freemium by feed count | Roughly 2% download-to-paid in freemium [MEMORY]; free users cost fetching and support; Inoreader and Feedly use this; Reeder moved toward it. | Hosting is one Render instance with free-user fetch load; a feed cap also fights the "follow what you love" ethos. | Skip at launch; maybe a read-only grace after cancel |
| Reverse trial (premium first, then drop to free) | Works for apps with a real useful free tier. | You have no free tier. | Skip |
| Founding reader lifetime price lock | Cheap, loyalty-building, no AppSumo churn. Tell them "your price is yours as long as you stay subscribed". | Very good for the first 100-200. | Do |
| True lifetime deal (AppSumo-style) | Brings a spike of cash, then permanent hosting and support liability and review-hungry deal hunters. Many indie founders regret them [MEMORY]. | Poor fit; also a single Render instance. | Avoid; if ever, cap at about 50 at 3-4x annual, labeled as supporter |
| Regional / PPP pricing | Standard in indie SaaS; most merchant-of-record platforms support localized prices (check that Dodo supports per-country prices). India is also the founder's home audience. | Good. | Do: about 50-60% of USD price for India and low-income markets, verified for abuse by billing country |
| Pay-what-you-want | Works for donations, poor for infrastructure that costs per user. | Consider only as "pay more if you can" tier | Skip |
| Gift subscriptions | Natural for a "books" brand (give a year of reading to someone). Needs merchant support for codes; check Dodo. | Strong thematic fit and a calm referral loop. | Later (after 200 users) |
| Family plan | More hosting, more support. | Wait for multi-reader support (decision 0086 is already heading that way). | Later |
| Student pricing | Common 30-50% off with .edu checks. Low revenue, good word of mouth. | Worth a manual email-based discount. | Cheap manual version |

Competitor price anchors [MEMORY, verify]: Feedbin $5/mo; NewsBlur about $36/yr; Inoreader Pro roughly $10/mo ($90/yr-ish); Feedly Pro from about $6-8/mo; Readwise Reader about $10/mo (annual about $100); Matter about $8/mo; Reeder cheap annual. A $5-6/month, $50-60/year nine turtles sits with Feedbin, below Readwise, and is justified by a calmer product and sync with the Reeder/NetNewsWire apps.

## 3. Distribution beyond SEO

### Launch platforms [URL-LISTED only; effect sizes are my judgement]
- Product Hunt: still the most recognised launch day, but 2025-26 commentary says it is crowded, AI-dominated and mostly good for backlinks and a spike of mixed-quality signups. See https://dev.to/john_musk/product-hunt-is-still-relevant-in-2026-just-not-as-you-thought-5g36 and the contrarian https://medium.com/@hii_mohit/the-6-best-places-to-launch-in-2026-and-why-producthunt-isnt-one-cd80f4f46f34. For a calm-reading app whose audience is not the PH crowd, expect modest payoff. Do it once, low effort, after the first 50 users, with a story ("a reader that ends") rather than features.
- Hacker News "Show HN": The best fit for this product, since HN has a lasting, vocal RSS audience and cares about open source and no lock-in. Rules: post as "Show HN: ...", link to something people can try without signing up (a demo reader with a public feed set), say it is a paid hobby-scale product, be present in comments for hours, and never ask for upvotes. Payoff: from a few hundred to several thousand visitors and a handful of paying users per good post [MEMORY]. Effort: low to medium. Best launch to try first.
- Indie Hackers, Peerlist (India-friendly), BetaList, Uneed, Microlaunch, Fazier, Tiny Startups: lists of "still working" alternatives: https://peerlist.io/praneetbrar/articles/10-best-startup-launch-platforms-in-2026-where-should-you-la, https://pinggy.io/amp/blog/best_producthunt_alternatives/, https://witscode.com/resources/saas-launch-playbook/product-hunt-alternatives, https://dev.to/lightningdev123/beyond-product-hunt-a-technical-launch-guide-for-2026-i2j. Judgement: these mostly yield backlinks and a trickle of signups; do two or three (Peerlist and Indie Hackers for founder community; BetaList for the early-adopter list), skip the rest. An hour each.
- Reddit: r/rss, r/selfhosted (the code is open), r/digitalminimalism, r/Fedi? Follow each subreddit's self-promo rules; answer "what RSS reader should I use" threads honestly. Best free, ongoing source of the exact audience.
- Lobsters and the Fediverse (Mastodon: the RSS and indie web crowd lives there): high intent, small.

### App and software directories
- AlternativeTo (list as an alternative to Feedly, Inoreader, Feedbin, Pocket-style readers), SaaSHub, Slant: free, long-tail evergreen traffic; 30 minutes each. Get "alternative to Pocket" and "alternative to Google Reader" angles.
- Microsoft Store via PWABuilder, and Google Play via a Trusted Web Activity (Bubblewrap): both accept PWAs, are free or cheap (Play one-time $25; Microsoft individual account about $19 [MEMORY]). They add discoverability and a "real app" feel. Caveat: store billing rules. For Play, TWA digital goods may be required to use Google Play Billing if sold inside the app; selling on the web with a "sign in" flow is the usual workaround but it is a policy risk. Consider Microsoft Store first (less restrictive), Play later.
- Setapp: macOS app subscription bundle; native apps only, so a web app does not fit. Skip.
- Bundlehunt / indie bundles: usually lifetime-style; skip for now.

### Newsletters, podcasts, creators (names to approach; audiences and prices must be checked; I did not retrieve rate cards)
- Newsletters in the niche: Cal Newport's Deep Questions/newsletter (not sponsorship-friendly), James Clear's 3-2-1 (sponsors exist, expensive), Austin Kleon, Maggie Appleton and the indie-web digest circles (Indie Web News, "Weekend Reading" style lists), Ben Thompson-style sites are too big. Cheaper targets: Matt Webb, Tom Critchlow, Dense Discovery (design-minded, takes sponsors), The Sample, Hey Wait What's RSS-related posts like "Feedbin newsletters" lists, Blogroll and "Ye Olde Blogroll" communities, Frank Chimero, Tyler Cowen-style link blogs. Dense Discovery and Sidebar-style design newsletters are good fits; price ranges for small newsletters are typically $100-$1,000 per slot [MEMORY].
- Podcasts: Cal Newport's Deep Questions (guest bookings are rare; being a listener-question example is easier), Dan Koe-adjacent are off brand; try small shows on digital minimalism, "slow web", and indie-maker shows (Indie Hackers podcast, Bootstrapped Web, Syntax-type shows covering RSS revival, The Changelog already covered Feedbin). Pitch the founder story: "non-programmer from India builds a book-like reader with AI agents, and open code". That story is the strongest hook; "AI-built, accessible, open" is genuinely newsworthy in 2026.
- YouTube: productivity and note-taking channels (Keep Productive, Ali Abdaal, Thomas Frank, Tiago Forte's Forte Labs, Obsidian and Notion YouTubers, minimalist-tech creators). Sponsored videos cost thousands; free route is giving free lifetime/annual accounts to 10-20 mid-sized creators (10k-100k subs) and asking for an honest review with no obligation. Disclose per local rules.
- Digital minimalism angle: Newport's followers use "Light phone", "Substack replacements", e-ink readers. Co-promotion with Kindle/Readwise power-user blogs (Readwise's own community and its "Reader" users who want a calm inbox) is likely the best audience match.

### Affiliates and referral
- Dodo Payments advertises affiliate/discount-code features on its site [URL-LISTED https://dodopayments.com/pl/pricing; verify], so you may not need to build one. Otherwise a simple referral code system: 30% for the first year or one free month each way. Keep it calm: a plain "give a friend a month, get a month" line in Settings, never a pop-up or a leaderboard.
- Natural affiliates: RSS bloggers, "blogroll" owners, productivity newsletter writers. Pay 30-40% recurring for year one; it costs nothing until a sale.

### Other channels
- Corporate wellness / L&D stipends: some employers reimburse tools for learning, books, or focus. A one-page "Expense this" letter and invoice (Dodo gives receipts) for reading-professional audiences (researchers, analysts, consultants) is cheap to provide. Merchant-of-record invoices should show company names; check Dodo supports business invoices with tax IDs.
- Libraries and schools: slow procurement, low price; park until after 500 users. Education pricing by email is enough.
- Press: tech and design press (The Verge-style) rarely cover tiny readers. Better: Hacker News front page, Daring Fireball-style link blogs, MacStories-like blogs; and Indian startup press (YourStory, Inc42) love "built by a non-programmer with AI".

## 4. Apple App Store question
- PWA on iOS: installable via Share > Add to Home Screen, and iOS 16.4+ supports web push (irrelevant for nine turtles by principle). Limits: no App Store search presence, no widgets, background refresh limited, install flow is hidden to many users [MEMORY].
- Is App Store search a big channel for this audience? For "RSS reader" it is dominated by Reeder, NetNewsWire, Feedly, Inoreader, Unread; new entrants rank poorly without reviews. The target audience (digital minimalists with Readwise/Kindle) finds tools through people and newsletters more than store search. So: not a launch priority.
- The cost of a native wrapper: Apple Developer Program $99/year (India price may differ), App Review rules on web-wrapper apps (guideline 4.2 minimum functionality), and in-app purchase rules, though the US ruling in 2025 loosened external link rules in the US only [MEMORY: verify]. Because nine turtles syncs with Reeder and NetNewsWire, iOS users can already read in a native app and use nine turtles as the sync account. This is the best "App Store" strategy: be present inside those apps' sync lists and ask their developers for a mention.

## 5. Retention as marketing
- Concierge onboarding for the first 100: a personal welcome email from Rohit within a day, one question ("what do you want to read more of?"), and an offer to import and tidy their OPML. Reply to every response. This is the highest-payoff activity of the whole plan.
- "Founding readers" page (names optional) and a small private mailing list or forum; yearly letter in the style of a letter from the editor (what changed, what it cost, what's next). Matches the book ethos and a transparent open-code story.
- Calm referral/gifting: gift a year; "pass a month to a friend". No streaks or progress bars.
- Win-back: one email at cancel asking why (single question), a data export reminder (OPML) that builds trust, and one email at 60 days with what's new. Offer pause instead of cancel (a 1-3 month pause is a retention tool that still feels calm).
- Failed-payment recovery: merchant-of-record dunning handles most; check Dodo's retry settings, since involuntary churn is often 20-40% of churn in consumer subscriptions [MEMORY].

## 6. Unit economics sanity check [MATH + MEMORY]
- Dodo Payments fees: I recall about 4% + 40 cents per transaction (higher for some payment methods, plus extra for international cards/payouts and subscriptions); the pricing pages are listed at https://dodopayments.com/pl/pricing but I could not read them. Verify. The fixed 40 cents hurts at low prices: on $5 it is 8% + 4% = 12% effective (net $4.40); on $50 annual it is 4.8% (net $47.60). So steer people to annual: this is also the strongest financial argument for annual-first display.
- Hosting: single Render Starter instance (about $7/month) plus 1 GB disk (about $0.25/GB/month) [MEMORY]. Feed fetching is mostly a bandwidth/CPU problem, not a storage one; at 100 readers x 100 feeds with de-duplicated feeds (shared feed cache across readers) it is very light. Backups to Cloudflare R2: free tier 10 GB; negligible. Estimated infra per user: about $0.05-0.20/month; so gross margin >90%.
- Break-even: fixed costs approx hosting $10 + domain $1-2 + email service $0-10 + error tracking free + accountant/GST maybe $20/month = $40-50/month. At $4.40 net per monthly user that is about 10-12 paying subscribers. Break-even is therefore very early. The real cost is Rohit's time and AI agent subscriptions (probably the largest line: $20-200/month), so count about 40-60 subscribers to cover all tools.
- Scale limit: one Render instance with SQLite means vertical scaling only; the first real bottleneck is likely the fetcher at several thousand readers. That is far beyond the 200-user goal.

## 7. Suggested 12-week sequence (cheap first)
1. Weeks 1-2: finish pricing page (annual-first, 14-day trial, founding price lock), PPP for India, a demo reader. Pre-write the HN post.
2. Weeks 2-4: personal outreach to 50 people (r/rss, Mastodon, Reeder/NetNewsWire communities, readers of Newport and Clear) for 20-30 founding readers with a concierge welcome.
3. Week 4-5: Show HN. Then AlternativeTo, SaaSHub, Peerlist, Indie Hackers.
4. Weeks 5-8: free accounts to 10-20 small creators/bloggers, plus a sponsored slot in one design-minded newsletter as an experiment ($100-500).
5. Weeks 8-12: Microsoft Store listing via PWABuilder; a gift-a-year option; first "letter to readers".
Measure by: trial starts, trial-to-paid (target 25%+), month-3 retention, and where each paying user came from (ask in the welcome email).

## 8. What to re-verify first (the research gap)
1. Dodo fee schedule (percent, fixed fee, subscription, international, payouts to India) and whether it supports PPP prices, gift codes, affiliates and business invoices.
2. RevenueCat 2026 numbers (trial conversion by length, annual vs monthly retention, category medians).
3. Feedbin/NewsBlur/Readwise revenue statements and the current prices of Inoreader, Feedly, Matter, Reeder, Unread.
4. Sponsorship rate cards and audience sizes for Dense Discovery, Indie Hackers newsletter and similar.
5. Apple and Google policy on web wrappers and external payment links for India-based developers.
6. Indian tax treatment (GST on export of services, foreign income): talk to an accountant.

## Sources (URLs listed by search; bodies not read)
- https://feedbin.com/blog/2014/03/11/feedbins-first-year
- https://changelog.com/podcast/499
- https://newsblur.com/about
- https://forum.newsblur.com/t/an-outsized-thank-you-and-a-small-worry/4569
- https://www.revenuecat.com/state-of-subscription-apps
- https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026
- https://www.revenuecat.com/blog/growth/free-trial-length
- https://dev.to/john_musk/product-hunt-is-still-relevant-in-2026-just-not-as-you-thought-5g36
- https://medium.com/@hii_mohit/the-6-best-places-to-launch-in-2026-and-why-producthunt-isnt-one-cd80f4f46f34
- https://peerlist.io/praneetbrar/articles/10-best-startup-launch-platforms-in-2026-where-should-you-la
- https://pinggy.io/amp/blog/best_producthunt_alternatives/
- https://witscode.com/resources/saas-launch-playbook/product-hunt-alternatives
- https://dev.to/lightningdev123/beyond-product-hunt-a-technical-launch-guide-for-2026-i2j
- https://dodopayments.com/pl/pricing
