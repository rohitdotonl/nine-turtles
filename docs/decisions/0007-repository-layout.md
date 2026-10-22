# 0007: `server/` and `web/`, with the frontend packed into the program

*October 2026, Milestone 1.*

**Decision.**
- `server/`: the Rust program. `src/lib.rs` builds the web application;
  `src/main.rs` only starts it, so tests use the same application.
- `web/`: the Svelte frontend. Vite builds it into `web/dist/`.
- `server/src/assets.rs` packs `web/dist/` into the program with rust-embed. In
  release builds the files are inside the program; in debug builds they're
  read from disk, so the frontend must be built first (`scripts/check.sh`
  does this).
- Any address that isn't a file gets the app's page, so the single-page app
  can have its own addresses. A missing file (an address ending in a name
  with a dot) gets a plain "not found".
- Files Vite names after their content (`assets/…`) may be kept by browsers
  forever; everything else is re-checked on each visit, so a new version is
  used the next time slowfeed is opened.
- Responses are compressed (tower-http).

**Why.** ENGINEERING.md → "Packaging": deploying is one program file plus one
SQLite file.

**Browser tests** run against the release program itself, not a development
server, so they test what will ship.
