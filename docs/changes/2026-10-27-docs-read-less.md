## 27 October 2026: A shorter plan, and a check for broken document links

- `docs/PLAN.md` now holds only open and next work, about 50 lines instead
  of 485. The finished milestones are kept, unchanged, in
  `docs/archive/plan-done.md`, with the October technical check beside them.
- A new quick check fails if any document links to a file that isn't
  there. It runs on every pull request, documents-only ones too.
- AGENTS.md now says each fact lives in one document, and others link to
  it (decision 0119).
- Nothing in the app changed.
