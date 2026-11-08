# 0213: Adding from YouTube, plainer and sturdier

*8 November 2026. Asked for by the owner, Rohit, after YouTube video links
kept failing with "The feed couldn't be added. Try again in a moment." on the
live app ("implement all of your suggestions … Ship and merge"). SPEC
sections 3, 36 and 38.*

**What was wrong.** On the owner's Mac the same version followed video links
in about a second, so the live failure is most likely YouTube answering the
live server slowly: one add can wait for a video's page (up to 20 seconds)
and a channel's feed asked up to four times (decision 0159), then the
Shorts and live lists. Cloudflare, in front of the app, cuts a request off
at 100 seconds and sends a page the app can't read, which it shows as
"couldn't be added". Not proven from the live logs (agents don't read
Render), but nothing else on that path answers without words. Separately,
feed-rs refuses a whole feed over one empty `<media:description>`, so a
channel with a video lacking a description couldn't be followed at all
(Rick Astley's, for one).

**Decision.**

- **Adding has a time limit:** 60 seconds for the whole of `POST
  /api/feeds` (`ADDING_LIMIT`, `server/src/feeds/adding.rs`), then the
  ordinary "unreachable" answer ("The site didn't answer. Try again
  later."). The database work is one transaction, so a cut leaves nothing
  half-done.
- **Follow doesn't ask YouTube again:** the channel and playlist feeds
  looked at for the question are kept (`lookup::Recent`, ten minutes), so
  Follow follows from that copy.
- **Empty descriptions are left out** before the feed is read
  (`without_empty_media`, `server/src/feed/parse.rs`).
- **The question, plainer** (owner's list, from the onboarding thread of
  6 November): a video asks "Follow {channel}?" over one row with no mark
  (name, newest title, "youtube.com/@handle" from the video's page,
  `"ownerProfileUrl"`), never the feed's address; a playlist offers
  Only "{playlist}" first and chosen, then Every video.
- **No guessing for YouTube:** a channel or playlist starts as a
  publication (`writers::kind::kind_from`); the reader changes it in
  "… is…" or Edit. Places already followed keep what they have.

**Considered.** Reading the live logs to prove the slow-answer cause:
agents never get Render access. Shortening each YouTube ask instead of a
limit on the whole: a limit on the whole covers every slow site, not only
YouTube.
