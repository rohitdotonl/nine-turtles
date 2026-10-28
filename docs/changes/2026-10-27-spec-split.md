## 27 October 2026: The spec, one short file per feature

- `docs/SPEC.md` is now a short index. Each of its 35 sections is its own
  file in `docs/spec/`, numbered as before, so "SPEC section 28" still
  points to the right place. An agent reads only the sections its change
  touches instead of 920 lines.
- The out-of-date "Not in V1" list became "Not built yet, and never".
- Nothing in the app changed; no wording inside the sections changed.
