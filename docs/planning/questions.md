# Questions and conflicts for the owner

*Draft, 21 October 2026. Each question has choices, with my suggestion
marked ⭐ and the reason. Once you've answered, the answers are written into
`DESIGN.md`, `ENGINEERING.md` or `SPEC.md` (with your approval) and this file
is cleared out.*

**Quick way to answer:** "Accept all suggestions, except Q… (my answer)".

Questions are grouped by when the answer is needed:
- **A. Needed before Milestone 1** (Q1–Q6)
- **B. Gaps in the design** (Q7–Q20): needed before the milestone that builds them
- **C. Conflicts about deleting data** (Q21–Q23)
- **D. Numbers and content** (Q24–Q26)

---

## A. Needed before Milestone 1

### Q1. Password scrambling: argon2 *(marked "to confirm" in ENGINEERING.md)*

Your password is never stored; only a "hash" is (a scrambled version that
can't be turned back into the password, and is deliberately slow to guess).
The question is which scrambling method.

- ⭐ **Argon2 (the "argon2id" variant), via the `argon2` library.** It's the
  current first recommendation of the security community (OWASP), and the
  library comes from RustCrypto, a well-established group. Version 0.6.0,
  August 2026.
- bcrypt: older, still fine, but has a 72-character password limit.
- scrypt: fine, but less commonly recommended today.

### Q2. Backups: which tool and where *(marked "to confirm" in ENGINEERING.md)*

Your database is one file. Backups copy it to storage outside Render, using
the standard "S3" storage format (originally Amazon's, now offered by many
providers, so it's easy to switch).

**Tool:**
- ⭐ **Litestream.** A small, well-known program that runs next to slowfeed
  and copies every change within seconds, so at worst you'd lose a few
  seconds of activity. It can restore to any point in time. It's actively
  maintained (version 0.5.17, August 2026). Downside: it's a second program,
  so on Render slowfeed would run as a "container" (a packaged bundle of
  both programs) instead of a single program. That's still a standard,
  host-neutral format, so it doesn't break "no lock-in".
- **Built into slowfeed, nightly.** slowfeed copies its own database once a
  night and uploads it. One program only, but you could lose up to a day of
  read/star history, and it adds a storage library to slowfeed.

**Storage provider** (any S3-compatible one works; we can switch later):
- ⭐ **Cloudflare R2** or **Backblaze B2**: both have a free allowance that
  comfortably covers a database this size. Suggest R2 (no download fees,
  which matters when you restore). You would create the account; agents never
  see the keys.
- Amazon S3 itself: works, costs a little, more complex to set up.

### Q3. Supporting libraries for Milestone 1

ENGINEERING.md lists the main libraries, but building them into a real app
needs some smaller supporting ones. Because "never add a library without
asking" applies, here are the ones Milestone 1 needs:

| Library | What it's for |
|---|---|
| `serde`, `serde_json` | Reading and writing data formats; used by almost every Rust project |
| `rust-embed` | Putting the built frontend inside the one program file |
| `tower-http` | Standard web-server extras: compression, security headers (part of the axum family) |
| `thiserror` | Clear error messages in the code |
| `@sveltejs/vite-plugin-svelte`, `@tailwindcss/vite` | The official connectors between Vite and Svelte / Tailwind (part of the chosen tools, listed for completeness) |
| `svelte-check` | Type checking for Svelte (the frontend "compiler check") |
| `vitest` | Frontend tests (made by the Vite team) |
| `@playwright/test` | Runs the app in a real browser for tests (by Microsoft) |
| `@axe-core/playwright` | The industry-standard automatic accessibility and contrast checker |

Later milestones will need a few more (for example, handling dates and web
addresses, and checking WebSub signatures). Each will be listed in its
milestone's plan for your approval.

- ⭐ **Approve these now; approve later ones milestone by milestone.**
- Ask me for alternatives for any of them.

### Q4. How the library check knows you approved

ENGINEERING.md says the automatic checks fail if libraries change "without an
approval note in the pull request". The catch: agents write pull request
descriptions, so a note there doesn't prove *you* approved.

- ⭐ **An approved-libraries list in the repository** (`docs/decisions/libraries.md`).
  The check fails if the code uses a library not on the list. Adding one
  means changing that list, which shows up clearly in the pull request for
  you to see. Agents add to it only after you've said yes in the conversation.
- **A label you add on GitHub** (e.g. "libraries approved"). Stronger proof,
  but agents can technically add labels too, and it's one more thing for you to remember.
- Both.

### Q5. How you try each milestone

You're not expected to install developer tools on your computer.

- ⭐ **Screenshots (and short screen recordings where useful) in each pull
  request, then you try it for real on the live app after merging.** Simple
  and free. Because merging puts the change live, any problem found after
  merging gets a quick follow-up fix.
- **Render "preview" copies of each pull request.** You'd try before merging,
  but previews can't have a persistent disk and cost extra.
- **Run it on your own computer** with Docker (a tool for running packaged
  apps). Try-before-merge, but more setup for you.

### Q6. How you set your password

The live app needs the scrambled form of your password as a setting on
Render (an "environment variable").

- ⭐ **A one-line command in Render's web "Shell" tab**, e.g. `slowfeed set-password`,
  which asks for the password and prints the scrambled form to paste into
  Render's settings. Nothing to install; the password never leaves Render.
- Put the plain password in Render's settings and let slowfeed scramble it at
  startup. Easiest, but the readable password then sits in Render's
  dashboard, which goes against "stored only as a hash".
- A one-time "choose your password" page on first launch. Convenient, but
  for a few minutes anyone who found the address first could claim it.

---

## B. Gaps in the design

### Q7. Managing feeds and folders (missing from DESIGN.md)

DESIGN.md doesn't say how to rename a feed, put it in folders, create or
rename folders, or unsubscribe (except from the feed health page).

- ⭐ **An "Edit feed" button in the item list's header** when you're viewing
  one feed (rename, choose folders with checkboxes, create a new folder,
  unsubscribe), and **"Edit folder"** in the same place for a folder (rename,
  delete; deleting a folder never deletes feeds). Hidden until you're looking
  at a feed or folder, so beginners don't see machinery (principle 6).
- A "Manage feeds" page in Settings listing everything in a table. Good for
  bulk changes, but further from where you'd naturally want it.
- Both.

### Q8. Where Settings and Sign out live (missing)

The sidebar order is fixed and "+ Add feed" must be at the very bottom.

- ⭐ **The "slowfeed" wordmark at the top of the sidebar, with a labeled
  "Settings" link beside it.** Sign out goes inside Settings. Fixed position,
  never moves. On phones, "Settings" sits at the top of the feeds screen.
- A gear icon only: not allowed, since icons need words unless universal.

### Q9. Visible controls for keyboard-only actions

Several actions are described only as keys (`m`, `Shift+A`, `u`). The
accessibility floor and phones need visible controls too. In particular, the
phone toolbar (previous · next · star · share · open original) has no "mark
unread", and phones have no `u` key for undo.

- ⭐ **List header:** "Mark all as read" as a labeled button.
  **After an undoable action:** "Marked 23 items as read · Undo" appears in
  the same reserved line at the top of the list that's used for "New items",
  so nothing shifts. It stays until your next action.
  **Article view:** "Mark unread" in the top bar (desktop and phone), keeping
  the bottom phone toolbar exactly as designed.
- Add "Mark unread" to the phone's bottom toolbar as a sixth button (more crowded).

### Q10. What `u` (Undo) can undo

- ⭐ **The last action only, of these:** mark all as read, mark unread,
  star/unstar, unsubscribe, delete folder. Simple to understand; covers every
  action that changes or removes your data.
- Mark all as read only (as literally written in DESIGN.md).
- Several steps of undo history. More power, more to explain.

### Q11. River mode details

In river mode there's no Unread view. What about the things that point to it?

- ⭐ The sidebar shows **Starred · All** only; `g u` does nothing; "Mark all
  as read" is hidden (read state isn't visible, so it would do something
  invisible); the app opens on **All** (in inbox mode it opens on **Unread**).
- Keep "Unread" visible in river mode too (but then river mode isn't very different).

### Q12. Reading in the Unread view

When you open an item in the Unread view, it becomes read. Should it vanish?

- ⭐ **It stays in place, greyed, until you press `r` or leave the view.**
  Principle 5 (nothing moves unless you move it): rows disappearing under
  your cursor would be surprising.
- It disappears immediately (as in some other readers).

### Q13. How many items before "Show older items"

- ⭐ **50 items.** Enough for a sitting; small enough to feel finite.
- 25 / 100.

Also: with "oldest first" sorting, "Show older items" would be wrong.
⭐ The label follows the sort: "Show newer items" when sorting oldest first.

### Q14. "New items · press r" on phones

Phones have no `r` key.

- ⭐ On touch screens it reads **"New items · tap Refresh"**.
- Keep the same wording everywhere.

### Q15. When folders and sidebar search appear

"Progressive disclosure" (showing things only once they're useful) needs
thresholds.

- ⭐ **Folders** show in the sidebar once at least one exists (the "Edit
  feed" panel always offers "New folder"). **Sidebar search** (filter feeds by
  name) appears at **30 feeds or more**.
- Different number (tell me).

### Q16. Article language when the feed doesn't say

Many feeds don't state their language.

- ⭐ **Use the item's language, then the feed's; if neither says, leave it
  unmarked.** No guessing: detecting language reliably needs another library
  and can be wrong.
- Detect it automatically (new library; occasionally mislabels).

### Q17. Articles edited by the publisher after you've seen them

- ⭐ **Update the text quietly; keep it read if you read it.** Calm; no
  "this changed" alerts.
- Mark it unread again (noisy for blogs that fix typos).

### Q18. The same article in two feeds

ENGINEERING.md prevents duplicates within one feed, but the same article in
two feeds (e.g. a blog's main feed and its category feed) shows twice.

- ⭐ **Keep it as designed (shows in both).** Rare, and merging across feeds
  has tricky edge cases.
- Treat them as one item, read in one place = read in both.

### Q19. Which settings follow you across devices

- ⭐ **Reading settings shared everywhere** (inbox/river, sort order);
  **appearance per device** (theme, font, text size, line width), since a
  phone and a laptop often want different sizes. `+`/`-` change the same
  text-size setting as Settings does.
- Everything shared.
- Everything per device.

### Q20. When a feed counts as "dead"

- ⭐ **Dead** if it's been gone ("not found", HTTP 404/410) for 7 days, or
  failing for any reason for 3 weeks. Otherwise, a feed with recent errors
  is "having trouble". Dead feeds are still checked once a day, in case they return.
- Other numbers.

---

## C. Conflicts about deleting data

### Q21. Removing year-old articles vs "nothing deletes without undo or a backup"

DESIGN.md: read, unstarred articles are removed after a year. ENGINEERING.md's
floor: nothing deletes data without undo or a backup taken first. Both can be true:

- ⭐ **The yearly clean-up only runs if a backup succeeded within the last 24
  hours; otherwise it waits, and the feed health page says so.** Deleted
  articles stay recoverable from backups for as long as backups are kept.
- Run regardless (simpler, but contradicts the floor).

### Q22. Unread articles are kept forever, and the disk is 1 GB

DESIGN.md only removes *read* articles. In river mode, almost nothing is ever
marked read (you skim), so nearly everything would be kept forever. With
hundreds of feeds, a year of articles plus the search index might approach
the 1 GB disk.

- ⭐ **Remove any unstarred article older than a year, read or not.**
  Starred stays forever. This changes DESIGN.md, so it needs your yes.
- Keep as written, and measure at the import milestone with your real feeds;
  buy more disk if needed (about $0.25 per extra GB a month).

### Q23. Format of the starred articles export

- ⭐ **JSON Feed**: a standard, open file format, readable by other feed
  tools and by slowfeed itself; no new library needed.
- A single web page (HTML) you can open in any browser and read.
- Both.

---

## D. Numbers and content

### Q24. Download size budget

- ⭐ **App code and styles: at most 150 KB** (compressed) for the first visit.
  **Fonts budgeted separately: at most 400 KB**, by including only the
  alphabets slowfeed needs (Latin), loaded once and then cached.
- Tighter or looser numbers.

### Q25. Type scale and muted greys ("to be defined" in DESIGN.md)

- ⭐ At Milestone 4, I show you **two or three options as screenshots**, all
  already passing the contrast checks; you pick, and the choice is written into DESIGN.md.
- I choose and you review in the pull request.

### Q26. The "Here's how feeds work" guide

- ⭐ **I draft a short page (under 300 words) in slowfeed's voice; you
  approve the wording in the pull request.** It lives inside the app.
- You write it.

---

## Small notes (no decision needed)

- The documents are dated 22 October 2026; today is 21 October. Harmless; I'll leave it.
- DESIGN.md's name check ("slowfeed" vs Slow Food) remains open and isn't blocking V1.
- A `.gitignore` rule now blocks any `*.opml` file from being committed. Test
  files for import will use a different name and made-up feeds.
