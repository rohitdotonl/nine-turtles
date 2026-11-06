# 0196: A post with no title shows its opening once

*6 November 2026.*

**Decision.** In every article list, a post whose feed gives it no title
(a short note, as many personal sites send) shows its opening words where
the title would be, once: in the reading serif at the title's size, never
semibold (even while unread), wrapping to two lines and then "…". No line
of its text sits under it, except in search results when the searched
word comes only later in the post: then its line shows, so the row says
why it was found. A post with no
words at all still says "Untitled". The owner chose this on 6 November
2026 (SPEC section 6).

**Why.** "Untitled" told the reader nothing about the post, and a
cut-off sentence set in semibold looks like a headline the writer never
wrote. Regular weight keeps it honest ("honest by default"); the unread
dot still marks it unread, so the floor "never color alone" holds without
the bold. Showing it once (no line under it) keeps the row calm.

**How.** The server sends an untitled post's first 200 characters of
plain text as `opening`, worked out from its stored text as the list is
asked for (`feeds::untitled_body!` and `feeds::opening`). Nothing is
stored, so no database change. Only untitled rows read their text, so the
lists stay as fast as before. The single-article answer carries it too,
so a list of the copies kept for offline reading shows the same words.
"Pick up where you left off" still says "Untitled" for such a post: it
names the article inside a sentence, where two lines of opening would
not fit.
