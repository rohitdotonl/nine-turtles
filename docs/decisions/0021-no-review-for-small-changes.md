# 0021: No second-agent review for documents-only changes and tiny fixes

*23 October 2026. Chosen by the owner. Partly replaces decision 0015, point 2.*

**Decision.** Pull requests that change only documents outside the rule
documents (not `DESIGN.md`, `SPEC.md`, `ENGINEERING.md`, `AGENTS.md`,
`libraries.md` or the review guide), or that make a tiny fix of about 10
lines of code (with its document updates) outside the risky areas (checks,
screens, stored data, fetching, sign-in, security), get no second-agent
review. A tiny fix inside a risky area still gets the full review. The automatic checks still run and
must pass, and the summary says why the change qualifies. Everything else
keeps the light or full review (decision 0015).

**Why.** V1 is for the owner alone, and the owner asked what slows V1
down. For these changes a review costs more than the mistakes it could
catch; the automatic checks and the brief before merging remain.

**Kept as they were:** the ruleset protecting main, the automatic checks,
the brief before an agent merges, and the documents kept up to date with
each change.
