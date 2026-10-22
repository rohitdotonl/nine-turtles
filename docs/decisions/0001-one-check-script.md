# 0001: Every check runs through one script

*October 2026, Milestone 1.*

**Decision.** All automatic checks live in `scripts/check.sh`. GitHub Actions
(`.github/workflows/checks.yml`) only prepares a computer and calls it. The
three checks we wrote ourselves (libraries, no motion, size budget) are small
Node scripts beside it that use only what comes with Node.

**Why.** ENGINEERING.md → "No vendor lock-in": any CI service, an agent or a
person must be able to run exactly the same checks. If checks lived in GitHub's
own settings, moving away from GitHub would mean rebuilding them.

**Revisit if** the script grows slow enough that checks need splitting across
several computers. Even then, each part should remain a script anyone can run.
