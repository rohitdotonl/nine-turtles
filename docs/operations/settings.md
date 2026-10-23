# Settings

slowfeed reads its settings from **environment variables**: named values the
host (Render) gives the program when it starts. They're never in the code or
in GitHub, so secrets stay with the host. This page lists their **names and
meanings only, never values.**

To change one on Render: open the service → **Environment** → edit → **Save
Changes**. Render restarts slowfeed with the new value (about a minute).

| Name | What it's for | Needed? | If it's missing |
|---|---|---|---|
| `SLOWFEED_PASSWORD_HASH` | The scrambled form of your password: the line `slowfeed set-password` prints (it starts with `$argon2id$`). Secret. | Yes | slowfeed runs but refuses every sign-in, saying no password is set. |
| `SLOWFEED_DIAGNOSTICS_KEY` | The read-only key for the diagnostics page, used by the daily check. Any long random text; Render's **Generate** button makes one. Secret. | Yes, for the daily check | The diagnostics page is switched off. |
| `SLOWFEED_DATA_DIR` | The folder holding the database file (`slowfeed.sqlite`). | Set by the container image to `/data`, where Render's disk is attached | `data` beside wherever slowfeed was started. |
| `SLOWFEED_ALLOW_LOCAL_FEEDS` | Tests only: `yes` lets slowfeed fetch feeds from its own computer, so the browser tests can serve made-up feeds. **Never set it on Render**: it would let a pasted address reach private parts of the host. | No | slowfeed fetches only public internet addresses (the safe default). |
| `SLOWFEED_LISTEN` | The address and port slowfeed listens on. | Set by the container image to `0.0.0.0:10000`, the port Render expects | `127.0.0.1:8080` (this computer only). |

## Built in, not settings

- **The version** shown on the status page and in Status comes from the build:
  the date and commit the container image was made from (for example
  `2026-10-23-3e4cb3e`). A build on a computer says `0.1.0-dev`.

## For the automatic deploy (GitHub, not slowfeed)

| Name | Where | What it's for |
|---|---|---|
| `RENDER_DEPLOY_HOOK_URL` | GitHub → the repository → Settings → Secrets and variables → Actions | Render's private "deploy hook" address. After each merge, GitHub calls it to tell Render to run the new version. Secret. |

## For the daily check (the agents' environment, not slowfeed)

| Name | What it's for |
|---|---|
| `SLOWFEED_ADDRESS` | slowfeed's public address, such as `https://slowfeed-xxxx.onrender.com` |
| `SLOWFEED_DIAGNOSTICS_KEY` | The same key as above, so the check can read the diagnostics page |

See [daily-check.md](daily-check.md).
