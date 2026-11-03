# Rohit's research notes (1 November 2026, cut 3 November)

Rohit's own notes from reading r/rss, rival apps and the small web. On 3
November 2026 he answered their open questions (decision 0160) and
everything settled or dropped was cut; what's left is still open or still
useful. The full first version is in the repository's history. Quotes
from Reddit are word for word. Like everything in `docs/RnD/`, nothing here
is decided.

**Contents**

1. [Research errands](#1-research-errands)
2. [Rivals and tools to study](#2-rivals-and-tools-to-study)
3. [Website inspiration](#3-website-inspiration)
4. [Readers' own words](#4-readers-own-words)

---

## 1. Research errands

Given to a research agent on 3 November 2026; its findings come back here. Each links to its material below.

- [ ] Feedbro's earnings and traffic (section 2).
- [ ] Traffic to RSS-tool websites: Inoreader's tools, rssgizmos and others
      (section 2).
- [ ] How feedfry-style products earn, and whether they matter to us
      (section 2).
- [ ] What rssguard, feedspot, bubbles.town and NewsBlur's "popular" are
      (section 2).
- [ ] What zacusca does, in depth (section 2).
- [ ] Is diffbot/rss-anything useful (section 2)?
- [ ] Which feed reader apps rank well on the Android Play Store?
- [ ] Check nine turtles' newsletters against the newsletter-to-feed
      comment (section 4): non-issues filtered out, codes, double opt-in,
      one-click unsubscribe, replies.
- [ ] Are there feed-reader communities on Mastodon, Lemmy and Bluesky?
- [ ] Other ways to use RSS's extensibility, beyond MCP (section 4, "A
      new way to read feeds").

## 2. Rivals and tools to study

### The real competitors

- **Feedbin and Reeder.** They care about design, UI and small, genuinely
  helpful features. Their landing pages are good.
- **deadsimplerss** is also good.
- **[sift.li](https://sift.li/)**: a legit competitor worth keeping an eye on.
- **Inoreader and Feedly**: big, but corporate in feel (see section 3).

### Interesting takes on RSS

- [scour.ing](https://scour.ing/)
- [zacusca.net](https://www.zacusca.net/): feels like a powerful version of
  the filter tool. Understand it more.
- [feedmail.org](https://feedmail.org/)
- [lighthouseapp.io](https://lighthouseapp.io/)
- [feeds.fun](https://feeds.fun/): an example of a reader that learns what
  you like.
- [bubbles.town](https://bubbles.town/): what is this?
- [popular.newsblur.com](https://popular.newsblur.com/): what is this
  feature?

### RSS tools and feed builders

- [feedbro.com](https://feedbro.com/): how much does it earn? Can we get an
  estimate, with traffic and all?
- [Inoreader's RSS tools](https://www.inoreader.com/rss-tools) and
  [rssgizmos.com](https://rssgizmos.com/): how much traffic do they, and
  other RSS-tool websites, get?
- [feedfry.com](https://feedfry.com/): why are there so many products like
  this? How do they earn, and are they even slightly useful for nine
  turtles?
- [diffbot/rss-anything](https://github.com/diffbot/rss-anything): useful to
  us?
- [rssguard](https://github.com/martinrotter/rssguard): what is this?
- [feedspot.com](https://www.feedspot.com/): what is this?

## 3. Website inspiration

For the final website (milestone "Prices and launch", `docs/PLAN.md`).

- The landing page and the whole website's vibe matter. Almost every app's
  website looks the same. Good marketing makes you stop and look because it
  is familiar yet different. 99 percent of SaaS looks the same; a few dare to
  look different and write big copy. Inspiration to take from:
  - [mataroa.blog](https://mataroa.blog/)
  - [blot.im](https://blot.im/)
  - [pika.page](https://pika.page/)
  - [goodenough.us](https://goodenough.us/)
  - [letterbird.co](https://letterbird.co/)
  - [bearblog.dev](https://bearblog.dev/)
- Inoreader's and Feedly's websites feel corporate, SaaS-ish. Maybe one
  reason Bear Blog succeeded is that nothing about it says it was made by a
  company. Everything feels raw (maybe not the right word; some features are
  very finished) and new. Not copying Bear Blog's bare-minimum UI, but
  **check from time to time: am I bloating the app, and do the website and
  app feel like an average SaaS, or is there a personal touch?**
- Kagi's branding is good. They also do things like Kagi News and Kagi Small
  Web.

## 4. Readers' own words

### Too much to read, and the guilt of unread

- "The honest answer for me is volume. I subscribe to something because a
  slice of it is relevant, and then I own the whole firehose forever. The
  unread count turns into a guilt counter, and I end up skimming past the
  things I actually signed up for. The other thing, less important but
  real: a lot of readers still feel like they were designed in 2009. Dense,
  grey, everything the same visual weight, nothing telling me what deserves
  my attention. So for me it's less about a missing feature and more that
  the whole thing is organized around what publishers push out rather than
  what I'm actually trying to keep up with."
- "Good luck with the launch — the volume/attention problem is one a lot of
  readers dance around without naming. Interested to see how you handle it
  structurally rather than just in the UI."
- "Even my saved articles have hit +999 now. I guess the biggest problem is
  that I just want to read more than I can handle…"
- "On your unread-count question: the dream would be a per-folder catch-up
  button that clears without guilt, plus the ability to pause a noisy source
  for a week instead of unsubscribing. The stress was never the articles, it
  was the count feeling like a work inbox."
- One user posted:

  > Hey everyone, this is my first post here — apologies if this comes
  > across a bit awkward, English isn't my first language.
  >
  > I've been into RSS ever since the Google Reader days, and over time I've
  > tried lots of different readers. Even now, when I find a blog I like, the
  > first thing I look for is the RSS feed.
  >
  > But these days I feel kind of overwhelmed. Feeds pile up so fast, and if
  > I don't stay on top of them for a few days, it's suddenly +999 unread. I
  > do clean things up sometimes, but it's hard to cut back because I really
  > enjoy discovering good content.
  >
  > Lately I've been wondering: wouldn't it be nice if a reader could somehow
  > help filter posts — like showing stuff that matches your interests or
  > highlighting the really worthwhile articles?
  >
  > Does anyone else run into this kind of issue? Curious how others manage
  > it.
  >
  > Honestly, I've even been thinking about what it would take to build
  > something along these lines.
- "At the end of a reading session, I almost always mark all read. I also
  separate out high volume feeds into a separate folder. If I don't have
  time to at least scroll through all unread articles, I will mark articles
  from the high volume feeds read without even looking at them."

### Sites without feeds

- "But what annoys me the most, is as much as I love following independent
  blogs, a lot of sources that I actually think do good work sometimes does
  not provide RSS to begin with."

### Finding good feeds

- "I want better discovery. I haven't checked for a while, but generally
  most RSS readers recommend feeds that (a) are summary only, not full text
  (b) haven't been updated in years (c) post rarely. Also, they tend to
  preference big publications over high-quailty independent writers."

### Feeds that block readers

"I run a reader and 5,594 of the feeds my crawler checks actively refuse it
now. Not dead, just won't serve anything that isn't human."

Read later: [The day I got tired of my feeds breaking](https://thebugshots.dev/the-day-i-got-tired-of-my-feeds-breaking).

### No algorithms, no AI

- "I'm pretty happy with Inoreader. My main issue with most feed readers is
  sorting. No, I don't want any algorithms or AI. I just want a simple way to
  sort feeds from the ones with the fewest articles to the ones with the
  most. Or just show me one article from each feed. That's it."
- "I always find it strange when people suggest AI rss readers, because the
  reason we use rss is precisely so that we don't have algorithms deciding
  or reformulating our news."

### A new way to read feeds

One person commented: "The majority feed readers continuing to treat feeds
like email without innovating on the extensible nature of the underlying
format, relying on a traditional (and IMO dated) way of showing the
content." That's true.

### RSS for everyone

> Your point about the burden falling on developers made me think of an
> analogy. RSS right now is a bit like Linux. Powerful, open, and genuinely
> not for everyone in its raw form. But Android is Linux underneath, and
> macOS is Unix underneath, and billions of people use them every day
> without knowing or caring, because the interface hides the hard part. The
> openness is still there at the base. It just stopped being something the
> user has to deal with directly. That's the path I think RSS can take. Not
> everyone needs to understand feeds, the same way not everyone needs to
> understand a kernel. They just need something on top good enough that the
> open format underneath does its work quietly. The developer carries the
> friction so the reader doesn't have to, and that feels like the right
> trade. The alternative, where staying open means staying technical, is
> exactly what keeps it niche.

### What one Inoreader user can't live without

"I use the Inoreader Android app on my tablet. The following features are
the most important to me: 1) Full article retrieval When I perform a force
pull or scroll-down gesture on an article, Inoreader fetch and display the
full article content within the app, rather than showing only the RSS
excerpt. 2) Open article inside Inoreader When I scroll upward, Inoreader's
opens built-in browser or web view, not in my default external browser. 3)
Reading mode I want a clean reading mode that removes unnecessary website
elements such as advertisements, menus, sidebars, pop-ups, and other
distractions, while keeping the article text, images, and relevant content.
4) Share to other apps I need the ability to share the current article
easily with other Android apps using the standard Android share menu. These
four functions are essential to my reading workflow on a tablet. Ideally, I
should be able to move smoothly between the RSS article, the full article,
the built-in browser view, and reading mode without leaving rss app."

### Newsletters that went email-only

> A lot of the sources I wanted had dropped their feeds and gone email-only,
> so I spent a while turning newsletters back into feed items. Sharing the
> parts that surprised me, since this sub has the same problem every week.
> Getting the mail is the easy half. An address per newsletter, pointed at a
> mailbox you control, and the address itself is the feed identity. No
> parsing needed to know which source a message belongs to. Then the problems
> start. Not everything that arrives is content. Sign up to one newsletter and
> you get a welcome mail, a confirm-your-subscription mail, a receipt if you
> paid, and a "here's your login code" weeks later. Dump all of it into a
> feed and the feed is garbage. I sort each message on the sender, subject
> and a snippet, and only the actual issues become items. Codes I pull out
> with plain regex and surface separately, because a verification code inside
> a "feed article" is useless. Double opt-in is the whole ballgame. Most
> newsletters send a confirmation link and nothing else until you click it,
> so if your address can't receive, or you can't get at the link, you're just
> not subscribed. Unsubscribing is better standardized than I expected.
> List-Unsubscribe has been around forever, and RFC 8058 adds
> List-Unsubscribe-Post for real one-click. Worth reading carefully though:
> you may only auto-POST when the header advertises one-click, otherwise you
> can trip a "confirm your unsubscribe" page and do nothing. HTML email is not
> article HTML. Tables inside tables, inline styles, occasional script tags. I
> strip the executable parts before storing and render in a WebView with
> JavaScript off and navigation locked, which is the actual control. Images I
> leave alone on purpose, since each sender has its own address and a pixel
> tells them only that this one address opened it. Replies need a target. If
> you want to reply from the address the newsletter wrote to, you need the
> sender address plus the Message-ID off the original, or the thread breaks
> in their client. Identity is the RSS problem all over again. Feeds lie
> about guids; email has Message-ID, which is better, but forwarding and
> relays mangle enough of it that you still want your own key per stored
> item.
