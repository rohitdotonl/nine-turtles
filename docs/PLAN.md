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
3. **Four themes,** moving readers' saved theme over safely 🔨
4. **Logo and icons:** the heavier sidebar logo, the black app icon, the tab icon 🔨
5. **The final icon set** 🔨
6. **People** (V1 item 1 below)
7. **Write back** (V1 item 2)
8. **No unread counts** (V1 item 3)
9. **YouTube as a first-class citizen** (V1 item 4, decision 0143)
10. **A weekly email** (V1 item 5)
11. **Installing the app, said plainly** (V1 item 6)
12. **"How did you hear about nine turtles?"** (V1 item 7)
13. **Three to four refinement rounds:** the owner uses the app, lists what
    he dislikes (the theme picker first), and each round fixes it.
14. **Prices and launch:** prices, the legal pages, the final website, live
    payments with Dodo, and sign-up open.

Steps 1 to 5 merge without asking (the owner, 2 November 2026); from step 6
on, each starts only when the owner says so.

## V1: what each milestone holds

Settled with the owner on 2 November 2026 (decision 0140). Each item needs
its SPEC section first and is built and shipped one at a time, in the
milestone order above.

**Must** (promised by the headline "Read people. Write back."):

1. **People** (shape agreed with the owner, 2 November 2026; the page's
   look isn't final). A person is one human with one or more places on
   the web (blog, channel, newsletter); a folder is a group of people.
   - **One row, one page:** each person is one row in the sidebar.
     Opening it lists everything they made, newest first, labelled Blog
     or Video, and the reading pane shows their page (name, places,
     address to write back, following since) until an article is opened.
     Someone with one blog looks as today.
   - **Joining places:** on the person's page ("Add another place"), or
     by ticking "This is one person" on a folder that holds one person's
     feeds. nine turtles asks "Is this the same person?" only on clear
     evidence (their site links the other place), never joins by itself.
   - **Easy to understand:** readers learn only "person" and "folder";
     the word "feed" leaves these screens; managing a person moves from
     Edit feed onto their page, with rare settings behind More. Tried as
     a clickable mockup with a few people before it's built.
   - Pictures: https://claude.ai/artifact/N6VBtfpfGavgN8Dz7bPyFS
2. **Write back.** A Write back button on every article opens the reader's
   own email app with the writer's address and "Re: the title" filled in.
   The address comes from a newsletter's sender or the feed itself; if
   neither has one, the reader types it once and the person page keeps it.
   nine turtles never sends or reads that email.
3. **No unread counts.** Remove the numbers from the sidebar and folders,
   and the Settings › Reading row that hides them; a small dot with no
   number says something is new. Built with the new design language
   (SPEC sections 5 and 18).
4. **YouTube as a first-class citizen** (being discussed in its own
   thread; this is the starting list), always through YouTube's own feeds
   and player, never scraping: follow any YouTube link (channel, handle,
   video, playlist); Shorts and live streams left out by default, each with
   a switch on the same screen; playlists as feeds; bringing your YouTube
   subscriptions from the file Google lets you download; a better video
   page (the video's own picture before Play, the description's links,
   timestamps as chapters); picking up where you stopped; no autoplay and
   no other channels' videos at the end. YouTube's feeds hold only a
   channel's latest 15 videos.

**Should:**

5. **A weekly email, opt-in:** plain text, once a week by default (twice
   as an option): the people you follow, their titles and a line each,
   never a count. Off by default; turned on or off any time in Settings.
   The one exception to "no notifications" (decision 0140); how it looks is
   still to design.
6. **Installing the app, said plainly:** one sentence on what an installed
   web app is (its own icon and window; it updates itself each time you
   open it), then the steps for your device.
7. **"How did you hear about nine turtles?"** One optional question at
   sign-up (a blog, a friend, a search, an AI assistant, Reddit, other),
   saved with the account and shown only as totals in the owner report
   (decision 0130), never per reader.

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
