# nine turtles: where things stand

*Only open and next work lives here. Finished milestones, with links to
their SPEC sections and decisions, are in
[`archive/plan-done.md`](archive/plan-done.md), which agents skip unless the
owner asks about past work.*

## Done so far, in one paragraph

V1 (the reader for one person) is finished, and so is most of V2: many
readers in one app with sign-up open to anyone, river mode, WebSub, feed
health, backups, rules and mutes, collections, podcasts, newsletters as
feeds, AI assistants over MCP, passkeys, syncing with other apps, offline
reading, the website at nineturtles.app and payments in test mode. What
each feature does is in [`SPEC.md`](SPEC.md); why, in
[`decisions/`](decisions/README.md).

The bigger plan for 100 to 200 readers is the owner's SaaS milestones plan
(https://claude.ai/artifact/V3GhrBxfXDG1TjPMsXQFPk). Nothing new starts
until the owner says so.

**Status key:** ⬜ not started · 🔨 in progress · ✅ merged and live · ⏳ waiting for the owner

## Open and next

| Work | Status | Where it's described |
|---|---|---|
| Live payments, after Dodo approves the live site | ⏳ The owner applies once the site, price and legal pages are final | SPEC section 29, decision 0094, `docs/operations/dodo-application.md` |
| The open questions (privacy policy and terms, prices, trial) | ⏳ The owner's answers | [`planning/questions.md`](planning/questions.md) |

## Later: ideas the owner wants, not yet scheduled

Things the owner has said yes to in principle, to build some day. Nothing
here is planned yet; when one starts, it moves into the table above. (Other
"not now" lists: SPEC → "Not built yet, and never", and the research notes in
`docs/RnD/`, which are ideas only.)

- **"How did you hear about nine turtles?"** (30 October 2026, from the
  business plan, `docs/RnD/business-plan.md` sections 2 and 5): one
  optional question at sign-up (a blog, a friend, a search, an AI
  assistant, Reddit, other), counted together in the owner report, never
  per reader. Needs a SPEC section before it's built.
- **A browser extension** for adding feeds while browsing (27 October 2026,
  from the reader comparison). Until then, the bookmark in Settings › Add
  from anywhere does the same job on computers.

## How every piece of work ends

Responsive layout, accessibility and speed aren't left to the end: each
change must pass the automatic checks for them, every feature comes with
keyboard-only tests, and each change to a screen gets a short checklist the
owner can follow. Once merged, the finished work moves to the archive.
