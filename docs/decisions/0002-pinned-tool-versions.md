# 0002: Exact versions of Rust, Node and GitHub's building blocks

*October 2026, Milestone 1.*

**Decision.**
- Rust is pinned in `rust-toolchain.toml` (1.99.1); `rustup` installs that
  exact version automatically.
- Node's major version for CI is in `.node-version` (24, the current
  long-term-support line); `web/package.json` accepts 22.12 or newer so the
  same checks run on a computer with an older long-term version.
- Libraries are pinned by the lock files (`server/Cargo.lock`,
  `web/package-lock.json`); the checks install exactly those (`npm ci`,
  `cargo --locked`).
- GitHub Actions building blocks are pinned to a full commit fingerprint, and
  the library check fails if one isn't.
- TypeScript is held at 6.0 (`~6.0.3`) until `svelte-check` supports 7.

**Why.** ENGINEERING.md → "Built to last ten years": updates happen on
purpose, not automatically, and the repository alone must be enough to
rebuild slowfeed.

**Revisit** at each tech check: updating any of these is a normal, deliberate
pull request.
