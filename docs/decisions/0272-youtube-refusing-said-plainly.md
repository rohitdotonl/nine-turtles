# 0272: When YouTube won't send a channel, say so

**In one line:** When a YouTube feed fails with not found, no answer or a problem of YouTube's own, Everyone you follow says "YouTube isn't sending this channel's videos to nine turtles at the moment…" instead of "The site says the feed isn't there any more. It may have moved.", which was wrong for these channels.

*14 November 2026.*

**What happened.** Since late October, YouTube answers "not found" to the
live nine turtles for a growing number of channel feeds (6 of Rohit's 12 by
12 November, 8 by 14 November), while the same addresses load from anyone
else's computer. The channels haven't moved; YouTube is turning the server
away. "It may have moved" sent the reader looking for a new address that
doesn't exist.

**What was tried first.** Each channel also has an "uploads" playlist feed
(`playlist_id=UU…`), which YouTube served when it refused the channel feed.
We followed the uploads feed of all six refused channels for two days
before building anything. Within a day YouTube refused one of those too,
so reading the uploads feed instead would only have been a flaky fix, and
it wasn't built. A Google key or reading YouTube's pages stays out
(decision 0144).

**Decision.** Only the words change. A feed is YouTube's when its address
is `https://www.youtube.com/feeds/videos.xml?…` (a channel or a playlist).
When such a feed fails with not found, no answer or a 5xx, the reason says
YouTube isn't sending it at the moment, that nine turtles keeps asking, and,
honestly, that nothing more will come if the channel was taken down (YouTube
answers the same "not found" then, so nine turtles can't tell the two
apart). Guards, wrong addresses and other problems keep their own words.
Checking, backing off and "dead" are unchanged.
