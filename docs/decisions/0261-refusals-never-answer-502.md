# 0261: Refusals never answer 502

**In one line:** A refusal that carries words for the reader (another site couldn't be reached, wasn't found, was too big or its guard turned nine turtles away; Dodo couldn't be reached) answers 422 with `{"error": word}` instead of 502, because the host replaces a 502's body with its own page and the reader's words were lost.

*11 November 2026.*

**What happened.** Rohit added a feed address that doesn't exist on a new
account, and the app said "The feed couldn't be added. Try again in a
moment." instead of saying the address wasn't found. The same happened for
every YouTube channel. nine turtles sent the right word, but with status
502 ("bad gateway"), and in front of the live app the host answers a 502
with a page of its own. The web app found no word in it and fell back to
its general line, which also told the reader to try again when trying
again wouldn't help.

**What changed.** Adding a feed, the feed finder (the app's and the
website's), the blog checkup, "Find new address", Dodo being unreachable,
and deleting an account while Dodo can't be reached all answer 422 now.
The words and what the reader sees are the same; they now arrive.

**Why 422.** It's a 4xx, which hosts pass through untouched; it already
answered "no-feed" when adding, so the web app already reads it; and it
says "understood, but couldn't be done", which is what happened. 502, 503
and 504 stay reserved for nine turtles itself being out of reach (a
restart for a new version), which is what saving marks retries on
(decision 0073).
