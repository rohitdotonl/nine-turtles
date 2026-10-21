# slowfeed: engineering principles and working agreements

*Last updated: 22 October 2026.*

**Precedence:** `docs/DESIGN.md` takes precedence over this document. If anything here conflicts with it, `DESIGN.md` wins, and the conflict should be reported to the owner.

This document has four parts:
1. **Working agreements:** how agents and the owner work together
2. **Engineering principles:** what the software must be
3. **Technical decisions:** what was chosen, and why
4. **Automatic checks:** which principles are enforced by the computer

---

## Part 1: Working agreements

The owner is a tech-oriented person, not a developer. They direct the work; agents do the building.

1. **Talk in simple, plain language first.** Lead with what something means for the owner and the app. Give technical detail only after, or when asked. Explain any technical term the first time you use it.
2. **One big change at a time.** Finish, check and get approval for one before starting the next.
3. **Plan first, then wait for approval.** Nothing gets built until the owner says yes.
4. **Offer choices in plain language,** with your suggestion marked and the reason given.
5. **Explain every change in plain language:** what changed, why, and how the owner can check it themselves.
6. **Never add a library without asking.** This includes replacing one library with another.
7. **Update the docs in the same change as the code.**
8. **Never touch the live app or its data without telling the owner first.**
9. **If unsure, ask instead of guessing.**
10. **If a request conflicts with a principle, stop and say which one.** This applies to the owner's requests too.

### How a change happens

1. The agent proposes a plan in plain language, with choices where they exist.
2. The owner approves.
3. The agent works on a separate **branch** (a copy of the code) and opens a **pull request** on GitHub with a plain-language summary.
4. Automatic checks run on the pull request.
5. Optionally, a second agent reviews the pull request against `DESIGN.md` and this document.
6. The owner presses **Merge**. Only then does the change reach the live app.

---

## Part 2: Engineering principles

Same structure as `DESIGN.md`: a floor that nothing can trade away, then ranked principles. **When two principles conflict, the higher one wins.**

### The floor: never lose the reader's data, never put the reader at risk

- Every change to the database's structure is backed up first and tested on a copy before it runs for real.
- Nothing deletes data without undo, or without a backup taken first.
- Article content from feeds is always sanitized before display.
- Passwords and secrets never appear in the code or in GitHub.

**Test:** If this goes wrong at the worst moment, can everything be recovered?

### 1. The computer checks the work

The owner doesn't review code line by line, so automated checks do the reviewing. Every change must pass the compiler, the tests and the automated checks before it counts. A feature isn't done until it has tests.

**Test:** If an agent broke this tomorrow, would something fail automatically?

### 2. Boring and few

Prefer well-known, mature tools, and as few of them as possible. Every new library or service needs a reason, because each one is something that can break, change or disappear.

**Test:** Can this be done with what we already have?

### 3. No vendor lock-in

slowfeed must be able to move to any host in an afternoon.
- It runs as one ordinary program plus one SQLite file. No host-specific databases, queues or functions.
- All settings come from environment variables, never from a host's dashboard alone.
- Backups use standard formats and go to storage that any provider can replace.
- Moving hosts is a written, tested procedure (`docs/operations/moving-hosts.md`), not a hope.
- The same rule applies to libraries: prefer standard, replaceable choices.

**Test:** Could slowfeed move to another host in an afternoon?

### 4. Fast by design

The engineering side of "slow app, fast interface." Speed is a requirement with numbers attached:
- Interface actions under ~100 ms.
- A small page download, with a size budget checked automatically: at most 150 KB (compressed) of app code and styles on first visit, and at most 400 KB of fonts (only the alphabets slowfeed needs, cached after the first visit).
- No database query that searches without an index.

**Test:** Is the speed checked automatically, or are we hoping?

### 5. Fail small, fail visibly

One broken feed never affects others. One failed step never crashes the app. When something fails, the owner can see it on the feed health page or in the logs, in plain words; the reader is never shown a technical error.

**Test:** What's the smallest thing this failure can take down?

### 6. Built to last ten years

No trendy tools that might be abandoned. Updates happen on purpose, not automatically. Everything needed to rebuild the app lives in the repository.

**Test:** Could someone rebuild and run this in 2036 from the repository alone?

### 7. Written for the next agent

Every agent session starts with no memory. Code, docs and decision records explain *why*, not just *what*, so the next agent doesn't undo a deliberate choice. Significant decisions get a short note in `docs/decisions/`.

**Test:** Would a fresh agent understand why this was done, without asking?

---

## Part 3: Technical decisions

These were decided with the owner. Changing any of them needs the owner's approval. Library versions and maintenance status should be checked when work starts.

### Stack

**Backend: Rust**, chosen because it compiles to a single small program, uses little memory, and its strict compiler catches many mistakes before they run.

| Job | Choice |
|---|---|
| Web server | axum |
| Async runtime | tokio |
| Fetching feeds | reqwest |
| Parsing feeds (RSS, Atom, JSON Feed) | feed-rs |
| Sanitizing HTML | ammonia |
| Database | SQLite via sqlx (with migrations) |
| Search | SQLite FTS5 |
| OPML import/export | opml |
| Feed autodiscovery | scraper |
| Password hashing | argon2 *(still to confirm with owner)* |
| Logging | tracing |

**Frontend: TypeScript**

| Job | Choice |
|---|---|
| UI framework | Svelte 5, as a single-page app |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Keyboard shortcuts | Small custom handler |
| Installable on phones | Web app manifest and service worker (PWA) |

**Packaging:** the built frontend is embedded into the Rust program, so deploying means one program file.

### Hosting

- **Render**, Starter instance with a 1 GB persistent disk (about $7.25/month), paid from credits valid until **1 October 2027**.
- Render's free address (`*.onrender.com`) for V1.
- One instance only (a service with a disk can't run more than one). Brief downtime during deploys is acceptable.
- Code lives in a **private GitHub repository**; GitHub Actions runs the automatic checks.
- **Backups:** built into slowfeed itself (no separate backup program). Every night, slowfeed makes a consistent copy of its SQLite database and uploads it to S3-compatible storage outside Render (Cloudflare R2 for V1; any S3-compatible provider can replace it). A copy is also made before every database structure change. At worst, a day of reading activity could be lost; feeds and their articles can be fetched again. *(Decided with the owner, October 2026.)*
- Agents are **not** given access to Render. Deploys happen when the owner merges.

### Fetching feeds (implements the publisher floor)

- **Conditional requests:** always send ETag / If-Modified-Since when known.
- **Adaptive schedule:** each feed is checked based on how often it publishes. Never more often than every 30 minutes; at least once a day.
- **Spread out:** feed checks are spread across time, never all at once.
- **Slow down when asked:** honor HTTP 429 and `Retry-After`.
- **Identify ourselves:** a clear User-Agent naming slowfeed.
- **WebSub (V1):** subscribe when the feed advertises a hub; verify subscriptions; check signatures with a per-subscription secret; renew before leases expire. While WebSub is active, polling continues at a reduced rate as a backup.
- **Limits:** a timeout and a maximum size for every fetch.
- **Redirects:** permanent redirects (301/308) update the stored feed address.
- **Failures:** each feed fails on its own. Repeated failures increase the wait (exponential backoff, capped at one day). A feed is **dead** after 7 days of 404/410, or 3 weeks of any failure; otherwise a feed with recent errors is "having trouble". Dead feeds are still checked once a day in case they return.
- **Never fetch article pages** to extract full text. Autodiscovery fetches a website's home page only when the owner adds a feed or asks "Find new address."

### Duplicates

- Each article gets a fingerprint: the feed's own item ID; otherwise the normalized link; otherwise a hash of title plus date.
- Links are normalized before comparing (for example http vs https, common tracking parameters).
- The database refuses a second article with the same fingerprint in the same feed.

### Sanitizing article content

- ammonia with a strict allowlist: no scripts, no styles that can run code, no event handlers, no iframes. (V2 will allow YouTube's player only.)
- Remove invisible 1×1 tracking images.
- Links get `rel="noopener noreferrer"`.

### Data

- Unstarred articles older than one year, read or not, are deleted. Starred articles are kept forever.
- This clean-up runs only if the most recent nightly backup succeeded; otherwise it waits and the feed health page says so. Deleted articles remain recoverable from backups for as long as backups are kept.
- **Search:** FTS5 configured so words in scripts with combining marks (such as Hindi's vowel signs) are not split apart; covered by tests with Hindi text.
- **"Mark all as read"** receives the exact list of items on screen, so items fetched in the background are never touched. It is undoable.
- **Exports:** OPML for feeds and folders; starred articles as a JSON Feed file.

### Sign-in and security

- Single-user password sign-in. The password is stored only as a slow, salted hash.
- Long-lived session cookie per device (secure, HTTP-only).
- Failed sign-in attempts are rate-limited.
- Secrets (password hash, session key, backup credentials) come from environment variables.

---

## Part 4: Automatic checks

Wherever a principle can be checked by a computer, it is. These run on every pull request:

| Principle | Check |
|---|---|
| The computer checks the work | Rust: format, lint and tests. Frontend: type check and tests. |
| First floor (accessibility) | Automated accessibility and contrast tests on every screen, in all three themes |
| No motion (DESIGN.md) | Fails if animations or transitions appear in the styles |
| Fast by design | Fails if the frontend download grows past its size budget |
| Never add a library without asking | Fails if the code uses a library that isn't on the approved list in `docs/libraries.md`. Agents add to that list only after the owner has said yes. |
| Publisher floor | Tests confirm conditional requests, backoff and that no article pages are fetched |
| Search for Hindi | Tests search Hindi text and find the right results |
| Data floor | Database changes are tested against a copy of real-shaped data |
