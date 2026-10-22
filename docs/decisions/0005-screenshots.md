# 0005: Screenshots appear as a comment on each pull request

*October 2026, Milestone 1. Chosen by the owner.*

**Decision.** The browser tests photograph every screen listed in
`web/tests/screens.ts`, in all three themes, at desktop and phone width. On a
pull request, GitHub Actions saves the pictures on a separate branch called
`pr-screenshots` (never merged into main) and posts them in one comment on the
pull request, updated on every push. The script is
`.github/publish-screenshots.sh`.

**Why.** The owner doesn't read code; seeing the screens is how they review a
change. A comment shows the pictures right where they review, with nothing to
download.

**Things to know.**
- The pictures are public, like the whole repository, so screenshots only ever
  show made-up feeds and articles.
- Each pull request's older pictures are replaced, so the side branch stays small.
- Pull requests from other people's copies of the repository don't get the
  comment: they can't be given permission to write. The pictures are still
  downloadable from the checks page.
- The pictures are made by `scripts/check.sh` (into `web/screenshots/`), so any
  other CI service can show them its own way; only the posting is GitHub-specific.

**Alternative not chosen.** A zip file to download from the checks page.
