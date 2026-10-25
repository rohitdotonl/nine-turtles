# nine turtles V1: what it does

*Agreed with the owner; agents build from it (decision 0014). Based on `docs/DESIGN.md`, which takes
precedence: if this document and DESIGN.md disagree, DESIGN.md is right and
this document has a bug.*

Each feature has two parts:
- **What it does:** the behavior, in plain language.
- **How to check it:** steps you can follow yourself in the app.

The owner's answers to the planning questions (`docs/planning/questions.md`)
are included.

A few words used throughout:
- **Feed:** the file a website publishes listing its latest writing (RSS, Atom or JSON Feed).
- **Item / article:** one piece of writing from a feed.
- **Pane:** one of the side-by-side columns on screen (feeds, items, article).
- **Vim keys:** single-letter keyboard shortcuts such as `j` and `k`, named after a classic text editor.

---

## 1. Sign-in

**What it does**
- nine turtles has a public web address, so it asks for a password. There is one password and no username.
- Each device stays signed in for a long time, so you rarely type it.
- Each device stays signed in for a year after it was last used. Signing out ends that device only; other devices stay signed in.
- Repeated wrong passwords are slowed down, so nobody can guess by trying thousands: after five wrong tries in a row, nine turtles asks you to wait a minute, and each further wrong try doubles the wait, up to an hour. The right password resets it, and so does an hour without wrong tries. Wrong tries count for the whole app, wherever they come from, so a stranger guessing can make you wait on a new device (devices already signed in are unaffected). Restarting nine turtles on Render clears the wait (`docs/operations/render-setup.md`).
- The page shows the wordmark, one quiet line under it ("A quiet place to read."), the password field and **Sign in**, all in one centred column: the field says "Password" inside it (and to screen readers), and the button sits 12px under it with the same rounded corners. On a phone the column runs between the same 20px margins as every other screen; on a larger screen it is at most 320px wide (decision 0048).
- Messages are plain: "That isn't the password." or "Too many wrong tries. Try again in 2 minutes." They sit right under the field, centred, in red words after a small warning mark, and move only the button down (the room for them is kept below it, so the field and the title stay still); a wrong password also marks the field itself (its edge turns red, and screen readers hear it as invalid).
- Sign out is in Settings.
- The password itself is never stored, only a scrambled version that can't be turned back into it (a "hash"). You set it by typing `slowfeed set-password` in Render's Shell tab and pasting the scrambled line it prints into Render's settings (`docs/operations/render-setup.md`). Until then, nobody can sign in.

**How to check it**
1. Open the app's address in a private browser window. You see only a password field, nothing about your feeds.
2. Type a wrong password several times quickly. After a few tries it asks you to wait before trying again.
3. Type the right password. You're in. Close the browser, reopen the address: you're still signed in.
4. Sign out from Settings. Reload: you're back at the password field.

## 2. First visit (empty state)

**What it does**
- Until you add your first feed, the reading area shows a welcome, centred like a page: **"A quiet place to read."** in the reading serif, one sentence ("Follow the websites you like, and read what they publish here, at your own pace."), a wide field that says **"Paste a website or feed URL"** inside it (its label for screen readers) with **Add feed** beside it, and just under the field, centred like everything else in the welcome, a link, **"Import an OPML file…"**, the other way in: underlined, in the text color, a full 44px tall to touch, its words on the same margin as the heading's (on a phone, the screen's 20px margin; decision 0055) (a message about the address, when there is one, appears between the two and moves the link down, never anything above), which goes to the import described in section 16 (Settings → Your data), all in one centred column about 420px wide. The welcome has the screen to itself: where there's a reading area beside the list, the list steps aside and the welcome takes both, one empty state rather than an empty column beside it (decision 0048); the sidebar shows no find field while there's no feed to find. Where there's no reading area beside the list (a phone, or a medium window with the sidebar shown), the welcome sits in the list's place instead. Starred keeps its own (empty) list. When **Add feed** opens its sheet over the welcome, the welcome stays exactly as it was under the dim, so nothing behind the sheet moves.
- (V2 adds "New to feeds? Here's how they work", a short guide page for newcomers.)

**How to check it**
1. On a fresh installation, sign in. Beside the sidebar there's one welcome, centred, with the field, Add feed and "Import an OPML file…"; no empty list beside it, and the sidebar has no find field. Nothing tells you to press `j`. Press `a`: the sheet opens and the welcome behind it doesn't move.
2. On a phone, the welcome fills the list's screen, left-aligned on the screen's margin about 96px under the top line, and it's the one heading shown: the list's title steps aside (screen readers still hear it as the screen's name).

## 3. Adding a feed

**What it does**
- **Add feed** (a plus icon and its words) sits at the very bottom of the sidebar, always in the same place, with two buttons beside it: **Keys** (a keyboard icon and its word, so Add feed and Keys read as two buttons, not one phrase; decisions 0062, 0064; in a sidebar narrowed below 15rem, the icon alone) and **Settings** (a cog), each with its name as a tooltip. The `a` key does the same as Add feed.
- Add feed opens a sheet over the list you were on (`/add-feed`): a small card titled "Add a feed" (in the same serif as every title), a line saying nine turtles finds the feed on any website, the same field as the first visit at the card's full width, and at the foot one row, 20px under the field: **Cancel** (a faint tone, no edge), then **Add feed** at the right end. The sheet opens a little above the middle of the window and is as tall as what's in it; a message appears under the field only when there is one, and the sheet grows down by its line (its top never moves). In the first-visit welcome, which is centred on the page, the field keeps room for two lines of message so nothing moves. The list and article stay in view behind it under a light dim. Cancel, Escape, or a press on the dimmed page, closes it. Add feed is an action, not a place, so it never shows the "where you are" pill. On a phone it's an iOS page sheet, built as every phone sheet is (DESIGN.md → "One phone sheet"; decisions 0052, 0055): a 10px strip of the dimmed screen shows above it, its top corners are 12px, its ground is grouped grey (the list's tone by day, the page by night) with any group on it a card (the page's color by day, a step lighter by night), its title a step smaller (20px) in the top line, an X beside the title, no back arrow and no Cancel, and **Add feed** the full width at the screen's foot. It appears at once, with no slide. When a site offers several feeds, "This site offers more than one feed. Choose one:" is set as the list's label, 20px under the field.
- You can paste either a feed address or an ordinary website address; leaving off `https://` is fine. For a website, nine turtles looks at exactly the page you pasted to find its feed ("autodiscovery"), once, because you asked. If the page names several feeds, you see their names and addresses as a list, each row ending in a round mark that's filled with a dot on the chosen one (the first, to begin with); choose one with a click, a tap or the arrow keys, then press **Add feed** to add it. Change the address and Add feed looks again.
- While nine turtles looks, the field says "Looking for a feed…" in plain text. No spinner.
- If it doesn't work, a plain sentence says why, never an error code: "This site doesn't seem to offer a feed. Try the feed's own address, or the site's home page.", "That site didn't answer. Try again later.", "Nothing was found at that address.", "That doesn't look like a web address.", "nine turtles can't visit that address." (an address inside a private network or on nine turtles' own computer), or "That file is too big to be a feed." The message sits under the field in red words after a small warning mark; when the address itself is the problem, the field's edge turns red too (the words and mark mean color is never the only sign).
- Adding a feed you already follow says "You already follow this feed." with a link to it, instead of making a copy. The same address written differently (`http` or `https`, a trailing `/` or `#part`) counts as the same feed.
- The new feed appears in the sidebar and opens, its articles straight away, all unread (including older posts the feed still lists). It's fetched once on adding; new articles arriving on their own come with Milestone 8.
- Each feed has its own address (`/feeds/3`), so reloading keeps your place. An address for a feed you don't follow says so plainly ("Feed not found").

**How to check it**
1. Press `a` (or click Add feed), paste a blog's home page address (not its feed), press Enter. The blog appears in the sidebar with its articles.
2. Paste a direct feed address. Same result.
3. Paste an address of a page with no feed. You get a calm, plain message, not an error code.
4. Add the same feed twice. nine turtles tells you it's already there instead of creating a duplicate.

## 4. Layout

**What it does**
- Three panes on a wide screen: **feeds | items | article**. Two panes on a medium screen. One column on a phone (section 20).
- No layout options to choose: the layout simply adapts to the window width. Wide means 1200 pixels or more at normal size, medium 896 or more; below that, one area shows at a time, as on a phone. On a medium screen the list and article show, and showing the sidebar puts it in the article's place. On a phone-narrow screen one area shows at a time, starting with the sidebar; choosing a place in it shows that place, and Escape goes back.
- Zooming in or a larger system text size counts as a narrower window, so the layout steps down instead of anything overlapping.
- On a computer the sidebar and the article list can each be hidden and shown, with a small sidebar-shaped button or a key: `[` for the sidebar, `]` for the list, `\` for both at once. Each button sits at the right end of its own pane's top line (the sidebar's across from the wordmark, the list's after More); with its pane hidden it waits at the start of the next area's top line. With both hidden the two become one button, which brings both back. Screen readers hear "Sidebar" and "Article list"; the tooltips say what pressing does, with the key.
- On a computer the sidebar and the list can be made wider or narrower by dragging the line where they meet the next pane (or, with the keyboard on that line, the left and right arrows); a double click puts the pane back to its usual width. The sidebar stays 200–400px wide and the list never leaves the article less than 400px. The widths are remembered on that device. Beside it, each area's top line (the wordmark, the list's title, the article's tools) never scrolls. All the top lines are one band of the same height (56px at normal text size), so the sidebar button, the wordmark, the list's title and More, and the article's tools sit on one line across the window, and the faint lines that appear under them once something scrolls fall at the same height. A button in a top line draws its keyboard ring just inside its own edge, so the ring never touches the top of the window.
- Unread, Starred, All and Settings each have their own web address (`/unread`, `/starred`, `/all`, `/settings`), so reloading keeps your place and the browser's Back button works. The front page opens Unread.
- Regions are told apart by background tone and space, never by lines, shadows or gradients. Small exceptions: a faint line under a top line once something has scrolled under it, a soft shadow under the note that floats at the bottom of the list, a faint line along the top of the phone's article toolbar, and, on a computer, a faint 1px line where two panes meet (the sidebar's right edge, and the list's when the article is beside it), in the same tone as the hairlines between list rows (DESIGN.md → Visual language; decision 0054). The article's bars are solid, never see-through.
- Hiding the sidebar with `[` while the keyboard is in it moves the keyboard to the list itself (the selected article, or the first), never to the list's title; with no articles, to the sidebar button.
- Nothing animates. Views switch instantly.

**How to check it**
1. Make the browser window wide, then narrower, then phone-narrow. You see three, then two, then one column.
2. Press `[` twice, then `]` twice, then `\` twice. The sidebar, then the list, then both hide and return; with both hidden one button shows.
4. Drag the line between the sidebar and the list, then double-click it. The sidebar widens, then returns to its usual width.
3. Squint at the screen: you can still tell the three regions apart, with a faint line where the sidebar meets the list and the list meets the article.

## 5. Sidebar

**What it does**
- Fixed order, top to bottom:
  1. **Unread · Starred · All**
  2. **Folders**, alphabetically
  3. **Feeds not in any folder**, alphabetically
  4. **Add feed**, then **Keys** (icon and word) and **Settings** as an icon, in one row
- You can't reorder things by hand; order is always alphabetical.
- At the top of the sidebar: the "nine turtles" wordmark (a name, not a button: Tab never stops on it, though the keyboard's place starts there when the app opens, so screen readers begin at the top), and below it a quiet **field to find a feed or folder by name** (a search icon and its words, the same slim, faintly filled field as the list's search: 36px tall with a mouse on a wide window, 44px on a touch screen or a phone, softly rounded, with no edge), shown whenever you have a feed. Folders and feeds sit under small muted section names ("Folders", then "Other feeds", or just "Feeds" without folders), and every feed name is in full ink; a name in Devanagari is set a touch larger, so it sits level with the others. A long feed name ends in "…" on one line, so the sidebar stays tidy; its whole name shows as a tooltip, is read in full by screen readers, and is the list's title when you open it (one line, then "…", with the whole name as its tooltip).
- Every name in the sidebar (Unread, Starred and All, folders, feeds, and the words in the find field) starts at one left edge, after a column that holds the icons of Unread, Starred and All, a folder's arrow and the find field's search icon; the section names (Folders, Other feeds) stand further out, at the sidebar's margin. On a computer the names start 46px in and the section names at the 20px margin; a folder's feeds start a step further in (64px), so the hierarchy shows without relying on the arrow.
- Folders appear once at least one exists. Each has a small arrow button before its name, in the icon column, as in a Mac sidebar, that shows or hides the feeds in it, listed beneath one step further in than the folder's name; folders start closed, and this device remembers which you opened. Choosing a folder's name lists the articles of all its feeds (`/folders/2`). On a phone's feeds screen there's no arrow (every row there already ends in a chevron): a folder's feeds are always listed beneath it, one step in.
- The search field filters the sidebar as you type: the folders and feeds whose name contains what you typed (capitals and accents don't matter), in one list. Escape empties it.
- **Unread counts:** small, muted grey numbers next to each feed and folder (a folder's is its feeds' added up), right-aligned at the row's end, so every count, folder or feed, sits in one column. No count on "Unread", "Starred" or "All", and never a total. Above 999 shows "999+". Never colored, never a badge.
- Your current place is marked as in the list (section 6), a rounded pill of soft neutral grey set a little in from the sidebar's edges, with no color (decision 0057), its name semibold in full ink, and, for Unread and All, its icon in full ink (Starred's star fills in green). When your place changes, its row scrolls into view in the sidebar if it was out of sight, at once and only as far as needed, never smoothly; it doesn't move when counts change. On a phone's feeds screen nothing is marked: it's where you start, not a place you're in. Under the pointer a row gets a fainter, neutral tone, never the accent.
- While Settings is open, its button at the foot of the sidebar shows as your place, with the same pill, and screen readers hear it as the current page. The shortcut list's button, while its list is open, sits on a faint ink tile instead (section 19). The fill is never the only sign (decision 0054).
- A broken feed looks like any other feed; it just doesn't get new items. In V1 the daily check tells you when feeds are failing; the feed health page (section 17) comes in V2.

**How to check it**
1. Add feeds whose names start with different letters. They're in alphabetical order, under the fixed views.
2. In inbox mode, a feed with unread items shows a grey number. "Unread" itself shows no number.
3. A feed with more than 999 unread items shows "999+".

## 6. Item list

**What it does**
- Each row shows the article **title** (18px with a mouse, so it clearly leads), and below it the **source name and time** in quiet small text (12px, a step fainter than muted grey, and muted grey on the selected row) (just the time in one feed's own list, whose title already names it). That line is always one line: a long source name ends in "…", with the "·" right after it at the same distance as on any other row, and the time and the star always keep their place on it, never wrapping below; its figures are proportional, as in running text (decision 0048). Unread articles have a small dot in the theme's accent in a gutter of its own before the title, clear of the words, so it reads as a mark in the margin, not a bullet; every title starts at the same place, dot or no dot, lined up with the list's title and the search field. Each row has 10px above its title and 11px below its meta line, as Apple Books spaces its lists. A faint hairline parts one row from the next, from the titles' edge to where the selection's pill ends, and none shows directly above or below the selected row or the row under the pointer. No images, no site icons.
- Dates and times are shown in your device's time zone, in words that never change while you look: "14:05" for today, "23 Oct" for this year, "23 Oct 2025" before that. The time is when the publisher says they published it, or when nine turtles received it if they don't say (and never later than that, so a wrong date can't pin an article to the top).
- Newest first by default; oldest first can be chosen in Settings or in the list's More menu.
- The list's title is one line: a long name ends in "…" (its whole name is its tooltip and is read in full by screen readers), so the search field under it never moves; in a narrow list it is set a size smaller (22px rather than 24px). Beside it sits one quiet icon, **More** (…), named for screen readers and in its tooltip, as Apple Books has one per collection. It opens a small menu with **Mark all as read** (section 8; its key, `Shift+A`, shown beside it), **Refresh** (section 13; its key, `r`; not while searching), the **sort order** (Newest first or Oldest first, the current one ticked and semibold), and, in a feed's or folder's own list, **Edit feed…** or **Edit folder…** (section 15). A click, Enter or the down arrow opens it on its first item; the arrow keys, Home and End move through it; Escape closes it and puts the keyboard back on More; Tab or a press outside closes it too. Closing a sheet opened from it puts the keyboard back on More.
- Unread, Starred and All list articles from every feed. A feed's own list shows all its articles, read and unread.
- The list has an end: it shows 50 items, then a **"Show older items"** button ("Show newer items" when sorting oldest first). Nothing more loads unless you press it. When there's nothing more to show, a quiet small caption, "That's everything.", closes the list, lined up with the titles (no line above it).
- Row states, each recognizable without color:

  | State | Looks like |
  |---|---|
  | Unread | Full-strength, semibold title, and a small dot in the theme's accent before it |
  | Read | A softer second ink, regular-weight title (the title stays full-strength while it's the selected row) |
  | Selected | A rounded pill of soft neutral grey set a little in from the list's edges, with no color (the same as in the sidebar; decision 0057); the title in full ink. When you're using the keyboard, an outline is drawn just inside the pill's edge too |
  | Starred | A small filled star after the time, in light green (read out as "Starred"; decision 0057). The article's own star button is green while it's starred, and so is the Starred icon in the sidebar while you're there |

- Items you read in the Unread view stay where they are (greyed) until you press `r` or leave the view, so nothing jumps under your cursor.

**How to check it**
1. Open a feed with many articles. Scroll to the bottom: there's a "Show older items" button and no endless loading. Press it: more appear below, and nothing above moves.
2. Open an article and move on: its title turns softer and regular weight, and it doesn't vanish from the list.
3. Turn your screen to greyscale (system accessibility setting). You can still tell unread, read, selected and starred apart.

## 7. Reading an article

**What it does**
- The article opens inside nine turtles, using exactly what the publisher put in the feed, restyled consistently: headings, quotes, code, tables, footnotes and images.
- Reading font is Literata by default (Atkinson Hyperlegible and System serif, the device's own serif, as alternatives). Lines are about 65–75 characters long.
- Links inside articles are underlined in the normal text color, never blue, except in the Plain theme, where they are the browser's own blue (purple once visited), still underlined (decision 0063).
- If the feed only has a summary, nine turtles shows the summary. It never fetches the rest from the website. Under the article's closing rule, a small centred note in upright interface type (14px, the second ink) says "This feed shares only a summary. **Read the full article ›**", the link opening the original in a new tab and the only underlined part (a fine, soft line). The publisher is named in the byline above, so the link stays short; screen readers hear "Read the full article on {publisher}". Each sentence stays whole on a line wherever it fits, so a narrow column breaks between them and never strands a word (with very large text on a small phone, a sentence wraps evenly rather than running off the screen); **Open original** goes there too.
- The article's top bar runs the width of the reading pane, its icons anchored to the pane's edges (not the text column, so on a very wide window they never float in the middle), each named for screen readers and in its tooltip with its key. The icons sit together at the right edge, 4px apart, and the left stays empty, as in Apple Books' reading toolbar (decision 0050): **Open original** (an arrow out of a box, tooltip "Open original (V)"), always present and always in the same place, then **Aa** (the reading panel, below), **Star** (an outline star, filled once starred) and **More** (…, "More actions" for screen readers), a small menu like the list's with **Copy link** (or Share, section 21) and **Mark unread** (its key, `m`, shown beside it). The feed's name in the line under the title links to the publisher's site.
- The top bar is solid, in the page's own color, across the whole pane; the text scrolls below it and never shows through. A faint line shows under it only once the text has scrolled. The scrollbar's track is see-through, so its gutter is the page's own color in every theme.
- **The Aa panel** ("Reading appearance"), as in Apple Books: a small panel under the Aa button (on a phone, a sheet along the bottom of the screen, with a Close button). From the top: text size as a stepper: one flat capsule, a small A with a minus and a large A with a plus at its ends (the same six steps as `+` and `-`) and the current step's name between them, parted by hairlines (section 18); Appearance (Light, Dark or Match device) (the same Appearance and text size controls as Settings); the theme (Original or Plain); the reading font, each name written in its own face; and the line width (Narrow, Medium, Wide). Every change applies at once to the article behind it and is the same preference as in Settings › Look and feel (section 18). It isn't modal: the article stays usable. The keyboard starts on its first control; the choices are real buttons and radio buttons; Escape closes it and puts the keyboard back on Aa; a press outside it, or Tab leaving it, closes it too.
- The title is set large (about 32px at the default text size, 1.6 times the text), tight, its lines balanced so a long title wraps into even lines rather than a long line over a short one; headings inside the article are a clear step smaller (about 22px) with more room above them than below.
- The source is always credited and linked, in a quiet line about 20px under the title as in a book or magazine (the pause grows and shrinks with the text size) (14px, the second ink): the feed's name in full ink and semibold (linking to the publisher's website), the author if the feed names one, and the time.
- Once loaded, an article ends rather than stops: a short centred line after its last paragraph (for a summary-only article, after the "Read the full article" paragraph), with room below so the last lines can be read at eye level.
- Choosing an article in the list (a click, `j` / `k`, or the arrow keys while in the list) shows it in the reading area. `Enter` or `o` opens it to read: the keyboard's place moves into the article, and `j` / `k` then move from article to article; Escape goes back to the list. On a phone-narrow window the article takes the list's place, with a back button showing the list's name. `j` never loads older items on its own: at the end of the list it stops.
- `v` opens the original in a new tab. `+` / `-` change the text size (the same setting as in Settings).
- Links inside articles open in a new tab (links to a place inside the article, like footnotes, stay in it).
- Footnote links move to the note inside the article (and back), without leaving nine turtles.
- On a wide window the article sits in the middle of the reading area, like a page in a book, while its actions keep to the pane's right edge. On a computer at least 56px of paper stays beside the text on each side, as Apple Books keeps on a Mac; in a narrow pane the line gets shorter rather than the margins thinner (decision 0044). On a phone the text keeps the one 20px margin.
- Body text wraps normally; only the article's last paragraph avoids a lone last word, so no line is pulled visibly short (decision 0040).
- With no article chosen, the reading area shows one quiet line in its middle, "Time to read something beautiful." (decision 0064; it replaced "No article open"), in the serif and in muted grey (never the accent, no picture). When the list has something to open, screen readers also hear "Choose one from the list, or press j." (on touch screens just "Choose one from the list.").
- Images load from the publisher's site. Invisible 1×1 "tracking pixels" are removed (any image sized 0 or 1 pixel), so they're never loaded.
- In a night theme, pictures are dimmed a little (never inverted) so a pale one doesn't glare on the dark page; a linked picture shows at full brightness under the pointer or the keyboard. A caption is clearly smaller than the text (13/16 of its size, with a 1.4 line height), 6px under its picture, in the second ink, which keeps 7 : 1 on the page in every theme. A table starts flush with the text's left edge, its header semibold over a fine rule and its rows over fainter ones (decisions 0050, 0053).
- Anything unsafe in the feed's content (scripts, embedded frames, code hidden in styles) is removed before display. A YouTube player embedded in an article leaves a link in its place, "Watch the video on YouTube".
- **YouTube videos play in YouTube's own player** (decision 0068). An article whose link is a YouTube video (from a channel's feed) shows, under the byline, a quiet box the shape of the video (16 : 9) in a faint tone of the text, with a round Play mark and "Play video", and under it, in small second-ink type, "Plays in YouTube's own player. Nothing loads until you press Play." Until it's pressed nothing is loaded from YouTube. Pressing it (a click, or Enter or Space) puts YouTube's privacy-enhanced player in the box's place, at the same size, playing; the keyboard moves into the player, and Tab leaves it. Screen readers hear "Play video: {title}" and, once it plays, "YouTube video: {title}". The video's description from the feed is its text; a video with none is just the video, ending with the closing rule.
- The next article is loaded in advance so moving to it with `j` is instant.
- **Your place is kept, like a bookmark** (decision 0060). Leave a long article part of the way through and it opens where you stopped next time, even after closing nine turtles. Only your own scrolling moves the place; it is forgotten once you reach the end (a finished article opens at its top again) or scroll back to the top. It's kept by paragraph rather than by pixels, so it holds when pictures load late or the text size changes, and it jumps there at once, never gliding. Each device keeps its own places (in the browser's storage, for the 200 most recent articles); nothing goes to the server.

**How to check it**
1. Open an article from a full-content blog: it reads well, with headings, quotes and images in place.
2. Open one from a summary-only feed: you see the summary, ending with "Read the full article ›", which opens the publisher's page in a new tab.
3. Check that links in the text are underlined and not blue (in Original; in Plain they are blue and underlined).
4. Press `j` repeatedly: each article appears with no visible wait.
5. Press `Enter`, read, press Escape: you're back on the same row in the list. Press `+` and `-`: the text grows and shrinks.
6. Press Aa above an article: the panel opens under it. Press the large A, choose Dark, and Atkinson Hyperlegible: the article changes at once. Choose Plain under Theme: the page turns black on white and the article's links blue. There are no theme tiles. Press Escape: the panel closes and the keyboard is back on Aa. Settings › Look and feel shows the same choices.
7. Make the window very wide: Open original, Aa, Star and More stay together at the reading pane's right edge. Scroll an article: the text fades under the top bar.
8. Scroll halfway down a long article, open another, then come back (or reload the page): it opens where you stopped. Read it to the end, open another and come back: it opens at its top.
9. Follow a YouTube channel (paste its page address, e.g. youtube.com/@name, into Add a feed) and open a video: a grey box with Play shows above the description. Press it: the video plays in YouTube's own player, in the same place. Open the next video: it waits for Play again.

## 8. Read state, marking unread, "mark all as read", undo

**What it does**
- An item counts as read as soon as it's shown in the reading pane, by click or by `j`/`k`.
- `m` marks the current item unread again. **Mark unread** in the article's More (…) menu does the same (in the top bar on desktop, in the bottom bar on phones).
- **Mark all as read** (`Shift+A`, or **Mark all as read** in the More (…) menu beside the list's title, section 6): happens instantly, no "are you sure?". It affects **only the items shown on screen right now** (every item listed, including pages added with "Show older items"). Items that arrived in the background but aren't displayed yet are never touched.
- **Undo** (`u`, or a visible **Undo**): after an undoable action, a note such as "Marked 23 items as read" with an **Undo** button floats at the bottom of the list (nothing in the list moves), in a band of the list's own tone that the rows end above, so it never covers them (decision 0048). It stays until your next undoable action or until you leave the list. Pressing `r` doesn't clear it. After an undo it says "Undone."; there's no undoing an undo. Moving through articles doesn't clear it.
- Undo reverses **the last action only**, of these: mark all as read, mark unread, star/unstar, unsubscribe, delete folder.
- Read state is recorded in both reading modes, so switching modes never loses it.
- Each feed's unread number in the sidebar changes at the same moment.
- If a mark can't be saved (the connection dropped, say), it's taken back and the note at the bottom of the list says so plainly, such as "The star couldn't be saved." That message takes the Undo's place. A failure never takes back a later action on the same article.

**How to check it**
1. Click an unread item: it turns grey and the feed's unread number drops by one.
2. Press `m`: it's unread again and the number goes back up.
3. Press `Shift+A` in a feed: everything shown turns grey at once. Press `u`: they're unread again.
4. Wait until "New items · press r" appears, then mark all as read *without* pressing `r`. Press `r`: the new items are still unread.

## 9. Star

**What it does**
- One concept: **Star**. `s` (or the **Star** button in the article's toolbar) stars or unstars the current item. It can be undone like the other marks (section 8).
- Starred items appear in the **Starred** view and are kept forever.

**How to check it**
1. Star an article: a small star mark appears on its row, and it shows up under Starred.
2. Unstar it: it leaves Starred.

## 10. Reading modes: inbox and river

*V1 has inbox mode only: an Unread view, read/unread styling and unread counts, with the app opening on Unread. River mode is moved to V2 (23 October 2026); the description below is kept for then.*

**What it does**
- A single setting for the whole app.
- **Inbox (default):** things to get through. Unread view, read/unread styling and unread counts are all present.
- **River:** things flowing past. No Unread view, no read/unread styling, no counts. Read state is still recorded quietly.
- In river mode the sidebar shows **Starred · All** only, `g u` does nothing, and "Mark all as read" is hidden. The app opens on **All** in river mode and on **Unread** in inbox mode.

**How to check it**
1. In Settings, switch to river mode. The Unread view, the counts and the grey "read" titles all disappear.
2. Read a few articles, switch back to inbox. The ones you read are shown as read.

## 11. Background fetching (being polite to publishers)

**What it does**
- The server checks feeds in the background, each on its own rhythm: often for frequent publishers, rarely for quiet blogs. Never more often than every 30 minutes, and at least once a day.
- Checks are spread out over time, never all at once.
- It tells the publisher what it already has (using "ETag" and "Last-Modified", standard web labels), so unchanged feeds cost them almost nothing.
- It identifies itself clearly as nine turtles.
- If a publisher says "slow down" (HTTP 429, or 503 with a time), it waits as long as asked, up to a week (so a mistaken answer can't silence a feed for good).
- Each fetch has a time limit and a size limit.
- If a feed has moved permanently, nine turtles updates its stored address.
- A failing feed is retried less and less often (twice as long after each failure, up to once a day) and never affects other feeds. A feed that keeps failing still looks normal in the sidebar; it simply shows nothing new.
- It never visits article pages.
- If a publisher edits an article you've already seen, the text is updated quietly and it stays read.
- The same article published in two different feeds appears in both.

**How to check it**
Most of this is checked by the automatic tests rather than by eye. You can see it working:
1. Leave the app closed for a day, then open it: the feeds you follow have new articles that arrived on their own.
2. When a feed keeps failing for three days or more, the daily check mentions it ("Some feeds keep failing"), without naming it (the feed health page comes in V2).

## 12. WebSub (instant updates from publishers who offer it)

*Moved to V2 (23 October 2026): V1 is for the owner alone. Kept here so V2 starts from it. See `docs/decisions/0012-v1-for-one-reader.md`.*

**What it does**
- Some publishers announce new articles the moment they publish, through a service called a "hub" (the standard is called WebSub). When a feed offers this, nine turtles signs up and receives new articles as they're published.
- nine turtles checks that announcements are genuine (each subscription has its own secret).
- Subscriptions are renewed before they expire.
- Regular checking continues, less often, as a backup.

**How to check it**
1. Follow a blog that uses WebSub (we'll pick one together at that milestone).
2. When it publishes, "New items · press r" appears within a few minutes rather than hours.

## 13. Refresh: the view waits for you

**What it does**
- The list on screen changes only when you ask: press `r` or choose Refresh in the list's More (…) menu.
- When new items are waiting, a quiet note floats at the bottom of the list: **"New items · press r"** (on touch screens: **"New items"** with a **Show** button, which does the same as `r`). It shows no number. It sits at the foot of the list in a band of the list's own tone, which the rows end above, so nothing shifts when it appears and it never covers a row (decision 0048). The list asks the server about once a minute, and only about its own articles (none ever arrive in Starred).
- **Refresh** (its key, `r`, shown beside it) is in the More (…) menu beside every list's title, on phones too (section 6).
- Because fetching already happened in the background, pressing `r` is instant. It shows the list from the top again, with the new items, and updates the sidebar's unread numbers. Those numbers also wait for `r`, so nothing in the sidebar changes under you either.
- Opening or reloading the app always shows the latest state.
- No pull-to-refresh on phones; there's Refresh in the list's More menu, and Show in the "New items" note, instead.

**How to check it**
1. Leave the app open. When the "New items" note appears at the bottom, check the list hasn't moved.
2. Press `r`: new items appear at once, with no spinner.
3. Close and reopen the app: you see everything new without pressing anything.

## 14. Search

**What it does**
- `/` puts you in the search field, which sits under the list's title: a slim, faintly filled field with soft corners and no edge, 36px tall with a mouse on a wide window and 44px on a touch screen or a phone, the same field as the sidebar's find field. A faint search icon starts the field; the "Search options" (sliders) button sits inside it at its right end.
- Results follow a moment after you stop typing, or at once on Enter. Every word must appear; a word also finds longer words it begins ("read" finds "reading"); words in double quotes are found together.
- The search starts out limited to where you are, shown as a removable chip inside the field, e.g. `[ in: Tech × ]`, as soon as you're in the search (the field focused, its options open, or words typed). At rest the field just says "Search", since the list's title already names it. Remove the chip to search everything.
- **Search options** opens a small popover under its button, floating over the list rather than pushing it down, drawn as a menu: three sections of rows, with a checkmark at the start of each one that holds and its words semibold. **Search in**: the list you started from (marked "This list") and All feeds, plus the place now searched when it's another; **Other feed or folder** at the section's end, drawn as a menu's submenu row with a trailing › (its words wrap rather than being cut off on a narrow screen), opens a list of every view, folder and feed (decision 0048). **Show only**: Unread and Starred, each ticked on its own. **Published**: Any time, Past week, Past month or Custom, which shows two dates. The rows are radio buttons and tick boxes underneath, for keyboards and screen readers. Escape closes it and returns to its button (a second Escape closes the search); so does a press outside it, or the keyboard moving out of the search. The panel and the chips always match. The search box stays one line for the usual one or two chips: they shrink and end in "…", with their whole text in a tooltip. With three or more it wraps, so every chip stays readable.
- Titles and article text are always searched together; title matches come first.
- Power-user filters can be typed: `is:unread`, `is:starred`, `feed:name`, `folder:name`, `after:YYYY-MM-DD`, `before:YYYY-MM-DD`. They're suggested as you type (↓ and ↑ choose, Enter takes one) and turn into chips once followed by a space or Enter. A chip says its filter in plain words, as the options menu does: **Unread**, **Starred**, **After 1 Oct 2026**, **Before 1 Mar 2026**; the typed form (`is:unread`) is its tooltip, and screen readers hear it after the chip's Remove button (decision 0048). A name with spaces goes in quotes (`feed:"Garden Notes"`), or type part of it. `after:` and `before:` don't include the day itself. A filter that can't be understood stays as typed, with a plain line saying why. Backspace at the start of the field removes the last chip.
- Results look and behave like the normal item list, including "Mark all as read" in the More menu. A quiet line above the results says how many were found ("16 results", or "50+ results" while more can load). Where the search options would cover that line (a narrow list, or a phone), the options repeat it in a quiet line at their foot, so ticking a filter always shows how many it leaves (decision 0054). Refresh is hidden while searching: there's nothing new to fetch for a search.
- Matching words, in a title and in the line of text under it alike, have a faint tone of the theme's accent behind them with small rounded corners and a fine underline (so never tone alone), in the text's own weight (decision 0037). Screen readers hear them as highlighted.
- Under the title of each result whose text (not only its title) holds a searched word, up to two muted lines show that text around the first match, before the source and time: a few words before it, then on to about 90 characters, cut only between words, with "…" where text was left out, and ending in "…" if the list is too narrow for two lines. Three typed dots in the publisher's text show as one "…" too. The searched words in it are marked as in the title, and in full ink rather than muted grey. The line is plain text: nothing from the feed's HTML comes through.
- Once the field has words in it, a **×** at its end ("Clear search", a 44px target) empties the field, keeping any chips, and leaves the keyboard in it.
- Works for English, other Latin-alphabet languages, and Hindi.
- Tab moves from the field into the open options, onto the place being searched; Escape closes search and returns you to where you were.

**How to check it**
1. In a folder, press `/`, type a word you remember from an article. The chip shows the folder; results appear with the word marked by a faint tone behind it and a fine underline, and a result whose text holds the word shows a line of that text with the word marked the same way. Press × to empty the field.
2. Remove the chip: results now come from all feeds.
3. Type `is:starred`: it becomes a chip saying "Starred", and only starred items are listed.
4. Open the options, choose Past week: a matching "After …" chip appears in the field, its date in words.
5. Search a Hindi word from a Hindi article: that article is found.
6. Press Escape: you're back exactly where you were.

## 15. Folders and managing feeds

**What it does**
- Folders are the only grouping. A feed can be in more than one folder.
- You can rename a feed, choose its folders, and unsubscribe, from **Edit feed…** in the More (…) menu beside the item list's title when you're viewing one feed. It opens as a sheet over the feed's list (`/feeds/3/edit`) with the name, the folders as a checklist (a grouped list of 44px rows; each folder ends in a tick box, a rounded square, filled with a check when the feed is in it and empty when it isn't, square rather than round because a feed can be in several folders), whose last row is "New folder…", a text box (made when you save, with the feed in it), and at the foot one row in a Mac sheet's order: **Unsubscribe** at the far left as words in a muted red (no edge; the word says what it does, so red is never the only sign; its tooltip, and screen readers, say it removes the feed's articles, keeps the starred ones, and can be undone straight afterwards), then **Cancel** (a faint tone, no edge) and **Save** at the right end. A problem saving appears above that row in red words after a warning mark. Escape, Cancel or a press on the dimmed page goes back unchanged. On a phone it's the same iOS page sheet as Add a feed (and Edit folder; decision 0055), with the folders and Unsubscribe as cards on its grouped ground: an X beside the title (it and Escape go back unchanged), no Cancel, **Unsubscribe** as the one red row of a group of its own, and **Save** the full width at the screen's foot, at least 32px below it (decision 0052). The folders' helper line ("Optional: a new folder…") is 13px in the muted grey, 6px under the list, on its left edge.
- Viewing a folder, **Edit folder…** in the same menu opens a sheet in the same way (`/folders/2/edit`) to rename or delete it, built the same way: Name, then one row with **Delete** in muted red at the far left (its tooltip says the feeds stay) and Cancel and Save at the right end. On a phone, the same build as Edit feed's: an X, Delete as a red row of its own, Save at the foot.
- You can create (from "Edit feed"), rename and delete folders. Two folders can't share a name. Deleting a folder never deletes its feeds.
- Unsubscribing and deleting a folder happen at once and take you to Unread, where the line says "Unsubscribed from …" or "Deleted the folder …" with Undo (or `u`), until your next action.
- Unsubscribing from a feed keeps its starred articles in Starred. Undo brings the feed back whole, read history and folders included; after your next action (or ten minutes) its other articles are gone for good. Following it again later starts it afresh, all unread.

**How to check it**
1. Put a feed in two folders. It appears under both, and its unread count is right in each.
2. Rename a folder: it moves to its new alphabetical position.
3. Delete a folder: its feeds remain (under other folders or the "no folder" group).
4. Unsubscribe from a feed, then undo: it's back with its read history.
5. Star an article, then unsubscribe from its feed: the article is still in Starred.

## 16. OPML import and export

OPML is the standard file format feed readers use to move subscription lists between apps.

**What it does**
- **Import:** from Settings → Your data, or from the empty state. A feed that appears several times in the file becomes one feed in several folders. Feeds you already have are not duplicated (they join the file's folders). Folders inside folders become the innermost one. Afterwards, a plain summary says what was added and what couldn't be read, for example "Added 120 feeds and 8 folders. Their articles arrive over the next few minutes." The feeds appear at once with the file's names; their articles arrive in the background, a few feeds at a time, as with any feed.
- **Export:** downloads an OPML file of all your feeds and folders. A feed in several folders appears under each of them.
- Your own OPML file is never stored in the code repository.

**How to check it**
1. Import your OPML file. The summary says how many feeds were added. Your folders appear in the sidebar.
2. Export, then import the export into another feed reader (or back into a fresh nine turtles). Everything is there, with the same folders.

## 17. Feed health page

*Moved to V2 (23 October 2026): V1 is for the owner alone. Kept here so V2 starts from it. See `docs/decisions/0012-v1-for-one-reader.md`.*

**What it does**
- In Settings. Lists only feeds with problems, worst first: dead feeds, then feeds "having trouble".
- A feed is **dead** after 7 days of "not found", or 3 weeks of any failure. Dead feeds are still checked once a day in case they come back.
- Problems are described in plain words, e.g. "Hasn't worked for 3 weeks — the site may have moved". No error codes.
- Actions for each feed: **Retry · Find new address · Unsubscribe**. "Find new address" looks for the feed again on the site's home page.
- Status colors are muted, never blue-ish, and always accompanied by words.

**How to check it**
1. Add a feed address that doesn't exist (we'll provide a test one). After a while, it's listed with a plain explanation.
2. Press Retry: it's checked again immediately and the result is shown.
3. When everything works, the page says something calm like "All feeds are working."

## 18. Settings and appearance

**What it does**
- Settings opens in place of the list and reading area; the sidebar stays. Its X (named "Close settings") or Escape goes back to where you were.
- Laid out as Apple Books' settings are: one centred column, no wider than 560px, of grouped lists (Reading, Look and feel, Your data, Account). Each group is a rounded block a tone off the page (by night a clear step lighter than the page, the text color mixed 7% into it, so it never melts into it), with a small muted header above it and a line explaining it below; its rows are at least 44px tall, parted by hairlines inset from the left, each with its name on the left and its control at the right end, every control the same width. On a phone a control sits under its name, the width of the row.
- **Look and feel** (this device only): Appearance, theme (Original or Plain), reading font (Literata, Atkinson Hyperlegible, shown as "Atkinson", or System serif), text size (six steps from Smaller to Largest, Medium by default), line width (Narrow, Medium or Wide: about 65, 71 or 78 characters in Literata; Atkinson Hyperlegible's narrower letters fit more). A sample paragraph, the group's first row before its controls (inside the group, its words on the rows' words, a hairline under it), shows how articles will look, and changes apply at once (decision 0055). The same preferences are in the Aa panel above every article (section 7), and the line under the group says so.
- **Theme:** Original (the default): white paper by day, near-black by night, with an ink-blue accent for unread dots and search matches, and green for starred stars (decisions 0056, 0057). Or Plain: the owner's site rohit.onl's bare look, black on white (white on near-black by night), the unread dot and search matches in the text color, and links in articles in the browser's blue, purple once visited, underlined (decision 0063). Chosen in Settings and the Aa panel. The phone's own bar above the page takes the showing version's color too.
- **Appearance:** Light, Dark or Match device (the default). Light and Dark always show the day or night version; Match device follows the device's own light or dark setting, and switches with it while nine turtles is open. A theme chosen in an earlier version becomes Original; its Appearance is kept, and a dark theme from before decision 0046 opens by night (decision 0056).
- Sort order, Appearance, reading font and line width are rows of choices on a faint track (a "segmented control"), chosen with a click, a tap or the arrow keys (they're radio buttons underneath). The chosen one is raised: the page's own color (in dark themes, a clear step lighter than its track) with a small shadow under it and no edge, and its word is semibold, so it shows without color. Each reading font's name is written in that font.
- **Text size** is a stepper, as in Apple Books: one flat capsule on the same faint track as the segmented controls, a small A with a minus and a large A with a plus at its ends and the step's name between them, each part split from the next by a hairline and nothing raised, so it never reads as a choice with something chosen (decision 0055); one step each press, the name said aloud when it changes; at either end the A that can't go further fades to the muted grey. 44px tall to touch. It's the same control as in the Aa panel.
- Sections appear once they have something to do: Reading (sort order) since Milestone 7, Your data with Milestone 9.
- **Reading:** newest or oldest first. (Inbox or river mode in V2.)
- **Your data:** three rows that act: **Import OPML…** (opens the file chooser; it ends in ›), **Export OPML** and **Export starred articles** (each downloads a file; each ends in a download mark), in the text color. What the files are is said under the group; what an import did appears there too.
- **Account:** **Sign out** as a row of its own, ending in a small door mark, in the text color (not red: signing out removes nothing), and the version under the group. (Keeping articles and Feed health come in V2.)
- **Status:** which version of nine turtles you're using. When a newer version is live (nine turtles notices from the server's answers), it says "A new version is ready" with a **Reload** button. Otherwise new versions are used automatically the next time you open or reload the app, never while you're reading. If a tab left open across an update can't carry on, it says so plainly in the note at the bottom of the list (where "New items" appears): "nine turtles was updated. Reload to continue.", with a **Reload** button.
- Fonts are served by nine turtles itself; nothing is loaded from font services. Other scripts such as Hindi use the fonts already on your device.
- **Shared across your devices:** sort order (and reading mode, in V2). **Per device:** Appearance, font, text size and line width (a phone and a laptop often want different sizes). `+`/`-` change the same text-size setting.

**How to check it**
1. Switch your computer to dark mode: nine turtles follows, at once, in the night version. Choose Appearance Light in Settings: it stays light regardless of the system.
2. Change the reading font and text size: the article updates immediately.
3. Look at the browser's network list (or ask an agent to): no requests to Google Fonts or any other font service.

## 19. Keyboard

**What it does**
- Every action works with standard keys (Tab, Enter, Escape) with a clearly visible focus outline. Vim keys are an extra:

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
  | `]` | Show / hide article list |
  | `\` | Show / hide both |
  | `+` / `-` | Text size while reading |
  | `Esc` | Back / close |
  | `?` | Shortcut cheat sheet |

- **Keys**, an icon and its word at the foot of the sidebar, opens the shortcut list (screen readers hear "Keys (keyboard shortcuts)"; its tooltip says "Keyboard shortcuts (?)"), and so does `?` anywhere (decision 0062). While the list is open the button sits on a faint ink tile (never the accent, since it's a button), and screen readers hear that it opens a dialog and whether it's open (decision 0054). There's no hint under the list, whether the sidebar shows or not.
- **One welcome tip, once** (decision 0062): on a screen with a keyboard, the first time the reading area shows its quiet line with articles in the list, a quiet line hangs under it in small muted type: "Press J to open the first article, or ? for every shortcut.", the keys as key caps. Once you open any article (by click or key) or the shortcut list, it never shows again on that device. Touch screens never show it. On a phone the keyboard icon isn't shown; `?` still opens the list from a hardware keyboard.
- The `?` cheat sheet groups the shortcuts by what you're doing (Reading, Getting around, Tidying up, Anywhere; decision 0062) in two columns, what each does on the left and its keys on the right, and also documents the search filters. Keys are printed as a Mac prints them: letters in capitals and Shift as ⇧ (`Shift+A` shows ⇧A; screen readers hear "Shift A"), the same in the More menu (decision 0055). Its title is in the same serif as every other title. Its two columns are stacks of their own: Reading and Getting around on the left; Tidying up, Anywhere and the search filters on the right. **Find a shortcut**, a field in its top line (on a phone, on a line of its own under the title), shows only the shortcuts and filters whose words contain what's typed, or whose key it is ("star", "s", "g u", "shift a"); a group with none left steps aside, and with none at all it says "No shortcut matches". A letter typed anywhere in the open list goes straight into the field. Escape empties the field first, from anywhere in the list, then closes the list; it opens again whole. It's never taller than 720px and stays at least 48px clear of the window's top and foot, and at 1280 × 800 the whole list fits without scrolling. On a phone it fills the screen, as every sheet does there. It has an X to close it (or Escape); it opens with the keyboard on its title rather than the X, and the title shows no ring, since it can't be pressed (the X and the list ring as soon as Tab reaches them). When it does scroll, a faint line shows under the title once the list has moved, and one near its foot while more lies below. Until a shortcut's feature exists, it isn't listed, and the key does nothing.
- The keyboard's place is shown by a 2px outline in the text color (never the accent, which marks what's unread and what a search found). Rows draw it just inside their rounded edge, in a slightly softened text color, so it never reaches over the hairlines between rows; the selected row keeps its pill. A text field in use rings the same softened text color, 2px, 1px clear of the field, its own edge stepping aside, at 3 : 1 or more against the field and whatever it sits on in every theme (decision 0055). A title that receives the place when a screen opens (so screen readers start there) gets the same outline when you got there by keyboard, and nothing after a click; a sheet's, the shortcut list's and an opened article's title are the exceptions and show no ring, since they can't be pressed; the next Tab lands on a real control, which rings (decisions 0042, 0047).
- A tooltip names its button's key after its name, in brackets, as a capital letter, the same way the key caps print it: "Star (S)", "Open original (V)" (decision 0064).
- Shortcuts don't fire while you're typing in a field.

**How to check it**
1. Unplug the mouse (or don't touch it). Using only Tab, Enter and Escape, add a feed, read an article, star it and search. You can always see where the focus is.
2. Try each vim key from the table.
3. Press `?` and type "star": only the starring shortcuts and filter show. Press Escape twice: the list closes.
3. Press `?`: the cheat sheet opens; Escape closes it.

## 20. Phones and installing the app

**What it does**
- One column you move through: **Feeds → Items → Article**. The feeds list is the home screen; no hamburger menu.
- Top bar: a back arrow labeled with where it goes (e.g. "‹ Tech", drawn as a small arrow icon; screen readers hear "Back to Tech") and the screen title. More beside a list's title; search and search-options icons on the feeds and items screens (with search, Milestone 10).
  - The feeds screen: the large "nine turtles" wordmark and **Refresh** as an icon alone (a 44px tap, named "Refresh"; it updates the unread numbers); **Add feed** and **Settings** sit together at the bottom, as on a computer. No sidebar toggle. It's the root of the screens, as on an iPhone: no row is marked as selected, and every row (Unread, Starred, All, folders, feeds) ends in a small chevron, after its count, because it leads on to a screen of its own.
  - A list: "‹ Feeds", then the list's name (one line, ending in "…" if long) with **Search** (a magnifier) and **More** (…) beside it, More holding Mark all as read, Refresh, the sort order and Edit (section 6). The top bar never scrolls. The search field waits behind the Search button, so the first article sits right under the title (decision 0060): a tap shows the field with the keyboard in it, and it stays until the button is tapped again with nothing searched, Escape, or going to another place (never on its own, so nothing moves under a finger); while a search is on it always shows.
  - An article: the back button with the list's name in words ("‹ Tech"; screen readers hear "Back to Tech"; a long name ends in "…") at the left, and **Open original** as an icon at the right, on the same solid bar as on a computer (section 7).
  - Add a feed: "‹ Feeds".
  - The back button sits in the same place on every screen, its arrow the same size, 8px from the screen's edge, so it never jumps as you move between screens.
- One side margin on every phone screen: names, titles and text start 20px from the screen's edge (on the feeds screen, the wordmark, the section names and the icons of Unread, Starred and All). A list keeps a gutter for its unread dot, as Books and Mail do on iOS: its title, search field and article titles start 28px in, and the dot sits 10px from the edge (decision 0054).
- The system back gesture and back button go back one step, the same as the back arrow. Opening nine turtles' front page on a phone shows the feeds; an address that names a list opens that list, and its back arrow still leads to the feeds.
- "Settings" sits at the bottom of the feeds screen, beside "Add feed".
- No custom swipes on list items.
- Article toolbar at the bottom, within thumb reach and clear of the phone's home indicator, solid in the page's color with a faint line along its top so the text ends at an edge: five quiet icons without words, each a 44px tap with its name for screen readers: previous · next · Aa · star · More (…). The five always share the bar evenly: on the first article Previous (and on the last, Next) keeps its arrow in its place, faded, and does nothing; screen readers hear it as dimmed (decision 0047). More opens upwards with Share (or Copy link) and Mark unread. Aa opens the reading panel (section 7) as a sheet along the bottom of the screen. Article text reads a little smaller than on a wide screen, so a line keeps about 40 characters.
- Every tap target is at least 44 pixels.
- Can be added to the home screen on iPhone and Android; it then opens full-screen with its own icon: nine small turtles seen from the side, three rows of three with the middle row a little to the right, dark on white (decision 0067). The same turtles mark the browser tab, on white by day and on near-black by night.
- Without a connection, the app still opens and says plainly that nine turtles can't be reached. It keeps a copy of the app itself, never of your articles.

**How to check it**
1. On your phone, open the app: you see your feeds. Tap a folder, a feed, an article; the back arrow says where it goes each time.
2. Swipe back from the screen edge: you go back one step.
3. In an article, press Next and Previous at the bottom: they move through the list. On the first article, Previous shows a faded arrow in its usual place and does nothing; the bar has no gap.
4. Use "Add to Home Screen". Open it from the icon: no browser bars.

## 21. Sharing

**What it does**
- Only in the article view, in its More (…) menu (at the right of the top bar on a computer, in the bottom bar on a phone).
- On phones: the system share sheet. On desktop: **Copy link**.
- Always shares the publisher's original link, never a nine turtles link.
- No buttons for specific platforms.

**How to check it**
1. On desktop, choose Copy link in the article's More (…) menu and paste somewhere: it's the publisher's address.
2. On a phone, choose Share in the More (…) menu: your phone's usual share sheet opens with the publisher's link.

## 22. Everyone can read here (accessibility)

**What it does**
- Contrast meets WCAG AA everywhere (an international accessibility standard) and AAA for article text, in every theme, including grey text.
- Nothing relies on color alone.
- Screen readers find the three panes as named regions, hear which item is selected, and hear changes such as "marked as read" (said when an article is opened, though nothing about it is written on screen). Each article is marked with its language so it's pronounced correctly: the item's language if given, otherwise the feed's; if neither says, it's left unmarked rather than guessed.
- Follows the system's text size, reduced motion, high contrast and light/dark settings.

**How to check it**
1. Zoom the browser to 200%: everything still works and nothing overlaps.
2. Turn on your phone's or computer's screen reader (VoiceOver, TalkBack or NVDA). Move through items: it reads the title and says when things are marked as read.
3. The automatic checks run contrast and accessibility tests on every screen in every theme; a pull request can't pass if they fail.

## 23. Your data: keeping and exporting

**What it does**
- In V1, nothing is removed automatically. Unsubscribing removes that feed's articles and read history (starred articles stay in Starred). Undo brings them back only straight away; after your next action they're gone for good.
- Export of starred articles as a JSON Feed file (a standard, open format other feed tools can read), from Settings → Your data → **Export starred articles**. It holds every starred article, newest first, with its text, original link and the feed it came from, including starred articles of feeds you've since unsubscribed from.
- **No backups in V1** (the owner's decision, 23 October 2026). V1 is for the owner alone. Your safety net is your own OPML file (your feeds and folders) and the starred export (your stars). Which articles you've read isn't saved anywhere else. As a last resort, Render keeps its own daily copies of the disk for at least a week, though Render warns they may not bring a database back cleanly.

**Moved to V2:** nightly backups outside Render with a copy before every database structure change; a written, tested guide to moving hosts; and removing unstarred articles a year after nine turtles received them (only after a successful backup, and never letting them come back as new).

**How to check it**
1. Export your starred articles and open the file: they're all there.
2. Export your OPML file now and then, and keep it somewhere safe.

## 24. Languages

**What it does**
- The interface is in English.
- Articles can be in any language; each is marked with its language.
- Search covers English, other Latin-alphabet languages and Hindi. Chinese and Japanese search are not in V1.

**How to check it**
Covered by sections 14 and 22.

## 25. Speed

**What it does**
- Every action feels instant (under about a tenth of a second).
- No spinners for things the app already has.
- Actions happen on screen first; saving to the server happens quietly behind.
- The app's download size is kept under a budget checked automatically: at most 150 KB of app code and styles, and 400 KB of fonts (downloaded once, then kept by the browser).

**How to check it**
1. Use the app for a few minutes: you never wait for it.
2. On a slow phone connection, star an article: the star appears immediately. If saving fails, you're told plainly and the star is taken back, rather than silently lost.

---

## Not in V1

From DESIGN.md: public reading list page, per-feed reading modes, passkey sign-in, Chinese and Japanese search, multiple users. (The own domain name was chosen on 25 October 2026: nineturtles.app, with the app at app.nineturtles.app; decision 0066. YouTube videos play in YouTube's own player since 25 October 2026; decision 0068.)

Moved to V2 on 23 October 2026: backups and moving hosts, river mode, WebSub, the feed health page, the yearly clean-up, the feeds guide page, and keeping a tab that was left open across an update working without a reload.

Never: notifications, badges, streaks, reading stats, infinite scroll, algorithmic ranking, likes or comments, platform share buttons, scraping full articles, decorative effects or animation.
