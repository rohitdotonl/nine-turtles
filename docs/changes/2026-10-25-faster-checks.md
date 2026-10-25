## 25 October 2026: Pull requests are ready to merge sooner

- The automatic checks now run in four parts at the same time, on separate
  computers, instead of one after another. A typical pull request is ready
  in about three minutes instead of five.
- A pull request that changes only documents skips the slow checks and the
  image build, and is ready in under a minute.
- Changelog entries are now written as small separate files in
  `docs/changes/`, so pull requests made at the same time no longer clash
  over the top of the changelog and have to run their checks again.
- Nothing in the app itself changed.
