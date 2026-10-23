# 0017: Reading articles

*23 October 2026, Milestone 6. Built from SPEC section 7 without a separate plan (decision 0014).*

**Tracking images are removed by size.** Any `<img>` whose width or height
is set to 0 or 1 pixel, and neither is bigger, is taken out. It happens when
an article arrives, before the safety cleaning (so ammonia always works on
the final text), and again when an article stored before Milestone 6 is
shown. A list of known tracking companies was considered and left out: it
would need constant upkeep, and nearly every tracking image declares its
1×1 size.

**Images may come from anywhere.** The browser's Content Security Policy
now allows images from any `https:` or `http:` address, because DESIGN.md
says images load from the publisher. Everything else (scripts, styles,
fonts, connections, frames) is still slowfeed-only, and the page's
"no-referrer" rule means a publisher's server isn't told the reader uses
slowfeed.

**One article at its own address.** `GET /api/articles/{id}` returns the
article with its feed's name and website, the author, the cleaned content
or summary, and the language (the article's, or its feed's). A language
that isn't a plain tag like `en` or `en-gb` is left out rather than passed
on.

**The next article is fetched in advance.** When an article is selected,
the screen also fetches the one after it, and keeps the last 20 in memory,
so `j` and `k` show them without waiting. The browser test checks the next
article appears within a tenth of a second.

**Selecting is showing.** As DESIGN.md says, `j` / `k` or a click shows the
article in the reading area. `Enter` / `o` open it to read: the keyboard's
place moves into the article (and on a phone-narrow window the article
takes the list's place). Only the selected row is a Tab stop, so Tab goes
straight from the list to "Show older items"; the arrow keys move within
the list for people who don't use the vim keys.

**Links in articles open in a new tab,** like "Open original", so the
reader never loses their place in slowfeed. Footnotes are the exception:
the article's anchors are kept, renamed `article-…` so they can never
clash with slowfeed's own page, and a link to one scrolls there in place.

**Older articles** (stored during Milestone 5) lose their tracking images
when shown, after their cleaning. Removing an element from clean HTML can't
make it unsafe, so this is a documented exception to "ammonia has the last
word". Their footnote links still point to the publisher's page.

**The address doesn't change when an article opens** in V1. Reloading
returns to the list. Phone history for articles (Back closing an article)
comes with the phone work in Milestone 13.
