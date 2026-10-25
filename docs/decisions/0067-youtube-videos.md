# 0067: YouTube videos play in YouTube's own player, only once you press Play

*25 October 2026. Asked for by the owner ("viewing yt videos with their native player"); from DESIGN.md's V2 parking lot.*

**Decision.** An article whose link is a YouTube video (a channel's feed,
`youtube.com/feeds/videos.xml?channel_id=…`, gives one per video) shows a
quiet 16 : 9 box above its text with a round Play mark and the words "Play
video", and a line under it: "Plays in YouTube's own player. Nothing loads
until you press Play." Pressing it swaps the box, in the same place and
size, for YouTube's own player, which starts playing and takes the
keyboard. This keeps the publisher floor ("embedded media plays in the
publisher's own player, so views stay theirs").

- **Nothing loads from YouTube until Play.** No thumbnail, no script, no
  frame: opening or skimming past a video tells YouTube nothing. The
  player is the **privacy-enhanced** one (`www.youtube-nocookie.com`),
  which sets no tracking cookie until the video plays, with `rel=0` so the
  suggestions at the end come from the same channel.
- **The text is the video's description,** which YouTube's feed carries in
  its media details rather than as content. It becomes paragraphs, its web
  addresses links, and goes through the same safety cleaning as any
  article. Only for YouTube videos: other feeds' media descriptions (a
  photo's caption) stay out, as before. Videos stored before this change
  keep no text until the feed sends them again; they still get the player.
- **The frame is allowed for that one address only.** The Content Security
  Policy gains `frame-src https://www.youtube-nocookie.com`; every other
  frame is still refused by the browser. The frame is sandboxed (it may run
  YouTube's player and open YouTube in a new tab, nothing more).
- **YouTube is told nine turtles' address, and only that.** The page tells
  no site where the reader came from ("no-referrer"), but YouTube's player
  refuses to play without it (its "error 153"), so the frame alone uses
  `strict-origin`: YouTube learns the app's address, never which article.
- **A YouTube player embedded inside a blog post** is still removed by the
  safety cleaning (frames are never stored), but now leaves a link in its
  place, "Watch the video on YouTube", instead of vanishing.
- **The video is found from the article's link** (`watch?v=`, `youtu.be/`,
  Shorts, live videos and embed addresses), the same rules on the server
  (`server/src/feed.rs`) and the screen (`web/src/lib/youtube.ts`), each
  with its own tests.

**Considered.** Allowing YouTube's `<iframe>` through the HTML cleaning
(ammonia) and showing it as the feed gave it: rejected, since it would
load YouTube with every article opened, autoplay settings and all, and
widen what stored content may hold. A thumbnail picture on the Play box:
rejected for now, since even a picture would tell YouTube the article was
opened.
