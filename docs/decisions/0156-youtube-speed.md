# 0156: A video plays at the speed last chosen; captions are left to YouTube

**In one line:** YouTube speed and captions: a test in real browsers showed YouTube's player remembers captions but not speed, so this device remembers the speed last chosen in a video and gives it to the next one; captions are left to YouTube

*3 November 2026. Decision 0144, item 7, said to remember a video's speed
and captions only if a test in real browsers showed YouTube's player doesn't
already; decision 0149 left it for that test. The owner said go ahead.*

**The test** (3 November 2026, on the owner's Mac): a page embedding
YouTube's privacy-enhanced player exactly as nine turtles does (same
address, sandbox and permissions, opened by a press), with a profile kept
between runs, in Chromium, Brave (Chrome's engine; Chrome itself wasn't
installed) and WebKit (Safari's engine). Speed set to 1.5× and captions
switched in the player's own menus, then a second video opened in a fresh
player, then the browser closed and opened again.

| | Next video | After a restart |
|---|---|---|
| Captions on or off | remembered in all three | remembered in all three |
| Speed | back to 1× in all three | back to 1× in all three |

YouTube keeps captions in the player's own storage
(`yt-player-caption-persistence`, and the language for about 30 days); its
speed is kept for one player only and cleared when the next one loads. A new
profile starts with captions on, so what it remembers is turning them off.

**Decision.**

- **Captions:** nothing to build. YouTube's player remembers them.
- **Speed:** this device remembers the speed last chosen in a video's
  player (in the browser's storage, `nine-turtles.video-speed`, kept apart
  from a podcast's speed, which has its own control and steps) and gives it
  to each video as it starts. The reader changes it only in YouTube's own
  menu; nine turtles adds no control. Choosing 1× again forgets it.
- How: the page already talks to the player by messages (decision 0149). It
  reads the speed from the player's news (`playbackRate`, and
  `onPlaybackRateChange`, which it asks for) and sends `setPlaybackRate`.
  Until the player reports the device's speed, the 1× it starts at is not
  taken as the reader's choice; an advert first gets the speed given again
  once the video plays.

**Known limit:** WebKit isn't Safari itself. Safari's tracking protection
may clear YouTube's own stored captions choice when nine turtles goes unused
for a while; the speed, kept by nine turtles, isn't affected.
