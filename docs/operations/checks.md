# The automatic checks

Every pull request must pass all of these before it can be merged. They all
run from one script, `scripts/check.sh`, on GitHub Actions or anywhere else
(decision 0001). Run it before opening a pull request.

The script stops at the first failure and says which step failed.

## Side by side, and skipped for documents

On GitHub the script runs in four parts at once, each on its own computer
(decision 0064): `scripts/check.sh frontend` (the first six steps below),
`scripts/check.sh rust` (formatting, lint, tests), and `scripts/check.sh
browser` (builds the frontend and the release program, then runs the browser
tests) twice, each with half of the browser tests (`NINE_TURTLES_SHARD=1/2` and
`2/2`). The required **All checks** waits for all four and passes only if
every one passed. Each part is still a plain script anyone can run; no
arguments runs everything in order, as before.

A pull request that changes only documents (`*.md` files in `docs/` or at
the top of the repository) skips the four parts and the image build:
nothing in them can break the program, its tests or the image.
`docs/libraries.md` is the exception, because the library check reads it.
`.github/code-changed.sh` decides. Pushes to main always run everything.

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
| Rust: tests | Broken server behavior: sign-in, the wait after wrong passwords, signing out, the browser security rules, the status and diagnostics pages, the Hindi search test; adding feeds (autodiscovery, duplicates, plain reasons for problems, private addresses refused, unsafe content cleaned) against a made-up publisher; read, unread, star, "mark all as read" touching only the articles named, and the shared sort order; each **database structure change tried on a filled copy** first (`structure_changes.rs`); and the **speed tests**, on a made-up library of 500 feeds and a year of articles (100,000), which fail if any list (All, Unread, Starred, one feed, newest or oldest first) or the unread counts take 100 ms or more, or stop using their index | `server/src/` and `server/tests/` (`speed.rs`) |
| Build the program | The release program doesn't build | cargo |
| Accessibility, contrast and screenshots | Any WCAG A/AA problem (including color contrast) on any screen, in any chosen theme and when following the device's light or dark setting, at desktop or phone width; the theme or the wordmark's Literata font not applying, or a font coming from anywhere but nine turtles; sign-in, the layout, the sidebar toggle, the `?` list, the `g` keys or Settings not working with the keyboard alone, or anything overlapping at 200% zoom; the browser's security rules blocking anything. Also photographs every screen | `web/tests/` (Playwright with axe) |

## The browser tests' two copies of nine turtles

`web/playwright.config.ts` starts two copies of nine turtles and a made-up
publisher (`web/tests/feed-server.mjs`, invented blogs only). The first
nine turtles stays empty, for the first-visit screens; the second may read the
made-up publisher and is where tests add feeds. Each test that adds a feed
uses a blog name of its own, so tests never meet each other's feeds.

## Adding a screen

Add it to `SCREENS` in `web/tests/screens.ts`. It's then automatically
checked for accessibility in every theme and photographed for the pull
request. A screen that needs feeds sets `base: FEEDS_APP`. A screen that needs signing in sets `signedIn: true`; the tests sign
in through the sign-in page with a made-up password (`web/playwright.config.ts`).

## Outside the script

- **Container image:** `.github/workflows/image.yml` builds the image on every
  pull request and checks it starts and answers `/status`. On main it also
  stores it and deploys it (decision 0011). It needs Docker, so it isn't in
  `scripts/check.sh`; run `docker build .` to try it yourself. Skipped on
  pull requests that change only documents.
- **Screenshots on the pull request:** posted by GitHub Actions after the
  checks (decision 0005). Each half of the browser tests keeps its own
  pictures; the posting step puts them together.
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
