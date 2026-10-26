# Making nine turtles a business: the owner's strategy notes (26 October 2026)

Rohit's own notes after reading the October research (`business-research.md`,
`playbook.html`), rewritten and put in order. They are a working plan, not
decisions: anything here that changes the app, the website or
`docs/DESIGN.md` still goes through the usual process.

## 0. Firm noes

- **No donations.** nine turtles is a paid service, not a charity.
- **No AI summaries,** or any AI that rewrites or ranks what writers wrote.
- **No lifetime deals.**
- **Don't say publicly whether AI agents helped build nine turtles.** (This
  replaces the playbook's idea of a flagship essay about building it with
  agents.)

## 1. The grand brainstorm: what "viable" means

Hold one long session to answer, in writing:

- **What do I expect?** A number of paying readers, a monthly income, a
  timeline, and how many hours a week I'll give it.
- **How do I make that close to certain,** if not in the short term then in
  the long term? Which bets compound (search, AI mentions, friendships,
  free tools, a body of writing) and which are one-off spikes (launches)?
- **What I keep in mind:** search alone won't make nine turtles sustainable
  in year one. The essay, the launches, the lists and the partners carry the
  early weight; search and AI mentions carry the later years.
- **What one person can do now:** I'm a one-person company, but AI gives me
  what a single founder never had: a market researcher, a marketer, an R&D
  team, a tech team, a copywriter, even an A/B-testing team. Plan as if
  those roles exist.

## 2. Positioning

Shaped by the brainstorm, and by Derek Sivers and Rory Sutherland.

- **Lead with "a reader that ends",** name the audience as people tired of
  social media, and use "get newsletters out of your inbox" as the first
  step in.
- **Own one word: finished.** "Calm" belongs to the Calm app, "quiet" to a
  dozen wellness products, "slow" sounds late. "Finished" is free, true of
  nine turtles, and the opposite of what the reader is tired of.
- **Name the problem before the product,** as HEY named "email is broken"
  and Kagi named "you are not the product". Candidates: *unread debt*,
  *feed fatigue*. Terry Godier (Current) calls unread counts "a measure of
  social debt"; credit him if we echo him.
- **Make the enemy a behaviour, never a company.** HEY's enemy was the way
  Gmail works; Glass's was likes and algorithms. Ours is the feed that never
  ends.
- **"No AI between you and the writer."** A clear line, and a page:
  nine turtles never summarises, rewrites or ranks what writers wrote.
- **Tentative home-page copy:** "A reader that ends. The writers you chose,
  in one quiet place. When you've read what's there, you're done."
- **Add to the website:** "Behind the scenes it uses RSS, the open standard
  writers have used for 25 years, so nobody can take your subscriptions
  away."
- **Anti-marketing that's on brand,** like Patagonia's "Don't buy this
  jacket": a "Who shouldn't buy nine turtles" page. It builds trust and
  cuts refunds.
- **Use real people's words.** Before writing final copy, collect real lines
  from real readers (Reddit, forums, interviews) and use their wording.
- **Not sure yet:** whether "finished" beats "calm" or "quiet" with real
  people. It's reasoning, not evidence, until I've talked to readers.

## 3. Pricing

Shaped by the sections above and by best practice.

- **Suggestion:** $48 a year, shown first, or $5 a month. Under Feedbin,
  Feedly and Inoreader, but well above "cheap tool". Forum users named $30
  to $50 a year as their ceiling for a reader.
- **Trial:** 30 days free, no card. The data says it converts well.
- **Fair prices by country** (purchasing power parity).
- **To research:** Pinboard is paid only, with no free tier. How does that
  psychology work, and does it fit nine turtles?

## 4. The one-person, independent, underdog business

Right now the website looks too polished, too much like every SaaS.

- **First, break the SaaS pattern on the website.** I don't need the usual
  template. Basecamp ignores the zeitgeist with long, written home pages.
- **Then show, in many places, that this is one person.** An independent
  business, an underdog. The goal isn't only that people trust it: they
  root for it and want to be part of it.
- **What a single person can do that big players can't:**
  - dominate a small niche they can't be bothered with;
  - have a distinct taste;
  - write a blog that sounds like a person;
  - say no to features because I'm small. Bear Blog's founder refuses most
    feature requests, and the product stays simple and cheap to support.
    Simplicity is retention.
- **Make free public goods,** like Kagi's Small Web.

## 5. Customer research

- **Reddit may be the most useful research I can do:** it tells me which
  features to add and which tools to make. Reddit blocks our researchers,
  so I'll read it myself.
- **Build a research helper** that goes through Reddit and X for me, if
  that's possible.
- **Hacker News is open to AI agents.** Send an agent to dig further into
  readers' pain points there.
- **Forums:** there are many communities, direct or tangential, about RSS,
  feeds and the slow web. One I know is the BazQux community. List the
  rest.
- **A/B testing:** setting privacy aside, I could test copy and even
  positioning. Ask how useful A/B testing really is at this scale, and
  whether any version fits nine turtles' privacy promises.

### What hurts readers (from the research)

1. **Unread guilt and overwhelm.** The biggest, and the best fit. Answers:
   no counts as debt; "a reading list, not a to-do list"; pause a feed
   without unsubscribing; an undoable "catch up". Essay: "Your reader is not
   an inbox."
2. Loud feeds drown quiet blogs.
3. Newsletters clutter the inbox.
4. Finding good blogs.
5. Getting articles onto a Kindle or Kobo.
6. AI everywhere.

## 6. Get named by AI assistants

This needs a whole effort of its own, and it may be the most important lever
for revenue.

- **Learn how assistants choose what to mention,** and how to raise the
  chances of being mentioned.
- **A research bot every three days** that looks for new ways to get
  mentioned by AI and for new search practices in the age of AI.
- **A plain facts page and honest comparison pages.** One page of quotable
  facts (what it is, who makes it, the price, what it does and doesn't do),
  plus short, dated "nine turtles or Feedbin / Feedly / Inoreader / Reeder /
  NetNewsWire / Readwise / Current?" pages that say when the other app is
  the better choice. AI engines lift sentences from clear, structured,
  recently updated pages; comparison and "alternative" pages are also among
  the few kinds still winning clicks in Google; and honesty about a rival
  being better is rare and builds trust. A good example:
  [Feeder's best RSS readers page](https://feeder.co/knowledge-base/rss-basics/best-rss-readers/).
- **Let the AI search robots in.** Allow OpenAI's, Perplexity's and
  Anthropic's robots in the website's robots file; add standard structured
  data labels (what kind of thing each page is: the app, the company, the
  FAQ); verify the site with Google and Bing. One founder found Cloudflare
  silently blocking the robots he wanted.
- **Check AI visibility once a month, by hand.** About 20 questions ("calm
  RSS reader", "Feedly alternative without AI", "read newsletters outside my
  inbox", "follow blogs without social media", "Pocket alternative") asked
  in ChatGPT, Claude, Perplexity, Gemini and Google's AI Mode. Note whether
  nine turtles is named and which pages are cited; those pages become next
  month's outreach list.
- **Add "an AI assistant"** to the "how did you hear about us?" question,
  since much AI traffic arrives without a label.
- **A nine turtles connector for ChatGPT and Claude:** a small "MCP server"
  so someone can say "add this blog to nine turtles" or "what's unread?"
  inside ChatGPT or Claude. ChatGPT's app directory accepts outside apps; it
  needs a public server, sign-in, privacy and terms pages and a short video.

## 7. Search (SEO)

- **Make a complete SEO strategy.** The research says AI answers have taken
  over much of old search, and that what still wins is tools, comparison
  and "alternative" pages, searches for our own name, and pages with a real
  point of view. I'm not sure about this yet.
- **The usual method still matters:** get mentioned and linked by people,
  blogs and lists.
- **Technical basics:**
  - a sitemap;
  - a feed for the website's own blog;
  - a "don't index" tag on app.nineturtles.app and slowfeed.onrender.com, so
    they don't compete with the website;
  - Google Search Console and Bing Webmaster Tools.

## 8. Timely: "Reddit is ending RSS: what to do"

Publish before **13 November 2026**, when Reddit's feeds stop.

## 9. Launches and listings

- **Flagship essay on rohit.onl.**
- **Show HN, Product Hunt and similar places.** Learn from the best
  launches first.
- **Free listings that last:** AlternativeTo, SaaSHub, Slant, Peerlist, the
  Indie Hackers product page, the GitHub lists. About 15 relevant ones, not
  a 100-directory spam sweep.
- **Optional:** a Microsoft Store listing through PWABuilder is cheap. Skip
  the Apple App Store for now: its search is dominated by Reeder,
  NetNewsWire and Feedly, and this audience finds tools through people.
  Being a sync option inside those apps is the better route (section 12).

## 10. Free tools

1. Feed finder.
2. YouTube subscriptions to a feed file.
3. Export tidy-up and blogroll maker.
4. "See your blog as a book".
5. More to come.

## 11. Newsletters

Newsletters are a big thing; get as much from them as possible.

- **As a feature:** read newsletters outside the inbox, the first step in.
- **As a channel, a $500 test:** sponsor 4 to 8 tiny slow-living
  newsletters, each with its own link. Dense Discovery (about 38,000
  design-minded readers, classified ads from $89, next slots January 2027)
  is one candidate; Reletter lists many smaller ones.
- **Even better:** swap a free year for a mention.

## 12. nine turtles as a sync service

Feedbin grew by being the sync service inside other apps. Be one too.

## 13. Be known in the small, independent web

- **Make friends with the founders** of Bear Blog (Herman), Micro.blog
  (Manton Reece), Buttondown, omg.lol, Ghost and Kagi Small Web, and look
  for a mutual deal.
- **"How I read the web" interviews** with writers our readers admire. A
  blog or newsletter series, like the "How I blog" kind of series.

## 14. Projects to look at

- [powRSS](https://powrss.com/)
- [LettRSS](https://lettrss.com/)

## 15. Kept for later: beating the incumbents

Copied in full from the playbook (Area 5).

You won't beat Feedly at being Feedly. Small products beat giants by refusing
the giant's game: HEY ($99 a year, "email is broken"), Kagi ("you are the
customer"), Glass ($50 a year, no likes, "a home for photographers"),
Pinboard (tiny, plain, loved, price as a filter). The pattern: a named enemy
that's a behaviour, a price that's a statement, and features you proudly
don't have.

| Rival | Where it's going | The opening for nine turtles |
|---|---|---|
| **Current** (Terry Godier) | "An RSS reader that doesn't count." Articles fade after 3 hours to about a week. $9.99 once, Apple only, web "planned". Syncs with iCloud, Feedbin, Miniflux and, since July, Feedly. | The closest rival and proof that calm reading gets press (TechCrunch covered it). Differ on: any device, a list you finish rather than one that quietly loses things, a full service with newsletters, open code. |
| **Feedly** | Toward threat and market intelligence for companies (from about $1,600 a month); ads in the free tier. | "nine turtles is for one person." |
| **Inoreader** | Power users, teams, AI; a near-doubled price in 2024. | One plan, one price, a price lock. |
| **Readwise Reader** | Everything: highlights, PDFs, video, AI. Grew sharply after Pocket closed. | The reader already pays for it but may feel it's an inbox of obligations. "One list, one finish line." |
| **Feedbin** | Solo, honest, paid, open source; powers several apps. | The most respected peer. Compete on feeling and design, not on features. Admire it in public. |
| **NetNewsWire, Reeder** | Excellent, Apple only. | Not enemies: nine turtles already syncs with them. Be their calm home base. |
| **Artemis** | Free, invite-only hobby project; refreshes once a day. | Shows the same instinct; too small to worry about. |
| **Micro.blog's reader** (Manton Reece) | Manton wrote in February 2026 that he's building a feed reader whose items "fade", like Current. | Calm reading is becoming a small movement. Be its friendliest member: write to Manton, and keep "finished, not faded" as the difference. |

Sources: [TechCrunch](https://www.techcrunch.com/2026/02/19/current-is-a-new-rss-reader-thats-more-like-a-river-than-an-inbox/),
[Current](https://terrygodier.com/current),
[Moonwriting on Artemis and Current](https://moonwriting.bearblog.dev/artemis-and-current-bringing-calmness-into-rss/),
[PricingSaaS](https://pricingsaas.com/companies/inoreader),
[PetaPixel on Glass](https://petapixel.com/2021/08/12/glass-is-a-subscription-based-photo-sharing-app-for-photographers),
[Kagi on pricing](https://kagifeedback.org/d/687-implement-regional-pricing/29),
[Pinboard](https://blog.pinboard.in/2014/12/new_pricing_policy/).

**What nobody has combined:** web-first, finite, book-like type, accessible,
open source, syncs with Reeder and NetNewsWire, newsletters, priced as a
lasting service. Current has the philosophy but not the platform. Feedbin
has the trust but not the soul. Readwise has the audience but not the calm.
