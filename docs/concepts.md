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
- CORS (cross-origin resource sharing)
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
- Google Reader format (starred exports)
- Starter feeds
- Podcasts, enclosures and `itunes:duration`
- Feed autodiscovery
- Feed finder (the website's free tool)
- Starter packs (the website's hand-picked blogs; not the app's starter feeds)
- Bookmarklet
- HTML parsing (scraper)
- Polling
- WebSub (hubs, leases and signatures)
- Conditional requests (ETag, Last-Modified)
- User-Agent
- Rate limiting and `Retry-After`
- Exponential backoff
- Dead feeds and feed health
- Quiet feeds
- Timeout
- Scraping (and why nine turtles never does it)
- Deduplication and fingerprints
- URL normalization
- Tracking pixels and tracking parameters
- Sync service and the Google Reader API
- MCP (Model Context Protocol) and AI assistants
- Newsletters as feeds
- Raw email (RFC 5322 and MIME)
- Mailing list headers (`List-Id`, `List-Unsubscribe`)
- One-click unsubscribe (RFC 8058)
- Email address labels (plus addressing)
- Character sets (encodings)
- Layout tables and preview text (in emails)

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
- The audio element and the Media Session API (the lock screen's player)
- Svelte
- Component
- Single-page app (SPA)
- Vite (build tool)
- Bundle and bundle size
- Tailwind CSS
- Node.js and npm
- Progressive web app (PWA)
- Web app manifest
- Web Share Target (the share menu, Android)
- Apple Shortcuts (sharing on iPhone)
- Maskable icon
- Service worker
- Web fonts
- Themes, by day and by night, and Appearance (light, dark, match device)
- Browser storage (`localStorage`)
- The browser's database (IndexedDB), and reading offline
- Routing (addresses inside a single-page app) and browser history
- Font subsets and `unicode-range`
- Modal dialog
- Prefetching (loading the next thing in advance)
- Lazy loading (`loading="lazy"`: pictures load as you reach them)
- Optimistic update (the screen changes first, saving follows)
- Race condition (an older answer arriving after a newer one), saves in order and the newest answer (`inorder.ts`)
- Clipboard and the system share sheet
- Container query (styling by a pane's width, not the window's)
- The reader's library on screen: feeds, folders, saved searches and collections, loaded and removed with Undo (`library.svelte.ts`)
- The reading settings on screen: mode, sort order, counts, when unread lets go and hidden lists, each saved in order; a saved change made before the server first answers stays (`reading-settings.svelte.ts`, keys in `keys.svelte.ts`)
- When a shortcut applies: what's on screen at the press (`KeyScene`) and what the screen can do (`KeyHands`), decided in one place (`shortcuts.ts`)
- Moving between places: lists, sheets that open over a place (`underSheet`), what a move keeps (`moveTo`), giving the keyboard back when a sheet closes (`Opener`) and the browser's history steps (`Steps`), in `navigation.ts`
- The screen's arrangement: the width step, which areas show (`panesFor`), the sidebar and list toggles and their dragged widths, kept on the device (`ScreenLayout`, in `layout.svelte.ts`)
- The search on screen: what the field holds, the results the list shows, searching a moment after typing stops, the phone's Search field, and what Save search will save (`Searching`, in `searching.svelte.ts`)
- The collection sheets on screen: Add to collection and Rename, giving the keyboard back when they close, and the Undo line when an article came off a collection (`CollectionSheets`, in `collecting.svelte.ts`)
- The list's More menu: which rows show for the list on screen (`MenuScene`) and what each asks of the screen (`MenuHands`), decided in one place (`listMenu.ts`)
- The list's words when it has nothing to show: a place you don't have (`missingFrom`, "Folder not found"), a list that couldn't load, and each empty list's line (`listWording.ts`)
- The first visit: where the welcome shows, and when "New to feeds?" gives way to home (`firstVisit.ts`); the welcome itself (`Welcome.svelte`)
- The list's heading: the place's name, "Folder not found" or "Results in …" (`listHeading.ts`)
- Stepping through articles and feeds with the keyboard (`moving.ts`)
- Where the keyboard lands on arriving somewhere (`landing.ts`)
- The sidebar's fixed lists: Unread, Starred, All, Recently read and Up Next, which show, and Up Next's row staying while it empties (`SidebarViews.svelte`)

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
- Data retention and clean-up
- Rules and mutes (filters the reader writes)
- Readers (accounts) and the `people` table
- Subscriptions and entries (each reader's feeds and marks)
- Collections (the reader's own shelves of articles) and tags (in JSON Feed)
- Episode progress and Up Next (each reader's place in an episode, and their queue)
- Admin page (the owner's Readers page) and usage limits (fair-use quotas)

## Security and sign-in

- Authentication (sign-in)
- OAuth 2.1, PKCE and dynamic client registration
- Prompt injection
- Password hashing (argon2id)
- Salt
- Hash function (BLAKE2)
- Random numbers and tokens
- Session and session cookie
- App password
- SMTP and STARTTLS (sending email)
- Email confirmation link
- Sign-in link by email ("magic link")
- Passkeys and WebAuthn (relying party, challenge, discoverable credential, passkey autofill)
- Rate limiting per account
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
- Backups
- Disk snapshots
- S3 and S3-compatible storage
- Cloudflare R2
- Object storage
- Restore and recovery
- Request signing (AWS Signature Version 4)
- Merchant of record (Dodo Payments)
- Checkout page and customer portal
- Test mode and live mode
- Webhook (signed messages, Standard Webhooks)
- Free trial and grace period
- Cloudflare Email Routing and catch-all address
- Cloudflare Worker
- Shared secret (bearer token)

## Design and accessibility

- Accessibility (a11y)
- WCAG and contrast ratios (AA, AAA)
- Non-text contrast (3 : 1 for a control's parts and states)
- Screen reader
- Keyboard navigation and focus
- Keyboard shortcuts
- Rebinding keys (keys of your own)
- Touch targets
- Responsive design (desktop and phone widths)
- Reduced motion and other system settings
- Design tokens (colors, fonts, spacing)
- Type scale
- Breakpoints (where the layout changes with width)
- Landmarks (named regions for screen readers)
- Focus outline (`:focus-visible`)
- Skip link ("Skip to articles")
- Hover state
- Control kinds (everyday button, main button, toolbar action, field)
- Icon set
- Popover and menu button (`aria-haspopup`)
- Bottom sheet
- Page sheet (iOS)
- Translucent bar (withdrawn by decision 0040)
- Grouped inset list
- Stepper (a smaller / larger pair)
