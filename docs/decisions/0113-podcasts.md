# 0113: Podcasts, played in place from the publisher's own file

*27 October 2026.*

**Decision.** A podcast's episodes play inside nine turtles, in a calm
player under the byline, with the reader's place kept on all their devices
and a short **Up Next**. The owner approved the design (items 1 to 8, SPEC
section 35). Until now DESIGN.md said nine turtles "is not a podcast
player: audio appears as a link to the original"; the owner changed that
line (Part 1) to "not a podcast app": no directory, downloads, charts or
listening stats.

1. **What an episode is.** An article whose feed item names an audio file:
   an RSS `enclosure`, an Atom link with `rel="enclosure"` or a JSON Feed
   `attachment`, whose type starts with `audio/` (or, with no type, whose
   address ends in .mp3, .m4a, .aac, .ogg or .opus). The first one wins.
   Only http and https addresses of at most 2,048 characters are kept, and
   nine turtles keeps only the address, the type, the size, the length
   (from the feed's own media details, or `itunes:duration`) and a picture
   (the episode's, else the podcast's logo). A JSON Feed attachment is
   never taken for the article's own link.
2. **The floor: respect the publisher.** The second floor said embedded
   media plays in the publisher's own player, and floors have no
   exceptions, so the owner reworded it (DESIGN.md Part 1 and AGENTS.md,
   27 October 2026): media plays in the publisher's player; **an audio file
   the feed names plays from the publisher's own address in a simple
   player**. Every play reaches the publisher's server (and its download
   counts), exactly as in a podcast app. nine turtles **never downloads,
   keeps, proxies or re-hosts the audio** (a test serves an audio file and
   checks it is never asked for), only its length is asked for until Play
   is pressed (`preload="metadata"`), the page's "no-referrer" rule
   applies, and the original stays credited and linked. The
   Content-Security-Policy gains `media-src 'self' https: http:` for this;
   the audio element is built by nine turtles from the stored address,
   never from article HTML, which the sanitizer still strips of `<audio>`
   and `<video>`.
3. **The player.** Back 15 seconds and forward 30 (as Apple's Podcasts
   does), one round Play / Pause in the text colour, the length, and the
   speed (1×, 1.25×, 1.5×, 2×, one press each, remembered on the device);
   a slider with the time played and the time left in tabular figures,
   which says its time in words to screen readers. All are real buttons or
   a real slider, 44px, never the accent, and nothing animates.
4. **No new keys.** Space keeps scrolling the article (section 19); the
   player's controls answer to the keyboard only when it is on them. A play
   key can come later if the owner wants one.
5. **One player for the whole app**, so an episode keeps playing while the
   reader reads other things. A **Now playing** bar takes its own room at
   the foot of the app (it never covers text), and on a phone sits above
   the article's toolbar. Its title button opens the episode.
6. **The place, kept per reader.** Saved about every 15 seconds while
   playing, on pause, on seeking and on leaving the page: on the device at
   once (localStorage, the latest 100 episodes) and on the server in
   `episode_progress` (structure change 24). Each save says when it was
   made on the server's clock (the same clock offline marks use, decision
   0101), and the latest wins, on the server and when the app chooses
   between the server's place and the device's. Within 30 seconds of the
   end an episode is **finished**, whether it played to the end or was
   paused or moved there: it's marked read and starts again from the
   beginning next time.
7. **Up Next**, per reader, in `up_next`: added and removed from the
   episode's More menu; moved and removed with Move up, Move down and
   Remove buttons in the episode's player, never by dragging. Removing one
   by hand offers a quiet Undo in its player, which puts it back where it
   was; the automatic removal when an episode starts has none (pressing
   Add to Up Next puts it back). The sidebar lists it after Recently read
   while it holds something, and Settings › Show in the sidebar can hide
   it (`hidden` gains `upnext`). When an episode ends, the first playable
   one in Up Next starts and leaves the list; playing an episode by hand
   also takes it off. Nothing moves by itself (principle 5): the sidebar's
   row stays until the reader next goes somewhere else, and an open Up Next
   list changes only for the reader's own Move, Remove and Undo, or Refresh.
   If the browser won't start the next one by itself, the line says "Next:
   … Press Play to start it." At most 200. The server keeps only the
   reader's own episodes, and Up Next leaves out feeds they've unsubscribed
   from everywhere (its list, its count and what plays next).
8. **The lock screen** gets the title, the podcast's name and the picture,
   and its play, pause, skip and seek buttons, through the Media Session
   API where the browser has it.
9. **Offline**, nothing about audio is kept: a kept episode shows its notes
   and "The episode plays here when you're back online.", and Up Next
   needs a connection.

**Walls.** Both tables point at the reader's own entry (`ON DELETE
CASCADE`), so unsubscribing, the yearly clean-up and deleting an account
take them with it. On the device, signing out (or finding nobody signed
in) stops and empties the player, forgets Up Next and deletes the places
kept in the browser, as offline copies are (decision 0101), so the next
reader on that browser never hears or resumes the last one's episode.
Both tables are in `PER_READER_TABLES`, and "Find new address" moves them
to the article's new copy. Tested in `server/tests/podcasts.rs`.

**Articles stored before this change** stay plain articles until their
feed next changes (usually its next episode): a feed that hasn't changed
answers "nothing new" (ETag / Last-Modified) and isn't read again.

**Not done (yet).** A play key, chapters, transcripts, video enclosures,
sleep timers and a podcast directory. Each would come back to the owner.
