# 0144: YouTube as a first-class citizen

**In one line:** YouTube first-class: any YouTube link follows the maker; Shorts and live out by default with switches; import from Google Takeout; chapters and a folded description, no picture before Play; resume where you stopped; nothing at the end; videos in Unread, read once opened; on the website one of the places people publish; never recommendations, counts, comments, downloads or Google sign-in

*2 November 2026. Settled with the owner in the YouTube thread, after the
V1 list (decision 0140) named it a must. Built on 3 November 2026: how, and
the one change to item 2 (which of YouTube's lists sorts out Shorts), is in
decision 0149; what the reader sees is SPEC section 38.*

**Decision.** A YouTube channel is treated as a person who makes videos, not
as YouTube the platform. Everything uses only YouTube's own public feeds and
its own player: no YouTube account, no Google key, no reading YouTube's pages
beyond the one the reader pastes (decision 0016).

What gets built:

1. **Any YouTube link follows the maker.** A channel, @handle, video or
   playlist pasted into Add a feed. A video asks "This video is by {channel}.
   Follow {channel}?"; a playlist asks whether to follow the playlist or the
   whole channel. The feed is named for the channel, never "YouTube".
2. **Shorts and live streams are left out by default,** each with a switch on
   the feed's own screen ("Include Shorts", "Include live streams"). This uses
   the long-videos-only list YouTube keeps for each channel (a playlist id
   starting `UULF`), which is undocumented; if it stops working, nine turtles
   falls back to the channel's full feed and says on that screen that Shorts
   may appear for now. A Short that is shown plays in a tall 9 : 16 box.
3. **Bringing your YouTube subscriptions** from the subscriptions file Google
   Takeout gives anyone, through the existing import screen, preview and
   undo.
4. **A better video page.** The Play box stays as decision 0072 has it, with
   no picture: the owner chose the grey box with the video's title set large
   in it, so still nothing loads from YouTube before Play. Timestamps in the
   description become chapters you can press (they start or move the
   player). A long description shows its first paragraph and folds the rest
   behind "Show the full description".
5. **Picking up where you stopped.** While a video plays, YouTube's player
   tells the page its time; nine turtles keeps it per reader on the server
   and starts there next time ("Resume from 4:00"), on any device. The
   privacy-enhanced player isn't tied to the reader's YouTube account, so
   YouTube doesn't do this itself.
6. **The video ends when it ends.** No autoplay, and when a video finishes
   the player closes back to the still box, so YouTube's grid of other videos
   never shows (to be checked against YouTube's player rules before
   building).
7. **Speed and captions remembered,** only if a test in real browsers shows
   YouTube's player doesn't already remember them; otherwise dropped.

How videos fit in:

- **Videos sit with everything else.** No separate Watch place: a video
  arrives in Unread like a post, marked as a video, and a person's page shows
  their posts and videos together (people, decision 0140 and PLAN).
- **A video counts as read once opened,** the same rule as every article; it
  still resumes where you stopped.
- **On the website, YouTube is one of the places people publish,** named
  alongside blogs, newsletters and podcasts, never the headline ("YouTube
  without the algorithm" was rejected): nine turtles is a reader for the
  small web.

**Never built:** YouTube's recommendations, trending or search; view, like
or subscriber counts (the feed carries them; they're dropped); YouTube
comments; downloading or keeping videos (against YouTube's terms and the
publisher floor; an "Open in the YouTube app" link is the honest
alternative); signing in with Google for Watch Later or history; YouTube's
official programming access (the Data API), which would mean a Google key,
daily limits and Google's data rules.

**Known limits, said plainly where they show:** each YouTube feed holds only
a channel's latest 15 videos; the feeds carry no video length; YouTube's
feeds were reported failing for hours at a time in 2026, which nine turtles
handles as any flaky feed (it tries again, feed health says so).
