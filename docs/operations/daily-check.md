# The daily check

Once a day, an agent looks at the live nine turtles and reports problems to the
owner as a GitHub issue. These are the agent's instructions; any agent or
person can follow them. A fix is merged by the owner, or by an agent after
the owner's yes to its brief (decision 0009).

**Calm by design:** if everything is fine, the check does nothing. No
"all good" issues, no messages.

## What the check needs

Two environment variables in the agent's environment (never in the
repository): `SLOWFEED_ADDRESS` (for example `https://slowfeed-xxxx.onrender.com`)
and `SLOWFEED_DIAGNOSTICS_KEY`. If the address ends with `/`, drop it first
(`A="${SLOWFEED_ADDRESS%/}"` and use `$A` below): `//status` reaches the app's
front page instead of the status page. Network access to that address. Read access
to this repository, and permission to open issues and pull requests in it.

If a variable is missing or the address can't be reached because the
environment blocks it, report that to the owner in the agent's own channel
(not as an issue): it's a setup problem, not a nine turtles problem.

## Steps

1. **Is it running?**
   `curl -sS --max-time 60 "$A/status"`
   Expect `nine turtles is running` and a `version` line (a web page instead means the
   address has a trailing `/`; see above). Render's Starter plan
   doesn't sleep, so a slow or failed answer is a real problem. Try once more
   after two minutes before reporting.

2. **Read the diagnostics.**
   `curl -sS --max-time 60 -H "Authorization: Bearer $SLOWFEED_DIAGNOSTICS_KEY" "$A/diagnostics"`
   Never put the key in the address, an issue, a log or a pull request.

3. **Look for these problems:**

   | What you see | Problem | Report it as |
   |---|---|---|
   | Status or diagnostics don't answer | nine turtles is down | "nine turtles isn't answering" |
   | `password_setting` isn't `"set"` | Nobody can sign in | "Sign-in isn't possible: the password setting is missing or broken" |
   | `version` doesn't end with the short commit of the latest successful "Container image" run on main (allow 30 minutes after a merge) | The live app is behind | "The live app is running an older version" |
   | `recent_problems` has entries from the last 24 hours | Something went wrong | Quote the messages (they never contain secrets) |
   | `wrong_passwords_since_start` above 50 | Someone may be guessing the password | "Many wrong passwords" (sign-in slows guessers down; say so calmly) |
   | `database_bytes` above 700 MB | The 1 GB disk is filling up | "The database is getting close to the disk's size" |
   | `feeds.feeds_followed` has grown by 20 or more since the last "Database size" issue (or there's none yet and it's above 20) | The owner imported their feeds; Milestone 9 asks how big the database gets | "Database size": give `database_bytes` in MB and `feeds_followed`, once. The next week, comment once more with the new size, so the growth per week (and how many years the 1 GB disk lasts, every article kept) can be worked out. Not a problem; close it after that comment. |
   | `uptime_seconds` under one hour with no merge in the last hour | nine turtles restarted by itself | "nine turtles restarted unexpectedly" |
   | `feeds.feeds_failing_for_days` above 0 | Some feeds haven't worked for three days or more (`feeds_dead` of them for weeks) | "Some feeds keep failing". Give the counts; the page never says which feeds, and that's deliberate. Tell the owner they can find them by looking for feeds with nothing new, and unsubscribe from one with "Edit feed…" in its list's More (…) menu (the feed health page is V2). Comment again only when the counts change. |
   | `background_checks_last_round_at` is null, or more than 15 minutes before the time you read the page, with `uptime_seconds` over 15 minutes | Background checking has stopped, so no new articles arrive | "New articles have stopped arriving" |

4. **Report each problem once.** Search open issues with the label
   `daily-check` first. If one already covers it, add a short dated comment
   only if something changed. Otherwise open an issue:
   - **Title:** `Daily check: <the "report it as" wording>`
   - **Label:** `daily-check`
   - **Body, in plain language for the owner:** what's wrong, what it means
     for reading, what to do (or that an agent is preparing a fix), and the
     relevant diagnostics values (without the key).
   End with the attribution footer your tools require.

5. **Fix it when the cause is clear.** If the problem is in nine turtles' code
   and the fix is small and clear, open a pull request following AGENTS.md
   (if it's not small, say in the issue what you're about to change). Never
   touch Render: settings and redeploys are the owner's, so the issue says
   exactly which step of [render-setup.md](render-setup.md) to repeat.

6. **Close what's fixed.** If an open `daily-check` issue's problem is gone
   today, comment "Gone in today's check" and close it.

## How it's scheduled

Any scheduler that can start an agent once a day with this file as its
instructions works (AGENTS.md: no lock-in). Current setup: a scheduled Claude
Code routine, created once the owner has finished step 5 of
[render-setup.md](render-setup.md), running once a day in the owner's morning. It runs at 08:39 India time, each run in a fresh session (set up 23 October 2026). Its whole prompt is: "Follow docs/operations/daily-check.md in
rohitdotonl/slowfeed. It uses the SLOWFEED_ADDRESS and SLOWFEED_DIAGNOSTICS_KEY
environment variables (remove any trailing slash from SLOWFEED_ADDRESS before
adding /status or /diagnostics). Never print, post or commit the diagnostics
key. If everything is fine, do nothing and say so in one line."
