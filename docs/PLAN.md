# nine turtles V1 build plan

*Agreed with the owner. Agents build from this plan without a separate plan step (decision 0014).*

V1 is built in small milestones, one at a time, in this order. Each one ends
with something you can try yourself, a pull request with a plain-language
summary, and green automatic checks. The next milestone starts only after
you've merged the previous one and said go.

**How you try each milestone:** each pull request includes screenshots (and
short screen recordings where useful). After you merge, you try it for real
on the live app; anything found then gets a quick follow-up fix.

**Status key:** ⬜ not started · 🔨 in progress · ✅ merged · ⏭ moved to V2

**V1 is for the owner alone** (decided 23 October 2026). Backups, river mode,
WebSub, the feed health page, the yearly clean-up, the feeds guide page and
keeping old tabs working across updates moved to V2
(`docs/decisions/0012-v1-for-one-reader.md`). Milestone numbers stay the
same so older documents still point to the right place.

| # | Milestone | Status |
|---|---|---|
| 0 | Planning documents, README, licence (MIT), change history | ✅ |
| 1 | Skeleton and automatic checks | ✅ |
| 2 | Live on Render, with sign-in | ✅ |
| 3 | Backups and recovery | ⏭ |
| 4 | Look and feel foundations | ✅ |
| 5 | Add a feed and see its items | ✅ |
| 6 | Reading articles | ✅ |
| 7 | Read, unread, star and undo | ✅ |
| 8 | Polite background fetching and Refresh | ✅ |
| 9 | Folders, feed editing and OPML import/export | ✅ |
| 10 | Search | ✅ |
| 11 | Feed health page | ⏭ |
| 12 | WebSub | ⏭ |
| 13 | Phones and installing the app | ✅ |
| 14 | Keeping things tidy, and the finishing pass | ✅ |

---

## 1. Skeleton and automatic checks

**Goal:** an empty but real app, and the robot reviewers in place before any feature exists.

- The Rust server program and the Svelte frontend, wired together so the
  frontend is built into the one program file.
- A placeholder page in the nine turtles wordmark, with "Nothing here yet."
- Automatic checks on every pull request (GitHub Actions):
  - One script that runs every check, so GitHub Actions, any other service, an agent or a person all run the same checks.
  - Rust: formatting, lint ("clippy", a tool that spots likely mistakes), tests.
  - Frontend: type check and tests.
  - Accessibility and contrast tests of every screen, in all three themes.
  - "No motion": fails if any animation or transition appears in the styles.
  - Download size budget (150 KB of app code and styles, 400 KB of fonts).
  - Library check: fails if the code uses a library not on the approved list in `docs/libraries.md`.
  - A test that the database's search engine (FTS5) is switched on and handles Hindi.
  - Screenshots of every screen (three themes, desktop and phone width) attached to the pull request.
  - A weekly security report on our libraries (reports only).
  - The second-agent review, set up as a standard step.
- **You switch on protection for main** (a GitHub "ruleset", free for public
  repositories), with a step-by-step guide: only pull requests with passing
  checks can be merged, and nobody can save straight to main.
- `docs/decisions/` started, with a note for each of the technical decisions.
- `docs/operations/` started (how to build and run).

**You can try:** open the pull request and see the list of green checks. The
agent will also show you a deliberately broken change failing the checks, so
you know they bite.

## 2. Live on Render, with sign-in

**Goal:** nine turtles exists at its public address and only you can get in.

- Single-user password sign-in, long-lived device sessions, slowed-down
  repeated wrong guesses (section 1 of SPEC).
- Settings read from environment variables only, listed (names, never values) in `docs/operations/settings.md`.
- GitHub Actions builds nine turtles into a container image; Render runs it.
- Public status page and key-protected diagnostics page, shown to you in Settings → Status.
- The daily automatic check: its instructions written in `docs/operations/daily-check.md`
  (so any agent can follow them), then scheduled. You allow the agents' environment
  to reach your nine turtles address and add the diagnostics key to its settings.
- A step-by-step guide for you to set up Render (the agent has no access to
  it), including setting your password with `slowfeed set-password` in
  Render's Shell tab (decided October 2026): `docs/operations/render-setup.md`.

**You can try:** open the address on your computer and phone, sign in, stay
signed in, sign out. A private window sees only the password field.

## 3. Backups and recovery ⏭ moved to V2

*V1 has no backups (the owner's decision, 23 October 2026). Kept here as the V2 starting point.*

**Goal:** before any of your data exists, prove it can be recovered.

- Built into nine turtles: a nightly copy of the database, uploaded to Cloudflare R2
  (S3-compatible storage outside Render; you create the account, agents never see the keys).
  Needs one new library for uploading, which will be proposed for your approval.
- The temporary copy is made outside the data disk. Keeps 30 nightly copies plus one a month for a year.
- An automatic copy before every database structure change.
- `docs/operations/backups.md` and `docs/operations/moving-hosts.md`, tested.

**You can try:** follow the restore guide with the agent: restore a backup
into a fresh copy and see it work.

## 4. Look and feel foundations

**Goal:** the empty three-pane app, looking and behaving like nine turtles.

- Three themes, the fonts (served by nine turtles), type scale and muted greys
  (you choose between two or three options shown as screenshots), ink blue "where you are".
- Three panes adapting to width, collapsible sidebar, the fixed sidebar views.
- Keyboard groundwork: the focus outline, `?` cheat sheet, `[`, Escape, `g` keys.
- Settings screen with reader controls and theme choice, and Sign out.

**You can try:** switch themes and fonts, resize the window, zoom to 200%,
move around with only the keyboard.

## 5. Add a feed and see its items

- Empty state with the paste field (the feeds guide page is V2; the "Import OPML" link arrives with the import itself, Milestone 9).
- "+ Add feed" and `a`, with autodiscovery from a website address (looking at exactly the page you paste; the owner's choice, October 2026).
- Fetching a feed once on adding it; storing articles without duplicates.
- Item list: title, source and time, newest first, "Show older items".
- A made-up database the size of 500 feeds and a year of articles, used by the speed tests from now on.

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
- Inbox mode (river mode is V2); sort order setting.

**You can try:** the checks in SPEC sections 8, 9 and 10.

## 8. Polite background fetching and Refresh

- Background checking on each feed's own rhythm, spread out, with ETag /
  Last-Modified, `Retry-After`, time and size limits, permanent redirects,
  backoff for failing feeds.
- "New items · press r", `r` and the Refresh button; fresh on arrival.
- Failing feeds visible without the feed health page (V2): the diagnostics page
  counts them (never naming them) and the daily check reports "Some feeds keep
  failing", with tests.

**You can try:** leave it for a day; new articles have arrived on their own,
and the screen never changed under you.

## 9. Folders, feed editing and OPML import/export

- Folders (a feed in several), "Edit feed" and "Edit folder", unsubscribing, with undo.
- Sidebar search (find a feed or folder by name).
- OPML import and export.
- **This is where you provide your OPML file.** It's used on your live app
  (or locally) only, never committed; `.gitignore` already blocks `*.opml`.
- Measure how big your database will be with your real feeds, to check the 1 GB disk is enough. V1 keeps every article (the yearly clean-up is V2), so this also tells us how many years the disk lasts. This needs your real feeds, so it happens after you import them on the live app: the daily check reports the size then, and again a week later (decision 0020).

**You can try:** import your OPML file and see your folders and feeds; export it and compare.

## 10. Search

- Full-text search with scope chip, Search options panel, filter syntax, bold
  matches, Hindi support, results in the normal list.

**You can try:** the checks in SPEC section 14.

## 11. Feed health page ⏭ moved to V2

In V1, the daily check reports failing feeds instead (from Milestone 8).

- Problems in plain words, sorted worst first, with Retry · Find new address · Unsubscribe.

**You can try:** look at your real feeds' health after a few days of fetching.

## 12. WebSub ⏭ moved to V2

- Subscribe to hubs, verify, check signatures, renew, reduced backup polling.

**You can try:** follow a WebSub blog and see new posts arrive within minutes.

## 13. Phones and installing the app

- Single-column drill-down, labeled back arrow, bottom article toolbar,
  system share sheet, Refresh button, 44px targets.
- Web app manifest and service worker so it installs to the home screen.
- A tab left open across an update that can't carry on says, in the list's
  reserved line, "nine turtles was updated. Reload to continue.", with tests.

**You can try:** read on your phone; add it to the home screen.

## 14. Keeping things tidy, and the finishing pass

- Export of starred articles. (Removing year-old articles moved to V2, with backups.)
- A full accessibility pass with a screen reader, and a speed pass.
- Docs brought fully up to date.

**You can try:** export your starred articles; run through all of SPEC as a final check.

*Built and merged on 23 October 2026 (decision 0024). The automatic checks
cover a screen reader's view; the owner's own pass with VoiceOver or
TalkBack, through every SPEC "How to check it", is still to do.*

---

## After V1: polishing the look and feel

The owner asked for a professional-grade finish after V1, guided by
Anthropic's frontend-design skill, Vercel's Web Interface Guidelines and
Impeccable, always inside DESIGN.md's rules. Done in small pull requests,
each with screenshots:

- ✅ Calmer controls: four kinds of button and field, one icon set, a
  one-line search box (decision 0025).
- ✅ Settings choices as tiles, key caps, a quiet empty reading area, a line
  under the sign-in wordmark, the browser bar in the chosen theme.
- ✅ Back arrows as icons, and the article centred on wide windows.
- ✅ A tidier shortcut list, tick boxes the same size everywhere, and
  "Edit feed" lined up under a long name.
- ✅ The phone's article toolbar keeps its icons in one line.
- ✅ A real hierarchy: a type scale, three ink levels, unread in semibold
  and read in a softer ink, one shared top line for every pane, and calmer
  sidebar, list and article tops (decision 0026).
- ✅ Taste first: icons where they're expected (close, settings, the
  article's actions), Settings as grouped cards with theme pictures, a
  grouped shortcut list, and a clearer search box (decision 0027).
- ✅ One rounded "where you are" shape, an unread dot, a floating note for
  Undo and new items, and matching page titles (decision 0028).
- ✅ A one-line search box with a tidier options panel, the empty reading
  area centred, the byline under the article's title, and an ending to
  every article.
- ✅ Clearer sign-in and add-feed problems, a quieter search box at rest,
  Edit feed as an icon, pages centred, and warmer, better separated dark
  panes.
- ✅ Lighter weights: Literata semibold for titles, a softer main button,
  single-line focus on fields, and phone text that keeps about 40
  characters a line.
- ✅ "Where you are" as a fill and a bar flush with the pane's edge, the
  same in both panes, and one focus outline for every row (decision
  0030).
- ✅ Add a feed, Edit feed and Edit folder as sheets over the list, search
  options as a popover with date presets, one-line list titles, and tidier
  phone settings and article toolbar (decision 0031).
- ✅ Eight more themes to try, four light and four dark, each with its own
  "where you are" accent (decision 0032).
- ✅ A calmer selected row, warmer selection tints, one search field style,
  aligned counts and header lines, steadier sheets with Cancel, and an end
  to every list (decision 0033).
- ✅ Toward Apple Books (the owner's one reference from 24 October 2026):
  the system interface font, a selection that keeps its fill, list
  hairlines, a tighter reading rhythm, an "Aa" reading panel, quiet icon
  toolbars and a More menu, sheets as one family, search excerpts and a
  welcome in the reading area (decisions 0034 to 0036).
- ✅ One selection pill for the sidebar and the list, the keyboard's ring
  inside it, an accent unread dot, one search highlight and a calmer list
  rhythm (decision 0037).
- ✅ Toolbars and chrome: the article's tools anchored to the pane's edges
  with a More menu, one More menu per list (Edit and Refresh inside), a
  see-through top bar, a labelled back button and a five-icon bottom bar on
  phones, and book-like title, headings, byline and summary note (decision
  0038).
- ✅ Settings as Apple Books' grouped lists with "Aa" theme tiles and an
  A/A text size; sheets that grow with their content, the destructive action
  at the bottom left; thin fields with red errors; search options as a
  checkmark menu; a calmer first visit (decision 0039).
- ✅ Toward Apple Books, batch 3: solid article bars with a line only once
  scrolled and an edge on the phone's toolbar, no scrollbar strip, the
  summary note as end matter, titles at full measure, search results as
  title, text, meta, and a silent empty reading pane (decision 0040).
- ✅ Sheets and Settings in one voice: serif sheet titles, a quiet Cancel,
  one line on a refused field, a folder checklist that shows both states, a
  shortcut list that fits; Settings' sample on the page, marks on rows that
  act, A | Medium | A, edgeless raised choices and lighter dark groups
  (decision 0042).
- ✅ List and sidebar geometry (third critique, batch 3): a gutter for the
  unread dot with titles lined up under the list's title, hairlines that end
  with the pill, a one-line list title, one search well at rest, counts in
  one column with folder arrows first, no shortcut hint, the welcome alone
  on a first visit, warm dark pills, and a phone feeds screen with chevrons
  and no stale selection (decision 0041).
- ✅ One top line and phone edges (fourth critique): one top-line height
  for all three panes so their lines meet, toolbar focus rings clear of the
  window's top, one left edge for every sidebar name, the selected place's
  icon in the accent, and on a phone one back button position, one 20px
  margin and one chevron per folder row (decision 0043).
- ✅ Quiet endings and blank paper (fourth critique): a short end-note link
  that never breaks, balanced titles, at least 56px beside the text on a
  computer, and an empty reading pane with nothing drawn (decision 0044).
- ✅ Controls that say what they are (fourth critique): a text-size stepper
  of two round-ended As, one ring on the chosen theme, tick boxes and 44px
  rows for Edit feed's folders, a main button that never looks switched off,
  importing just under the welcome's field, and a true minus in the shortcut
  list (decision 0045).
- ✅ Apple Books' themes: six themes (Original, Quiet, Paper, Bold, Calm,
  Focus), each by day and by night, an Appearance choice of Light, Dark or
  Match device, heavier article text in Bold, and old choices carried over
  (decision 0046, replacing the eleven of decision 0032).
- ✅ A quiet article title (fifth critique): no ring on the title when an
  article opens, a clear pause before the byline with looser tracking, and
  a phone toolbar with no gap on the first article (decision 0047).
- ✅ One-line rows, plain chips, one empty state (fifth critique): a list
  row's meta on one line in proportional figures, search chips in the menu's
  words, a submenu row for another feed or folder, the note in a band the
  rows end above, a centred sign-in at the phone margin, and a centred,
  still welcome that takes the list's room on a first visit (decision 0048).
- ✅ One sheet, one close rule (fifth critique, batch 5): a round mark on
  Add a feed's choice of feeds, Cancel or an X but never both, the shortcut
  list full-screen on a phone and fitting a computer window, 20px under
  every top line, the Settings preview on the phone's margin, and the
  phone's unread dot clear of the row ring (decision 0049).
- ✅ Article view (sixth critique, batch 6): pictures dimmed at night,
  smaller captions at 7 : 1, tables flush with the text, Open original in
  the right-hand toolbar cluster, a 14px byline (decision 0050).
- ✅ One search field, a warmer selection (sixth critique, batch 6): the
  list's search and the sidebar's find field as one slim capsule, the day
  selection pill made from its own pane, row rings only for the keyboard,
  the "·" hugging a cut-short name, and the sidebar keeping your place in
  view (decision 0051).
- ✅ One phone sheet and raised night surfaces (sixth critique, batch 6):
  an X-only phone sheet with its main action full width at the foot,
  lifted sheets, menus and note by night, Settings' themes 3×2 and text
  size on the segmented track, helper text on the grid, a shortcut-list
  footer with edged key caps, one heading on a phone's empty state
  (decision 0052).
- ✅ Article view and text (seventh critique, batch 7): a quiet "No article
  open" line in the empty reading pane, smaller captions at 7 : 1, and a
  warm Paper selection pill by day (decision 0053).
- ✅ List and sidebar finish (seventh critique, batch 7): a faint line
  between panes on a computer, a 28px dot gutter in a phone's list, the
  shortcuts button marked while its list is open, and a result count the
  search options never hide (decision 0054).
- ✅ Sheets, Settings and shortcuts (seventh critique, batch 7): iOS page
  sheets on a phone, a flat text-size capsule, the chosen theme's ring
  clear of its tile, the sample inside its group, a softer field ring,
  ⇧A key caps, and "Import an OPML file…" as a link on the margin
  (decision 0055).

---

Responsive layout, accessibility and speed aren't left to the end: each
milestone must pass the automatic checks for them, every feature comes with
keyboard-only tests, and each milestone that changes screens includes a
5-minute checklist you can follow yourself. Milestones 13 and 14 add
the phone-specific parts and a final human pass.
