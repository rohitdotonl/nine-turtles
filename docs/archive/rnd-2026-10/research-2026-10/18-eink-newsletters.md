# 18. E-ink reading and newsletter readers (researched 2026-10-25)
Legend: [R] = page actually read; [S] = search snippet/title only; [U] = unverified. Reddit blocked; HN comments via Algolia API.

## Bottom line
- E-ink demand is real but sold as "send to my Kindle/Kobo" by many small paid tools. Evidence of paying: KTool ~$580-620 MRR (Dec 2022-Jan 2023) and its founder quit a job to work on it (Mar 2026); Instapaper moved Send-to-Kindle behind Premium ($5.99/mo, $59.99/yr) in Feb 2026; a Pocket-on-Kobo user said they "would pay for a replacement".
- A weekly EPUB is a delivery format, not a new reader. Sideloading/email-to-Kindle is the weak point. Kobo has no email-to-device path (Instapaper uses its API; Kindle has Send-to-Kindle email).
- A PWA is a poor fit for Kobo's own browser. Boox (Android, Chrome) and Daylight (Android-based) are the realistic PWA targets; the lag on e-ink is the main complaint.
- Calm Tech certification: Mudita yes; reMarkable not found among certified products (unverified). Partner angle is thin.

## Part A: e-ink

### Community sizes (GummySearch pages, [R], Oct 2026)
- r/kobo ~134k (page "last updated Oct 1, 2026") https://gummysearch.com/r/kobo
- r/eink ~101k https://gummysearch.com/r/eink/
- r/RemarkableTablet ~103k, +22.7%/yr https://gummysearch.com/r/RemarkableTablet/
- r/Onyx_Boox ~70k, +37.1%/yr https://gummysearch.com/r/Onyx_Boox/
- Not checked: r/Supernote, r/PocketBook, r/Kindle, r/ereader (appear in search results [S]).

### Tools and what they cost / complain about
| Tool | Price | Notes |
|---|---|---|
| Pocket on Kobo | was free | Pocket shut down 8 July 2025, Kobo support ended; Kobo promised a fix "coming soon", then partnered with Instapaper (announced Jul-Aug 2025). [R] https://blog.the-ebook-reader.com/2025/07/12/pocket-support-has-ended-on-kobos-without-any-alternatives |
| Kobo + Instapaper | not stated in the article | Linked account shows saved articles in More > My Articles on the device; "works much like the old Pocket integration". [R] https://sixcolors.com/link/2025/08/kobo-instapaper-have-come-together-at-last/ |
| Instapaper Send to Kindle | Premium $5.99/mo or $59.99/yr | Became Premium-only 19 Feb 2026. Rep said building the ePub and emailing it is "fairly resource intensive for us". Kobo delivery via API stays free. [R] https://www.androidauthority.com/instapaper-send-to-kindle-paywall-imminent-3635014 (Polish coverage: https://www.chip.pl/2026/01/koniec-darmowego-czytania-na-kindleu-instapaper-wprowadza-oplaty-za-popularna-funkcje [S]) |
| KTool (Kindle) | freemium, ~$5-10/mo | Articles, forwarded newsletters, RSS; scheduled magazine-style ebook. 3-star App Store average; 2 likes on AlternativeTo; "Read RSS on Kindle is still a work in progress". [R] https://alternativeto.net/software/ktool/about |
| omreader (2020), Any2K (Feb 2026), Analog Reader (Jan 2026), r2k, inkfeed, dear-reader | various / open source | Many small entrants; RSS+newsletters to Kindle is a crowded indie niche. [HN search results; github.com/adhamsalama/inkfeed, pypi.org/project/r2k, S] |
| Readwise Reader / Kindle | Reader ~$8.99/mo (per Readless, competitor) | Not verified for Kindle/Kobo send in detail. [S] https://readwise.io/pricing |
| Calibre news recipes, KindleEar, p2k, Feedbin-to-Kindle | free/self-host | Not verified; a Calibre workaround was suggested by a commenter on the Pocket/Kobo post [R]. HN search for KindleEar returned no real hits. |
| Boox built-in RSS | n/a | Not verified. Boox is Android, so people install Feeder/EinkBro. |
| reMarkable "Read on reMarkable" | bundled | Chrome extension sending web pages as docs. [S] https://remarkable.com/blog/introducing-read-on-remarkable; price/limits not read. |
| Daylight DC-1 | n/a | Support page lists "Web browsing, Spotify, spreadsheets, even YouTube!", a built-in Reader app, and app downloads; does not say Android/Chrome/PWA. [R] https://support.daylightcomputer.com/getting-started |

### Verbatim voices
- Pocket/Kobo: "I was a heavy pocket user on Kobo...articles were easy to save for later and pleasant to read." A commenter "paid for Pocket and would pay for a replacement". Another: sideloading "now feels like a step backward". (paraphrase/quote via summarizer, [R]) https://blog.the-ebook-reader.com/2025/07/12/pocket-support-has-ended-on-kobos-without-any-alternatives
- rty32, HN 2024-06-27: "I wish there was a native RSS reader on kindle." https://news.ycombinator.com/item?id=40812584
- t-3, HN 2024-04-07: "there's no good RSS reader (koreader has one, but it's not very good)." https://news.ycombinator.com/item?id=39964420
- stasomatic, HN 2026-10-16 (Boox thread): "...but the lag/latency is insane." https://news.ycombinator.com/item?id=50117904
- lukas346, HN 2026-01-23: "practically none of these projects are adapted to this type of screen." https://news.ycombinator.com/item?id=46734687
- freetanga, HN 2024-09-05: "+20 for EInkBro (which I use with Bazqux reader for awesome RSS experience)." https://news.ycombinator.com/item?id=41454748
- theptip, HN 2026-03-29: "$10/mo is currently cheap enough to prevent me from building my own." https://news.ycombinator.com/item?id=47564375 (context not read; may not be about RSS)
- longnguyen (KTool), HN 2023-03-17: KTool "could not replace the official periodicals" but works as an alternative after Amazon's subscription changes. https://news.ycombinator.com/item?id=35195183
- Motivation, omreader founder 2020: reading blogs/newsletters on Kindle "so the reader can avoid phone distractions". https://news.ycombinator.com/item?id=23803467

### Browser/PWA compatibility
- Kobo: built-in browser is "experimental", struggles with complex sites, basic JS/CSS only; Linux, 512MB RAM. Treat PWA install as not viable. [R] https://goodereader.com/blog/?p=366808 (dated ~2023)
- Boox: Android; Chrome/Firefox via Google Play (Boox can install browsers per goodereader above). PWA add-to-home-screen not verified on Boox. [U]
- Daylight: browser exists; PWA support unconfirmed. [U] Ask hello@daylightcomputer.com.
- Design implications: no animations (matches house rules), high contrast, large type, static pages; EPUB is the safest e-ink channel.

### Calm Tech partners
- Calm Tech Institute first 2025 wave: Mudita Kompakt, Harmony 2, Bell 2 (Platinum), Aura frames (Gold), Dreamie, Henry Audio DA 256. reMarkable, Daylight, Kobo, Boox not listed. [R] https://www.calmtech.institute/post/announcing-the-first-wave-of-calm-tech-certified-awardees-for-2025 ; Mudita announcement 6 Oct 2025 [R] https://www.mudita.com/community/blog/mudita-products-achieve-calm-tech-institute-certification/
- reMarkable certification: not found; do not claim. Mudita Kompakt is an e-ink phone (small audience, not an e-reader), so a partner link is plausible but low volume.

## Part B: newsletter readers
| Product | Price | Status 2026 | Notes / complaints |
|---|---|---|---|
| Meco | Free; Pro quoted three ways: $3.99/mo or $35/yr (Readless list), $4.99/mo or $39.99/yr (Readless pricing page, checked 16 Oct 2026) | Active | Conflicting prices from one competitor; check meco directly. Free: own newsletter address; Pro: connect up to 3 Gmail/Outlook, offline, AI. [R] https://www.readless.app/blog/meco-pricing-2026 , https://www.readless.app/blog/best-newsletter-reader-apps (Readless is a competitor) |
| Stoop | unknown | Status unverified; latest source found is a 2022 review | Complaints (2022): lock-in (must re-sign up with Stoop address), confusing navigation, sign-up forms. [R] https://medialyter.substack.com/p/stoop-users-will-be-afraid-to-leave |
| Readwise Reader | ~$8.99/mo | Active | Email forwarding to Readwise common (see quotes). [R secondhand] |
| Feedbin | $5/mo or $50/yr | Active | Per-account newsletter address; no free tier. [R secondhand] |
| Kill the Newsletter | free | Active (214 HN comment hits, latest 2026-07-28) | Makes an email address that yields an Atom feed. |
| Mailbrew | Free (ads); $59/yr or $5.99/mo | Active. Not shut down: acquired by Evernomic, completed Nov 2025, announced 22 Mar 2026 (per Readless) [R] https://www.readless.app/blog/mailbrew-vs-readless-2026 . Prior ownership change Oct 2023. Single-source claim; the Readless page is a rival. |
| Matter | free + premium | Active (per Readless) [R secondhand] | |
| Substack app | free; creators charge | Active | Public RSS includes free posts only [R secondhand]. Readless cites 8.4M paid subs, 2026, from amraandelma.com [U]. |
| Slick Inbox, Inoreader newsletters | not checked | | [U] |

### Newsletter overload data
- Pew, 5,153 US adults, 18-24 Aug 2025 (published 19 Feb 2026): 30% get news from newsletters at least sometimes (6% often); 7% paid for a news newsletter in past year. Among those who get them: 71% subscribe to fewer than 5, 10% to 5-10, 3% to more than 10. 38% read most of what they receive, so 62% do not. Only 3% prefer newsletters as a news platform. Pew does not ask about overload directly. [R] https://www.pewresearch.org/journalism/2026/02/19/email-newsletters-as-a-source-of-news/
- Implication: "overload" is a power-user problem (few have >10). Target is the heavy 5-10+ subscriber and the guilt of unread issues.

### Verbatim: forwarding/routing newsletters out of the inbox
- DevX101, HN 2022-12-23: Gmail filters forward newsletters to Readwise; "I never see these emails unless I click on the 'Newsletters' label." https://news.ycombinator.com/item?id=34108161
- fredsir, HN 2020-05-06: "a smaller newspaper in my country that sends out daily newsletters which I then forward to my RSS reader." https://news.ycombinator.com/item?id=23093754
- lh7777, HN 2017-11-11: "Set up an email rule to automatically forward your newsletters to a custom address." https://news.ycombinator.com/item?id=15676393
- orenmazor, HN 2010-10-05: "my inbox is fifth date material" (wants a separate address). https://news.ycombinator.com/item?id=1760856
- singiamtel, HN 2026-05-26: Kill the Newsletter changed how they handle subscriptions; email is "a big privilege" they are less willing to grant. https://news.ycombinator.com/item?id=48287179
- sloped, HN 2026-06-13: built a personal Kill the Newsletter; many newsletters are "horrific" (in feed form). https://news.ycombinator.com/item?id=48517135
- sloped, 2026-06-15: wary of open-tracking. https://news.ycombinator.com/item?id=48540807
- r2222, HN 2022-07-02 on Feedbin: "It doesn't have any social cruft or AI assistants or ML companions." https://news.ycombinator.com/item?id=31958275
- bryanstjohn, HN 2025-12-27 (ForwardToAudio): subscribes to "way too many long-form newsletters" and rarely has time. https://news.ycombinator.com/item?id=46397911
- nickthegreek, HN 2026-07-28: Substack emails the full text so you need not visit the site. https://news.ycombinator.com/item?id=49087731
(Quotes came through a summarizer; exact wording should be re-checked at the links before publishing.)

## Takeaways for nine turtles
1. Private per-reader address plus feed is table stakes (Feedbin, Meco, Kill the Newsletter). Differentiators are calm, finite, no AI/social.
2. Competitors' bad points to avoid: lock-in (Stoop), tracking pixels (sloped), HTML that renders badly (sloped "horrific"); strip tracking, sanitize, credit the sender.
3. Quiet Edition: EPUB (not PDF) by email or download; Kobo cannot receive email, Kindle can (Instapaper paywalled it because building ePubs is costly, so budget the compute). Weekly cadence matches the finite ethos. Price anchors: Instapaper $59.99/yr, Feedbin $50/yr, Meco ~$35-40/yr, Mailbrew $59/yr.
4. Don't promise PWA on Kobo. Offer EPUB there.
