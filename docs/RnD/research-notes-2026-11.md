# Rohit's research notes (1 November 2026)

Rohit's own notes from reading r/rss, rival apps and the small web, put in
order. Every link and quote from his draft is kept; only duplicates were
removed. Quotes from Reddit are word for word. Like everything in
`docs/RnD/`, nothing here is decided: anything that changes the app, the
website or `docs/DESIGN.md` still goes through the usual process
(`AGENTS.md` → "How a change happens").

Notes in *italics* starting "Note:" were added while tidying: they say where
an idea already exists in nine turtles, or where it would touch a floor.

**Contents**

1. [What comes first](#1-what-comes-first)
2. [Positioning and the ideal user](#2-positioning-and-the-ideal-user)
3. [The website and the brand](#3-the-website-and-the-brand)
4. [Competitors and products worth studying](#4-competitors-and-products-worth-studying)
5. [What readers say hurts](#5-what-readers-say-hurts)
6. [Feature ideas: the "read people" set](#6-feature-ideas-the-read-people-set)
7. [Other feature ideas](#7-other-feature-ideas)
8. [Marketing and content ideas](#8-marketing-and-content-ideas)
9. [Things to look into](#9-things-to-look-into)
10. [Reddit comments, word for word](#10-reddit-comments-word-for-word)

---

## 1. What comes first

> Big problem: my first problem to solve is positioning. Then the ideal
> user. Then branding and a shared design language that works across the
> app. Right now, there are so many things that are broken. But they can be
> improved only when the design language is chosen.

The order: **positioning → ideal user → branding and design language.**

## 2. Positioning and the ideal user

### A draft positioning: "Read people, not feeds"

A feed reader for following people's writing, not for keeping up with news.
It replaces social media with personal websites and blogs: slow, one-to-one,
and private.

The typical user is introverted and reads carefully. They take time to
understand what someone wrote and may reply later, usually by email. Every
feature in section 6 serves that reader. Features that make the product feel
social (likes, follower counts, public activity) are out of scope.

This is tentative and open for discussion.

### Why the small web, not news

- One user commented: "I do think more and more sites will turn down their
  RSS support out of a lame attempt to stop AI bots training on their site
  data. That, on top of the difficulty of monitizing human readers. It's
  really too bad but it's reality. Still waiting for Reddit to kill of
  theirs too." This is sadly true. That's why the ideal user should not be a
  news reader but someone who follows the small web, the indie web.
- It's also a reason to learn product design along with building a feed
  reader: if RSS vanishes because of scraper bots, the learning carries over
  to whatever comes next.

### Bring controlled reading to everyone

One user commented:

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

Rohit shares this feeling. Steve Jobs brought computers to everyone. Can
nine turtles bring controlled reading to everyone? Best UI, best UX, best
experience.

### Growing the pie

Even if the ideal user turns out not to be a beginner but someone already
familiar with feeds, the job of spreading awareness is still ours. Zerodha
invests a lot in spreading financial and market awareness: the pie gets
bigger, so their slice gets bigger. With AI, this isn't a hard task.

### A new way to read feeds?

One person commented: "The majority feed readers continuing to treat feeds
like email without innovating on the extensible nature of the underlying
format, relying on a traditional (and IMO dated) way of showing the
content." That's true. One way nine turtles already uses that extensibility
is the MCP connection (AI assistants). Talk to the agent about other ways.
Is there a completely new way of reading with RSS, beyond the same two-pane
or three-pane layout everyone has used for years?

### A different business model?

Give people the best RSS reader to self-host, but offer a hosted service.
(This changes the picture a lot: the audience moves from general to very
niche. Not sure.)

## 3. The website and the brand

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
- Accessibility should be a first-class citizen. *(Note: it already is a
  floor; SPEC section 22.)*

## 4. Competitors and products worth studying

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
  you like (see section 7, "Fetch less from feeds you rarely read").
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
- Some tech users want proper **RSS Bridge** integration.

## 5. What readers say hurts

### Too much to read, and the guilt of unread

The biggest theme. For a lot of people it's a problem that they follow
sources and get overwhelmed with unread pieces.

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

### Sites without feeds

How to follow websites that don't have RSS is a real problem for power
users. Apart from overwhelm and unread guilt, it comes up again and again.

- "But what annoys me the most, is as much as I love following independent
  blogs, a lot of sources that I actually think do good work sometimes does
  not provide RSS to begin with."
- Guides and tools people use:
  - [Building custom RSS feeds for non-RSS websites](https://developer.tenten.co/the-ultimate-guide-building-custom-rss-feeds-for-non-rss-websites-free-solutions)
  - [rss.app: how to follow websites that don't have RSS feeds](https://rss.app/blog/how-to-follow-websites-that-don-t-have-rss-feeds-LsELgP)
  - [pagecrawl.io: how to create an RSS feed](https://pagecrawl.io/blog/how-to-create-an-rss-feed)
  - [rssrescue](https://rssrescue.mayankbuilds.com/)
  - [Subwise (Chrome extension)](https://chromewebstore.google.com/detail/subwise-%E2%80%93-rss-feeds-subre/mabkemiilfppfpgmgajnjgkemgonjhcn)
- Rohit: "I know I have a respect-the-publisher policy. But I might rethink
  the policy or make some exceptions to it."

*Note: building a feed from a page that has none means fetching and reading
the publisher's web page, which the floor "Respect the publisher: show only
what the feed contains (never scrape)" rules out. Changing it is a change to
`docs/DESIGN.md` Part 1, so it would need Rohit's explicit decision and its
own note.*

### Finding good feeds

- "I want better discovery. I haven't checked for a while, but generally
  most RSS readers recommend feeds that (a) are summary only, not full text
  (b) haven't been updated in years (c) post rarely. Also, they tend to
  preference big publications over high-quailty independent writers."
- There are a lot of questions on r/rss asking for feed recommendations, so
  feed packs might be really useful. *(Note: the starter pack pages exist on
  the website, waiting to be filled; SPEC section 31.)*

### Feeds that block readers

"I run a reader and 5,594 of the feeds my crawler checks actively refuse it
now. Not dead, just won't serve anything that isn't human."

How do we keep nine turtles' fetcher from this? This should be a first
priority: we should never get "429 Too Many Requests" errors. It's also a
reason to learn the basics of the underlying tech. Read later:
[The day I got tired of my feeds breaking](https://thebugshots.dev/the-day-i-got-tired-of-my-feeds-breaking).
*(Note: polite fetching is how nine turtles works today, SPEC section 11;
worth checking against this article.)*

### No algorithms, no AI

- "I'm pretty happy with Inoreader. My main issue with most feed readers is
  sorting. No, I don't want any algorithms or AI. I just want a simple way to
  sort feeds from the ones with the fewest articles to the ones with the
  most. Or just show me one article from each feed. That's it."
- "I always find it strange when people suggest AI rss readers, because the
  reason we use rss is precisely so that we don't have algorithms deciding
  or reformulating our news."

### Newsletters that went email-only

Someone commented this; understand what it means and solve the problem.
*(Note: nine turtles already turns newsletters into feeds, SPEC section 28;
this comment is a useful checklist against it.)*

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

## 6. Feature ideas: the "read people" set

Eight features that serve the "Read people, not feeds" positioning, in no
particular order. Rohit wants to talk them through. Newsletters as feeds and
feed health (dead and moved feeds) are already built and not listed.

### 6.1 No unread counts

There are no unread numbers anywhere: not in the sidebar, folders, browser
tab title or app icon. New posts are listed without a backlog to clear, so
reading never feels like work to catch up on.

*Note: today counts show by default and can be hidden in Settings › Reading
(SPEC sections 5 and 18). The idea here is to have none at all.*

### 6.2 Author page

Clicking the author's name on an article page opens that author's page. The
article title still opens the article.

- **Picture.** Defaults to the author's initials on a color generated from
  their name. The user can instead pick the site's favicon or upload a
  picture. The picture appears only on the author page, nowhere else.
- **Notes.** A private, editable, freeform note, such as where you met or
  when you last talked.
- **Sources.** Several sources for one person: blog, Mastodon, Bluesky,
  YouTube channel, newsletter and so on. The page shows posts from all of
  them together.
- **Links.** A "Visit site" link to their website, plus links to each added
  account.
- **Also shown here:** the email drafts written to this author (6.3) and
  search within this author's posts (6.7).

### 6.3 Reply via email

Alongside Starred and Read later, every article page has a **Reply via
email** button.

1. Clicking it opens a box where the user writes their reply.
2. Saving keeps the article and the draft together.
3. The draft appears in two places: on the author's page, and in a
   Communication folder that sits alongside the Starred folder.

Optional addition: an "Add email address" field on the author page. Once an
address is added, the user can send the reply directly from the app.
Without one, the draft stays saved for the user to copy into their own
email.

### 6.4 Batched delivery (optional)

Feeds are still fetched in the background as usual, but new posts appear
only at times the user picks, for example 7am and 7pm, like mail being
delivered. Between deliveries nothing new appears, which removes the urge to
keep refreshing. Users who prefer posts as they arrive can leave it off.

### 6.5 Check-up page

A page listing people who haven't posted for longer than a period the user
sets (for example, six months). It's a prompt to check in on someone and
make sure they're okay, not a statistic.

- Each entry shows the person's name, the date of their last post, and a
  link to their author page, where the user's notes and email live.
- When the person posts again, they leave the list on their own.

**Caveat: the check-up page needs careful wording.** The intent is kind, but
"these people haven't posted in a while" can easily read as surveillance or
guilt. Test the copy with real users before treating it as a headline
feature.

### 6.6 Public page (xyzreader.com/username)

An optional public page listing what the user reads.

- The user chooses which feeds and folders to share; nothing is shared by
  default.
- The user can edit their public name.
- The page lists the shared feeds, grouped by folder, with links to each
  site and its feed, plus an OPML download.
- Private material never appears: notes, author pictures, email drafts and
  reading activity.

### 6.7 Full-text search

Everything the reader has fetched from a user's subscriptions becomes their
personal archive, and they can search it. The typical use: "someone I follow
wrote about seed libraries last year, who was it?" A reader that keeps
people's writing should help the user find it again, especially when
replying weeks later.

*Note: search over every fetched article already exists (SPEC section 14,
SQLite FTS5). What's new below is searching your own notes and drafts, and
the author and state filters.*

**What gets indexed**

- Title, author and full post content for every post fetched, not only the
  ones the user opened. They may want something they skimmed past.
- The user's own material: notes on people, email drafts and, if built,
  highlights and notes on posts. Searching one's own thinking is often more
  useful than searching the posts.

**How it behaves**

- Plain words by default, with stemming, so "cycling" finds "cycle" and
  "cyclist".
- Exact phrases in quotes.
- Filters by author (a person, so all their sources at once), by date (this
  month, last year, a range) and by state (starred, has a note, has a
  draft, read or unread).
- Each result shows a snippet with the matched words highlighted, plus the
  author and date. Results sort by relevance, with a switch to sort by date.
- Search within one person, from their author page: "what has Tomás written
  about allotments?"

**How to build it**

No separate search service is needed at this scale. On Postgres, built-in
full-text search covers everything above: a `tsvector` column with a GIN
index, `ts_rank` for ranking and `ts_headline` for snippets. On SQLite, FTS5
does the same. Strip HTML and index each post as it's fetched.

Limitation: for feeds that publish only summaries, only the summary can be
searched.

### 6.8 Export everything the user has written

Notes on people, email drafts and, if built, highlights and notes on posts,
exported as Markdown. Careful readers often keep their own notes system.
Knowing their thinking isn't locked inside the app is a real reason to trust
it with that thinking.

### Decided against

- **"This week, people you follow linked to."** A weekly page of links
  extracted from followed posts. Dropped by choice.

### Open questions on this set

- [ ] Author page: build it on existing tags (a tag marked as a person
      groups their sources), or as a new "person" record?
- [ ] Sending email directly: send from the user's own address (needs
      connecting their mail account) or from the app's domain with the user
      as reply-to? Deliverability differs.
- [ ] Batched delivery: do posts fetched but not yet delivered show up in
      search?
- [ ] Check-up page: what default period, and should people who always post
      rarely be treated differently?
- [ ] Highlights and notes on posts: build them? Search and export already
      assume they might exist.

## 7. Other feature ideas

### Taming the pile

- **Make cleaning up easy.** A super easy way to change a feed's folders and
  tags, mute feeds and delete feeds, and a prominent, clear "clear the
  feeds" button. Why only solve adding feeds (starter packs)? Empower users
  to reduce the overwhelm themselves.
- **Per-folder catch-up** that clears without guilt, and **pause a noisy
  source for a week** instead of unsubscribing (from the quote in section
  5). *(Note: "Mark all as read" with undo exists, SPEC section 8; pausing a
  feed for a while doesn't yet.)*
- **Site-wide rules and mutes** (and others, though it's not clear what
  rules besides mute could apply site-wide). *(Note: rules can already apply
  to all feeds, a folder or one feed, SPEC section 27.)*
- **Search filter results as folders** (a saved search that sits in the
  sidebar).
- **Language filter:** filter by the language of the subscription or
  article, across all subscriptions, as part of the article filtering
  settings.
- **Semantic filtering** (a feature request): "Semantic filtering: i want
  items that are about KEYWORD but haven't got KEYWORD in the title. I also
  don't want loads of items that have KEYWORD in the content but aren't
  really about KEYWORD." *(Note: this needs some kind of AI judging what an
  article is about, which sits close to the firm no on AI that ranks what
  writers wrote; strategy notes → "Firm noes".)*
- **Delete articles, not just hide them:** "I want to be able to delete
  articles not just hide them. Like miniflux, read articles go to
  history,clear history when you want to and they never show up again,
  pagefeed does the same,thanks,let me know if you do this."
- **Sort feeds by how much they post,** or show one article from each feed
  (from the Inoreader quote in section 5).
- **Fetch less from feeds you rarely read.** Brainstorm with AI how to stop
  hitting websites the user reads less from, moving them into the
  background. Raycast learns what you use and search most and adjusts what
  it shows. But it's risky: people use RSS for precise control, and if they
  smell the word "algorithm" they may stay away. If we do it, do it
  properly. Example: [feeds.fun](https://feeds.fun/).

### Adding feeds

- **Choosing between several feeds.** A user enters a web address, the site
  has several feeds, and the user is shown just names, no examples of what
  each one contains, and is dumbfounded. Bad UX. Show what's in each.
  *(Note: today the list shows names and addresses, SPEC section 3.)*
- **A feed finder that never misses.** In one post, a person shared how they
  check whether a website has feeds: "Granted, in >90% of cases the standard
  way of checking meta tags is enough to find the feeds. But my goal for
  this tool is that it finds feeds regardless if they're linked somewhere or
  not. So if this feed finder doesn't find a feed, no feed exists."
  - Checks meta tags of parent pages (sometimes the article itself doesn't
    have the meta tag, but the main blog page does)
  - Checks common suffixes like /rss, /index.xml and many others (sometimes
    the feed exists but isn't linked)
  - Checks the sitemap
  - Checks all links on the page
  - Checks 3rd party feeds (OpenRSS for now, when I find more such
    repositories I'll add them too)

  *(Note: nine turtles reads only the page the reader pastes, decision
  0016; fetching more pages would need a decision.)*
- **Drag and drop** in the web app for changing a feed's tags or folders:
  can a simple version work?

### Media

- **YouTube as a first-class citizen:** let the user choose between regular
  videos, Shorts, live and playlists. *(Note: YouTube videos already play in
  YouTube's own player, SPEC section 7.)*
- **Podcasts as a first-class citizen,** with lock screen integration: rich
  Now Playing controls with article thumbnails and accurate duration
  estimates. *(Note: podcasts and lock-screen controls exist, SPEC section
  35.)*
- **Text to speech:** is it needed? Who usually needs it?
- **Kindle:** what can we do around it?

### Integrations

- Some users want a nice UI plus integrations with other services behind it.

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

*(Note: 1 and 3 mean fetching the article's web page, which the
respect-the-publisher floor rules out; sharing exists, SPEC section 21.)*

## 8. Marketing and content ideas

### Cornerstone writing

- **How power users use feed readers** (not exactly that title): a
  cornerstone blog post. Even veterans may be missing a few best practices.
  Similar post:
  [RSS tricks](https://george.hotell.ing/2025/01/07/rss-tricks/).
- Best practices to include:
  - **Three tags: everyday, leisure, binge read.** Add one to every feed.
    Everyday feeds are the ones you want to read every day and not miss.
    Leisure is for when you have some time and want to explore. Binge read
    is for when you have lots of time and want to read all the updates.
    Zero inbox.
  - **For news sites, don't show anything older than X days.** The rule
    doesn't apply to personal feeds. *(Note: "Let unread go after" in
    Settings › Reading does this, SPEC section 18.)*
- **A 1000x better [aboutfeeds.com](https://aboutfeeds.com/).** Put nine
  turtles' name at the end, or maybe not at all.

### Personally curated websites (to grow the pie)

- **Takes on RSS:** people who've written genuinely interesting things about
  RSS. Examples: [iheartrss.com](https://iheartrss.com/),
  [twowavesandadot.blog](https://twowavesandadot.blog/).
- **Tools built around RSS:** the research already finds them; share them on
  a personally curated site.

### Starter packs: where to find blogs

- [Bill Dietrich's feed list](https://www.billdietrich.me/feedlist.html)
- [Pagecord spotlight](https://pagecord.com/spotlight)
- [powRSS editor picks](https://powrss.com/editor-picks): a nice place to
  find interesting blogs
- [List of blog aggregators](https://bstn.info/posts/list-of-blog-aggregators)

### Communities

- There are quite a few paying users in r/rss, so communities are useful.
  (Not to spam them; just an observation.)
- The most liked post on r/rss (279 likes, 35 comments, 425 shares or saves)
  is about ditching social media and turning RSS into an everything app.
- r/rss has no active moderators, and there's no r/rssreaders: the space to
  start a subreddit is open.
- If you launch a finished product in communities, some people will pay
  immediately. Lesson: it's possible to earn money on day one if the product
  is worth paying for.
- Mastodon, Lemmy (lemmy.world) and Bluesky: are there thriving feed-reader
  communities there?

### Outreach

Across platforms and the web, watch for anyone posting about RSS, Atom or
feeds, or anything hinting they're a potential user (for example, people
interested in Markdown may like RSS). Read their website and send a
genuinely interesting email.

### Benchmarks after V1

When V1 is ready, ask an AI agent to research and write a report like
[Lighthouse's feed reader deep dive](https://lighthouseapp.io/blog/feed-reader-deep-dive),
with benchmarks: where nine turtles excels and where it lags. Every place it
lags should be a conscious decision.

## 9. Things to look into

A list of open questions for research. Each links back to the section where
it came from.

- [ ] Feedbro's earnings and traffic (section 4).
- [ ] Traffic to RSS-tool websites: Inoreader's tools, rssgizmos and others
      (section 4).
- [ ] How feedfry-style products earn, and whether they matter to us
      (section 4).
- [ ] What rssguard, feedspot, bubbles.town and NewsBlur's "popular" are
      (section 4).
- [ ] What zacusca does, in depth (section 4).
- [ ] Is diffbot/rss-anything useful? Is RSS Bridge integration worth it
      (section 4)?
- [ ] Which feed reader apps rank well on the Android Play Store?
- [ ] How to keep our fetcher from being refused or rate-limited (section 5).
- [ ] What the newsletter-to-feed comment means for our newsletters
      (section 5).
- [ ] Are there feed-reader communities on Mastodon, Lemmy and Bluesky
      (section 8)?
- [ ] Text to speech: who needs it? Kindle: what could we do (section 7)?
- [ ] Other ways to use RSS's extensibility, beyond MCP (section 2).
- [ ] Sites without feeds: keep the floor, or make an exception (section 5)?

## 10. Reddit comments, word for word

Collected verbatim. The ones already quoted above are not repeated here.

- "At the end of a reading session, I almost always mark all read. I also
  separate out high volume feeds into a separate folder. If I don't have
  time to at least scroll through all unread articles, I will mark articles
  from the high volume feeds read without even looking at them."
- Also in this collection, quoted in full above: the Inoreader tablet user
  (section 7), "I want to be able to delete articles…" (section 7) and the
  per-folder catch-up wish (section 5).
