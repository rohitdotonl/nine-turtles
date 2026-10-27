# 0117: Documents agents can read less of, and trust

*October 2026.*

**Decision.** The documents are tidied so an agent reads only what's still
true and still needed, and every link in them leads somewhere.

- **One fact, one place.** Each fact lives in one document; others link to
  it instead of repeating it (AGENTS.md → "Keeping the docs true"). A
  repeated fact drifts: two copies end up saying different things.
- **An archive agents skip.** Finished milestones moved from `docs/PLAN.md`
  to `docs/archive/plan-done.md`, and finished one-off reports (the October
  technical check) to `docs/archive/`. `docs/PLAN.md` holds only open and
  next work. Agents read the archive only when the owner asks about past
  work. Nothing is deleted; the history stays.
- **A check for broken links between documents.**
  `scripts/check-doc-links.mjs`, run as `scripts/check.sh docs`, fails when
  a document links to a file that doesn't exist, either as a Markdown link
  or as a path in backticks (`docs/...`, `server/...` and the like). What a
  build makes (`web/dist`, `server/target`) and the marketing research and
  changelog are left out. It's quick, needs no library, and runs on every
  pull request, documents-only ones too, because those are the ones that
  move documents. It covers `docs/archive/` and `docs/changes/` too, so when
  a document moves, fixing its links there is the one edit those files get.

**Why.** The documents had grown to more than a megabyte; `PLAN.md` alone
was 485 lines, mostly finished work, and every agent read it first. Less to
read means cheaper, quicker sessions and fewer stale facts acted on.
