# Settings

nine turtles reads its settings from **environment variables**: named values the
host (Render) gives the program when it starts. They're never in the code or
in GitHub, so secrets stay with the host. This page lists their **names and
meanings only, never values.**

To change one on Render: open the service → **Environment** → edit → **Save
Changes**. Render restarts nine turtles with the new value (about a minute).

| Name | What it's for | Needed? | If it's missing |
|---|---|---|---|
| `NINE_TURTLES_PASSWORD_HASH` | The scrambled form of your password: the line `nine-turtles set-password` prints (it starts with `$argon2id$`). Secret. Once you've set a password with an emailed link, that one works instead, until you put a new line here: then this wins again and your devices are signed out, your way back in without email ([owner-password.md](owner-password.md)). | Yes | nine turtles runs but refuses every sign-in, saying no password is set. |
| `NINE_TURTLES_DIAGNOSTICS_KEY` | The read-only key for the diagnostics page, used by the daily check. Any long random text; Render's **Generate** button makes one. Secret. | Yes, for the daily check | The diagnostics page is switched off. |
| `NINE_TURTLES_OWNER_REPORT_KEY` | The key for the owner report, which only the owner's private manual holds ([owner-report.md](owner-report.md), decision 0130). At least 32 characters; Render's **Generate** button makes one. Secret. | Only for the owner's manual | The owner report is switched off: `/owner-report` answers "not found". Shorter than 32 characters stops nine turtles with a message saying so. |
| `NINE_TURTLES_DATA_DIR` | The folder holding the database file (`nine-turtles.sqlite`). | Set by the container image to `/data`, where Render's disk is attached | `data` beside wherever nine turtles was started. |
| `NINE_TURTLES_ALLOW_LOCAL_FEEDS` | Tests only: `yes` lets nine turtles fetch feeds from its own computer, so the browser tests can serve made-up feeds. **Never set it on Render**: it would let a pasted address reach private parts of the host. | No | nine turtles fetches only public internet addresses (the safe default). |
| `NINE_TURTLES_TEST_CHECK_SECONDS` | Tests only: checks every feed this many seconds apart, ignoring each feed's rhythm and the 30-minute minimum, so a browser test can watch new articles arrive. Ignored unless `NINE_TURTLES_ALLOW_LOCAL_FEEDS` is `yes` too. **Never set it on Render.** | No | Each feed is checked on its own rhythm, between every 30 minutes and once a day. |
| `NINE_TURTLES_PUBLIC_URL` | The address the world reaches nine turtles at. WebSub hubs deliver new articles there (SPEC section 12). Passkeys belong to it too (decision 0109): they work only at this exact address, so at `slowfeed.onrender.com` the sign-in page and Settings don't offer them; and if it ever changes to another name, passkeys made before stop working (passwords don't). A numeric address (such as `http://127.0.0.1:8080`) can't hold passkeys, so they're off. Not secret. | Set by the container image to `https://app.nineturtles.app` | nine turtles doesn't sign up with WebSub hubs; every feed is checked on its own rhythm as before. Passkeys belong to `localhost` on any port, for trying nine turtles out on your own computer at `http://localhost:8080`. |
| `NINE_TURTLES_BACKUP_ENDPOINT` | The address of the S3-compatible storage that holds backups, such as `https://<account id>.r2.cloudflarestorage.com` ([backups.md](backups.md)). Must start `https://` (plain `http://` only to `localhost`). Not secret, but private. | Yes, for backups | Backups are off (said in the log and on the diagnostics page). Set all four of endpoint, bucket, key id and secret, or none: some but not all stops nine turtles with a message naming the missing ones. |
| `NINE_TURTLES_BACKUP_BUCKET` | The bucket (named folder) in that storage, such as `nine-turtles-backups`. | Yes, for backups | As above. |
| `NINE_TURTLES_BACKUP_KEY_ID` | The storage key's id (Cloudflare calls it Access Key ID). | Yes, for backups | As above. |
| `NINE_TURTLES_BACKUP_SECRET` | The storage key's secret (Secret Access Key). Secret. | Yes, for backups | As above. |
| `NINE_TURTLES_BACKUP_REGION` | The storage's region name. `auto` for Cloudflare R2. | No | `auto`. |
| `NINE_TURTLES_RESTORE_FROM` | The name of a stored backup to bring back, such as `nightly/2026-10-25.sqlite`. Used only when nine turtles starts with **no database** (a new host, or one moved aside); it never overwrites one. Remove it once restored ([backups.md](backups.md)). | Only when restoring | Nothing is restored. |
| `NINE_TURTLES_SMTP_HOST` | The email service's SMTP server, such as `smtp-relay.brevo.com` ([email.md](email.md), decision 0088). Not secret. | Yes, for email | No email is sent: no password, sign-in or changed-address links, and no "Forgot your password?". Sign-up works without email (decision 0115). Set all four of host, username, password and sender, or none: some but not all (or the port alone) stops nine turtles with a message naming the missing ones. Links in emails start with `NINE_TURTLES_PUBLIC_URL`; with the email settings but without it, nine turtles doesn't start, and says so. |
| `NINE_TURTLES_SMTP_PORT` | The SMTP port. `587` upgrades to encryption (STARTTLS) before the password is sent; `465` is encrypted from the start. | No | `587`. Set on its own, without the other four, it stops nine turtles with a message naming them. |
| `NINE_TURTLES_SMTP_USERNAME` | The SMTP login (Brevo: the address ending in `@smtp-brevo.com`). Not secret, but private. | Yes, for email | As for the host. |
| `NINE_TURTLES_SMTP_PASSWORD` | The SMTP key or password (Brevo: the SMTP key). Secret. | Yes, for email | As for the host. |
| `NINE_TURTLES_SMTP_FROM` | Who emails come from: an address, with or without a name, such as `nine turtles <hello@nineturtles.app>`. | Yes, for email | As for the host. Something that isn't an address stops nine turtles with a message. |
| `NINE_TURTLES_NEWSLETTER_SECRET` | The shared secret the newsletter forwarder at Cloudflare posts emails with ([newsletters.md](newsletters.md)). At least 32 characters; Render's **Generate** button makes one. The same value goes in the forwarder's `NINE_TURTLES_SECRET`. Secret. | Only for newsletters | Newsletters are off: `/newsletters/incoming` answers "not found". Shorter than 32 characters stops nine turtles with a message saying so. |
| `NINE_TURTLES_NEWSLETTER_DOMAIN` | The domain shown after the @ in readers' newsletter addresses, for a nine turtles at another domain. Not secret. | No | `in.nineturtles.app`. |
| `NINE_TURTLES_DODO_API_KEY` | Dodo Payments' API key, made in Dodo's dashboard ([payments.md](payments.md), decision 0094). A test-mode key until Dodo approves live payments. Secret. | Only for payments | Payments are off: nobody pays, nothing is limited, Settings shows no plan and `/payments/dodo` answers "not found". Set all three of key, webhook secret and monthly product, or none: some but not all stops nine turtles with a message naming the missing ones. With them but without `NINE_TURTLES_PUBLIC_URL`, nine turtles doesn't start, and says so. |
| `NINE_TURTLES_DODO_WEBHOOK_SECRET` | The signing secret of the webhook pointed at `https://app.nineturtles.app/payments/dodo`, starting `whsec_`. Secret. | Only for payments | As for the key. Anything not starting `whsec_` stops nine turtles with a message. |
| `NINE_TURTLES_DODO_MONTHLY_PRODUCT` | The monthly plan's product id in Dodo, starting `pdt_`. Not secret. | Only for payments | As for the key. |
| `NINE_TURTLES_DODO_YEARLY_PRODUCT` | The yearly plan's product id, starting `pdt_`. Not secret. | No | Only the monthly plan is offered. |
| `NINE_TURTLES_DODO_MODE` | `test` or `live`. Set `live` only once Dodo has approved the live site and the three settings above are the live ones. | No | `test`: Dodo's test mode, no real money. Anything else stops nine turtles with a message. |
| `NINE_TURTLES_PRICE_MONTHLY` | The monthly price as Settings › Your plan shows it, such as `$5 a month`. It must match the product's price in Dodo. | No | "Price to be decided". |
| `NINE_TURTLES_PRICE_YEARLY` | The same for the yearly plan, such as `$50 a year`. | No | "Price to be decided". |
| `NINE_TURTLES_TRIAL_DAYS` | How many days a new reader's free trial lasts, 0 to 365. | No | 14. |
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
