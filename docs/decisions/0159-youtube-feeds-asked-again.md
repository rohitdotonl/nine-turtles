# 0159: YouTube's feeds are asked again before a "not found" stands

*3 November 2026. The owner asked why following YouTube's TED channel
failed ("Dig into the Ted problem").*

**What was found** (on the owner's Mac, 3 November 2026): YouTube's
channel and playlist feeds (`youtube.com/feeds/videos.xml`) answered about
half of all requests with Google's "404 Not Found" or "500 Server Error"
page, for every channel tried (TED 10 of 20 good, TED-Ed 9 of 20, TED's
long-videos list 1 of 5), whatever the user agent. The next ask a second
later often worked; when it did, the feed was normal (15 videos, valid
XML). TED's page named the right feed. So TED wasn't blocked: adding it
just landed on a bad answer, and TED-Ed happened not to.

**Decision.** A YouTube feed address alone is asked up to four times, a
second apart, while it answers 404 or a server error (5xx); any other
answer (the feed, "nothing new", "slow down", refused, too big, another
status) stands at once. It lives in `fetch::check`, so adding a channel,
the regular checks and the Shorts and live lists all get it. Four asks
make a wrong "not found" rare (about 1 in 16 at today's rate) and cost
YouTube at most three extra small requests. Other publishers are asked
once, as before: a 404 from them is usually true.

**Not done:** treating YouTube's 404 differently in feed health. With the
asks again, a failed check is rare; if one still fails, the usual backoff
and "dead after 7 days of 404" rules apply.
