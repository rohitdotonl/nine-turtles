## 27 October 2026: Articles tell trackers less, and pictures load as you reach them

- Links lose their tracking tags (`utm_…`, `fbclid`, `gclid`, `mc_cid` and similar well-known ones): the article's own link, so Open original, Copy link and Share give the clean address, and the links in its text. Everything else in a link stays as the publisher wrote it.
- Pictures from known advertising, analytics and tracking services (Google Analytics, DoubleClick, Facebook's pixel, WordPress's and Mailchimp's counters, FeedBurner and a few more) are no longer shown or loaded. The list is short and kept in nine turtles itself.
- Pictures in an article load only as you scroll near them, so long articles with many pictures open faster.
- Articles still in their feed are refreshed on their next fetch (the original tagged link isn't kept); older ones are cleaned when shown. There was no one-off pass over stored articles (decision 0102).
