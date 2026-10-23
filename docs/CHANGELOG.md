# What's changed

A plain-language history of slowfeed, newest first. One short entry per
merged pull request, written for the owner: what changed and what it means,
not how it was done.

## 23 October 2026: Fewer reviews for small changes

- Changes to documents only, and tiny fixes, no longer wait for a second
  agent's review. Features, screens, your data, fetching, sign-in and the
  rules still get one. The automatic checks run on everything as before.

## 23 October 2026: Folders, editing feeds and OPML (Milestone 9)

- Folders: put a feed in one or more from its new "Edit feed" button, where
  you can also rename it. Folders are listed A to Z in the sidebar with
  their unread numbers; the small button beside each shows its feeds.
  "Edit folder" renames or deletes one (its feeds stay).
- Unsubscribe from "Edit feed". Undo brings the feed back whole; after your
  next action its articles are gone for good, except starred ones.
- A search field at the top of the sidebar finds a feed or folder by name.
- Settings → Your data imports your OPML file (feeds arrive over a few
  minutes) and exports one. The first screen links to it too.

## 23 October 2026: New articles arrive on their own (Milestone 8)

- slowfeed now checks your feeds in the background, each on its own
  rhythm: busy blogs every 30 minutes, quiet ones once a day. It asks
  publishers "anything new?" so unchanged feeds cost them almost nothing,
  and it slows down when they ask.
- The list never changes under you. When new articles are waiting, a quiet
  line says "New items · press r" (on phones, "tap Refresh"). `r` or the
  new Refresh button shows them, and updates the unread numbers.
- If a publisher corrects an article, the new words replace the old
  quietly, and it stays read.
- A feed that keeps failing is retried less and less often. The daily
  check now says when some feeds have failed for three days or more.

## 23 October 2026: Read, unread, star and undo (Milestone 7)

- An article counts as read once it's shown: its title turns grey and
  regular weight, and the feed's grey unread number in the sidebar drops.
- `m` or "Mark unread" makes it unread again. `Shift+A` or "Mark all as
  read" marks only the articles listed on screen.
- `s` or the Star button stars an article; starred ones carry a small star
  and are listed under Starred.
- After each of these, the line above the list says what happened, with
  Undo (or `u`).
- Unread now lists only unread articles. Settings has a new Reading
  section: newest or oldest first, shared across your devices.

## 23 October 2026: Merges reach the live app again

- Since Milestone 2, every merge built correctly but never told Render to
  update, most likely because the saved deploy address had a stray space or
  line break in it.
  slowfeed's deploy step now tidies the address, and says plainly when
  it's wrong.

## 23 October 2026: Reading articles (Milestone 6)

- Click an article, or press `j` and `k`, and it appears in the reading
  area: the publisher's own text, in your reading font and size, with
  headings, quotes, code, tables and images in place.
- Invisible tracking images are removed, so they never load.
- A summary-only feed shows its summary and points you to the original;
  slowfeed never fetches the rest.
- "Open original" (or `v`) and "Copy link" always sit above the article.
  `Enter` opens an article to read, Escape goes back, `+` and `-` change
  the text size.
- The next article is loaded in advance, so `j` never makes you wait.

## 23 October 2026: Add a feed and see its articles (Milestone 5)

- Paste a blog's address (or its feed's) and slowfeed finds its feed and
  lists its articles, newest first, 50 at a time with "Show older items".
- "+ Add feed" sits at the bottom of the sidebar; `a` does the same. Your
  feeds are listed in the sidebar, alphabetically, each with its own page.
- A site with several feeds lets you choose; a page with none, or a feed
  you already follow, gets a plain sentence instead of an error.
- slowfeed only visits public websites, introduces itself, and gives up on
  slow or huge files. Article text is cleaned of anything unsafe before
  it's saved (you'll read it from Milestone 6).
- A speed test now runs on a made-up library of 500 feeds and a year of
  articles, so the app stays fast as yours grows.

## 23 October 2026: Spending fewer tokens

- One milestone per thread: once a milestone is merged, the next starts
  fresh.
- Small, low-risk changes get a lighter second-agent review.
- AGENTS.md and DESIGN.md say the same things in fewer words. No rule
  changed; agents gained two habits: short command output, and screenshots
  only when a screen changed.

## 23 October 2026: Agents start building straight away

- When you ask for the next milestone, agents now start from the plan and
  the spec instead of writing a new plan for you to approve. They still ask
  when something isn't settled (a real choice, a new library, a design
  change, anything that could lose data), and you still say yes before
  anything is merged.

## 23 October 2026: Look and feel (Milestone 4)

- The placeholder page is gone. After signing in you see the real, empty
  app: a sidebar with Unread, Starred and All, an item list and a reading
  area, each told apart by tone. Ink blue marks where you are.
- Three areas on a wide window, two on a medium one, one on a phone. Hide
  and show the sidebar with its button or `[`.
- Settings: theme, reading font, text size and line width, remembered on
  each device, plus the version and Sign out.
- Keyboard: `?` lists every shortcut, `g` then `u`/`s`/`a` jumps between
  views, Escape goes back, and a clear outline shows where you are.
- All four fonts are in, served by slowfeed itself. The greys are warm.

## 23 October 2026: A list of concepts to learn

- New page, `docs/concepts.md`: the names of the ideas, tools and terms
  slowfeed is built with, grouped by area, for you to learn one at a time.
- Agents now add any new concept to it in the same change that brings it in.

## 23 October 2026: V1 trimmed for one reader

- V1 is just for you, so these moved to V2: backups, river mode, instant
  updates (WebSub), the feed health page, removing year-old articles, the
  "New to feeds?" guide page, and keeping a tab open across an update
  working. Your OPML file and the starred export are your safety net.
- Milestone 2 is marked done. The daily check now runs every morning at
  08:39, and its instructions handle an address ending in `/`.

## 23 October 2026: Live on Render, with sign-in (Milestone 2)

- slowfeed now has a password. A new browser sees only the password field;
  each device stays signed in for a year; Sign out ends that device only.
  After five wrong passwords, slowfeed makes you wait before trying again.
- You set the password with `slowfeed set-password` in Render's Shell tab.
  slowfeed only ever stores the scrambled form.
- Merging a pull request now puts it live by itself: GitHub builds slowfeed
  into a ready-to-run package and tells Render to run it.
- A public status page, and a key-protected diagnostics page for the daily
  health check an agent runs.
- New guides: setting up Render (`docs/operations/render-setup.md`), every
  setting (`settings.md`) and the daily check (`daily-check.md`).

## 23 October 2026: Agents may merge, after a brief and your yes

- You no longer have to press Merge yourself. When a change is ready, the
  agent sends you a short, plain-language brief of what's about to go live,
  and merges only once you say yes. You can still press Merge whenever you
  like.

## 22 October 2026: Skeleton and automatic checks (Milestone 1)

- slowfeed exists as a real program: for now, one quiet page with the
  wordmark and "Nothing here yet.", in all three themes.
- Every change is now checked automatically before it can be merged:
  formatting, likely mistakes, tests, accessibility and contrast, no motion,
  the download size budget, approved libraries only, and Hindi search. All
  checks run from one script, so they don't depend on GitHub.
- Each pull request shows screenshots of every screen. A weekly report flags
  known security problems in the libraries slowfeed uses.
- main is protected: only pull requests with passing checks can be merged.
- New: decision notes (`docs/decisions/`) and how-to guides (`docs/operations/`).

## 22 October 2026: Planning

- The design, engineering rules, V1 feature list (SPEC) and build plan are
  agreed. No app yet.
- Decided along the way: password scrambled with argon2; nightly backups
  built into slowfeed; agents watch the live app through a status page and
  a daily check; the repository stays public, under the MIT licence.
- Added a guide for the owner (`docs/owner-guide.md`), the approved
  libraries list, this change history, and a front page (README).
