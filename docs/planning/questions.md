# Questions and conflicts for the owner

*Updated 23 October 2026 (V1 trimmed for one reader). Decisions have been
written into `DESIGN.md`, `ENGINEERING.md`, `SPEC.md`, `PLAN.md` and
`libraries.md`; this file keeps a short record, plus what's still open.*

## Still open

- **Finishing the website's privacy policy and terms** (25 October 2026).
  They're on nineturtles.app as drafts, marked "to be decided" where they
  wait on: the prices, the email service for sign-in and receipts,
  where Render keeps the data, the business details and the law that
  applies, the minimum age, and how long backups keep deleted data. Before
  anyone can sign up, someone qualified should read both. Not blocking
  anything today.

- **Payments, built in test mode** (26 October 2026, decision 0094). Each
  of these is a setting or a small change, and none blocks trying it:
  - **The price**, monthly and yearly (`NINE_TURTLES_PRICE_*`, and the
    products in Dodo). Today: "Price to be decided".
  - **The trial's length.** Today: 14 days, no card asked for to start.
    Suggested: keep 14 days and no card (calm, nobody charged by surprise).
  - **What ends with a plan.** Today: reading, stars, search and exports
    stay; adding feeds stops and feeds are checked once a day. Stricter
    (no new articles at all) or gentler (only a note) are both easy.
  - **Readers from before payments** (your testers) stay free for good.
  - **The refund window** on the website's refunds page.

---

## Decided

| # | Question | Decision |
|---|---|---|
| Q1 | Password scrambling | argon2 (argon2id variant). |
| Q30 | What V1 includes | V1 is for you alone. Moved to V2: backups and moving hosts, river mode, WebSub, the feed health page, the yearly clean-up, the feeds guide page, and keeping an old tab working across an update. Decided 23 October 2026 (`docs/decisions/0012-v1-for-one-reader.md`). |
| Q6 | How the password is set | `slowfeed set-password` in Render's Shell tab; you paste the scrambled line into Render's settings. Chosen 23 October 2026 (Milestone 2). |
| Q2 | Backups | Nightly to S3-compatible storage (Cloudflare R2 first), plus a copy before every structure change; no new library (the owner's choice, 25 October 2026; decision 0076). |
| Q3 | Supporting libraries for Milestone 1 | Approved. All approved libraries are listed in `docs/libraries.md`. |
| Q4 | How the library check knows you approved | The approved list in `docs/libraries.md`. The check fails if the code uses anything not on it. |
| Q31 | Payment company | Dodo Payments, as merchant of record; the owner signs up as an Individual. Chosen 25 October 2026 (decision 0086). |
| Q5 | How you try milestones | Screenshots and recordings in each pull request, then the live app after merging. |
| Q7 | Managing feeds and folders | "Edit feed…" and "Edit folder…" in the More (…) menu beside the item list's title (decision 0038). |
| Q8 | Settings and Sign out | "Settings" beside the wordmark at the top of the sidebar; Sign out inside Settings. |
| Q9 | Visible controls | "Mark all as read" button; Undo in a note floating at the bottom of the list; "Mark unread" in the article's More (…) menu (decision 0038). |
| Q10 | What Undo undoes | The last action only: mark all as read, mark unread, star/unstar, unsubscribe, delete folder. |
| Q11 | River mode (V2) | Sidebar shows Starred · All; `g u` does nothing; no "Mark all as read"; opens on All. |
| Q12 | Reading in the Unread view | Items stay in place until `r` or leaving the view. |
| Q13 | List length | 50 items; the button label follows the sort order. |
| Q14 | "New items" on phones | "New items" with a Show button (decision 0038). |
| Q15 | Folders and sidebar search | Folders appear once one exists. **Sidebar search is always shown** (your choice, recorded in DESIGN.md's Exceptions log, see below). |
| Q16 | Article language | Item's language, then the feed's, otherwise unmarked. |
| Q17 | Edited articles | Updated quietly; read stays read. |
| Q18 | Same article in two feeds | Shows in both. |
| Q19 | Settings across devices | Reading settings shared; appearance per device. |
| Q20 | Dead feeds | 7 days "not found" or 3 weeks of any failure; still checked daily. |
| Q21 | Deleting old articles safely (V2) | Clean-up only runs after a successful nightly backup. Built 25 October 2026 (decision 0089). |
| Q22 | Old unread articles | Any unstarred article older than a year is removed, read or not. (DESIGN.md updated.) |
| Q23 | Starred export | JSON Feed file. |
| Q24 | Size budget | 150 KB of app code and styles, 400 KB of fonts. |
| Q25 | Type scale and greys | You choose at Milestone 4 from 2–3 options shown as screenshots. |
| Q26 | Feeds guide page (V2) | Agent drafts it (under 300 words); you approve the wording. |

### Decided in the plan review (22 October 2026)

| Topic | Decision |
|---|---|
| New feeds | Everything arrives unread, including older posts the feed still lists. |
| Year-old articles | Age counts from when nine turtles received the article. Deleted articles are remembered by fingerprint (a few megabytes at most) so they don't come back as new. |
| Protecting main | A GitHub ruleset, free for public repositories. Set up at Milestone 1. |
| Building | GitHub Actions builds a container image; Render runs it. |
| Unsubscribing | Starred articles are kept. |
| Security | Content Security Policy and cross-site request protection. Weekly library security report (reports only). |
| Backups kept | 30 nightly plus 12 monthly. The temporary copy is made outside the data disk. |
| Testing | Realistic large test database for speed; keyboard-only tests per feature; 5-minute owner checklist per screen milestone; screenshots on every pull request. |
| Second-agent review | Standard on every pull request, except documents-only changes and tiny fixes (decision 0021, 23 October 2026). |
| Times | Shown in the device's time zone. |
| Phone milestone order | Unchanged. |
| Repository (Q27) | Stays public. |
| New app versions (Q29) | Downloaded quietly; used the next time you open or reload nine turtles, or go to another place in a tab left open (decision 0085). Nothing changes while you read. Settings → Status shows "A new version is ready" with a Reload button. |
| Deleted articles | Remembered by fingerprint (confirmed). |
| Watching the live app (Q28) | Fully automatic: public status page, diagnostics page behind a read-only key, a scheduled agent check once a day that opens an issue (and a fix when clear). Nothing merges without the owner (they press Merge, or say yes to an agent's brief). Kept agent-neutral: the check's instructions live in the repository (`docs/operations/daily-check.md`) so any agent can follow them. |
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
