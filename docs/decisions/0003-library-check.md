# 0003: How the library check knows what's approved

*October 2026, Milestone 1.*

**Decision.** `scripts/check-libraries.mjs` reads the tables in
`docs/libraries.md`. A row counts as approved when its last column says
"Approved"; its first column is the library's name (a comma separates
several). Every library named in `server/Cargo.toml` and `web/package.json`
must appear there, or the check fails. GitHub Actions building blocks must
come from GitHub's own `actions/` collection and be pinned to a commit.

Libraries that *our* libraries use in turn ("indirect" ones) aren't checked
individually: they come with an approved library and are pinned by the lock
files.

**Why.** The owner decided (questions.md, Q4) that the human-readable list
is the source of truth, so approving a library and allowing it are the same
visible change in one pull request.

**Consequence.** Small helpers that many projects add without thinking
(Node's type descriptions `@types/node`, Rust's log printer
`tracing-subscriber`) still need the owner's yes. Where a few lines of our own
code do the job, we write them instead (for example, `web/playwright.config.ts`
describes the one Node feature it uses).
