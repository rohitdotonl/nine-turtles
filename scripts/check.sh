#!/usr/bin/env bash
# Runs every automatic check nine turtles has. GitHub Actions only calls this
# script, so any other CI service, an agent or a person runs exactly the same
# checks. What each check means: docs/operations/checks.md.
#
# Needs: Rust (the version in rust-toolchain.toml), Node 22.12 or newer, and
# Chromium for Playwright (`npx playwright install chromium` in web/, or point
# NINE_TURTLES_CHROMIUM at a Chromium you already have).

set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n==> %s\n' "$1"; }

step "Libraries are on the approved list"
node scripts/check-libraries.mjs

step "Frontend: install the exact library versions in the lock file"
(cd web && npm ci --no-audit --no-fund)

step "Frontend: build"
(cd web && npm run build)

step "Frontend: type check"
(cd web && npm run check)

step "Frontend: tests"
(cd web && npm test)

step "No motion"
node scripts/check-motion.mjs

step "Download size budget"
node scripts/check-size.mjs

step "Rust: formatting"
(cd server && cargo fmt --check)

step "Rust: lint (clippy)"
(cd server && cargo clippy --locked --all-targets -- -D warnings)

step "Rust: tests (including Hindi search)"
(cd server && cargo test --locked)

step "Build the nine turtles program"
(cd server && cargo build --locked --release)

step "Accessibility, contrast and screenshots, in a real browser"
(cd web && npx playwright test)

printf '\nAll checks passed.\n'
