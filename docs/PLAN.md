# nine turtles: where things stand

*Only open and next work lives here. Finished milestones, with links to
their SPEC sections and decisions, are in
[`archive/plan-done.md`](archive/plan-done.md), which agents skip unless the
owner asks about past work.*

## Done so far, in one paragraph

V1 (the reader for one person) is finished, and so is most of V2: many
readers in one app with sign-up open to anyone, river mode, WebSub, feed
health, backups, rules and mutes, collections, podcasts, newsletters as
feeds, AI assistants over MCP, passkeys, syncing with other apps, offline
reading, the website at nineturtles.app and payments in test mode. What
each feature does is in [`SPEC.md`](SPEC.md); why, in
[`decisions/`](decisions/README.md).

The bigger plan for 100 to 200 readers is the owner's SaaS milestones plan
(https://claude.ai/artifact/V3GhrBxfXDG1TjPMsXQFPk). Nothing new starts
until the owner says so.

**Status key:** ⬜ not started · 🔨 in progress · ✅ merged and live · ⏳ waiting for the owner

## Open and next

| Work | Status | Where it's described |
|---|---|---|
| Live payments, after Dodo approves the live site | ⏳ The owner applies once the site, price and legal pages are final | SPEC section 29, decision 0094, `docs/operations/dodo-application.md` |
| The milestones to launch, below | 🔨 Brand steps being built (the owner's yes for steps 1 to 5, 2 November 2026) | This file, `docs/BRAND.md` |
| The open questions (privacy policy and terms, prices, trial) | ⏳ The owner's answers | [`planning/questions.md`](planning/questions.md) |

## Milestones to launch

Agreed with the owner on 2 November 2026. One at a time, each in its own
thread, in this order:

1. **Typefaces** ✅ (decision 0141)
2. **Colours:** the star in ink, oxblood for delete and errors ✅
3. **Four themes,** moving readers' saved theme over safely ❌ Dropped (the owner, 3 November 2026): replaced by themes named by the page they give, such as White, Paper and Night, step 10 of the owner's review plan, built when he says go. The four themes that went live (decision 0145) stay until then.
4. **Logo and icons:** the heavier sidebar logo, the black app icon, the tab icon 🔨
5. **The final icon set** 🔨
6. **People** (V1 item 1 below) ✅
7. **Write back** (V1 item 2) ✅
8. **No unread counts** (V1 item 3) ✅
9. **YouTube as a first-class citizen** (V1 item 4) ✅
10. **A weekly email** (V1 item 5) ✅
11. **Installing the app, said plainly** (V1 item 6) ✅
12. **"How did you hear about nine turtles?"** (V1 item 7) ✅
13. **Notes and highlights** (V1 item 8) ✅
14. **A feed finder that tries a few more places** (V1 item 9) ✅
15. **Choosing between several feeds, made easy** (V1 item 10) ✅
16. **Three to four refinement rounds:** the owner uses the app, lists what
    he dislikes, and each round fixes it. (The theme picker is replaced by the new themes above.)
17. **Prices and launch:** prices, the legal pages, the final website, live
    payments with Dodo, and sign-up open.

Steps 1 to 5 merge without asking (the owner, 2 November 2026); from step 6
on, each starts only when the owner says so.

## V1: what each milestone holds

Settled with the owner on 2 November 2026 (decision 0140). Each item needs
its SPEC section first and is built and shipped one at a time, in the
milestone order above.

**Must** (promised by the headline "Read people. Write back."):

1. **People** ✅ built (SPEC section 36, decision 0146): one row and one
   page per person, whose places list as one. Decision 0146 lists the
   smaller choices made while the owner was away, for the refinement round;
   the person's page gets the address to write back with item 2. Its
   refinement, **people and publications** (decision 0163, agreed with the
   owner on 3 November 2026), is built: People and Publications in the
   sidebar, one page for both with Edit on it, + Add, + Add a source, Take
   out and Unsubscribe from everyone's sources with Undo, and "Is this the
   same person?" removed.
2. **Write back** ✅ built (SPEC section 37, decision 0147; its smaller
   choices listed there for the refinement round). A Write back button on every article opens the reader's
   own email app with the writer's address and "Re: the title" filled in.
   The address comes from a newsletter's sender, the feed itself or a
   "Reply by email" link in its posts; if none has one, the reader finds it
   on their site ("Find it on their site") and pastes it once, and the
   person page keeps it.
   nine turtles never sends or reads that email.
3. **No unread counts** ✅ built (SPEC sections 5 and 18, decision 0148; its
   smaller choices listed there for the refinement round). The sidebar
   shows no numbers; a small dot in the accent at a row's end says
   something is new, and the Settings › Reading row that hid the numbers is
   gone.
4. **YouTube as a first-class citizen** ✅ built (SPEC section 38,
   decisions 0144 and 0149; its smaller choices listed in 0149 for the
   refinement round; a video's speed carries over and YouTube keeps
   captions itself, decision 0156), always through
   YouTube's own feeds and player, never scraping: follow any YouTube link
   (channel, handle, video, playlist); Shorts and live streams left out by
   default, each with a switch on the feed's screen; bringing your YouTube
   subscriptions from Google Takeout; a better video page (the grey Play box
   with the title, no picture; chapters you can press; long descriptions
   folded); picking up where you stopped; no autoplay and nothing at the end.
   Videos sit in Unread with everything else and count as read once opened.

**Should:**

5. **A weekly email, opt-in** ✅ built (SPEC section 39, decision 0150; its
   smaller choices listed there for the refinement round): Off, Weekly or
   Twice a week in Settings › Account; Saturday (and Wednesday) at 08:00 the
   reader's time; the people with something unread, their titles, a line
   and the publisher's link each, never a count; nothing new, nothing sent;
   off in one press from the link at its foot.
6. **Installing the app, said plainly** ✅ built (SPEC section 20, decision
   0151; its smaller choices listed there for the refinement round):
   Settings › Install the app says in one sentence what an installed web app
   is, then the steps for your device, then a line for each of the others.
7. **"How did you hear about nine turtles?"** ✅ One optional question at
   sign-up (a blog, a friend, a search, an AI assistant, Reddit, other),
   saved with the account and shown only as totals in the owner report
   (decision 0130), never per reader. Built: SPEC section 41, decision 0155.

**Added by the owner (3 November 2026, decision 0160):**

8. **Notes and highlights** ✅ a private note on each person (on their page:
   where you met, when you last wrote), and highlights and notes on
   articles. Search finds them, filtered by person, and Your data exports
   them as Markdown. Yours alone; nothing about them is ever public. Built:
   SPEC section 42, decision 0164.
9. **A feed finder that tries a few more places** ✅ when the pasted page
   names no feed, the usual address under it, the site's home page and the
   usual feed addresses. Built: SPEC sections 3 and 30, decision 0165.
10. **Choosing between several feeds, made easy** ✅ each feed shows its
    newest title and how often it posts; repeats are left out, and a site
    left with one is followed straight away. Built: SPEC section 3,
    decision 0165.

**Decided with the owner (2 November 2026):**

- **No tags: folders stay folders.** They already work like Feedbin's tags
  (a person can be in several folders), and collections already label
  articles. Pictures: https://claude.ai/artifact/8jqmkxsTabDuKAUWmq9RKY
- **The note to bloggers whose feed breaks is written by hand**
  ([`RnD/marketing.md`](RnD/marketing.md), items 3 and 8). nine turtles
  never emails bloggers by itself.

## A separate list, outside the milestones

Decided with the owner (2 November 2026), but not in the milestones above.
Each starts only when the owner says so.

**With prices** (there's no subscription to pause until payments are built
for real):

- **A 30-day free trial, no card,** instead of 14 days (SPEC 29).
- **After a trial or plan ends,** feeds are still checked once a day, but
  only for three months; then not until the reader comes back (SPEC 29,
  11). Nothing is ever deleted.
- **Pause instead of cancel:** a paying reader pauses, isn't charged, and
  their paid time stops counting down. First check that Dodo can pause a
  plan; if not, cancelling in one press.

**After launch:**

- **Broken feeds in the owner report:** feeds broken for over a week that
  at least 3 readers follow, with what's wrong and the blog's address,
  never who follows them, so Rohit can write to the blogger by hand.
- **A browser extension** for adding feeds while browsing (until then, the
  bookmark in Settings › Add from anywhere does the same job on computers).

**To discuss for V2** (from the research notes, decision 0160; nothing
agreed yet):

- Delete read articles for good, not just hide them (a history you can
  clear), with undo.
- A language filter: by the language of a feed or an article, in rules and
  search.
- Sort feeds by how much they post, or show one article from each.
- Check feeds you rarely read less often. Careful: readers use RSS for
  control, and anything that smells of an algorithm drives them away.
- Drag and drop to change a feed's folders.
- Easier tidying: change folders, mute and unfollow in fewer steps.
- Searching by meaning, not words ("about cycling, not just saying
  cycling"): needs AI to judge what an article is about, close to the
  firm no on AI (`RnD/business-plan.md` → "Firm noes").

The command menu and the every-state check
([`RnD/design-principles.md`](RnD/design-principles.md)) are design work
for the refinement rounds.

**Done already:** "Follow this person?" when a page is shared (decision
0138). **Dropped:** a blogroll to show (the owner, 2 November 2026: it
feels like social media).

## How every piece of work ends

Responsive layout, accessibility and speed aren't left to the end: each
change must pass the automatic checks for them, every feature comes with
keyboard-only tests, and each change to a screen gets a short checklist the
owner can follow. Once merged, the finished work moves to the archive.
