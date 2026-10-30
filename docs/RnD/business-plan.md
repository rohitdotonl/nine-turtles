# nine turtles: the business plan

Rohit's plan for turning nine turtles into a sustainable one-person
business (his draft of 30 October 2026), with Claude working on it as a
partner: what's already done, what Rohit still has to do, and Claude's
comments. **Rohit decides.** Every "Claude says" is a suggestion he can
overrule; when he does, write the answer under "Rohit's call" and that
answer wins.

Like everything in `docs/RnD/`, this is a working plan, not a rule:
anything here that changes the app, the website or `docs/DESIGN.md` still
goes through the usual process (`AGENTS.md` → "How a change happens").

**How to read each section:**

- **Status:** ✅ done · 🟡 partly done · ⬜ not started.
- **Already done:** the research or work that exists, with links.
- **Rohit's to-do:** what only Rohit can do.
- **Claude says:** suggestions, push-back and alternatives.
- **Rohit's call:** Rohit's answer. Empty means not decided yet.

> **A note on privacy.** This repository is public. Anyone can read this
> file. Write your income target and hours here only if you're comfortable
> with that; otherwise write "kept private" and keep the number to yourself.

---

## 0. Timeline

Every research section has a deadline. When the deadline comes, write the
conclusion with what you have and move on. Every section ends with a
**one-sentence conclusion**: if you can't write it, the section isn't
finished.

| # | Phase | Status | Claude's suggested deadline | Done |
|---|---|---|---|---|
| 1 | Competitor & community research → positioning shortlist | 🟡 mostly done | 5 Nov 2026 | ☐ |
| 2 | Income math + metrics & thresholds | 🟡 Claude's numbers below | 5 Nov 2026 | ☐ |
| 3 | Pick the positioning that fits the math; test it against real readers' words | ⬜ | 9 Nov 2026 | ☐ |
| 4 | Ideal reader + positioning + channel | 🟡 ideal reader agreed | 9 Nov 2026 | ☐ |
| 5 | Features & anti-features → what launch needs | 🟡 the app is built | 12 Nov 2026 | ☐ |
| 6 | Business model & pricing | 🟡 suggestion ready | 12 Nov 2026 | ☐ |
| 7 | Website + Dodo Payments application | 🟡 site built, price and pages to finish | 19 Nov 2026 | ☐ |
| 8 | What's left to build before launch | 🟡 | after Dodo approves | ☐ |
| 9 | Launch | ⬜ | early December 2026 | ☐ |
| 10 | First threshold review | ⬜ | 6 weeks after launch | ☐ |

**Claude says:** most of the research is already done (section 1), so
phases 1 to 6 are mainly *reading what we have and writing the
conclusion*, not new research. Two weeks is enough. The sooner the price
is set, the sooner you can apply to Dodo, and Dodo is the one thing that
stands between you and your first payment. December suits a launch:
people make new-year resolutions about phones and reading, and the
research suggests a "gift a year" idea for December (decision needed).

**Claude says (timely):** Reddit's feeds stop on **13 November 2026**.
The research ranks a "Reddit is ending RSS: what to do" page third on its
shortlist, and that chance is gone once the date passes. If you want it, it
has to be written in the next two weeks. Your call: do it, or let it go.

**Rohit's call:**

---

## Ongoing habits (daily)

Rohit's plan:

- **1 hour: use the product.** Dogfooding polishes the core loop and
  surfaces friction. It does **not** define what launch needs (positioning
  does), and it won't reveal new-reader problems, since Rohit is already a
  power user.
- **30 minutes: agentic workflow.**
  - **About 10 minutes exploring** new tools, models and workflows; note
    anything promising in a "to try" list rather than adopting it on the
    spot.
  - **About 20 minutes on the current bottleneck:** take one item and use
    it on whatever is slowing things down right now (research, building,
    or after launch, search pages, free tools and reading the numbers).
  - **Adoption rule:** a new tool becomes part of the setup only when it
    solves a real bottleneck. Novelty isn't enough.
  - Revisit the split now and then.

**Claude says:**

- **Start the 75% marketing time now, not after launch.** You're a
  professional writer, and the research says writing (the flagship essay,
  comparison pages, a blog that sounds like a person) is your strongest
  lever. Writing takes weeks, so it shouldn't wait for launch.
- **Cap the hour of use if it eats the writing time.** nine turtles is
  designed to be finished quickly. If your hour turns into tweaking the
  app, that's building, not using. An alternative: 30 minutes of reading
  in it, and a note of anything that annoys you for the daily list.
- **To see it as a newcomer would,** once a month make a brand-new
  account with nothing in it and go through the first five minutes.
  That's the part dogfooding can't show you.

**Rohit's call:**

---

## 1. Competitor & community research → positioning shortlist

**Status:** 🟡 mostly done (25–26 October 2026).

**Already done:**

- [`business-research.md`](business-research.md): the summary, rivals,
  prices, the ranked shortlist.
- [`playbook.html`](playbook.html): the full report;
  [`idea-bank.html`](idea-bank.html): about 300 ideas.
- [`research-2026-10/`](research-2026-10/): 19 working notes with
  sources. The most useful here: 03 (pain points), 04 (rivals and
  positioning), 14 (Hacker News pain points), 19 (founder playbooks).
- [`reader-comparison.html`](reader-comparison.html): Feedbin, Miniflux,
  NetNewsWire and FreshRSS compared with nine turtles.
- [`strategy-notes.md`](strategy-notes.md): Rohit's own conclusions,
  including the firm noes (no donations, no AI summaries, no lifetime
  deals).

What the research already found:

- **Pain points:** unread guilt tops the list; then loud feeds drowning
  quiet blogs, newsletters cluttering the inbox, finding good blogs,
  getting articles onto an e-reader, and AI everywhere.
- **Why people switch:** a service closing or changing (Google Reader,
  Pocket, Omnivore, Feedly's slowdown, Reddit's feeds ending), a price
  rise (Inoreader nearly doubled in 2024), or AI being pushed on them.
- **What they pay:** forum readers put the ceiling for a reader at
  $30–50 a year; casual readers around $5–6 a month. Feedbin is $70 a
  year; Current is $9.99 once.
- **The gap:** nobody combines web-first, finite, book-like reading,
  newsletters and a fair lasting price.

**Rohit's to-do:**

- [ ] Read Reddit yourself (it blocked our researchers): r/rss,
      r/digitalminimalism, r/nosurf, r/kobo. Copy real readers' sentences
      into a "their words" list.
- [ ] Write the shortlist: two or three positionings, each as *who +
      problem + why nine turtles*.

**Claude says:**

- **Here's a shortlist to start from** (edit freely):
  1. *People tired of social media who want to read again.* Problem: the
     endless feed. Why us: a reader that ends. (The research's first
     choice.)
  2. *Newsletter readers drowning in their inbox.* Problem: unread
     newsletters pile up as guilt. Why us: newsletters as a calm list you
     finish. (A sharper, easier problem to name; also a way in for 1.)
  3. *RSS users leaving Feedly, Inoreader or Reddit.* Problem: their
     reader got loud, expensive or full of AI. Why us: calm, no AI, fair
     price. (Easiest to reach right now, but they compare features, and
     most of them are not the ideal reader.)
- **Weigh whose comments you read.** r/rss is full of power users, who are
  loud online but not your ideal reader. Your ideal reader is more likely
  to be on r/digitalminimalism and r/nosurf, in newsletter comments, and in
  Cal Newport's world. Count their words for more.

**Conclusion:** _______________________________________________

---

## 2. Income math + metrics

**Status:** 🟡 Claude has filled in the costs and fees; the target and
hours are Rohit's.

### Income math

| Line | Value | Where it comes from |
|---|---|---|
| Target monthly income (after costs) | **Rohit:** ______ | |
| Hours a week Rohit can give | **Rohit:** ______ | |
| Running costs a month | about **$9** | Render Starter $7 + 1 GB disk about $0.25; domain about $1 a month; Brevo email free up to 300 a day; Cloudflare R2 backups free under 10 GB; GitHub free. Add your Claude plan if you count it as a business cost. |
| Net per paying reader, yearly at $48 | about **$3.70 a month** | Dodo takes 4% + $0.40, plus 1.5% for buyers abroad and 0.5% for subscriptions: about $3.30 of $48. Before income tax. |
| Net per paying reader, monthly at $5 | about **$4.30 a month** | The same fees: about $0.70 of $5. Yearly earns a little less per month but keeps readers longer. |
| **Paying readers needed** | (target + $9) ÷ $4 | See the examples below. |
| Trial → paid conversion | assume **15%** | Trials without a card convert less than trials with one; India converts about half as well as North America (research, round 2). A guess until real numbers arrive. |
| **Sign-ups needed** | paying readers ÷ 0.15 | |
| Monthly churn (paying readers who cancel) | assume **4%** | Plausible Analytics runs at about 2%; consumer apps run higher. A guess. |
| **Paying readers to replace each month** | paying readers × 0.04 | |
| Cost of a free (trial or ended) reader | close to **$0** | They cost only disk space. After the trial their feeds are checked once a day, and the yearly clean-up keeps the database small. |

**Examples** (at about ₹88 to the dollar, $4 net per reader a month):

| Target a month | Paying readers | Sign-ups needed | To replace each month |
|---|---|---|---|
| ₹25,000 (about $285) | about 75 | about 500 | 3 |
| ₹50,000 (about $570) | about 145 | about 970 | 6 |
| ₹1,00,000 (about $1,140) | about 290 | about 1,930 | 12 |

**Claude says:**

- **The setup is fine for now.** One program and one database on Render,
  planned for 100–200 readers, is right for the next year. It costs $9 a
  month, and you won't outgrow it soon. Only write down *when* to look
  again: when the database passes about 600 MB (60% of the disk; the owner
  report shows it), or at about 150 paying readers. Outgrowing it means a
  bigger disk or a bigger Render plan, not a rewrite.
- **Sign-ups are the hard number,** not paying readers. 970 sign-ups for
  ₹50,000 a month is a lot of people for search alone in year one, as the
  research says. That's why the essay, the launch and partners matter early.
- **Get an accountant's answer before launch:** GST on exports, the LUT
  (the form that lets you export services without charging GST), and income
  tax on what Dodo pays you. It changes the "net per reader" line.

### Metrics to track

Rohit's plan follows a reader from finding nine turtles to staying, plus
one outcome number, so a miss shows where things break:

1. **Net MRR (outcome):** monthly recurring revenue after fees, taxes and
   refunds. Watch the monthly trend, not daily swings.
2. **New sign-ups a month, by channel (finding us).**
3. **Activation (getting started):** % of new readers who reach first
   value within 24 hours. Draft: followed 5 or more feeds **and** read 10
   or more articles.
4. **Trial → paid (is it worth paying for?).**
5. **Monthly paid churn (staying).**

Plus one early warning, not a target: **is the core loop healthy?**
(see below).

**Claude says:**

- **Where the numbers come from: the app's own database.** The app
  already knows, for every reader, when they joined, which feeds they
  follow, which articles are read, when they last came, and their plan
  (trial, paid, cancelled, ended). So most metrics are counting what's
  already there, done by the app itself: no outside analytics service, no
  tracking code, nothing that says *who*. The owner report (decision 0130,
  `docs/operations/owner-report.md`) already gives readers in total,
  joined in the last 30 days, came in the last 30 days, and how many are
  on a trial, paid, cancelled or ended.
  - **Already counted:** sign-ups, trial → paid, churn (from plan changes),
    MRR (paid readers × price; the app never stores what anyone paid).
  - **Needs a small addition** (a change to build later, with your yes):
    activation (feeds and articles read in the first day), and anything
    "this week", because the app records *that* an article is read, not
    *when*.
  - **Needs a new feature** (a SPEC change): sign-ups **by channel**. The
    simplest version is one optional question at sign-up, "How did you hear
    about nine turtles?" (a blog, a friend, a search, an AI assistant,
    Reddit, other). The research says to include "an AI assistant", since
    that traffic arrives without a label.
- **Don't add Plausible or Umami.** The website's privacy page promises
  "No cookies, no analytics, no tracking. This website doesn't count
  visitors". That promise is also marketing. So measure **trial → paid**,
  not visitors → paid. If you ever want visitor numbers, it means changing
  that promise first. My advice: don't.
- **The core-loop measure, once positioning is chosen** (agreed: decide
  after section 3). nine turtles is meant to be finished, so a happy reader
  may only come once or twice a week. "Opens it 3 days a week" would
  reward the wrong thing. Options:
  - **A. Read something this week:** % of paying readers who read at least
    one article in the last 7 days. Simple and fair to light readers.
  - **B. Finished this week:** % who reached "You're all caught up" at
    least once in the last 7 days. It measures the promise itself
    ("finished"), so it's the natural pick if you own that word.
  - **C. Weeks in a row:** how many of the last 4 weeks a reader read
    something. Better at warning early, but harder to explain.

  Claude's suggestion: **B** if the positioning is "a reader that ends",
  otherwise **A**. Either is counted as a number for everyone together,
  never per person.

### Thresholds (set before launch)

| Metric | Target | By date | If missed → |
|---|---|---|---|
| Paying readers | | | |
| Activation | | | Fix the first five minutes before more marketing |
| Trial → paid | | | Revisit positioning or price |
| Paid churn | | | Look at the core loop and the reasons people give when they leave |
| Net MRR | | | |

**Claude says:** a first set to argue with, for 6 weeks after launch:
40 paying readers, activation 50%, trial → paid 15%, churn under 5%.

**Rohit's call:**

**Conclusion:** _______________________________________________

---

## 3. Pick the positioning that fits the math, then test it

- Which positioning from section 1 can support the numbers in section 2
  (how many people, will they pay, can we reach them)?
- Are we building for people who don't need another app, or won't pay?
- The value must fit in one clear sentence.

**Rohit's call (30 October 2026):** talking to 5–10 people isn't possible.
Rohit will test the positioning against research and what people write on
the web instead.

**Claude says:** fair. Then let's make the web research as close to
talking as it can get:

- **Look for what people did, not what they wished.** "I cancelled Feedly
  because…", "I built my own reader that only shows…", "I unsubscribed from
  40 newsletters" are worth more than "I'd love an app that…".
- **Treat the first trial readers as your interviews.** Your plan already
  has a personal email to each new reader (section 9). Ask the same three
  questions every time (why did you sign up, what did you use before, what
  annoys you) and keep the answers in one file. After 20 replies you'll
  have the interviews you couldn't do before launch.
- **Test the home-page line in public, cheaply.** Post the same idea with
  two framings on your own social accounts or blog ("a reader that ends"
  against "your newsletters, out of your inbox") and see which one people
  repeat back to you.

**Conclusion:** _______________________________________________

---

## 4. Ideal reader + positioning + channel (decided together)

**Status:** 🟡 the ideal reader was agreed on 25 October.

**Already done:** [`ideal-reader.md`](ideal-reader.md): people who drifted
away from reading because of social media and want to come back; who read
Cal Newport and James Clear; who already pay for Readwise, Notion or a
Kindle. Reach them through r/digitalminimalism, focus podcasts and
newsletters in that world. The positioning ideas are in
[`strategy-notes.md`](strategy-notes.md) → "Positioning" (own the word
*finished*; the enemy is the endless feed, never a company).

**Rohit's to-do:**

- [ ] **Who** exactly: ______
- [ ] **Why** they'd pick nine turtles: ______
- [ ] **Where** you can reliably reach them: ______

**Claude says:**

- **Pick one channel you can work every week,** not five. For this reader,
  my order: (1) your own writing, an essay series on rohit.onl and the blog;
  (2) small newsletters in the Newport/Clear world (the $500 test, or a
  free year swapped for a mention); (3) being named on "best RSS reader"
  lists and by AI assistants. Search pays off in year two.
- **Watch the "loves the idea of reading" risk.** The ideal-reader note
  says it: people who love the idea of reading don't always read. That
  makes activation the number to watch hardest.

**Conclusion:** _______________________________________________

---

## 5. Features & anti-features → what launch needs

**Status:** 🟡 the app is built. Rohit's draft listed "V1" features; most
are already live.

**Already built:** OPML import and export (SPEC 16), adding a feed by
pasting any web address (SPEC 3), a first visit that welcomes you and explains feeds (SPEC 2),
the feed finder (SPEC 30), payments in Dodo's test mode (SPEC 29),
newsletters as feeds (SPEC 28), syncing with Reeder and NetNewsWire
(SPEC 26), offline reading, collections, podcasts, AI assistants (MCP), and
exporting or deleting all your data.

**Starter packs:** the five pages exist on the website (SPEC 31, decision
0100) but are still empty, waiting for Rohit to pick the blogs. They were
put on hold, not dropped.

**Rohit's to-do:**

- [ ] Fill in at least two starter packs before launch.

**Claude says:**

- **Starter packs are the answer to "an empty reader is a dead reader".**
  Your ideal reader arrives with no list of blogs. Fill two first:
  *Newsletters, out of your inbox* (it matches the way in) and *Think more
  deeply*, with 8–10 blogs each. Each blog needs one line in your words on
  why it's worth reading: that's your taste, and nobody can copy it. You
  could also ask the agent for 30 candidates per pack, and you choose.
- **Paid value, said plainly:** one calm list you finish; newsletters out
  of the inbox; book-like reading; works on any device and with Reeder and
  NetNewsWire; your data always leaves with you.
- **Anti-features (also marketing):** no algorithm, no tracking, no
  engagement tricks, no AI rewriting or ranking what writers wrote, no
  ads, full export, no lock-in. Add: *no unread counts as debt* and *no
  notifications, ever*.
- **One addition before launch, if anything:** the "How did you hear
  about us?" question (section 2). Everything else waits for real readers.

**Conclusion:** _______________________________________________

---

## 6. Business model & pricing

**Status:** 🟡 the payments are built; the price and trial are open
questions (`docs/planning/questions.md`).

**Already done:** the research suggestion in
[`business-research.md`](business-research.md) → "Suggested price" and
[`strategy-notes.md`](strategy-notes.md) → "Pricing". Built today: one
plan, monthly or yearly; a **14-day** trial with no card; after the trial
you can still read everything you have, but you can't add feeds.
Platform: the web app installs on phones, so one Dodo payment flow serves
every device.

**Rohit's to-do:**

- [ ] Price, monthly and yearly: ______
- [ ] Trial length: ______
- [ ] Price by country (Dodo's regional pricing), yes or no: ______
- [ ] A founding price for the first readers, yes or no: ______

**Claude says:**

- **$48 a year (shown first) or $5 a month.** It's under Feedbin ($70),
  inside the $30–50 ceiling forum readers named, and well above "cheap
  tool".
- **A 30-day trial, not 14.** A calm reader takes a few weeks to feel like
  a habit, and longer trials convert better in the research (17–32 days:
  42.5% against 37.4% for 5–9 days). It's one setting.
- **A founding price:** $36 a year, kept as long as the reader stays
  subscribed, for the first 100. It rewards early trust without a lifetime
  deal (a firm no).
- **India:** about ₹1,500–2,000 a year through Dodo's regional pricing.
- **Pushback on "Pinboard-style, no free tier":** that's already nearly
  what we have, but a little kinder: after the trial, readers keep what
  they've got. Keep it. It's the "nothing is taken away" trust argument,
  and it costs almost nothing.

**Conclusion:** _______________________________________________

---

## 7. Website + payments

**Status:** 🟡 the website is live at nineturtles.app; Dodo's application
needs the final price, terms, privacy, refund policy and contact
(`docs/operations/dodo-application.md`).

**Rohit's to-do:**

- [ ] Set the price (section 6), then finish the legal pages.
- [ ] Apply to Dodo.

**Claude says:** don't wait for the home-page copy to be perfect before
applying; Dodo checks that the pages exist and are honest, not how good
the copy is. Apply as soon as the price and legal pages are in, and keep
polishing the home page while Dodo reviews.

---

## 8. Launch → marketing (25% product / 75% marketing)

Rohit's plan leans on channels that compound and that run without him:

- **Search:** pages for the chosen positioning's searches.
- **Free tools that bring people in:** feed finder (built), YouTube
  subscriptions to a feed file, export tidy-up and blogroll maker, "see
  your blog as a book", public starter packs.
- **Moments worth sharing,** for word of mouth.
- Track sign-ups by channel; cut what doesn't work.

**Already done:** [`playbook.html`](playbook.html) (launch, lists, AI
mentions), [`outreach.html`](outreach.html) (newsletters, podcasts,
bloggers, directories to approach), [`post-ideas.html`](post-ideas.html)
(57 blog posts).

**Claude says:**

- **For the first 100 readers, launches and people beat search.** The
  research: Feedbin's first 100 came in 3 weeks through timing and a
  partner (Reeder). Search and AI mentions carry the later years. So:
  flagship essay + Show HN with a demo + 10–15 good listings + a few small
  newsletters, then search pages every week after.
- **The first reader-facing addition I'd push for after launch:** the
  honest comparison pages ("nine turtles or Feedbin?"), because they help
  both Google and AI assistants, and saying when the other app is better
  builds trust.

**Rohit's call:**

---

## 9. Talking to readers

### New readers

A personal email, not automated and not pushy: why did they sign up, what
are they using it for, is there anything they dislike.

**Claude says:** this is now also your stand-in for interviews (section
3). Same three questions every time; answers in one file.

### Readers who leave: exit options

Principle: readers who leave deserve extra respect. Leaving is easy, and
feedback is always optional. From lightest to heaviest:

1. **One optional question when cancelling** (multiple choice: too
   expensive · not using it enough · missing a feature · switched app ·
   technical problems · taking a break · other). Skippable.
2. **An optional free-text box:** "Anything we could have done better?"
3. **Pause instead of cancel,** for 1–3 months. No guilt-trip wording, no
   multi-screen flows, no automatic discounts.
4. **One personal email a few days after cancelling,** plain text, from
   Rohit: thanks, one question, no reply needed. Sent once.
5. **A check-in before they leave:** when a paying reader stops reading
   for 2+ weeks, one personal note.

Rohit's draft rollout: launch with 1 + 3, plus the OPML export right on the
cancel screen; add 4 once readers arrive; add 5 once the data allows.

**Claude says:**

- **Cancelling happens on Dodo's page, not ours** (SPEC 29: Billing and
  cancelling opens Dodo). So options 1 and 3 can't sit "on the cancel
  screen" unless we build our own step before it. Two lighter choices: put
  **Export your feeds** right next to **Billing and cancelling** in
  Settings, and ask the question in option 4's email instead. Whether Dodo
  can pause a plan is still to check.
- **Drop option 5, or keep it strictly by hand and rare.** DESIGN.md's
  second principle says nine turtles "never tries to bring you back or
  keep you longer". A message triggered by someone *not* reading is
  exactly what that rules out, even if it's kind. Reading less can mean
  the app is working. If you want a version of it: one personal email to
  each paying reader around day 60 ("how is it going?"), the same for
  everyone, whatever they've read.

**Rohit's call:**

---

## 10. Review loop

- Compare the metrics with the thresholds (section 2) on the dates set.
- Do what the "If missed →" column says; don't extend research forever.

**Claude says:** put the first review in your calendar now, 6 weeks after
launch, and one every month after that. Keep a short line per review in
this file, with the numbers and what you decided.

---

## Rohit's other to-dos from the research

Things only Rohit can do, from
[`business-research.md`](business-research.md) → "Research only Rohit can
do". Tick them here.

- [ ] Ask ChatGPT, Perplexity, Gemini and Claude the key questions from
      your own accounts, monthly (strategy notes, section 6).
- [ ] Check in Dodo's dashboard or with support: discount codes, regional
      prices, gifts, affiliates, pausing a plan, fees.
- [ ] An accountant: GST on exports, the LUT, income tax via a merchant of
      record.
- [ ] A trademark search for "nine turtles" (India, US, EU).
- [ ] Set up Google Search Console and Bing Webmaster Tools.
- [ ] Ask Reeder, NetNewsWire, Current and Unread makers about being a
      sync option.
- [ ] Ask three small newsletters for their rates.
- [ ] Decide which personal details you're comfortable sharing publicly.
- [ ] List the people you already know who might read or share it.
