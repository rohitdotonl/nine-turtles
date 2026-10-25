#!/usr/bin/env bash
# Runs every automatic check nine turtles has. GitHub Actions only calls this
# script, so any other CI service, an agent or a person runs exactly the same
# checks. What each check means: docs/operations/checks.md.
#
# With no arguments it runs everything, in order. GitHub Actions runs the
# parts side by side on separate computers to save time (decision 0064):
#   scripts/check.sh frontend   libraries, frontend build, types, tests, motion, size
#   scripts/check.sh rust       Rust formatting, lint and tests
#   scripts/check.sh browser    the release program, then the browser tests
# NINE_TURTLES_SHARD=1/2 runs only the first half of the browser tests.
#
# Needs: Rust (the version in rust-toolchain.toml), Node 22.12 or newer, and
# Chromium for Playwright (`npx playwright install chromium` in web/, or point
# NINE_TURTLES_CHROMIUM at a Chromium you already have).

set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n==> %s\n' "$1"; }

parts=("$@")
if [ ${#parts[@]} -eq 0 ]; then parts=(frontend rust browser); fi

build_frontend() {
  step "Frontend: install the exact library versions in the lock file"
  (cd web && npm ci --no-audit --no-fund)

  step "Frontend: build"
  (cd web && npm run build)
}

frontend() {
  step "Libraries are on the approved list"
  node scripts/check-libraries.mjs

  build_frontend

  step "Frontend: type check"
  (cd web && npm run check)

  step "Frontend: tests"
  (cd web && npm test)

  step "No motion"
  node scripts/check-motion.mjs

  step "Download size budget"
  node scripts/check-size.mjs
}

rust() {
  # The server serves web/dist, so the frontend must be built first.
  if [ ! -f web/dist/index.html ]; then build_frontend; fi

  step "Rust: formatting"
  (cd server && cargo fmt --check)

  step "Rust: lint (clippy)"
  (cd server && cargo clippy --locked --all-targets -- -D warnings)

  step "Rust: tests (including Hindi search)"
  (cd server && cargo test --locked)
}

browser() {
  # The release program packs web/dist inside it, so build the frontend first.
  if [ ! -f web/dist/index.html ]; then build_frontend; fi

  step "Build the nine turtles program"
  (cd server && cargo build --locked --release)

  step "Accessibility, contrast and screenshots, in a real browser"
  if [ -n "${NINE_TURTLES_SHARD:-}" ]; then
    (cd web && npx playwright test --shard="$NINE_TURTLES_SHARD")
  else
    (cd web && npx playwright test)
  fi
}

for part in "${parts[@]}"; do
  case "$part" in
    frontend | rust | browser) "$part" ;;
    *)
      echo "Unknown part \"$part\". Use frontend, rust or browser (or nothing, for all)." >&2
      exit 2
      ;;
  esac
done

printf '\nAll checks passed.\n'
