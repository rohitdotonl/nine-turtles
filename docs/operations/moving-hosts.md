# Moving hosts

How to move nine turtles from Render to any other host, keeping everything:
your feeds, folders, articles, read marks, stars and settings. nine turtles is
one ready-to-run package (the container image) plus one database file, and
the nightly backup (`backups.md`) is a full copy of that file, so a move is:
start the same package somewhere else, and let it restore last night's copy.

**What you need:** backups switched on and working (`backups.md`), and a host
that can run a container image with a small disk (1 GB is plenty for now).
Almost every host can: Fly.io, Railway, a small virtual server at Hetzner or
DigitalOcean, or a computer at home.

## The steps

1. **Pick the moment.** Anything you read or star on the old host after its
   last backup isn't in the copy. For a clean move, do it in the morning
   after the night's backup and don't read on the old host in between. (Or
   take a fresh copy first: restart the old service after deleting today's
   `nightly/` file in the storage, and nine turtles copies again at once.)
2. **Create the service** on the new host from the image
   `ghcr.io/rohitdotonl/nine-turtles:latest`, with a disk mounted at `/data`.
3. **Copy every setting** from the old host (Render → Environment) to the new
   one: the password, the diagnostics key and the five backup settings
   (`settings.md` lists them all). The image already sets
   `NINE_TURTLES_DATA_DIR`, `NINE_TURTLES_LISTEN` and
   `NINE_TURTLES_PUBLIC_URL`; if the new host expects another port, set
   `NINE_TURTLES_LISTEN` to `0.0.0.0:<that port>`.
4. **Add** `NINE_TURTLES_RESTORE_FROM` with the name of the newest copy, such
   as `nightly/2026-10-25.sqlite`.
5. **Start it.** The log says `restored the database from …`. Open its
   address, sign in, and check your feeds, stars and unread counts.
6. **Remove** `NINE_TURTLES_RESTORE_FROM` from the new host's settings.
7. **Point the address** `app.nineturtles.app` at the new host
   (`website-and-domain.md` says where the domain's records live), and update
   the health check's and the daily check's address if they used Render's own
   address.
8. **Stop the old service** once the new one has run happily for a few days.
   Keep the backups: the storage is separate from both hosts.

Other apps (Reeder, NetNewsWire) keep working once the address points to the
new host; their app passwords are in the database, so they move too.

## If backups aren't working

Your feeds and folders can always leave as an OPML file, and your stars as a
JSON Feed file (Settings → Your data). Import both into the new nine turtles.
Read marks don't travel that way.

## Tested

On 25 October 2026 an agent ran this path end to end with a stand-in S3
service: a nine turtles with feeds was backed up, and a second nine turtles on
an empty disk, given the same settings and `NINE_TURTLES_RESTORE_FROM`,
started with every feed in place. `server/tests/backups.rs` repeats that on
every pull request.
