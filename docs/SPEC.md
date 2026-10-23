# slowfeed V1: what it does

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
- slowfeed has a public web address, so it asks for a password. There is one password and no username.
- Each device stays signed in for a long time, so you rarely type it.
- Each device stays signed in for a year after it was last used. Signing out ends that device only; other devices stay signed in.
- Repeated wrong passwords are slowed down, so nobody can guess by trying thousands: after five wrong tries in a row, slowfeed asks you to wait a minute, and each further wrong try doubles the wait, up to an hour. The right password resets it, and so does an hour without wrong tries. Wrong tries count for the whole app, wherever they come from, so a stranger guessing can make you wait on a new device (devices already signed in are unaffected). Restarting slowfeed on Render clears the wait (`docs/operations/render-setup.md`).
- Messages are plain: "That isn't the password." or "Too many wrong tries. Try again in 2 minutes."
- Sign out is in Settings.
- The password itself is never stored, only a scrambled version that can't be turned back into it (a "hash"). You set it by typing `slowfeed set-password` in Render's Shell tab and pasting the scrambled line it prints into Render's settings (`docs/operations/render-setup.md`). Until then, nobody can sign in.

**How to check it**
1. Open the app's address in a private browser window. You see only a password field, nothing about your feeds.
2. Type a wrong password several times quickly. After a few tries it asks you to wait before trying again.
3. Type the right password. You're in. Close the browser, reopen the address: you're still signed in.
4. Sign out from Settings. Reload: you're back at the password field.

## 2. First visit (empty state)

**What it does**
- Until you add your first feed, Unread and All show one field: **"Paste a website or feed URL"**, and below it: **"Import OPML"**, which goes to the import described in section 16. (Until that import exists, Milestone 9, the link isn't shown, so nothing on screen does nothing.)
- (V2 adds "New to feeds? Here's how they work", a short guide page for newcomers.)

**How to check it**
1. On a fresh installation, sign in. You see the field (and, from Milestone 9, the Import OPML link), and nothing else competing for attention.

## 3. Adding a feed

**What it does**
- "+ Add feed" sits at the very bottom of the sidebar, always in the same place. The `a` key does the same.
- "+ Add feed" opens its own screen (`/add-feed`) with the same field as the first visit. Escape goes back to the list you were on.
- You can paste either a feed address or an ordinary website address; leaving off `https://` is fine. For a website, slowfeed looks at exactly the page you pasted to find its feed ("autodiscovery"), once, because you asked. If the page names several feeds, you see their names and choose one.
- While slowfeed looks, the field says "Looking for a feed…" in plain text. No spinner.
- If it doesn't work, a plain sentence says why, never an error code: "This site doesn't seem to offer a feed.", "That site didn't answer. Try again later.", "Nothing was found at that address.", "That doesn't look like a web address.", "slowfeed can't visit that address." (an address inside a private network or on slowfeed's own computer), or "That file is too big to be a feed."
- Adding a feed you already follow says "You already follow this feed." with a link to it, instead of making a copy. The same address written differently (`http` or `https`, a trailing `/` or `#part`) counts as the same feed.
- The new feed appears in the sidebar and opens, its articles straight away, all unread (including older posts the feed still lists). It's fetched once on adding; new articles arriving on their own come with Milestone 8.
- Each feed has its own address (`/feeds/3`), so reloading keeps your place. An address for a feed you don't follow says so plainly ("Feed not found").

**How to check it**
1. Press `a` (or click "+ Add feed"), paste a blog's home page address (not its feed), press Enter. The blog appears in the sidebar with its articles.
2. Paste a direct feed address. Same result.
3. Paste an address of a page with no feed. You get a calm, plain message, not an error code.
4. Add the same feed twice. slowfeed tells you it's already there instead of creating a duplicate.

## 4. Layout

**What it does**
- Three panes on a wide screen: **feeds | items | article**. Two panes on a medium screen. One column on a phone (section 20).
- No layout options to choose: the layout simply adapts to the window width. Wide means 1200 pixels or more at normal size, medium 768 or more. On a medium screen the list and article show, and showing the sidebar puts it in the article's place. On a phone-narrow screen one area shows at a time, starting with the sidebar; choosing a place in it shows that place, and Escape goes back.
- Zooming in or a larger system text size counts as a narrower window, so the layout steps down instead of anything overlapping.
- The sidebar can be hidden and shown with a toggle labeled "Sidebar" in the top-left corner, which never moves, or the `[` key.
- Unread, Starred, All and Settings each have their own web address (`/unread`, `/starred`, `/all`, `/settings`), so reloading keeps your place and the browser's Back button works. The front page opens Unread.
- Regions are told apart by background tone and space, never by lines, shadows or gradients.
- Nothing animates. Views switch instantly.

**How to check it**
1. Make the browser window wide, then narrower, then phone-narrow. You see three, then two, then one column.
2. Press `[` twice. The sidebar hides, then returns, and the toggle stays in the same spot.
3. Squint at the screen: you can still tell the three regions apart.

## 5. Sidebar

**What it does**
- Fixed order, top to bottom:
  1. **Unread · Starred · All**
  2. **Folders**, alphabetically
  3. **Feeds not in any folder**, alphabetically
  4. **"+ Add feed"**
- You can't reorder things by hand; order is always alphabetical.
- At the top of the sidebar: the "slowfeed" wordmark with a labeled **Settings** link beside it, and below them a **search field to find a feed or folder by name**, always shown.
- Folders appear once at least one exists.
- **Unread counts:** small, muted grey numbers, right-aligned, next to each feed and folder. No count on "Unread", "Starred" or "All", and never a total. Above 999 shows "999+". Never colored, never a badge.
- Your current place is marked with the ink blue accent.
- A broken feed looks like any other feed; it just doesn't get new items. In V1 the daily check tells you when feeds are failing; the feed health page (section 17) comes in V2.

**How to check it**
1. Add feeds whose names start with different letters. They're in alphabetical order, under the fixed views.
2. In inbox mode, a feed with unread items shows a grey number. "Unread" itself shows no number.
3. A feed with more than 999 unread items shows "999+".

## 6. Item list

**What it does**
- Each row shows the article **title**, and below it the **source name and time** in quiet small text. No images, no site icons.
- Dates and times are shown in your device's time zone, in words that never change while you look: "14:05" for today, "23 Oct" for this year, "23 Oct 2025" before that. The time is when the publisher says they published it, or when slowfeed received it if they don't say (and never later than that, so a wrong date can't pin an article to the top).
- Newest first by default; oldest first can be chosen in Settings.
- Unread, Starred and All list articles from every feed. A feed's own list shows all its articles, read and unread.
- The list has an end: it shows 50 items, then a **"Show older items"** button ("Show newer items" when sorting oldest first). Nothing more loads unless you press it.
- Row states, each recognizable without color:

  | State | Looks like |
  |---|---|
  | Unread | Full-strength, semibold title |
  | Read | Muted grey, regular-weight title |
  | Selected | Ink blue bar on the left and a faint ink blue tint |
  | Starred | A small star mark |

- Items you read in the Unread view stay where they are (greyed) until you press `r` or leave the view, so nothing jumps under your cursor.

**How to check it**
1. Open a feed with many articles. Scroll to the bottom: there's a "Show older items" button and no endless loading. Press it: more appear below, and nothing above moves.
2. Open an article and move on: its title turns grey, and it doesn't vanish from the list.
3. Turn your screen to greyscale (system accessibility setting). You can still tell unread, read, selected and starred apart.

## 7. Reading an article

**What it does**
- The article opens inside slowfeed, using exactly what the publisher put in the feed, restyled consistently: headings, quotes, code, tables, footnotes and images.
- Reading font is Literata by default (Atkinson Hyperlegible as an alternative). Lines are about 65–75 characters long.
- Links inside articles are underlined in the normal text color, never blue.
- If the feed only has a summary, slowfeed shows the summary. It never fetches the rest from the website. **"Open original"** takes you there.
- "Open original" is always present, always in the same place. **Share** sits next to it (section 21).
- A labeled **Mark unread** button and a **Star** button sit in the article's top bar, beside them (sections 8 and 9). The Star button shows a filled star when the article is starred and an outline when not.
- The source is always credited and linked: the feed's name (linking to the publisher's website), the author if the feed names one, and the time.
- Choosing an article in the list (a click, `j` / `k`, or the arrow keys while in the list) shows it in the reading area. `Enter` or `o` opens it to read: the keyboard's place moves into the article, and `j` / `k` then move from article to article; Escape goes back to the list. On a phone-narrow window the article takes the list's place, with a back button named after the list. `j` never loads older items on its own: at the end of the list it stops.
- `v` opens the original in a new tab. `+` / `-` change the text size (the same setting as in Settings).
- Links inside articles open in a new tab (links to a place inside the article, like footnotes, stay in it).
- Footnote links move to the note inside the article (and back), without leaving slowfeed.
- Images load from the publisher's site. Invisible 1×1 "tracking pixels" are removed (any image sized 0 or 1 pixel), so they're never loaded.
- Anything unsafe in the feed's content (scripts, embedded frames, code hidden in styles) is removed before display.
- The next article is loaded in advance so moving to it with `j` is instant.

**How to check it**
1. Open an article from a full-content blog: it reads well, with headings, quotes and images in place.
2. Open one from a summary-only feed: you see the summary and "Open original", which opens the publisher's page in a new tab.
3. Check that links in the text are underlined and not blue.
4. Press `j` repeatedly: each article appears with no visible wait.
5. Press `Enter`, read, press Escape: you're back on the same row in the list. Press `+` and `-`: the text grows and shrinks.

## 8. Read state, marking unread, "mark all as read", undo

**What it does**
- An item counts as read as soon as it's shown in the reading pane, by click or by `j`/`k`.
- `m` marks the current item unread again. A labeled **Mark unread** button in the article's top bar does the same, on desktop and phones.
- **Mark all as read** (`Shift+A`, or a labeled button in the list header, shown when the list has items): happens instantly, no "are you sure?". It affects **only the items shown on screen right now** (every item listed, including pages added with "Show older items"). Items that arrived in the background but aren't displayed yet are never touched.
- **Undo** (`u`, or a visible **Undo**): after an undoable action, a line such as "Marked 23 items as read · Undo" appears in the reserved line at the top of the list (the same spot as "New items", so nothing shifts) and stays until your next undoable action or until you leave the list. After an undo it says "Undone."; there's no undoing an undo. Moving through articles doesn't clear it.
- Undo reverses **the last action only**, of these: mark all as read, mark unread, star/unstar, unsubscribe, delete folder.
- Read state is recorded in both reading modes, so switching modes never loses it.
- Each feed's unread number in the sidebar changes at the same moment.
- If a mark can't be saved (the connection dropped, say), it's taken back and the reserved line says so plainly, such as "The star couldn't be saved." That message takes the Undo's place. A failure never takes back a later action on the same article.

**How to check it**
1. Click an unread item: it turns grey and the feed's unread number drops by one.
2. Press `m`: it's unread again and the number goes back up.
3. Press `Shift+A` in a feed: everything shown turns grey at once. Press `u`: they're unread again.
4. Wait until "New items · press r" appears, then mark all as read *without* pressing `r`. Press `r`: the new items are still unread.

## 9. Star

**What it does**
- One concept: **Star**. `s` (or the **Star** button in the article's top bar) stars or unstars the current item. It can be undone like the other marks (section 8).
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
- It identifies itself clearly as slowfeed.
- If a publisher says "slow down" (HTTP 429), it waits as long as asked.
- Each fetch has a time limit and a size limit.
- If a feed has moved permanently, slowfeed updates its stored address.
- A failing feed is retried less and less often (up to once a day) and never affects other feeds.
- It never visits article pages.
- If a publisher edits an article you've already seen, the text is updated quietly and it stays read.
- The same article published in two different feeds appears in both.

**How to check it**
Most of this is checked by the automatic tests rather than by eye. You can see it working:
1. Leave the app closed for a day, then open it: the feeds you follow have new articles that arrived on their own.
2. When a feed keeps failing, the daily check mentions it (the feed health page comes in V2).

## 12. WebSub (instant updates from publishers who offer it)

*Moved to V2 (23 October 2026): V1 is for the owner alone. Kept here so V2 starts from it. See `docs/decisions/0012-v1-for-one-reader.md`.*

**What it does**
- Some publishers announce new articles the moment they publish, through a service called a "hub" (the standard is called WebSub). When a feed offers this, slowfeed signs up and receives new articles as they're published.
- slowfeed checks that announcements are genuine (each subscription has its own secret).
- Subscriptions are renewed before they expire.
- Regular checking continues, less often, as a backup.

**How to check it**
1. Follow a blog that uses WebSub (we'll pick one together at that milestone).
2. When it publishes, "New items · press r" appears within a few minutes rather than hours.

## 13. Refresh: the view waits for you

**What it does**
- The list on screen changes only when you ask: press `r` or the Refresh button.
- When new items are waiting, one quiet line appears at the top of the list: **"New items · press r"** (on touch screens: **"New items · tap Refresh"**). It shows no number. Its space is always reserved, so nothing shifts when it appears.
- Because fetching already happened in the background, pressing `r` is instant.
- Opening or reloading the app always shows the latest state.
- No pull-to-refresh on phones; there's a labeled Refresh button instead.

**How to check it**
1. Leave the app open. When the "New items" line appears, check the list hasn't moved.
2. Press `r`: new items appear at once, with no spinner.
3. Close and reopen the app: you see everything new without pressing anything.

## 14. Search

**What it does**
- `/` puts you in the search field. A search icon and a "Search options" (sliders) icon sit together.
- The search starts out limited to where you are, shown as a removable chip inside the field, e.g. `[ in: Tech × ]`. Remove the chip to search everything.
- **Search options** panel: scope (here · all feeds · a folder · a feed), unread only, starred only, date range. The panel and the chips always match.
- Titles and article text are always searched together; title matches come first.
- Power-user filters can be typed: `is:unread`, `is:starred`, `feed:name`, `folder:name`, `after:YYYY-MM-DD`, `before:YYYY-MM-DD`. They're suggested as you type and turn into chips.
- Results look and behave like the normal item list, including "mark all as read".
- Matching words are shown in **bold**, never highlighted in color.
- Works for English, other Latin-alphabet languages, and Hindi.
- Tab moves from the field into the options panel; Escape closes search and returns you to where you were.

**How to check it**
1. In a folder, press `/`, type a word you remember from an article. The chip shows the folder; results appear with the word in bold.
2. Remove the chip: results now come from all feeds.
3. Type `is:starred`: it becomes a chip, and only starred items are listed.
4. Open the options panel, pick a date range: a matching chip appears in the field.
5. Search a Hindi word from a Hindi article: that article is found.
6. Press Escape: you're back exactly where you were.

## 15. Folders and managing feeds

**What it does**
- Folders are the only grouping. A feed can be in more than one folder.
- You can rename a feed, choose its folders, and unsubscribe, from an **Edit feed** button in the item list's header when you're viewing one feed. It offers rename, folders as checkboxes, "New folder", and Unsubscribe (undoable).
- Viewing a folder, an **Edit folder** button offers rename and delete.
- You can create, rename and delete folders. Deleting a folder never deletes its feeds.
- Unsubscribing from a feed keeps its starred articles in Starred.

**How to check it**
1. Put a feed in two folders. It appears under both, and its unread count is right in each.
2. Rename a folder: it moves to its new alphabetical position.
3. Delete a folder: its feeds remain (under other folders or the "no folder" group).
4. Unsubscribe from a feed, then undo: it's back with its read history.
5. Star an article, then unsubscribe from its feed: the article is still in Starred.

## 16. OPML import and export

OPML is the standard file format feed readers use to move subscription lists between apps.

**What it does**
- **Import:** from Settings → Your data, or from the empty state. A feed that appears several times in the file becomes one feed in several folders. Feeds you already have are not duplicated. Afterwards, a plain summary says what was added and what couldn't be read.
- **Export:** downloads an OPML file of all your feeds and folders. A feed in several folders appears under each of them.
- Your own OPML file is never stored in the code repository.

**How to check it**
1. Import your OPML file. The summary says how many feeds were added. Your folders appear in the sidebar.
2. Export, then import the export into another feed reader (or back into a fresh slowfeed). Everything is there, with the same folders.

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
- Settings opens in place of the list and reading area; the sidebar stays. **Close settings** or Escape goes back to where you were.
- **Reader controls:** reading font (Literata or Atkinson Hyperlegible), text size (six steps from Smaller to Largest, Medium by default), line width (Narrow, Medium or Wide: about 62, 68 or 75 characters), theme. A sample paragraph shows how articles will look, and changes apply at once.
- **Themes:** "Match this device" by default (off-white or dark, following the system's light/dark setting), or choose off-white, sepia or dark.
- Sections appear once they have something to do: Reading (sort order) since Milestone 7, Your data with Milestone 9.
- **Reading:** newest or oldest first. (Inbox or river mode in V2.)
- **Your data:** OPML import/export, export of starred articles.
- **Sign out.** (Keeping articles and Feed health come in V2.)
- **Status:** which version of slowfeed you're using. When a newer version has been downloaded, it says "A new version is ready" with a **Reload** button. Otherwise new versions are used automatically the next time you open or reload the app, never while you're reading. If a tab left open across an update can't carry on, it says so plainly in the reserved line at the top of the list (where "New items" appears): "slowfeed was updated. Reload to continue." (Milestone 13.)
- Fonts are served by slowfeed itself; nothing is loaded from font services. Other scripts such as Hindi use the fonts already on your device.
- **Shared across your devices:** sort order (and reading mode, in V2). **Per device:** theme, font, text size and line width (a phone and a laptop often want different sizes). `+`/`-` change the same text-size setting.

**How to check it**
1. Switch your computer to dark mode: slowfeed follows. Choose sepia in Settings: it stays sepia regardless of the system.
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
  | `+` / `-` | Text size while reading |
  | `Esc` | Back / close |
  | `?` | Shortcut cheat sheet |

- A permanent, quiet hint says "Press ? for shortcuts" (on screens with a keyboard), in the top-right corner of the window, whether or not the sidebar shows. Clicking it opens the list too.
- The `?` cheat sheet also documents the search filters. Until a shortcut's feature exists, the cheat sheet marks it "coming later", and the key does nothing.
- The keyboard's place is shown by a thick outline in the text color (never ink blue, which only marks your place in slowfeed).
- Shortcuts don't fire while you're typing in a field.

**How to check it**
1. Unplug the mouse (or don't touch it). Using only Tab, Enter and Escape, add a feed, read an article, star it and search. You can always see where the focus is.
2. Try each vim key from the table.
3. Press `?`: the cheat sheet opens; Escape closes it.

## 20. Phones and installing the app

**What it does**
- One column you move through: **Feeds → Items → Article**. The feeds list is the home screen; no hamburger menu.
- Top bar: a back arrow labeled with where it goes (e.g. "‹ Tech") and the screen title. A Refresh button on list screens; search and search-options icons on the feeds and items screens.
- The system back gesture and back button work.
- "Settings" sits at the top of the feeds screen.
- No custom swipes on list items.
- Article toolbar at the bottom, within thumb reach: previous · next · star · share · open original.
- Every tap target is at least 44 pixels.
- Can be added to the home screen on iPhone and Android; it then opens full-screen with its own icon.

**How to check it**
1. On your phone, open the app: you see your feeds. Tap a folder, a feed, an article; the back arrow says where it goes each time.
2. Swipe back from the screen edge: you go back one step.
3. Use "Add to Home Screen". Open it from the icon: no browser bars.

## 21. Sharing

**What it does**
- Only in the article view, next to "Open original".
- On phones: the system share sheet. On desktop: **Copy link**.
- Always shares the publisher's original link, never a slowfeed link.
- No buttons for specific platforms.

**How to check it**
1. On desktop, press Copy link and paste somewhere: it's the publisher's address.
2. On a phone, press Share: your phone's usual share sheet opens with the publisher's link.

## 22. Everyone can read here (accessibility)

**What it does**
- Contrast meets WCAG AA everywhere (an international accessibility standard) and AAA for article text, in all three themes, including grey text.
- Nothing relies on color alone.
- Screen readers find the three panes as named regions, hear which item is selected, and hear changes such as "marked as read". Each article is marked with its language so it's pronounced correctly: the item's language if given, otherwise the feed's; if neither says, it's left unmarked rather than guessed.
- Follows the system's text size, reduced motion, high contrast and light/dark settings.

**How to check it**
1. Zoom the browser to 200%: everything still works and nothing overlaps.
2. Turn on your phone's or computer's screen reader (VoiceOver, TalkBack or NVDA). Move through items: it reads the title and says when things are marked as read.
3. The automatic checks run contrast and accessibility tests on every screen in every theme; a pull request can't pass if they fail.

## 23. Your data: keeping and exporting

**What it does**
- In V1, nothing is removed automatically. Unsubscribing removes that feed's articles and read history (starred articles stay in Starred). Undo brings them back only straight away; after your next action they're gone for good.
- Export of starred articles as a JSON Feed file (a standard, open format other feed tools can read).
- **No backups in V1** (the owner's decision, 23 October 2026). V1 is for the owner alone. Your safety net is your own OPML file (your feeds and folders) and the starred export (your stars). Which articles you've read isn't saved anywhere else. As a last resort, Render keeps its own daily copies of the disk for at least a week, though Render warns they may not bring a database back cleanly.

**Moved to V2:** nightly backups outside Render with a copy before every database structure change; a written, tested guide to moving hosts; and removing unstarred articles a year after slowfeed received them (only after a successful backup, and never letting them come back as new).

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

From DESIGN.md: YouTube player, public reading list page, per-feed reading modes, passkey sign-in, Chinese and Japanese search, multiple users, own domain name.

Moved to V2 on 23 October 2026: backups and moving hosts, river mode, WebSub, the feed health page, the yearly clean-up, the feeds guide page, and keeping a tab that was left open across an update working without a reload.

Never: notifications, badges, streaks, reading stats, infinite scroll, algorithmic ranking, likes or comments, platform share buttons, scraping full articles, decorative effects or animation.
