# Technical decisions check, October 2026

*Checked 21 October 2026 against crates.io (the Rust library registry), npm
(the JavaScript library registry) and the projects' own release pages. No
decision has been changed; this only reports.*

## In plain language

- **Every chosen library is alive and maintained**, with releases in the
  last few months, except the small OPML library (see below).
- **Four libraries have had a major new version** since the decisions were
  probably written (reqwest, feed-rs, sqlx, argon2). We simply start on the
  new versions; nothing to migrate since no code exists yet.
- **Three things affect the plan a little:**
  1. **TypeScript 7 is out, but the Svelte type checker doesn't support it
     yet.** We should use TypeScript 6 for now and move to 7 when
     `svelte-check` supports it.
  2. **The OPML library hasn't been updated since January 2024** and is
     hosted on a personal server rather than GitHub. OPML is a simple,
     frozen format, so this is low risk, but worth deciding at the import
     milestone whether to keep it or write the small amount of OPML
     handling ourselves with an XML library we'll already have (feed-rs
     already uses one called `quick-xml`). I'll bring that choice to you then.
  3. **sqlx** (the database library) **changed GitHub home** (to the
     `transact-rs` organization) and now needs a fairly recent Rust
     (1.94 or newer; current Rust is 1.99). No problem for us; just noting it.
- **Render pricing** (Starter $7/month + $0.25 per GB of disk) matches
  third-party sources, but I couldn't reach Render's own pricing page from
  here, and one article mentions a Render plan change on 1 August 2026.
  Please glance at your Render billing page to confirm; it doesn't change the plan.

## Backend (Rust)

| Job | Library | Latest version | Last release | Status / notes |
|---|---|---|---|---|
| Web server | axum | 0.8.9 | Apr 2026 | Maintained (tokio team) |
| Async runtime | tokio | 1.54.1 | Oct 2026 | Maintained |
| Fetching feeds | reqwest | **0.13.5** | Sep 2026 | **New major version (0.13).** Now uses a pure-Rust secure-connection library (rustls) by default, which suits a single-program deploy well. |
| Parsing feeds | feed-rs | **3.0.0** | Sep 2026 | **New major version.** Mostly internal changes (better author parsing). Fine to start on 3.0. |
| Sanitizing HTML | ammonia | 4.2.4 | Oct 2026 | Maintained |
| Database | sqlx | **0.9.0** | May 2026 | **New major version.** Moved to the `transact-rs` GitHub organization; needs Rust 1.94+. |
| Search | SQLite FTS5 | (part of SQLite) | — | Included in the SQLite that sqlx bundles; Milestone 1 adds a test proving it's switched on. Hindi needs a specific setting (vowel signs must count as part of words); this is already called out in ENGINEERING.md. |
| OPML | opml | 1.1.6 | **Jan 2024** | **Quiet.** Works, small, but not updated in almost three years; hosted on a personal git server. See note 2 above. |
| Autodiscovery | scraper | 0.29.0 | Oct 2026 | Maintained |
| Password hashing | argon2 | **0.6.0** | Aug 2026 | New version (0.6); from RustCrypto. Approved by the owner. |
| Logging | tracing | 0.1.44 | Dec 2025 | Maintained (tokio team); version number has been 0.1 for years, which is normal for it. |
| Language | Rust | 1.99.1 | Oct 2026 | Stable releases every 6 weeks |

## Frontend (TypeScript)

| Job | Tool | Latest version | Last release | Status / notes |
|---|---|---|---|---|
| UI framework | Svelte | 5.57.2 | Oct 2026 | Maintained, still Svelte 5 |
| Build tool | Vite | **8.3.5** | Oct 2026 | **Vite 8**, now built on a faster engine (Rolldown). No impact for a new project. |
| Styling | Tailwind CSS | **4.3.3** | Jul 2026 | **Tailwind 4**: configured in CSS instead of a JavaScript file, and needs recent browsers (Safari 16.4+, Chrome 111+, i.e. from 2023 onward). Fine for a personal reader. Note it includes animation helpers; our "no motion" check will catch any use. |
| Language | TypeScript | 7.0.2 (latest) / 6.0.3 | Jul 2026 | **Use 6.0.x for now:** `svelte-check` 4.7.7 only supports TypeScript 5 and 6. |
| Svelte type check | svelte-check | 4.7.7 | Oct 2026 | Maintained (approved) |
| Installable app | Web app manifest + service worker | — | — | Web standards; no library required. `vite-plugin-pwa` (2.0.0, Oct 2026) exists if we ever want help, but it's not needed and isn't proposed. |

## Supporting tools (approved, see `docs/libraries.md`)

| Tool | Latest | Last release |
|---|---|---|
| serde / serde_json | 1.0.229 / 1.0.154 | Jul / Oct 2026 |
| rust-embed | 8.13.0 | Oct 2026 |
| tower-http | 0.7.1 | Aug 2026 |
| thiserror | 2.0.21 | Sep 2026 |
| vitest | 5.0.5 | Oct 2026 |
| @playwright/test | 1.64.1 | Oct 2026 |
| @axe-core/playwright | 4.14.0 | Oct 2026 |

## Backups (for reference: the owner chose a nightly backup built into slowfeed instead)

| Tool | Latest | Notes |
|---|---|---|
| Litestream | 0.5.17 (Aug 2026) | Active again after a quiet period in 2023–24; the 0.5 series was a large rewrite in 2025 and has had regular releases since. |

## Things that are fine as decided

- Rust + SQLite + one program file remains a very standard, portable setup.
- Render with a persistent disk still allows only one running copy; ENGINEERING.md already accepts brief downtime during deploys.
- All fonts named in DESIGN.md (Literata, Atkinson Hyperlegible, Inter, JetBrains Mono) are free to self-host. Note: the Braille Institute released **Atkinson Hyperlegible Next** in 2025, an updated version with more weights. Which version to use is a small design choice I'll raise at Milestone 4.
