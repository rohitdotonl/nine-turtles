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
    reads that one page to find its channel, then asks **"Follow
    {channel}?"** over one row with no mark: the channel's name, its newest
    video's title and where it lives as a person says it ("youtube.com/@ted",
    from the video's page; "youtube.com" when the page doesn't say), never the
    feed's own address. **Follow** follows it from the copy just looked at, so
    YouTube isn't asked twice;
  - a playlist's address (`/playlist?list=…`, or a video played from one)
    asks **"This playlist is by {channel}. Follow only the playlist, or every
    video?"** with two rows, each with its newest title: **Only "{playlist}"**,
    chosen, since it's what was pasted, then **Every video** (decision 0213).
    A playlist that has no
    feed (a mix made for you, Watch later, a private one) follows the video's
    channel instead, when there's a video.
  The feed is named for the channel (or the playlist), never "YouTube".
  A channel or playlist starts as a **publication**, without guessing (its
  feed signs every video with the channel's name, which can't tell a vlogger
  from a company); "… is…" after Follow shows it chosen, and the reader can
  pick A person there or later on its page (section 36, decision 0213).
- **YouTube can be slow to answer nine turtles' server;** adding then gives
  up plainly rather than hanging (section 3). A channel whose feed holds a
  video with an empty description is followed as any other (decision 0213).
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
  look like a list of YouTube subscriptions."
- **Videos sit with everything else.** A video arrives in Unread like a post;
  its list row's meta line ends with a small screen-and-play mark (screen
  readers hear "Video"). A video counts as read once opened, the same rule as
  every article.
- **The video page** (section 7, decision 0324): under the byline, a box
  drawn in ink on the page with only a round Play mark and **Play video**
  (the title is the page's own, just above). Still nothing loads from
  YouTube until it's pressed (decision 0072). A Short's box stands
  up (9 : 16, at most 20rem wide); every other video's is 16 : 9 and, on a computer, as wide as a picture
  (up to 5rem past the text on each side). Pressed,
  the box fills charcoal at once (no fade), so the step to YouTube's dark
  player is dark to dark, and stays over the player until it has loaded, its words
  "Starting the video…" once that takes half a second, so the press shows it worked (decision 0230), and
  "Still starting… YouTube can be slow to answer." after five, its dots breathing (a slow wait, section 25, decision 0287).
- **Chapters and Description, folded** (decision 0324): under the box, two
  words, centred: **Chapters** with its count (when the description lists
  at least two times, each at the start or end of a line and each later
  than the one before, "0:00 First light", "The heron – 4:00") and
  **Description** (when there is one), each a 44px disclosure button with
  the folders' chevron; screen readers hear whether it's open. Both start
  closed. Pressing one opens it and closes the other; pressing it again
  closes it. This device remembers which was left open, so the next video
  opens the same way.
- **Chapters you can press:** a contents page in the reading face, one
  column, each a 44px row with its name and, at the end, its time (small,
  muted, in figures of one width with a plain zero); the name underlines
  under the pointer. Pressing one plays the video from there, or moves the
  playing video there. While it plays, the chapter playing is semibold.
  Each is named by what it shows ("The heron 4:00"), so voice control finds
  it.
- **The description,** while open, is the feed's text. A link whose words
  are only its own address shows just its site ("higgsfield.ai"), still
  going to the whole address; links named with words keep them.
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
health says so). YouTube's feeds often answer "not found" by mistake, so
nine turtles asks again, up to four times a second apart, before believing
it (decision 0159): following a channel such as @TED almost always works
the first time, and may take a few seconds. YouTube's own player
remembers whether captions are on; Safari may forget that if nine turtles
goes unused for a while (decision 0156).

**How to check it**
1. In + Add, paste a YouTube video's address: it asks "Follow …?" over one
   row with the channel's name, its newest video and "youtube.com/@…";
   Follow follows the channel, named for it, and "… is…" has A publication
   chosen.
2. Paste a playlist's address: it offers Only "…" (chosen) or Every video.
3. Open a channel's page: in its settings, Include Shorts and Include live streams are
   there, both off. A new Short from that channel doesn't arrive in Unread.
4. In Google Takeout, export YouTube's subscriptions; in Settings › Your
   data, choose Import YouTube subscriptions… and pick `subscriptions.csv`:
   the channels appear, and their videos arrive over the next few minutes.
5. Open a video: the ink-drawn box shows only Play video, with Chapters
   and Description closed under it. Open Chapters and press one: it plays
   from there, and that chapter turns semibold. Watch a minute, open another article, come back: the box says
   Resume from …. Let a video end: the player closes back to the box.
6. Open Description: Chapters closes, the description shows, and a long
   bare link reads as its site. Open another video: Description is open
   there too, until you close it.
7. Play a video, choose 1.5× in the player's settings, then open another
   video and press Play: it plays at 1.5×. Turn captions off in one video:
   the next one plays without them.
