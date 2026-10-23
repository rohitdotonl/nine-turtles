# The automatic checks

Every pull request must pass all of these before it can be merged. They all
run from one script, `scripts/check.sh`, on GitHub Actions or anywhere else
(decision 0001). Run it before opening a pull request.

The script stops at the first failure and says which step failed.

| Step | What it catches | Where it lives |
|---|---|---|
| Libraries are on the approved list | A library in `server/Cargo.toml` (in any of the ways Rust allows listing one) or `web/package.json` that isn't approved in `docs/libraries.md`; a GitHub Actions building block that isn't GitHub's own or isn't pinned | `scripts/check-libraries.mjs` |
| Frontend: build | Frontend code that doesn't build | Vite |
| Frontend: type check | Mistakes in TypeScript and Svelte code | `svelte-check` |
| Frontend: tests | Broken frontend logic (layout, keys, addresses, reader settings); any theme color pair below the contrast floor, read straight from `app.css` | `web/src/**/*.test.ts` (Vitest) |
| No motion | Any animation or transition in the built styles; Svelte's or the browser's animation tools in the code; smooth scrolling | `scripts/check-motion.mjs` |
| Download size budget | More than 150 KB (compressed) of app code and styles, or more than 400 KB of fonts | `scripts/check-size.mjs` |
| Rust: formatting | Code not in the standard Rust layout. Fix with `cargo fmt` in `server/` | rustfmt |
| Rust: lint | Likely mistakes ("clippy"); every warning counts as a failure | clippy |
| Rust: tests | Broken server behavior: sign-in, the wait after wrong passwords, signing out, the browser security rules, the status and diagnostics pages, and the Hindi search test | `server/src/` and `server/tests/` |
| Build the program | The release program doesn't build | cargo |
| Accessibility, contrast and screenshots | Any WCAG A/AA problem (including color contrast) on any screen, in any chosen theme and when following the device's light or dark setting, at desktop or phone width; the theme or the wordmark's Literata font not applying, or a font coming from anywhere but slowfeed; sign-in, the layout, the sidebar toggle, the `?` list, the `g` keys or Settings not working with the keyboard alone, or anything overlapping at 200% zoom; the browser's security rules blocking anything. Also photographs every screen | `web/tests/` (Playwright with axe) |

## Adding a screen

Add it to `SCREENS` in `web/tests/screens.ts`. It's then automatically
checked for accessibility in all three themes and photographed for the pull
request. A screen that needs signing in sets `signedIn: true`; the tests sign
in through the sign-in page with a made-up password (`web/playwright.config.ts`).

## Outside the script

- **Container image:** `.github/workflows/image.yml` builds the image on every
  pull request and checks it starts and answers `/status`. On main it also
  stores it and deploys it (decision 0011). It needs Docker, so it isn't in
  `scripts/check.sh`; run `docker build .` to try it yourself.
- **Screenshots on the pull request:** posted by GitHub Actions after the
  checks (decision 0005).
- **Weekly security report:** `.github/workflows/security.yml` runs
  `cargo audit` and `npm audit` every Monday. If either finds a known problem,
  it opens (or adds to) an issue titled "Weekly security report: libraries
  need attention". It never changes anything. An agent proposes a fix; the
  owner approves it.
- **Second-agent review:** see [second-agent-review.md](second-agent-review.md).

## When a check fails

Fix the cause, never the check. Never skip, disable or weaken a check to get
green; changing what a check enforces needs the owner's approval, like any
other rule.
