# 0262: Refusals never answer 502

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
says "understood, but couldn't be done", which is what happened. Saving
marks still retries on 502, 503 and 504, taken as nine turtles itself
being out of reach for a restart (decision 0073).

**Not changed.** A few 503s still carry words: an installation without
email or sign-in set up (`no-email`, `off`, `password-missing`), an
assistant's site that didn't answer (`unreachable`, chosen in decision
0257) and too many assistants waiting to connect. Only the 502 body was
seen replaced by the host; whether it replaces a 503's too hasn't been
checked. A tab still on the old version just after a new one goes live
reads any 422 as "nine turtles was updated", so it may show that note as
well as the reason (`NOT_UNDERSTOOD`, as for "no-feed" before).
