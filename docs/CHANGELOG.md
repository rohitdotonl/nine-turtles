# What's changed

A plain-language history of slowfeed, newest first. One short entry per
merged pull request, written for the owner: what changed and what it means,
not how it was done.

## 23 October 2026: Live on Render, with sign-in (Milestone 2)

- slowfeed now has a password. A new browser sees only the password field;
  each device stays signed in for a year; Sign out ends that device only.
  After five wrong passwords, slowfeed makes you wait before trying again.
- You set the password with `slowfeed set-password` in Render's Shell tab.
  slowfeed only ever stores the scrambled form.
- Merging a pull request now puts it live by itself: GitHub builds slowfeed
  into a ready-to-run package and tells Render to run it.
- A public status page, and a key-protected diagnostics page for the daily
  health check an agent runs.
- New guides: setting up Render (`docs/operations/render-setup.md`), every
  setting (`settings.md`) and the daily check (`daily-check.md`).

## 22 October 2026: Skeleton and automatic checks (Milestone 1)

- slowfeed exists as a real program: for now, one quiet page with the
  wordmark and "Nothing here yet.", in all three themes.
- Every change is now checked automatically before it can be merged:
  formatting, likely mistakes, tests, accessibility and contrast, no motion,
  the download size budget, approved libraries only, and Hindi search. All
  checks run from one script, so they don't depend on GitHub.
- Each pull request shows screenshots of every screen. A weekly report flags
  known security problems in the libraries slowfeed uses.
- main is protected: only pull requests with passing checks can be merged.
- New: decision notes (`docs/decisions/`) and how-to guides (`docs/operations/`).

## 22 October 2026: Planning

- The design, engineering rules, V1 feature list (SPEC) and build plan are
  agreed. No app yet.
- Decided along the way: password scrambled with argon2; nightly backups
  built into slowfeed; agents watch the live app through a status page and
  a daily check; the repository stays public, under the MIT licence.
- Added a guide for the owner (`docs/owner-guide.md`), the approved
  libraries list, this change history, and a front page (README).
