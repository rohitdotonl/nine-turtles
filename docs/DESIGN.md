# nine turtles: UI & UX design philosophy

> **nine turtles is a quiet place to read the web: it shows you what's there, gets out of the way, and lets you finish.**

*Last updated: 25 October 2026 (a logo of nine turtles, decision 0068; a second theme, Plain, with blue article links, and System serif, decision 0063; Apple Books as the design reference, decision 0059). Each change is recorded in `docs/decisions/`.*

## Mission

Help people leave social media and return to reading the open web. Social media is **infinite, urgent and attention-grabbing**; nine turtles is **finite, calm and quiet**.

**Tiebreaker for every decision:** *does this make nine turtles feel more like a book, or more like a feed?*

## What nine turtles is, and isn't

**nine turtles is** a reader for writing published through RSS, Atom and JSON Feed, for one person per installation.

**nine turtles is not:**
- **A read-later app:** it doesn't save arbitrary web pages.
- **A discovery engine:** no recommendations, trending or "you might like." You choose your sources.
- **A social network:** no profiles, followers, likes or comments.
- **A podcast player:** audio appears as a link to the original. (YouTube plays in YouTube's own player in V2.)
- **A newsletter inbox:** no email address that turns newsletters into feeds.
- **A web scraper:** it shows what publishers put in their feeds (second floor).
- **A permanent archive:** unstarred articles are kept for one year (the clean-up comes in V2; V1 keeps everything).
- **A multi-user service:** not in V1 ("not yet," not "never").

## Design reference: Apple Books

Since 24 October 2026 the look and feel follow **Apple Books on the Mac and the iPhone**, and no other app (decision 0059). When unsure how something should look or behave, do what Apple Books does.

- **What wins:** the two floors first, always; then Apple Books; then the rest of this document. The owner's order is "taste first, good UI/UX principles second, my own rules last", but the floors are never traded.
- **What's fixed:** only the three-pane structure (sidebar, list, page; one at a time on a phone). Everything else may change to come closer to Apple Books.
- **Who may change what:** agents may change Part 2 of this document and `docs/SPEC.md` to follow Apple Books, in the same pull request as the code, with a note in `docs/decisions/`. The mission, the floors, the ranked principles and the "Never" list still change only with the owner's yes.

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
- **Touch targets:** at least 44px on mobile, however dense the design. Where the main pointer is a mouse or trackpad, sidebar rows may be 32px and the search options' controls 36px; anything a finger is the main pointer for gets 44px.

**Test:** can someone use every feature with only a keyboard, only a screen reader, or at 200% text size?

### The second floor: respect the publisher

Publishers are the reason there's anything to read.

- **Show what the publisher put in the feed.** Never scrape the full article. A summary-only feed shows the summary and "Open original."
- **Always credit the source** and link to the original.
- **Fetch politely:** on each feed's own rhythm, with ETag / Last-Modified (WebSub in V2).
- **Shared links go to the publisher,** never to nine turtles.
- **Embedded media plays in the publisher's own player** (e.g. YouTube's, V2), so views stay theirs.

**Test:** would a publisher be glad their feed is read in nine turtles?

### The ranked principles

#### 1. Reading comes first
The article is the product; everything else is a way to reach it.
- *Explains:* in-app reading, serif by default, no images in the list, curated reader controls one press from the text (the Aa panel), links that don't compete with the text.
- **Test:** does this make reading better, or compete with it?

#### 2. Calm over engagement
nine turtles never tries to bring you back or keep you longer. It succeeds when you've read what you wanted and closed it.
- *Explains:* no notifications, river mode (V2), no count of new items, no pull-to-refresh, the view waiting for you, "Show older items" instead of infinite scroll.
- **Test:** would a social media company want this? If yes, be suspicious.

#### 3. Clear at a glance
Anyone understands any screen within a second: what it's for, where they are, what they can do.
- *Explains:* regions separated by tone, one accent with one meaning, icons only where the convention is an icon and words everywhere else, the search scope chip, a plain name.
- **Test:** squint (are the regions still distinct?) and five seconds (can someone say what the screen is for and where the main action is?).

#### 4. Slow app, fast interface
The experience is slow; the software never is.
- Every action feels instant (under ~100 ms). No spinners for what the app already has; prefetch the next article so `j` is instant.
- Act immediately, confirm silently; sync happens behind the scenes.
- No transitions: views switch instantly. Animation makes an interface *feel* slower.
- **Test:** does the user ever wait for the interface rather than for themselves?

#### 5. Nothing moves unless you move it
Layout, positions and content change only through the user's action.
- *Explains:* the fixed three-pane layout, manual refresh, "+ Add feed" always in one place, "mark all as read" only affecting what you've seen, older items loading only when asked, no rearranging what the reader has learned once the look settles (the Apple Books redesign of October 2026 was the deliberate exception, decision 0059).
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

1. **Apple Books settles questions of look and feel** (see "Design reference"); the floors still come first.
2. **Exceptions are written down** in the Exceptions log below: where, why and within what limits. Floors have no exceptions; only the owner can change a floor's wording, through a note in `docs/decisions/`.
3. **New features go through the floors and principles in order** and stop at the first "no":
   1. Does it break a floor? → no.
   2. Does it hurt reading? → no.
   3. Does it pull people back or keep them longer than they wanted? → no.
   4. Is it clear at a glance? If not, can it be hidden for power users?
   5. Is it instant?
   6. Does it move or rearrange anything the user didn't ask to change? → redesign until it doesn't.
   7. Will it still feel right in ten years?
4. **Scope is checked too.** A feature that would make nine turtles one of the things under "nine turtles is not" is out, however good.

**Worked example: AI summaries.** They compete with reading (1), but a power user (6) might want them to triage 500 feeds. Result: never in the reading pane; possibly an opt-in, hidden triage tool in the list. The philosophy answered *where*, not yes or no.

**Worked example: fetch the full article when a feed has only a summary.** It would help reading (1) but breaks the publisher floor. Floors aren't ranked against principles, so the answer is no: show the summary and "Open original."

### Exceptions log

| Exception | Principle bent | Why | Limits |
|---|---|---|---|
| Unread counts in V1 | 2. Calm over engagement | Power users with hundreds of feeds need to know what they've seen | Inbox mode only. Muted grey, right-aligned in the sidebar. Never badges or color. Per feed and folder only, no global total. Above 999 shows "999+". |
| Sidebar search always visible | 6. Power is hidden, never missing | The owner wants finding a feed by name always available | One quiet field that filters feeds and folders by name, shown once there's a feed to find. The same slim, faintly filled capsule as the list's search (decision 0051). Nothing else in the sidebar skips progressive disclosure. |
| Unread dot (decisions 0028, 0037, 0041) | Type does the hierarchy, never badges | Weight alone was hard to scan in a long list; Apple Books, Mail and Things mark unread with a dot | A drawn 8px dot in the theme's accent, centred in a 24px gutter inside the row's pill, 8px clear of an unread title, which is semibold too. No number, list rows only. |
| Blue links in Plain (decision 0063) | 1. Reading comes first: links that don't compete with the text | The owner asked for his site rohit.onl's bare, plain-HTML look, whose one color is the browser's blue for links | Only the Plain theme, only links inside articles: `#0000EE` (visited `#551A8B`) by day, `#9E9EFF` (visited `#D0ADF0`) by night, always underlined, at 7 : 1 like the text. Plain's accent is its text color, so blue means only a link. Original's links stay in the text color. |

### Never

- Notifications of any kind
- Badges, streaks, reading stats or any gamification (no reading-time estimates, no "year in reading")
- Infinite scroll or algorithmic ranking ("for you")
- In-app likes, comments or social features
- Branded share buttons for specific platforms
- Full-article scraping from publishers' websites
- Rearranging what people have learned, once the look settles (see principle 5)
- Decoration that does no job: glass, blur, gradients, motion for delight; shadows except under things that float, as Apple draws them (see Visual language → Rules). The article's bars are solid, never see-through (decision 0040)

---

## Part 2: Design decisions

The philosophy applied. The principle is noted where it isn't obvious.

### Name and signature

- **Name:** nine turtles, at nineturtles.app (decision 0066; app store and trademark checks are under "Still to define").
- **Wordmark:** "nine turtles" in lowercase, in the reading serif.
- **Logo** (decision 0068): nine small turtles seen from the side, a half-circle shell and a round head each, in three rows of three, the middle row a little to the right so the rows never read as a menu's stripes. One ink, no color: the text color on the page (dark on white, light on near-black). It is the app icon and the browser-tab icon (the app's and the website's); inside the app the wordmark stays words. Its drawings are in `docs/logo/`.
- **Signature:** the accent (ink blue), quietly marking where you are, and the calm itself.

### Visual language

#### Rules
- **Regions are separated by tone and space.** Lines and shadows appear only where Apple Books draws them, never as decoration:
  - **Lines between panes** (decision 0054): on a computer only, where two panes meet (the sidebar's right edge, and the list's when the reading pane is beside it): 1px, the text color at 9%, the same tone as the list's row hairlines. Tone alone barely parts the panes by night.
  - **Hairlines inside a page:** between rows that do different jobs (rows in a grouped list, articles in the list, the parts of the text-size capsule; decision 0055), faint, in a tone of the text color, inset from the left in a grouped list. A field's own edge is a border, not a line between regions.
  - **A hairline under a scrolled top line** (decision 0028): only once a pane's content has scrolled under it, and above the shortcut list's foot while more lies below, so text never looks cut off.
  - **A hairline above the phone's article toolbar** (decision 0040): the bar is solid in the page's color, and the line stops a line of text looking sliced where it meets the bar. Both article bars are solid, never see-through.
  - **A soft shadow under things that float:** the note at the bottom of the list, a sheet, the search options popover, the Aa panel, the More menus and the shortcut list, one soft shadow and a faint edge each (decisions 0028, 0048). Nothing that sits in the page casts a shadow, except the 1 to 2px lift under a segmented control's chosen segment (decision 0042), never animated.
  - **A dim behind a sheet** (decisions 0031, 0039): only behind a sheet or the shortcut list, black at 18% by day and 45% by night, never animated; it closes with Escape or a press on it. On a phone it shows as the 10px strip above a page sheet (decision 0055).
- **Type does the hierarchy:** size and weight, never color alone or badges (the unread dot is the one mark, in the Exceptions log).
- **One accent, one family of meanings:** a theme has one accent (ink blue in Original; the text color in Plain, decision 0063) and one second color, a light green used only for a starred article's star (decision 0057). The accent marks what's *yours to look at*: what's unread (the dot) and what a search found (a faint tone behind the words) (decision 0037). Where you are is a plain grey pill with no color, its sidebar icon in ink (decision 0057). Nothing else uses it: never a button, a link, a focus outline or decoration.
- **Icons where the convention is an icon** (close, clearing the search field, back, search, settings, the sidebar toggle, the list's More (…), and the article's open original, Aa, star and More (…)), each named in its tooltip with its key and to screen readers, so the tools around the text stay quiet (decisions 0034, 0038). **Words** for Add feed, menu items, the phone's back button (with its arrow) and the main action of a form.
- **Fewer, steadier toolbars** (decision 0038): **one More (…) per place**, as Apple Books has one per collection, holding the less frequent actions as words (the list's Edit, Refresh, Mark all as read and sort order; the article's Copy link or Share and Mark unread, each with its key). **A bar's controls keep to its pane's edges,** their icons about 20px in (lined up with the sidebar button), one group at each end, so they never float in the middle of a wide window.
- **Settings opens in place of the list,** with one top line that never scrolls: the title in the serif, like the list's, and an X that closes it (Escape does too). Below it, one centred column no wider than 560px of grouped lists, as in Apple Books' settings (`docs/SPEC.md` section 18).
- **Short tasks open as a sheet** over the place you were (Add a feed, Edit feed, Edit folder): a small card that opens a little above the middle of the window, where the eye rests, its height following what's in it, the panes still in view behind it under a light dim (decision 0039). Once open, its top stays put: a message appearing in it grows it downwards, so nothing you're looking at moves. Every sheet is built the same way, like a Mac sheet in Apple Books:
  - its title in the same serif, size and weight as every other title (24px semibold, as the list's and Settings'), so the app speaks in one voice (decision 0042). It takes the keyboard's place as the sheet opens, so screen readers start there, but draws no ring: a heading can't be pressed, and the first Tab lands on a control, which rings as always;
  - the form: each field's name above it in small second-ink words, the field at the card's full width; choices among several (a feed's folders) as a grouped list of 44px rows, each ending in a tick box as a Mac draws one: a rounded square, empty when it's off, filled with a check when it's on, so even a list of one folder reads plainly. Square, never round, because a round mark says "pick one" (decision 0045). Making a new one ("New folder…") is the list's last row, a text box of its own. A choice of one (the feeds a site offers) is the same list with a round mark at each row's end, as a Mac draws a radio button: empty, or filled in the text color with a dot of the page, the first one chosen; the main action then acts on the chosen one (decision 0049);
  - a message, only once there is one, on its own line above the actions (a problem in red words after an alert icon);
  - **one row of actions at the foot, 20px under what's above it and 12px between its buttons, in a Mac sheet's order: a destructive action (Unsubscribe, Delete), if there is one, at the far left as words in a muted red with no edge; then Cancel, with no edge, only a faint tone, so the main action is the one thing with weight; then the main action at the right end.** The words say what the red one does, so red is never the only sign; what it removes is in its tooltip and said to screen readers, and Undo follows straight afterwards. On a narrow screen the destructive action takes a row of its own above the other two. The main action (here, on sign-in and in the welcome) keeps one steady fill: a pointer over it takes it a step nearer the text color, never paler, so it never looks switched off, and while it's busy it keeps its look (decision 0045).

  Cancel, Escape or a press on the dim closes it; there's no X. 12px corners, 24px padding all round. A field's helper line is 13px in the muted grey, 6px under the field and on its left edge; the line asking you to choose among several feeds is set as a field's name, 20px under the field (decision 0052).
- **One phone sheet** (decisions 0052, 0055): on a phone, Add a feed, Edit feed, Edit folder, Settings and the shortcut list are all screens of their own with one build: the serif title on the screen's 20px margin with an X (44px) at the right of the top line, and no back arrow or Cancel. Add a feed, Edit feed and Edit folder are drawn as an iOS page sheet: a 10px strip of the dimmed screen above it, 12px top corners, a grouped ground (the list's grey by day, the page by night) with each group a card on it (the page's color by day, the group tone by night), and the title a step smaller (20px) so the field sits higher; it appears at once, never sliding; the form 20px under the top line as in Settings; the main action, if there is one, the full width at the screen's foot (50px tall, 12px corners, 16px above the home bar), staying in view while the form scrolls; a destructive action (Unsubscribe, Delete) as the one red row of a group of its own, at least 32px above it, with the same tooltip, words for screen readers and Undo straight afterwards.
- **One close rule** (decisions 0049, 0052): on a computer, a sheet you commit (it has Save or Add feed) closes with Cancel only, and a sheet you only look at (Settings, the shortcut list) with an X only. On a phone every one closes with its X only. Never both. Escape closes any of them.
- **One family for things that float:** a sheet, the search options popover and the shortcut list share the same 12px corners, faint edge and one soft shadow. They, the menus, the Aa panel and the note at the list's foot sit on one raised surface: by day the page itself; by night a small lift above the page (#28282a) with a 1px edge of 8% white, as Apple Books lifts its sheets and menus, and grouped rows inside it 4% lighter again (decision 0052). Key caps in the shortcut list have a visible edge, a 1px rim and a 2px lower lip, as a printed key; the note about Tab, Enter and Escape is a footer across both columns. A popover of choices is drawn as a **menu**, not a form: small section names, then rows with a checkmark at the start of each one that holds (the search options, the list's More menu). The shortcut list is never taller than 720px and keeps at least 48px clear of the window's top and foot; its two columns are stacks of their own, the search filters under Everywhere on the right, so it fits an 800px-tall window without scrolling. On a phone it's a screen of its own, as every sheet is there (decision 0049). When it does scroll, a hairline under its title shows only once the list has moved, and one above a 16px band at its foot only while more lies below, so a row cut there reads as scrolling, never as clipping. It opens with the keyboard on its title (no ring, as in a sheet) rather than ringing its X.
- **Fields:** a 1px edge in a soft mix of the text color (still 3 : 1 against what's around it, checked automatically), over a faint fill, 8px corners. In use, the edge steps aside for one 2px ring in the softened text color (65%, as on rows), 1px clear of the field, so it is never the heaviest line on the screen; it keeps at least 3 : 1 against the field and every surface a field sits on in all six themes by day and night, checked automatically (decision 0055). A refused field's edge turns the muted red, beside the message's alert icon and words in the same red: never a thicker ring, never color alone. While the keyboard is in a refused field, the outline takes the red edge's place too, so there is only ever one line (decision 0042). Room for a message is kept only where the page is centred on screen (sign-in, the welcome): below the main action, so a message arriving under the field moves only the button (decisions 0045, 0048); in a sheet the sheet grows by its line.
- **Small menus and panels float under their button:** the list's and the article's More menus and the Aa panel, in the same family, a rounded card with one soft shadow, closed by Escape (back to the button), a press outside, or the keyboard leaving them. On a phone the Aa panel is a sheet along the bottom of the screen with a Close button, and the article's More menu opens upwards from the bottom bar.
- **One search field:** the sidebar's find field and the list's search are one slim capsule, as Apple Books draws its search: 36px tall with a mouse on a wide window, 44px on touch or a phone, 10px corners, a faint fill of the text color (6%) and no edge, a 14px search icon in the icon column and the interface's text size; the keyboard's outline marks the one in use. A chip inside it is 24px tall with 6px corners; its Remove button is still a full 44px to press. Its options menu floats on the raised surface (decision 0051, replacing 0041's unfilled find field).
- **No motion.** Views switch instantly.

#### Color

Two themes, each with a day and a night version: Original (decision 0056, which removed decision 0046's five others) and Plain (decision 0063). Original's values were matched by eye to Apple Books' Original, then held to nine turtles' own floors by the automatic checks; its values are below. Plain is the owner's own site's bare, plain-HTML look: black on white (`#000000` on `#FFFFFF`), areas a few shades off white, its accent the text color, and links in articles the browser's blue `#0000EE` (visited `#551A8B`); by night white on `#121212`, links `#9E9EFF` (visited `#D0ADF0`).

| Role (day) | Original |
|---|---|
| Background (reading area) | `#FFFFFF` |
| Accent ("where you are") | `#2C4F8C` |
| Accent contrast on background (approx.) | 8.1 : 1 |
| List area (one step off) | `#F7F7F7` |
| Sidebar (two steps off) | `#EFEFF1` |
| Text | `#141414` |
| Second ink: read titles, quieter actions | `#3C3C40` |
| Muted grey: meta, counts, hints | `#5F5F64` |

| Role (night) | Original |
|---|---|
| Background (reading area) | `#121212` |
| Accent ("where you are") | `#94B2E6` |
| Accent contrast on background (approx.) | 8.7 : 1 |
| List area (one step off) | `#1A1A1A` |
| Sidebar (two steps off) | `#232323` |
| Text | `#E8E8E8` |
| Second ink: read titles, quieter actions | `#C4C4C6` |
| Muted grey: meta, counts, hints | `#A4A4A8` |

- All accent pairs pass AAA (7 : 1); re-check if a value changes.
- **Links in articles** are underlined in the text color, **never blue**, except in Plain, whose links are the browser's own blue and purple, underlined, at 7 : 1 (decision 0063).
- **Muted greys** (read items, counts, source names) pass AA (4.5 : 1) on every area and on the selection pill, by day and by night, verified by automatic checks.
- **The selection pill** (decision 0057): a neutral grey, the text color mixed into the pane behind it (8% by day, 12% by night), with no color. Text stays at 7 : 1, muted grey at 4.5 : 1 and the unread dot at 3 : 1 on it, and a dark pill, or a day pill on a warm pane, keeps its pane's temperature (all checked automatically). A row under the pointer gets a fainter, neutral tone of the text color (5%), never the accent, always lighter than the pill.
- **Search matches** have the accent at 12% behind them , with 3px corners and a fine underline (so never tone alone), in the text's own weight; text keeps 7 : 1 on it, even inside the pill.
- **The keyboard focus outline** is a 2px line in the text color, never the accent. On rows it is the text color softened (65%, still at least 3 : 1 on every area and on the pill, checked automatically; fields use the same tone, see "Fields"), drawn 2px inside their rounded edge so it never reaches over the hairlines or the pane's edge; the pill's fill always stays. A title the keyboard is moved to gets it too, a little away from the words, except a sheet's or the shortcut list's title, which takes the place without a ring because it can't be pressed; the first Tab lands on a control that rings (decision 0042). It shows only when you're using the keyboard: never on a row after a tap or a click, even when the keyboard's place moves back to it (decision 0051).
- **Status colors** (errors, warnings) are muted, never drift toward blue, and always come with words. The feed health page needs none: its groups' names ("Not working", "Having trouble") say how bad things are (decision 0068).
- **Destructive actions** (Unsubscribe, Delete folder) are words in a muted red, `#A3261B` by day and `#E8968A` by night: at least AA (4.5 : 1) on the page, the list and a grouped list by day and by night, checked automatically. Red means only "this removes something", and the words always say what.

#### Themes
Two themes. **Original**: white paper by day, near-black by night (decision 0056). **Plain**: the owner's site rohit.onl's bare, plain-HTML look, black on white with blue underlined links (decision 0063). The five others from decision 0046 (Quiet, Paper, Bold, Calm, Focus) were removed at the owner's request: nine turtles has its own look rather than copying Apple Books' set. An **Appearance** choice picks the version: **Light**, **Dark** or **Match device** (the default), which follows the device's own light or dark setting, live, as it switches. Before nine turtles' script runs, a page is Original, by day or by night as the device is set. Both versions meet the same contrast floors, checked automatically.

#### Typography

| Use | Typeface | Why |
|---|---|---|
| Reading (default) | **Literata** | Made for long-form reading on screens |
| Reading (alternate sans) | **Atkinson Hyperlegible** | Made for legibility, including low vision |
| Reading (alternate serif) | **System serif**: the device's own (New York on Apple devices, Georgia on most others) | The owner's site rohit.onl's font (decision 0063); nothing to download |
| Interface | **The device's own system font** (San Francisco on Apple devices), **Inter** everywhere else | As in Apple Books: the interface feels native; Inter is the neutral, self-hosted fallback |
| Code in articles | **JetBrains Mono** | Clear monospace |

- All fonts are free and served by nine turtles itself (no third-party font services); System serif is already on the device.
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
- **Weights:** regular and semibold (600) for both reading and the interface: Literata's semibold for titles, headings and bold words in articles (Atkinson Hyperlegible keeps its bold). Nothing heavier, so a calm page never shouts. Semibold marks unread titles, where you are in the sidebar, the one main action in a toolbar or sheet, and a destructive action's words. The self-hosted Inter has only 400 and 600, so unread titles stay at 600 (decision 0037).
- **Three inks:** text (titles, where you are), a second ink (read titles, quieter actions); feed names in the sidebar are in full text color and muted grey (meta).
- Article lines of roughly 65–75 characters, with generous leading.

#### Languages
- **Interface:** English only in V1.
- **Articles:** any language, each marked with its language (from the feed) for screen readers and typography.
- **Search:** English, other Latin-script languages and Hindi from day one; Chinese and Japanese not in V1.

### Screens

Each screen (layout, sidebar, list, article, search, Settings, phones, keyboard, sign-in) is described once, in full, in `docs/SPEC.md`, which follows the rules above. Wherever SPEC.md and this document disagree, this document is right and SPEC.md has a bug.

### Voice

Plain, unhurried, never urgent: "Nothing new yet," never "You're missing out!" Labels say what things are and do. No exclamation marks, no hype.

---

## Still to define

- App store and trademark checks for "nine turtles" (not blocking V1). The domain is nineturtles.app (decision 0066).

## V2 parking lot

- **YouTube videos** in YouTube's own player.
- **Public reading list page:** an optional public list of some of your feeds (a modern blogroll) with one-click subscribe. No likes, no comments.
- **Per-feed modes:** inbox or river for each feed.
- **Passkey sign-in.**
- **Chinese and Japanese search.**
- **Multiple users.**
- **Own domain name.** Chosen on 25 October 2026: nineturtles.app for the website, app.nineturtles.app for the app (decision 0066).

Moved from V1 on 23 October 2026, because V1 is for the owner alone (decision 0012):

- **Backups and recovery:** nightly copies outside the host, and one before every database structure change.
- **River mode.**
- **WebSub.**
- **Feed health page.** Built 25 October 2026 (decision 0068).
- **The yearly clean-up** of unstarred articles.
- **The "New to feeds?" guide page.**
- **A tab left open across an update keeps working** without a reload.
