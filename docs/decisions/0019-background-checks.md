# 0019: Background checks and Refresh

*23 October 2026, Milestone 8. Built from SPEC sections 11 and 13 without a separate plan (decision 0014).*

**Each feed's rhythm.** After every successful check, slowfeed looks at the
ten newest dated articles: the usual gap between them, or the time since the
newest if that's longer (a blog gone quiet). Half of that is the wait before
the next check, kept between 30 minutes and a day. A feed with no dates is
checked every four hours. This is simple, explainable and needs nothing
stored beyond one number per feed (`check_every`). Rejected: learning from
how many new articles each check found, which needs history and is harder to
reason about.

**Rounds, not timers.** One background task wakes every 30 seconds, picks
the feeds whose `next_check_at` has passed (at most 20, oldest-due first,
from the `feeds_due` index) and checks four at a time. Each wait is nudged
by up to a tenth at random, so feeds added together drift apart. After a
deploy, overdue feeds are worked through 20 at a time rather than all at
once. Each check first pushes its feed's next time 30 minutes ahead, so
even a check whose result can't be saved never makes slowfeed ask the
publisher again a few seconds later.

**Polite answers.** Every check sends the ETag and Last-Modified the
publisher gave last time; "304 Not Modified" costs them a few bytes. A 429,
or a 503 that says how long to wait, is obeyed (`Retry-After` as seconds or
as a date), up to a week, so a mistaken answer can't silence a feed for
good. Any failure doubles the wait from the feed's own rhythm, up to a day;
the first success resets it. A permanent redirect updates the stored
address, unless another followed feed already has it.

**Failing feeds, counted not named.** Each feed remembers how many checks
in a row failed, since when, since when it has been "not found" (404/410),
and a short word for the last problem (structure change 4, columns only, so
nothing stored can be lost; `tests/structure_changes.rs` tries it on a
filled copy). The diagnostics page shows counts only: followed, failing
now, failing for three days or more, and dead (not found for a week or
failing for three weeks). The daily check reports "Some feeds keep failing"
from these. The words are kept for the V2 feed health page.

**Edits are quiet.** An article already stored that the publisher edits
gets its new title, link, author, text and language; its place in the list,
its read mark and its star stay. An article a feed lists twice counts once,
as first listed, so checks never flip it back and forth.

**The screen asks; it's never pushed to.** The list loads with `latest`, the
newest article's number at that moment. Once a minute, while the tab is
visible, it asks `GET /api/articles/new?since=…` whether anything arrived for
this list; the answer is yes or no, never a number. That's one tiny query on
the primary key, so it costs nothing at any size (`tests/speed.rs`). The line
then says "New items · press r" ("tap Refresh" on touch screens) and the list
stays as it was. `r` or the Refresh button loads the first page and the
sidebar's counts again. Articles still listed keep their place in memory, so
the selected article and Undo carry on. Rejected: server-sent events or
WebSockets, which add moving parts for a message that can wait a minute.

**Writing safely alongside the reader.** A check's writes happen in one
"IMMEDIATE" transaction, which waits its turn to write instead of failing
half way when the reader's marks are saved at the same moment.

**Tests without waiting.** Server tests run rounds at made-up times
(`checking::round(state, now)`) against a made-up publisher. The browser
tests' slowfeed checks every two seconds (`SLOWFEED_TEST_CHECK_SECONDS`,
honored only together with `SLOWFEED_ALLOW_LOCAL_FEEDS`, so it can never
make the live app impolite) and moves the browser's clock on for the
once-a-minute question. tokio's `time` feature was switched on for the
pause between rounds; tokio itself was already approved.
