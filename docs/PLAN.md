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
| Brand and design language, then the V1 features below, then 3 to 4 refinement rounds, then prices and launch | 🟡 Brand being built; the V1 list is settled (2 November 2026), each item starting only on the owner's word | `docs/RnD/business-plan.md`, `docs/RnD/ideal-reader.md`, decision 0131 |
| The open questions (privacy policy and terms, prices, trial) | ⏳ The owner's answers | [`planning/questions.md`](planning/questions.md) |

## V1: what gets built next, one at a time

Settled with the owner on 2 November 2026 (decision 0140). Each item starts
only when the owner says so, needs its SPEC section first, and is built and
shipped one at a time, in this order: the musts, then the shoulds, then the
ones to discuss, then the pricing ones last, with prices and launch.

**Must** (promised by the headline "Read people. Write back."):

1. **Person pages.** The sidebar stays as it is: a feed already is a
   person. A person's page shows everything they wrote, newest first,
   their site and the address to write back to. A person's blog,
   newsletter and channel can be joined under one name (optional).
   Still open: whether joined feeds show as one row in the sidebar.
2. **Write back.** A Write back button on every article opens the reader's
   own email app with the writer's address and "Re: the title" filled in.
   The address comes from a newsletter's sender or the feed itself; if
   neither has one, the reader types it once and the person page keeps it.
   nine turtles never sends or reads that email.
3. **No unread counts.** Remove the numbers from the sidebar and folders,
   and the Settings › Reading row that hides them; a small dot with no
   number says something is new. Built with the new design language
   (SPEC sections 5 and 18).
4. **YouTube as a first-class citizen,** always through YouTube's own feeds
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

**To discuss with the owner:**

- **Tags.** Folders already work like Feedbin's tags (a feed can be in
  several), so tags would mostly be a rename; collections already tag
  articles.
- **A kind note to bloggers whose feed breaks.** Suggested: start by hand.
  The owner report lists feeds broken for over a week that at least 3
  readers follow, with the reason and the blog's address, never who
  follows them; Rohit writes to the blogger himself
  ([`RnD/marketing.md`](RnD/marketing.md), item 3). No automatic emails to
  strangers.

**Last, with prices and launch** (there's no subscription to pause until
payments are built for real):

- **A 30-day free trial, no card,** instead of 14 days (SPEC 29).
- **After a trial or plan ends,** feeds are still checked once a day, but
  only for three months; then not until the reader comes back (SPEC 29,
  11). Nothing is ever deleted.
- **Pause instead of cancel:** a paying reader pauses, isn't charged, and
  their paid time stops counting down. First check that Dodo can pause a
  plan; if not, cancelling in one press.

**After launch:** a browser extension for adding feeds while browsing
(until then, the bookmark in Settings › Add from anywhere does the same job
on computers). The command menu and the every-state check
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
