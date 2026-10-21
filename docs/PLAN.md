# slowfeed V1 build plan

*Draft for the owner's approval.*

V1 is built in small milestones, one at a time, in this order. Each one ends
with something you can try yourself, a pull request with a plain-language
summary, and green automatic checks. The next milestone starts only after
you've merged the previous one and said go.

How you try each milestone (live on Render after merging, plus screenshots
in the pull request) is question Q5 in `docs/planning/questions.md`.

**Status key:** ⬜ not started · 🔨 in progress · ✅ merged

| # | Milestone | Status |
|---|---|---|
| 0 | Planning documents (this pull request) | 🔨 |
| 1 | Skeleton and automatic checks | ⬜ |
| 2 | Live on Render, with sign-in | ⬜ |
| 3 | Backups and recovery | ⬜ |
| 4 | Look and feel foundations | ⬜ |
| 5 | Add a feed and see its items | ⬜ |
| 6 | Reading articles | ⬜ |
| 7 | Read, unread, star and undo | ⬜ |
| 8 | Polite background fetching and Refresh | ⬜ |
| 9 | Folders, feed editing and OPML import/export | ⬜ |
| 10 | Search | ⬜ |
| 11 | Feed health page | ⬜ |
| 12 | WebSub | ⬜ |
| 13 | Phones and installing the app | ⬜ |
| 14 | Keeping things tidy, and the finishing pass | ⬜ |

---

## 1. Skeleton and automatic checks

**Goal:** an empty but real app, and the robot reviewers in place before any feature exists.

- The Rust server program and the Svelte frontend, wired together so the
  frontend is built into the one program file.
- A placeholder page in the slowfeed wordmark, with "Nothing here yet."
- Automatic checks on every pull request (GitHub Actions):
  - Rust: formatting, lint ("clippy", a tool that spots likely mistakes), tests.
  - Frontend: type check and tests.
  - Accessibility and contrast tests of every screen, in all three themes.
  - "No motion": fails if any animation or transition appears in the styles.
  - Download size budget (see Q24).
  - Library check: fails if libraries change without your approval (see Q4).
  - A test that the database's search engine (FTS5) is switched on and handles Hindi.
- `docs/decisions/` started, with a note for each of the technical decisions.
- `docs/operations/` started (how to build and run).

**You can try:** open the pull request and see the list of green checks. The
agent will also show you a deliberately broken change failing the checks, so
you know they bite.

## 2. Live on Render, with sign-in

**Goal:** slowfeed exists at its public address and only you can get in.

- Single-user password sign-in, long-lived device sessions, slowed-down
  repeated wrong guesses (section 1 of SPEC).
- Settings read from environment variables only.
- A step-by-step guide for you to set up Render (the agent has no access to
  it), including how to set your password (see Q6).

**You can try:** open the address on your computer and phone, sign in, stay
signed in, sign out. A private window sees only the password field.

## 3. Backups and recovery

**Goal:** before any of your data exists, prove it can be recovered.

- Regular copies of the database to storage outside Render (tool: see Q2).
- An automatic copy before every database structure change.
- `docs/operations/backups.md` and `docs/operations/moving-hosts.md`, tested.

**You can try:** follow the restore guide with the agent: restore a backup
into a fresh copy and see it work.

## 4. Look and feel foundations

**Goal:** the empty three-pane app, looking and behaving like slowfeed.

- Three themes, the fonts (served by slowfeed), type scale and muted greys
  (you choose between options, see Q25), ink blue "where you are".
- Three panes adapting to width, collapsible sidebar, the fixed sidebar views.
- Keyboard groundwork: the focus outline, `?` cheat sheet, `[`, Escape, `g` keys.
- Settings screen with reader controls and theme choice, and Sign out.

**You can try:** switch themes and fonts, resize the window, zoom to 200%,
move around with only the keyboard.

## 5. Add a feed and see its items

- Empty state with the paste field and the feeds guide page.
- "+ Add feed" and `a`, with autodiscovery from a website address.
- Fetching a feed once on adding it; storing articles without duplicates.
- Item list: title, source and time, newest first, "Show older items".

**You can try:** add a few of your favorite blogs by their website address and see their articles listed.

## 6. Reading articles

- Article view: cleaned content, safety cleaning, tracking pixels removed,
  summary-only feeds, "Open original", Copy link / Share, language marking.
- Next article loaded in advance for instant `j`.
- `j`/`k`, `Enter`/`o`, `v`, `+`/`-`.

**You can try:** read articles from several blogs with `j` and `k`.

## 7. Read, unread, star and undo

- Read when shown, `m` to mark unread, mark all as read (on-screen items only), undo.
- Star and the Starred view; Unread and All views.
- Unread counts (muted, per feed and folder, "999+").
- Inbox and river modes; sort order setting.

**You can try:** the checks in SPEC sections 8, 9 and 10.

## 8. Polite background fetching and Refresh

- Background checking on each feed's own rhythm, spread out, with ETag /
  Last-Modified, `Retry-After`, time and size limits, permanent redirects,
  backoff for failing feeds.
- "New items · press r", `r` and the Refresh button; fresh on arrival.

**You can try:** leave it for a day; new articles have arrived on their own,
and the screen never changed under you.

## 9. Folders, feed editing and OPML import/export

- Folders (a feed in several), editing and unsubscribing feeds (see Q7), with undo.
- OPML import and export.
- **This is where you provide your OPML file.** It's used on your live app
  (or locally) only, never committed; `.gitignore` already blocks `*.opml`.
- Measure how big your database will be with your real feeds (see Q22).

**You can try:** import your OPML file and see your folders and feeds; export it and compare.

## 10. Search

- Full-text search with scope chip, Search options panel, filter syntax, bold
  matches, Hindi support, results in the normal list.

**You can try:** the checks in SPEC section 14.

## 11. Feed health page

- Problems in plain words, sorted worst first, with Retry · Find new address · Unsubscribe.

**You can try:** look at your real feeds' health after a few days of fetching.

## 12. WebSub

- Subscribe to hubs, verify, check signatures, renew, reduced backup polling.

**You can try:** follow a WebSub blog and see new posts arrive within minutes.

## 13. Phones and installing the app

- Single-column drill-down, labeled back arrow, bottom article toolbar,
  system share sheet, Refresh button, 44px targets.
- Web app manifest and service worker so it installs to the home screen.

**You can try:** read on your phone; add it to the home screen.

## 14. Keeping things tidy, and the finishing pass

- Removing read, unstarred articles after a year (safely, see Q21 and Q22).
- Export of starred articles.
- A full accessibility pass with a screen reader, and a speed pass.
- Docs brought fully up to date.

**You can try:** export your starred articles; run through all of SPEC as a final check.

---

Responsive layout, accessibility and speed aren't left to the end: each
milestone must pass the automatic checks for them. Milestones 13 and 14 add
the phone-specific parts and a final human pass.
