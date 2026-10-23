# What's changed

A plain-language history of slowfeed, newest first. One short entry per
merged pull request, written for the owner: what changed and what it means,
not how it was done.

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
