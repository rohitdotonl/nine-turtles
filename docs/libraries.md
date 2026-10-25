# Approved libraries

A **library** (also called a **dependency**) is ready-made code written and
published by someone else, which nine turtles uses instead of writing that part
itself. This is the complete list of libraries the owner has approved.

**The rule:** the code may only use libraries on this list. The automatic
checks fail otherwise. An agent adds a line here only after the owner has
said yes, so every new library shows up clearly in a pull request.

**Two kinds of list exist, for two audiences:**
- **This file** is for people: each library we chose on purpose, and why.
- **The project's own files** are for the computer: `Cargo.toml` (Rust) and
  `package.json` (frontend) list the same libraries in machine form, and
  "lock files" (`Cargo.lock`, `package-lock.json`) record the exact version of
  everything, including the libraries *our* libraries use in turn. Those
  "indirect" ones number in the hundreds; they aren't listed here because
  they come with the libraries above, but the lock files pin them so nothing
  changes without a deliberate update.

*Versions are the latest at the October 2026 check
(`docs/planning/tech-check-2026-10.md`). The exact versions in use are
whatever the lock files say.*

## Backend (Rust)

| Library | Version | What it does for nine turtles | Status |
|---|---|---|---|
| axum | 0.8 | The web server: answers requests from the browser | Approved |
| tokio | 1.x | Lets the server do many things at once (fetching hundreds of feeds while serving you) | Approved |
| reqwest | 0.13 | Downloads feeds from publishers' websites, and uploads backups to the backup storage (its `stream` feature sends a big file without holding it in memory) | Approved |
| feed-rs | 3.0 | Reads RSS, Atom and JSON Feed files | Approved |
| ammonia | 4.2 | Cleans article content so nothing unsafe reaches the screen | Approved |
| sqlx | 0.9 | Talks to the SQLite database, and updates its structure safely ("migrations") | Approved |
| opml | 1.1 | Reads and writes OPML subscription files | Approved (checked at Milestone 9: not updated since 2024, but small and enough for OPML 1.0 to 2.0) |
| scraper | 0.29 | Finds a site's feed in the page you paste (autodiscovery), finds tracking images to remove and YouTube players to turn into links, and takes the tags out of article text for the search index | Approved |
| argon2 | 0.6 | Scrambles the password so it's never stored readable | Approved |
| tracing | 0.1 | Writes the app's logs | Approved |
| serde, serde_json | 1.0 | Converts data to and from standard formats; used by almost every Rust project | Approved |
| rust-embed | 8.x | Packs the built frontend into the one program file | Approved |
| tower-http | 0.7 | Standard web-server extras: compression, security headers | Approved |
| thiserror | 2.x | Clear error messages inside the code | Approved |
| getrandom | 0.4 | Asks the computer for unguessable random numbers, for each signed-in device's ticket. Comes with argon2 already | Approved (October 2026, Milestone 2) |
| hmac, sha1, sha2 | 0.13, 0.11, 0.11 | Check that WebSub deliveries really come from the publisher's hub (their signature), and sign each request to the backup storage (decision 0076). Already came with other libraries | Approved (the owner's yes on 25 October 2026, decision 0069) |
| blake2 | 0.11 | A fast scrambler: nine turtles stores only a scrambled copy of each device's ticket. Comes with argon2 already | Approved (October 2026, Milestone 2) |

SQLite itself (and its FTS5 search) comes bundled with sqlx.

## Frontend (TypeScript)

| Library | Version | What it does for nine turtles | Status |
|---|---|---|---|
| svelte | 5.x | Builds the screens | Approved |
| vite | 8.x | Turns the frontend code into small files a browser can load | Approved |
| tailwindcss | 4.x | Styling | Approved |
| typescript | **6.0** | The frontend's language and its mistake checker. Held at 6.0 until `svelte-check` supports 7 | Approved |
| @sveltejs/vite-plugin-svelte | 7.x | Official connector between Vite and Svelte | Approved |
| @tailwindcss/vite | 4.x | Official connector between Vite and Tailwind | Approved |
| svelte-check | 4.x | Checks Svelte code for mistakes | Approved |
| vitest | 5.x | Runs frontend tests | Approved |
| @playwright/test | 1.x | Runs the app in a real browser for tests | Approved |
| @axe-core/playwright | 4.x | Automatic accessibility and contrast checks | Approved |

## Website (nineturtles.app)

Used only to build the website, never part of the app (decision 0066).

| Library | Version | What it does for nine turtles | Status |
|---|---|---|---|
| @11ty/eleventy | 3.x | Turns the website's pages, written in Markdown, into plain web pages any host can serve | Approved (October 2026, the owner's yes on 25 October) |

## Tools used only by the automatic checks

These never become part of nine turtles itself.

| Tool | What it does | Status |
|---|---|---|
| cargo-audit | Weekly report of known security problems in our Rust libraries | Approved |
| npm audit | The same for frontend libraries (built into npm, nothing to add) | Approved |
| GitHub's own Actions (`actions/checkout` and similar) | Standard building blocks for the checks, pinned to exact versions | Approved |

## Expected later (not yet approved)

Each will be proposed in its milestone's plan:
- **When logs get busier (feed fetching, Milestone 8):** `tracing-subscriber`,
  the companion to `tracing` that actually prints the logs. Until then,
  nine turtles' small `log` module prints plain lines itself, so neither is used
  yet (docs/decisions/0010-sign-in.md).
- **V2 (backups):** a way to upload to S3-compatible storage (`object_store` was the suggestion).
- **Later milestones:** handling dates and web addresses. (WebSub signatures: hmac, sha1 and sha2, approved above. Limiting repeated sign-in attempts needed no library.)
