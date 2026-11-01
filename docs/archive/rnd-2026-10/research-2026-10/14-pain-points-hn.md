# Pain points in people's own words (Hacker News mining, Oct 2026)

Method and limits (read first)
- Source: HN Algolia search API, fetched through WebFetch (about 28 fetches used). Curl was blocked by the proxy.
- WebFetch passes pages through a small model that refuses to reproduce more than ~125 characters at a time. So every quote below is a SHORT verbatim fragment (under 120 chars), not a full comment. Open the link for context before using a quote on the website. Fragments were copied as returned by the tool; treat spelling as unverified until you open the link.
- Link pattern: https://news.ycombinator.com/item?id=<ID>
- Reddit: bodies blocked, and WebSearch with site:reddit.com returned zero Reddit results (domain-filtered calls were rejected by the proxy). Section 4 is therefore NOT delivered from search; see note there.
- HN skews technical, so "never heard of RSS" voices are underrepresented. "Frequency" below = how many distinct comments surfaced across ~25 queries, not a statistical count.

---------------------------------------------------------------
## 1. Top 12 pain points (ranked by how often they surfaced)

### 1. Unread counts become anxiety / a personal-failure scoreboard (most frequent, 25+ comments)
- "I certainly got anxiety from my NetNewsWire badge showing 10, then 100, then 10,000 unread articles." (GCUMstlyHarmls) https://news.ycombinator.com/item?id=46161574
- "its dreadful little indicator of unread posts felt like a personal failure" (nyoki) https://news.ycombinator.com/item?id=47322780
- "without the anxiety of seeing the Unread count in my reader creep ever higher." (gpanders) https://news.ycombinator.com/item?id=23577643
- "keeps the main feed diverse yet short no anxiety of unread count." (627467) https://news.ycombinator.com/item?id=46165384

### 2. The reader looks and feels like an email client (infinite inbox feeling)
- "too much of the infinite unread email feeling" (emschwartz) https://news.ycombinator.com/item?id=46491972
- "that feeling of having thousands of unread emails" (emschwartz) https://news.ycombinator.com/item?id=46166271
- "doesn't try to be an email client with never-ending unread counters" (627467) https://news.ycombinator.com/item?id=46820467
- Older: RSS readers are "still stuck in the mindset of email clients" (mikeklaas, 2011) https://news.ycombinator.com/item?id=2805508
- Also outside HN: Kottke, "Why do RSS readers look like email clients?": "we imported the anxiety without the cause." https://kottke.org/26/01/0048256-why-do-rss-readers-look

### 3. The backlog grows until people abandon the reader (declaring bankruptcy)
- "how many of us just had an overgrown 10000+ unread RSS reader that we simply stopped using?" (hombre_fatal) https://news.ycombinator.com/item?id=29826607
- "Every attempt to use rss in my past has resulted in a useless feed of way too many unread, stale items." (_Algernon_) https://news.ycombinator.com/item?id=31294968
- "I have 800 articles in my RSS reader and I just don't have the energy right now" (leokennis) https://news.ycombinator.com/item?id=26024445

### 4. Needing a "mark all as read" amnesty button (coping mechanism; shows the guilt)
- "I find myself hitting "Mark all as read" continuosly." (pantulis) https://news.ycombinator.com/item?id=45461038
- "when I see that I've missed 128 posts, I'm just going to say "mark all as read"" (thaumasiotes) https://news.ycombinator.com/item?id=45459757
- "I am a heavy user of "mark all as read" like it's a trip odometer reset button." (sublinear) https://news.ycombinator.com/item?id=46807845
- "I love the "mark all as read" amnesty feature..." (mshaler) https://news.ycombinator.com/item?id=23341756

### 5. Too many feeds / noisy sources / volume (the firehose)
- "you don't want to wake up to 50 unread posts per day and get overwhelmed" (sph) https://news.ycombinator.com/item?id=45460544
- "My RSS feeds are, per Sturgeon's Law Squared, 99% crap." (082349872349872) https://news.ycombinator.com/item?id=42163684
- "Keep that number low. Ruthlessly." (latexr) https://news.ycombinator.com/item?id=31717265

### 6. Read-it-later piles are graveyards (adjacent to RSS; same guilt)
- "They are where my good intentions go to die" (al_borland) https://news.ycombinator.com/item?id=46880996
- "I thought of it as "Read It Never"" (xnx) https://news.ycombinator.com/item?id=44926445
- "anxiety about the stash of never-read but captured content" (kmarc) https://news.ycombinator.com/item?id=44403148
- "I save 2500+ unread articles in my pocket" (real_jiakai) https://news.ycombinator.com/item?id=34367235
- "the articles I've been saving to "read later" for nearly a decade are never gonna get read?" (AbstractH24) https://news.ycombinator.com/item?id=44073682

### 7. Newsletters clutter the inbox, and many have no RSS feed
- "I really want my inbox back, but I feel like I'm constantly battling lists I get subscribed to" (malandrew) https://news.ycombinator.com/item?id=26171867
- "I just want to read the thing, not to fill my inbox with newsletters from various blogs." (bayindirh) https://news.ycombinator.com/item?id=45926833
- "I subscribed to a ton of great newsletters, but they clutter everything human" (andymitchell) https://news.ycombinator.com/item?id=27710815
- "to get newsletters into an RSS reader and out of my inbox" (kennethko) https://news.ycombinator.com/item?id=32307415
- "IMO the RSS reader context is way better than an email inbox for consuming newslettery content." (jeffgreco) https://news.ycombinator.com/item?id=33470063

### 8. Subscription fatigue / pricing creep and feature bloat in paid readers
- "they jacked the pricing and introduced a bunch of needless extra features" (woleium, on Feedly) https://news.ycombinator.com/item?id=42748882
- "keeps cramming in business features I don't need" (virtualcharles, on Feedly) https://news.ycombinator.com/item?id=42749035
- "the lowest ad-free tier for Feedly was too expensive for what I'm doing (~6.00$/month)" (m-p-3) https://news.ycombinator.com/item?id=31962739
- "Feedbin was excellent, but eventually I decided to do some subscription cost-cutting." (lukasschwab) https://news.ycombinator.com/item?id=45529759

### 9. "Nobody knows what RSS is" / hard to get started
- "Sadly nobody (nobody = vast majority of users now) knows about RSS anymore.." (itwrangler) https://news.ycombinator.com/item?id=32546412
- "People don't know what an rss feed is." (parineum) https://news.ycombinator.com/item?id=49598569
- "Dozens of people and literally nobody knows what RSS, Mastodon or blogs are." (Kovah) https://news.ycombinator.com/item?id=36962525
- "I wish Firefox still showed an RSS feed icon when a page has one." (sph) https://news.ycombinator.com/item?id=45460544
- "RSS isn't HTML. I know how to write HTML, I don't know how to write RSS." (AlienRobot) https://news.ycombinator.com/item?id=40367621

### 10. Readers are ugly / power-user oriented / unchanged for years
- "got frustrated by how ugly it is and by the fact that it hasn't changed one bit over the years" (ggauravr) https://news.ycombinator.com/item?id=44603876
- "It unapologetically caters to power users" (segphault, on a reader) https://news.ycombinator.com/item?id=44598187
- "I'd love to see one made with the modern UX that makes the doomscrolling apps so engaging." (wmeredith) https://news.ycombinator.com/item?id=47304959
- "I love beautiful typography, and bad typography can ruin a reading experience." (atombender; about Kindle, shows the appetite) https://news.ycombinator.com/item?id=24029566

### 11. Trust: services and apps get shut down; fear of lock-in
- "shutdown of the Reader was a wakeup call that big corporations exist to make money" (pornel) https://news.ycombinator.com/item?id=35137838
- "paid service from a bootstrapped company, kind of ensures it won't randomly kill the product" (VoxPelli) https://news.ycombinator.com/item?id=44064933
- "I have the OPML export I took of my subscriptions from the day Google Reader shut down" (epaulson) https://news.ycombinator.com/item?id=39329403
- "The biggest blow for me was them shutting down pocket." (haloboy777) https://news.ycombinator.com/item?id=44548703
- "Pocket's content library went down with it." (rchaud) https://news.ycombinator.com/item?id=44065340

### 12. Feeds that expire / losing your place / sync flakiness
- "There's a limit on how many entries it keeps, so most of the entries in the Bored directory will expire unread." (rufus_foreman) https://news.ycombinator.com/item?id=45217217
- "trying to find out where I left off is a big pain" (bityard) https://news.ycombinator.com/item?id=45521411
- "A litttttle finicky at tracking read location but it's workable" (llamaimperative) https://news.ycombinator.com/item?id=42710717
- "iCloud sync is flakey but that's the only quibble." (SanjayMehta) https://news.ycombinator.com/item?id=47304998

---------------------------------------------------------------
## 2. 30+ more quotes for website copy

### Unread guilt and permission to let go
1. "nothing in the system telling me I have 573 unread posts" (BeetleB) https://news.ycombinator.com/item?id=46168246
2. "The idea that you have to read everything is a reader UI design flaw." (Isofarro) https://news.ycombinator.com/item?id=46164395
3. "It feels peaceful knowing I definitely saw everything I might care about" (spiffytech) https://news.ycombinator.com/item?id=42164306
4. "there's no fighting for my attention with notifications or unread counters" (seba_dos1) https://news.ycombinator.com/item?id=45632857
5. "nor to be trapped in a silo with infinite unread counters and scrolling" (tchoa91) https://news.ycombinator.com/item?id=47375855
6. "FOMO is an exceedingly misleading anxiety." (dredmorbius) https://news.ycombinator.com/item?id=31472082
7. "RSS is a human-respecting interface, because you don't miss anything if you don't read it for a month." (gen220) https://news.ycombinator.com/item?id=29933945
8. "Gloss over my 200 RSS feeds, don't be a completionist" (rcarmo) https://news.ycombinator.com/item?id=48882454
9. "The read status there is like a bookmark and I ignore counts." (sublinear) https://news.ycombinator.com/item?id=46807845
10. "I like mark-all-as-read, but I reeeaaallly like not having a read/unread dichotomy" (benrutter) https://news.ycombinator.com/item?id=42163438
11. Dan Q blog, "RSS Zero isn't the path to RSS Joy": "My RSS (Really Simple Syndication) reader is a place of joy, never of stress." https://danq.me/2023/07/29/rss-zero/
12. Same post: "I think that dropping your feed reader because there's too much to read is... solving the wrong problem." and "Your RSS (Really Simple Syndication) reader is a list of things you might like to read."

### Finishing / being caught up / finite
13. "Once I'm caught up, it's much easier for me be done and not keep scrolling" (JZL003) https://news.ycombinator.com/item?id=24664539
14. "there's no pressure to 'get caught up' on everything" (rcarr) https://news.ycombinator.com/item?id=34603310
15. "once I've caught up I close it" (forgotmypw100) https://news.ycombinator.com/item?id=39301927
16. "plenty of people still happily use an RSS reader and just go away when their list of new posts is empty" (_heimdall) https://news.ycombinator.com/item?id=38451096
17. "giving you a clear sense of being 'caught up'" (agnim25) https://news.ycombinator.com/item?id=47126203
18. "Instead of doomscrolling all the time, I get the 25 hot posts and that's it." (john2x) https://news.ycombinator.com/item?id=33053248
19. "It's been fantastic, in part because it's NOT infinite." (coffeefirst, on turning RSS into a daily newsletter) https://news.ycombinator.com/item?id=26016218
20. "If you can't get to the end of your RSS feed over the proverbial daily coffee, then you're using it wrong." (knorker) https://news.ycombinator.com/item?id=40623502

### Quitting social media, doomscrolling, control
21. "Algorithms trap you in doomscrolling but RSS and the Fediverse can give you back control of your attention." (macstainless) https://news.ycombinator.com/item?id=46721126
22. "I decided to quit most social media, so without RSS I would miss stuff I actually care about." (sph) https://news.ycombinator.com/item?id=45460544
23. "I didn't think I was able to quit social media addictions, but I've successfully ignored Twitter since Elon took over." / "I suppose all I really need is like some sort of curated RSS instead." (yakkityyak) https://news.ycombinator.com/item?id=36249632
24. "I am revisiting rss as a means to escape social media algorithms and doomscrolling." (dmtroyer) https://news.ycombinator.com/item?id=43804361
25. "RSS readers put you in control, instead of algorithmic social network feeds" (8organicbits) https://news.ycombinator.com/item?id=40499633
26. "I did it to battle my pointless social network and doom scrolling addictions" (lunaticman) https://news.ycombinator.com/item?id=32144316
27. "I am wasting way less time mindlessly browsing low quality content and doomscrolling." (rcarr) https://news.ycombinator.com/item?id=34603310
28. "I switched to RSS as an aggregator and doom scrolling is suddenly interesting again." (alphadelphi) https://news.ycombinator.com/item?id=47306336
29. "I successfully quit Twitter. I used to be on it ~2 hours a day, now I haven't opened in for almost a year." / "to go through the top links of your favorite social media state to satisfy the craving (I use RSS for that)." (mudrockbestgirl) https://news.ycombinator.com/item?id=34172514
30. "I built this because doomscrolling was affecting my mental health" (vuciv) https://news.ycombinator.com/item?id=42969644
31. "Cal Newport's Digital Minimalism is a great book on developing a healthy relationship with social media." / "Consider setting up an RSS feed!" (surprisetalk) https://news.ycombinator.com/item?id=35492002
32. "Digital minimalism? IRC, Usenet, Gopher, Gemini, Mail, RSS." / "No doomscroll, no crappy social media if you want, no notifications." (anthk) https://news.ycombinator.com/item?id=40183559
33. "I've never downloaded TikTok but I subscribe to two users via my RSS reader" (forsythe_) https://news.ycombinator.com/item?id=32333261
34. "I miss my RSS reader." (wmeredith) https://news.ycombinator.com/item?id=47304959  <- a lapsed reader, exactly the audience.
35. "Best solution ever (for me) to get daily disenshittified web contents." (rtfi_of) https://news.ycombinator.com/item?id=42750390

### Newsletters
36. "Turning your inbox into a glorified RSS feed is apparently what people would prefer." (night-rider, sceptical) https://news.ycombinator.com/item?id=34198624
37. "I can read newsletters and whatever else when I'm in the mood!" (reportingsjr) https://news.ycombinator.com/item?id=28572827
38. "I will subscribe to a newsletter when it provides an RSS feed." / "invasion of my inbox pushing content rather than allowing orderly pull." (zhte415) https://news.ycombinator.com/item?id=36488604
39. "RSS is the way to go it's much easier and news does not go into my inbox" (colesantiago) https://news.ycombinator.com/item?id=40628793
40. "I try not to sign up for anything that I need to read, newsletters etc. That's what RSS is for." (abendy) https://news.ycombinator.com/item?id=22988286
41. Counter-view: "I think newsletters are better than blogs because delivery into an email inbox > delivery via an RSS feed." (mooreds) https://news.ycombinator.com/item?id=41517298
42. "many users prefer their newsletters in their email inbox" (jasode) https://news.ycombinator.com/item?id=27716442
43. "I use an email address provided by Inoreader to get all my newsletters along my RSS feeds." (m-p-3) https://news.ycombinator.com/item?id=27711105

### AI features in readers (split opinion; mostly "wanted" among HN techies, but see surprises)
44. "My RSS reader automatically generates AI summaries for Hacker News posts and it works pretty well." (impure) https://news.ycombinator.com/item?id=41028999
45. "Sometimes when I comment on a post I have to double check the summary is correct" (impure) same link
46. "Would be nice if there's a RSS +LLM that can filter articles according to topic, summarize" (maxglute) https://news.ycombinator.com/item?id=39374221
47. "uses a local AI/LLM to filter out the noise, summarize long articles, and categorize them automatically." (wilhart, describing own tool) https://news.ycombinator.com/item?id=47391367
48. "It has AI summarize buttons (gemini-flash-lite is so fast!)" (FergusArgyll) https://news.ycombinator.com/item?id=46579816
49. "The system grabs all those, combines the ones about the same subject and summarises the content." (theshrike79; daily digest of noisy news) https://news.ycombinator.com/item?id=49309636
50. "comments from forums tend to call out AI slop pretty quickly" / "find spaces where real discussion still happens" (bsnnkv) https://news.ycombinator.com/item?id=42828037
(No comment in my searches explicitly said "I hate AI in my reader"; the pushback shows up as distrust of AI-generated content and a need to verify summaries.)

### App shutdowns
51. "Pocket is shutting down, which sucks for saving full articles." (wulujia) https://news.ycombinator.com/item?id=44144318
52. "Why is Glitch and Pocket both shutting down the same day and announcing today?" (duck) https://news.ycombinator.com/item?id=44066663
53. "Why not try sell Pocket instead of shutting it down?" (dc_rog) https://news.ycombinator.com/item?id=44068399
54. "Most people believe that when Google Reader shut down RSS stopped existing" (Eric_WVGG) https://news.ycombinator.com/item?id=42874941
55. "the (incredibly, unfathomably stupid) shutdown of Google Reader kneecapped it." (Eric_WVGG) https://news.ycombinator.com/item?id=42873551
56. "Feedly probably only recouped some single digit percentage of Google readers users." (glenstein) https://news.ycombinator.com/item?id=39495967
57. "After Google Reader shut down paid for Feedly for a while before switching to self-hosted FreshRSS." (thought_alarm) https://news.ycombinator.com/item?id=42728009
58. Ownership as a hedge: "I still use Omnivore, just self-hosted now." (podgietaru, 2026) https://news.ycombinator.com/item?id=49302427
59. "They're offering extended extended trials for anyone moving from Pocket" (erinmuur; shows shutdown = acquisition moment) https://news.ycombinator.com/item?id=44110591

### Paying (positive)
60. "well worth paying for" (AGivant, Bazqux) https://news.ycombinator.com/item?id=42758304
61. "it works reliably. Been paying for it happily" (AndrewDucker, The Old Reader) https://news.ycombinator.com/item?id=42747160
62. "It's a paid app ($10/month) but totally worth it IMO" (saadatq, Readwise Reader) https://news.ycombinator.com/item?id=44064500
63. "it costs money, but it has many other features that I find useful" (artisanspam) https://news.ycombinator.com/item?id=42738477
64. "it does one job and it does it impeccably." (gpjt, NewsBlur) https://news.ycombinator.com/item?id=42758211
65. Fragment: "does not have a subscription model" (rcarmo, on valuing Reeder Classic) https://news.ycombinator.com/item?id=42747013

### Calm / pull not push
66. "RSS ... allowing orderly pull" (zhte415, see 38). 
67. "Doesn't fix the feeling, but merges it with the rest of my email" (OJFord, on email-based reading) https://news.ycombinator.com/item?id=46807897
68. "I use RSS ... Getting my info diet from around 1400 RSS sources" / "and doomscrolling isn't even possible" (rambambram) https://news.ycombinator.com/item?id=43695503

---------------------------------------------------------------
## 3. What people say they would PAY for; price ceilings

Explicit price points found
- Readwise Reader: $10/month. Fans: "totally worth it" (https://news.ycombinator.com/item?id=44064500). Objectors: "I didn't use it often enough to justify a perpetual $10/month subscription (no free tier what so ever)." (input_sh, https://news.ycombinator.com/item?id=44695244); "due to the price being a little hard to justify" (ewoodrich, https://news.ycombinator.com/item?id=44069073).
- Feedly: ~$6/month ad-free tier called too expensive for casual use (m-p-3, https://news.ycombinator.com/item?id=31962739); that commenter prefers a ~$1.67/month "Supporter" plan. Another: Feedbin $5/month and Feedly $6/month are what jacurtis cites (https://news.ycombinator.com/item?id=31958831).
- A $30/month RSS-related price is called unreasonable (tpoacher, https://news.ycombinator.com/item?id=31722934).
- Self-hosted bookmark tool: "The hosted version has a $15 one-time fee" (nikisweeting, https://news.ycombinator.com/item?id=44381559) (shows one-time fees are noticed).
- Free-tier limit complaint: "150 RSS feeds on free account isn't enough for my usage." (ksec, https://news.ycombinator.com/item?id=42749602).

Inferred ceilings (my reading, not a stated survey): casual readers balk above roughly $5-6/month; $10/month is accepted only by heavy "power" users who want read-later, highlights, PDF, tags. Annual or one-time pricing is repeatedly preferred.

What people say they'd pay for
- One-time purchase over subscription: "I would like an RSS Reader that I pay for once rather than subscribe to" / "I hate that for this feature with Feedly I would have to pay monthly." (voisin) https://news.ycombinator.com/item?id=34108046
- Reliability and longevity: "Been paying for it happily" (The Old Reader); "paid service from a bootstrapped company, kind of ensures it won't randomly kill the product." https://news.ycombinator.com/item?id=44064933
- Simplicity: Inoreader praised as "closest to the no BS approach" (xela79) https://news.ycombinator.com/item?id=42780285
- A product that solves the underlying problem: "What is the product an end user like ourselves would pay for that helps?" (mcwhittemore) https://news.ycombinator.com/item?id=43208320
- Specific feature as purchase trigger: "I'd pay money for a RSS reader which uses this" (Asmod4n) https://news.ycombinator.com/item?id=34412337
- Sustainability signal: "pay RSS feed providers a share of the subscription price" (throwawsy7273) https://news.ycombinator.com/item?id=49139694
- Keyboard-driven, read-later, tagging and AI summaries bundle (Readwise Reader) is the main premium bundle people pay for: https://news.ycombinator.com/item?id=42748460

---------------------------------------------------------------
## 4. Reddit thread titles
Not delivered. Reddit bodies are blocked and WebSearch with site:reddit.com or reddit domain filters returned no Reddit URLs (two filtered calls were rejected by the proxy with HTTP 400). Instead, here are comparable question-style titles that did surface and show the same questions:
- Ask HN: Which RSS reader do you use? (141 comments, 2025) https://news.ycombinator.com/item?id=42746682
- Ask HN: Does an RSS-based Read-It-Later service exist? https://news.ycombinator.com/item?id=44665923
- Ask HN: How Do You Manage Blog Reading and Finding Content in 2024? https://news.ycombinator.com/item?id=40529880
- Ask HN: How to Properly Address the Problem of Information Overload? https://news.ycombinator.com/item?id=41329776
- Ask HN: Where to put AI summary and filter in custom RSS feed https://news.ycombinator.com/item?id=40082096
- Ask HN: What Is the Best Subscription News https://news.ycombinator.com/item?id=39296293
- Ask HN: Is There an HN Reader and Filter? https://news.ycombinator.com/item?id=38998802
- Ask HN: Suggest good RSS Readers please? (2026) https://news.ycombinator.com/item?id=47795080
- Ask HN: What's a good RSS feed reader? (2026) https://news.ycombinator.com/item?id=50177525
- Ask HN: How do you keep up with news in a particular sector? (2026) https://news.ycombinator.com/item?id=48906202
Non-HN blog posts on the same questions: "Feed overload is real" (https://www.downes.ca/post/75495/rd), "Declaring RSS Feed Bankruptcy" (https://aneclecticmind.com/2007/08/15/declaring-rss-feed-bankruptcy/), "Should feed readers count unread items?" (https://www.rssboard.org/news/208/should-feed-readers-count-unread-items), "one friend a day" (https://daverupert.com/2023/07/one-friend-a-day/), "how much would you pay for a google reader replacement" (https://liliputing.com/how-much-would-you-pay-for-a-google-reader-replacement/). Suggest a separate Reddit pass via a tool with Reddit access.

---------------------------------------------------------------
## 5. Objections to paid RSS readers, and how they're phrased
- "Free and good enough exists": "I'm quite happy with NetNewsWire." (oalders) https://news.ycombinator.com/item?id=49137032 ; "On Mac the best open source reader is NetNewsWire." https://news.ycombinator.com/item?id=48918761 ; "NetNewsWire is SO good - both the macOS and iPhone apps." (simonw) https://news.ycombinator.com/item?id=47254377
- Developer's own anti-monetisation stance becomes a norm: "First thing: don't send money. This app is written for love, not money." (al_borland) https://news.ycombinator.com/item?id=49139530
- Principled refusal to pay: "I like being able to say that I've spent the year adding nothing, not one penny, to shareholder value." (phantasmat) https://news.ycombinator.com/item?id=48568639
- Subscription fatigue: "I decided to do some subscription cost-cutting." (lukasschwab) https://news.ycombinator.com/item?id=45529759
- Prefers a one-time price: voisin, see section 3.
- "RSS is a standard, so why pay?" mindset: "Nobody needs to know what RSS client people use because it's a standard" (hammyhavoc) https://news.ycombinator.com/item?id=35564464 ; Reeder users highlight "does not have a subscription model." https://news.ycombinator.com/item?id=42747013
- Self-host instead: "super easy to set up via docker" (FreshRSS, confusing3478) https://news.ycombinator.com/item?id=42747278 ; "Self-hosted FreshRSS + NetNewsWire, works like a charm." (theshrike79) https://news.ycombinator.com/item?id=47306851
- Not enough use to justify: "I didn't use it often enough to justify a perpetual $10/month subscription" (input_sh) https://news.ycombinator.com/item?id=44695244
- Free tiers feel stingy, or paywalls bite late: "150 RSS feeds on free account isn't enough for my usage." https://news.ycombinator.com/item?id=42749602
- Won't pay for a thing whose job is to open someone else's page: "I don't use the RSS Reader to read the content" (ksec on Feedly) https://news.ycombinator.com/item?id=42747081
- Cultural: "We've built an online culture where people don't pay for content unless it is a streaming service of some kind." (codingdave) https://news.ycombinator.com/item?id=46713781
- Sync flakiness as a reason not to trust paid or free apps: "iCloud sync is flakey" https://news.ycombinator.com/item?id=47304998

How to read this: the objection is rarely "RSS readers shouldn't cost money"; it is "free ones exist", "I fear lock-in/shutdown", "subscription for something simple", and "$10 is for power users".

---------------------------------------------------------------
## 6. Surprises
1. HN users who like RSS defend the unread count's opposite: some say the backlog is a user error. "If you can't get to the end of your RSS feed over the proverbial daily coffee, then you're using it wrong." (knorker) and Dan Q's "Zero is not the target." So there is a competing school: "ignore the number" vs "remove the number". nine turtles' finite list takes a clear side; copy should say it removes the choice rather than lecturing.
2. A Larry Page claim, relayed by knorker (https://news.ycombinator.com/item?id=40623502): "getting to the end of the RSS feed is like getting to the end of the Internet". Unverified as a Page quote (commenter's account), but a nice hook: nine turtles is built so you can reach the end. Verify before using.
3. Many people already build the finite thing by hand: RSS turned into a daily newsletter ("It's been fantastic, in part because it's NOT infinite." https://news.ycombinator.com/item?id=26016218) and a "25 hot posts and that's it" digest. Proof of demand for a finite edition.
4. People read RSS in email on purpose to get an offline, synced, notification-free reader (kevincox: "Now I have a offline-first reader that is already synced to all of my devices." https://news.ycombinator.com/item?id=42747455). Newsletters-to-feed competes with this.
5. Some use readers only as a list of headlines and read in the browser (ksec, schnubbidubb "I just use the RSS Reader to get the list"). Implies the reading experience itself is under-served, supporting book-like typography. https://news.ycombinator.com/item?id=42746924
6. Lapsed reader voices exist in the wild: "I miss my RSS reader." https://news.ycombinator.com/item?id=47304959 and "haven't used one since google reader shut down" (gortok) https://news.ycombinator.com/item?id=46127917
7. A common belief that RSS died with Google Reader even though many say it didn't: "RSS was well and alive long after Google Reader shut down." (BeetleB) https://news.ycombinator.com/item?id=46416148 . Awareness gap, not a technology gap.
8. Digital minimalism and RSS are explicitly linked by people recommending Newport's book and RSS together (see quotes 31-32), so the target audience language ("declutter", "relapse", "default network") is already in use. "Be easy on yourself, you will relapse," (mlac) https://news.ycombinator.com/item?id=29196042
9. Newsletter-to-RSS is a much-requested trick (many 2020-2026 comments), but people also say "many users prefer their newsletters in their email inbox", so lead with "get it out of your inbox" only for people who already feel inbox pain.
10. Dollar anchor: paid power-reader at $10/month is the price people name; casual-tier objection starts around $6/month. A calm, finite reader positioned as a book-like purchase may sit best as annual or one-time pricing (inference).
