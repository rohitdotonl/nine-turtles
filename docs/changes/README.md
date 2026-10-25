# Change notes waiting for the changelog

Each merged pull request adds **one new file here** with its entry for
[`docs/CHANGELOG.md`](../CHANGELOG.md), instead of editing the changelog
itself. Two pull requests then never edit the same lines, so they never
clash and never have to wait for the checks a second time (decision 0064).

- **Name:** the date and a few words, e.g. `2026-10-25-faster-checks.md`.
- **Inside:** exactly what would go at the top of the changelog: a
  `## 25 October 2026: What changed` heading and a few short, plain bullets
  for the owner.
- **Folding in:** now and then, any agent moves these entries to the top of
  `docs/CHANGELOG.md` (newest first) and deletes their files, in a
  documents-only pull request. Until then, the newest changes are here.
