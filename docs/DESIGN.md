# nine turtles: UI & UX design philosophy

> **nine turtles is a reader for the small web: a quiet place to read the people worth knowing, and write back to them.**

*Last updated: 3 November 2026 (the website wears the brand: the app's grey sidebar band on every page and the new front page, decision 0153; YouTube: the Play box shows the video's title, a Short's box stands up, chapters under it and a video's mark in the list, decision 0149; 2 November: no unread counts: a small dot at a sidebar row's end says something is new, and the Exceptions log's unread counts row goes, decision 0148; seven themes cut to four, Original, Plain, Fountain pen and Signal, decision 0145; the star drawn in the ink and oxblood for delete and errors, decision 0143; the brand's details built: empty lists, "Wrong turn?" on one left edge, emails signed by Rohit, the share picture and the tab icon, decision 0142; a new mission line, "a reader for the small web", and the weekly email the one exception to "no notifications", decision 0140; every brand decision on one page, the brand sheet `BRAND.md`, decision 0139; 1 November: five themes after Braun's colors, Brushed, Anodised, Fountain pen, Heather and Signal, their bright accent a mark held to 3 : 1, decision 0136; a critique checklist every change the reader sees passes, decision 0135; ten principles: forgiving and cohesive added, warm never cute, the three panes and the logo kept, decision 0134; our own ranked principles, "Nothing pulls" first, breaking a principle only on purpose and written down, and one system for spacing, type and names, decision 0133; design first, the book tiebreaker retired, a warmer voice with "I" from Rohit and never "we", honesty as a public promise, easter eggs found and never shown, and "no decoration that pretends", decision 0132; Apple Books dropped as the design reference, decision 0131; before that, 28 October: the article list's titles in the reading serif with more room around each row, decision 0128; less chrome: space instead of lines between the list's rows, spaced capitals for the sidebar's section names, folders' arrows at their rows' right end, a rule written as a sentence and a quieter Aa panel, decision 0123; simpler sign-in pages with names above their fields, a small Forgot? beside Password and the passkey as a quieter button, decision 0122; a shorter Settings, with a page of its own for each less everyday group, an icon on each row and a clearer hierarchy of names and descriptions, decision 0120; fixes from a design review, decision 0118: the chosen side of a segmented control held to 3 : 1, no ring on a title, Skip to articles, the podcast player's skip figures, Recently read's day headings, the search suggestions floating and the feed health page's cards; "Wrong turn?", the 404 page, and the footer's turtles moved to About, decision 0102; newsletters as feeds, decision 0091, with each email "opened" on arrival; starter feeds in the first-visit welcome, decision 0079; a logo of nine turtles, decision 0067; a second theme, Plain, with blue article links, and System serif, decision 0063; Apple Books as the design reference, decision 0059). Each change is recorded in `docs/decisions/`.*

## Mission

Help people leave social media and return to reading the open web. Social media is **infinite, urgent and attention-grabbing**; nine turtles is **finite, calm and quiet**.

**Tiebreaker:** the book question ("more like a book, or more like a feed?") was retired by the owner on 1 November 2026 (decision 0132). A new one will be tested in UI and UX trials before it's adopted; the candidate is *"does this feel like a letter from someone, or a feed from something?"* Until then, decide by the floors and the principles.

## What nine turtles is, and isn't

**nine turtles is** a reader for the small web: the writing people publish on their blogs, newsletters, channels and podcasts, read through RSS, Atom and JSON Feed. Each reader has their own feeds and reading; several readers can share one nine turtles without ever seeing each other's (approved by the owner for going multi-user, decision 0086).

**nine turtles is not:**
- **A read-later app:** it doesn't save arbitrary web pages.
- **A discovery engine:** no recommendations, trending or "you might like." You choose your sources. (One exception, approved by the owner for going multi-user: the first-visit welcome's "New to feeds?" offers a short, fixed list of five starter feeds, the same for everyone, none ticked, gone once you follow anything; decision 0079.)
- **A social network:** no profiles, followers, likes or comments.
- **A podcast app:** no podcast directory, downloads, charts or listening stats. (A podcast's episodes play in a calm player under the byline, from the publisher's own file, with your place kept and a short Up Next, approved by the owner on 27 October 2026, decision 0113. YouTube videos play in YouTube's own player, since 25 October 2026.)
- **An email app:** it never sends email for you or sees your inbox. (Newsletters can arrive as feeds through a private address of their own, approved by the owner for going multi-user; decision 0091.)
- **A web scraper:** it shows what publishers put in their feeds (second floor).
- **A permanent archive:** unstarred articles are kept for one year (the yearly clean-up, built 25 October 2026, decision 0089).
- **A shared space:** readers on one nine turtles never see each other's feeds, marks, searches or reading (decision 0086).

## Design reference: our own design language (being written)

On 1 November 2026 the owner dropped Apple Books as the design reference (decision 0131, replacing decision 0059). nine turtles will have **its own design principles and design language**, with design as a first-class part of the product; the goal: **cited for taste and coherence, recognisable from one screenshot.** The principles in Part 1 are our own (decision 0133); the design language (colors, type, accent, the turtles' role, the brand idea) is being decided with the owner through mockups, and until it is, the current look stays.

**Design comes first** (decision 0132): design is the most important thing in nine turtles. Agents are proactive about it and bring up broken or better design even outside the task at hand; design, UI and UX decisions are tried in mockups, a safe and a bold choice each, preferably running locally on the owner's Mac. Words alone don't settle a look.

- **Until the design language is settled:** the floors first, always; then the rest of this document as it stands. The current look (much of it first modelled on Apple Books) stays until the new language replaces it; don't change things only to come closer to Apple Books, and don't start redesign work without the owner.
- **What's fixed:** the three-pane structure (sidebar, list, page; one at a time on a phone), the owner's choice (decision 0134): it is one of the most reliable designs a reader has. Design experiments happen inside the third pane, the article's, which may become more wholesome and memorable. The logo stays: the same nine turtles, redrawn a little heavier in November 2026 ([`BRAND.md`](BRAND.md)).
- **The brand sheet,** [`BRAND.md`](BRAND.md) (decision 0139), is one page with every brand decision: name and words, typefaces, color and themes, the logo and app icon, the turtles' only job, icons, empty screens, emails and the website. It is part of this document, with its standing; every change a reader can see follows it, and a new brand decision goes there first.
- **Who may change what:** the mission, the floors, the ranked principles and the "Never" list change only with the owner's yes.

---

## Part 1: The philosophy

Every decision in Part 2 traces back to these. Reason from them rather than debating new questions from scratch.

**Two floors** and **ten ranked principles.** (A third floor, never lose the reader's data or put them at risk, is engineering's: [`ENGINEERING.md`](ENGINEERING.md) → "The floor".) Floors are not ranked: nothing can trade them away. Between ranked principles, **the higher one wins**.

### The first floor: everyone can read here

No amount of calm or minimalism justifies text some people can't read. Everything else in this document may change; this never does. When a design idea conflicts with it, we find another way to do the idea (the owner, 1 November 2026).

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

Adopted with the owner on 1 November 2026 (decisions 0133 and 0134), replacing the seven principles first modelled on Apple Books. Where each one comes from (the owner's design field guide: Norman, Rams, Victor, Reichenstein, Tufte, Vignelli, Fukasawa and Hara, and Rams' ten principles in their updated form) is in [`RnD/design-principles.md`](RnD/design-principles.md).

#### 1. Nothing pulls
nine turtles never tries to bring you back or keep you longer. It succeeds when you've read what you wanted and closed it. The one thing that reaches out, the weekly email, is chosen by the reader, ends, and turns off in one press.
- *Explains:* no notifications, no counts or streaks, no pull-to-refresh, manual refresh, a list that ends (older items load as you reach the bottom, decision 0074, but only from what you follow).
- **Test:** would the reader be glad it happened, even on a week they didn't open the app? Would a social media company want it? If yes, be suspicious.

#### 2. The writer comes first
The article and the person who wrote it are the product; nine turtles only helps the reader and the writer meet. The text is the interface, and our tools step back around it.
- *Explains:* in-app reading, serif by default, no images in the list, the publisher's name leading the byline, reader controls one press from the text (the Aa panel), links that don't compete with the text.
- **Test:** does this make the writer clearer, or put us in front of them?

#### 3. Clear at a glance
Every screen says what it's for, where you are and what you can do there, in the reader's words, without a tour. It answers the reader's question before they ask, from what the app already knows, and asks only as a last resort. Familiar ways are kept unless broken on purpose (see "Breaking a principle on purpose"). Quiet must never become hidden.
- *Explains:* regions separated by tone, one accent with one meaning, words wherever an icon isn't universal, the search scope chip, plain names.
- **Test:** squint (are the regions still distinct?) and five seconds (can someone say what the screen is for and where to act?).

#### 4. Forgiving
Mistakes are cheap. Undo instead of "Are you sure?"; a message says what happened and how to fix it; nothing the reader typed is thrown away; destructive actions sit apart from frequent ones.
- *Explains:* Undo after every removal, a refused field keeping what was typed, oxblood words for what removes something.
- **Test:** if the reader slips, can they get back in one press, without reading a dialog?

#### 5. Honest by default
Never look more capable, urgent or free than it is. Say what things do and cost; leaving is as easy as joining. Said plainly, never preached (see "Honest by default: a public promise" in Part 2).
- **Test:** would we be comfortable if the reader saw exactly how this works?

#### 6. Cohesive
One system: the same thing always looks, behaves and is named the same, everywhere, so the reader learns it once (see "One system" in Part 2).
- **Test:** does this introduce a new way of doing something the app already does?

#### 7. Made by a person, to the last detail
Care shows in the details, beauty is a goal in itself, and a person's voice is in it: warm, never cute. Every state is designed: empty, loading, offline, error, a very long name, another script, 200% text.
- **Test:** could this screen belong to any other app? Is any state left to chance? Is it beautiful, not just correct?

#### 8. Instant and still
Every press is answered within about a tenth of a second, visibly, without motion. Changes show as you make them, with no Apply buttons. Layout, positions and content change only through the reader's action.
- *Explains:* no spinners for what the app already has, the next article prefetched, act immediately and confirm quietly (a word changing, such as "Starred"), the Aa panel changing the article as you choose, no transitions, no feedback through motion (no springs, no pull-to-refresh), the fixed layout, "mark all as read" only affecting what you've seen.
- **Test:** does anyone ever wait for the interface, press Apply, or see something move by itself?

#### 9. Power is findable, never in the way
Keys and advanced tools speed up what's visible; nothing exists only as a key. A beginner never trips on them and can find them when needed.
- *Explains:* the shortcut list, keys named in tooltips, search filter syntax, the search options panel, the feed health page, progressive disclosure in the sidebar; a command menu is planned (`RnD/design-principles.md`).
- **Test:** can a beginner find this when they need it, and ignore it until then?

#### 10. Less, but better, and built to last
As little design as possible: if removing something wouldn't make the task harder, remove it. Nothing that looks dated next year: no trends, no glass, no decoration that pretends. Light enough to run well on an old phone for ten years, with few outside parts. The reader's data is theirs, and they're free to leave.
- **Test:** would removing this hurt? Will it still look right in ten years?

(Respect for the publisher is the second floor, above all of these.)

**Breaking a principle on purpose** (the owner, 1 November 2026): a principle can be broken consciously when the result is clearly better, never by accident. Every break is written in the Exceptions log below with its reason and its limits; if it can't be justified there, it doesn't ship.

### Rules about the rules

1. **The design language settles questions of look and feel** once it's written (see "Design reference"); until then this document does. The floors always come first.
2. **Exceptions are written down** in the Exceptions log below: where, why and within what limits. Floors have no exceptions; only the owner can change a floor's wording, through a note in `docs/decisions/`.
3. **New features go through the floors and principles in order** and stop at the first "no":
   1. Does it break a floor? → no.
   2. Is it useful: does it serve reading people or writing back to them? → if not, no.
   3. Does it pull people back or keep them longer than they wanted? → no.
   4. Does it put us in front of the writer, or hurt reading? → no.
   5. Is it clear at a glance? If not, can it be found when needed and stay out of the way?
   6. Is it forgiving, honest and cohesive, and is every state of it designed?
   7. Is it instant, and does it leave everything still that the reader didn't move? If not, redesign until it is.
   8. Is it as little as it can be, and will it still look right in ten years?
   9. Does it challenge the usual way for a good reason, or only copy what others do? Copying is fine where the usual way serves the reader; changing it needs a written reason.
4. **Scope is checked too.** A feature that would make nine turtles one of the things under "nine turtles is not" is out, however good.
5. **Every change the reader sees passes the critique checklist** (decision 0135), before its pull request and again in review. It turns the principles into questions an agent can answer from a screenshot or a mockup; a "no" is fixed, or written in the Exceptions log as a deliberate break:
   - Can someone tell, in five seconds, what the screen is for and where to act? Does every action have a visible sign (a word, a button's shape, an icon with its name), with keys and gestures only as shortcuts? (3, 9)
   - Does the screen answer the reader's main question with no press, using what the app already knows? (3)
   - Are the words the reader's own, and familiar ways kept, or is the break written down? (3)
   - Does every press get an instant, visible answer without motion, and does anything longer than a second say what's happening? (8)
   - Can a slip be undone in one press, and does every message say how to fix the problem, keeping what was typed? (4)
   - Would removing any element make the task harder? If not, remove it. Is the chrome quieter and smaller than the text? (10, 2)
   - Are price, terms and the way out as visible as the offer, with no pre-ticked box and no fake urgency? (5)
   - Does it use only the system's spacing, type sizes, colors and names? (6)
   - Is the article text readable at every size: line length, line height, contrast? Is nothing on a busy or see-through background? (2, 10, first floor)
   - Are the empty, loading, offline, error, very long, other-script and 200%-text states designed, and does it work by keyboard and screen reader? (7, first floor)
   - Is it beautiful, not just correct, and would it still look right in ten years? (7, 10)
   - Does it pull? Would a social media company want it? (1)

**Worked example: AI summaries.** They put something between the reader and the writer (2), but a power user (9) might want them to triage 500 feeds. Result: never in the reading pane; possibly an opt-in, hidden triage tool in the list. The philosophy answered *where*, not yes or no.

**Worked example: fetch the full article when a feed has only a summary.** It would help reading (2) but breaks the publisher floor. Floors aren't ranked against principles, so the answer is no: show the summary and "Open original."

### Exceptions log

| Exception | Principle bent | Why | Limits |
|---|---|---|---|
| Sidebar search always visible | 9. Power is findable, never in the way | The owner wants finding a feed by name always available | One quiet field that filters feeds and folders by name, shown once there's a feed to find. The same slim, faintly filled capsule as the list's search (decision 0051). Nothing else in the sidebar skips progressive disclosure. |
| The logo's lockup in the sidebar (BRAND.md → "The logo", 2 November 2026) | 6. Cohesive (one type scale, 4px spacing steps) | The redrawn nine and the name were tuned together by eye so the turtles stand on the name's line and hold their own beside it; the owner chose it on 2 November 2026 | The 9px is only between the nine and the name (the sidebar and the website's band); the sidebar's name is 22px so the lockup fits on one line beside the sidebar button. Nothing else uses 9px. |
| Unread dot (decisions 0028, 0037, 0041) | Type does the hierarchy, never badges | Weight alone was hard to scan in a long list; Apple Books, Mail and Things mark unread with a dot | A drawn 8px dot in the theme's accent, centred in a 24px gutter inside the row's pill, 8px clear of an unread title, which is semibold too; and, a step smaller (6px), at the end of a sidebar row with something unread, its name heard as "… unread" (decision 0148). No number, ever: the sidebar's counts are gone (decision 0148). Only list rows and sidebar rows. |
| Starter feeds in the welcome (decision 0079) | "Not a discovery engine" | Someone new to feeds needs a first step before they know what to paste | Only behind "New to feeds? Start here" in the first-visit welcome. Five fixed feeds, the same for every reader, never ranked or personalised, none ticked; each added through the ordinary add path. Gone once anything is followed. |
| Catch me up and letting unread go (decision 0097) | 8. Instant and still: "mark all as read" only affecting what you've seen | The owner asked for ways to set an unread backlog down; a pile that only grows is the pull social media uses | Only by the reader's own choice: Catch me up from Unread's More menu, with Undo for exactly what it marked; letting go only once chosen in Settings (Never by default), only for articles older than the chosen wait, and never removing anything. Neither touches today's articles or moves a row on screen. |
| Mark older, above or below as read (decision 0103) | 8. Instant and still: "mark all as read" only affecting what you've seen | The owner asked, 27 October 2026, that marking past the chosen article include the rest of the list not loaded yet, so one press really clears what's behind it | Only by the reader's own choice (`Shift+O`, or the list's More menu), with Undo for exactly what it marked; only articles that were there when the list was loaded, never one that arrived since; only the list on screen, by its own rules; never in river mode. No row moves. |
| Blue links in Plain (decision 0063) | 2. The writer comes first: links that don't compete with the text | The owner asked for his site rohit.onl's bare, plain-HTML look, whose one color is the browser's blue for links | Only the Plain theme, only links inside articles: `#0000EE` (visited `#551A8B`) by day, `#9E9EFF` (visited `#D0ADF0`) by night, always underlined, at 7 : 1 like the text. Plain's accent is its text color, so blue means only a link. Original's links stay in the text color. |
| Bright accents in the Braun themes (decision 0136) | All accent pairs at AAA (7 : 1) | The owner chose bright signal colors for the unread dot; at 7 : 1 they turn dull and dark | Only Fountain pen and Signal (decision 0145). Their accent is drawn only as the unread dot and a search's faint tone, never as text, and stays at 3 : 1 or more on every area and on the selection pill, by day and by night, checked automatically (the owner's choice, 1 November 2026). |

### Never

- Notifications of any kind. The one exception is the weekly email: chosen by the reader in Settings, plain text, off in one press (principle 1, decision 0140)
- Badges, streaks, reading stats or any gamification (no reading-time estimates, no "year in reading")
- Algorithmic ranking ("for you"), or filling a list with anything you didn't subscribe to, so it never ends. (Older items loading as you reach the bottom of a list is allowed, decision 0074: the list still ends.)
- In-app likes, comments or social features
- Branded share buttons for specific platforms
- Full-article scraping from publishers' websites
- Rearranging what people have learned, once the look settles (see principle 3)
- Decoration that pretends: glass, blur, gradients, fake depth, motion for delight; shadows except under things that float, as Apple draws them (see Visual language → Rules). The article's bars are solid, never see-through (decision 0040). Honest, handmade touches, such as a still drawing or a signature, are welcome at the edges, never in the reading pane (decision 0132)

---

## Part 2: Design decisions

The philosophy applied. The principle is noted where it isn't obvious. The brand's decisions in one page are in [`BRAND.md`](BRAND.md); this part holds the measurements behind them. Where BRAND.md marks a decision "being built", this part still describes the live app until that work lands, and the work then brings this part in line.

### Name and signature

- **Name:** nine turtles, at nineturtles.app (decision 0066; app store and trademark checks are under "Still to define").
- **Wordmark:** "nine turtles" in lowercase, in the reading serif.
- **Logo** (decision 0067): nine small turtles seen from the side, a domed shell and a round head each, in three rows of three, the middle row a little to the right so the rows never read as a menu's stripes. One ink, no color: the text color on the page (dark on white, light on near-black). It is the app icon and, as a single turtle, the browser-tab icon (the app's and the website's), and it stands before the wordmark wherever the wordmark is shown, in the wordmark's own ink. It is the redrawn nine (D2), heavier so the turtles stay turtles at small sizes; its sizes beside the name in the sidebar, the app icon and the tab icon are on the brand sheet ([`BRAND.md`](BRAND.md) → "The logo"). Beside the name it stands on the name's baseline, with the name in semibold so it holds its own beside the solid turtles (decision 0078): on a phone's feeds screen 34px beside the 28px name, in the website's band 27px beside the 22px name (the app sidebar's sizes), and above the name on the sign-in pages 56px tall. Its frame ends at the turtles' edges and cuts none of them. Screen readers skip it, since the name says it in words. Its drawings are in `docs/logo/`.
- **The website's footer:** compact, on the page's left edge: two short rows of links (the reader's places, about us and FAQ; then, smaller, the small print), and nothing more (decisions 0102, 0153).
- **The About page's end:** the logo's turtle walks in single file, nine times: seven together and, a few steps behind, two more, in the second ink, over one line in the reading face: "Some of us like to read slowly. That's the idea." Two stay behind together, not one, so nobody is left alone. Drawn still, as everything is; screen readers skip the drawing and read the line. It lived in every page's footer until the owner moved it here (decision 0102).
- **"Wrong turn?", the 404 page** (decisions 0102 and 0142), the same in the app and on the website: on one left edge, as the home page is, in a column 616px wide (the turtles' row), its top 192px down (96px on a phone). A small "404 error" (sentence case, small size, medium weight, muted), then, 16px under it, nine of the logo's turtles in a row in the text color, big enough to see at once (up to 56px each, still one line on a small phone): one at the back facing the other way, a step apart, and eight walking on. Then, 48px down, "Wrong turn?" as the page's title in the serif at its page's title size (display in the app, the website's page title there), 20px under it two short lines in the reading face (large size, with the article text's 1.6 leading, the second ink, 16px apart; "There's nothing at this address…" and "If a link in this app / on this site brought you here, tell me which one and I'll fix it."), and 24px under them "— Rohit" in the text color. The parts group by their gaps rather than sitting evenly apart. The app adds its main action, "Back to your reading", 40px under the signature. Drawn still; screen readers skip the turtles; the drawing itself never changes. Where else the turtles may appear: [`BRAND.md`](BRAND.md) → "The turtles' only job".
- **The website's band** (decision 0153, "G set as C"): on a computer (wider than 1100px) the app's grey sidebar, 248px wide, fixed on the left, in the sidebar's grey (`#EFEFF1` by day, `#232323` by night): the logo and name, then the website's places in quiet text (How it works, which opens the tour; Blog; Open the app), and on the front page, under a hairline, what's on the page. The text column starts 128px right of the band, on one left edge with the footer. On a tablet or phone the band is a grey bar across the top, the name on the left and the places beside or under it; "On this page" is left out there. Where you are is the place's name in the full ink, semibold and underlined, not the app's grey pill: on the website the pill read as a row of buttons. Pricing, About, Contact, FAQ, "New to feeds?", the feed finder and the starter packs (decision 0100) live in the footer; the tour links "New to feeds?".
- **The website's front page** (decision 0153): one text size, 20px on a 32px line, in a column 488px wide. "Read people. Write back." as the page's title in the interface face, semibold, at the same 20px, 192px from the top on a computer (128px on a tablet, 64px on a phone), the settled paragraph under it, then "Open the app", the one solid button in the text color. The app's picture 128px down, up to 800px wide from the column's edge. Then the six points from the positioning, each a semibold line in the interface face and one line in the reading face, 64px apart; "Open the app" again; the footer. Copy word for word from `RnD/positioning.md`; the last point's line is the Contact page's own ("Write to … Every message is read by a person, not a bot.").
- **Signature:** what makes nine turtles recognisable is on the brand sheet, [`BRAND.md`](BRAND.md). (The accent never marks where you are: that is the plain grey pill, decision 0057.)

### Visual language

#### Rules
- **Regions are separated by tone and space.** Lines and shadows appear only where Apple Books draws them, never as decoration:
  - **Lines between panes** (decision 0054): on a computer only, where two panes meet (the sidebar's right edge, and the list's when the reading pane is beside it): 1px, the text color at 9%, the same tone as the list's row hairlines. Tone alone barely parts the panes by night.
  - **Hairlines inside a page:** between rows that do different jobs (rows in a grouped list, the parts of the text-size capsule; decision 0055), faint, in a tone of the text color, inset from the left in a grouped list. The article list has none: space alone parts its rows (decision 0123). A field's own edge is a border, not a line between regions.
  - **A line down an open folder's feeds** (decision 0123): in the sidebar, 1px in a 14% tone of the text color, under the folder's name, so its feeds read as its contents, as a Mac source list shows nesting.
  - **A hairline under a scrolled top line** (decision 0028): only once a pane's content has scrolled under it, and above the shortcut list's foot while more lies below, so text never looks cut off.
  - **A hairline above Edit's bar** (decision 0080): on Your feeds, while Edit is on, the bar of actions at the page's foot is solid in the page's color, with the same 9% line above it, so a row scrolling under it reads as scrolling, never as cut off.
  - **A hairline above the phone's article toolbar** (decision 0040): the bar is solid in the page's color, and the line stops a line of text looking sliced where it meets the bar. Both article bars are solid, never see-through.
  - **A soft shadow under things that float:** the note at the bottom of the list, a sheet, the search options popover and the search suggestions, the Aa panel, the More menus, the shortcut list and "Skip to articles" while the keyboard is on it, one soft shadow and a faint edge each (decisions 0028, 0048). Nothing that sits in the page casts a shadow, except the 1 to 2px lift under a segmented control's chosen segment (decision 0042), never animated.
  - **A dim behind a sheet** (decisions 0031, 0039): only behind a sheet, the shortcut list or an opened picture, black at 18% by day and 45% by night, never animated; it closes with Escape or a press on it. On a phone it shows as the 10px strip above a page sheet (decision 0055).
- **Type does the hierarchy:** size and weight, never color alone or badges (the unread dot is the one mark, in the Exceptions log).
- **One accent, one family of meanings:** a theme has one accent (ink blue in Original; the text color in Plain, decision 0063; a Braun signal color in Fountain pen and Signal, decisions 0136, 0145) and no second color: a starred article's star is drawn in the theme's ink, filled when starred and an outline when not, so the shape says it (decision 0142). The accent marks what's *yours to look at*: what's unread (the dot) and what a search found (a faint tone behind the words) (decision 0037). Where you are is a plain grey pill with no color, its sidebar icon in ink (decision 0057). Nothing else uses it: never a button, a link, a focus outline or decoration.
- **Icons where the convention is an icon** (close, clearing the search field, back, search, settings, the sidebar toggle, the list's More (…), and the article's open original, Aa, star and More (…); in the sidebar's icon column, each fixed list's sign, a saved search's magnifier and a collection's small shelf of books, decision 0108; Up Next's small list and an episode row's headphones, and the podcast player's back 15, Play / Pause and forward 30, decision 0113; a video row's small screen with a play mark, decision 0149; and, at the left of each row on Settings' first page, a drawing for that setting, decision 0120; how icons are drawn is in BRAND.md → Icons), each named in its tooltip with its key and to screen readers, so the tools around the text stay quiet (decisions 0034, 0038). **Words** for Add feed, menu items, the phone's back button (with its arrow) and the main action of a form.
- **Fewer, steadier toolbars** (decision 0038): **one More (…) per place**, as Apple Books has one per collection, holding the less frequent actions as words (the list's Edit, Refresh, Mark all as read and sort order, and a collection's Rename… and Delete; the article's Copy link or Share, Mark unread and Add to collection…, each with its key). **A bar's controls keep to its pane's edges,** their icons about 20px in (lined up with the sidebar button), one group at each end, so they never float in the middle of a wide window.
- **The YouTube box** (decisions 0072 and 0149, `docs/SPEC.md` section 38): a still panel in a faint tone of the text, 8px corners, 16 : 9 (a Short's 9 : 16, at most 20rem wide), with the video's title in the reading serif at the large size, semibold and centred, over a round Play mark in the text color and "Play video" or "Resume from 4:00". With large text it grows taller rather than cut its words. Its chapters sit under it as plain 44px rows, the time underlined in tabular figures, then the name.
- **The podcast player** (decision 0113, `docs/SPEC.md` section 35) is a still panel under the byline in a faint tone of the text, 12px corners, as the YouTube box is: one round Play / Pause in the text color (never the accent), back 15 and forward 30 as quiet line icons with their figures large enough to read (about 11px, semibold, inside the arrow), the length (until it starts playing, then the times say it) and the speed in small words, and a plain slider (its mark in the text color) with the times under it in tabular figures. No waveform, artwork, progress ring or animation. While one plays, a slim **Now playing** bar sits at the foot of the app on the list's own background with a faint top line, taking its own room (it never floats over text): back 15, Play / Pause, the title over the podcast's name, and Close. On a phone it sits just above the article's toolbar, and steps aside while the same episode's own player is on screen, so the episode never shows twice (decision 0118).
- **A person's page** (decision 0146, `docs/SPEC.md` section 36) stands in the reading pane beside a person's list, where the quiet line stands elsewhere: on the reading area's own margin, a little above its middle, as an article's title sits. Their name in the serif, a step under the list's title, then a short list of facts in the interface face (each place's kind in the second ink and its website as a plain underlined link in the text color; "Following since March 2026"; their email address as a plain underlined link once nine turtles knows it, decision 0147), then quiet buttons: Add another place and Edit person…. "Is this the same person?" and Add another place open in place as a box with a faint 1px edge and 12px corners, never a sheet, with their actions as ordinary buttons. No picture, avatar, counts or color.
- **Write back** (decision 0147, `docs/SPEC.md` section 37) ends every article of someone the reader follows: 32px under the closing rule (or the summary's note), one centred bordered button in the interface face, "Write back to Alpha", and under it the address it writes to in the small muted size. With no address known it opens in place as the same box as Add another place (a faint 1px edge, 12px corners), across the text column: its title, one line saying where the address is kept and that the reader's own email app sends it, the field, then Write back (the main action) and Not now. No icon and no color.
- **Edit, for choosing several things** (decision 0080), as in Apple Books' Edit: a quiet button at the right of a list's heading, its word becoming **Done** while it's on; each row then ends in a tick box (the rounded square of Edit person's folders), **Choose all** / **Choose none** sits beside Done, and a bar at the page's foot says how many are chosen and holds the actions, a destructive one in its oxblood words. Only Your feeds has it so far.
- **Settings opens in place of the list,** with one top line that never scrolls: the title in the serif, like the list's, and an X that closes it (Escape does too). Below it, one centred column no wider than 560px of grouped lists, as in Apple Books' settings (`docs/SPEC.md` section 18).
- **A short Settings** (decision 0120): its first page holds only the everyday settings (Reading, and Look and feel's Appearance and Text size); every other group is a row ending in › that opens a page of its own in its place, at its own address, as Apple Books and iOS settings go one level down. Such a page has **‹ Settings** on a line above its serif title, in the second ink, and no X; it and Escape go back, and the keyboard returns to the row that opened it. Nothing slides: the page is simply there.
- **Settings' rows** (S1, decision 0120): group names in small uppercase muted letters (0.72rem, letter-spacing 0.07em); each row's name about 0.98rem at weight 500 in the text color, its description straight under it at 0.8rem in the muted grey (line height 1.35), so name and description read as one; 12px above and below a row on a computer and 14px on a phone. On a computer the control sits at the row's right end; on a phone, under the words at the row's full width. On the first page each row starts with an icon in the muted grey (never the accent, never on a tile), 18px, its centre on the centre of the name's first line whether or not a description follows. Edit person's settings rows are built the same way, without icons.
- **Short tasks open as a sheet** over the place you were (Add a feed, "Follow this person?", Edit person, Edit folder): a small card that opens a little above the middle of the window, where the eye rests, its height following what's in it, the panes still in view behind it under a light dim (decision 0039). Once open, its top stays put: a message appearing in it grows it downwards, so nothing you're looking at moves. Every sheet is built the same way, like a Mac sheet in Apple Books:
  - its title in the same serif, size and weight as every other title (24px semibold, as the list's and Settings'), so the app speaks in one voice (decision 0042). It takes the keyboard's place as the sheet opens, so screen readers start there, but draws no ring: a heading can't be pressed, and the first Tab lands on a control, which rings as always;
  - the form: each field's name above it in small second-ink words, the field at the card's full width; choices among several (a feed's folders) as a grouped list of 44px rows, each ending in a tick box as a Mac draws one: a rounded square, empty when it's off, filled with a check when it's on, so even a list of one folder reads plainly. Square, never round, because a round mark says "pick one" (decision 0045). Making a new one ("New folder…") is the list's last row, a text box of its own. A choice of one (the feeds a site offers) is the same list with a round mark at each row's end, as a Mac draws a radio button: empty, or filled in the text color with a dot of the page, the first one chosen; the main action then acts on the chosen one (decision 0049);
  - a message, only once there is one, on its own line above the actions (a problem in oxblood words after an alert icon);
  - **one row of actions at the foot, 20px under what's above it and 12px between its buttons, in a Mac sheet's order: a destructive action (Unsubscribe, Delete), if there is one, at the far left as words in oxblood with no edge; then Cancel (Not now in "Follow this person?", where the main action is Follow; decision 0138), with no edge, only a faint tone, so the main action is the one thing with weight; then the main action at the right end.** The words say what the oxblood one does, so oxblood is never the only sign; what it removes is in its tooltip and said to screen readers, and Undo follows straight afterwards. On a narrow screen the destructive action takes a row of its own above the other two. The main action (here, on sign-in and in the welcome) keeps one steady fill: a pointer over it takes it a step nearer the text color, never paler, so it never looks switched off, and while it's busy it keeps its look (decision 0045).

  Cancel, Escape or a press on the dim closes it; there's no X. 12px corners, 24px padding all round. A field's helper line is 13px in the muted grey, 6px under the field and on its left edge; the line asking you to choose among several feeds is set as a field's name, 20px under the field (decision 0052).
- **One phone sheet** (decisions 0052, 0055): on a phone, Add a feed, Edit person, Edit folder, Settings and the shortcut list are all screens of their own with one build: the serif title on the screen's 20px margin with an X (44px) at the right of the top line, and no back arrow or Cancel. Add a feed, Edit person and Edit folder are drawn as an iOS page sheet: a 10px strip of the dimmed screen above it, 12px top corners, a grouped ground (the list's grey by day, the page by night) with each group a card on it (the page's color by day, the group tone by night), and the title a step smaller (20px) so the field sits higher; it appears at once, never sliding; the form 20px under the top line as in Settings; the main action, if there is one, the full width at the screen's foot (50px tall, 12px corners, 16px above the home bar), staying in view while the form scrolls; a destructive action (Unsubscribe, Delete) as the one oxblood row of a group of its own, at least 32px above it, with the same tooltip, words for screen readers and Undo straight afterwards. (Two exceptions, the owner's choice: Delete data and Delete account have no Undo, only their one "Are you sure?" sheet; decisions 0088 and 0117, SPEC section 18.)
- **One close rule** (decisions 0049, 0052): on a computer, a sheet you commit (it has Save, Add feed or Follow) closes with Cancel (or Not now) only, and a sheet you only look at (Settings, the shortcut list, an opened picture) with an X only. On a phone every one closes with its X only, except the two short collection sheets, Add to collection and Rename (decision 0108): they have no address and aren't screens of their own, so on a phone they stay the same small card over the article or list, with Cancel and Save, as the Aa panel stays a panel. Never both. Escape closes any of them.
- **An opened picture** (decision 0107): a picture the article shows clearly smaller than it really is opens, with a press, alone on a plain card of the raised surface over the dim, as large as fits with a margin all round (never larger than it really is), its alt text under it as a caption in the second ink, a quiet underlined "Open in new tab" under that, and an X (44px, "Close (Esc)") at the card's top right. On a phone it stays a card over the dim rather than a screen of its own, so the picture is the only thing on screen; pinch-zoom works as on any page. It appears and goes at once; by night it shows at full brightness.
- **One family for things that float:** a sheet, the search options popover, the search suggestions (a small panel floating over the list as you type a filter, so the results never move; the chosen one marked by a bar in the text color and a faint tone, decision 0118) and the shortcut list share the same 12px corners, faint edge and one soft shadow. They, the menus, the Aa panel and the note at the list's foot sit on one raised surface: by day the page itself; by night a small lift above the page (#28282a) with a 1px edge of 8% white, as Apple Books lifts its sheets and menus, and grouped rows inside it 4% lighter again (decision 0052). Key caps in the shortcut list have a visible edge, a 1px rim and a 2px lower lip, as a printed key; the note about Tab, Enter and Escape is a footer across all its columns. A popover of choices is drawn as a **menu**, not a form: small section names, then rows with a checkmark at the start of each one that holds (the search options, the list's More menu). The shortcut list is never taller than 720px and keeps at least 48px clear of the window's top and foot; on a window at least 1024px wide it is up to 1152px wide (32px clear of the window's sides), with three columns that are stacks of their own (Reading; Getting around and Anywhere; Tidying up and the search filters), so it fits an 800px-tall window without scrolling; two columns fit no longer once decision 0110 added keys. On a medium window it has two columns and may scroll. On a phone it's a screen of its own, as every sheet is there (decision 0049). When it does scroll, a hairline under its title shows only once the list has moved, and one above a 16px band at its foot only while more lies below, so a row cut there reads as scrolling, never as clipping. It opens with the keyboard on its title (no ring, as in a sheet) rather than ringing its X. It only lists until **Change keys…**, a quiet underlined link at the right of its foot line, turns the same sheet into its editing mode (decision 0110): the title becomes "Change keys", each key that can change becomes a 44px button around its cap, with no edge of its own and a faint tone under the pointer; one waiting for a key says "Press the new key…" in words on the faint tone; a question or a refusal sits in place under its row, in the second ink, with Cancel and Use it as small buttons; a changed key has a quiet underlined Reset after it; and a sheet's row of actions, always in view at the foot, holds Reset all keys at the left and Done (the main action) at the right. Nothing moves or animates.
- **Fields:** a 1px edge in a soft mix of the text color (still 3 : 1 against what's around it, checked automatically), over a faint fill, 8px corners. In use, the edge steps aside for one 2px ring in the softened text color (65%, as on rows), 1px clear of the field, so it is never the heaviest line on the screen; it keeps at least 3 : 1 against the field and every surface a field sits on in every theme by day and night, checked automatically (decision 0055). A refused field's edge turns oxblood, beside the message's alert icon and words in the same oxblood: never a thicker ring, never color alone. While the keyboard is in a refused field, the outline takes the oxblood edge's place too, so there is only ever one line (decision 0042). Room for a message is kept only where the page is centred on screen (sign-in, sign-up, the welcome): below the main action (on the sign-in pages, at the column's foot, decision 0122), so a message arriving under the field moves only what's under it (decisions 0045, 0048); in a sheet the sheet grows by its line.
- **The sign-in pages** (decision 0122; sign-in, sign-up, Forgot? and the page its link opens), the usual pattern Apple's own sign-in sheets use: one centred column (at most 320px; the phone's 20px margins) under the logo and wordmark. Each field's name is real text above it, as in a sheet (small second-ink words on the field's left edge, 6px over it), never a placeholder alone; a field's helper line sits under it as a sheet's does. Sign-up's one optional question (decision 0155) is a list to choose from built as a field, with the same edge, corners and ring. The password's name sits 24px under the email field, with a small **Forgot?** (the meta size, underlined, in the text color) at the right end of its line: small to the eye, 44px tall and wide to touch, its box reaching up into that room, never over a field. One main action (Sign in, Sign up, Email me a link, Set password) at the column's full width; a second way in (Sign in with a passkey, Back to sign in after Check your email) is an edged button under it, never filled; the way to the other page ("New here? Sign up", "Have an account? Sign in") is a line of words with its link, centred, at the foot. The room for a message is kept at the column's foot, so a message arriving moves only what's under it.
- **A switch** (decision 0077), as Apple draws one, only where something is on or paused (a rule in Settings › Rules): a capsule track and a round knob, never animated. On, the track is filled in the text color with the knob at the right; off, an empty track with a muted edge and the knob at the left, so the knob's side says which as well as the fill, and the words beside it ("Paused.") say it too. Never the accent or green. 44px to press.
- **Section names are small spaced capitals** (decision 0123): Settings' group names and the sidebar's section names (Folders, Feeds; 11px, semibold, tracked 0.1em, a touch smaller than Settings'), so a heading never reads as one more row. A folder in the sidebar is a plain row starting where the fixed lists' icons start, with no icon of its own; its show-or-hide arrow waits at the row's right end, and its open feeds have a faint 1px line down their left, in a 14% tone of the text color.
- **The Aa panel** (decision 0123) is one quiet line per setting: its name in small spaced capitals in a fixed column at the left, its choices after it. Text size is the stepper; Appearance three 24px swatches (white, black, half of each) with a faint edge, the chosen one ringed in the text color; theme, font and line width plain words in the second ink, the chosen one semibold in full ink and underlined (2px), so it never shows by color alone.
- **A rule is written as one sentence** (decision 0123): in the reading serif, its blanks real text boxes and menus with no box of their own, only a dashed line under each in a soft tone of the text, as wide as their words and 44px to press; the keyboard's outline marks the one in use, and a refused blank's line turns oxblood beside the message's words.
- **Small menus and panels float under their button:** the list's and the article's More menus and the Aa panel, in the same family, a rounded card with one soft shadow, closed by Escape (back to the button), a press outside, or the keyboard leaving them. On a phone the Aa panel is a sheet along the bottom of the screen with a Close button, and the article's More menu opens upwards from the bottom bar.
- **One search field:** the sidebar's find field and the list's search are one slim capsule, as Apple Books draws its search: 36px tall with a mouse on a wide window, 44px on touch or a phone, 10px corners, a faint fill of the text color (6%) and no edge, a 14px search icon in the icon column and the interface's text size; the keyboard's outline marks the one in use. A chip inside it is 24px tall with 6px corners; its Remove button is still a full 44px to press. Its options menu floats on the raised surface (decision 0051, replacing 0041's unfilled find field).
- **No motion.** Views switch instantly, and feedback is instant and visible without moving (principle 8).
- **One system** (principle 6, decisions 0133 and 0134, after Vignelli): one spacing scale, a short type scale, and the same thing always looks the same and is named the same everywhere. A new size, spacing, color or name is added to the system here first, never as a one-off.

#### Color

Four themes, each with a day and a night version: Original (decision 0056, which removed decision 0046's five others), Plain (decision 0063) and two Braun themes, Fountain pen and Signal (decisions 0136 and 0145, under Themes below). Original's values were matched by eye to Apple Books' Original, then held to nine turtles' own floors by the automatic checks; its values are below. Plain is the owner's own site's bare, plain-HTML look: black on white (`#000000` on `#FFFFFF`), areas a few shades off white, its accent the text color, and links in articles the browser's blue `#0000EE` (visited `#551A8B`); by night white on `#121212`, links `#9E9EFF` (visited `#D0ADF0`).

| Role (day) | Original |
|---|---|
| Background (reading area) | `#FFFFFF` |
| Accent (unread and search matches) | `#2C4F8C` |
| Accent contrast on background (approx.) | 8.1 : 1 |
| List area (one step off) | `#F7F7F7` |
| Sidebar (two steps off) | `#EFEFF1` |
| Text | `#141414` |
| Second ink: read titles, quieter actions | `#3C3C40` |
| Muted grey: meta, counts, hints | `#5F5F64` |

| Role (night) | Original |
|---|---|
| Background (reading area) | `#121212` |
| Accent (unread and search matches) | `#94B2E6` |
| Accent contrast on background (approx.) | 8.7 : 1 |
| List area (one step off) | `#1A1A1A` |
| Sidebar (two steps off) | `#232323` |
| Text | `#E8E8E8` |
| Second ink: read titles, quieter actions | `#C4C4C6` |
| Muted grey: meta, counts, hints | `#A4A4A8` |

- All accent pairs pass AAA (7 : 1) in Original and Plain; re-check if a value changes. The Braun themes' (Fountain pen's and Signal's) bright accents are marks held to 3 : 1 (Exceptions log, decision 0136).
- **Links in articles** are underlined in the text color, **never blue**, except in Plain, whose links are the browser's own blue and purple, underlined, at 7 : 1 (decision 0063).
- **Muted greys** (read items, counts, source names) pass AA (4.5 : 1) on every area and on the selection pill, by day and by night, verified by automatic checks.
- **A segmented control's chosen side** (decision 0118; Inbox / River, Light / Dark and the rest, in Settings, Edit person and the Aa panel) stands at 3 : 1 or more against the rest of the control, WCAG's non-text contrast, by day and by night in every theme, checked automatically. By day it is the page's own tone with a thin 1px edge of the text color at 60% and its small lift; by night it is filled with the text color at 65%, its semibold words in the page's color. Never the accent.
- **The selection pill** (decision 0057): a neutral grey, the text color mixed into the pane behind it (8% by day, 12% by night), with no color. Text stays at 7 : 1, muted grey at 4.5 : 1 and the unread dot at 3 : 1 on it, and a dark pill, or a day pill on a warm pane, keeps its pane's temperature (all checked automatically). A row under the pointer gets a fainter, neutral tone of the text color (5%), never the accent, always lighter than the pill.
- **Search matches** have the accent at 12% behind them , with 3px corners and a fine underline (so never tone alone), in the text's own weight; text keeps 7 : 1 on it, even inside the pill.
- **The keyboard focus outline** is a 2px line in the text color, never the accent. On rows it is the text color softened (65%, still at least 3 : 1 on every area and on the pill, checked automatically; fields use the same tone, see "Fields"), drawn 2px inside their rounded edge so it never reaches over the hairlines or the pane's edge; the pill's fill always stays. A title the keyboard is moved to (a screen opening, a sheet, an opened article, a key such as `g` then `a`) takes the place without a ring, because it can't be pressed and a ring would make it look like a button; the first Tab lands on a control that rings (decisions 0042, 0118). When the app opens, the keyboard starts on the list's title, not the sidebar's wordmark (on a phone's feeds screen, the wordmark). **Skip to articles** is the first Tab stop: hidden until the keyboard reaches it, then a small label on the raised surface at the window's top left, semibold in the text color, with the usual ring (decision 0118). It shows only when you're using the keyboard: never on a row after a tap or a click, even when the keyboard's place moves back to it (decision 0051).
- **Status colors** (errors, warnings) are muted, never drift toward blue, and always come with words. The feed health page needs none: its groups' names ("Not working", "Having trouble") say how bad things are (decision 0071).
- **Destructive actions** (Unsubscribe, Delete folder) are words in oxblood, `#8C2F39` by day and `#E39AA4` by night (decision 0143), as are error messages: at least AA (4.5 : 1) on the page, the list and a grouped list by day and by night, checked automatically. Oxblood means only "this removes something" or "this went wrong" (BRAND.md: delete and errors), and the words always say what.

#### Themes
Four themes. **Original**: white paper by day, near-black by night (decision 0056). **Plain**: the owner's site rohit.onl's bare, plain-HTML look, black on white with blue underlined links (decision 0063). The five others from decision 0046 (Quiet, Paper, Bold, Calm, Focus) were removed at the owner's request: nine turtles has its own look rather than copying Apple Books' set. Two more follow Dieter Rams' Braun products (decision 0136): a neutral body whose one color is the unread dot, like the single colored control on a Braun radio. **Fountain pen**: blue-black ink on warm white, the warm one. **Signal**: pure white and graphite. Brushed, Anodised and Heather were retired as too alike (decision 0145); a reader who had one sees Original (from Brushed) or Fountain pen (from Anodised or Heather). No theme's dot is green or red: red (oxblood) means only "this removes something" or "this went wrong", and red and green are the colors most often confused. Their colors are in `web/src/themes.css`. An **Appearance** choice picks the version: **Light**, **Dark** or **Match device** (the default), which follows the device's own light or dark setting, live, as it switches. Before nine turtles' script runs, a page is Original, by day or by night as the device is set. Every version of every theme meets the same contrast floors, checked automatically.

#### Typography

| Use | Typeface | Why |
|---|---|---|
| Reading (default) | **Literata** | Made for long-form reading on screens |
| Reading (alternate sans) | **Atkinson Hyperlegible Next**, the interface's own face | Made for legibility, including low vision |
| Reading (alternate serif) | **System serif**: the device's own (New York on Apple devices, Georgia on most others) | The owner's site rohit.onl's font (decision 0063); nothing to download |
| Interface | **Atkinson Hyperlegible Next** (400, 500, 600), on every device | Made for legibility; one face everywhere, so nine turtles looks like itself on every device (decision 0141, replacing the device's own font and Inter) |
| Code in articles | **Atkinson Hyperlegible Mono** | The interface's monospaced sibling, so code sits with the rest (decision 0141) |

- All fonts are free and served by nine turtles itself (no third-party font services); System serif is already on the device.
- **Other scripts** (e.g. Hindi in Devanagari) use the fonts already on the device; no extra downloads.
- **A fixed type scale by role**, so each level of importance looks different at a glance (size, weight and ink together, never color):
  - meta 13px (times, source names, counts, hints) in muted grey; 15px on a touch screen;
  - small 14px (toolbar actions, helper text, labels);
  - interface 15px (sidebar names); 17px on a touch screen, as a phone's own apps use. The article list's titles are this size in the reading serif on a touch screen and 19px with a mouse, with room around each row, like a book's contents page (decision 0128);
  - base 16px (text boxes, running interface text);
  - large 20px (section headings inside a screen);
  - heading 24px, in the reading serif (the list's title, one line that ends in "…", 22px in a list pane narrower than 340px); the sidebar's wordmark is 22px in the second ink on a computer (the logo's lockup, Exceptions log) and 28px on a phone's feeds screen;
  - extra large 28px (a screen's own title);
  - display 48px (sign-in wordmark).
- Article text is set by the reader: six steps, 16 to 28px, 20px by default (a tenth smaller on a phone). The article's title is 1.6 times the text size (32px by default), with tight leading (1.12) and its letters tracked in only a little, so they never touch (decision 0047), its lines balanced so a two-line title reads as two even lines, as Apple Books sets one (decision 0044, replacing 0040's lone-word rule); its headings are 1.1 and 1.05 times (22px by default) with more room above than below, so the title is always clearly the largest thing on screen and a heading never competes with it (decision 0038).
- **The byline is quiet:** 14px in the interface font (decision 0050) and the second ink, a clear pause under the title (five-eighths of the title's size, about 20px by default, decision 0047), with the publisher's name leading in full ink and semibold (the medium weight is kept for Settings' row names).
- **In an article read offline** (decision 0101), each image is a short line in the interface font, small and in the second ink, as the end note is, so it never reads as the author's words; the list's "Offline. Showing the articles saved on this device." sits above the list in the muted meta size, as a search's count does. A failing feed's "This feed hasn't worked since …" sits in the same place, in the second ink and the small size, its button a text button in the same ink: information, never an alarm, so no accent and no red (decision 0106).
- **The feed health page's cards** (decision 0118): each feed a card in the grouped lists' grey, 12px corners, 16px by 18px inside, 12px apart. Its name (about 16px, semibold), one sentence on what happened (its lead in semibold, line height 1.5), then a two-column list in 13.5px, muted labels (Address, in the monospaced face at 12.8px, and Last worked), then, under a hairline, Find new address as the main filled button, Retry filled in the segmented controls' track grey so it stands off the card, and Unsubscribe in oxblood words at the right end. On a narrow card the two buttons share their row and Unsubscribe has its own line. Every target 44px.
- **Recently read's day headings** (decision 0118): only in that list, "Today", "Yesterday", the weekday, then the date, set as the sidebar's section names are (meta size, semibold, muted grey) on the titles' edge, with 20px above to part one day from the next. Never a count.
- **Spacing** in steps of 4px, mostly 8, 16, 24, 40 and 64px.
- **Weights:** regular and semibold (600) for both reading and the interface, and medium (500) only for the names of Settings' and Edit person's rows (decision 0120): semibold for titles, headings and bold words in articles, in either reading font. Nothing heavier, so a calm page never shouts. Semibold marks unread titles, where you are in the sidebar, the one main action in a toolbar or sheet, and a destructive action's words. Unread titles are 600 (decision 0037).
- **Three inks:** text (titles, where you are), a second ink (read titles, quieter actions); feed names in the sidebar are in full text color and muted grey (meta).
- Article lines of roughly 65–75 characters, with generous leading.

#### Languages
- **Interface:** English only in V1.
- **Articles:** any language, each marked with its language (from the feed) for screen readers and typography.
- **Search:** English, other Latin-script languages and Hindi from day one; Chinese and Japanese not in V1.

### Screens

Each screen (layout, sidebar, list, article, search, Settings, phones, keyboard, sign-in) is described once, in full, in `docs/SPEC.md`, which follows the rules above. Wherever SPEC.md and this document disagree, this document is right and SPEC.md has a bug.

### Voice

nine turtles speaks like **a friend who writes well: plain, warm, a little dry, never selling.** Unhurried and never urgent ("Nothing new yet," never "You're missing out!"). It treats the reader as an adult: helpful and careful, never talking down. Labels say what things are and do, and text with a job (a password hint, an error) stays plainly functional. No exclamation marks, no hype. **Warm, never cute** (decision 0134): warmth comes from true, specific facts, said plainly (names, dates, the writer's own words: "Mira Okafor hasn't posted since 12 August."), never from invented feelings or stories about people. Short, never verbose. "Calm" and "quiet" are true of nine turtles but aren't its brand: every reader says them (decision 0132).

- **Who speaks:** "I" when Rohit speaks (the website, emails, About, the 404 page, the pricing page). Never "we": nine turtles is one person with no investors. Where "I" would be awkward, no pronoun at all; the app itself speaks without one ("Nothing new yet.").
- **Every email and every line of copy is a chance to win the reader over,** so each gets real time and care.
- **Emails and empty screens** follow [`BRAND.md`](BRAND.md) ("Emails"; "Empty screens and the ends of lists"); the exact sizes of an empty list are in `spec/06-item-list.md`.

| Instead of | Say |
|---|---|
| "Welcome to nine turtles! Let's get started" | "Hello. Who would you like to read?" |
| "You're all caught up!" | "That's everything for now." |
| "Upgrade to Pro to unlock" | "This part is for paying readers. Here's why it costs money." |
| "We're sorry to see you go" | "Done. Your account is paused; nothing's deleted. Thanks for reading." |
| "Our team is working on it" | "I'm on it. — Rohit" |

### Honest by default: a public promise

Said plainly on the website, never preached: honesty is how nine turtles behaves, not its selling point (decision 0132).

- Leaving is as easy as joining: pause or cancel in one place, one press, no survey you must fill in.
- Yes and no look the same weight. No pre-ticked boxes, no "No thanks, I like paying more."
- No fake urgency: no countdowns, no "only today", no "3 people are viewing this".
- The price, the trial and what happens when it ends are on one screen, before you start; prices adjusted by country are said plainly.
- Export everything, notes too, in one press, any time, even after you stop paying.
- What's measured is listed in plain words, and it's only what tells us something broke.
- A public page of what changed, in Rohit's words, mistakes included.

### Easter eggs: found, never shown

A few small surprises, for the reader who looks (decision 0132): still (words or a still drawing, never animation or sound), never in the reading pane or between the reader and an article, never a pop-up and never a reward for using the app more, always readable by a screen reader and never the only way to do something, and rare. Text with a job stays functional; a joke never makes an instruction less clear. The 404 page already is one and stays as it is.

---

## Still to define

- App store and trademark checks for "nine turtles" (not blocking V1). The domain is nineturtles.app (decision 0066).

## V2 parking lot

Ideas not built yet. Once one is built, it leaves this list; what it does is
then in `docs/SPEC.md`, and the finished work in `docs/archive/plan-done.md`.

- **Chinese and Japanese search.**
