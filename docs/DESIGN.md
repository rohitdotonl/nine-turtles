# slowfeed: UI & UX design philosophy

> **slowfeed is a quiet place to read the web: it shows you what's there, gets out of the way, and lets you finish.**

*Last updated: 23 October 2026 (Milestone 4: type scale, spacing, area tones and greys defined). This document takes precedence over every other project document when they conflict.*

## Mission

Help people leave social media and return to reading text from the open web.

Social media is designed to be **infinite, urgent, and attention-grabbing**. slowfeed is designed to be **finite, calm, and quiet**.

**The tiebreaker for every decision:** *Does this make slowfeed feel more like a book, or more like a feed?*

## What slowfeed is, and isn't

**slowfeed is** a reader for writing published on the open web through RSS, Atom and JSON Feed, for one person per installation.

**slowfeed is not:**
- **A read-later app.** It doesn't save arbitrary web pages.
- **A discovery engine.** No recommendations, trending lists or "you might like." You choose your sources.
- **A social network.** No profiles, followers, likes or comments.
- **A podcast player.** Audio in feeds appears as a link to the original. (YouTube videos will play through YouTube's own player in V2.)
- **A newsletter inbox.** No email address that turns newsletters into feeds.
- **A web scraper.** It shows what publishers put in their feeds. See the second floor.
- **A permanent archive.** Unstarred articles are kept for one year. (In V1, nothing is removed yet; the yearly clean-up comes in V2.)
- **A multi-user service.** Not in V1. (This one is "not yet," not "never.")

---

## Part 1: The philosophy

The principles below explain *why*. Every design decision in Part 2 should be traceable to one of them. When a new question comes up, reason from these rather than debating it from scratch.

There are **two floors** and **seven ranked principles**. Floors are not ranked: nothing can trade them away. Ranked principles resolve conflicts between themselves: **the higher one wins**.

### The first floor: everyone can read here

No amount of calm or minimalism justifies text some people can't read.

- **Contrast:** WCAG AA minimum everywhere; aim for AAA in article text. This applies to muted text too (read items, counts, source names), which is where minimal designs most often fail.
- **Never color alone:** every state has a non-color signal as well (a bar, a weight change, a word).
- **Fully keyboard-operable:** vim keys *and* standard Tab / Enter / Escape, with a visible focus ring. Vim keys are a power feature; standard keys are the floor.
- **Screen readers:** the panes are proper landmarks; the selected item and state changes (e.g. "marked as read") are announced. Each article carries its language, so screen readers pronounce it correctly.
- **Respect system settings:** text size, reduced motion, high contrast, light/dark.
- **Touch targets:** at least 44px on mobile, even when the visual design is dense.

**Test:** Can someone use every feature with only a keyboard, only a screen reader, or at 200% text size?

### The second floor: respect the publisher

Publishers are the reason there is anything to read. slowfeed never trades their interests for convenience.

- **Show what the publisher chose to put in the feed.** Never scrape the full article from their site. If a feed only offers a summary, slowfeed shows the summary and "Open original."
- **Always credit the source** and link to the original article.
- **Fetch politely:** on each feed's own rhythm, with ETag / Last-Modified. (WebSub, where the publisher offers it, comes in V2.)
- **Shared links always go to the publisher,** never to slowfeed.
- **Embedded media plays through the publisher's own player** (for example, YouTube's player in V2), so views stay theirs.

**Test:** Would a publisher be glad their feed is read in slowfeed?

### The ranked principles

#### 1. Reading comes first
The article is the product. Everything else is a way to get to it.
- *Explains:* in-app reading of feed content, serif by default, no images in the list, curated reader controls, links that don't compete with the text.
- **Test:** Does this make reading better, or does it compete with it?

#### 2. Calm over engagement
slowfeed never tries to bring you back or keep you longer. It succeeds when you've read what you wanted and closed it.
- *Explains:* no notifications, river mode (V2), no count on "new items," no pull-to-refresh, the view waiting for you, the "Show older items" button instead of infinite scroll.
- **Test:** Would a social media company want this feature? If yes, be suspicious.

#### 3. Clear at a glance
Anyone should understand any screen within a second: what it's for, where they are, what they can do.
- *Explains:* regions separated by tone, one accent with one meaning, words alongside icons, the search scope chip, a plain name.
- **Test:** The squint test (blur your eyes: are the regions still distinct?) and the five-second test (can someone say what the screen is for and where the main action is?).

#### 4. Slow app, fast interface
The *experience* is slow; the *software* never is.
- Every action feels instant (target: under ~100 ms).
- No spinners for things the app already has. Prefetch the next article so `j` is always instant.
- Act immediately, confirm silently; sync happens behind the scenes.
- No transitions: views switch instantly. Animation makes an interface *feel* slower.
- **Test:** Does the user ever wait for the interface rather than for themselves?

#### 5. Nothing moves unless you move it
Layout, positions, and content stay put. Change happens only as a result of the user's action.
- *Explains:* the fixed three-pane layout, manual view refresh, "+ Add feed" always in the same place, "mark all as read" only affecting what you've seen, older items loading only when asked, no redesigns that rearrange learned things.
- **Test:** Could this surprise someone who looked away for a second?

#### 6. Power is hidden, never missing
The 500-feed user gets everything they need; the 30-feed user never sees the machinery.
- *Explains:* vim keys, search filter syntax, multi-folder feeds, the search options panel, the feed health page in settings (V2), progressive disclosure in the sidebar.
- **Test:** Does a beginner have to see this to use the app? If not, hide it until it's needed.

#### 7. Respect: for the reader and for time
- **The reader:** their data is theirs (OPML import and export, export of starred articles). They are free to leave.
- **Time:** nothing is designed to look dated next year. No trends, no glass, no decoration.
- **Test:** Would this still feel right in ten years?

(Respect for the publisher is the second floor, above all ranked principles.)

### Rules about the rules

1. **Exceptions are written down.** When we break a principle, we record where, why, and under what limits. See the Exceptions log below. Floors have no exceptions: they can't be bent case by case. Only the owner can change a floor's wording, deliberately, through a note in `docs/decisions/`.
2. **New features go through the floors and principles in order** and stop at the first "no":
   1. Does it break a floor (accessibility or publisher)? → no.
   2. Does it hurt reading? → no.
   3. Does it pull people back or keep them longer than they wanted? → no.
   4. Can people understand it at a glance? If not, can it be hidden for power users?
   5. Is it instant?
   6. Does it move or rearrange anything the user didn't ask to change? → redesign it until it doesn't.
   7. Will it still feel right in ten years?
3. **Scope is checked too.** If a feature would make slowfeed one of the things listed under "slowfeed is not," it's out, however good it is.

**Worked example: "AI summaries of articles."** It competes with reading (1): it's a way to avoid the article. But a power user (6) might want it to triage 500 feeds. Result: never in the reading pane; possibly an opt-in, hidden triage tool in the list. The philosophy didn't answer yes or no; it answered *where*.

**Worked example: "Fetch the full article when a feed only has a summary."** It would help reading (1), but it breaks the publisher floor. Floors aren't ranked against principles, so the answer is no: show the summary and "Open original."

### Exceptions log

| Exception | Principle bent | Why | Limits |
|---|---|---|---|
| Unread counts in V1 | 2. Calm over engagement | Power users with hundreds of feeds need to know what they've seen | Inbox mode only. Muted grey numbers, right-aligned in the sidebar. Never badges, never colored. Per feed and per folder only; no global total. Above 999 shows "999+". |
| Sidebar search always visible | 6. Power is hidden, never missing | The owner wants finding a feed by name to be always available, whatever the number of feeds | A single quiet search field in the sidebar that filters feeds and folders by name. Nothing else in the sidebar skips progressive disclosure. |

### Never

slowfeed will never have:
- Notifications of any kind
- Badges, streaks, reading stats, or any gamification (no reading-time estimates, no "year in reading")
- Infinite scroll or algorithmic ranking ("for you")
- In-app likes, comments, or social features
- Branded share buttons for specific platforms
- Full-article scraping from publishers' websites
- Redesigns that rearrange things people have learned
- Decoration that doesn't do a job: glass, blur, gradients, shadows, motion for delight

---

## Part 2: Design decisions

These are the first applications of the philosophy. The principle behind each is noted where it isn't obvious.

### Name and signature

- **Name:** slowfeed. *(Check domains, app stores, and trademarks before committing. V1 uses Render's free address, so this isn't blocking.)*
- **Wordmark:** "slowfeed" in lowercase, set in the reading serif. No logo shape, no mascot.
- **Signature:** the ink blue "where you are" accent and the calm itself. The signature is functional, not decorative.

### Visual language

#### Rules
- **Regions are separated by tone, not lines.** Background tone and whitespace distinguish the sidebar, list, and reading pane. No borders, shadows, blur, or gradients.
- **Type does the hierarchy.** Emphasis comes from size and weight, never from color or badges.
- **One accent, one meaning.** Ink blue means "where you are," and nothing else ever uses it.
- **Words alongside icons.** An icon without a label is allowed only when its meaning is universal (close, back, search).
- **No motion.** Views switch instantly.

#### Color

| Role | Off-white | Sepia | Dark |
|---|---|---|---|
| Background (starting value) | `#F8F6F1` | `#F3E9D2` | `#1C1B19` |
| Accent: ink blue ("where you are") | `#2F4A7A` | `#2F4A7A` | `#8FA9D6` |
| Accent contrast against background (approx.) | 8.2 : 1 | 7.3 : 1 | 7.3 : 1 |
| List area (one step deeper) | `#F2EFE8` | `#EDE2C8` | `#211F1D` |
| Sidebar (two steps deeper) | `#EBE7DE` | `#E6D9BC` | `#272522` |
| Text | `#1F1E1C` | `#2A241B` | `#E8E4DC` |
| Muted grey, warm (chosen October 2026) | `#61564A` | `#5C4F3F` | `#B3A690` |

- All three accent pairs pass AAA (7 : 1). Re-check if any value changes.
- **Links in articles** are underlined in the normal text color, **never blue**, so they never compete with the accent.
- **Areas by tone:** the reading area uses the theme's background; the list and the sidebar are one and two steps deeper.
- **Muted greys** (read items, counts, source names) are warm, with a hint of brown, like ink on paper (the owner's choice, Milestone 4). They pass AA (at least 4.5 : 1) on every area and on the selected-row tint, in all three themes, verified by automatic checks.
- **The keyboard's focus outline** is a thick line in the text color, never ink blue.
- **Status colors** (errors, warnings on the feed health page, V2) use muted tones that don't drift toward blue, and always come with words.

#### Themes
- Follow the system light/dark setting by default, with a manual override in settings.
- Three themes: **off-white** (default light), **sepia**, **dark**.

#### Typography

| Use | Typeface | Why |
|---|---|---|
| Reading (default) | **Literata** | Designed for long-form reading on screens |
| Reading (alternate sans) | **Atkinson Hyperlegible** | Designed for legibility, including for low vision |
| Interface | **Inter** | Neutral and very clear at small sizes |
| Code inside articles | **JetBrains Mono** | Clear monospace for code blocks |

- All fonts are free to use and served by slowfeed itself (no requests to third-party font services).
- **Other scripts** (for example, Hindi in Devanagari): fall back to the fonts already on the reader's device. No extra downloads.
- **A short, fixed type scale, five sizes** (defined in Milestone 4): small 14px (source names, times, hints) · base 16px (the interface) · large 20px (area headings) · extra large 24px (the wordmark in the sidebar, screen titles) · display 48px (the wordmark on the sign-in page). Article text has its own size, set by the reader (six steps, 16 to 28px, 20px by default).
- **Spacing** uses steps of 4px, mostly 8, 16, 24, 40 and 64px.
- **Weights:** regular and bold for reading; regular and semibold (600) for the interface. Emphasis comes from these and size, never from color.
- Article line length of roughly 65–75 characters, with generous leading.

#### Languages
- **Interface:** English only in V1.
- **Articles:** any language. Each article is marked with its language (taken from the feed) for screen readers and correct typography.
- **Search** works for English, other Latin-script languages and Hindi from day one. Chinese and Japanese search are not in V1.

### Layout

- **Three panes:** feeds | items | article (in the style of NetNewsWire).
- **One layout that adapts to width:** three panes on wide screens, two on medium, one column on phones. There are no user-facing layout modes.
- **Collapsible sidebar** via a toggle in a fixed position (and the `[` key), for people who want fewer panes.

### Sidebar

Fixed order, top to bottom:
1. **Fixed views:** Unread · Starred · All
2. **Folders**, alphabetically
3. **Feeds not in any folder**, alphabetically
4. **"+ Add feed"**, always at the bottom

- No manual ordering.
- Progressive disclosure: folders appear once at least one exists. The sidebar search (find a feed by name) is always shown; see the Exceptions log.
- **Folders:** one concept in the interface. A feed can belong to more than one folder (tags underneath, folders on screen).
- **Unread counts:** see the Exceptions log.
- Broken feeds appear normally; they simply show nothing new until fixed. In V1, problems are reported by the daily check; the feed health page comes in V2.

### Item list

- **No images and no favicons.** Each row shows the **title**, with the **source name and time** as quiet small text below.
- **Default sort:** newest first; can be changed in settings.
- **The list has an end.** It shows a fixed number of items; a **"Show older items"** button at the bottom loads the next set. Nothing loads unless the reader asks.
- Matched search terms are shown in **bold**, never highlighted in color.

#### Item states (distinguished by tone and weight, never color alone)

| State | Treatment |
|---|---|
| Unread | Full-contrast title |
| Read | Muted grey title |
| Selected (cursor) | Ink blue left bar + faint ink blue tint |
| Starred | A small star mark |

In river mode (V2), unread and read states don't exist on screen; only the cursor and star remain.

### Article view

- **In-app reading of the publisher's feed content,** cleaned and restyled consistently: headings, quotes, code, tables, footnotes, and in-article images.
- **Summary-only feeds** show the summary as given, with "Open original" for the rest. slowfeed never fetches the full article from the website (second floor).
- **Images** in articles load normally from the publisher. Invisible tracking images (1×1 pixels) are removed because they're junk in the article.
- **"Open original"** is always present, always in the same place.
- **Share** sits next to "Open original" (see Sharing).
- Prefetch the next article for instant `j`.

### Reading modes

*V1 has inbox mode only. River mode comes in V2 (decided with the owner, 23 October 2026). The table describes both, for when it arrives.*

| | Inbox (default) | River |
|---|---|---|
| Idea | Things to get through | Things flowing past; dip in when you like |
| Unread view | Yes | No |
| Read/unread styling | Yes | No |
| Unread counts | Yes (muted) | No |

- A global setting when river mode arrives in V2.
- **Read state is tracked quietly in both modes,** so switching modes never loses history.

### Read state and bulk actions

- An item becomes **read when opened.** On desktop, selecting an item (with `j`/`k` or a click) shows it in the reading pane, and that counts as opened, as in NetNewsWire.
- **`m`** marks the current item unread again.
- **Mark all as read:** instant, with **undo**. No confirmation dialog.
- Mark all as read **only affects items currently shown**. Items fetched in the background but not yet displayed are never touched.

### Star

- One concept: **Star** (no separate "read later"). In inbox mode, the unread list already works as a reading queue.
- Starred items live in the Starred view and are kept forever.

### Sharing

- Uses the **system share sheet** on mobile and **Copy link** on desktop. No branded platform buttons.
- Shares the **original article's link**, not a slowfeed link.
- Available in the article view only.

### Search

- **`/`** focuses the search field. A **search icon** and a **tuning (sliders) icon** sit together; the tuning icon has a tooltip ("Search options").
- **Scope defaults to where you are,** shown as a removable chip inside the field, e.g. `[ in: Tech × ]`. Remove the chip to search everything.
- **The chip shows the scope; the tuning panel edits it.** They stay in sync. The panel offers:
  - Scope: current location · all feeds · a specific folder · a specific feed
  - Unread only · Starred only · Date range
- **Always full text.** Titles and bodies are searched together; title matches rank higher. No toggle.
- **Filter syntax for power users** (Gmail-style), autocompleted and documented in the `?` cheat sheet:
  `is:unread` · `is:starred` · `feed:name` · `folder:name` · `after:YYYY-MM-DD` · `before:YYYY-MM-DD`
  Typed filters become chips, so the field always shows exactly what's being searched. The tuning panel is a friendlier way of writing the same filters.
- **Results reuse the item list:** same look, same keys, "mark all as read" applies to the results.
- Keyboard: Tab moves from the field into the panel; Escape closes everything and returns you to where you were.

### Refresh

- **The server fetches in the background, on each feed's own rhythm.** Frequent publishers are checked often; dormant blogs rarely. Use ETag / Last-Modified.
- **WebSub comes in V2:** when a publisher offers it, slowfeed will receive their updates as they publish, with regular checking continuing less often alongside.
- **The view waits for you.** It updates only when you press `r` or the Refresh button. Because fetching already happened, this is instant.
- **Fresh on arrival:** opening or reloading the app shows the latest state.
- **One quiet line, no number:** when new items are waiting, a single line appears in a reserved spot at the top of the list: "New items · press `r`." Its space is reserved, so nothing shifts when it appears.
- **No pull-to-refresh.** On mobile, a labeled Refresh button sits in the top bar instead.

### Empty state

Shown until the first feed is added:

> **[ Paste a website or feed URL ]**
> Import OPML

- Accepts a **website** URL, not just a feed URL; slowfeed finds the feed (autodiscovery).
- The "New to feeds? Here's how they work" guide page comes in V2.

### Adding feeds

- **"+ Add feed"** at the bottom of the sidebar, always in the same place, plus the `a` key.
- Uses the same input and autodiscovery as the empty state.

### Folders and OPML

- A feed can be in several folders.
- **Export:** a feed in several folders appears under each of them in the OPML file.
- **Import:** the same feed appearing in several places becomes one feed in several folders.

### Mobile

- **Single-column drill-down:** Feeds → Items → Article. The feeds list is the home screen; there's no hamburger menu.
- **Top bar:** a back arrow labeled with its destination (e.g. "‹ Tech"), plus the current screen's title. A Refresh button on list screens; search and tuning icons on the feeds and items screens.
- **Back:** the system edge-swipe and back button.
- **No custom swipe gestures** on list items.
- **Article bottom toolbar** (thumb reach): previous · next · star · share · open original.
- Touch targets of at least 44px.
- **Installable** to the home screen on both iPhone and Android (as a web app), opening full-screen with its own icon.

### Keyboard

Vim-style keys are first-class. A permanent, unobtrusive hint says "Press ? for shortcuts."

| Key | Action |
|---|---|
| `j` / `k` | Next / previous item |
| `Shift+J` / `Shift+K` | Next / previous feed |
| `Enter` / `o` | Open item |
| `v` | Open original |
| `s` | Star / unstar |
| `m` | Mark current item unread |
| `Shift+A` | Mark all as read |
| `u` | Undo |
| `r` | Show new items |
| `/` | Search |
| `a` | Add feed |
| `g` then `u` / `s` / `a` | Go to Unread / Starred / All |
| `[` | Show / hide sidebar |
| `+` / `-` | Text size while reading |
| `Esc` | Back / close |
| `?` | Shortcut cheat sheet |

### Sign-in

- slowfeed has a public address, so it has a simple **single-user password sign-in**.
- Each device stays signed in for a long time, so the password is rarely typed.
- Passkeys (Face ID, fingerprint) are planned for later.

### Settings

- **Reader controls:** reading font (Literata default, or Atkinson Hyperlegible), text size, line width, theme (system / off-white / sepia / dark).
- **Reading:** sort order (newest first default). Inbox or river mode in V2.
- **Feed health page (V2):**
  - Sorted by severity: dead feeds first, then intermittent errors.
  - Problems described in plain words ("Hasn't worked for 3 weeks — the site may have moved"), not HTTP codes.
  - Actions per feed: **Retry · Find new address · Unsubscribe.** "Find new address" reruns autodiscovery.
- **Your data:** OPML import and export; export of starred articles.
- **Keeping articles (V2):** unstarred articles, read or not, are removed after one year. Starred articles are kept forever. In V1, all articles are kept.

### Voice

- Plain, unhurried, never urgent. "Nothing new yet," never "You're missing out!"
- Labels say what things are and do. No exclamation marks, no hype.

---

## Still to define

- Status colors for the feed health page in V2 (verified against the first floor)
- Domain, app store, and trademark checks for "slowfeed" (not blocking V1)

## V2 parking lot

- **YouTube videos** played through YouTube's own player.
- **Public reading list page:** an optional public page listing some of your feeds (a modern blogroll), with one-click subscribe for visitors. No likes, no comments.
- **Per-feed modes:** choose inbox or river for each feed.
- **Passkey sign-in.**
- **Chinese and Japanese search.**
- **Multiple users.**
- **Own domain name.**

Moved here from V1 on 23 October 2026, because V1 is for the owner alone (`docs/decisions/0012-v1-for-one-reader.md`):

- **Backups and recovery:** nightly copies outside the host, and a copy before every database structure change.
- **River mode** (V1 has inbox mode only).
- **WebSub:** instant updates from publishers who offer it.
- **Feed health page** in Settings.
- **The yearly clean-up** of unstarred articles.
- **The "New to feeds?" guide page.**
- **A tab left open across an update keeps working** without a reload.
