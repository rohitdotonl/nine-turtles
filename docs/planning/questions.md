# Questions and conflicts for the owner

*Updated 21 October 2026 after the owner's first answers. Decisions have been
written into `DESIGN.md`, `ENGINEERING.md`, `SPEC.md`, `PLAN.md` and
`libraries.md`; this file keeps a short record, plus what's still open.*

## Still open

### Sign-in (was Q1 and Q6)

**How it works, in plain words.** There's no outside service involved. The
sign-in is a small part of slowfeed's own code: one password, no username, no
email, no accounts. When you type the password, slowfeed scrambles it and
compares the result with the scrambled version it has stored. The scrambling
is done by a **library** (ready-made code that's published for anyone to use
and runs inside slowfeed) called **argon2**. Scrambling is deliberately slow,
so anyone who stole the stored version couldn't work backwards to your
password by trying billions of guesses. "Forgot password" isn't needed: you
set a new one in Render's settings.

**Can sign-in be skipped in V1?** Not safely. slowfeed lives at a public web
address. Addresses get found, through a shared link, a screenshot, or
automated programs that scan the web for new sites. Without a password, anyone who found
it could read your subscriptions, unsubscribe you from everything and delete
your starred articles. That breaks the engineering floor ("never put the
reader at risk"), which nothing can trade away. So I can't suggest skipping it.

What can be done is making it as painless as possible: you type the password
once per device, and each device then stays signed in for a long time
(months).

**Decided:** the scrambling library is **argon2** (argon2id variant).

**Still open: how you set the password** (needed at Milestone 2, not before).

In short: Render (the company running slowfeed) has a page in its website
where you can type a command to the running app. You'd type
`slowfeed set-password`, type your password, and get back a long line of
scrambled text. You copy that line into a settings box on Render, and
that's it. slowfeed only ever stores the scrambled line, never the password.

Options:
- ⭐ **Type a one-line command in Render's web "Shell" tab** (a box in
  Render's website where you can type commands to the running app), e.g.
  `slowfeed set-password`. It asks for your password and shows the scrambled
  form, which you paste into Render's settings. Nothing to install, and the
  readable password is never saved anywhere. The milestone 2 guide walks you
  through it step by step.
- **Put the readable password in Render's settings**, and slowfeed scrambles
  it each time it starts. Easiest, but your readable password then sits in
  Render's dashboard. ENGINEERING.md says it's stored "only as a hash", so
  this would change that rule.
- **A "choose your password" page the first time the app starts.**
  Convenient, but for a few minutes after the first deploy, anyone who found
  the address first could claim it.

**About Render's Shell tab:** Render's documentation says the Shell tab and
SSH (a way to type commands to the server) are available for paid web
services and not for free ones. Starter is a paid plan, so it should be
included. I couldn't open Render's website from the agent's environment to
confirm it directly, so the first step of Milestone 2 is for you to check that
the tab is there. If it isn't, the fallback is the second option above.

### Q27. Keep the repository public?

ENGINEERING.md said "private", but the repository is public.
- ⭐ **Keep it public.** Main protection and the automatic checks are free,
  and slowfeed has nothing secret in its code by design. The documents have
  been updated to say "public". The one thing to remember is that nothing
  personal goes in it, and the `.gitignore` rule already blocks your OPML file.
- Make it private. Then protecting main would need GitHub Pro (about $4 a
  month), and the checks would use up a monthly free allowance.

### Q28. How agents can see the live app

Agents have no Render access (on purpose) and can't sign in to slowfeed.
- ⭐ **A small public "health" page** (`/health`) showing only: OK or not,
  the app version, when the last backup succeeded, when feeds were last
  checked, and how full the disk is. Nothing personal: no feeds, no articles.
  The same information appears for you in **Settings → Status**, in plain
  words, with a warning when the disk is 80% full. When something seems wrong,
  an agent reads the health page, and for details you copy lines from Render's
  **Logs** tab into the conversation.
  One setup step for you at Milestone 2: allow the agents' environment to
  reach your slowfeed address. It's blocked today (I checked); you add the
  address under the cloud environment's network settings ("Allowed domains").
- No health page; you describe problems and copy logs each time.

### Q29. Getting new versions of slowfeed onto your devices

The app is saved on your devices so it opens instantly, which means an old
copy could linger after an update. Notifications are out, and nothing may
change under you while you read.
- ⭐ **Quietly, at the next natural moment.** Whenever slowfeed talks to the
  server it notices a newer version and downloads it in the background. The
  next time you open or reload the app, you're on the new version. Nothing
  changes while you're reading. For a tab left open for days, **Settings →
  Status** shows "A new version is ready" with a **Reload** button.
- Also show a quiet line in the reserved spot at the top of the list:
  "slowfeed was updated · Reload". More visible, but it's one more thing
  asking for attention.
- Reload by itself immediately. Breaks "nothing moves unless you move it".

---

## Decided

| # | Question | Decision |
|---|---|---|
| Q1 | Password scrambling | argon2 (argon2id variant). |
| Q2 | Backups | Built into slowfeed, nightly, to Cloudflare R2 (S3-compatible). A copy is also made before every database structure change. |
| Q3 | Supporting libraries for Milestone 1 | Approved. All approved libraries are listed in `docs/libraries.md`. |
| Q4 | How the library check knows you approved | The approved list in `docs/libraries.md`. The check fails if the code uses anything not on it. |
| Q5 | How you try milestones | Screenshots and recordings in each pull request, then the live app after merging. |
| Q7 | Managing feeds and folders | "Edit feed" and "Edit folder" buttons in the item list header. |
| Q8 | Settings and Sign out | "Settings" beside the wordmark at the top of the sidebar; Sign out inside Settings. |
| Q9 | Visible controls | "Mark all as read" button; Undo line in the reserved spot; "Mark unread" in the article top bar. |
| Q10 | What Undo undoes | The last action only: mark all as read, mark unread, star/unstar, unsubscribe, delete folder. |
| Q11 | River mode | Sidebar shows Starred · All; `g u` does nothing; no "Mark all as read"; opens on All. |
| Q12 | Reading in the Unread view | Items stay in place until `r` or leaving the view. |
| Q13 | List length | 50 items; the button label follows the sort order. |
| Q14 | "New items" on phones | "New items · tap Refresh". |
| Q15 | Folders and sidebar search | Folders appear once one exists. **Sidebar search is always shown** (your choice, recorded in DESIGN.md's Exceptions log, see below). |
| Q16 | Article language | Item's language, then the feed's, otherwise unmarked. |
| Q17 | Edited articles | Updated quietly; read stays read. |
| Q18 | Same article in two feeds | Shows in both. |
| Q19 | Settings across devices | Reading settings shared; appearance per device. |
| Q20 | Dead feeds | 7 days "not found" or 3 weeks of any failure; still checked daily. |
| Q21 | Deleting old articles safely | Clean-up only runs after a successful nightly backup. |
| Q22 | Old unread articles | Any unstarred article older than a year is removed, read or not. (DESIGN.md updated.) |
| Q23 | Starred export | JSON Feed file. |
| Q24 | Size budget | 150 KB of app code and styles, 400 KB of fonts. |
| Q25 | Type scale and greys | You choose at Milestone 4 from 2–3 options shown as screenshots. |
| Q26 | Feeds guide page | Agent drafts it (under 300 words); you approve the wording. |

### Decided in the plan review (22 October 2026)

| Topic | Decision |
|---|---|
| New feeds | Everything arrives unread, including older posts the feed still lists. |
| Year-old articles | Age counts from when slowfeed received the article. Deleted articles are remembered by fingerprint (a few megabytes at most) so they don't come back as new. |
| Protecting main | A GitHub ruleset, free for public repositories. Set up at Milestone 1. |
| Building | GitHub Actions builds a container image; Render runs it. |
| Unsubscribing | Starred articles are kept. |
| Security | Content Security Policy and cross-site request protection. Weekly library security report (reports only). |
| Backups kept | 30 nightly plus 12 monthly. The temporary copy is made outside the data disk. |
| Testing | Realistic large test database for speed; keyboard-only tests per feature; 5-minute owner checklist per screen milestone; screenshots on every pull request. |
| Second-agent review | Standard on every pull request. |
| Times | Shown in the device's time zone. |
| Phone milestone order | Unchanged. |
| Pace | One session per milestone. No large multi-agent workflows. |

### Note on Q15 (working agreement 10: a principle is bent)

An always-visible sidebar search goes against DESIGN.md's principle 6
("Power is hidden, never missing") and its line on progressive disclosure.
That's allowed, but DESIGN.md's rules say an exception must be written down.
So it's been added to the **Exceptions log** in DESIGN.md, with its limit:
one quiet search field that filters feeds and folders by name. If you'd
rather simply change the progressive-disclosure rule instead of recording an
exception, say so.

## Small notes (no decision needed)

- The name check in DESIGN.md no longer mentions any other organization;
  it now just says to check domains, app stores and trademarks before
  committing to the name.
- A `.gitignore` rule blocks any `*.opml` file from being committed. Test
  files for import will use a different name and made-up feeds.
