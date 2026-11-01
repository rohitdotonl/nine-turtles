# nine turtles: lesser-known tactics, other industries, indie playbooks, boring cash cows

Research note, 25 Oct 2026. Area 06.

## 0. How to read this (honest limits)

- The page-fetch budget ran out mid-session (shared 100/hour limit), and the search tool returns only titles and URLs. So every claim below is labelled:
  - **[V]** = read on the page I fetched (numbers are from that page).
  - **[T]** = I only saw the page title/URL in search results; the URL is evidence the page exists, not that I read it.
  - **[M]** = from my own background knowledge, not re-verified today. Treat as a lead, check before quoting.
  - **[N]** = my own idea, untested by anyone I could find.
- Everything is filtered through nine turtles' rules: no countdowns, fake scarcity, streaks, notifications. Several famous tactics (Superhuman's waitlist, Duolingo) are used only for their *shape*, never their dark patterns.

## 1. The five findings that matter most

1. **Distribution beats marketing, and the winners of this category got it through a "side door".** Feedbin's whole start was Google Reader's shutdown plus early Reeder support [V: https://feedbin.com/blog/2014/03/11/feedbins-first-year]. Pocket got into hundreds of apps' share menus through the open-source ShareKit [V: https://www.slax.com/blog/read-it-later-growth-history/]. For nine turtles the equivalent is: be the reader that other people's products point at (section 2.1).
2. **The break-even is tiny.** Feedbin's founder wrote that roughly 100+ paying users covered monthly costs at launch (about $170/month), and profit was $1.62 per user per month after card fees [V, same Feedbin post]. nine turtles' "first 100-200" goal is the right order of magnitude for a viable solo business, and cost discipline (free tiers, one binary, one SQLite file) is a real moat.
3. **Paid-only is a feature, not a barrier.** Pinboard's founder explicitly priced to "keep the user base manageable"; a free Pinboard would have collapsed during the Delicious shutdown, while the paid one absorbed the surge [V: https://highscalability.com/pinboardin-architecture-pay-to-play-to-keep-a-system-small/]. Pocket going free brought scale (about 4.5M users at rename) but "not income" [V: slax.com above].
4. **Publicity from one trusted person can equal years of effort.** Instapaper's launch was covered by Daring Fireball and TechCrunch within two days; a single "Free App of the Week" week brought more downloads than the previous two years combined and lifted subscriptions 10-15% [V: slax.com]. Micro.blog funded via Kickstarter in 2017, i.e. community pre-commitment [T: https://wptavern.com/micro-blog-surpasses-kickstarter-funding-goal-set-to-launch-new-social-network-for-independent-microblogs, https://davepeck.org/2017/02/03/indie-microblogging-kickstarter-success]. Pick 10 trusted people and be genuinely useful to them; do not spray.
5. **The audience nine turtles wants already gathers around a small set of brands and newsletters** (Newport, Clear, Kleon, the NoSurf/dumbphone subculture). Sponsoring, partnering or being recommended there is the shortest line from "never heard of RSS" to "I'd pay for this".

## 2. Lesser-known tactics (ranked within each block by my confidence)

### 2.1 Side-door distribution

**A. "Read in nine turtles" / follow-button standard.** [N, partly M]
- What: a tiny, open snippet (a link plus a one-line explainer) any blogger/newsletter writer can paste: "Follow this site in your reader" that deep-links to `app.nineturtles.app/add?url=...`. Prefilled subscribe flow; no account needed to preview (it shows what the feed looks like), account needed to keep it. Ship it also as a Hugo/Eleventy/Jekyll/Ghost/WordPress snippet and a PR to theme repos.
- Why it could work: it targets the one audience that already *knows* RSS and has audience of their own. Each install puts a nine turtles link on a real page, which is a permanent referral plus a backlink. nine turtles is already built on Eleventy for its own website, so the snippet is dogfooded.
- Precedent: Pocket's ShareKit approach [V: slax.com]; Feedbin's Reeder integration [V]. The closest live analogues are "Subscribe with Feedly"/"Follow in Feedbin" style buttons and Micro.blog/Bear's RSS-first stance [T: https://herman.bearblog.dev/manifesto/].
- Effort: medium (a week for snippet + landing, then months of low-key PRs). Payoff: compounding, slow. **Unproven for paid readers**, but proven shape.

**B. Be the "recommended reader" in small-web platforms.** Bear Blog has about 5,500 blogs at the time of that post, hides new blogs until approved, and is founder-curated [V: https://herman.bearblog.dev/running-a-blogging-platform/]. Bear's discovery feed and the Bear manifesto [T] both lean on RSS. Offer Herman (and Micro.blog's Manton Reece, Ghost, Buttondown, Write.as, Pika, Omg.lol) something concrete: a one-click "follow in nine turtles" in their "subscribe" pages, or a free year for their sponsors. Ask, explain, and accept no. Effort: low (emails). Payoff: unknown; each is a ~hundreds-to-thousands-of-readers pond of exactly the right people. **Unproven.**

**C. Kagi Small Web as a peer.** Kagi runs "Small Web", a curated list of non-commercial personal sites with a feed-like browsing experience, and in March 2026 TechCrunch covered its mobile apps [T: https://blog.kagi.com/small-web, https://www.techcrunch.com/2026/03/17/kagi-small-web-human-authored-indie-internet-mobile-ios-android-devices/]. Idea: nine turtles publishes an OPML of "the small web" (made-up fixtures stay out of the repo; this would be a public, owner-approved list) and offers "subscribe to the whole small web" as an import. Careful: AGENTS.md forbids committing the owner's OPML, so build it from public sources like Kagi's list under their terms. Also reach out to Kagi's community (Kagi users pay for search; they already believe in paying for calm software). Effort: medium. **Unproven.**

**D. Wikipedia "Comparison of feed aggregators" and alternativeto.net entries.** [M] Low effort, permanent, neutral language only, and you need independent sources (the coverage from any press hit works). Do last, after one press hit. AlternativeTo's Kagi Small Web item shows the site covers this niche [T: https://alternativeto.net/news/2023/9/kagi-introduces-small-web-initiative-to-spotlight-non-commercial-web-content].

**E. Design galleries as backlink and traffic.** Minimal Gallery, Godly, Land-book, siteinspire, One Page Love, Awwwards-like sites accept submissions; the Indie Hackers thread and several lists confirm the set exists [T: https://www.indiehackers.com/post/the-best-design-directories-to-show-off-your-work-e7b0c99522, https://designerup.co/blog/incredible-places-to-find-web-design-trends-and-inspiration-for-2024/]. nineturtles.app's landing page is the thing to submit (not the app). Because the product ethos is typographic calm, it is natural gallery bait. Effort: low (an afternoon of submissions). Payoff: backlinks plus designer-audience trickle; the designer/creative crowd overlaps with Readwise/Notion buyers. Proven for SEO/backlinks in general; unproven for conversions. Do not pay for "featured" slots.

**F. Directory sweep.** Marc Lou's ShipFast reached about $43k/month in two months with an "unconventional" approach (title evidence only) [T: https://www.indiehackers.com/post/marc-louvions-unconventional-marketing-approach-that-grew-ship-fast-to-43k-monthly-revenue-in-2-months-ff9af24080]; a common companion tactic is submitting to ~100 startup directories for backlinks [M]. For nine turtles: do ~15 of the *relevant* ones (AlternativeTo, Product Hunt page as a quiet archive, Indie Hackers product page, Slant, "Awesome RSS" GitHub lists, Hacker News "Show HN" once). Skip the spam sweep. Effort low; payoff small but permanent.

### 2.2 "Powered by" loops without being creepy

- **Hotmail-style footer loop** [M: Hotmail's "Get your free email at Hotmail" signature]. nine turtles has no outbound email from users, so the loop has to live elsewhere: the *shared page*. When a reader shares an article, the share goes to the publisher's link (rule: share the publisher's link). So put nothing there. Instead: the newsletter-to-feed address (coming feature) could return a polite header "delivered by nine turtles" only to the *sender's* RSS view? No; avoid. **Verdict: do not run a footer loop.** It breaks "respect the publisher". The only loop allowed is publisher-opt-in (2.1A).
- **GitHub README badge.** [N, M] The repo is public; a README badge "reads in nine turtles" and a one-page "colophon" that lists the stack. Developers' blogs link to products they respect. Cheap, honest.
- **Colophon page** as marketing: Basecamp, Kinfolk and many indie blogs publish how it was made. nine turtles can publish the AI-agent build story plainly: "built by a non-programmer with agents; here are the checks." Valuable to the Hacker News/Lobsters crowd and to the "AI-built software that is actually checked" curiosity. [N]

### 2.3 Gifting and patronage

- **Gift subscriptions.** Pinboard sold gift-ish low prices; Feedbin and Pinboard both show readers happily pay small annual fees. Books-like model: "give a year of reading to someone who left social media." Gift codes cost nothing, are not scarcity, and match the bookshop gift culture. Also the cleanest answer to "most people have never heard of RSS": the giver explains it. Effort: medium (Stripe gift code, one email). Payoff: seasonal (Nov-Dec). Proven in books/magazines [M], unproven in feed readers.
- **Pay it forward** (buy one extra year that a stranger receives, for students/people who cannot pay). Bear is sponsorware and notes "99.9% of people will not contribute to anything they can receive for free" [V: running-a-blogging-platform], so don't depend on donations; treat as a small gesture, not revenue. 
- **Readwise's community offer.** A creator-community code: Praxis readers got an extra 30 days free if they replied saying so [V: https://fortelabs.com/blog/interview-with-readwise-founders/]. Replicate with one-off *community* trials (NoSurf, Cal Newport readers, a book club) that cost the founder an email reply, not a system. Cheap, personal, trackable.
- **Reverse trial.** Full access for 30 days, then a limited read-only state (reading and exporting always free; never delete). This respects "never lose data". [M] Fits the calm ethos better than a hard paywall.

### 2.4 Manifestos, constraints, pricing page as manifesto

- Bear's manifesto is a real traffic and trust asset [T: https://herman.bearblog.dev/manifesto/]. nine turtles' DESIGN.md "Never" list is already a manifesto; publish a one-page "Our six refusals" (no notifications, no badges, no streaks, no infinite scroll, no ranking, no likes) and make the pricing page say what the money buys and what it never will. Pinboard's weirdly honest price page is the model: the founder admitted "an astonishing number of people already believe they're paying annually" and fixed the confusion by simplifying [V: https://blog.pinboard.in/2014/12/new_pricing_policy/]. Effort low. Payoff: trust and shareability. Proven pattern.
- **Pinboard-style rising price.** The sign-up fee ($10.55) rose slightly with each signup [V: pinboard 2014 post]. nine turtles could publish "the price goes up a little as the library grows; early readers keep their price forever" with real numbers, no countdown. That is honest scarcity (price tied to a real cost), but it can be read as manufactured urgency; only do it if the numbers are published and the rule is mechanical. Mark **risky**; lock-in-for-life for early users is the safer cousin.
- **Waitlist that asks a question.** Superhuman's onboarding learnings: making the 30-minute onboarding optional dropped attendance from 100% to about 15%, and 65%+ of customers who did the call fully moved over [V: https://review.firstround.com/superhuman-onboarding-playbook.md]. nine turtles shouldn't copy the paywalled waitlist, but can keep one idea: a mandatory, short, opinionated first-run (import feeds, pick 5, done) plus an **optional 15-minute "setup letter" email by the founder** to the first 100 users (personal reply, not a call). Effort per user low, and the founder learns the most from the first 100.
- **Invite essays.** A plain "why I'm reading again" essay by each early user, collected into a public page with permission. [N]

### 2.5 Sponsoring tiny newsletters and RSS feeds

- Pricing signals I could verify: The Daily Good (350,000 subscribers, 35% open rate) sells "Browse" at $3,500 and "Good News" at $1,500 [V: https://www.thegoodtrade.com/newsletter-sponsorship/]. That's beyond a solo budget; the *classifieds-style* Good News slot is the right shape (a text blurb, no tracking).
- James Clear has a public sponsor page for the 3-2-1 newsletter [T: https://jamesclear.com/sponsor] (price not verified; his list is huge, so likely not affordable for this stage).
- Directories of sponsor-friendly newsletters and ad networks: Dupple's 2026 pricing guide [T: https://dupple.com/blog/advertising-in-newsletters], Lilach Bullock's directory [T: https://www.lilachbullock.com/newsletters-that-accept-sponsors-directory-2026/], and Reletter's list of slow-living/small publications such as "slow folk", "slow notes", "calmfeed", "slow down postcards", "the slow edit" [T: https://reletter.com/publications/slow-folk, https://reletter.com/publications/calmfeed, https://reletter.com/publications/the-slow-edit-by-beth-crane]. Treat Reletter as a *prospecting list* of small newsletters in the right vibe; most have a few thousand readers, so a $30-$150 sponsorship is plausible [M, unverified numbers].
- Tactic: buy 6-10 small sponsorships at roughly $50-150 each, with a dedicated tracking-free link (a unique URL path like `/from/slowfolk`, counted by sign-ups only). Expect 0.5-2% of readers to click; it takes ~100 clicks per new paying user at best [M]. Total test budget: about $600-1,000. Mark **unproven**; the value is *learning which micro-communities convert*.
- Better than buying: **Swap, don't pay.** Offer small writers a free year and a "reading list" feature in nine turtles ("follow my feeds" OPML they can publish). That costs nothing but a year of your free plan, and they link naturally.
- RSS-feed sponsorship (a sponsor line in an RSS feed) is a thing for blogs; it conflicts with "no ads"; do not run ads *inside* nine turtles. Sponsor *others'* feeds only.

### 2.6 Podcast guesting at scale

[M] Target 30 small podcasts about reading, digital minimalism, personal knowledge management, indie web, and writers' craft. A founder in India who built a calm reader with AI agents as a non-programmer is a clean story. The ask: 15 minutes, no pitch. Effort: high (10-20 hours of outreach); payoff: low per episode but permanent and each is a new, high-trust audience. Proven general approach (Plausible's Marko Saric credits content, community and podcasts for $1M ARR without ads or investors [T: https://saasology.castos.com/episodes/how-plausible-grew-to-1m-arr-without-ads-or-investors-marko-saric-co-founder-of-plausible, https://tinyempires.substack.com/p/inside-a-tiny-empire-plausible-analytics]).

### 2.7 Changelog-as-marketing

Readwise Reader launched with manifesto-style posts and a frequent public changelog; its first users were thousands of long-term testers from the existing Readwise base [V: slax.com]. nine turtles already has `docs/changes/`; render it as a public "What changed" page with an RSS feed (of course: a reader about feeds should ship a feed of its own changelog) and mention the one thing that is deliberately *not* added each month ("what we said no to"). Effort: very low. Payoff: slow trust compounding. Proven pattern.

## 3. Ideas from other industries, translated

| Source | Real fact | nine turtles translation |
|---|---|---|
| Light Phone | Started by lending flip phones to about a dozen people to "go light" before building; tied to NoSurf subculture; gave phones to a whole school (Buxton, 2022); sold 100,000+ first-gen units after Kickstarter; Light Phone III over 20,000 units; but dumb phones fell from 16% to 11% of global market (2022 to Q1 2026) [V: https://www.fastcompany.com/91549434/is-the-light-phone-getting-too-smart] | Lend a "reading year" to ~12 people first; co-market with the NoSurf crowd (r/nosurf is the real community); offer a free-year pilot to one school or library. Category warning: the dumbphone wave is plateauing, so don't bet on it alone. |
| Pinboard | Price tied to user count; paid-only keeps the site small; later annual fee of $11 (archiving $25/year) [V] | Small annual price, honest page, generous export, lock-in-free by design. |
| Instapaper / Pocket | See above [V] | Being default share target (publisher-side snippet). "Free for a week" promotions (Apple-style) are possible; but only via a *platform feature*, which a PWA doesn't have. Unproven. |
| Field Notes | Cult notebook from a side project (Coudal Partners), limited editions and a club [T: https://news.slashdot.org/story/25/06/17/2128231/field-notes-went-from-side-project-to-cult-notebook] | Not limited editions (no scarcity), but an **annual "edition"**: a yearly dated release with a small essay and one cosmetic theme. Quiet ritual, no hype. [N] |
| Independent bookstores | Staff picks, book clubs, loyalty [M] | A **"Shelf" page: 20 human-picked feeds per theme**, written by the founder ("what I read to wind down"). Not "starter packs" (dropped), but a signed editor's column on the website, not in-app. |
| Libraries | Libby/OverDrive are distributed *through* library cards [T: https://company.overdrive.com/?p=72346, https://warrenpl.org/connect-to-ebooks-more-the-libby-app] | Offer libraries a free staff account and a printed one-page "How to read the open web" handout. Librarians are evangelists of reading and of paid-for access. Unproven; very high trust. |
| Calm/Headspace | Corporate wellness, teachers programs, gift cards [M] | Free for teachers/librarians/students on request (manual, honour-based). Corporate "digital wellbeing" stipend letter: a PDF employees can send to HR to expense nine turtles. Cheap, specific, no discount codes needed. [N] |
| Superhuman | Concierge onboarding; opinionated first run [V] | Founder-written first-100 welcome; mandatory 3-step first run with an undo. Don't copy waitlist exclusivity. |
| Patagonia "Don't buy this jacket" | Anti-marketing that is on-brand [M] | "You might not need this. Try 30 days of just a list of ten blogs in a free tool first." Honest page: "Who should not buy nine turtles". Increases trust, filters churn. |
| Plausible / Fathom | Privacy positioning; open source; transparent revenue; $1M ARR with no ads [T above] | Public stats page (readers, MRR optional, uptime), "no tracking, here's the proof". The repo is already public. |
| Kagi | Pays for search; Small Web as a community good [T above] | A "small web" public OPML and weekly "found this week" page. |
| Notion/Obsidian | Template ecosystems and community plugins [M] | A tiny "reading rituals" template pack (OPML + a one-page how-to) per niche: e.g. "The 12 blogs behind Deep Work". Distributed as a free download on the site. Note starter packs were dropped *in-app*; this is a website editorial artifact. Check with the owner. |

## 4. Indie-hacker playbooks: tactics with numbers

- **Feedbin (Ben Ubois).** Timing + a single integration (Reeder) + paid from day one. ~100 users to break even, $1.62/user/month profit, $170/month starting cost. Lesson: pick the one third-party app whose users are your people and be there on day one [V].
- **Bear Blog (Herman).** Hit Hacker News as a weekend project; a second spike came from custom domains; about 5,500 blogs at the time; kept the product small, refused feature requests, hand-approves new blogs in 15-20 min/week; sponsor-ware conversion was "just enough" [V]. Lesson: curation that takes 20 minutes a week is a moat and a brand.
- **Readwise.** Built on a loyal, paying base; Reader launched with long-term testers and no paid traffic [V: slax.com]; the cofounders write openly about being bootstrapped [T: Notion post "Why We're Bootstrapping Readwise"]; creator-community deals (30 extra free days) [V]. Lesson: small, repeatable community codes.
- **Matter.** Cold start solved with hand-picked recommendations from respected writers [V: slax.com]; it was VC-funded, so copy only the editorial idea.
- **Micro.blog.** Kickstarter-funded (2017) [T]. Lesson: pre-sell to the people who care.
- **Plausible.** $1M ARR bootstrapped, open source, content-led, no ads [T]. Lesson: opinionated, honest writing plus a public repo. The repo and blog are already nine turtles' assets.
- **Marc Lou, Pieter Levels, Tony Dinh, Danny Postma, Justin Jackson (Transistor), Arvid Kahl.** I could not verify specifics today; from memory [M]: Lou's "ship small products, publish revenue publicly, build an audience on X", Levels' "public numbers and many small experiments", Jackson's "podcast-led distribution and own audience". Common rule: a public revenue/numbers page and a personal audience beat any ad channel. Do not copy "build in public" at volume; do it quarterly and calmly (Section 5, #12).
- **The consistent numbers:** break-even of ~100 users (Feedbin), 10-15% subscription lift from one big feature moment (Instapaper) [V], 15-20 minutes/week of curation (Bear) [V]. Nobody I found got 100 paying users from forum posting alone.

## 5. Fifteen+ original ideas for nine turtles (all [N] = untested unless noted)

1. **"The Quiet Edition" printable PDF.** Each Sunday, a reader can export a typeset PDF of their unread (finite list!) to print or send to an e-reader. Proof of "book not feed". The PDF footer carries the publisher's links. Effort medium. Payoff: strongly on-brand screenshot/press hook; works with e-ink devices.
2. **Read-it-on-e-ink partnership.** Offer a Kobo/Kindle/Boox/Supernote-friendly layout and a free-year to e-ink users communities (r/eink, r/kobo, Boox forums). Effort medium; payoff plausible since e-ink owners are people who already chose calm reading.
3. **Light Phone / dumbphone shared "week off" guide.** Co-written one-page: "Your phone is dumb, your reading is smart." No ad spend, no ask beyond a link swap. Warn: market plateau noted above.
4. **A "slow web" award** for blogs: five a year, chosen by the founder, a quiet SVG badge ("read in nine turtles" optional). Winners link back. Small, graceful, and unpaid, so no integrity issues. Effort low; payoff: a dozen good backlinks yearly and goodwill with writers.
5. **Turtle charity tie-in.** Name-driven: donate a fixed, public percentage of a *specific* revenue line (e.g. 1% of annual plans) to a sea-turtle conservation charity, with receipts published. Not a gimmick-with-a-countdown; one line on the pricing page. Effort low; payoff modest but memorable. Must be genuine and audited by receipts.
6. **Screen-time swap pledge.** A landing page: "Delete one feed app for one month; read ten blogs instead." Shareable image card for the phone's Screen Time screenshot (user's own). No streak tracking. Fits Cal Newport audiences.
7. **Librarian and teacher program.** Free accounts, a one-page handout for patrons ("how to read blogs without being fed"), plus a talk for library newsletters. Effort high, trust high; ten libraries is "ten customers worth writing down".
8. **Writers' "read me in nine turtles" button** (2.1A). Include a one-line explainer of RSS ("a way to have the sites you like come to you, in order, once").
9. **Colophon + build story page** as a lead magnet for the "AI-built, human-checked" audience (Hacker News, Lobsters, Simon Willison-style readers). Honest about limits.
10. **Seasonal "reading year" gift**. A printed card (postcard-size PDF) the giver can print or email. Add a hand-lettered line in the founder's voice. Gift certificates for bookish people.
11. **Handwritten postcards to first 100.** A postcard with a thank-you and a real stamp from India. Cost: ~$1.50 each including postage [M, unverified]; 100 cards is ~$150. Pure goodwill; some will photograph and share. Old-school but nobody does it in reader apps.
12. **Quarterly letter, not "build in public" noise.** Four times a year: here's what we shipped, here's churn, here's what we won't build. Published on the site and as a feed. Matches Basecamp-like essays.
13. **The "nine turtles list of nine."** A weekly or monthly page of nine human-picked posts from the open web, with no tracking, as a feed. It's a marketing page that *is* the product experience (finite, nine items). Excellent for newsletter-style discovery; people forward lists of nine. Effort: 1 hour/week.
14. **Open-source small tools** that bring the target in: an "OPML cleaner", "find the feed of any site" (autodiscovery on a pasted URL is already a permitted behaviour), "RSS for people who write" explainer. Tools get backlinks and are the Pinboard/Plausible-style content engine. Respect: only fetch the pasted page (AGENTS.md rule).
15. **Reading-room pop-ups.** A quarterly 90-minute "reading hour" on video or in a coworking space/cafe: bring a tablet, read the finite list, then talk about one piece. Start online; later local (Bengaluru/Delhi/Mumbai). Effort high; payoff in word of mouth and testimonials; India-based founder is an unusual advantage here (regional-language blogs, Hindi/Tamil feed communities).
16. **Language-coverage angle.** The reader works with articles in any language. Publish small curated lists of good blogs in Hindi, Tamil, Marathi, Bengali, Malayalam, Urdu etc. as a differentiator; nobody markets RSS in Indic languages. High effort (needs native readers), real niche ownership. 
17. **"Unsubscribe is a feature" campaign.** A page that proudly shows how to export and leave in two clicks (OPML out). Patagonia-style anti-marketing; builds trust that reduces perceived risk; users who can leave tend to stay [M].
18. **Bundled with a book club.** Partner with 3 small online book clubs: each month the club's reading list lives as a feed/OPML so members read the same essays. Applies the bookstore book-club model without gamification.
19. **Sponsor the *feeds of dead blogs*?** Joke aside, a real variant: fund 5 small writers a year with $100 each to keep writing (a "writers' grant"), published openly. Cheap for a founder, generates the kind of story Kagi's Small Web gets press for.

## 6. Boring cash-cow lessons for unit economics and churn

Lessons grounded in what I verified, plus clearly marked leads:

- **Annual billing is the main churn lever.** Pinboard moved from one-time sign-up fees to $11/year (a decision explained as simplification) [V]. For nine turtles: default to annual, offer monthly at ~1.5x; show the total clearly once; send a single renewal notice with the amount; never hide cancel. Expected effect: monthly consumer subscriptions commonly churn several percent a month while annual renewals retain much better [M, unverified numbers].
- **Break-even is small.** Feedbin showed ~100 paying users covered costs at launch; Bear survives on small sponsorship because costs are near zero [V]. Keep infrastructure on the free tiers and the single Render instance until real traffic demands more; set an explicit "price-raise trigger" (e.g. when the library hits N readers).
- **Raise prices slowly, with grandfathering.** Pinboard's price rose as the user base grew [V]; that is the original "founder price" pattern. Early readers keep their price for as long as they stay subscribed. Raise by small steps once a year.
- **Refuse features.** Bear's founder said no to feature requests to keep the platform simple [V]; simplicity is retention and cheap support.
- **Low support burden as a moat.** One person must handle email; every FAQ page, in-app wording fix and clean export reduces tickets. Write a "last updated" status page.
- **Niche ownership.** Plausible and Pinboard each own a sentence ("privacy-first analytics"; "bookmarks that cost money and stay small"). nine turtles' sentence candidates: "The reader that ends." / "A reader with an ending." Test with 5 people.
- **Word of mouth is a design target.** Make the best moments shareable without being social: a beautiful "finished for today" screen (a plain, quiet done state) that users screenshot because it is calming, not because a streak asks. That is the viral element a calm app can have.
- **Churn reasons to pre-empt:** (a) "I forgot to read": solved by a single optional weekly email digest of *count only* (opt-in, not a notification), (b) "my feeds are boring": a monthly editor's list, (c) "too few new posts": show the cadence of each feed so readers can prune.

## 7. Suggested sequencing (what I'd actually do first)

**Month 1 (cheap, compounding):** pricing-as-manifesto page + "six refusals" + public changelog feed; submit landing page to design galleries and 10-15 relevant directories; 12 personal emails to platform founders and indie-web writers (Bear, Micro.blog, Buttondown, omg.lol, Ghost community, Kagi) offering a free year and the follow-button snippet.

**Month 2-3:** ship the "follow in nine turtles" snippet; start the "nine of the week" page; first 100 users get a handwritten postcard and a founder email; sponsor 4 tiny slow-living newsletters to learn what converts (budget under $500).

**Month 4-6:** librarian/teacher pilot with 5 libraries; gift-year cards before December; "slow web award" year one; podcast outreach (10 shows).

**Hold:** footer/viral loops (breaks publisher respect), paid ads, countdown/limited seats, streaks, any referral scheme that rewards invitations with scarcity.

## 8. Sources

Verified (fetched):
- https://feedbin.com/blog/2014/03/11/feedbins-first-year
- https://blog.pinboard.in/2014/12/new_pricing_policy/
- https://highscalability.com/pinboardin-architecture-pay-to-play-to-keep-a-system-small/
- https://www.slax.com/blog/read-it-later-growth-history/
- https://herman.bearblog.dev/running-a-blogging-platform/
- https://fortelabs.com/blog/interview-with-readwise-founders/
- https://www.thegoodtrade.com/newsletter-sponsorship/
- https://review.firstround.com/superhuman-onboarding-playbook.md
- https://www.fastcompany.com/91549434/is-the-light-phone-getting-too-smart

Seen in search only (not read; titles/URLs as evidence):
- https://blog.kagi.com/small-web ; https://www.techcrunch.com/2026/03/17/kagi-small-web-human-authored-indie-internet-mobile-ios-android-devices/ ; https://alternativeto.net/news/2023/9/kagi-introduces-small-web-initiative-to-spotlight-non-commercial-web-content
- https://herman.bearblog.dev/manifesto/
- https://wptavern.com/micro-blog-surpasses-kickstarter-funding-goal-set-to-launch-new-social-network-for-independent-microblogs ; https://davepeck.org/2017/02/03/indie-microblogging-kickstarter-success
- https://jamesclear.com/sponsor ; https://dupple.com/blog/advertising-in-newsletters ; https://www.lilachbullock.com/newsletters-that-accept-sponsors-directory-2026/ ; Reletter publications: https://reletter.com/publications/slow-folk, /calmfeed, /slow-notes-3, /the-slow-edit-by-beth-crane
- https://www.indiehackers.com/post/the-best-design-directories-to-show-off-your-work-e7b0c99522 ; https://designerup.co/blog/incredible-places-to-find-web-design-trends-and-inspiration-for-2024/
- https://www.indiehackers.com/post/marc-louvions-unconventional-marketing-approach-that-grew-ship-fast-to-43k-monthly-revenue-in-2-months-ff9af24080
- https://saasology.castos.com/episodes/how-plausible-grew-to-1m-arr-without-ads-or-investors-marko-saric-co-founder-of-plausible ; https://tinyempires.substack.com/p/inside-a-tiny-empire-plausible-analytics
- https://news.slashdot.org/story/25/06/17/2128231/field-notes-went-from-side-project-to-cult-notebook
- https://company.overdrive.com/?p=72346

## 9. What to do next (research gaps)

1. Re-fetch: James Clear's sponsor page, Kagi Small Web, Plausible interview, Field Notes story, Micro.blog Kickstarter numbers, once the fetch budget resets.
2. Get actual rate cards from 8 small newsletters (reach out by email; many list prices on request).
3. Check whether Bear/Micro.blog/Buttondown already offer a "follow with RSS reader" hook that nine turtles can plug into (a one-day task).
4. Ask the owner (per AGENTS.md rule 2) before: any charity tie-in percentage, any gift/discount structure, any public OPML or "starter pack"-like website page (starter packs were dropped), and any outreach that speaks in the owner's name.
