# Concepts

A list of the ideas, tools and terms nine turtles is built with, for the owner
to learn one at a time. Names only, no explanations, grouped by area.
Agents add to it whenever a change brings in a new one (see `AGENTS.md`).

## Working with Claude and agents

- Agent
- Claude Code
- Project, thread and session
- Coordinator
- Subagent (helper agent)
- Prompt
- Context window
- Token
- `AGENTS.md` and `CLAUDE.md`
- Second-agent review
- Brief

## Code and version control

- Source code
- Repository (repo)
- Public and private repositories
- Git
- Commit
- Branch
- main (the default branch)
- Merge
- Merge conflict
- Pull request (PR)
- Code review
- Diff
- GitHub
- Issue
- Ruleset (protected branch)
- `.gitignore`
- Monorepo
- Open-source licence (MIT)

## The web, in general

- Client and server
- Browser
- HTTP and HTTPS
- Request and response
- URL (web address)
- Domain and subdomain
- Port
- IP address and DNS (looking up a name)
- DNS records (A, AAAA, CNAME, TXT, MX)
- Email forwarding (Cloudflare Email Routing)
- Open Graph (the preview a link shows when shared)
- Domain registrar
- Website and web app
- Private networks and `localhost`
- Status codes (200, 301, 308, 404, 410, 429)
- Redirect
- Compression (gzip, brotli)
- TLS certificates and certificate authorities
- Headers
- Cookie
- HTML
- CSS
- JavaScript
- JSON
- API
- Frontend and backend

## Feeds and the open web

- Web feed
- RSS
- Atom
- JSON Feed
- OPML
- Starter feeds
- Feed autodiscovery
- HTML parsing (scraper)
- Polling
- Conditional requests (ETag, Last-Modified)
- User-Agent
- Rate limiting and `Retry-After`
- Exponential backoff
- Dead feeds and feed health
- Timeout
- Scraping (and why nine turtles never does it)
- Deduplication and fingerprints
- URL normalization
- Tracking pixels and tracking parameters
- Sync service and the Google Reader API

## The backend (server side)

- Rust
- Compiler
- Cargo
- Crate (a Rust library)
- Async programming and runtime (tokio)
- Web server and routes (axum)
- HTTP client (reqwest)
- Parsing (feed-rs)
- Serialization (serde)
- Logging (tracing)
- Error handling
- Command-line program and subcommands (`nine-turtles set-password`)
- Embedding files in a program (rust-embed)
- Toolchain (`rust-toolchain.toml`)

## The frontend (what the browser shows)

- TypeScript
- Type checking
- Svelte
- Component
- Single-page app (SPA)
- Vite (build tool)
- Bundle and bundle size
- Tailwind CSS
- Node.js and npm
- Progressive web app (PWA)
- Web app manifest
- Maskable icon
- Service worker
- Web fonts
- Themes, by day and by night, and Appearance (light, dark, match device)
- Browser storage (`localStorage`)
- Routing (addresses inside a single-page app) and browser history
- Font subsets and `unicode-range`
- Modal dialog
- Prefetching (loading the next thing in advance)
- Optimistic update (the screen changes first, saving follows)
- Clipboard and the system share sheet
- Container query (styling by a pane's width, not the window's)

## Data and the database

- Database
- SQLite
- Table, row and column
- SQL
- Query
- Primary key and unique constraint
- Index and query plan
- Partial index
- Soft delete (hide first, remove later)
- Foreign key and "on delete cascade"
- Transaction
- Pagination (cursor, "keyset")
- Migration
- Full-text search (FTS5)
- Tokenizer
- Unicode and combining marks
- Timestamps and UTC
- Data export

## Security and sign-in

- Authentication (sign-in)
- Password hashing (argon2id)
- Salt
- Hash function (BLAKE2)
- Random numbers and tokens
- Session and session cookie
- App password
- Secure, HTTP-only and SameSite cookies
- Cross-site request forgery (CSRF)
- Cross-site scripting (XSS)
- Server-side request forgery (SSRF)
- Sanitizing HTML (ammonia) and allowlists
- Content Security Policy (CSP)
- Embedded frames (iframes), sandboxing and the referrer
- Privacy-enhanced YouTube player (youtube-nocookie.com)
- Security headers
- Secrets
- Environment variables
- Vulnerabilities and security audits (cargo-audit, npm audit)

## Libraries

- Library (dependency)
- Direct and indirect dependencies
- Package manager
- Lock file (`Cargo.lock`, `package-lock.json`)
- Version numbers (semantic versioning)
- Pinning versions

## Checks and testing

- Automated test
- Unit test
- Integration test
- End-to-end test (Playwright)
- Test fixture
- Speed test (performance test) on made-up data
- Formatter
- Linter
- Continuous integration (CI)
- GitHub Actions and workflows
- Check script (`scripts/check.sh`)
- Running checks side by side (parallel jobs, sharding)
- Change notes (`docs/changes/`)
- Screenshots in pull requests
- Accessibility testing (axe)
- Performance budget

## Building, hosting and deploying

- Build
- Release build
- Container and container image
- Docker and the `Dockerfile`
- Container registry (GitHub's ghcr.io)
- Hosting
- Render
- GitHub Pages
- Static site and static site generator (Eleventy)
- Custom domain
- Instance
- Persistent disk
- Deploy and deploy hook
- Downtime
- Status page and health check
- Scheduled job (cron)
- Diagnostics
- Shell (terminal)
- Vendor lock-in

## Design and accessibility

- Accessibility (a11y)
- WCAG and contrast ratios (AA, AAA)
- Screen reader
- Keyboard navigation and focus
- Keyboard shortcuts
- Touch targets
- Responsive design (desktop and phone widths)
- Reduced motion and other system settings
- Design tokens (colors, fonts, spacing)
- Type scale
- Breakpoints (where the layout changes with width)
- Landmarks (named regions for screen readers)
- Focus outline (`:focus-visible`)
- Hover state
- Control kinds (everyday button, main button, toolbar action, field)
- Icon set
- Popover and menu button (`aria-haspopup`)
- Bottom sheet
- Page sheet (iOS)
- Translucent bar (withdrawn by decision 0040)
- Grouped inset list
- Stepper (a smaller / larger pair)

## Planned for V2

- Backups
- S3 and S3-compatible storage
- Cloudflare R2
- Object storage
- Restore and recovery
- Disk snapshots
- WebSub (hubs, leases and signatures)
- Data retention and clean-up
