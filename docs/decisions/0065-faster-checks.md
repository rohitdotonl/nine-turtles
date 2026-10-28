# 0065: Checks run side by side; documents-only changes skip them

> **Partly replaced:** [0114](0114-quicker-steadier-checks.md) runs the browser tests in four parts, not two; [0119](0119-docs-read-less.md) runs the link check on documents-only changes too.

*October 2026.*

**Decision.** GitHub Actions runs `scripts/check.sh` in parts at the same
time: `frontend`, `rust`, and `browser` in two halves (Playwright's
`--shard`). A last job, still called **All checks** (the one main
requires), passes only when every part passed. Pull requests that change
only documents skip the parts and the image build (`.github/code-changed.sh`).
Changelog entries go in `docs/changes/`, one file each, and are folded into
`docs/CHANGELOG.md` now and then.

**Why.** One run took about five minutes, one step after another: two
minutes of browser tests, a minute and a half of Rust tests, a minute of
setup. With several pull requests open at once, each one that merged
changed the top of the changelog, so the others clashed, had to be updated
and waited for the checks again. Side by side the wait is the slowest part
(about three minutes); separate files can't clash.

**Kept.** Every check still runs on every pull request that changes code,
and every part is still a plain script anyone can run (decision 0001). The
documents-only skip changes nothing a check enforces: no check reads
documents, except the library check, so `docs/libraries.md` counts as code.

**Revisit if** the browser tests grow past about two minutes per half (add
a third half), or a check starts reading other documents (count them as code
in `.github/code-changed.sh`).
