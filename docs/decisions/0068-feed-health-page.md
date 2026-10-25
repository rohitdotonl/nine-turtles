# 0068: The feed health page

*25 October 2026. Built in V2 from SPEC section 17, at the owner's request.*

**Decision.** Settings gets a **Feeds** group with one row, **Feed health ›**,
which opens a page of its own (`/settings/feed-health`). It lists only the
feeds that aren't working, in two groups: **Not working** (dead: a week of
"not found", or three weeks of any failure) and **Having trouble**, each
feed with what went wrong in plain words and Retry, Find new address and
Unsubscribe. The server (`server/src/health.rs`) sends a short problem word;
the screen (`web/src/lib/health.ts`) turns it into sentences.

**Choices made along the way** (the spec left them open):

- **Listed after two failures in a row,** not one. A single timeout is
  usually a blip that the next check clears; listing it would make the page
  twitchy (calm over engagement). Dead feeds come first, then the longest
  failing.
- **No status colors.** DESIGN.md left them "still to define". The groups'
  names say how bad things are, in words, and red stays reserved for
  "this removes something" (Unsubscribe). Nothing to check against the
  contrast floor, and nothing that relies on color.
- **Retry respects "slow down".** If the publisher asked nine turtles to
  wait (429, or 503 with a time) and the wait isn't over, Retry doesn't ask
  again; it says until when. Respecting the publisher is a floor.
- **Find new address** visits one page, once, because the owner asked
  (decision 0016): the site the feed names, or else the feed address's own
  home page. It lists the feeds that page names, leaving out the broken one
  and any already followed. **Use this address** moves the feed, keeping its
  name, folders, articles, read marks and stars; an address already followed
  is refused rather than merged, and so is one that belonged to a feed
  unsubscribed from earlier whose line stays for its starred articles
  (the page says to add it again with Add feed instead).
- **The keyboard never loses its place.** When an action replaces the
  button it was on, the keyboard moves to what took its place: the chosen
  feed after Find new address, Find new address after Cancel, Undo after
  Unsubscribe, Unsubscribe after Undo, Retry after a move.
- **Nothing moves while you look.** A feed that works again after Retry
  stays in its place, saying so, until the page is opened again. Unsubscribe
  happens in place too, with Undo on the same row.

No database change: the columns the page reads (`failures`, `failing_since`,
`missing_since`, `problem`) have been kept since Milestone 8 for this page.
