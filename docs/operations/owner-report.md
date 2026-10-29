# The owner report

A hidden page that gives the owner's private manual real numbers about the
live app: counts and dates only, never who (decision 0130). Its code is
`server/src/owner_report.rs`.

## Switching it on (the owner, once)

1. Open the nine turtles service on Render → **Environment** → **Add
   Environment Variable**.
2. Name: `NINE_TURTLES_OWNER_REPORT_KEY`. For the value, press **Generate**
   (it makes a long random key), then copy it.
3. **Save Changes**. Render restarts nine turtles (about a minute).
4. Paste the same key where the manual's own setup steps say. Only the
   manual and Render hold it; it never goes in GitHub's nine turtles
   repository or to an agent.

To cut the manual off, delete the setting (the page then answers "not
found") or generate a new key and give it only to the manual.

## Checking it

`curl -sS -H "Authorization: Bearer <key>" https://app.nineturtles.app/owner-report`
answers JSON like the example below. Without the key, or with the wrong
one, it answers 401; without the setting, 404.

## What it gives

```json
{
  "version": "…",
  "generated_at": 1761782400,
  "started_at": 1761700000,
  "database_bytes": 52428800,
  "problems_since_start": 0,
  "backups": {
    "on": true,
    "kept": {
      "nightly": { "count": 30, "newest": "nightly/2026-10-29.sqlite", "bytes": 1500000000 },
      "monthly": { "count": 4, "newest": "monthly/2026-10.sqlite", "bytes": 200000000 },
      "before_change": { "count": 3, "newest": "before-change/2026-10-28T120000Z-before-change-28.sqlite", "bytes": 150000000 }
    }
  },
  "readers": { "total": 12, "joined_last_30_days": 3, "here_last_30_days": 9 },
  "feeds": { "followed": 340, "resting": 20, "failing": 4 },
  "articles": 51000,
  "payments": {
    "on": true,
    "live": false,
    "readers": { "free": 2, "trial": 3, "paid": 6, "on_hold": 0, "ended": 1 },
    "coming_up": [
      { "day": "2026-11-02", "what": "renews" },
      { "day": "2026-11-05", "what": "trial-ends" }
    ]
  }
}
```

- Times are seconds since 1970 (UTC); `day` is a UTC date.
- `backups.on` is false without the backup settings; `kept` is null if the
  storage couldn't be listed just then (the problem is logged).
- `coming_up` lists, sorted by day, each plan that renews (`renews`) or
  ends (`ends`: cancelled, or a renewal still failing) and each trial that
  ends (`trial-ends`) in the next 30 days. While payments are off, everyone
  is free and the list is empty.
- `here_last_30_days` can be up to a day behind: nine turtles notes that a
  reader was here at most once a day.

Anything more than counts and dates needs the owner's yes first (decision
0130).
