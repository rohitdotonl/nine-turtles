# Backups

nine turtles backs itself up (decision 0076). This page says what it does,
how to switch it on, how to check it's working, and how to bring a copy back.

## What happens, in plain words

- **Every night**, soon after 03:00 UTC, nine turtles makes a complete copy of
  its database and uploads it to **storage outside Render**. The copy is an
  ordinary SQLite file that any SQLite tool can open.
- **Before every change to the database's structure** (when a new version
  needs new tables or columns), it stores a copy first. If that copy can't be
  stored, the new version **doesn't change anything and stops**, saying why in
  the log; the old data stays exactly as it was.
- **What's kept:** the last 30 nightly copies, the first copy of each month for
  12 months, and the last 10 copies taken before a structure change. Older ones
  are deleted automatically, right after a new copy is stored.
- If the night's copy fails (for example the storage is unreachable), nine
  turtles tries again every hour and lists the problem on the diagnostics
  page, which the daily check reads. A missed night is caught up as soon as
  nine turtles runs again.
- The copy is made in the computer's temporary folder, never on Render's
  1 GB disk, so backups never need spare room there.
- At worst, you'd lose up to a day of reading activity (what you read or
  starred since the last copy). Feeds and their new articles come back by
  themselves at the next check.

**Where the copies go** is chosen only through settings. Any storage that
speaks **S3** (the common language of file storage) works: Cloudflare R2
(our choice, decision 0076), Backblaze B2, Amazon S3, Wasabi, MinIO on your
own computer, and many more. Switching is a matter of changing five settings.

| Folder in the storage | What's in it | Kept |
|---|---|---|
| `nightly/2026-10-25.sqlite` | The copy from that night | 30 |
| `monthly/2026-10.sqlite` | The first copy of that month | 12 |
| `before-change/2026-10-25T141725Z-before-change-8.sqlite` | The copy taken just before structure change 8 | 10 |

## Switching it on (the owner does this; agents never see the keys)

About 15 minutes. You'll create a storage "bucket" (a named folder in the
cloud) at Cloudflare, make a key that can only reach that bucket, and give
both to Render.

### 1. Make the bucket at Cloudflare

1. Sign in at **dash.cloudflare.com** (the same account as your domain is fine).
2. In the left menu choose **R2 Object Storage**. The first time, Cloudflare
   asks you to switch R2 on. It may ask for a card even though the free
   allowance (10 GB stored, which is far more than nine turtles needs) costs
   nothing. If you'd rather not give a card, use Backblaze B2 instead (see
   "Using another storage service" below); everything else is the same.
3. Click **Create bucket**. Name it `nine-turtles-backups`. Leave the location
   on **Automatic** and the storage class on **Standard**. Click **Create bucket**.
4. Don't make the bucket public. (It's private unless you switch that on.)

### 2. Make a key that can only reach that bucket

1. Back on the R2 overview page, find **API Tokens** (on the right, or under
   **Account details**) and click **Manage**.
2. Click **Create Account API token** (or **Create API token**).
3. Name it `nine turtles backups`.
4. **Permissions:** choose **Object Read & Write**.
5. **Specify bucket(s):** choose **Apply to specific buckets only** and pick
   `nine-turtles-backups`.
6. Leave the rest as it is and click **Create API Token**.
7. Cloudflare now shows the values **once**. Keep the page open for step 3:
   - **Access Key ID**
   - **Secret Access Key**
   - The **endpoint** for S3 clients, which looks like
     `https://<a long number>.r2.cloudflarestorage.com`

### 3. Give them to Render

1. Open your nine turtles service on **dashboard.render.com** → **Environment**.
2. Add these five, one by one (**Add Environment Variable**):

   | Name | Value |
   |---|---|
   | `NINE_TURTLES_BACKUP_ENDPOINT` | The endpoint, starting `https://` (without the bucket name at the end, if it shows one) |
   | `NINE_TURTLES_BACKUP_BUCKET` | `nine-turtles-backups` |
   | `NINE_TURTLES_BACKUP_KEY_ID` | The Access Key ID |
   | `NINE_TURTLES_BACKUP_SECRET` | The Secret Access Key |
   | `NINE_TURTLES_BACKUP_REGION` | `auto` (you can also leave this one out; `auto` is the default) |

3. Click **Save Changes**. Render restarts nine turtles (about a minute).
4. Because there's no copy yet, nine turtles makes the first one straight
   away. Within a few minutes, R2 → `nine-turtles-backups` shows a `nightly`
   and a `monthly` folder, each with one file.

You can close the Cloudflare page now. If the secret is ever lost or leaked,
delete the token in Cloudflare, make a new one, and paste the new values
into Render.

## Checking it's working

- **In Cloudflare:** R2 → `nine-turtles-backups` → `nightly/` should hold a
  file named after today or yesterday.
- **On the diagnostics page** (the daily check reads it): `backups.on` is
  `true`, and `backups.latest_nightly` names today's or yesterday's copy.
  Any failure appears under `recent_problems`.
- **In Render's Logs:** each night, `backed up the database as nightly/…`.

If backups aren't set up, nine turtles still runs, and says
`backups are off` in the log and on the diagnostics page.

## Bringing a copy back

nine turtles restores a copy when it starts on a disk **with no database**.
It never overwrites a database that holds anything (an empty file with no
tables at all counts as no database). You choose the copy with one
setting, `NINE_TURTLES_RESTORE_FROM`, set to the copy's name, such as
`nightly/2026-10-25.sqlite`.

nine turtles downloads the copy, checks it's whole and really a nine turtles
database, and only then puts it in place. If anything's wrong, it stops and
says why, and nothing is put in place.

### On a new host (or a new, empty disk)

See [moving-hosts.md](moving-hosts.md). In short: give the new host the same
settings plus `NINE_TURTLES_RESTORE_FROM`, start it, then remove
`NINE_TURTLES_RESTORE_FROM`.

### On Render, replacing the database that's there

Only when the data itself went wrong (for example a bad update). Tell an
agent first if you can; the steps:

1. Pick the copy in Cloudflare (R2 → the bucket → `nightly/`), and note its
   name, such as `nightly/2026-10-24.sqlite`.
2. Render → the service → **Shell**, and move the current database aside
   (kept, not deleted):

   ```
   cd /data && for f in nine-turtles.sqlite*; do mv "$f" "kept-$f"; done
   ```

3. Render → **Environment** → add `NINE_TURTLES_RESTORE_FROM` with the copy's
   name → **Save Changes**. Render restarts nine turtles; it finds no
   database, restores the copy, and starts. (The running nine turtles may
   have made a new, empty database file in the meantime; an empty one with
   nothing in it counts as no database, so the restore still happens.)
4. Check Render's **Logs** for `restored the database from nightly/2026-10-24.sqlite`,
   and sign in.
5. Remove `NINE_TURTLES_RESTORE_FROM` from Environment and save.
6. Once you're happy, the `kept-…` files can be deleted from the Shell
   (`rm /data/kept-nine-turtles.sqlite*`), or kept until the disk needs room.

### On your own computer (to look at a copy, or to test)

1. In Cloudflare, open the copy and click **Download**.
2. Put it in an empty folder named `data`, renamed to `nine-turtles.sqlite`.
3. Start nine turtles there (`docs/operations/building-and-running.md`) and
   sign in. Your feeds, read marks and stars are as they were that night.

## Using another storage service

Any S3-compatible service works with the same five settings:

| Service | `NINE_TURTLES_BACKUP_ENDPOINT` | `NINE_TURTLES_BACKUP_REGION` |
|---|---|---|
| Cloudflare R2 | `https://<account id>.r2.cloudflarestorage.com` | `auto` |
| Backblaze B2 (10 GB free) | `https://s3.<region>.backblazeb2.com`, shown on the bucket's page as "Endpoint" | the `<region>` part, such as `us-west-004` |
| Amazon S3 | `https://s3.<region>.amazonaws.com` | such as `eu-west-1` |
| MinIO on your own computer | such as `http://localhost:9000` | `us-east-1` |

For Backblaze B2: create a **private** bucket, then **Application Keys** →
**Add a New Application Key** limited to that bucket with read and write
access; its **keyID** and **applicationKey** are the key id and secret.

To move from one service to another, set up the new one, change the
settings in Render, and (if you want the old copies too) download them from
the old service and upload them to the same folders in the new one.

## For agents

- Code: `server/src/backup.rs` (when, what, keeping rules, restoring) and
  `server/src/storage.rs` (the S3 requests, signed with AWS Signature
  Version 4 using hmac and sha2; no storage library). Tests:
  `server/tests/backups.rs` (against a stand-in S3 service, including a
  restore onto a fresh disk) and the signature test in `storage.rs` (Amazon's
  documented example).
- Tested end to end on 25 October 2026 against moto's S3 server, which checks
  signatures like the real thing: nightly copy, monthly copy, a copy before a
  structure change, a refused wrong key, and a restore onto an empty disk.
- Never ask for or handle the keys. The owner puts them into Render.
