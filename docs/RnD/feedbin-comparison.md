# What Feedbin has that nine turtles doesn't (and the reverse)

*Research only, written 26 October 2026. Nothing here is decided.
`docs/DESIGN.md`, `docs/SPEC.md` and `docs/PLAN.md` still win, and any idea
below that changes the app needs the owner's yes first (AGENTS.md, "How a
change happens").*

## What this is

[Feedbin](https://github.com/feedbin/feedbin) is a paid feed reader that has
been polished for over ten years, and its code is public. An agent read its
public repository (the models, controllers, views, keyboard code and
settings) and compared it with nine turtles' `docs/SPEC.md`. This is what
turned up.

**How we use it:** we learn from ideas only. Feedbin is a Ruby on Rails
program under its own licence; nothing here is copied, and nothing should
be. Each item says what Feedbin does in plain words, why it might matter
here, and a rough size.

**Reading the tags**
- **Effort:** *Small* is a few hours, *Medium* is a day or two, *Large* is
  its own milestone.
- **Fit:** *Fits* means it sits comfortably inside the floors. *Check*
  means it needs a design conversation first. *Clashes* means it breaks a
  floor or a "Never" in DESIGN.md or AGENTS.md; those are listed so we can
  say no on purpose, not so we build them.
- This is what the code shows. Where I'm guessing what a feature feels
  like in use (I haven't run Feedbin), I say so.

**The short version.** nine turtles is already ahead of Feedbin on the
things this project cares about: reading comfort (Literata, the Aa panel,
line width), accessibility, offline reading, plain-language settings, a
health page for broken feeds, rules and mutes, saved searches, importing
stars, and the whole "calm" brief. Feedbin is ahead on a handful of
*small convenience* things and on one big area nine turtles has chosen to
skip, which is podcasts and audio. Most of what's worth borrowing is small.

---

## 1. Features Feedbin has that nine turtles lacks

| # | Feature | What Feedbin does | Why it might matter | Effort | Fit |
|---|---|---|---|---|---|
| 1.1 | **Mark everything above / below as read** | From any article in the list you can mark all the ones above it, or all the ones below it, as read (the code has a `mark_direction_as_read` action next to "mark all as read"). | The most natural way to triage: read down to the point where you're bored, then clear the rest in one go. Today nine turtles offers only "mark all". It's undoable like our other bulk actions. | Small | Fits. |
| 1.2 | **A "recently read" list** | Keeps a short list of the articles you opened lately, with its own screen. | Fixes "I closed that article by accident and now I can't find it". Our "mark unread" covers part of that, but not "show me what I just read". | Small to Medium | Check. It is a list of *your* activity, so keep it plain (no counts, no streaks; DESIGN.md forbids reading stats). A simple "Recently read" view with the last 50 items would be fine. |
| 1.3 | **Show what an article changed when it was edited** | When a publisher edits an article after you got it, Feedbin keeps the original and can show an inline "what changed" version (red and green text). | Publishers quietly fix and rewrite posts. For a reader who cares about the writing, "this was edited, here's how" is a book-like touch (an erratum). | Medium | Check. It stores a second copy of the text (disk and the backup size grow). Show it only on request, never as a badge or an "updated" label in the list. |
| 1.4 | **Send to other services** | A list of share targets the reader can switch on: Instapaper, Kindle, Pinboard, Raindrop, Pocket, Mastodon, Micro.blog, email and others (Pocket is now closed, so treat that one as history). | Some readers keep a read-it-later or highlights tool next to their reader. | Medium (each one) | Clashes with SPEC section 21 ("no buttons for specific platforms"), and platform share buttons are on the "Never" list. A *copy link* and a *Send by email* are the only ones that would fit. Listed to say no on purpose. |
| 1.5 | **Email an article to someone** | An article can be emailed (it has a mailer that sends the article's text, with a reply-to). | Handy for "you'll like this". | Small to Medium | Check. nine turtles already sends email through Brevo, but the founding rule is "share the publisher's link", not our copy of the text. A mail that only carries the title and the original link would fit; carrying the text would not. |
| 1.6 | **Podcasts: an audio player, a queue, resume where you left off** | Feedbin plays podcast episodes in the page, keeps a "now playing" state, a queue and a "recently played" list. It also keeps download limits per podcast. | A lot of RSS readers' users also follow a few podcasts. | Large | Check. The floor says "play media in the publisher's player", so a bare audio element is the most it could be. SPEC has no audio today. This is a milestone-sized product decision, not a polish item. |
| 1.7 | **Full-screen reading** | A key (capital `F`) hides everything but the article. | Gives the "book" feeling. | Small | Fits. nine turtles already hides the sidebar and list with `[`, `]` and `\`, which is nearly the same; only a discoverable one-key name might be missing. Probably already covered. |
| 1.8 | **"Fix feeds" for broken feeds** | When a feed's address dies, Feedbin offers a replacement it found for you, with a one-click swap. | nine turtles has "Find new address" and the Feed health page, so this is mostly covered. Worth a look at whether the swap is as one-click as theirs. | Small | Fits. |
| 1.9 | **More themes** | Five: Auto, Day, Sunset, Dusk, Night. | nine turtles has Original and Plain, each with Light and Dark, which is deliberately fewer. | Small | Check. DESIGN.md's "boring and few" argues no. Sunset (a warm paper tone) could suit a book-like app, but it is the owner's taste call. |
| 1.10 | **`Space` to read onward** | `Space` scrolls the article a page, and at the end opens the next unread article. | Reading a whole inbox with one key is lovely. | Small | Fits. SPEC section 19 lists `j`/`k` but no `Space`. |
| 1.11 | **Add a feed by searching for a name** | Feedbin has a feed search (`feed_search`) so you can type a site's name instead of a web address. | Lowers the first-minute barrier for new readers. | Medium | Check. It would need a directory of feeds, which means an outside service or our own list (starter packs were dropped for that reason). The website's feed finder is the nearest thing we have. |
| 1.12 | **Save a web page as an article ("pages")** | A bookmarklet and browser share target that save any web page into Feedbin so it can be read there. | Turns the reader into a read-it-later tool. | Medium | **Clashes** with "never fetch an article's web page". Don't build. |
| 1.13 | **Pull the full article from the website ("extract")** | A key (`c`) fetches the whole page of a summary-only article and shows it in the reader. | Readers love it for summary-only feeds. | Medium | **Clashes** with "never scrape" and "show only what the feed contains". Our "Read the full article ›" link is the deliberate answer. Don't build. |
| 1.14 | **Push notifications for new articles** | Web push and phone push for chosen feeds. | | Medium | **Clashes** with "no notifications" (a Never). Don't build. |
| 1.15 | **Public API, browser extension, bookmarklet** | A documented REST API that third-party apps use; a Chrome-style extension. | Lets the many apps built for Feedbin work. | Large | Partly there: section 26 (syncing with Reeder and NetNewsWire) already covers the app-ecosystem need. A browser extension is a separate product. |

---

## 2. Small touches and details worth knowing about

These are details I found by reading the code. Each is a *possible* polish
item, not a gap.

| # | Touch | What Feedbin does | Why it might matter | Effort | Fit |
|---|---|---|---|---|---|
| 2.1 | **Substack and Ghost-style clean-up** | Its content pipeline has special handling for Substack posts (it keeps only the post body, not the page chrome the feed sometimes carries) and for Ghost "bookmark cards" (so they don't look broken). | Two of the most common newsletter and blog platforms in a reader's feed list. Looking right out of the box is what "the writing looks like a book" means. | Small each | Fits (it only restyles what the feed contains). Worth testing a few real Substack and Ghost feeds against our sanitiser. |
| 2.2 | **Images with controls** | A filter adds controls around figures (for example open full size). | We show images but, as far as SPEC says, don't offer opening one larger. | Small to Medium | Check. A plain "open the image" link fits; a pop-up gallery is a decoration. |
| 2.3 | **Lazy loading for images** | Images in the article load only as you reach them. | Faster opening of long, picture-heavy posts, and kinder to publishers' servers. | Small | Fits (and "fast by design"). Check that we already use the browser's `loading="lazy"` on article images. |
| 2.4 | **Relative links and image addresses fixed up** | Links and picture addresses that a feed wrote as `/pic.png` are turned into full addresses using the feed's own site. | A common source of broken pictures in cheaper feeds. | Small | Fits. Probably done already; worth a test with a made-up feed. |
| 2.5 | **Confirm before "mark all as read"** | A setting asks "are you sure?" before a bulk mark-as-read. | nine turtles already has Undo, which is a calmer answer than a question. | Small | Skip. Undo wins. |
| 2.6 | **Keep read items in the list for the session ("sticky view")** | An item you just read stays in the Unread list until you leave it, so the list doesn't jump under you. | Matches "nothing moves unless you move it". Worth checking that nine turtles behaves the same way. | Small | Fits. Probably already how it works (SPEC section 13: the view waits for you). |
| 2.7 | **Reading width and text size as two separate settings** | A "wide / narrow" switch and a font size, both live. | nine turtles already has Narrow/Medium/Wide and six text sizes. | none | Already covered. |
| 2.8 | **Favicon-derived colours** | A setting colours rows by their site's logo colours. | | Small | **Clashes** with the accent rules (the accent marks only what's yours to look at). Don't build. |
| 2.9 | **Sparkline of how often a feed posts** | A small line chart on each feed's settings page showing posts per day over time. | Helps decide to unfollow a feed that posts 40 times a day, with no judgement. | Small to Medium | Check. It describes the *feed*, not the reader's habits, so it is not "reading stats". Still decorative; the Feed health page could say "about 12 a week" in words instead. |
| 2.10 | **Folder open/close from the keyboard** | `e` expands or collapses the selected folder; `Shift+E` opens the feed's settings. | Mouse-free tidying. | Small | Fits. SPEC section 19 has no key for either. |
| 2.11 | **Copy the link with a key** | `C` selects the article's address so you can copy it. | nine turtles has Copy link in the More menu, but a key is a nice extra. | Small | Fits. |
| 2.12 | **Remember the column widths** | The sidebar and list widths can be dragged and are kept. | | Small | Check. Fine for a person with a big screen, but it adds a hidden control; low priority. |
| 2.13 | **Image previews in the list** | The list can show a small picture beside each title (it even finds faces so the crop looks right). | Many readers like it. | Medium | **Clashes in spirit** with "reading first, calm over engagement"; Apple Books' list leads with titles. Don't build. |
| 2.14 | **Quieter "Updated" and "Recently read" collections** | Both can be switched off in settings (`hide_recently_read`, `hide_updated`). | The principle is good: every extra list in the sidebar should be removable. | Small | Fits, and a good rule for any list we add from section 1. |

---

## 3. Things Feedbin does in a better way

What follows is about *how* something is done, not whether it exists.

| # | Area | What they do better | What nine turtles does now | What we could learn | Effort |
|---|---|---|---|---|---|
| 3.1 | **Cleaning up feed HTML** (technical) | A fixed, ordered pipeline of small filters, each doing one job: scrub, fix addresses, lazy-load, handle embeds, then platform-specific ones (Substack, Ghost). Easy to add a quirk without touching the rest. | A sanitiser that keeps things safe; SPEC says it is cleaned like any feed. | Worth looking at whether our clean-up is split into small, named, tested steps, so a Substack or Ghost quirk is a one-file fix with its own test. | Medium |
| 3.2 | **Settings stored as one flexible bag** (technical) | All reader preferences live in one JSON column, so adding a setting needs no database change. | Preferences are in their own structure and every structure change takes a pre-change backup (decision 0076). | Not worth copying. Our care around structure changes is deliberate and the owner's floor is "never lose data". Listed so nobody wonders. | none |
| 3.3 | **Edited-article tracking** (technical and reading) | Stores the first version beside the latest. | We keep the latest only. | See item 1.3. | Medium |
| 3.4 | **Searching with saved "rules"** (technical) | A rule runs *as articles arrive* (it is checked against each new item), not by re-scanning old ones, and can also be applied to existing items once. Rules can also mute. | We have rules and mutes (SPEC section 27). | Check that our rules also have a "apply to what's already here" button and that the screen says so in words. | Small |
| 3.5 | **Newsletters** (product) | Feedbin gives each reader a private address and shows senders in a list the reader can toggle. | nine turtles has the same idea (section 28). | Compare the sender list for ease of "stop this sender". | Small |
| 3.6 | **Keyboard coverage** (UI) | About 25 keys including `Space`, folder toggles, edit, copy link, full screen. | About 20 (SPEC section 19), with a better cheat sheet that has search and groups. | Add `Space` and the folder key; our cheat sheet is ahead. | Small |
| 3.7 | **Billing, plans and the app-store receipts** (business) | Years of handling cancellations, coupons, trials, receipts and refunds. | Dodo (merchant of record) handles the hard parts (section 29). | Nothing to copy; being a merchant of record already avoids their biggest chore. | none |
| 3.8 | **Operating at scale** (technical) | Queues, a search server, a separate crawler, an image proxy, a face finder. | One program, one SQLite file, FTS5 search. | Not worth copying. Their parts exist because they serve many thousands of readers; for 100 to 200 readers "boring and few" is right. One idea is worth keeping: an **image proxy** hides the reader's address from the publisher's image server. See below. | Large |

### One privacy idea worth a decision

Feedbin offers an optional **image proxy** (the "Privacy Please" service):
article pictures come through the reader's own server, so the publisher's
image host never sees the reader's address or can track them with tiny
pictures. nine turtles' floor says to be safe and respect the reader, and
SPEC section 7 says nine turtles loads pictures straight from the
publisher's site and removes only invisible 1×1 tracking pixels. So the
publisher's image host can still see the reader's address and when they
read. A proxy would close that. It costs bandwidth on one small server and some cache
disk, so it is a decision for the owner, not a quick fix. (Effort: Large.
Fit: Fits, and it serves a floor.)

---

## What I'd look at first

If the owner wants to borrow anything, I'd rank by "most book-like for the
least work", all of them Small and all of them fitting:

1. **Mark above / below as read** (1.1).
2. **`Space` to read onward** and the folder and copy-link keys (1.10, 2.10, 2.11).
3. **Test real Substack and Ghost feeds** and fix what looks wrong (2.1).
4. **Check lazy-loading and relative addresses** (2.3, 2.4).
5. A **Recently read** view (1.2), if the owner wants it.

Bigger questions for the owner, none urgent: podcasts (1.6), showing
edited articles (1.3), an image proxy (privacy idea above), and whether a
warmer third theme is wanted (1.9).

Things to say no to, on purpose: platform share buttons, page saving,
full-page extraction, push notifications, list thumbnails and
logo-coloured rows (1.4, 1.12, 1.13, 1.14, 2.13, 2.8).

## What this research did not do

- It read Feedbin's code, not its live product, so how things *feel* is
  guessed from the code and not tested.
- It did not run nine turtles against each point. Where I wrote "probably
  already done", a quick check in the app is the first step before anyone
  builds.
- It did not look at Feedbin's mobile apps (they are separate) or its
  paid-only back end.
