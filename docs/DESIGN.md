# slowfeed: UI & UX design philosophy

> **slowfeed is a quiet place to read the web: it shows you what's there, gets out of the way, and lets you finish.**

*Last updated: 24 October 2026 (the owner approved a new look: a role-based type scale, three ink levels, deeper area tones and one selection style; decision 0026). This document takes precedence over every other project document.*

## Mission

Help people leave social media and return to reading the open web. Social media is **infinite, urgent and attention-grabbing**; slowfeed is **finite, calm and quiet**.

**Tiebreaker for every decision:** *does this make slowfeed feel more like a book, or more like a feed?*

## What slowfeed is, and isn't

**slowfeed is** a reader for writing published through RSS, Atom and JSON Feed, for one person per installation.

**slowfeed is not:**
- **A read-later app:** it doesn't save arbitrary web pages.
- **A discovery engine:** no recommendations, trending or "you might like." You choose your sources.
- **A social network:** no profiles, followers, likes or comments.
- **A podcast player:** audio appears as a link to the original. (YouTube plays in YouTube's own player in V2.)
- **A newsletter inbox:** no email address that turns newsletters into feeds.
- **A web scraper:** it shows what publishers put in their feeds (second floor).
- **A permanent archive:** unstarred articles are kept for one year (the clean-up comes in V2; V1 keeps everything).
- **A multi-user service:** not in V1 ("not yet," not "never").

---

## Part 1: The philosophy

Every decision in Part 2 traces back to these. Reason from them rather than debating new questions from scratch.

**Two floors** and **seven ranked principles.** Floors are not ranked: nothing can trade them away. Between ranked principles, **the higher one wins**.

### The first floor: everyone can read here

No amount of calm or minimalism justifies text some people can't read.

- **Contrast:** WCAG AA minimum everywhere; aim for AAA in article text. This includes muted text (read items, counts, source names).
- **Never color alone:** every state also has a non-color signal (a bar, a weight, a word).
- **Fully keyboard-operable:** standard Tab / Enter / Escape with a visible focus ring are the floor; vim keys are a power feature on top.
- **Screen readers:** panes are landmarks; the selected item and state changes ("marked as read") are announced; each article carries its language.
- **Respect system settings:** text size, reduced motion, high contrast, light/dark.
- **Touch targets:** at least 44px on mobile, however dense the design.

**Test:** can someone use every feature with only a keyboard, only a screen reader, or at 200% text size?

### The second floor: respect the publisher

Publishers are the reason there's anything to read.

- **Show what the publisher put in the feed.** Never scrape the full article. A summary-only feed shows the summary and "Open original."
- **Always credit the source** and link to the original.
- **Fetch politely:** on each feed's own rhythm, with ETag / Last-Modified (WebSub in V2).
- **Shared links go to the publisher,** never to slowfeed.
- **Embedded media plays in the publisher's own player** (e.g. YouTube's, V2), so views stay theirs.

**Test:** would a publisher be glad their feed is read in slowfeed?

### The ranked principles

#### 1. Reading comes first
The article is the product; everything else is a way to reach it.
- *Explains:* in-app reading, serif by default, no images in the list, curated reader controls, links that don't compete with the text.
- **Test:** does this make reading better, or compete with it?

#### 2. Calm over engagement
slowfeed never tries to bring you back or keep you longer. It succeeds when you've read what you wanted and closed it.
- *Explains:* no notifications, river mode (V2), no count of new items, no pull-to-refresh, the view waiting for you, "Show older items" instead of infinite scroll.
- **Test:** would a social media company want this? If yes, be suspicious.

#### 3. Clear at a glance
Anyone understands any screen within a second: what it's for, where they are, what they can do.
- *Explains:* regions separated by tone, one accent with one meaning, words beside icons, the search scope chip, a plain name.
- **Test:** squint (are the regions still distinct?) and five seconds (can someone say what the screen is for and where the main action is?).

#### 4. Slow app, fast interface
The experience is slow; the software never is.
- Every action feels instant (under ~100 ms). No spinners for what the app already has; prefetch the next article so `j` is instant.
- Act immediately, confirm silently; sync happens behind the scenes.
- No transitions: views switch instantly. Animation makes an interface *feel* slower.
- **Test:** does the user ever wait for the interface rather than for themselves?

#### 5. Nothing moves unless you move it
Layout, positions and content change only through the user's action.
- *Explains:* the fixed three-pane layout, manual refresh, "+ Add feed" always in one place, "mark all as read" only affecting what you've seen, older items loading only when asked, no redesigns that rearrange learned things.
- **Test:** could this surprise someone who looked away for a second?

#### 6. Power is hidden, never missing
The 500-feed user gets everything; the 30-feed user never sees the machinery.
- *Explains:* vim keys, search filter syntax, multi-folder feeds, the search options panel, the feed health page (V2), progressive disclosure in the sidebar.
- **Test:** does a beginner have to see this? If not, hide it until needed.

#### 7. Respect: for the reader and for time
- **The reader:** their data is theirs (OPML import and export, starred export); they're free to leave.
- **Time:** nothing that looks dated next year. No trends, no glass, no decoration.
- **Test:** would this still feel right in ten years?

(Respect for the publisher is the second floor, above all of these.)

### Rules about the rules

1. **Exceptions are written down** in the Exceptions log below: where, why and within what limits. Floors have no exceptions; only the owner can change a floor's wording, through a note in `docs/decisions/`.
2. **New features go through the floors and principles in order** and stop at the first "no":
   1. Does it break a floor? → no.
   2. Does it hurt reading? → no.
   3. Does it pull people back or keep them longer than they wanted? → no.
   4. Is it clear at a glance? If not, can it be hidden for power users?
   5. Is it instant?
   6. Does it move or rearrange anything the user didn't ask to change? → redesign until it doesn't.
   7. Will it still feel right in ten years?
3. **Scope is checked too.** A feature that would make slowfeed one of the things under "slowfeed is not" is out, however good.

**Worked example: AI summaries.** They compete with reading (1), but a power user (6) might want them to triage 500 feeds. Result: never in the reading pane; possibly an opt-in, hidden triage tool in the list. The philosophy answered *where*, not yes or no.

**Worked example: fetch the full article when a feed has only a summary.** It would help reading (1) but breaks the publisher floor. Floors aren't ranked against principles, so the answer is no: show the summary and "Open original."

### Exceptions log

| Exception | Principle bent | Why | Limits |
|---|---|---|---|
| Unread counts in V1 | 2. Calm over engagement | Power users with hundreds of feeds need to know what they've seen | Inbox mode only. Muted grey, right-aligned in the sidebar. Never badges or color. Per feed and folder only, no global total. Above 999 shows "999+". |
| Sidebar search always visible | 6. Power is hidden, never missing | The owner wants finding a feed by name always available | One quiet field that filters feeds and folders by name. Nothing else in the sidebar skips progressive disclosure. |

### Never

- Notifications of any kind
- Badges, streaks, reading stats or any gamification (no reading-time estimates, no "year in reading")
- Infinite scroll or algorithmic ranking ("for you")
- In-app likes, comments or social features
- Branded share buttons for specific platforms
- Full-article scraping from publishers' websites
- Redesigns that rearrange things people have learned
- Decoration that does no job: glass, blur, gradients, shadows, motion for delight

---

## Part 2: Design decisions

The philosophy applied. The principle is noted where it isn't obvious.

### Name and signature

- **Name:** slowfeed (domain, app store and trademark checks are under "Still to define").
- **Wordmark:** "slowfeed" in lowercase, in the reading serif. No logo shape, no mascot.
- **Signature:** the ink blue "where you are" accent and the calm itself.

### Visual language

#### Rules
- **Regions are separated by tone, not lines:** background tone and whitespace; no borders, shadows, blur or gradients.
- **Type does the hierarchy:** size and weight, never color or badges.
- **One accent, one meaning:** ink blue means "where you are," and nothing else uses it.
- **Icons where the convention is an icon** (close, back, search, settings, the sidebar toggle, and the article's copy link, star and mark unread), each named in its tooltip with its key and to screen readers. **Words** for the way to the publisher ("Open original"), Add feed, and the main action of a form.
- **No motion.** Views switch instantly.

#### Color

| Role | Off-white | Sepia | Dark |
|---|---|---|---|
| Background (reading area) | `#F8F6F1` | `#F4EBD7` | `#1A1917` |
| Accent: ink blue ("where you are") | `#2F4A7A` | `#2F4A7A` | `#8FA9D6` |
| Accent contrast against background (approx.) | 8.2 : 1 | 7.3 : 1 | 7.3 : 1 |
| List area (one step deeper) | `#F0ECE3` | `#ECE1C8` | `#201E1B` |
| Sidebar (two steps deeper) | `#E7E2D7` | `#E3D5B7` | `#282521` |
| Text | `#1F1E1C` | `#2A241B` | `#E6E1D8` |
| Second ink: read titles, sidebar names, quieter actions | `#47423B` | `#463C2F` | `#C9C2B6` |
| Muted grey, warm (owner's choice, Milestone 4): meta, counts, hints | `#61564A` | `#5E5141` | `#AA9E89` |

- All accent pairs pass AAA (7 : 1); re-check if a value changes.
- **Links in articles** are underlined in the text color, **never blue**.
- **Muted greys** (read items, counts, source names) are warm, like ink on paper, and pass AA (4.5 : 1) on every area and on the selected-row tint in all themes, verified by automatic checks.
- **The keyboard focus outline** is a 2px line in the text color, never ink blue. Rows draw it just inside themselves (beside the selected row's bar); a title the keyboard is moved to gets it too, a little away from the words. It shows only when you're using the keyboard.
- **Status colors** (errors, warnings; V2 feed health page) are muted, never drift toward blue, and always come with words.

#### Themes
Three: **off-white** (default light), **sepia**, **dark**. Follow the system light/dark setting by default, with a manual override in settings.

#### Typography

| Use | Typeface | Why |
|---|---|---|
| Reading (default) | **Literata** | Made for long-form reading on screens |
| Reading (alternate sans) | **Atkinson Hyperlegible** | Made for legibility, including low vision |
| Interface | **Inter** | Neutral and clear at small sizes |
| Code in articles | **JetBrains Mono** | Clear monospace |

- All fonts are free and served by slowfeed itself (no third-party font services).
- **Other scripts** (e.g. Hindi in Devanagari) use the fonts already on the device; no extra downloads.
- **A fixed type scale by role**, so each level of importance looks different at a glance (size, weight and ink together, never color):
  - meta 13px (times, source names, counts, hints) in muted grey;
  - small 14px (toolbar actions, helper text, labels);
  - interface 15px (sidebar names, list titles);
  - base 16px (text boxes, running interface text);
  - large 20px (section headings inside a screen);
  - heading 24px, in the reading serif (the wordmark, the list's title);
  - extra large 28px (a screen's own title);
  - display 48px (sign-in wordmark).
- Article text is set by the reader: six steps, 16 to 28px, 20px by default. The article's title is 1.8 times the text size, its headings 1.2 and 1.08 times, so the title is always clearly the largest thing on screen.
- **Spacing** in steps of 4px, mostly 8, 16, 24, 40 and 64px.
- **Weights:** regular and bold for reading; regular and semibold (600) for the interface. Semibold marks unread titles, where you are, and the one main action in a toolbar.
- **Three inks:** text (titles, where you are), a second ink (read titles, sidebar names, quieter actions) and muted grey (meta).
- Article lines of roughly 65–75 characters, with generous leading.

#### Languages
- **Interface:** English only in V1.
- **Articles:** any language, each marked with its language (from the feed) for screen readers and typography.
- **Search:** English, other Latin-script languages and Hindi from day one; Chinese and Japanese not in V1.

### Layout

- **Three panes:** feeds | items | article (like NetNewsWire).
- **One layout that adapts:** three panes wide (1200px and up), two medium (896px and up), one column below that, as on phones. No user-facing layout modes.
- **Collapsible sidebar:** a small sidebar-icon toggle in a fixed position at the top-left, and the `[` key.
- **A shared top line:** the wordmark, the list's title and the article's tools sit on one line across the panes, and never scroll.

### Sidebar

Fixed order, top to bottom: **Unread · Starred · All**, then **folders** A–Z, then **feeds not in a folder** A–Z, then at the foot **Add feed** in words, with the shortcut list (keyboard icon) and **Settings** (cog icon) beside it.

- No manual ordering.
- Folders appear once one exists. Sidebar search is always shown (Exceptions log).
- **Folders** are one concept on screen; a feed can be in several (tags underneath).
- **Unread counts:** see the Exceptions log.
- Broken feeds look normal and simply show nothing new. In V1 the daily check reports problems; the feed health page comes in V2.

### Item list

- **No images, no favicons.** Each row: the **title**, with **source name and time** in quiet small text below.
- **Sort:** newest first by default; changeable in settings.
- **The list has an end:** a fixed number of items, then a **"Show older items"** button. Nothing loads unless asked.
- Matched search terms are **underlined** in the text color, never highlighted in color.

#### Item states (distinguished by tone and weight, never color alone)

| State | Treatment |
|---|---|
| Unread | Full-contrast, semibold title |
| Read | Second ink, regular-weight title |
| Selected (cursor) | Ink blue left bar + faint tint, title in full ink; a hairline focus outline beside the bar when using the keyboard |
| Starred | A small star mark |

In river mode (V2) only the cursor and star show.

### Article view

- **The feed's content, read in the app,** cleaned and restyled consistently: headings, quotes, code, tables, footnotes, images.
- **Summary-only feeds** show the summary with "Open original"; never fetch the full article (second floor).
- **Images** load normally from the publisher; invisible 1×1 tracking images are removed.
- **"Open original"** is always present, always in the same place, with **Share** beside it.
- Prefetch the next article for instant `j`.

### Reading modes

*V1 has inbox mode only; river mode comes in V2 (owner's decision, 23 October 2026).*

- **Inbox** (default): things to get through. Unread view, read/unread styling and muted unread counts.
- **River** (V2): things flowing past; dip in when you like. None of those three. A global setting.
- Read state is tracked quietly in both, so switching never loses history.

### Read state and bulk actions

- An item is **read when opened.** On desktop, selecting it (`j`/`k` or click) shows it in the reading pane, which counts as opened.
- **`m`** marks the current item unread.
- **Mark all as read:** instant, with **undo**, no confirmation dialog. It **only affects items currently shown**, never ones fetched but not yet displayed.

### Star

- One concept, **Star** (no separate "read later"; in inbox mode the unread list is the queue).
- Starred items live in the Starred view and are kept forever.

### Sharing

- The **system share sheet** on mobile, **Copy link** on desktop. No branded platform buttons.
- Shares the **original article's link**. Article view only.

### Search

- **`/`** focuses the field. A faint **search icon** starts it and the **tuning (sliders) button** sits inside it at its right end; its tooltip says "Search options." The reserved line says how many results were found.
- **Scope defaults to where you are,** shown as a removable chip in the field, e.g. `[ in: Tech × ]`. Remove it to search everything.
- **The chip shows the scope; the tuning panel edits it;** they stay in sync. The panel offers scope (current location · all feeds · a folder · a feed), unread only, starred only, and a date range.
- **Always full text:** titles and bodies together, title matches ranked higher. No toggle.
- **Filter syntax for power users** (Gmail-style), autocompleted and in the `?` cheat sheet: `is:unread` · `is:starred` · `feed:name` · `folder:name` · `after:YYYY-MM-DD` · `before:YYYY-MM-DD`. Typed filters become chips, so the field always shows exactly what's searched; the panel is a friendlier way to write the same filters.
- **Results reuse the item list:** same look and keys; "mark all as read" applies to the results.
- Tab moves from the field into the panel; Escape closes everything and returns you to where you were.

### Refresh

- **The server fetches in the background, on each feed's own rhythm** (frequent publishers often, dormant blogs rarely), with ETag / Last-Modified. In V2, WebSub delivers updates from publishers who offer it, with less frequent checking alongside.
- **The view waits for you:** it updates only on `r` or the Refresh button, instantly, since fetching already happened.
- **Fresh on arrival:** opening or reloading the app shows the latest state.
- **One quiet line, no number:** when new items wait, "New items · press `r`." appears in a reserved spot at the top of the list, so nothing shifts.
- **No pull-to-refresh;** on mobile a labeled Refresh button sits in the top bar.

### Empty state

Until the first feed is added:

> **[ Paste a website or feed URL ]**
> Import OPML

- Accepts a **website** URL too; slowfeed finds the feed (autodiscovery).
- The "New to feeds?" guide page comes in V2.

### Adding feeds

**"+ Add feed"** at the bottom of the sidebar, always in the same place, plus the `a` key. Same input and autodiscovery as the empty state.

### Folders and OPML

- A feed can be in several folders.
- **Export:** such a feed appears under each of its folders.
- **Import:** the same feed in several places becomes one feed in several folders.

### Mobile

- **Single-column drill-down:** Feeds → Items → Article. The feeds list is home; no hamburger menu.
- **Top bar:** a back arrow labeled with its destination ("‹ Tech") and the screen's title; Refresh on list screens; search and tuning icons on the feeds and items screens.
- **Back:** the system edge-swipe and back button. **No custom swipe gestures** on list items.
- **Article bottom toolbar** (thumb reach): previous · next · star · share · open original.
- Touch targets of at least 44px.
- **Installable** to the home screen on iPhone and Android (as a web app), full-screen with its own icon.

### Keyboard

Vim-style keys are first-class. A keyboard icon at the foot of the sidebar opens the shortcut list; when the sidebar is hidden, an unobtrusive "Press ? for shortcuts" sits at the bottom of the list.

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

- A public address needs a simple **single-user password sign-in.**
- Each device stays signed in for a long time. Passkeys come later.

### Settings

- Settings shares the top line with the other screens. Each setting is a segmented control: a faint track, the chosen choice raised onto the page color with a fine edge and semibold words.
- **Look and feel** (per device): reading font (Literata default, or Atkinson Hyperlegible), text size, line width, theme (system / off-white / sepia / dark).
- **Reading:** sort order (newest first by default); inbox or river in V2.
- **Feed health page (V2):** dead feeds first, then intermittent errors; problems in plain words ("Hasn't worked for 3 weeks — the site may have moved"), not HTTP codes; per feed **Retry · Find new address · Unsubscribe**, where "Find new address" reruns autodiscovery.
- **Your data:** OPML import and export; export of starred articles.
- **Keeping articles (V2):** unstarred articles, read or not, are removed after one year; starred are kept forever. V1 keeps everything.

### Voice

Plain, unhurried, never urgent: "Nothing new yet," never "You're missing out!" Labels say what things are and do. No exclamation marks, no hype.

---

## Still to define

- Status colors for the V2 feed health page (checked against the first floor)
- Domain, app store and trademark checks for "slowfeed" (not blocking V1)

## V2 parking lot

- **YouTube videos** in YouTube's own player.
- **Public reading list page:** an optional public list of some of your feeds (a modern blogroll) with one-click subscribe. No likes, no comments.
- **Per-feed modes:** inbox or river for each feed.
- **Passkey sign-in.**
- **Chinese and Japanese search.**
- **Multiple users.**
- **Own domain name.**

Moved from V1 on 23 October 2026, because V1 is for the owner alone (decision 0012):

- **Backups and recovery:** nightly copies outside the host, and one before every database structure change.
- **River mode.**
- **WebSub.**
- **Feed health page.**
- **The yearly clean-up** of unstarred articles.
- **The "New to feeds?" guide page.**
- **A tab left open across an update keeps working** without a reload.
