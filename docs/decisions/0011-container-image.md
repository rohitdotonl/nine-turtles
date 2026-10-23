# 0011: The container image and automatic deploys

*October 2026, Milestone 2.*

**The image.** The `Dockerfile` builds in three steps: the frontend (Node),
the program with the frontend packed inside (Rust, the exact version in
`rust-toolchain.toml`), and a small Debian system holding only the program at
`/usr/local/bin/slowfeed`, so `slowfeed set-password` works in Render's Shell.
It sets `SLOWFEED_LISTEN=0.0.0.0:10000` (Render's default port) and
`SLOWFEED_DATA_DIR=/data` (where the disk is attached). The version shown in
Status is the build date and commit, baked in at build time.

**Where it's built and stored.** `.github/workflows/image.yml` builds it on
every pull request (proving it still builds and starts) and, on main, pushes
it to GitHub's package storage (`ghcr.io/rohitdotonl/slowfeed`, public, free
for public repositories), tagged with its version and `latest`. Only plain
`docker` and `curl` commands are used, so no outside Actions building blocks
are needed (docs/decisions/0003-library-check.md).

**How Render learns of it.** After pushing, the workflow calls Render's
deploy hook (a secret address in `RENDER_DEPLOY_HOOK_URL`) naming the exact
image version. Merging is therefore deploying, and main can only change
through pull requests with passing checks. Without the secret, the workflow
skips this step with a notice.

**No lock-in.** Any host that runs container images can run the same image
with the same settings (docs/operations/settings.md). Moving is written up in
Milestone 3 (`docs/operations/moving-hosts.md`).

**Revisit if:** Render's deploy hooks change, or the image grows past a few
hundred MB.
