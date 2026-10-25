# 0075: An automatic health check, run by GitHub

*25 October 2026. At the owner's request, the second step of making nine
turtles ready for 100 to 200 readers (agreed with the owner that day).*

**Decision.** A scheduled GitHub Actions job
(`.github/workflows/health-check.yml`) runs `scripts/health-check.sh` every
15 minutes. The script asks the public status page; if it doesn't answer
"nine turtles is running" after 5 tries a minute apart, the run fails and
GitHub emails the owner. How it works and what to do:
`docs/operations/health-check.md`.

**Why.** The owner wants as few outside services as possible, the free tier,
and no lock-in. GitHub Actions is already used for the checks, costs nothing
for a public repository, and already emails about failed runs, so no
monitoring company, account or key is needed. The once-a-day check
(`daily-check.md`) could leave the app down for most of a day unnoticed;
this narrows that to about 15 minutes.

**Choices made along the way:**

- **Five tries, a minute apart.** Render restarts the app for about a minute
  on each deploy (a service with a disk can't overlap versions). Waiting
  through that means an email is always a real problem (fail visibly, but
  calm).
- **Only the public status page.** No diagnostics key in GitHub, so nothing
  secret is stored there; the daily check keeps the deeper look.
- **The logic lives in a script,** not in the workflow, so any other scheduler
  can run it (no lock-in).
- **An email per failed run while it's down,** rather than keeping state to
  send only one. Simpler, and it stops by itself when the app is back; the
  owner can pause the job meanwhile.
- **Considered and left out:** an outside uptime service (another account,
  another company), and the app checking itself (it can't report being down).
