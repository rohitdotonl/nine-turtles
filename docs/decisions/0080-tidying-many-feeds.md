# 0080: Tidying many feeds at once

*25 October 2026. Built in V2 at the owner's request ("Tidying many feeds
at once": an Edit mode to move or unsubscribe from several feeds with one
Undo, and a list of quiet feeds).*

**Decision.** Settings › Feeds gets a second row, **Your feeds ›**, opening
a page of its own (`/settings/feeds`) built like the feed health page. It
lists every feed with when it last posted and its folders; **Show** narrows
it to feeds quiet for 6 months or a year; **Edit** puts a tick box on each
row and a bar at the foot with **Unsubscribe** and **Move to…**. Each action
happens at once, with one Undo. The server's part is `server/src/tidy.rs`
(`/api/tidy/…`); the screen's is `web/src/lib/YourFeeds.svelte` and
`web/src/lib/tidy.ts`.

**Choices made along the way:**

- **A page in Settings, not ticks in the sidebar.** The sidebar is for
  reading and stays exactly as it is (nothing moves unless you move it); a
  feed in two folders appears twice there, which would make ticking
  confusing. Tidying is occasional, so it lives one step away, like feed
  health (power hidden, never missing).
- **Move, not add.** Move to… puts each feed in the one folder chosen and
  takes it out of any others, as moving a file does. Edit feed still lets a
  single feed be in several folders.
- **Quiet** is measured from the newest article's date (never later than it
  arrived), or from when the feed was added if it has never posted. No new
  data is stored: the date comes from the articles already there, so the
  database didn't change.
- **Undo for a move** is kept by the screen: it remembers each feed's
  folders before the move and sends them back. A folder made just for the
  move is deleted again. Undo for unsubscribing works as for one feed: the
  feeds are only hidden until your next unsubscribe, or ten minutes.
- **No confirmation step.** As everywhere in nine turtles, the action
  happens at once and Undo follows; the destructive red words and their
  tooltip say what Unsubscribe removes.
