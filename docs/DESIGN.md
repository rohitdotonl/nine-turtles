# nine turtles: UI & UX design philosophy

> **nine turtles is a quiet place to read the web: it shows you what's there, gets out of the way, and lets you finish.**

*Last updated: 28 October 2026 (less chrome: space instead of lines between the list's rows, spaced capitals for the sidebar's section names, folders' arrows at their rows' right end, a rule written as a sentence and a quieter Aa panel, decision 0123; simpler sign-in pages with names above their fields, a small Forgot? beside Password and the passkey as a quieter button, decision 0122; a shorter Settings, with a page of its own for each less everyday group, an icon on each row and a clearer hierarchy of names and descriptions, decision 0120; fixes from a design review, decision 0118: the chosen side of a segmented control held to 3 : 1, no ring on a title, Skip to articles, the podcast player's skip figures, Recently read's day headings, the search suggestions floating and the feed health page's cards; "Wrong turn?", the 404 page, and the footer's turtles moved to About, decision 0102; newsletters as feeds, decision 0091, with each email "opened" on arrival; starter feeds in the first-visit welcome, decision 0079; a logo of nine turtles, decision 0067; a second theme, Plain, with blue article links, and System serif, decision 0063; Apple Books as the design reference, decision 0059). Each change is recorded in `docs/decisions/`.*

## Mission

Help people leave social media and return to reading the open web. Social media is **infinite, urgent and attention-grabbing**; nine turtles is **finite, calm and quiet**.

**Tiebreaker for every decision:** *does this make nine turtles feel more like a book, or more like a feed?*

## What nine turtles is, and isn't

**nine turtles is** a reader for writing published through RSS, Atom and JSON Feed. Each reader has their own feeds and reading; several readers can share one nine turtles without ever seeing each other's (approved by the owner for going multi-user, decision 0086).

**nine turtles is not:**
- **A read-later app:** it doesn't save arbitrary web pages.
- **A discovery engine:** no recommendations, trending or "you might like." You choose your sources. (One exception, approved by the owner for going multi-user: the first-visit welcome's "New to feeds?" offers a short, fixed list of five starter feeds, the same for everyone, none ticked, gone once you follow anything; decision 0079.)
- **A social network:** no profiles, followers, likes or comments.
- **A podcast app:** no podcast directory, downloads, charts or listening stats. (A podcast's episodes play in a calm player under the byline, from the publisher's own file, with your place kept and a short Up Next, approved by the owner on 27 October 2026, decision 0113. YouTube videos play in YouTube's own player, since 25 October 2026.)
- **An email app:** it never sends email or sees your inbox. (Newsletters can arrive as feeds through a private address of their own, approved by the owner for going multi-user; decision 0091.)
- **A web scraper:** it shows what publishers put in their feeds (second floor).
- **A permanent archive:** unstarred articles are kept for one year (the yearly clean-up, built 25 October 2026, decision 0089).
- **A shared space:** readers on one nine turtles never see each other's feeds, marks, searches or reading (decision 0086).

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

- **Show what the publisher put in the feed.** Never scrape the full article. A summary-only feed shows the summary and "Open original." A newsletter shows only what its email holds; its web version is never fetched. (Its invisible tracking images are loaded once when it arrives, so its sender knows it reached a reader: the owner's choice, decision 0091.)
- **Always credit the source** and link to the original.
- **Fetch politely:** on each feed's own rhythm, with ETag / Last-Modified (and WebSub, since 25 October 2026).
- **Shared links go to the publisher,** never to nine turtles.
- **Embedded media plays in the publisher's own player** (e.g. YouTube's), so views stay theirs; **an audio file the feed names plays from the publisher's own address in a simple player**, so every listen still reaches them (the owner's wording, 27 October 2026, decision 0113).

**Test:** would a publisher be glad their feed is read in nine turtles?

### The ranked principles

#### 1. Reading comes first
The article is the product; everything else is a way to reach it.
- *Explains:* in-app reading, serif by default, no images in the list, curated reader controls one press from the text (the Aa panel), links that don't compete with the text.
- **Test:** does this make reading better, or compete with it?

#### 2. Calm over engagement
nine turtles never tries to bring you back or keep you longer. It succeeds when you've read what you wanted and closed it.
- *Explains:* no notifications, river mode, no count of new items, no pull-to-refresh, the view waiting for you, a list that ends with "You're all caught up." (older items load as you reach the bottom, decision 0075, but only from what you follow).
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
- *Explains:* the fixed three-pane layout, manual refresh, "+ Add feed" always in one place, "mark all as read" only affecting what you've seen, older items loading only when you scroll to the bottom (decision 0075), no rearranging what the reader has learned once the look settles (the Apple Books redesign of October 2026 was the deliberate exception, decision 0059).
- **Test:** could this surprise someone who looked away for a second?

#### 6. Power is hidden, never missing
The 500-feed user gets everything; the 30-feed user never sees the machinery.
- *Explains:* vim keys, search filter syntax, multi-folder feeds, the search options panel, the feed health page, progressive disclosure in the sidebar.
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
| Unread counts in V1 | 2. Calm over engagement | Power users with hundreds of feeds need to know what they've seen | Inbox mode only. Muted grey, right-aligned in the sidebar. Never badges or color. Per feed and folder only, no global total. Above 999 shows "999+". The reader can hide them all (Settings › Reading, decision 0097). |
| Sidebar search always visible | 6. Power is hidden, never missing | The owner wants finding a feed by name always available | One quiet field that filters feeds and folders by name, shown once there's a feed to find. The same slim, faintly filled capsule as the list's search (decision 0051). Nothing else in the sidebar skips progressive disclosure. |
| Unread dot (decisions 0028, 0037, 0041) | Type does the hierarchy, never badges | Weight alone was hard to scan in a long list; Apple Books, Mail and Things mark unread with a dot | A drawn 8px dot in the theme's accent, centred in a 24px gutter inside the row's pill, 8px clear of an unread title, which is semibold too. No number, list rows only. |
| Starter feeds in the welcome (decision 0079) | "Not a discovery engine" | Someone new to feeds needs a first step before they know what to paste | Only behind "New to feeds? Start here" in the first-visit welcome. Five fixed feeds, the same for every reader, never ranked or personalised, none ticked; each added through the ordinary add path. Gone once anything is followed. |
| Catch me up and letting unread go (decision 0097) | 5. Nothing moves unless you move it: "mark all as read" only affecting what you've seen | The owner asked for ways to set an unread backlog down; a pile that only grows is the pull social media uses | Only by the reader's own choice: Catch me up from Unread's More menu, with Undo for exactly what it marked; letting go only once chosen in Settings (Never by default), only for articles older than the chosen wait, and never removing anything. Neither touches today's articles or moves a row on screen. |
| Mark older, above or below as read (decision 0103) | 5. Nothing moves unless you move it: "mark all as read" only affecting what you've seen | The owner asked, 27 October 2026, that marking past the chosen article include the rest of the list not loaded yet, so one press really clears what's behind it | Only by the reader's own choice (`Shift+O`, or the list's More menu), with Undo for exactly what it marked; only articles that were there when the list was loaded, never one that arrived since; only the list on screen, by its own rules; never in river mode. No row moves. |
| Blue links in Plain (decision 0063) | 1. Reading comes first: links that don't compete with the text | The owner asked for his site rohit.onl's bare, plain-HTML look, whose one color is the browser's blue for links | Only the Plain theme, only links inside articles: `#0000EE` (visited `#551A8B`) by day, `#9E9EFF` (visited `#D0ADF0`) by night, always underlined, at 7 : 1 like the text. Plain's accent is its text color, so blue means only a link. Original's links stay in the text color. |

### Never

- Notifications of any kind
- Badges, streaks, reading stats or any gamification (no reading-time estimates, no "year in reading")
- Algorithmic ranking ("for you"), or filling a list with anything you didn't subscribe to, so it never ends. (Older items loading as you reach the bottom of a list is allowed, decision 0075: the list still ends.)
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
- **Logo** (decision 0067): nine small turtles seen from the side, a half-circle shell and a round head each, in three rows of three, the middle row a little to the right so the rows never read as a menu's stripes. One ink, no color: the text color on the page (dark on white, light on near-black). It is the app icon and, as a single turtle, the browser-tab icon (the app's and the website's), and it stands before the wordmark wherever the wordmark is shown, in the wordmark's own ink. Beside the name it is sized to the name: a touch taller than the letters (1.15 times the name's size), with the name in semibold so it holds its own beside the solid turtles (decision 0073): in the sidebar's top line (23px tall on a computer, 32px on a phone's feeds screen), in the website's top bar (28px), and above the name on the sign-in page (57px tall). Its frame leaves a little room on every side, so no turtle is ever cut off. In a browser tab, where nine turtles would blur into stripes, the icon is a single turtle; the home-screen icons keep the nine, with room around them. Screen readers skip it, since the name says it in words. Its drawings are in `docs/logo/`.
- **The website's footer:** compact and centred: two short rows of links (the reader's places, about us and FAQ; then, smaller, the small print), and nothing more (decision 0102).
- **The About page's end:** the logo's turtle walks in single file, nine times: seven together and, a few steps behind, two more, in the second ink, over one line in the reading face: "Some of us like to read slowly. That's the idea." Two stay behind together, not one, so nobody is left alone. Drawn still, as everything is; screen readers skip the drawing and read the line. It lived in every page's footer until the owner moved it here (decision 0102).
- **"Wrong turn?", the 404 page** (decision 0102), the same in the app and on the website: centred, a small "404 error" in the muted grey (small capitals' size, spaced a little), then nine of the logo's turtles in a row in the text color, big enough to see at once (up to 56px each, still one line on a small phone): one at the back facing the other way, a step apart, and eight walking on. Then "Wrong turn?" as the page's title in the serif, two short lines in the reading face ("There's nothing at this address…" and "If a link in this app / on this site brought you here, tell me which one and I'll fix it."), and "— Rohit" under them, the groups well apart (40px between each on the page) so it breathes. The app adds its main action, "Back to your reading". Drawn still; screen readers skip the turtles.
- **The website's top bar:** the logo and name on the left, and on the right two places in quiet text (How it works, which opens the tour; Blog), then one solid button in the text color, "Open the app". Where you are is the place's name in the full ink, semibold and underlined, not the app's grey pill: on the website the pill read as a row of buttons. Pricing, About, Contact, FAQ, "New to feeds?", the feed finder and the starter packs (decision 0100) live in the footer; the home page and the tour also link "New to feeds?".
- **Signature:** the accent (ink blue), quietly marking where you are, and the calm itself.

### Visual language

#### Rules
- **Regions are separated by tone and space.** Lines and shadows appear only where Apple Books draws them, never as decoration:
  - **Lines between panes** (decision 0054): on a computer only, where two panes meet (the sidebar's right edge, and the list's when the reading pane is beside it): 1px, the text color at 9%, the same tone as the list's row hairlines. Tone alone barely parts the panes by night.
  - **Hairlines inside a page:** between rows that do different jobs (rows in a grouped list, the parts of the text-size capsule; decision 0055). The article list has none: space alone parts its rows (decision 0123), faint, in a tone of the text color, inset from the left in a grouped list. A field's own edge is a border, not a line between regions.
  - **A hairline under a scrolled top line** (decision 0028): only once a pane's content has scrolled under it, and above the shortcut list's foot while more lies below, so text never looks cut off.
  - **A hairline above Edit's bar** (decision 0080): on Your feeds, while Edit is on, the bar of actions at the page's foot is solid in the page's color, with the same 9% line above it, so a row scrolling under it reads as scrolling, never as cut off.
  - **A hairline above the phone's article toolbar** (decision 0040): the bar is solid in the page's color, and the line stops a line of text looking sliced where it meets the bar. Both article bars are solid, never see-through.
  - **A soft shadow under things that float:** the note at the bottom of the list, a sheet, the search options popover and the search suggestions, the Aa panel, the More menus, the shortcut list and "Skip to articles" while the keyboard is on it, one soft shadow and a faint edge each (decisions 0028, 0048). Nothing that sits in the page casts a shadow, except the 1 to 2px lift under a segmented control's chosen segment (decision 0042), never animated.
  - **A dim behind a sheet** (decisions 0031, 0039): only behind a sheet, the shortcut list or an opened picture, black at 18% by day and 45% by night, never animated; it closes with Escape or a press on it. On a phone it shows as the 10px strip above a page sheet (decision 0055).
- **Type does the hierarchy:** size and weight, never color alone or badges (the unread dot is the one mark, in the Exceptions log).
- **One accent, one family of meanings:** a theme has one accent (ink blue in Original; the text color in Plain, decision 0063) and one second color, a light green used only for a starred article's star (decision 0057). The accent marks what's *yours to look at*: what's unread (the dot) and what a search found (a faint tone behind the words) (decision 0037). Where you are is a plain grey pill with no color, its sidebar icon in ink (decision 0057). Nothing else uses it: never a button, a link, a focus outline or decoration.
- **Icons where the convention is an icon** (close, clearing the search field, back, search, settings, the sidebar toggle, the list's More (…), and the article's open original, Aa, star and More (…); in the sidebar's icon column, each fixed list's sign, a saved search's magnifier and a collection's small shelf of books, decision 0108; Up Next's small list and an episode row's headphones, and the podcast player's back 15, Play / Pause and forward 30, decision 0113; and, at the left of each row on Settings' first page, a line drawing for that setting, decision 0120), each named in its tooltip with its key and to screen readers, so the tools around the text stay quiet (decisions 0034, 0038). **Words** for Add feed, menu items, the phone's back button (with its arrow) and the main action of a form.
- **Fewer, steadier toolbars** (decision 0038): **one More (…) per place**, as Apple Books has one per collection, holding the less frequent actions as words (the list's Edit, Refresh, Mark all as read and sort order, and a collection's Rename… and Delete; the article's Copy link or Share, Mark unread and Add to collection…, each with its key). **A bar's controls keep to its pane's edges,** their icons about 20px in (lined up with the sidebar button), one group at each end, so they never float in the middle of a wide window.
- **The podcast player** (decision 0113, `docs/SPEC.md` section 35) is a still panel under the byline in a faint tone of the text, 12px corners, as the YouTube box is: one round Play / Pause in the text color (never the accent), back 15 and forward 30 as quiet line icons with their figures large enough to read (about 11px, semibold, inside the arrow), the length (until it starts playing, then the times say it) and the speed in small words, and a plain slider (its mark in the text color) with the times under it in tabular figures. No waveform, artwork, progress ring or animation. While one plays, a slim **Now playing** bar sits at the foot of the app on the list's own background with a faint top line, taking its own room (it never floats over text): back 15, Play / Pause, the title over the podcast's name, and Close. On a phone it sits just above the article's toolbar, and steps aside while the same episode's own player is on screen, so the episode never shows twice (decision 0118).
- **Edit, for choosing several things** (decision 0080), as in Apple Books' Edit: a quiet button at the right of a list's heading, its word becoming **Done** while it's on; each row then ends in a tick box (the rounded square of Edit feed's folders), **Choose all** / **Choose none** sits beside Done, and a bar at the page's foot says how many are chosen and holds the actions, a destructive one in its red words. Only Your feeds has it so far.
- **Settings opens in place of the list,** with one top line that never scrolls: the title in the serif, like the list's, and an X that closes it (Escape does too). Below it, one centred column no wider than 560px of grouped lists, as in Apple Books' settings (`docs/SPEC.md` section 18).
- **A short Settings** (decision 0120): its first page holds only the everyday settings (Reading, and Look and feel's Appearance and Text size); every other group is a row ending in › that opens a page of its own in its place, at its own address, as Apple Books and iOS settings go one level down. Such a page has **‹ Settings** on a line above its serif title, in the second ink, and no X; it and Escape go back, and the keyboard returns to the row that opened it. Nothing slides: the page is simply there.
- **Settings' rows** (S1, decision 0120): group names in small uppercase muted letters (0.72rem, letter-spacing 0.07em); each row's name about 0.98rem at weight 500 in the text color, its description straight under it at 0.8rem in the muted grey (line height 1.35), so name and description read as one; 12px above and below a row on a computer and 14px on a phone. On a computer the control sits at the row's right end; on a phone, under the words at the row's full width. On the first page each row starts with an icon in the muted grey (never the accent, never on a tile), 18px, its centre on the centre of the name's first line whether or not a description follows. Edit feed's settings rows are built the same way, without icons.
- **Short tasks open as a sheet** over the place you were (Add a feed, Edit feed, Edit folder): a small card that opens a little above the middle of the window, where the eye rests, its height following what's in it, the panes still in view behind it under a light dim (decision 0039). Once open, its top stays put: a message appearing in it grows it downwards, so nothing you're looking at moves. Every sheet is built the same way, like a Mac sheet in Apple Books:
  - its title in the same serif, size and weight as every other title (24px semibold, as the list's and Settings'), so the app speaks in one voice (decision 0042). It takes the keyboard's place as the sheet opens, so screen readers start there, but draws no ring: a heading can't be pressed, and the first Tab lands on a control, which rings as always;
  - the form: each field's name above it in small second-ink words, the field at the card's full width; choices among several (a feed's folders) as a grouped list of 44px rows, each ending in a tick box as a Mac draws one: a rounded square, empty when it's off, filled with a check when it's on, so even a list of one folder reads plainly. Square, never round, because a round mark says "pick one" (decision 0045). Making a new one ("New folder…") is the list's last row, a text box of its own. A choice of one (the feeds a site offers) is the same list with a round mark at each row's end, as a Mac draws a radio button: empty, or filled in the text color with a dot of the page, the first one chosen; the main action then acts on the chosen one (decision 0049);
  - a message, only once there is one, on its own line above the actions (a problem in red words after an alert icon);
  - **one row of actions at the foot, 20px under what's above it and 12px between its buttons, in a Mac sheet's order: a destructive action (Unsubscribe, Delete), if there is one, at the far left as words in a muted red with no edge; then Cancel, with no edge, only a faint tone, so the main action is the one thing with weight; then the main action at the right end.** The words say what the red one does, so red is never the only sign; what it removes is in its tooltip and said to screen readers, and Undo follows straight afterwards. On a narrow screen the destructive action takes a row of its own above the other two. The main action (here, on sign-in and in the welcome) keeps one steady fill: a pointer over it takes it a step nearer the text color, never paler, so it never looks switched off, and while it's busy it keeps its look (decision 0045).

  Cancel, Escape or a press on the dim closes it; there's no X. 12px corners, 24px padding all round. A field's helper line is 13px in the muted grey, 6px under the field and on its left edge; the line asking you to choose among several feeds is set as a field's name, 20px under the field (decision 0052).
- **One phone sheet** (decisions 0052, 0055): on a phone, Add a feed, Edit feed, Edit folder, Settings and the shortcut list are all screens of their own with one build: the serif title on the screen's 20px margin with an X (44px) at the right of the top line, and no back arrow or Cancel. Add a feed, Edit feed and Edit folder are drawn as an iOS page sheet: a 10px strip of the dimmed screen above it, 12px top corners, a grouped ground (the list's grey by day, the page by night) with each group a card on it (the page's color by day, the group tone by night), and the title a step smaller (20px) so the field sits higher; it appears at once, never sliding; the form 20px under the top line as in Settings; the main action, if there is one, the full width at the screen's foot (50px tall, 12px corners, 16px above the home bar), staying in view while the form scrolls; a destructive action (Unsubscribe, Delete) as the one red row of a group of its own, at least 32px above it, with the same tooltip, words for screen readers and Undo straight afterwards. (Two exceptions, the owner's choice: Delete data and Delete account have no Undo, only their one "Are you sure?" sheet; decisions 0088 and 0117, SPEC section 18.)
- **One close rule** (decisions 0049, 0052): on a computer, a sheet you commit (it has Save or Add feed) closes with Cancel only, and a sheet you only look at (Settings, the shortcut list, an opened picture) with an X only. On a phone every one closes with its X only, except the two short collection sheets, Add to collection and Rename (decision 0108): they have no address and aren't screens of their own, so on a phone they stay the same small card over the article or list, with Cancel and Save, as the Aa panel stays a panel. Never both. Escape closes any of them.
- **An opened picture** (decision 0107): a picture the article shows clearly smaller than it really is opens, with a press, alone on a plain card of the raised surface over the dim, as large as fits with a margin all round (never larger than it really is), its alt text under it as a caption in the second ink, a quiet underlined "Open in new tab" under that, and an X (44px, "Close (Esc)") at the card's top right. On a phone it stays a card over the dim rather than a screen of its own, so the picture is the only thing on screen; pinch-zoom works as on any page. It appears and goes at once; by night it shows at full brightness.
- **One family for things that float:** a sheet, the search options popover, the search suggestions (a small panel floating over the list as you type a filter, so the results never move; the chosen one marked by a bar in the text color and a faint tone, decision 0118) and the shortcut list share the same 12px corners, faint edge and one soft shadow. They, the menus, the Aa panel and the note at the list's foot sit on one raised surface: by day the page itself; by night a small lift above the page (#28282a) with a 1px edge of 8% white, as Apple Books lifts its sheets and menus, and grouped rows inside it 4% lighter again (decision 0052). Key caps in the shortcut list have a visible edge, a 1px rim and a 2px lower lip, as a printed key; the note about Tab, Enter and Escape is a footer across all its columns. A popover of choices is drawn as a **menu**, not a form: small section names, then rows with a checkmark at the start of each one that holds (the search options, the list's More menu). The shortcut list is never taller than 720px and keeps at least 48px clear of the window's top and foot; on a window at least 1024px wide it is up to 1152px wide (32px clear of the window's sides), with three columns that are stacks of their own (Reading; Getting around and Anywhere; Tidying up and the search filters), so it fits an 800px-tall window without scrolling; two columns fit no longer once decision 0110 added keys. On a medium window it has two columns and may scroll. On a phone it's a screen of its own, as every sheet is there (decision 0049). When it does scroll, a hairline under its title shows only once the list has moved, and one above a 16px band at its foot only while more lies below, so a row cut there reads as scrolling, never as clipping. It opens with the keyboard on its title (no ring, as in a sheet) rather than ringing its X. It only lists until **Change keys…**, a quiet underlined link at the right of its foot line, turns the same sheet into its editing mode (decision 0110): the title becomes "Change keys", each key that can change becomes a 44px button around its cap, with no edge of its own and a faint tone under the pointer; one waiting for a key says "Press the new key…" in words on the faint tone; a question or a refusal sits in place under its row, in the second ink, with Cancel and Use it as small buttons; a changed key has a quiet underlined Reset after it; and a sheet's row of actions, always in view at the foot, holds Reset all keys at the left and Done (the main action) at the right. Nothing moves or animates.
- **Fields:** a 1px edge in a soft mix of the text color (still 3 : 1 against what's around it, checked automatically), over a faint fill, 8px corners. In use, the edge steps aside for one 2px ring in the softened text color (65%, as on rows), 1px clear of the field, so it is never the heaviest line on the screen; it keeps at least 3 : 1 against the field and every surface a field sits on in all six themes by day and night, checked automatically (decision 0055). A refused field's edge turns the muted red, beside the message's alert icon and words in the same red: never a thicker ring, never color alone. While the keyboard is in a refused field, the outline takes the red edge's place too, so there is only ever one line (decision 0042). Room for a message is kept only where the page is centred on screen (sign-in, sign-up, the welcome): below the main action (on the sign-in pages, at the column's foot, decision 0122), so a message arriving under the field moves only what's under it (decisions 0045, 0048); in a sheet the sheet grows by its line.
- **The sign-in pages** (decision 0122; sign-in, sign-up, Forgot? and the page its link opens), the usual pattern Apple's own sign-in sheets use: one centred column (at most 320px; the phone's 20px margins) under the logo and wordmark. Each field's name is real text above it, as in a sheet (small second-ink words on the field's left edge, 6px over it), never a placeholder alone; a field's helper line sits under it as a sheet's does. The password's name sits 24px under the email field, with a small **Forgot?** (the meta size, underlined, in the text color) at the right end of its line: small to the eye, 44px tall and wide to touch, its box reaching up into that room, never over a field. One main action (Sign in, Sign up, Email me a link, Set password) at the column's full width; a second way in (Sign in with a passkey, Back to sign in after Check your email) is an edged button under it, never filled; the way to the other page ("New here? Sign up", "Have an account? Sign in") is a line of words with its link, centred, at the foot. The room for a message is kept at the column's foot, so a message arriving moves only what's under it.
- **A switch** (decision 0077), as Apple draws one, only where something is on or paused (a rule in Settings › Rules): a capsule track and a round knob, never animated. On, the track is filled in the text color with the knob at the right; off, an empty track with a muted edge and the knob at the left, so the knob's side says which as well as the fill, and the words beside it ("Paused.") say it too. Never the accent or green. 44px to press.
- **Section names are small spaced capitals** (decision 0123): Settings' group names and the sidebar's section names (Folders, Feeds), so a heading never reads as one more row. A folder in the sidebar is a plain row on the names' edge, with no icon; its show-or-hide arrow waits at the row's right end, and its open feeds have a faint 1px line down their left, in a 14% tone of the text color.
- **The Aa panel** (decision 0123) is one quiet line per setting: its name in small spaced capitals in a fixed column at the left, its choices after it. Text size is the stepper; Appearance three 24px swatches (white, black, half of each) with a faint edge, the chosen one ringed in the text color; theme, font and line width plain words in the second ink, the chosen one semibold in full ink and underlined (2px), so it never shows by color alone.
- **A rule is written as one sentence** (decision 0123): in the reading serif, its blanks real text boxes and menus with no box of their own, only a dashed line under each in a soft tone of the text, as wide as their words and 44px to press; the keyboard's outline marks the one in use, and a refused blank's line turns the muted red beside the message's words.
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
- **A segmented control's chosen side** (decision 0118; Inbox / River, Light / Dark and the rest, in Settings, Edit feed and the Aa panel) stands at 3 : 1 or more against the rest of the control, WCAG's non-text contrast, by day and by night in both themes, checked automatically. By day it is the page's own tone with a thin 1px edge of the text color at 60% and its small lift; by night it is filled with the text color at 65%, its semibold words in the page's color. Never the accent.
- **The selection pill** (decision 0057): a neutral grey, the text color mixed into the pane behind it (8% by day, 12% by night), with no color. Text stays at 7 : 1, muted grey at 4.5 : 1 and the unread dot at 3 : 1 on it, and a dark pill, or a day pill on a warm pane, keeps its pane's temperature (all checked automatically). A row under the pointer gets a fainter, neutral tone of the text color (5%), never the accent, always lighter than the pill.
- **Search matches** have the accent at 12% behind them , with 3px corners and a fine underline (so never tone alone), in the text's own weight; text keeps 7 : 1 on it, even inside the pill.
- **The keyboard focus outline** is a 2px line in the text color, never the accent. On rows it is the text color softened (65%, still at least 3 : 1 on every area and on the pill, checked automatically; fields use the same tone, see "Fields"), drawn 2px inside their rounded edge so it never reaches over the hairlines or the pane's edge; the pill's fill always stays. A title the keyboard is moved to (a screen opening, a sheet, an opened article, a key such as `g` then `a`) takes the place without a ring, because it can't be pressed and a ring would make it look like a button; the first Tab lands on a control that rings (decisions 0042, 0118). When the app opens, the keyboard starts on the list's title, not the sidebar's wordmark (on a phone's feeds screen, the wordmark). **Skip to articles** is the first Tab stop: hidden until the keyboard reaches it, then a small label on the raised surface at the window's top left, semibold in the text color, with the usual ring (decision 0118). It shows only when you're using the keyboard: never on a row after a tap or a click, even when the keyboard's place moves back to it (decision 0051).
- **Status colors** (errors, warnings) are muted, never drift toward blue, and always come with words. The feed health page needs none: its groups' names ("Not working", "Having trouble") say how bad things are (decision 0071).
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
- **In an article read offline** (decision 0101), each image is a short line in the interface font, small and in the second ink, as the end note is, so it never reads as the author's words; the list's "Offline. Showing the articles saved on this device." sits above the list in the muted meta size, as a search's count does. A failing feed's "This feed hasn't worked since …" sits in the same place, in the second ink and the small size, its button a text button in the same ink: information, never an alarm, so no accent and no red (decision 0106).
- **The feed health page's cards** (decision 0118): each feed a card in the grouped lists' grey, 12px corners, 16px by 18px inside, 12px apart. Its name (about 16px, semibold), one sentence on what happened (its lead in semibold, line height 1.5), then a two-column list in 13.5px, muted labels (Address, in the monospaced face at 12.8px, and Last worked), then, under a hairline, Find new address as the main filled button, Retry filled in the segmented controls' track grey so it stands off the card, and Unsubscribe in red words at the right end. On a narrow card the two buttons share their row and Unsubscribe has its own line. Every target 44px.
- **Recently read's day headings** (decision 0118): only in that list, "Today", "Yesterday", the weekday, then the date, set as the sidebar's section names are (meta size, semibold, muted grey) on the titles' edge, with 20px above to part one day from the next. Never a count.
- **Spacing** in steps of 4px, mostly 8, 16, 24, 40 and 64px.
- **Weights:** regular and semibold (600) for both reading and the interface, and medium (500) only for the names of Settings' and Edit feed's rows (decision 0120; where the device's own font is missing, the self-hosted Inter shows them in its regular): Literata's semibold for titles, headings and bold words in articles (Atkinson Hyperlegible keeps its bold). Nothing heavier, so a calm page never shouts. Semibold marks unread titles, where you are in the sidebar, the one main action in a toolbar or sheet, and a destructive action's words. The self-hosted Inter has only 400 and 600, so unread titles stay at 600 (decision 0037).
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

Ideas not built yet. Once one is built, it leaves this list; what it does is
then in `docs/SPEC.md`, and the finished work in `docs/archive/plan-done.md`.

- **Public reading list page:** an optional public list of some of your feeds (a modern blogroll) with one-click subscribe. No likes, no comments.
- **Chinese and Japanese search.**
