# 0021: No second-agent review for documents-only changes and tiny fixes

*23 October 2026. Chosen by the owner.*

**Decision.** Pull requests that change only documents outside the rule
documents (not `DESIGN.md`, `SPEC.md`, `ENGINEERING.md`, `AGENTS.md` or the
review guide), or that make a tiny fix of about 10 lines of code outside
the risky areas (checks, screens, stored data, fetching, sign-in,
security), get no second-agent review. The automatic checks still run and
must pass, and the summary says why the change qualifies. Everything else
keeps the light or full review (decision 0015).

**Why.** V1 is for the owner alone, and the owner asked what slows V1
down. For these changes a review costs more than the mistakes it could
catch; the checks and the owner's own look remain.

**Kept as they were:** the ruleset protecting main, the automatic checks,
the brief before an agent merges, and the documents kept up to date with
each change.
