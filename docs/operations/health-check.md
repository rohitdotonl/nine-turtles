# The health check

Not to be confused with Render's own "Health Check Path" (`render-setup.md`),
which Render uses only to know a new version started.

Every 15 minutes, GitHub asks the live nine turtles' status page
(`https://app.nineturtles.app/status`) whether it's running. If it doesn't
answer "nine turtles is running", GitHub tries again a minute later, five
times in all, so a deploy's minute of restarting never counts. If it still
doesn't answer, the run fails and **GitHub emails the owner**.

No outside monitoring service: it's a scheduled GitHub Actions job,
free because the repository is public (decision 0075).

**Calm by design:** while everything is fine, nothing happens and nothing
is sent.

## What runs

- `.github/workflows/health-check.yml`: the schedule (4, 19, 34 and 49
  minutes past each hour; GitHub sometimes starts a run a few minutes late).
- `scripts/health-check.sh`: the check itself. Anyone can run it the same way:
  `scripts/health-check.sh https://app.nineturtles.app`. It ends with
  "nine turtles is answering" and the version, or with "nine turtles isn't
  answering".

It looks only at the public status page: no key, no password, nothing secret.

## The email, and making sure it reaches the owner

GitHub emails about a failed scheduled run to the GitHub account that last
changed the schedule in `health-check.yml`: whoever merged that change. Agents
here merge with the owner's own GitHub account, so that's the owner; if a
different account ever merges a change to the schedule, the emails go to it
instead, so test once after any such change. To check it's switched on: on GitHub, your picture (top right) →
**Settings** → **Notifications** → **System** → **Actions**: "Email" ticked,
and "Only notify for failed workflows" ticked.

To test it: on GitHub, **Actions** → **Health check** → **Run workflow**. It
should go green within a minute. To see the email once, suspend the service
on Render for ten minutes, run the check by hand, and resume the service.

While nine turtles stays down, every run fails, so an email arrives about
every 15 minutes. That stops on its own the moment it answers again. To
silence it while you sort something out: **Actions** → **Health check** →
**⋯** → **Disable workflow**, and **Enable workflow** afterwards.

## When the email comes

1. Open `https://app.nineturtles.app/status` yourself. If it says "nine
   turtles is running", the problem was brief and is over.
2. If not, open the service on Render: its **Events** and **Logs** say whether
   it's deploying, restarting or stopped. A deploy that failed shows there too.
3. Ask an agent to look, with what Render says. Agents never touch Render; any
   change there is yours (`render-setup.md`).

The daily check (`daily-check.md`) still looks deeper once a day: sign-in,
version, background checking, disk size.

## Things to know

- **GitHub pauses scheduled jobs after 60 days without any change to the
  repository**, and emails beforehand. Any merge restarts the clock; to turn
  it back on, **Actions** → **Health check** → **Enable workflow**.
- It checks from GitHub's computers, so it also notices when the address
  itself (app.nineturtles.app) stops working.
- **Moving away from GitHub:** any scheduler that can run a command every
  15 minutes and email on failure can run `scripts/health-check.sh` (it exits
  with an error when nine turtles isn't answering).
