# 0100: Reading offline, words only

*October 2026.*

**Decision.** The owner asked for "the lighter version of offline reading on
all devices" on 26 October 2026, with at most 200 unread and 200 starred
articles. nine turtles now keeps those on each device, words only, and lets
the reader read, mark and star them without a connection (SPEC section 30).

- **What's kept:** the reader's first 200 unread articles in their own sort
  order (in river mode, the first 200 of All) and their newest 200 starred
  ones, each once. Only the words: the server sends each image as a short
  note, "An image shows here when you're back online" (`feed::text_only`),
  so the copies stay at a few megabytes and nothing more is fetched from
  publishers. A YouTube article's player waits too.
- **Where:** the browser's own database for the site (IndexedDB), in
  `web/src/lib/offline.ts`. No library: the browser's own API is small
  enough. The service worker still keeps only the app (and now its fonts,
  so kept articles keep their typeface); it never keeps API answers.
- **When it's brought up to date:** once the reader's settings are known on
  opening, when the connection comes back, when nine turtles comes back into
  view after ten minutes, and after Refresh (at most once a minute). Missing
  copies come 25 at a time from `GET /api/articles/several?ids=…` (at most 50
  per request), a quarter of a second apart, so neither the app nor the
  server feels it.
- **On by default,** on phones and computers alike, with a switch on each
  device: Settings › Your data › "Keep articles for reading offline".
  Switching it off deletes the copies at once.
- **Signing out deletes them,** and so does being signed out in any other
  way (an expired sign-in, a deleted account): whenever the app finds no one
  signed in, it deletes the database. This matters on a shared computer.
- **The latest mark wins.** A mark made without a connection waits on the
  device, then is sent saying when it was made. Each of a reader's entries now
  remembers when its read mark and its star were last set
  (`entries.read_marked_at`, `entries.starred_marked_at`, milliseconds,
  structure change 21), and a mark older than the stored one changes nothing.
  Marks from the app and from other apps (decision 0070) count as made when
  they arrive. Times are the server's: the app learns how far the device's
  clock is from the server's from each answer's Date header, and the server
  never accepts a time later than its own now, so a device whose clock runs
  fast can't make its marks outlast later ones. Muting, Catch me up, letting
  go and rules don't take part: they happen on the server, while online.
- **What waits for a connection** says so in plain words: search, adding a
  feed, Settings, Refresh and Catch me up.

**Why not more.** The owner chose the lighter version: no images, no whole
library offline, no offline search. Keeping images would cost hundreds of
megabytes on a phone, and fetching them up front would ask more of
publishers than reading does.

**The catch.** On an iPhone, Safari may clear a site's storage after about a
week without a visit unless nine turtles is added to the home screen; the
copies come back the next time it's opened online.
