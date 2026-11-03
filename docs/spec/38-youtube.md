# 38. YouTube

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.
Decisions 0144 (what, agreed with the owner on 2 November 2026) and 0149 (how
it's built). Its look gets a refinement round.*

A YouTube channel is a person who makes videos, not YouTube the platform.
Everything goes through YouTube's own public feeds and its own player: no
YouTube account, no Google key, and no reading YouTube's pages beyond the one
you paste.

**What it does**
- **Any YouTube link follows its maker,** pasted into + Add (section 3):
  - a channel's address (`youtube.com/channel/UC…`) follows it at once, by its
    feed, without reading the page; an `@handle` or `/c/` address reads that
    one page to find its feed, as any website does;
  - a video's address (a watch page, `youtu.be/…`, a Short or a live video)
    reads that one page to find its channel, then asks **"This video is by
    {channel}. Follow {channel}?"** with the channel as the one choice;
  - a playlist's address (`/playlist?list=…`, or a video played from one)
    asks **"This playlist is by {channel}. Follow all of {channel}'s videos,
    or only the playlist?"**, the whole channel first. A playlist that has no
    feed (a mix made for you, Watch later, a private one) follows the video's
    channel instead, when there's a video.
  The feed is named for the channel (or the playlist), never "YouTube".
- **Shorts and live streams are left out by default.** A YouTube channel's settings (section
  36) have two more ticks: **Include Shorts** and
  **Include live streams** (streams, and their recordings once they end),
  both off. Turned on, the ones already stored join the channel's list, as
  read, and new ones arrive unread; turned off, new ones are left out and the
  ones already there stay. A playlist you follow shows everything in it.
  Shorts are sorted by lists YouTube keeps for each channel, so now and then
  one may slip through (the tick's own line says so); nothing is ever left
  out by guessing.
- **Bringing your YouTube subscriptions:** Settings › Your data › **Import
  YouTube subscriptions…** takes the `subscriptions.csv` that Google Takeout
  gives anyone (takeout.google.com, YouTube, subscriptions). Each channel is
  followed by its feed, exactly as an OPML import does (section 16): the same
  summary, nothing fetched until the background checks, a channel already
  followed not added twice. A file that isn't one says "That file doesn't
  look like subscriptions.csv from Google Takeout."
- **Videos sit with everything else.** A video arrives in Unread like a post;
  its list row's meta line ends with a small screen-and-play mark (screen
  readers hear "Video"). A video counts as read once opened, the same rule as
  every article.
- **The video page** (section 7): under the byline, the grey Play box with
  the video's title set large in it (the reading face, semibold, the large
  size, centred, up to four lines; with large text the box grows taller
  rather than cut its words), then a round Play mark and **Play video**. Still nothing
  loads from YouTube until it's pressed (decision 0072). A Short's box stands
  up (9 : 16, at most 20rem wide); every other video's is 16 : 9.
- **Chapters you can press:** when the description lists at least two times,
  each at the start or end of a line and each later than the one before
  ("0:00 First light", "The heron – 4:00"), they're listed under the box as
  **Chapters**, each a 44px row with its time (underlined, in figures of one
  width) and name. Pressing one plays the video from there, or moves the
  playing video there. Each is named by what it shows ("4:00 The heron"), so
  voice control finds it.
- **A long description is folded:** when it has more than one paragraph and
  the rest add more than 280 characters, only its first paragraph shows,
  followed by **Show the full description**, which shows the rest and
  becomes **Show less** (a disclosure button: screen readers hear whether
  it's open).
- **Picking up where you stopped,** on any device: while a video plays,
  YouTube's player tells the page its time, which is kept every 15 seconds,
  on pause and on leaving the video (on the server for each reader, and on
  this device). Next time the box says **Resume from 4:00** (screen readers:
  "Resume from 4:00: {title}") and plays from there.
- **Your speed carries over** (decision 0156): a speed chosen in YouTube's
  own menu (say 1.5×) is what the next video plays at, on this device;
  choosing 1× goes back. nine turtles adds no control of its own. Captions
  need nothing: YouTube's player remembers whether you turned them on.
- **The video ends when it ends:** nothing plays by itself, and when a video
  finishes the player closes back to the still box, so YouTube's grid of
  other videos never shows, and the keyboard is back on the box; the next
  press starts it from the beginning.

**Never built** (decision 0144): YouTube's recommendations, trending or
search; view, like or subscriber counts; YouTube comments; downloading or
keeping videos; signing in with Google for Watch later or history; YouTube's
Data API.

**Known limits, said plainly where they show:** each YouTube feed holds only
a channel's latest 15 videos; the feeds carry no video length; when YouTube's
feeds fail for a while, nine turtles tries again as with any feed (feed
health says so). YouTube's own player remembers whether captions are on;
Safari may forget that if nine turtles goes unused for a while (decision
0156).

**How to check it**
1. In + Add, paste a YouTube video's address: it asks "This video is by
   … Follow …?" with the channel; Add follows the channel, named for it.
2. Paste a playlist's address: it offers all of the channel's videos (chosen)
   or only the playlist.
3. Open a channel's settings (Edit on its page): Include Shorts and Include live streams are
   there, both off. A new Short from that channel doesn't arrive in Unread.
4. In Google Takeout, export YouTube's subscriptions; in Settings › Your
   data, choose Import YouTube subscriptions… and pick `subscriptions.csv`:
   the channels appear, and their videos arrive over the next few minutes.
5. Open a video: the grey box shows its title and Play video, and its
   chapters (if any) are listed under it. Press a chapter: it plays from
   there. Watch a minute, open another article, come back: the box says
   Resume from …. Let a video end: the player closes back to the box.
6. A video with a long description shows its first paragraph and Show the
   full description.
7. Play a video, choose 1.5× in the player's settings, then open another
   video and press Play: it plays at 1.5×. Turn captions off in one video:
   the next one plays without them.
