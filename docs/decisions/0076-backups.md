# 0076: Nightly backups to any S3-compatible storage, with no new library

*25 October 2026. At the owner's request, the first step of making nine
turtles ready for 100 to 200 readers. Replaces the "no backups" part of
decision 0012.*

**Decision.** nine turtles backs itself up (`docs/operations/backups.md`):

- **Nightly**, in the first hour after 03:00 UTC, it copies the database with
  SQLite's `VACUUM INTO` into the temporary folder (never the data disk),
  checks the copy (`PRAGMA integrity_check`, and that it holds the structure
  change history), and uploads it as `nightly/<date>.sqlite`. The month's
  first copy is also stored as `monthly/<year-month>.sqlite`.
- **Before every structure change**, the same, as
  `before-change/<time>-before-change-<n>.sqlite`. If backup storage is set
  and that copy fails, nothing changes and nine turtles stops with the reason.
- **Kept:** 30 nightly, 12 monthly, 10 before-change copies. Older ones are
  deleted after each successful copy.
- **Restoring:** `NINE_TURTLES_RESTORE_FROM=<name>` brings a copy back when
  nine turtles starts with no database (an empty file with no tables counts
  as none; a running nine turtles can leave one behind when its database is
  moved aside). It never overwrites one that holds anything.
- **Deleting old copies** that fails is reported, never counted as a failed
  backup: the new copy is already stored.
- **Plain `http://`** storage addresses are refused except to this computer
  (`localhost`), so the database never crosses the internet unencrypted.
- **Where:** any S3-compatible storage, through five settings
  (`NINE_TURTLES_BACKUP_ENDPOINT`, `_BUCKET`, `_REGION`, `_KEY_ID`, `_SECRET`).
  Cloudflare R2 to start with.
- **Visible:** failures go to the log and the diagnostics page, which also
  shows `backups.on` and `backups.latest_nightly`; a failed night is retried
  hourly, and a missed one is caught up at the next start.

**No new library.** The owner chose (25 October 2026) to write the small S3
part ourselves rather than add `object_store`: four requests (put, get,
list, delete) signed with AWS Signature Version 4, using reqwest (with its
`stream` feature, so a big file is uploaded without being held in memory)
and the already approved hmac and sha2. A test checks the signing against
Amazon's documented example, and it was tried against moto's S3 server,
which checks signatures. Fewer libraries to trust and update ("boring and
few"), and no storage company's code inside nine turtles ("no vendor
lock-in").

**Why R2 first.** 10 GB free, no charge for downloading (so restoring and
moving hosts cost nothing), and S3-compatible. Backblaze B2 is the
equal alternative if Cloudflare asks for a card the owner would rather not
give. Switching is a change of settings.

**Rejected.** `object_store` (large, many indirect libraries, for four
requests); a separate backup program such as Litestream (another moving
part on the host); relying on Render's disk snapshots (Render warns they may
not restore a database cleanly); copying only to the same disk (lost with
it).

**What it changes.** The floor's V1 wording from 0012 ends: data is backed up
before every structure change, and backups are kept outside the host. The
floor's older line "nothing deletes without a backup taken first" now reads
as: deletions are covered by the nightly copies (what existed at the last
copy), not by a copy before each deletion; unsubscribing stays as the owner
accepted it. The
yearly clean-up (SPEC section 23) can now be built, since it waits for a
successful nightly backup.
