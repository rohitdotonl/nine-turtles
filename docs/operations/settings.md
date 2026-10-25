# Settings

nine turtles reads its settings from **environment variables**: named values the
host (Render) gives the program when it starts. They're never in the code or
in GitHub, so secrets stay with the host. This page lists their **names and
meanings only, never values.**

To change one on Render: open the service → **Environment** → edit → **Save
Changes**. Render restarts nine turtles with the new value (about a minute).

| Name | What it's for | Needed? | If it's missing |
|---|---|---|---|
| `NINE_TURTLES_PASSWORD_HASH` | The scrambled form of your password: the line `nine-turtles set-password` prints (it starts with `$argon2id$`). Secret. | Yes | nine turtles runs but refuses every sign-in, saying no password is set. |
| `NINE_TURTLES_DIAGNOSTICS_KEY` | The read-only key for the diagnostics page, used by the daily check. Any long random text; Render's **Generate** button makes one. Secret. | Yes, for the daily check | The diagnostics page is switched off. |
| `NINE_TURTLES_DATA_DIR` | The folder holding the database file (`nine-turtles.sqlite`; one called `slowfeed.sqlite` from before the rename is renamed on start). | Set by the container image to `/data`, where Render's disk is attached | `data` beside wherever nine turtles was started. |
| `NINE_TURTLES_ALLOW_LOCAL_FEEDS` | Tests only: `yes` lets nine turtles fetch feeds from its own computer, so the browser tests can serve made-up feeds. **Never set it on Render**: it would let a pasted address reach private parts of the host. | No | nine turtles fetches only public internet addresses (the safe default). |
| `NINE_TURTLES_TEST_CHECK_SECONDS` | Tests only: checks every feed this many seconds apart, ignoring each feed's rhythm and the 30-minute minimum, so a browser test can watch new articles arrive. Ignored unless `NINE_TURTLES_ALLOW_LOCAL_FEEDS` is `yes` too. **Never set it on Render.** | No | Each feed is checked on its own rhythm, between every 30 minutes and once a day. |
| `NINE_TURTLES_PUBLIC_URL` | The address the world reaches nine turtles at. WebSub hubs deliver new articles there (SPEC section 12). Not secret. | Set by the container image to `https://app.nineturtles.app` | nine turtles doesn't sign up with WebSub hubs; every feed is checked on its own rhythm as before. |
| `NINE_TURTLES_BACKUP_ENDPOINT` | The address of the S3-compatible storage that holds backups, such as `https://<account id>.r2.cloudflarestorage.com` ([backups.md](backups.md)). Not secret, but private. | Yes, for backups | Backups are off (said in the log and on the diagnostics page). Set all four of endpoint, bucket, key id and secret, or none: some but not all stops nine turtles with a message naming the missing ones. |
| `NINE_TURTLES_BACKUP_BUCKET` | The bucket (named folder) in that storage, such as `nine-turtles-backups`. | Yes, for backups | As above. |
| `NINE_TURTLES_BACKUP_KEY_ID` | The storage key's id (Cloudflare calls it Access Key ID). | Yes, for backups | As above. |
| `NINE_TURTLES_BACKUP_SECRET` | The storage key's secret (Secret Access Key). Secret. | Yes, for backups | As above. |
| `NINE_TURTLES_BACKUP_REGION` | The storage's region name. `auto` for Cloudflare R2. | No | `auto`. |
| `NINE_TURTLES_RESTORE_FROM` | The name of a stored backup to bring back, such as `nightly/2026-10-25.sqlite`. Used only when nine turtles starts with **no database** (a new host, or one moved aside); it never overwrites one. Remove it once restored ([backups.md](backups.md)). | Only when restoring | Nothing is restored. |
| `NINE_TURTLES_LISTEN` | The address and port nine turtles listens on. | Set by the container image to `0.0.0.0:10000`, the port Render expects | `127.0.0.1:8080` (this computer only). |

## Built in, not settings

- **The version** shown on the status page and in Status comes from the build:
  the date and commit the container image was made from (for example
  `2026-10-23-3e4cb3e`). A build on a computer says `0.1.0-dev`.

## For the automatic deploy (GitHub, not nine turtles)

| Name | Where | What it's for |
|---|---|---|
| `RENDER_DEPLOY_HOOK_URL` | GitHub → the repository → Settings → Secrets and variables → Actions | Render's private "deploy hook" address. After each merge, GitHub calls it to tell Render to run the new version. Secret. |

## For the daily check (the agents' environment, not nine turtles)

| Name | What it's for |
|---|---|
| `SLOWFEED_ADDRESS` | nine turtles' public address, `https://app.nineturtles.app` (or Render's own `https://slowfeed.onrender.com`) |
| `NINE_TURTLES_DIAGNOSTICS_KEY` | The same key as above, so the check can read the diagnostics page |

See [daily-check.md](daily-check.md).
