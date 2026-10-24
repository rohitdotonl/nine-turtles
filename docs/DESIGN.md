# slowfeed: UI & UX design philosophy

> **slowfeed is a quiet place to read the web: it shows you what's there, gets out of the way, and lets you finish.**

*Last updated: 24 October 2026 (Apple Books' six themes, each by day and by night, with an Appearance choice of Light, Dark or Match device, decision 0046; toward Apple Books, batch 4: one top line of one height across the three panes, one left edge in the sidebar with the place's icon in the accent, and one back button and one 20px margin on a phone, decision 0043; quiet endings and blank paper in the reading pane: a short end-note link that never breaks, balanced titles, 56px margins beside the text and an empty reading pane with nothing drawn, decision 0044; controls that say what they are: a text-size stepper of two round-ended As, one ring on the chosen theme, tick boxes for Edit feed's folders, a steady main button and importing just under the welcome's field, decision 0045; batch 3: solid article bars with a hairline only once scrolled, end matter under the closing rule, search results ordered title, text, meta, and a silent empty reading pane, decision 0040; the list's and sidebar's geometry, decision 0041; sheets and Settings in one voice, decision 0042; before that, an "Aa" reading panel beside the text and quiet icon toolbars, decision 0034; one family for sheets, search excerpts and a welcome in the reading area, decision 0035. Before that, the owner approved a new look: a role-based type scale, three ink levels, deeper area tones and one selection style, decision 0026). This document takes precedence over every other project document.*

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
- **Touch targets:** at least 44px on mobile, however dense the design. Where the main pointer is a mouse or trackpad, sidebar rows and the search options' controls may be 36px; anything a finger is the main pointer for gets 44px.

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
- *Explains:* in-app reading, serif by default, no images in the list, curated reader controls one press from the text (the Aa panel), links that don't compete with the text.
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
| Sidebar search always visible | 6. Power is hidden, never missing | The owner wants finding a feed by name always available | One quiet field that filters feeds and folders by name, shown once there's a feed to find. No fill at rest (its icon and words show it), so the list's search is the one filled well on screen (decision 0041). Nothing else in the sidebar skips progressive disclosure. |
| Unread dot (decisions 0028, 0037, 0041) | Type does the hierarchy, never badges | Weight alone was hard to scan in a long list; Apple Books, Mail and Things mark unread with a dot | A drawn 8px dot in the theme's accent, centred in a 24px gutter inside the row's pill, 8px clear of an unread title, which is semibold too. No number, list rows only. |
| A shadow under the floating note (decisions 0028, 0048) | Regions by tone, no shadows | The note floats at the list's foot, in a band of the list's tone that the rows end above; a soft shadow shows it sits above the list rather than among its rows | Only things that float over the page: the note at the bottom of the list, a sheet, the search options popover, the Aa panel, the list's and the article's More menus and the shortcut list (decisions 0034, 0038). One soft shadow and a faint edge each. Nothing that sits in the page casts a shadow, except the 1px lift under a chosen segment (below). |
| Hairlines inside a page | Regions by tone, no lines | Inside one page, a faint line parts rows that do different jobs: rows in a grouped list (Settings, Edit feed's folders) and articles in the middle list | Only within a page, never between panes; faint, in a tone of the text color, inset from the left in a grouped list. A field's own edge is a border, not a line between regions. |
| A raised segment's small shadow (decision 0042) | Regions by tone, no shadows | A segmented control's chosen choice is a raised tile, as Apple draws it; with no edge, a 1px soft shadow under it is what lifts it off its track | Only under the chosen segment of a segmented control (Settings, the Aa panel, the search options), 1 to 2px, never animated. The semibold word still says which is chosen. |
| A dim behind a sheet (decisions 0031, 0039) | Regions by tone; nothing moves unless you move it | A short task (adding or editing a feed) keeps the list in view, so you don't lose your place; a light dim shows the card is the thing to act on now | Only behind a sheet or the shortcut list: black at 18% in the day versions, 45% in the night ones, so the page behind stays warm and readable. Never animated; it closes with Escape or a press on it. |
| A hairline under a scrolled top line (decision 0028) | Regions by tone, no lines | Shows that text has gone under a top line that never scrolls, so it doesn't look cut off | Only under a pane's top line, only once its content has scrolled, and above the shortcut list's foot while more lies below (decision 0042), in a faint tone of the text color. |
| A hairline above the phone's article toolbar (decision 0040) | Regions by tone, no lines | The bottom toolbar sits over the end of the text; without an edge, a line of text looks sliced in half where it meets the bar, as the critique found | Only the phone's article toolbar: one faint line along its top, in a tone of the text color, the bar itself solid in the page's color. (The see-through, blurred top bar of decision 0038 was withdrawn by decision 0040: without the system's material it read as text ghosting through, so both article bars are now solid.) |

### Never

- Notifications of any kind
- Badges, streaks, reading stats or any gamification (no reading-time estimates, no "year in reading")
- Infinite scroll or algorithmic ranking ("for you")
- In-app likes, comments or social features
- Branded share buttons for specific platforms
- Full-article scraping from publishers' websites
- Redesigns that rearrange things people have learned
- Decoration that does no job: glass, blur, gradients, shadows, motion for delight. The article's bars are solid, never see-through (decision 0040)

---

## Part 2: Design decisions

The philosophy applied. The principle is noted where it isn't obvious.

### Name and signature

- **Name:** slowfeed (domain, app store and trademark checks are under "Still to define").
- **Wordmark:** "slowfeed" in lowercase, in the reading serif. No logo shape, no mascot.
- **Signature:** the accent (ink blue in most themes), quietly marking where you are, and the calm itself.

### Visual language

#### Rules
- **Regions are separated by tone, not lines:** background tone and whitespace; no borders, shadows, blur or gradients (small exceptions for things floating over the page, scrolling under a top line, and the edge above the phone's article toolbar, in the Exceptions log).
- **Type does the hierarchy:** size and weight, never color alone or badges (the unread dot is the one mark, in the Exceptions log).
- **One accent, one family of meanings:** each theme has one accent (ink blue in Original, Quiet, Paper and Bold; its own hue in Calm and Focus). As in Apple Books it marks what's *yours to look at*: where you are (the selection pill, by day; by night the pill is a lift of the text color, decision 0041; and the icon of the sidebar place you're in, decision 0043), what's unread (the dot) and what a search found (a faint tone behind the words) (decision 0037). Nothing else uses it: never a button, a link, a focus outline or decoration.
- **Icons where the convention is an icon** (close, clearing the search field, back, search, settings, the sidebar toggle, the list's More (…), and the article's open original, Aa, star and More (…)), each named in its tooltip with its key and to screen readers, so the tools around the text stay quiet (decisions 0034, 0038). **Words** for Add feed, menu items, the phone's back button (with its arrow) and the main action of a form.
- **Fewer, steadier toolbars** (decision 0038): **one More (…) per place**, as Apple Books has one per collection, holding the less frequent actions as words (the list's Edit, Refresh, Mark all as read and sort order; the article's Copy link or Share and Mark unread, each with its key). **A bar's controls keep to its pane's edges,** their icons about 20px in (lined up with the sidebar button), one group at each end, so they never float in the middle of a wide window.
- **Settings opens in place of the list,** with one top line that never scrolls: the title in the serif, like the list's, and an X that closes it (Escape does too). Below it, one centred column no wider than 560px of grouped lists, as in Apple Books' settings (see "Settings").
- **Short tasks open as a sheet** over the place you were (Add a feed, Edit feed, Edit folder): a small card that opens a little above the middle of the window, where the eye rests, its height following what's in it, the panes still in view behind it under a light dim (decision 0039). Once open, its top stays put: a message appearing in it grows it downwards, so nothing you're looking at moves. Every sheet is built the same way, like a Mac sheet in Apple Books:
  - its title in the same serif, size and weight as every other title (24px semibold, as the list's and Settings'), so the app speaks in one voice (decision 0042). It takes the keyboard's place as the sheet opens, so screen readers start there, but draws no ring: a heading can't be pressed, and the first Tab lands on a control, which rings as always;
  - the form: each field's name above it in small second-ink words, the field at the card's full width; choices among several (a feed's folders) as a grouped list of 44px rows, each ending in a tick box as a Mac draws one: a rounded square, empty when it's off, filled with a check when it's on, so even a list of one folder reads plainly. Square, never round, because a round mark says "pick one" (decision 0045). Making a new one ("New folder…") is the list's last row, a text box of its own. A choice of one (the feeds a site offers) is the same list with a round mark at each row's end, as a Mac draws a radio button: empty, or filled in the text color with a dot of the page, the first one chosen; the main action then acts on the chosen one (decision 0049);
  - a message, only once there is one, on its own line above the actions (a problem in red words after an alert icon);
  - **one row of actions at the foot, 20px under what's above it and 12px between its buttons, in a Mac sheet's order: a destructive action (Unsubscribe, Delete), if there is one, at the far left as words in a muted red with no edge; then Cancel, with no edge, only a faint tone, so the main action is the one thing with weight; then the main action at the right end.** The words say what the red one does, so red is never the only sign; what it removes is in its tooltip and said to screen readers, and Undo follows straight afterwards. On a narrow screen the destructive action takes a row of its own above the other two. The main action (here, on sign-in and in the welcome) keeps one steady fill: a pointer over it takes it a step nearer the text color, never paler, so it never looks switched off, and while it's busy it keeps its look (decision 0045).

  Cancel, Escape or a press on the dim closes it; there's no X. 12px corners, 24px padding all round. A field's helper line is 13px in the muted grey, 6px under the field and on its left edge; the line asking you to choose among several feeds is set as a field's name, 20px under the field (decision 0052).
- **One phone sheet** (decision 0052): on a phone, Add a feed, Edit feed, Edit folder, Settings and the shortcut list are all screens of their own with one build: the large serif title on the screen's 20px margin with an X (44px) at the right of the top line, and no back arrow or Cancel; the form 20px under the top line as in Settings; the main action, if there is one, the full width at the screen's foot (50px tall, 12px corners, 16px above the home bar), staying in view while the form scrolls; a destructive action (Unsubscribe, Delete) as the one red row of a group of its own, at least 32px above it, with the same tooltip, words for screen readers and Undo straight afterwards.
- **One close rule** (decisions 0049, 0052): on a computer, a sheet you commit (it has Save or Add feed) closes with Cancel only, and a sheet you only look at (Settings, the shortcut list) with an X only. On a phone every one closes with its X only. Never both. Escape closes any of them.
- **One family for things that float:** a sheet, the search options popover and the shortcut list share the same 12px corners, faint edge and one soft shadow. They, the menus, the Aa panel and the note at the list's foot sit on one raised surface: by day the page itself; by night a small lift above the page (Original's #28282a, warm in Calm and Focus) with a 1px edge of 8% white, as Apple Books lifts its sheets and menus, and grouped rows inside it 4% lighter again (decision 0052). Key caps in the shortcut list have a visible edge, a 1px rim and a 2px lower lip, as a printed key; the note about Tab, Enter and Escape is a footer across both columns. A popover of choices is drawn as a **menu**, not a form: small section names, then rows with a checkmark at the start of each one that holds (the search options, the list's More menu). The shortcut list is never taller than 720px and keeps at least 48px clear of the window's top and foot; its two columns are stacks of their own, the search filters under Everywhere on the right, so it fits an 800px-tall window without scrolling. On a phone it's a screen of its own, as every sheet is there (decision 0049). When it does scroll, a hairline under its title shows only once the list has moved, and one above a 16px band at its foot only while more lies below, so a row cut there reads as scrolling, never as clipping. It opens with the keyboard on its title (no ring, as in a sheet) rather than ringing its X.
- **Fields:** a 1px edge in a soft mix of the text color (still 3 : 1 against what's around it, checked automatically), over a faint fill, 8px corners. The keyboard's outline (2px, text color) takes the edge's place. A refused field's edge turns the muted red, beside the message's alert icon and words in the same red: never a thicker ring, never color alone. While the keyboard is in a refused field, the outline takes the red edge's place too, so there is only ever one line (decision 0042). Room for a message is kept only where the page is centred on screen (sign-in, the welcome): below the main action, so a message arriving under the field moves only the button (decisions 0045, 0048); in a sheet the sheet grows by its line.
- **Small menus and panels float under their button:** the list's and the article's More menus and the Aa panel, in the same family, a rounded card with one soft shadow, closed by Escape (back to the button), a press outside, or the keyboard leaving them. On a phone the Aa panel is a sheet along the bottom of the screen with a Close button, and the article's More menu opens upwards from the bottom bar.
- **One search field:** the sidebar's find field and the list's search are one slim capsule, as Apple Books draws its search: 36px tall with a mouse on a wide window, 44px on touch or a phone, 10px corners, a faint fill of the text color (6%) and no edge, a 14px search icon in the icon column and the interface's text size; the keyboard's outline marks the one in use. A chip inside it is 24px tall with 6px corners; its Remove button is still a full 44px to press. Its options menu floats on the raised surface (decision 0051, replacing 0041's unfilled find field).
- **No motion.** Views switch instantly.

#### Color

Six themes, as in Apple Books, each with a day and a night version (decision 0046). The values are matched by eye to Apple Books' themes, then held to slowfeed's own floors by the automatic checks.

| Role (day) | Original | Quiet | Paper | Bold | Calm | Focus |
|---|---|---|---|---|---|---|
| Background (reading area) | `#FFFFFF` | `#E8E8EA` | `#F5F4F0` | `#FFFFFF` | `#F2E6D0` | `#FBF6E2` |
| Accent ("where you are") | `#2C4F8C` | `#344A74` | `#2F4A7A` | `#1D3C8A` | `#733618` | `#235268` |
| Accent contrast on background (approx.) | 8.1 : 1 | 7.2 : 1 | 8.0 : 1 | 10.2 : 1 | 7.5 : 1 | 7.8 : 1 |
| List area (one step off) | `#F7F7F7` | `#E0E0E3` | `#EDECE7` | `#F7F7F7` | `#EADCC2` | `#F3EDD5` |
| Sidebar (two steps off) | `#EFEFF1` | `#D7D7DB` | `#E4E3DD` | `#EFEFF1` | `#E0D0B2` | `#EAE2C6` |
| Text | `#141414` | `#2A2A2D` | `#25241F` | `#000000` | `#32271B` | `#1F1D16` |
| Second ink: read titles, quieter actions | `#3C3C40` | `#434347` | `#47453E` | `#1F1F22` | `#4E4131` | `#433F31` |
| Muted grey: meta, counts, hints | `#5F5F64` | `#525256` | `#5A5850` | `#4A4A4F` | `#5A4B3A` | `#5A5442` |

| Role (night) | Original | Quiet | Paper | Bold | Calm | Focus |
|---|---|---|---|---|---|---|
| Background (reading area) | `#121212` | `#2C2C2E` | `#262624` | `#000000` | `#29231C` | `#1B1A15` |
| Accent ("where you are") | `#94B2E6` | `#B0C0E0` | `#A3B6DA` | `#A2BFF2` | `#E0AD6A` | `#D1BB72` |
| Accent contrast on background (approx.) | 8.7 : 1 | 7.6 : 1 | 7.4 : 1 | 11.3 : 1 | 7.7 : 1 | 9.2 : 1 |
| List area (one step off) | `#1A1A1A` | `#303032` | `#2C2C2A` | `#0C0C0C` | `#2F2821` | `#22201A` |
| Sidebar (two steps off) | `#232323` | `#38383B` | `#343431` | `#161616` | `#382F27` | `#2A2821` |
| Text | `#E8E8E8` | `#E2E2E5` | `#E3E1D9` | `#FFFFFF` | `#EADCC5` | `#E7E1CC` |
| Second ink: read titles, quieter actions | `#C4C4C6` | `#C3C3C7` | `#C7C5BC` | `#E2E2E2` | `#CFC0A8` | `#CAC4AE` |
| Muted grey: meta, counts, hints | `#A4A4A8` | `#B5B5BA` | `#B4B2A8` | `#B4B4B4` | `#BCAD95` | `#B0A993` |

- All accent pairs pass AAA (7 : 1); re-check if a value changes.
- **Links in articles** are underlined in the text color, **never blue**.
- **Muted greys** (read items, counts, source names) follow their theme's paper, cool or warm, and pass AA (4.5 : 1) on every area and on the selection pill in all themes, verified by automatic checks. Eight were nudged a shade from the values matched by eye so they stay at 4.5 : 1 on the pill (decision 0046).
- **The selection pill** (decisions 0037, 0041): in the day versions the theme's accent mixed into the pane behind it at 12%, so each pill is made from its own pane's paper (decision 0051); in the night versions the theme's own text color at 12%, so the pill keeps the pane's warmth or coolness instead of laying a cool blue-grey over warm brown. Quiet, Paper and Calm by night, whose panes are already light for the dark, mix in less (9%, 10% and 10%) so their text keeps 7 : 1 on it (decision 0046). Text stays at 7 : 1, muted grey at 4.5 : 1 and the unread dot at 3 : 1 on it, and a dark pill keeps its pane's temperature (all checked automatically). A row under the pointer gets a fainter, neutral tone of the text color (5%), never the accent, always lighter than the pill.
- **Search matches** have the accent at 12% behind them (6% in Quiet by night, 8% in Paper and Calm by night, so text keeps 7 : 1 inside the pill), with 3px corners and a fine underline (so never tone alone), in the text's own weight; text keeps 7 : 1 on it, even inside the pill.
- **The keyboard focus outline** is a 2px line in the text color, never the accent. On rows it is the text color softened (65%, still at least 3 : 1 on every area and on the pill, checked automatically), drawn 2px inside their rounded edge so it never reaches over the hairlines or the pane's edge; the pill's fill always stays. A title the keyboard is moved to gets it too, a little away from the words, except a sheet's or the shortcut list's title, which takes the place without a ring because it can't be pressed; the first Tab lands on a control that rings (decision 0042). It shows only when you're using the keyboard: never on a row after a tap or a click, even when the keyboard's place moves back to it (decision 0051).
- **Status colors** (errors, warnings; V2 feed health page) are muted, never drift toward blue, and always come with words.
- **Destructive actions** (Unsubscribe, Delete folder) are words in a muted red, `#A3261B` by day and `#E8968A` by night (`#EA988C` in Quiet by night, a shade lighter for its lighter grey): at least AA (4.5 : 1) on the page, the list and a grouped list in every theme, checked automatically. Red means only "this removes something", and the words always say what.

#### Themes
Six, as in Apple Books (decision 0046, replacing decision 0032's eleven): **Original** (the default: white paper by day, near-black by night), **Quiet** (soft grey, lower glare), **Paper** (a faintly warm off-white, like print), **Bold** (pure white and black at the strongest contrast, with the article text heavier: Literata's semibold or Atkinson Hyperlegible's bold; only the article text, never the interface; a publisher's bold words and headings go a step heavier still, to Literata's 800), **Calm** (sepia: cream paper, brown ink) and **Focus** (a pale yellow page). Each has a day and a night version. A separate **Appearance** choice picks between them: **Light**, **Dark** or **Match device** (the default), which follows the device's own light or dark setting, live, as it switches. Before slowfeed's script runs, a page is Original, by day or by night as the device is set. Every version meets the same contrast floors, checked automatically.

#### Typography

| Use | Typeface | Why |
|---|---|---|
| Reading (default) | **Literata** | Made for long-form reading on screens |
| Reading (alternate sans) | **Atkinson Hyperlegible** | Made for legibility, including low vision |
| Interface | **The device's own system font** (San Francisco on Apple devices), **Inter** everywhere else | As in Apple Books: the interface feels native; Inter is the neutral, self-hosted fallback |
| Code in articles | **JetBrains Mono** | Clear monospace |

- All fonts are free and served by slowfeed itself (no third-party font services).
- **Other scripts** (e.g. Hindi in Devanagari) use the fonts already on the device; no extra downloads.
- **A fixed type scale by role**, so each level of importance looks different at a glance (size, weight and ink together, never color):
  - meta 13px (times, source names, counts, hints) in muted grey; 15px on a touch screen;
  - small 14px (toolbar actions, helper text, labels);
  - interface 15px (sidebar names, list titles); 17px on a touch screen, as a phone's own apps use;
  - base 16px (text boxes, running interface text);
  - large 20px (section headings inside a screen);
  - heading 24px, in the reading serif (the list's title, one line that ends in "…", 22px in a list pane narrower than 340px); the sidebar's wordmark is 20px in the second ink on a computer and 28px on a phone's feeds screen;
  - extra large 28px (a screen's own title);
  - display 48px (sign-in wordmark).
- Article text is set by the reader: six steps, 16 to 28px, 20px by default (a tenth smaller on a phone). The article's title is 1.6 times the text size (32px by default), with tight leading (1.12) and its letters tracked in only a little, so they never touch (decision 0047), its lines balanced so a two-line title reads as two even lines, as Apple Books sets one (decision 0044, replacing 0040's lone-word rule); its headings are 1.1 and 1.05 times (22px by default) with more room above than below, so the title is always clearly the largest thing on screen and a heading never competes with it (decision 0038).
- **The byline is quiet:** 14px in the interface font (decision 0050) and the second ink, a clear pause under the title (five-eighths of the title's size, about 20px by default, decision 0047), with the publisher's name leading in full ink and semibold (the interface fonts ship only regular and semibold).
- **Spacing** in steps of 4px, mostly 8, 16, 24, 40 and 64px.
- **Weights:** regular and semibold (600) for both reading and the interface: Literata's semibold for titles, headings and bold words in articles (Atkinson Hyperlegible keeps its bold). Nothing heavier, so a calm page never shouts, except in the Bold theme, which the reader chooses: there the article text is semibold and its bold words and headings use Literata's 800 (decision 0046). Semibold marks unread titles, where you are in the sidebar, the one main action in a toolbar or sheet, and a destructive action's words. The self-hosted Inter has only 400 and 600, so unread titles stay at 600 (decision 0037).
- **Three inks:** text (titles, where you are), a second ink (read titles, quieter actions); feed names in the sidebar are in full text color and muted grey (meta).
- Article lines of roughly 65–75 characters, with generous leading.

#### Languages
- **Interface:** English only in V1.
- **Articles:** any language, each marked with its language (from the feed) for screen readers and typography.
- **Search:** English, other Latin-script languages and Hindi from day one; Chinese and Japanese not in V1.

### Layout

- **Three panes:** feeds | items | article (like NetNewsWire).
- **One layout that adapts:** three panes wide (1200px and up), two medium (896px and up), one column below that, as on phones. No user-facing layout modes.
- **Collapsible sidebar:** a small sidebar-icon toggle in a fixed position at the top-left, and the `[` key.
- **A shared top line:** the wordmark, the list's title and the article's tools sit on one line across the panes, and never scroll. It is one band of one height, 56px (`--bar-h`), in every pane and every page that opens in their place, its controls centred in it, so the three top lines end together and their hairlines fall in one line, as Apple Books keeps every toolbar item on one line (decision 0043). A 44px button in it has 6px clear above and below, and its keyboard ring is drawn just inside its own edge, so it never touches the window's top.

### Sidebar

Fixed order, top to bottom: **Unread · Starred · All**, then **folders** A–Z, then **feeds not in a folder** A–Z, then at the foot **Add feed** in words, with the shortcut list (keyboard icon) and **Settings** (cog icon) beside it.

- No manual ordering.
- Folders appear once one exists. Sidebar search is always shown once there's a feed (Exceptions log).
- **One column of counts** (decision 0041): a folder's show-or-hide arrow sits before its name, as a Mac source list's disclosure does, in the column where Unread, Starred and All have their icons. Every count ends at the row's right edge, right-aligned in tabular figures.
- **One left edge** (decision 0043): every name (Unread, Starred, All, folders, feeds, and the find field's words) starts 46px in, after the icon column, which also holds the find field's search icon; the section names stay out at the 20px margin, as in a Mac source list. Feeds in an open folder start one step further in (64px), so the hierarchy shows without relying on the arrow.
- **The wordmark is a name, not a control:** never a Tab stop. The keyboard lands on it only when the app opens or the phone's feeds screen returns, so screen readers start at the top; its outline then stands a little clear of the letters.
- Names in Devanagari are set a touch larger, so they sit level with Latin names.
- **Folders** are one concept on screen; a feed can be in several (tags underneath).
- **Unread counts:** see the Exceptions log.
- **Where you are** is the same pill as in the item list (see "Item states"); the place's name is semibold, and Unread's, Starred's or All's icon turns the accent, as a Mac source list marks the selected row (decision 0043): the pill, the weight and the icon together, never color alone. A row under the pointer gets a fainter, neutral tone.
- Broken feeds look normal and simply show nothing new. In V1 the daily check reports problems; the feed health page comes in V2.

### Item list

- **No images, no favicons.** Each row: the **title** (1.3 line height), with **source name and time** in quiet small text 2px below, always on one line as in Apple Books' lists: a long source name ends in "…" with the "·" hugging it (no wider gap than on any other row, decision 0051), the time and the star keep their room and never wrap, and its figures are proportional, as in running text (only the sidebar's right-aligned counts use tabular figures) (decision 0048); 10px above and 11px below, as Apple Books spaces its lists. Inside the pill a 24px gutter holds an unread row's dot, so every title starts 32px into the pane, dot or no dot, lined up with the list's title, the search field and the closing caption (decision 0041). On a phone the titles start at the screen's one 20px margin, the pill 4px in, and the dot hangs in the margin before them (decision 0043). Faint hairlines part the rows, from the titles' edge to the pill's right edge, so a line and the selection end together; none shows directly above or below the selected row or the row under the pointer. In one feed's own list the name is left out (the title above already says it); screen readers still hear it.
- **Sort:** newest first by default; changeable in settings or the list's More menu.
- **The title is one line,** as Apple Books' collection titles are (decision 0041, reversing 0038's two lines): a long name ends in "…", its whole name in the tooltip and read in full by screen readers, so nothing under it moves; in a list pane narrower than 340px it steps down to 22px. Beside it, one quiet **More** (…), a small menu with Mark all as read, Refresh, the sort order, and Edit feed… or Edit folder… in a feed's or folder's own list (decision 0038). No row of words between the search field and the list.
- **The list has an end:** a fixed number of items, then a **"Show older items"** button. Nothing loads unless asked. When there's nothing more to show, a quiet caption, "That's everything.", in small muted grey closes the list, lined up with the titles, with no line above it.
- Matched search terms, in titles and excerpts alike, have one style: a faint accent tone behind them (12%), 3px corners and a fine underline (so never tone alone), in the text's own weight and color (decision 0037).
- **A search result shows why it matched:** when its text (not only its title) holds a searched word, up to two muted lines right under the title show that text around the first match, at most about 90 characters, cut between words; the source and time come last, as Apple Books orders a result: title, then context, then meta (decision 0040). The matched words in it are marked as in titles and in full ink, as Apple Books shows matches in context. Three typed dots in the text show as one "…".

#### Item states (distinguished by tone and weight, never color alone)

| State | Treatment |
|---|---|
| Unread | Full-contrast, semibold title and an 8px dot in the theme's accent in the gutter before it |
| Read | Second ink, regular-weight title |
| Selected (cursor) | One pill, the same in the sidebar and the list (decision 0037): 8px in from the pane's edges, 8px corners, filled with the accent mixed into the pane (the text color in the night versions, decision 0041); no border and no bar; title in full ink. The keyboard's outline is drawn 2px inside its edge. In high-contrast mode, an edge in the system's highlight color |
| Starred | A small star mark |

In river mode (V2) only the cursor and star show.

### Article view

- **The feed's content, read in the app,** cleaned and restyled consistently: headings, quotes, code, tables, footnotes, images.
- **Summary-only feeds** show the summary; never fetch the full article (second floor). Under the closing rule, as a book sets its end matter, a small note in upright interface type (14px), centred, in the second ink, says "This feed shares only a summary. Read the full article ›"; only the link is underlined, with a fine, soft line. The publisher is already named in the byline, so the link stays short (screen readers hear "Read the full article on {publisher}"), and each sentence stays whole on a line wherever it fits, so the note breaks only between them and never strands a word; a sentence wider than the column on its own (very large text on a small phone) wraps evenly rather than running off the page. The underline is the text color at 65%, still 3 : 1 against the page, since it is the only sign of the link (decisions 0040, 0044).
- **Images** load normally from the publisher; invisible 1×1 tracking images are removed. At night they are dimmed a little, never inverted; captions are smaller, in the second ink at 7 : 1; tables start flush with the text under a fine header rule (decision 0050).
- **"Open original"** is always present, always in the same place: the first icon in the cluster at the right of the article's top bar (on a phone, alone at the right of the top bar), named "Open original" for screen readers and in its tooltip.
- **Quiet tools, anchored to the pane** (decision 0038): the article's top bar runs the width of the reading pane, its icons in the second ink, never words, together at the right edge, 4px apart, leaving the left empty as in Apple Books (decision 0050): Open original, **Aa**, Star and **More** (…). More holds Copy link (Share on phones) and Mark unread. The bar is solid, in the page's own color, across the whole pane (scrollbar included); the text scrolls below it, never showing through, and a faint line shows between them only once the text has scrolled (decision 0040). The scrollbar's track is see-through, so its gutter is the page's color in every theme.
- **The Aa panel,** like Apple Books': one press from the text, the reader's own controls. Text size as a small A and a large A (the same steps as `+` and `-`); Appearance (Light, Dark, Match device) as a segmented control; the six themes as round-cornered tiles, each "Aa" in the reading font on that theme's own page color and ink in the version showing, Bold's "Aa" bold, the chosen one ringed in the text color and its name semibold (the same controls as Settings); the reading font, each name in its own face; and the line width. Changes apply at once to the article behind it. The same preferences stay in Settings › Look and feel.
- **Title, then byline:** the title first, then who, where and when in a quiet line under it (see Typography). Opening an article moves the keyboard's place to its title so screen readers start there, but, as in a sheet, it draws no ring: a title can't be pressed, and the next Tab lands on a link or control, which rings as always (decision 0047).
- **An ending:** a short centred line after the last paragraph, and room below it.
- **Title size:** 1.6 times the text size, semibold, tight, in the text's column with its lines balanced. On a phone the same text-size step reads a little smaller, so a line keeps about 40 characters.
- **The phone's bottom bar** is quiet icons without words, each named for screen readers, solid with a hairline along its top (see Mobile).
- **Paper beside the text:** on a computer at least 56px on each side, as Apple Books keeps on a Mac; in a narrow pane the line gets shorter rather than the margins thinner (decision 0044). Phones keep the one 20px phone margin (decision 0043).
- **Body text wraps normally;** only a paragraph that ends the article avoids a lone last word, so no line is pulled visibly short (decision 0040).
- Prefetch the next article for instant `j`.

### Reading modes

*V1 has inbox mode only; river mode comes in V2 (owner's decision, 23 October 2026).*

- **Inbox** (default): things to get through. Unread view, read/unread styling and muted unread counts.
- **River** (V2): things flowing past; dip in when you like. None of those three. A global setting.
- Read state is tracked quietly in both, so switching never loses history.

### Read state and bulk actions

- An item is **read when opened.** On desktop, selecting it (`j`/`k` or click) shows it in the reading pane, which counts as opened.
- **`m`** (or Mark unread in the article's More menu) marks the current item unread.
- **Mark all as read** (`Shift+A`, or the list's More (…) menu beside its title): instant, with **undo**, no confirmation dialog. It **only affects items currently shown**, never ones fetched but not yet displayed.

### Star

- One concept, **Star** (no separate "read later"; in inbox mode the unread list is the queue).
- Starred items live in the Starred view and are kept forever.

### Sharing

- The **system share sheet** on mobile, **Copy link** on desktop, both in the article's More (…) menu. No branded platform buttons.
- Shares the **original article's link**. Article view only.

### Search

- **`/`** focuses the field. A faint **search icon** starts it and the **tuning (sliders) button** sits inside it at its right end; its tooltip says "Search options." The number found sits quietly in a line above the results.
- **Scope defaults to where you are,** shown as a removable chip in the field, e.g. `[ in: Tech × ]`, once you're in the search. At rest the field just says "Search", since the list's title already names it. Remove the chip to search everything.
- **The chip shows the scope; the Search options menu edits it;** they stay in sync, and in the same words: a filter's chip says **Unread**, **Starred** or **After 1 Oct 2026**, as the menu names it, with the typed form (`is:unread`) as its tooltip and its description to screen readers (decision 0048). The menu is three sections of checkmark rows (decision 0039): *Search in* (this list · All feeds, and the place now searched if it's another; then **Other feed or folder ›**, a submenu row that opens a list of every other feed and folder, as a Mac menu leads on to a submenu), *Show only* (Unread · Starred, each ticked on its own), and *Published* (Any time · Past week · Past month · Custom, which shows two dates).
- **Always full text:** titles and bodies together, title matches ranked higher. No toggle.
- **Filter syntax for power users** (Gmail-style), autocompleted and in the `?` cheat sheet: `is:unread` · `is:starred` · `feed:name` · `folder:name` · `after:YYYY-MM-DD` · `before:YYYY-MM-DD`. Typed filters become chips in plain words, so the field always shows exactly what's searched; the panel is a friendlier way to write the same filters.
- **Results reuse the item list:** same look and keys; "Mark all as read" (in the More menu, or `Shift+A`) applies to the results. Each result whose text matched carries one quiet line of that text around the match (see "Item list").
- **A × clears the field** once it has words in it: a 44px target named "Clear search". It keeps the chips.
- Tab moves from the field into the menu, onto the place being searched; Escape closes the menu first, then everything, and returns you to where you were.

### Refresh

- **The server fetches in the background, on each feed's own rhythm** (frequent publishers often, dormant blogs rarely), with ETag / Last-Modified. In V2, WebSub delivers updates from publishers who offer it, with less frequent checking alongside.
- **The view waits for you:** it updates only on `r` or Refresh in the list's More (…) menu, instantly, since fetching already happened.
- **Fresh on arrival:** opening or reloading the app shows the latest state.
- **One quiet line, no number:** when new items wait, "New items · press `r`." floats as a small note at the foot of the list pane (the same place however short the list), so nothing shifts. It sits in a band of the list's own tone across the pane, which the rows end above, so the note never lies over the rows you're acting on (decision 0048); on a touch screen it says "New items" with a **Show** button. Undo and "slowfeed was updated" use the same note.
- **No pull-to-refresh;** Refresh is in every list's More menu, on phones too.

### Empty state

Until the first feed is added, the **reading area** holds a welcome, centred like a blank page in a book, because that's where a new reader's eyes go; beside it, the list steps aside, so the welcome has the list's room too (decision 0048):

> ***A quiet place to read.*** (the reading serif, 28px)
> One sentence on what slowfeed is for.
> **[ Paste a website or feed URL ] [ Add feed ]** (a wide field, its name inside it)
> Import an OPML file… (a quiet button)

- One centred column, 420px wide, like Apple Books' empty library: one message, one action, and **one alignment**: everything in it is centred. The field's name is its placeholder (and its label for screen readers), so no line sits left-aligned under the centred title; "Import an OPML file…" is a quiet button just under the field, centred under it, so it reads as the other way in rather than a footer; the room kept for a message lies below it, and a message, when one comes, appears between the field and the button and moves only the button (decisions 0045, 0048). The main action's corners match the field's.
- The welcome owns the screen (decisions 0041, 0048): one empty state, never an empty column beside it. Where there's a reading area beside the list, the list steps aside and the welcome takes both; the sidebar has no find field while there's nothing to find. Where there's no reading area beside the list (a phone), the welcome takes the list's place.
- **The welcome stays still under the Add a feed sheet:** the sheet has the only field, and the welcome keeps its exact shape under the dim (decision 0048).
- **No article open:** once there are feeds, the empty reading area is blank paper, as in Apple Books: nothing is drawn. Screen readers hear "No article open." and, when the list has something to open, "Choose one from the list, or press j" (decisions 0040, 0044).
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
- **The feeds screen is the root of a stack** (decision 0041): nothing on it is drawn as selected, and each row (Unread, Starred, All, folders, feeds) ends in a chevron after its count, because it leads on. Its top line is the large wordmark with Refresh as an icon alone in a 44px target.
- **Top bar:** a back arrow labeled with its destination ("‹ Tech") and the screen's title; More beside a list's title (one line, ending in "…"); search and tuning icons on the feeds and items screens. On an article: the back button with the list's name in words ("‹ Tech", named "Back to Tech" for screen readers) at the left and Open original at the right, on the same solid top bar as on a computer.
- **One margin and one back button** (decision 0043): every phone screen starts its names, titles and text 20px from the screen's edge (a list's unread dot hangs in that margin, 8px from the edge, so a row's keyboard ring passes clear of it, decision 0049), and the back button ("‹ Feeds", "‹ Tech") sits in the same place on every screen, its arrow 8px from the edge, as iOS keeps it still while the screens change.
- **Folders on the feeds screen** have no show-or-hide arrow, since each row already ends in a chevron (one chevron per row): a folder's feeds are always listed under it, a step in; a tap on its name opens its list.
- **Back:** the system edge-swipe and back button. **No custom swipe gestures** on list items.
- **Article bottom toolbar** (thumb reach), five quiet icons without words, each a 44px tap named for screen readers: previous · next · Aa · star · More (…), which opens upwards with Share and Mark unread (decision 0038). The five always share the bar evenly: one that can't act (Previous on the first article) keeps its arrow in place, faded, so the bar never shows a hole (decision 0047). Aa opens the reading panel as a bottom sheet. The toolbar is solid in the page's color, with a hairline along its top and room for the phone's home indicator below (decision 0040).
- Touch targets of at least 44px.
- **Installable** to the home screen on iPhone and Android (as a web app), full-screen with its own icon.

### Keyboard

Vim-style keys are first-class. A keyboard icon at the foot of the sidebar opens the shortcut list, and so does `?`. As in Apple Books, the chrome never advertises shortcuts otherwise: no hint under the list, with the sidebar shown or hidden (decision 0041).

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
| `+` / `-` | Text size while reading (the shortcut list shows a true minus sign, −, on the key) |
| `Esc` | Back / close |
| `?` | Shortcut cheat sheet |

### Sign-in

- A public address needs a simple **single-user password sign-in.**
- **One centred column, in the welcome's voice** (decision 0048): the wordmark and its line, then the field (its name, "Password", inside it and said to screen readers) and **Sign in** 12px under it, its corners matching the field's. On a phone the column runs between the one 20px margin of every screen; elsewhere it is at most 320px wide. A message appears between the field and the button and moves only the button.
- Each device stays signed in for a long time. Passkeys come later.

### Settings

- Settings shares the top line with the other screens. Below it, **grouped inset lists, as in Apple Books' settings** (decision 0039): one centred column no wider than 560px; each group a rounded block one tone off the page with no edge, a small muted header above it and its explaining line below it; each row at least 44px, its name on the left in the interface font and its control at the right end. Every control in a row is the same width, so the column reads as one. A choice among two or three is a segmented control (a faint track, the chosen choice a raised fill with a small shadow and no edge, as Apple draws it, and semibold words; in a dark theme the fill is a clear step lighter than the track) (decision 0042). Rows parted by hairlines are inset 16px from the left in every group. In a dark theme a group sits a clear step lighter than the page (the text color mixed 7% into it), so it never melts into the page. A row that acts (Import OPML…, the exports, Sign out) ends in a quiet glyph in the muted grey: › where something opens, a tray where a file is saved, a door for Sign out. Never the accent, which means only where you are; and Sign out stays in the text color, not the destructive red, because it removes nothing.
- **Look and feel** (per device): Appearance, theme, reading font (Literata default, or Atkinson Hyperlegible), text size, line width, and a short sample set as articles will be, straight under the group's header and before its controls, on the page itself, as the sample sits at the top of Apple Books' Aa panel (never a card inside a card). On a computer it starts on the rows' words; on a phone on the groups' own edge, the screen's margin (decision 0049). **Appearance** (Light, Dark, Match device) is a segmented control in its own row above the themes (decision 0046). **Themes are "Aa" tiles,** as in Apple Books: each a small square page with "Aa" in the reading font, in that theme's own paper and ink for the version showing now (day or night), its name under it; Bold's "Aa" is bold. The chosen tile has two marks, as in Apple Books: one ring in the text color 2px clear of the page, and its name semibold, never color alone; no checkmark badge, and the chosen page drops its own faint edge so only one line rings it (decision 0045). The six themes sit in even rows that fill the width; on a phone, three to a row in two rows, each page a little wider than tall (decision 0052). **Text size is a stepper,** as in Apple Books, on the same track as the segmented controls: a small A and a large A at its ends, each a raised cell as a chosen segment is drawn, with the step's name between them as plain words with nothing behind them of their own, so it never reads as a three-way choice with nothing chosen (decisions 0045, 0052); the same control as the Aa panel (and the same steps as `+` and `-`). The Aa panel above an article uses the same tiles and the same text size control, and the group's footnote says so.
- **Account:** Sign out as a row of its own; the version under the group, and "A new version is ready" with Reload as a row when there is one.
- **Reading:** sort order (newest first by default); inbox or river in V2.
- **Feed health page (V2):** dead feeds first, then intermittent errors; problems in plain words ("Hasn't worked for 3 weeks — the site may have moved"), not HTTP codes; per feed **Retry · Find new address · Unsubscribe**, where "Find new address" reruns autodiscovery.
- **Your data:** rows that act, as Books lists them: "Import OPML…", "Export OPML", "Export starred articles", in the text color (never the accent), with what the files are in the footnote and what an import did said under the group.
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
