# 0149: How YouTube as a first-class citizen is built

*3 November 2026. What to build was agreed with the owner (decision 0144,
PLAN.md → V1, item 4); the owner gave advance permission to build and ship it
("Go on V1. Ship each one."). The technical choices and the smaller design
choices below were made by the building agent while the owner was away, each
listed for the owner's refinement round. SPEC section 38 says what the
reader sees.*

**Decision.**

- **Shorts and live streams are sorted by YouTube's own lists, and only when
  a list names a video.** Decision 0144 named the long-videos-only list
  (`UULF…`). Leaving out everything *not* in that list would also hide a
  real video whenever the list lags behind the channel's feed, which can't be
  undone for that video. So nine turtles reads the other two lists instead,
  the Shorts list (`UUSH…`) and the live streams list (`UULV…`), and marks a
  video only when one of them names it (or its address is a `/shorts/` one).
  A video is never left out by guessing; a Short may slip through instead,
  which the switch's own line says. The lists are read only when a check
  brings videos not stored yet, so most checks ask YouTube nothing more
  (`server/src/youtube/sorting.rs`).
- **The mark is the article's, the switches are the reader's.**
  `articles.video_kind` ('short', 'live' or null) is stored once for
  everyone; `subscriptions.shorts` and `subscriptions.live_streams` (off by
  default) decide whether a reader gets an entry for it (structure change 30,
  the `shown!` condition in `server/src/feeds/store.rs`, used by every query
  that gives readers entries). Readers already following a channel start
  with both off: from now on new Shorts are left out, and nothing already in
  their lists goes.
- **Following any YouTube link** (`server/src/youtube/mod.rs`): a channel's
  address becomes its feed without any fetch; a playlist's feed names its
  channel (`<yt:channelId>`), so only the feed is read; a video's own page
  (the one pasted, decision 0016) names its channel's number. The answer is
  the existing list of choices, with `asks` and `maker` so the screen can
  word the question.
- **Where you stopped in a video is kept as a podcast episode's place is**
  (`episode_progress`, decision 0113): the same server route, the same device
  copy and the same "newer place wins" rule, now allowed for any article
  whose link is a YouTube video (`youtube_video!` in `podcasts.rs`: a
  watch, Short, live or `youtu.be` address). No new table.
- **Talking to YouTube's player without loading YouTube's script.** The page
  doesn't load YouTube's player library (the Content Security Policy
  wouldn't allow it, and it isn't needed): the player is opened with
  `enablejsapi=1` and the page's own address (`origin`), asked to talk with
  the "listening" message, and its messages are read only from
  `youtube-nocookie.com` and from that frame. Seeking a chapter is the
  player's own `seekTo` command (`web/src/lib/youtube.ts`).
- **The video ends when it ends.** When the player says it ended, the frame
  is removed and the still box comes back, with the keyboard on it. The
  player's regular time messages don't repeat its state, so the page
  remembers the last one it heard; the place is saved every 15 seconds while
  it plays, on pause and on leaving. If the player never answers, the page
  stops asking after ten seconds. YouTube's terms for embedded
  players forbid changing or hiding the player's own parts while it plays;
  closing the frame afterwards changes nothing inside it, so it's allowed.
  `rel=0` stays, for the moment before it closes.
- **Takeout's file goes through the OPML import** (`subscriptions::import`
  reads either), so the summary, the limits and "already followed" are the
  same; only the screen's row and its "doesn't look like" sentence differ.
  The CSV is read by a few lines of code, not a library.
- **Speed and captions remembered** (decision 0144, item 7) is not built:
  it needs a test in real browsers against YouTube's real player, which the
  building agent couldn't reach. It waits for the refinement round. (Done:
  speed is remembered, captions are YouTube's own, decision 0156.)

**Choices made while the owner was away** (each easy to reverse):

1. **The Play box's words:** the title set large (the reading face at the
   large size, semibold, centred, at most four lines; the box grows taller
   with large text rather than cut its words), then a 40px round mark beside
   "Play video", or "Resume from 4:00" when there's a place to resume. Each
   button is named by its visible words first ("Resume from 4:00: {title}",
   a chapter's "4:00 The heron"), so voice control finds it.
2. **The list row's mark:** a small line-drawn screen with a play mark, after
   the date, as a podcast episode's headphones are (a new icon, `video`).
3. **Chapters need at least two times, each later than the one before;**
   YouTube itself also needs the first to be 0:00, which nine turtles
   doesn't, so a description starting at 0:30 still gets chapters.
4. **Folding:** after the first paragraph, only when the rest is longer than
   280 characters; the button stays as "Show less" once opened.
5. **Turning Shorts or live streams on** brings in that kind's videos stored
   since the reader followed the channel, as read, so Unread doesn't
   suddenly fill; turning them off leaves the ones already there. Find new
   address keeps both ticks.
6. **Importing YouTube subscriptions** is its own row in Settings › Your
   data, under Export OPML, rather than a second kind of file in "Import
   OPML…".
7. **A Short's box** is at most 20rem wide, so its whole height fits on a
   computer's screen.
