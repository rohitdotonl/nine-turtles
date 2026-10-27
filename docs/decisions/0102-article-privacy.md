# 0102: Article privacy and lazy pictures

*October 2026.*

**Decision.** Reading an article in nine turtles tells publishers and
trackers as little as possible, and its pictures load only as the reader
reaches them (SPEC sections 7 and 21). All of it happens in the server's feed
cleaner, `server/src/feed.rs`, before the safety cleaning, so ammonia still
has the last word.

- **Tracking tags come off links.** `utm_…` and a fixed list of well-known
  click-tracking names (`TRACKING`: `fbclid`, `gclid`, `msclkid`, `mc_cid`,
  `mc_eid`, `igshid`, `ref_src`, `_hsenc`, `mkt_tok` and a few more) are
  taken off the article's own link and off every link in its text. Unknown
  names always stay, and every other part of the query keeps its exact
  order and spelling (the raw query is filtered, not decoded and rebuilt),
  so a link that needs its other parts still works. Newsletters use the
  same function (`feed::without_tracking`) instead of their own copy.
- **The duplicate check doesn't change.** An article's fingerprint still
  comes from its link as the feed wrote it, and `normalize` keeps its own
  frozen list (`FINGERPRINT_TRACKING`): widening it would change the
  fingerprints and feed keys already stored, and the same article would
  arrive twice.
- **Pictures from known trackers go.** A short list kept by hand in the
  repository (`TRACKERS`: advertising, analytics and platform counters such
  as DoubleClick, Google Analytics, Facebook's pixel, `pixel.wp.com`,
  Mailchimp's open tracking and FeedBurner's `~r` images). A domain matches
  itself and everything under it; an entry with a path matches only that
  path, so the same site's real pictures stay (`i0.wp.com` is not listed).
  Pictures are the only things the cleaner keeps that load from elsewhere
  (frames, video and audio never pass the safety cleaning), so pictures are
  all it checks.
- **Pictures load lazily.** Every `<img>` gets `loading="lazy"` and
  `decoding="async"`, in the server, not the screen: by the time the screen
  could add them to HTML it inserts, the browser has already started
  loading every picture. ammonia only lets those two attributes through
  with those two values. Its own "set this attribute" was not used: it
  writes them in a different order each run, so every refetched article
  would look edited and be stored and indexed again. Copies kept for reading
  offline (SPEC section 32) still replace each picture with a note, so
  nothing changes there.
- **Relative addresses** were already made whole against the article's link,
  or the feed's address when it has none, including `//host/x.png` and
  `../x.png`. Tests now cover it; no gap was found.
- **Already confirmed, not changed:** the server sends
  `Referrer-Policy: no-referrer` and ammonia adds `rel="noopener noreferrer"`
  to links; YouTube plays from `youtube-nocookie.com` (decision 0072).

**Articles already stored: no one-off pass.** Rewriting stored articles
would touch every reader's data for a small gain, and isn't a structure
change, so the automatic backup before structure changes wouldn't cover it.
Instead:

- An article still in its feed is refreshed on the next fetch anyway: the
  stored row is updated when its link or content differ, as they now will.
- Every article is cleaned again when it's shown (`feeds::full_articles`,
  as invisible pixels already were since Milestone 5): tracker pictures go,
  pictures load lazily, links in the text and the article's own link lose
  their tags. List rows (`ArticleRow`) send their link without tags too, so
  `v` from the list matches. Nothing stored changes.
- Not covered for older articles: the sync API for other apps (SPEC section
  26) and the reader's downloads send stored content as it is.
