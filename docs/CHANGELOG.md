# What's changed

A plain-language history of nine turtles (called slowfeed until 24 October 2026), newest first. One short entry per
merged pull request, written for the owner: what changed and what it means,
not how it was done.

## 27 October 2026: Recently read, a tidier sidebar, and how often a feed posts

- **Recently read** in the sidebar, after All: the last 50 articles you opened, the last one first. Just the list: no numbers, no streaks. It needs a connection (decision 0105).
- **Settings › Show in the sidebar:** untick Starred, All, Recently read or Saved searches to keep them out of the sidebar, on all your devices. They still open from their address and their keys.
- **How often a feed posts,** in plain words ("Posts about 3 times a week", "Hasn't posted in 4 months", "Hasn't posted in over a year"), under its name in Edit feed and on the feed health page.
- The database gains one small column for Recently read; nine turtles backs itself up before the change, as always.

## 27 October 2026: Podcasts

- **Podcasts play in nine turtles.** Follow a podcast like any feed. Its episodes show a small headphones icon and their length in the list, and open with a calm player under the title: back 15 seconds, Play, forward 30, the speed (1× to 2×) and a slider with the time played and left (decision 0113).
- The audio always comes straight from the publisher's own file; nine turtles never downloads or keeps it.
- **It keeps playing while you read.** A slim Now playing bar sits at the bottom of the app (above the toolbar on a phone), with Play / Pause, back 15 and Close.
- **Your place is kept** on all your devices: pause on your computer and carry on from your phone. An episode played to its last 30 seconds is marked read.
- **Up Next:** add an episode from its More menu. Up Next shows in the sidebar while it has something; when an episode ends, the next one starts by itself. Move up, Move down and Remove sit in each episode's player, and Remove has an Undo. Nothing on screen moves by itself: an open Up Next list and its sidebar row stay still until you act or go elsewhere. Settings › Show in the sidebar can hide it.
- Your phone's lock screen and headphones can play, pause and skip.
- Signing out stops the episode and forgets this device's places, so the next person on it starts fresh.
- A podcast you already follow shows its episodes as episodes once its feed next changes.
- Offline, an episode's notes are there, and its player says it plays once you're back online.
- The database gains two small tables and a few columns; nine turtles backs itself up before the change, as always.

## 27 October 2026: Fixing a dead feed where you are

- A feed that keeps failing now says so quietly above its own articles: "This feed hasn't worked since 12 October.", with **Find its new address** right there. Edit feed shows the same line, with **Find new address**. Working feeds show nothing new.
- When the site names just one feed, nine turtles asks one plain question, "Use https://… instead?", with **Use it** and **Cancel**, and says the feed keeps its name, folders, articles and stars. Several feeds still show the list to choose from. This works the same on the feed health page.
- As before, nine turtles only looks on the site when you press the button (decision 0106).

## 27 October 2026: Collections

- **Collections:** your own named shelves for articles, such as "To cite" or "Recipes". Put an article on one from its More menu (**Add to collection…**) or with the **L** key; an article can be on several. Taking an article off a collection says so at the foot of the list, with Undo. Stars stay as they are (decision 0108).
- They're listed in the sidebar under Saved searches, A to Z, with a small shelf icon and no numbers. Opening one lists its articles like any list. Its More menu can rename it or delete it; deleting removes the collection, not its articles, and Undo brings it back, with any saved searches limited to it.
- An article on a collection is **kept forever**, like a starred one: the yearly clean-up never removes it, and unsubscribing from its feed keeps it.
- **Search** can look in one collection: type `in:` and its name.
- **Settings › Your data › Export collections** saves them all as a JSON Feed file, each article tagged with its collections. Settings › Show in the sidebar can hide them.
- Without a connection the sidebar still lists them, and opening one says it needs a connection.
- The database gains two small tables; nine turtles backs itself up before the change, as always.

## 27 October 2026: Passkey sign-in

- You can now sign in with your fingerprint, face or device PIN. Add a
  passkey in Settings › Passkeys (it asks for your password first), then
  press **Sign in with a passkey** on the sign-in page, or pick it from the
  email field's suggestions. Every reader can; passwords keep working.
- Each passkey can be renamed, and removed with Undo straight afterwards.
  Removing one never locks you out.
- A new password keeps your passkeys (your choice): after one, look in
  Settings › Passkeys and remove any you don't recognise.
- Passkeys work at app.nineturtles.app; slowfeed.onrender.com doesn't offer
  them.
- One new library, webauthn-rs, checks passkeys (your yes, decision 0109),
  and a new table holds them (structure change 25, backed up first).

## 27 October 2026: New keys, and marking older articles as read

- Space moves the open article down a screen (Shift+Space back up). At the
  end it stops; it never jumps to the next article.
- `n` and `Shift+N` go to the next and previous unread article, passing over
  ones you've read.
- `Shift+O` marks everything older than the chosen article as read, even
  the part of the list that hasn't loaded yet. The list's More menu also has
  "Mark all above as read" and "Mark all below as read". All of them can be
  undone with Undo or `u`.
- `e` folds or unfolds the folder you're in, in the sidebar; `Shift+E` opens
  Edit feed or Edit folder.
- `c` copies the open article's link.
- The `?` list now calls `\` "Full-screen reading (hide sidebar and list)".
- Every key is now written down once, so the `?` list always matches what
  the keys do; an automatic check makes sure of it.

## 27 October 2026: Keys of your own, and a few more keys

- You can now change the keys. Press `?`, then **Change keys…** at the
  foot of the list (or Settings › Keyboard › Change keys…). Choose a key,
  press the new one, and it's saved for your account, so it works on every
  device you sign in on.
- If another shortcut already has that key, nine turtles asks first
  ("Shift+O already marks older as read. Use it here instead?"). Say yes and
  the other one is left with no key. Each changed key has Reset, and
  **Reset all keys** puts everything back.
- Enter, Escape, `?` and the `g` keys stay as they are, so the list can
  always be opened.
- New keys: `Shift+J` / `Shift+K` go to the next / previous feed in the
  sidebar, `Home` / `End` to the first / last article in the list, `g` then
  `f` to Your feeds and `g` then `,` to Settings. (`g` then `r` will open
  Recently read once that's built.)
- Tooltips, menus and the welcome tip show your keys.

## 27 October 2026: Pictures in an article open larger

- A picture an article shows smaller than it really is can now be opened
  larger: the pointer becomes a hand over it, and a click, a tap, Enter or
  Space shows it alone on the dimmed page, as large as fits, with its
  description under it, an X to close and "Open in new tab".
- Escape, the X or a click on the dim closes it, and the keyboard is back on
  the picture. Small pictures and pictures that are links stay as they were.
- By night the opened picture shows at full brightness.

## 27 October 2026: Articles tell trackers less, and pictures load as you reach them

- Links lose their tracking tags (`utm_…`, `fbclid`, `gclid`, `mc_cid` and similar well-known ones): the article's own link, so Open original, Copy link and Share give the clean address, and the links in its text. Everything else in a link stays as the publisher wrote it.
- Pictures from known advertising, analytics and tracking services (Google Analytics, DoubleClick, Facebook's pixel, WordPress's and Mailchimp's counters, FeedBurner and a few more) are no longer shown or loaded. The list is short and kept in nine turtles itself.
- Pictures in an article load only as you scroll near them, so long articles with many pictures open faster.
- Articles still in their feed are refreshed on their next fetch (the original tagged link isn't kept); older ones are cleaned when shown. There was no one-off pass over stored articles (decision 0112).

## 27 October 2026: Add a feed from anywhere

- Share a page to nine turtles and Add a feed opens with its address, its
  feed already found. Nothing is followed until you press Add feed.
- On Android, an installed nine turtles now shows in the share menu. On
  iPhone and iPad, a short Apple Shortcuts shortcut does the same (steps in
  SPEC section 20).
- On a computer, a bookmark does it from any page. Settings › Add from
  anywhere has the bookmark and the shortcut's address, each with Copy.

## 27 October 2026: Connect your own AI assistant

- You can now connect your own AI assistant (Claude, ChatGPT, or any other that speaks MCP) to nine turtles: add the address from Settings › Connected assistants as a connector, then press Connect on nine turtles' own page.
- It can search and list your articles, open one, show your feeds, folders, rules and feeds that aren't working, mark and star, add, rename and file feeds, make folders and rules, unsubscribe, and download your feed list. It can't see your password, email or payments.
- A feed an assistant unsubscribes from is kept for 30 days: bring it back from Settings.
- Assistants that can't show the Connect page can use an assistant key made in Settings.
- Every 15 days an agent checks that assistants can still connect and that nine turtles follows the latest MCP standard.

## 27 October 2026: More room on "Wrong turn?"

- The 404 pages in the app and on the website have more space between
  their parts, and the signature now reads "— Rohit".

## 27 October 2026: Assistants (MCP) added to the plan

- New milestone in the plan: readers will be able to connect their own AI assistant to nine turtles through MCP, an open standard (decision 0111). Not built yet.

## 27 October 2026: "Wrong turn?" for addresses that lead nowhere

- In the app and on the website, an address that leads nowhere now shows
  "Wrong turn?": a small "404 error", eight turtles walking one way and one
  turned the other, and a line from Rohit asking which link brought you
  there. In the app, "Back to your reading" takes you home. Before, the app
  quietly opened Unread.
- The website's footer is now just its links. The walking turtles and "Some
  of us like to read slowly. That's the idea." moved to the end of the About
  page.

## 26 October 2026: The reader comparison, as one page

- The reader comparison is now a single readable web page with one card per idea (what it is, why it might matter, what nine turtles does now, my take), replacing the tables. Research only (`docs/RnD/reader-comparison.html`).

## 26 October 2026: Research: more readers compared

- The reader comparison now also covers Miniflux, NetNewsWire and FreshRSS, next to Feedbin, with a shared "what to look at first" list. Research only; nothing was built (`docs/RnD/reader-comparison.html`).

## 26 October 2026: Research: nine turtles beside Feedbin

- Added research notes comparing nine turtles with Feedbin, another reader with public code: what it has that we lack, small touches worth knowing about, and what it does better. Nothing was built; it is a list to pick from (`docs/RnD/reader-comparison.html`).

## 26 October 2026: Business research saved in the repository

- The business and marketing research from 25 October (the playbook, idea bank, blog post ideas, outreach list and 19 research notes) now lives in `docs/RnD/`, so future agents can find it. Nothing in the app or website changed.
- The owner's own strategy notes, organised, are in `docs/RnD/strategy-notes.md`.

## 26 October 2026: Reading offline

- nine turtles now keeps your **first 200 unread and newest 200 starred
  articles** on each phone and computer, words only, so you can read on a
  plane or a train. Each image is a short line saying it shows once you're
  back online. It's a few megabytes for most readers.
- Without a connection, Unread, Starred, All, feeds and folders show those
  articles, with a quiet line: "Offline. Showing the articles saved on this
  device." Reading, marking and starring work as usual; the marks are sent
  once you're back online, and the latest mark wins.
- Search, adding a feed, Settings and Refresh say plainly that they need a
  connection.
- It's on by default. Settings › Your data › "Keep articles for reading
  offline" switches it off for one device, which deletes its copies.
  **Signing out deletes them too.**
- Each article's read mark and star now remember when they were set
  (structure change 21); nine turtles stores a backup first, as always.

## 26 October 2026: Starter packs on the website

- nineturtles.app/packs/ lists five starter packs: Think more deeply, Do
  focused work, Live slowly, Curious minds, and Newsletters, out of your
  inbox. Each says its blogs are still being chosen, until the owner adds
  them (`website/src/packs/README.md`).
- Once a pack has blogs, it lists each with a line on why, and offers a file
  that adds them all to nine turtles or any other feed reader.
- The footer links to them.

## 26 October 2026: Email me a sign-in link

- The sign-in page has **Email me a sign-in link**: type your email, and a
  link that signs you in arrives. It works once, for 15 minutes, for every
  reader, you included once your email is saved. Passwords keep working.
- Opening the link shows one **Sign in** button, so a mail program checking
  links can't use it up first.
- It's said once ("Check your email"), with the same quiet Send again, and
  the server sends at most one sign-in link a minute and three emails an
  hour to any address.
- The links table was made again to allow the new kind of link (structure
  change 20); nine turtles stores a backup first, as always.

## 26 October 2026: Pause a feed

- Edit feed has a new setting, **Pause this feed**, for a holiday or a noisy week. While it's paused, its new articles still arrive in its own list but already read, so Unread doesn't grow.
- Untick it when you're back and only its newest three articles from the pause come back to Unread.
- Pausing is yours alone; other readers of the same feed see no change.

## 26 October 2026: Bring your stars over

- Settings › Your data › **Import starred articles…** brings your starred articles over from another feed reader: Inoreader, Feedly, Feedbin, The Old Reader, FreshRSS and others, or another nine turtles. Choose the file it exports them in.
- They appear in Starred, read, each with a link to the original and the name of the feed it came from. Stars of feeds you don't follow stay in Starred without adding anything to your sidebar.
- Importing only adds stars, and the same file twice adds nothing new. Each reader can keep up to 10,000 imported articles. Pocket isn't supported, as it saves whole web pages rather than what a feed sent.

## 26 October 2026: Easing unread guilt

- **Let unread go after a while:** in Settings › Reading you can choose 1 week, 2 weeks or 1 month (Never is the default). Unread older than that counts as read: it leaves Unread and the counts, and stays in its feed, All and search. Nothing is deleted.
- **Catch me up:** in Unread's More (…) menu. Everything from before today is marked read at once, with Undo.
- **Unread without numbers:** Settings › Reading › Unread counts: Hide. The sidebar's numbers go; Unread stays.

## 26 October 2026: The feed finder

- A free page on the website, nineturtles.app/feed-finder/: paste a site's
  address and get its feed's address, with a Copy button and the site's
  five newest titles. Anyone can use it, without an account.
- A "Find feed" button to drag to the bookmarks bar opens the finder with
  the page you're on.
- The app does the looking, the same polite way as Add feed: the one page
  you give it, then its feed once. Nothing about who asked is kept.
- Linked from the website's footer, from "New to feeds?", and explained in
  the privacy policy.

## 26 October 2026: Paying for nine turtles, in test mode

- New readers get a **free trial** (14 days, no card needed). You, and everyone who already has an account, stay free for good.
- Settings › **Your plan** shows the trial or plan, a row to choose **Monthly** or **Yearly**, and **Billing and cancelling**, which opens Dodo Payments' own page. Prices are a setting and read "Price to be decided" for now.
- When a trial or plan ends, readers keep reading, starring and exporting everything; they can't add feeds, and their feeds are checked once a day. Deleting an account cancels its plan first.
- It's all in Dodo's **test mode**: no real money. It's off until you add the Dodo settings on Render (`docs/operations/payments.md`).

## 26 October 2026: A tidier website header, footer and home page

- The website's top bar now has the name on the left and How it works,
  Blog and Open the app together on the right. Pricing moved to the footer.
- The footer is centred and compact: two short rows of links, with
  "Questions" now called "FAQ", and the nine turtles at the very end.
- The home page says the same things in fewer words.

## 26 October 2026: Newsletters, part three

- Labels: add a word after a plus sign to your newsletter address when you
  sign up. Each label that gets email is listed in Settings › Newsletters with
  a switch; switched off, its email bounces.
- Unsubscribing from a newsletter's feed now also tells the newsletter to stop
  sending, once Undo has passed, when it offers one-click unsubscribe.
- Each new newsletter email is "opened" once when it arrives, so senders don't
  drop you as a reader who never opens their emails.
- The forwarder at Cloudflare changed again: paste its code into Cloudflare
  once more (docs/operations/newsletters.md, step 2).

## 26 October 2026: nine turtles points to its website, not its code

- When nine turtles checks a feed, the note it leaves for the site now
  points to nineturtles.app instead of the code on GitHub. The starred
  articles download does the same.
- The website's footer no longer ends with "No cookies, no tracking, no
  analytics" (the privacy policy still says so).
- The line under the footer's turtles now reads "Some of us like to read
  slowly. That's the idea."
- The website's top bar is quieter: three places (How it works, Pricing,
  Blog) in plain text, the page you're on underlined, and "Open the app" as
  one solid button. About moves to the footer only; the tour now links
  "New to feeds?".

## 26 October 2026: Newsletters, part two

- Each reader has a private newsletter address in Settings › Newsletters, with
  Copy, and New address (with Undo) for when spam arrives.
- Newsletters sent to it arrive as feeds, one per sender, and each email is an
  article. A newsletter feed is the reader's alone, never shared.
- Unsubscribing from a newsletter's feed keeps its later emails away. Mail to
  an address nobody has bounces. At most 200 emails (and 5 MB of text) a day reach one address.
- The forwarder at Cloudflare now tells nine turtles who each email was for:
  paste its code into Cloudflare again (docs/operations/newsletters.md, step 2).

## 26 October 2026: Nine turtles in the website's footer

- The footer of nineturtles.app now starts with nine small turtles walking
  in single file: seven together and two a few steps behind, over the line
  "Two of us are always a little behind. That's fine."
- The footer no longer links the blog's feed; the Blog page already does,
  and feed readers find it on their own.

## 26 October 2026: Your Readers page shows who's been here

- Each reader on Settings › Readers › All readers now says when they were last here: "Last here today" or "Last here 24 October 2026". Only the day, never the time, and nothing new is recorded: it's the day nine turtles already kept to rest the feeds of readers who've been away.
- Other readers are told, under Account in their Settings, what you can see about them; the privacy policy says so too.

## 26 October 2026: The website no longer talks about the code

- No page of nineturtles.app mentions open source, the code, the MIT
  licence or running your own copy any more, since nine turtles may stop
  being open source.
- The footer loses its "Open the app" and "Source code" links (the top bar
  still has "Open the app"), and its last line now just says there are no
  cookies, tracking or analytics.
- The terms lose their "Open source" section and the privacy policy its
  line about copies people run themselves; both show 26 October as their
  new date.

## 26 October 2026: "Check your email", said once

- After "Forgot your password?" (and after signing up while sign-up is Open), the form gives way to one clear "Check your email": where the link went and how long it works.
- A quiet "Didn't get it?" line under it offers Send again; within a minute of the last link it sends nothing and says to give it a minute.
- Pressing Send link twice now sends one email: nine turtles sends at most one password link to an address each minute (as well as three emails an hour).

## 26 October 2026: Your Readers page, and fair limits

- Settings › Readers › **All readers** opens a page only you see: how many readers, feeds and articles there are, how big the database is, whether backups and email are on, anything that needs a look, and each reader's email, when they joined and how many feeds they follow. Never which feeds, and nothing about what anyone reads.
- Each reader can follow up to **1,000 feeds**. Adding one more says so calmly; an OPML file that would go past it imports nothing.
- Feeds whose readers have all been away for a month are checked **once a day** until one of them comes back, which is kinder to publishers and to the server.

## 26 October 2026: Agents may merge when you've said so in advance

- If you've told an agent in a plan or a session that it may merge the work
  once it's ready, it no longer needs to send a brief and wait for a second
  yes. It merges when the checks are green and the review is dealt with, then
  tells you what went live. Without that permission, the brief and your yes
  are still needed, and only your own words ever count (decision 0009).

## 25 October 2026: The yearly clean-up

- Articles you haven't starred are now removed a year after nine turtles first received them, read or not. Starred articles stay forever.
- It runs each night just after the backup is stored, so anything removed is still in the backups. Nothing qualifies until October 2027.
- A removed article never comes back as new, even while its feed still lists it.

## 25 October 2026: Emails for accounts, and deleting an account

- nine turtles can now send a few short, plain emails, through Brevo or any other email service (`docs/operations/email.md`). Nothing is sent until you add the five email settings in Render.
- With email on, sign-up can be **Open**: anyone can make an account by opening the link emailed to them (within 24 hours). Invite links work as before, without an email.
- **Forgot your password?** on the sign-in page sends a link to choose a new password (it works once, for an hour, and signs out your other devices). It never says whether an email has an account, and sends at most three emails to an address in an hour.
- Every reader can change their email in Settings › Account: a link goes to the new address, and the old one is told.
- Readers (not the owner) can delete their account in Settings › Account: the sheet offers their downloads first, then one "Are you sure?". It can't be undone.
- The emailed links keep their secret part after the `#`, which never reaches a server's log, as invite links now do; checking a password to change an email counts towards the same waits as signing in.
- Saving your own email in Settings › Readers now asks for your password, so a device left signed in can't send your password links somewhere else.
- If you set a new password by email and later can't use email, putting a new `NINE_TURTLES_PASSWORD_HASH` in Render makes it your password again and signs out every device (`docs/operations/owner-password.md`).
- A new password by email also turns off that reader's app password for other feed reader apps. Only plain addresses are accepted (no name or `<…>` around them), and nothing about an address's account shows in how long an answer takes or when "too many" is said.
- Structure change 14 adds a table for the emailed links (nothing already stored changes; a backup is taken first).

## 25 October 2026: Signing in by email, and invite links

- The sign-in page has an Email field above Password. You can leave it empty and sign in with your password alone, as before.
- Settings › Readers (only you see it): save your own email to sign in with, and see everyone with an account and when they joined, never what they read.
- Settings › Sign-up (only you): Closed (the default), Invite link, or Open. An invite link lets anyone you send it to make an account, until you make a new link or close sign-up. Open waits for confirmation emails, which come later.
- Wrong passwords are slowed down for each account on its own, so someone guessing another email never makes you wait. Your email and your password alone each get their own five tries, so nobody can find out which email is yours. nine turtles never says whether an email has an account.
- At most 20 sign-ups can be tried in any hour (a try with an email already taken counts too), and they go one at a time.
- Save your own email in Settings › Readers before you send an invite link; Settings reminds you while you have none. The invite in a link comes after a #, so it never reaches any server's logs.
- The database gains two empty columns for emails and passwords (structure change 13), backed up first as always.

## 25 October 2026: Newsletters, part one

- nine turtles can now read newsletter emails: it works out which newsletter
  sent each one and cleans it for reading (hidden preview text, tracking
  images, tracking parts of links and email layout tables go; pictures,
  links and real tables stay). It's tested on made-up emails built like
  Substack's and Mailchimp's, plain-text ones and Japanese ones.
- The address that receives them is switched off until you set
  `NINE_TURTLES_NEWSLETTER_SECRET`. Even then nothing is kept yet: emails are
  read and passed back to your inbox. Keeping them, and each reader's own
  address, come in part two, after many readers is finished.
- The small forwarder that runs at Cloudflare is in the repository
  (`cloudflare/newsletter-worker/`), with the setup steps in
  `docs/operations/newsletters.md`.

## 25 October 2026: Getting ready for more readers (part two)

- Nothing changes on screen for you.
- The feeds you follow, your names for them, their settings, and your read,
  starred and muted marks are now marked as yours (decision 0086). When
  more readers arrive, each sees only their own, while a feed several of
  them follow is still fetched and stored once.
- Unsubscribing removes only your marks; another reader's copy of the same
  feed stays as it was.
- nine turtles takes a backup automatically just before making this change
  to its database, and a test rehearses restoring that backup.

## 25 October 2026: Getting ready for more readers (part one)

- Nothing changes on screen.
- Your settings, folders, saved searches, rules, signed-in devices and app
  password are now marked as yours, so nine turtles is ready to hold more
  readers, each seeing only their own (decision 0086).
- nine turtles takes a backup automatically just before making this change
  to its database.

## 25 October 2026: Pricing and refunds pages, and Dodo Payments

- The website has two new pages, marked as drafts until prices are set:
  Pricing (nineturtles.app/pricing/) and Refunds and cancelling
  (nineturtles.app/refunds/). Both are linked from every page's footer.
- The terms and privacy policy now name Dodo Payments as the company that
  will take payments and handle sales tax, as you chose.
- A checklist for applying to Dodo Payments is in
  `docs/operations/dodo-application.md`, for you to delete before you apply.

## 25 October 2026: The website's styles refresh with its pages

- Each page now asks for its styles by a fingerprint of their contents, so
  a browser that kept the old styles fetches the new ones straight away.
  Before, a visitor could see the new pages with the old styles (looking
  broken) for up to ten minutes after a change went live.

## 25 October 2026: "New to feeds?" in the welcome

- A fresh nine turtles now has a quiet "New to feeds? Start here" link under its welcome.
- It opens a small sheet that explains what a feed is, links to the website's "New to feeds?" guide, and offers five feeds to start with (none ticked). Tick a few and press "Add chosen feeds".
- The welcome, and the link, disappear once you follow anything.

## 25 October 2026: Tabs left open switch to new versions by themselves

- A tab left open while a new version goes live now notices within a few minutes, or as soon as you come back to it.
- The next time you go to another place, you arrive there in the new version. Nothing changes while you're reading, and it waits until your marks are saved and any Undo is done.

## 25 October 2026: Nightly backups

- nine turtles now backs itself up every night: a complete copy of your feeds, articles, read marks and stars goes to storage outside Render (Cloudflare R2 to start with, or any S3-compatible storage).
- It also stores a copy just before any update changes the database's structure, and won't change anything if that copy fails.
- Kept: the last 30 nights, one copy a month for a year, and the last 10 taken before an update.
- Bringing a copy back, or moving to another host, is written down and tested (`docs/operations/backups.md`, `docs/operations/moving-hosts.md`).
- Backups start once you add the storage settings in Render; until then the diagnostics page says "backups are off".

## 25 October 2026: An automatic health check

- Every 15 minutes, GitHub checks that nine turtles is answering. If it isn't
  (five tries, a minute apart, so a deploy never counts), GitHub emails you.
  No outside service, nothing to pay (`docs/operations/health-check.md`).

## 25 October 2026: A fuller website

- nineturtles.app now has the pages a new visitor looks for: a home page
  with pictures of the app by day and by night, a tour of everything it
  does, "New to feeds?" for people who've never used a feed reader,
  questions and answers, about, contact (hello@nineturtles.app) and
  accessibility.
- A blog, with four first posts and its own feed at
  nineturtles.app/blog/feed.xml, so it can be followed in nine turtles.
- A privacy policy and terms, clearly marked as drafts until you choose a
  payment company and an email service. There's no pricing page, since
  prices aren't decided.
- A top bar with the website's places and a footer listing every page.
  Addresses that don't exist show a calm "This page isn't here".
- The website's check now also makes sure every link and picture inside it
  leads somewhere real.

## 25 October 2026: Saved searches

- A search can now be saved: search, then choose **Save search…** in the
  list's More (…) menu and give it a name.
- Saved searches appear in the sidebar under **Saved searches**, right under
  Unread, Starred and All. Opening one runs the search again.
- **Edit saved search…** renames one, or saves the changes you made to its
  search; **Delete** removes only the search, with Undo.

## 25 October 2026: Rules and mutes

- Settings has a new **Rules** group: "when a new article matches this, do that". A rule looks for a word or phrase (in the title, or anywhere in the text), an author, or both, in all feeds, a folder or one feed, and **mutes**, **stars** or **marks as read** what matches.
- Muted articles are kept, never deleted: they skip every list and count as read, search still finds them (marked "Muted"), and **Settings › Rules › Muted articles** lists them with Unmute.
- A new rule asks once before touching articles already here ("Also mute the 37 unread articles that match?"), with Undo. Each rule has a switch to pause it; Delete has Undo.
- Edit feed has a shortcut: **Add a rule for this feed…**.

## 25 October 2026: Settings for each feed

- Edit feed has a new "Settings" group for that one feed:
  - **Reading mode: Inbox or River.** A river feed's articles flow past: they
    skip Unread and the feed shows no count, while your other feeds stay in
    inbox mode. Handy for busy news sites.
  - **Check for new articles: Automatic, Hourly or Daily.** Hourly and Daily
    ask a chatty feed for news no more often than that.
  - **Open articles on the website.** For feeds that share only a summary:
    pressing Enter on an article (or tapping it on a phone) opens the
    publisher's page in a new tab instead.
- Every feed starts as it was, so nothing changes until you choose. The
  database gained three small columns; nothing you have was touched.

## 25 October 2026: Older items load as you scroll

- The bold blue "Show older items" button is gone. When you reach the bottom of a list, the next 50 articles load by themselves, with a small grey "Loading…" while they arrive. Keyboard and screen-reader users still get a quiet "Show older items" button when they Tab to it.
- The end of a list now says "You're all caught up.", centred under the last article.

## 25 October 2026: Tidy many feeds at once

- Settings › Feeds has a new page, **Your feeds**: every feed you follow,
  with when it last posted and which folders it's in.
- **Show: Quiet for 6 months / Quiet for a year** lists only the feeds that
  have gone silent, so you can let them go.
- **Edit** lets you tick several feeds, then **Move to…** one folder (or a
  new one) or **Unsubscribe** from them all at once. One **Undo** reverses
  the whole thing.
- Nothing you have changed: the database is the same.

## 25 October 2026: The logo, tidied

- No turtle in the logo is cut off at the edges any more.
- The logo and the name "nine turtles" are in proportion everywhere: the name is semibold and the logo a touch taller than its letters. On the website the name is a little bigger.
- The browser tab shows a single turtle, which stays clear at that tiny size. The home-screen icon keeps the nine, with a little more room around them.

## 25 October 2026: Marks survive a new version going live

- Marking an article read (or starring it) while nine turtles was restarting for a new version used to fail at once, with a message that stayed until you reloaded. Now it quietly tries again for about a minute, so that moment loses nothing.
- If a mark still can't be saved, the message has a **Try again** button, and it goes away by itself as soon as a later mark is saved.
- While a mark is waiting to try again, opening lists and feeds no longer waits for it.

## 25 October 2026: A quieter video box

- The line under a YouTube video's Play box ("Plays in YouTube's own
  player. Nothing loads until you press Play.") is gone. Nothing changed
  in how videos play: still nothing loads until you press Play.

## 25 October 2026: The plan shows what's live in V2

- `docs/PLAN.md` now has a "V2 so far" table: river mode, WebSub, YouTube
  videos, syncing with other apps and the feed health page are live;
  backups, the yearly clean-up, the feeds guide page and
  keeping old tabs working haven't started.
- The YouTube decision is now numbered 0072, because river mode also had
  0068 (and the feed health page takes 0071).

## 25 October 2026: The turtles beside the name

- The nine turtles now stand before the name at the top of the sidebar (on a computer and a phone), above it on the sign-in page, and in the website's top bar, so you can see the logo on a phone too.

## 25 October 2026: Reeder and NetNewsWire can sync with nine turtles

- nine turtles can now be the sync service for other feed readers, such as
  Reeder and NetNewsWire: they show your feeds, folders and articles, and
  read, unread and starred stay in step both ways. Following, unfollowing
  and folders made in the app reach nine turtles too.
- Apps sign in with an app password you make in Settings › Other apps,
  never your own password. It's shown once; you can make a new one or turn
  it off at any time, which signs the apps out.
- A feed unfollowed from an app can be brought back with its articles by
  following it again from the app within ten minutes.

## 25 October 2026: River mode

- Settings › Reading has a new choice, **Reading mode: Inbox · River**.
  Inbox is how nine turtles has always worked. River lets everything flow
  past: no Unread list, no numbers beside your feeds, no grey "read" titles
  and no "Mark all as read". The app opens on All.
- nine turtles still notes quietly what you've read, so switching back to
  Inbox shows it all as it was.
- The choice is the same on all your devices.

## 25 October 2026: The feed health page

- Settings has a new **Feeds** group with **Feed health**. It lists the
  feeds that have stopped working, worst first, and says what went wrong in
  plain words ("Not found for 8 days. The site says the feed isn't there
  any more. It may have moved.").
- Each one has **Retry** (check it again now), **Find new address** (look
  on the feed's site for where it went, then move it there, keeping its
  articles, stars and folders) and **Unsubscribe** (with Undo).
- When nothing is wrong, it says "All feeds are working."

## 25 October 2026: YouTube videos play in the app

- Follow a YouTube channel and its videos now play inside nine turtles, in
  YouTube's own player, so the views still count for the channel.
- Nothing is loaded from YouTube until you press Play: skimming past a
  video tells YouTube nothing. The player is YouTube's privacy-enhanced one.
- A video's description from the feed is shown as its text.
- A YouTube video embedded in a blog post, which used to vanish, now leaves
  a "Watch the video on YouTube" link in its place.

## 25 October 2026: New posts arrive within minutes from blogs that offer it

- Some publishers announce new posts the moment they publish, through a
  service called a "hub" (the standard is WebSub). nine turtles now signs up
  with these hubs, so "New items · press r" appears within minutes instead
  of hours. Most blogs on WordPress.com and Blogger, and YouTube channel
  feeds, work this way.
- Every announcement is checked with a secret only nine turtles and the hub
  know, so nobody can slip in fake articles.
- Regular checking carries on for these feeds too, at most twice a day, in
  case an announcement goes missing.
- Nothing on screen changed, and nothing you have was touched: the database
  only gained a new table for the hubs.

## 25 October 2026: nine turtles has moved in

- The website is live at nineturtles.app, and the app is at
  app.nineturtles.app. The documents now use the new addresses.

## 25 October 2026: A logo of nine turtles

- nine turtles has a logo: nine small turtles seen from the side, in three rows of three. It is the icon on your phone's home screen and in the browser tab of the app and the website, dark on white by day and light on near-black by night.
- The drawings are kept in `docs/logo/`.

## 25 October 2026: The domain guide, as a move

- The website and domain guide now starts from where you are: nineturtles.app
  on Cloudflare, leading to the app. It moves the app to app.nineturtles.app
  first, then hands nineturtles.app to the website, so the app is never
  unreachable.

## 25 October 2026: A website at nineturtles.app

- nine turtles now has a website, a short page saying what it is, with an
  "Open the app" link. It lives in the new `website/` folder, is built with
  Eleventy and is published to GitHub Pages whenever a change to it is
  merged.
- Once you've bought nineturtles.app and followed
  `docs/operations/website-and-domain.md`, the website is at
  nineturtles.app and the app at app.nineturtles.app. The old address keeps
  working.
- A pull request that changes only the website skips the app's slow checks,
  so it's ready sooner.

## 25 October 2026: Pull requests are ready to merge sooner

- The automatic checks now run in four parts at the same time, on separate
  computers, instead of one after another. A typical pull request is ready
  in about three minutes instead of five.
- A pull request that changes only documents skips the slow checks and the
  image build, and is ready in under a minute.
- Changelog entries are now written as small separate files in
  `docs/changes/`, so pull requests made at the same time no longer clash
  over the top of the changelog and have to run their checks again.
- Nothing in the app itself changed.

## 25 October 2026: "Time to read something beautiful."

- With no article open, the reading area now says "Time to read something
  beautiful." instead of "No article open".
- Button tooltips now show their key as a capital letter, "Star (S)",
  matching how the shortcut list and menus draw keys.
- At the foot of the sidebar, Shortcuts is now "Keys" with a keyboard icon,
  so it no longer reads as one phrase with Add feed. In the narrowest sidebar,
  "Add feed" is no longer cut off.

## 25 October 2026: A Plain theme and System serif, from rohit.onl

- A second theme, **Plain**, in Settings and the Aa panel: your site's bare,
  plain-HTML look. Black on white, and article links in the old web's blue
  (purple once visited), underlined. By night, white on near-black.
- A third reading font, **System serif**: the same font as rohit.onl, your
  device's own serif (New York on your Mac and iPhone). Atkinson Hyperlegible
  now shows as "Atkinson" so the three fit on one row.
- Two browser checks that sometimes failed on a busy computer now wait for
  the save they check, so the checks on main are green again.

## 25 October 2026: Shortcuts that are easier to find

- The bottom of the sidebar now says **Shortcuts** in words, not just a
  keyboard picture.
- The shortcut list is grouped by what you're doing (Reading, Getting
  around, Tidying up, Anywhere) and has a search box: press `?` and type
  "star" to find how to star.
- The first time you see "No article open", a quiet line under it says
  "Press J to open the first article, or ? for every shortcut." Once you
  open an article it never shows again.

## 25 October 2026: Pull request pictures look like the app in use

- The screenshots on each pull request now show a small made-up library of
  blogs (Field Notes, The Margins, Small Kitchen and others, two of them in
  folders) instead of test names like "Blog refresh-desktop-0-…". Nothing
  in the app itself changed.

## 25 October 2026: The documents follow Apple Books, and are shorter

- DESIGN.md now says plainly that Apple Books is the one design reference,
  after the floors, and a few principles that the redesign had outgrown
  were brought up to date (decision 0059).
- Each screen is described once, in SPEC.md, so DESIGN.md is about half as
  long. ENGINEERING.md no longer repeats AGENTS.md's working agreements.
- The 31 step-by-step redesign decision notes were folded into one summary
  (decision 0061). Nothing changes in the app.

## 25 October 2026: A bookmark in every article, search tucked away on a phone

- Leave a long article halfway and it now opens where you stopped, even
  after closing the app. Finish it and it starts at the top again. Each
  device remembers its own places.
- On a phone, the search box under a list's title is now a magnifier
  button beside the More (…) button, so one more article fits on the
  screen. Tap it to search.

## 24 October 2026: Less space after an article, Show older items as a list row

- After an article ends there's now a short gap and the small end mark, not
  a third of a screen of blank space.
- "Show older items" is the list's last row, lined up with the titles, with
  the rows' thin line above it and its words in the accent color, instead of
  a boxed button on the left.

## 24 October 2026: The name nine turtles everywhere

- Behind the scenes the old name slowfeed is gone too: the GitHub project,
  the package Render runs, the program and its settings, the database file.
  You stay signed in and keep your settings; the old setting names on Render
  still work until you rename them (decision 0058).
- Render's web address and disk keep the old name, because Render can't
  rename them.

## 24 October 2026: Panes you can hide and resize, clearer list titles

- The sidebar's button sits at the right end of the sidebar's top line, and
  the article list has its own at the right end of its top line. `]` hides the
  list, `\` hides both; with both hidden, one button brings both back.
- Drag the line between panes to make them wider or narrower; double-click to
  reset.
- The sidebar is more compact with a mouse, list titles are larger and the
  line under them quieter, the text size buttons read A− and A+, and a sort
  icon sits beside Sort order.

## 24 October 2026: nine turtles, with one theme

- The app is now called **nine turtles**: on the sign-in page, in the
  sidebar, in the browser tab, on your phone's home screen and in the files
  you export. Behind the scenes nothing you rely on changes: you stay signed
  in, your settings stay, and Render needs no change (decision 0056).
- There is one theme now, Original: white by day, near-black by night. The
  Light, Dark and Match device switch stays. Quiet, Paper, Bold, Calm and
  Focus are gone, and so are the theme tiles in Settings and the Aa panel. If
  you had picked one of them, you get Original in the same light or dark.
- The place you're on is marked by a plain grey background, with no blue,
  and starred articles show a light green star (decision 0057).

## 24 October 2026: Closer to Apple Books, batch 7

- With no article open, the reading pane now says so in one quiet grey line
  in its middle, instead of being blank (decision 0053).
- Picture captions are smaller and sit closer to their picture, so they no
  longer read like a paragraph; they stay as easy to read as the text.
- In the Paper theme by day, the selected row is a warm grey that matches
  the page, instead of a cool slate.
- On a computer, a faint line now runs where the sidebar meets the list and
  where the list meets the article, as in Apple Books on a Mac.
- On a phone, the unread dot sits a little in from the screen's edge, and
  the list's titles, its heading and its search field line up 28px in.
- The keyboard button at the sidebar's foot is shaded while the shortcut
  list is open.
- With the search options open in a narrow list or on a phone, the number
  of results now shows at the menu's foot instead of hiding under it
  (decision 0054).
- On a phone, Add a feed, Edit feed and Edit folder now look like an iPhone
  sheet: a thin dimmed strip above, rounded top corners, and their groups
  as cards on a soft grey ground (decision 0055).
- Text size is one flat "A | Medium | A" control, so it no longer looks like
  two things are chosen; the chosen theme's ring now has a clear gap; the
  sample paragraph sits inside the Look and feel group.
- A field you're typing in has a softer ring, still easy to see in every
  theme. Shortcuts show ⇧A and capital letters, as a Mac does.
  "Import an OPML file…" is now an underlined link that lines up with the
  heading.

## 24 October 2026: Calmer night pictures, one search field, one phone sheet

- Articles: pictures are dimmed a little in the night themes so they no
  longer glare; captions are smaller and softer; tables line up with the
  text; Open original now sits with Aa, Star and More at the top right; the
  line naming the publisher is slightly larger (decision 0050).
- The list's search and the sidebar's "Find a feed or folder" are now the
  same slim, faintly filled field: shorter with a mouse, a full finger's
  height on a phone (decision 0051).
- The selected row's tint is made from each theme's own pane, so it's a
  touch softer, and the ring round a row shows only when you use the
  keyboard, never after a tap on a phone.
- A long source name's "…" now sits right before the "·", as on every other
  row, and the sidebar scrolls to show where you are when you move.
- On a phone, Add a feed, Edit feed, Edit folder, Settings and the shortcut
  list now look and close the same way: an X at the top right, and the main
  button full width at the bottom. Unsubscribe sits in its own box well
  above Save, and Undo still follows it. By night, sheets, menus and the
  note at the bottom of the list sit on a slightly lighter grey than the
  page. Settings shows the six themes three to a row on a phone, and text
  size looks like the other controls. The shortcut list's key caps look like
  keys, and a fresh slowfeed on a phone shows one heading (decision 0052).

## 24 October 2026: A quieter article title, one-line rows, one close rule

- Opening an article with the keyboard no longer draws a box round its
  title. Screen readers still start reading there, and the next Tab lands
  on a link or button, which shows its ring as always.
- The title has a little more room before the line naming the publisher,
  and its letters are set slightly less tight.
- On a phone, the first article's toolbar no longer has a gap at the left:
  Previous stays in its place, faded, and does nothing.
- In the article list, the line under each title (source, time, star) is
  always one line: a long source name ends in "…", and the date and star
  never wrap onto a line of their own. Its numbers no longer look spaced out.
- Search chips say "Unread", "Starred" or "After 1 Oct 2026", as the
  options menu does; the last "Search in" row reads "Other feed or
  folder ›". The Undo note sits in its own band at the foot of the list, so
  it never covers a row.
- Sign-in is one centred column with the button just under the field, at
  the same phone margin as every other screen. On a first visit the welcome
  is all centred, fills the room beside the sidebar (no empty list beside
  it), and stays still when the Add a feed sheet opens over it (decision 0048).
- When a site offers several feeds, Add a feed now shows them as a list
  with a round mark on each, filled with a dot on the chosen one, and Add
  feed adds that one. Before, which one was meant showed only as a faint
  tint.
- Sheets close one way: those you save (Add a feed, Edit feed, Edit
  folder) have Cancel and no X; those you only look at (Settings, the
  shortcut list) have an X. On a phone, Edit feed and Edit folder lose
  their X, and their form starts closer to the title.
- The shortcut list fills the screen on a phone, and on a computer it
  fits an ordinary window without scrolling.
- On a phone, the Settings preview lines up with the groups under it, and
  a list row's keyboard ring no longer touches the unread dot.

## 24 October 2026: Apple Books' six themes, by day and by night

- The eleven trial themes are replaced by Apple Books' six: Original (the
  new default), Quiet, Paper, Bold, Calm and Focus. Each has a day and a
  night version.
- A new Appearance choice, in Settings › Look and feel and the Aa panel:
  Light, Dark or Match device (the default), which follows your device and
  switches with it while slowfeed is open.
- Bold also makes the article text heavier, for easier reading, with an
  extra-bold font so bold words and headings still stand out.
- A theme you'd already chosen is kept as its nearest new one (sepia
  becomes Calm by day, dark becomes Calm by night, and so on).

## 24 October 2026: One top line, one left edge, steady phone screens

- On a computer, the three panes' top lines are now the same height, so
  the sidebar button, the wordmark, the list's title and the article's
  tools sit on one line, and the faint lines under them meet. A keyboard
  ring on a toolbar button no longer touches the top of the window.
- In the sidebar every name starts at one left edge, the find field's
  icon lines up with the others, and a folder's feeds sit a step further
  in. The place you're in also shows its icon in the accent.
- On a phone the back button stays in the same place on every screen,
  every screen keeps one 20px margin (Settings, Add feed, Edit feed, Edit
  folder and sign-in included), and a folder row has one chevron: its
  feeds are listed under it.

## 24 October 2026: Quiet endings and blank paper in the reading pane

- A summary-only article's closing note now reads "Read the full article ›"
  (the publisher is already named under the title) and keeps the link
  whole wherever it fits, so no word is left stranded; with very large
  text on a small phone it wraps evenly instead of running off the screen.
  Its underline is finer and softer, but still clear enough (3 : 1) to
  show it's a link.
- Long article titles wrap into even lines instead of a long line over a
  short one.
- On a laptop-sized window the text has wider margins (at least 56px each
  side).
- With no article open, the reading pane is simply blank paper, as in
  Apple Books. Screen readers still hear "No article open."

## 24 October 2026: Controls that say what they are

- Text size in Settings and the Aa panel is now a clear stepper: two round
  buttons, a small A and a large A, with the size's name between them in
  plain words, so it no longer looks like a switch with nothing chosen.
- The chosen theme has one ring and a bold name, without the extra tick.
- Edit feed's folders end in small square tick boxes (a feed can be in
  several), and each row is as tall as the fields above it.
- The main button (Sign in, Save, Add feed) no longer turns paler under the
  pointer, so it never looks switched off.
- On a first visit, "Import an OPML file…" sits right under the address
  field, as the other way in.
- The shortcut list shows a true minus sign for smaller text.

## 24 October 2026: Toward Apple Books, batch 3

- The article's bars are solid in the page's color, so text no longer shows
  faintly through them; a thin line appears under the top bar only once
  you scroll, and the phone's bottom bar has a thin line along its top. No
  odd-colored strip beside the scrollbar.
- A summary-only article ends with a small centred note under the closing
  line, linking the full article. Titles use the text's full width, and
  paragraphs no longer leave visibly short lines.
- Search results show the title, then the matching text (up to two lines),
  then the source and time.
- With no article open, the reading area shows just "No article open."
- Sheets and Settings speak in one voice: sheet titles are in the same serif
  as every other title, Cancel is a quiet button with room above it, and a
  refused field shows one line, not a red edge inside a ring. Edit feed's
  folders show an empty ring or a tick, so even one folder is clear, and
  "New folder…" is the list's last row. The shortcut list fits a laptop
  window and its title isn't ringed. In Settings the sample text sits on the
  page, rows that act end in a small mark (› or a download arrow; Sign out a
  door, not red, since it removes nothing), the text size reads A | Medium |
  A, chosen choices are raised without an edge, and dark themes' groups stand
  off the page.
- The list and sidebar line up: the unread dot sits in its own margin,
  every title starts under the list's title and search, the row lines end
  with the selection, the list's title stays on one line, counts form one
  column with folder arrows before their names, only the list's search is
  filled at rest, there's no "Press ? for shortcuts" hint, a first visit
  shows only the welcome, dark themes select with a warm lift instead of a
  blue tint, and a phone's feeds screen has chevrons and no stale
  selection (decision 0041).

## 24 October 2026: Toward Apple Books

- An **Aa** button on every article opens a small reading panel, as in
  Apple Books: text size, theme, font and line width, all applied at once.
- The article's tools and the list's Refresh are quiet icons; Mark all as
  read and the sort order live in a small More (…) menu.
- The interface uses your device's own font (San Francisco on a Mac or
  iPhone), with larger, phone-sized text on touch screens.
- Thin lines separate the list's rows, and the star follows the date.
- Articles read a little tighter and more like a book.
- Add a feed, Edit feed and Edit folder share one shape: Cancel and the
  main action together at the bottom, Unsubscribe and Delete in red words.
- Search results show a line of text around what matched, and an × clears
  the field.
- A first visit is welcomed in the reading area, not squeezed into the list.
- Where you are looks the same in the sidebar and the list: a soft, rounded
  pill tinted with the theme's accent, with no bar at the edge. The
  keyboard's ring sits inside it, and unread articles get a small accent
  dot. Searched words share one quiet highlight, and rows breathe a little
  more evenly.
- Fewer, steadier toolbars: the article's icons keep to the pane's edges
  (Open original; Aa, Star and a More menu with Copy link and Mark unread),
  the list's title has its line to itself with Edit and Refresh in its More
  menu, and text fades under a see-through top bar. On a phone the back
  button names the list and the bottom bar has five icons. The article's
  title, headings and byline are set more like a book, and a summary-only
  article ends with a line linking the full article on the publisher's site.
- Settings looks like Apple Books' settings: one centred column of grouped
  lists, each row its name on the left and its control on the right. Themes
  are "Aa" tiles in their own colors (all eleven kept), ticked when chosen;
  text size is a small A and a large A. Import and export are plain rows.
- Sheets open a little above the middle and grow with what's in them, over a
  lighter dim. Unsubscribe and Delete sit at the bottom left in red, Cancel
  and Save at the right. Fields have a thin edge; problems are red words with
  a warning mark. Search options are a menu with checkmarks, and the
  shortcut list fades at its foot instead of looking cut off.

## 24 October 2026: Calmer selection, one search style, tidier edges

- The selected article no longer wears three marks at once: while you
  move with the keyboard, a soft outline takes the place of the fill.
- The selection in Off-white is a warm tone instead of a cool grey.
- The sidebar's find field and the list's search box now look the same.
- Unread counts line up in one column, header lines meet at one height,
  and focus outlines are never cut off.
- Add a feed has a Cancel button; sheets stay put when a message appears;
  Unsubscribe and Delete are proper buttons under what they do.
- The Undo note always sits at the foot of the list, and a finished list
  ends with "That's everything."

## 24 October 2026: Eight more themes

- Settings now offers eleven themes. New light ones: Porcelain (pure white),
  Linen (warm cream, green accent), Mist (cool grey-blue) and Sage (soft
  green). New dark ones: Graphite (neutral), Night (warm, amber accent),
  Midnight (deep blue) and Black (true black, kind to OLED phones).
- Each has its own "where you are" color, and every one passes the same
  contrast checks as the first three. Remove any you don't like later.

## 24 October 2026: Sheets, a search popover and a tidier phone

- Adding a feed, and editing a feed or a folder, now open as a small card
  over the list you were on, so you never lose your place. Cancel, Escape
  or a click on the dimmed page closes them.
- Search options float in a small popover instead of pushing the list
  down, with simple choices for dates: Any time, Past week, Past month or
  Custom.
- A long feed name stays on one line at the top of the list, ending in
  "…", so the search box never jumps. The search box just says "Search".
- On a phone, the four theme pictures sit in one row, the reading fonts sit
  side by side, and the article's bottom bar keeps clear of the home
  indicator.
- In the dark theme, a chosen setting is now lighter than its track, so it
  looks chosen rather than pressed in.

## 24 October 2026: A cleaner "where you are"

- The selected article and the selected sidebar place now look the same: a
  soft fill and a short ink blue bar right at the pane's left edge.
- The thin grey box round the selected article is gone. When you use the
  keyboard, it gets the same clear outline as everything else, and the blue
  bar stays outside it.

## 24 October 2026: Lighter, calmer type

- Titles and headings use Literata's semibold instead of its bold, at a
  slightly smaller size, so the page reads like a book rather than a
  headline. Fonts stay the same size to download.
- The main button of a form is a step softer than black.
- A focused field shows one clean line instead of a ring around its edge.
- On a phone, article text is a little smaller, so lines hold about 40
  characters, and the bottom bar says "Original" so every word fits.

## 24 October 2026: Clearer problems, quieter search, centred pages

- A wrong password or an address without a feed now shows its message right
  under the field, with a small warning mark, and the field is marked too.
  "No feed here" also says what to try next.
- At rest, the search box says "Search Tech" instead of repeating the list's
  title as a chip; the chip appears once you're in the search.
- "Edit feed" and "Edit folder" are a pencil icon beside the list's title.
- Settings, Add a feed, Edit feed and Edit folder sit in a column centred in
  the page; Unsubscribe and Delete folder sit apart below a faint line.
- Dark theme: the sidebar stands a little further apart, and the selected
  row's tint is warm instead of blue-grey.

## 24 October 2026: Tidier search, and articles that end

- The search box stays on one line; its options panel has smaller, matching
  controls and a list with its own arrow.
- The number of results sits at the end of the "Mark all as read" line.
- "No article open." waits in the middle of the reading area.
- An article's title comes first, with who wrote it, where and when in a
  line under it, and a slightly lighter title size.
- Every article ends with a short centred line and room below it.

## 24 October 2026: Calmer lists and matching pages

- "Where you are" looks the same in the sidebar and the list: a soft rounded
  tint with a short blue mark at its left.
- Unread articles have a small dot before their title.
- Undo and "New items" appear in a small note at the bottom of the list,
  instead of an empty line kept free at the top.
- A faint line appears under a pane's top line once you scroll.
- Settings, Add a feed, Edit feed and Edit folder share the same top line:
  a serif title and an X to close.
- In one feed's own list, rows no longer repeat the feed's name.

## 24 October 2026: Icons where you'd expect them, and a tidier Settings

- Settings is a cog and the shortcut list a keyboard icon at the foot of the
  sidebar; the shortcut list and Settings close with an X.
- Settings is laid out like a system settings window: grouped cards, one
  setting per row, themes shown as small pictures of the app.
- The article's copy link, star and mark unread are icons on the right of its
  top line; "Open original" stays in words on the left. The sidebar's views
  have small icons too.
- The shortcut list is grouped into four short sections in two columns.
- Search says how many results it found, its options button sits inside the
  box, and Refresh hides while searching.

## 24 October 2026: A clearer, calmer look

- Each kind of text now has its own size, weight and ink, so the list's
  title, article titles, sidebar names and small details are easy to tell
  apart. The three columns have more distinct tones.
- The selected article has a thin ink blue bar instead of a heavy black box,
  and stays in full ink while you read it.
- The empty band above every list is gone; the list's title, the sidebar
  button and the article's tools share one top line that never scrolls.
- Settings and "Press ? for shortcuts" moved to the bottom of the sidebar,
  beside Add feed. Search matches are underlined.

## 24 October 2026: The window no longer slides away when you scroll

- Scrolling a long list (or the article) used to move the whole page,
  leaving the three columns as a thin strip at the top and blank space
  below. Now the window stays still and only the column under your
  pointer scrolls. A browser test scrolls a 60-article list to keep it so.

## 23 October 2026: A steadier toolbar on phones

- On a phone, the toolbar under an article keeps its five icons in one
  straight line, even when "Open original" needs two lines.

## 23 October 2026: A tidier shortcut list

- The `?` list of keyboard shortcuts shows each press as its own key, so
  "go to Unread" reads as g, then u. Each key sits close to what it does,
  and the list has a thin edge so it stands out in the dark theme.
- The tick boxes for a feed's folders are the same size as the ones in
  search options.
- When a feed's name is long, "Edit feed" moves under it and lines up with
  the buttons below.

## 23 October 2026: A centred page, and clearer back arrows

- On a wide screen the article now sits in the middle of the reading area,
  like a page in a book, with Open original, Copy link, Star and Mark unread
  lined up above its first line.
- On a phone, the back arrow at the top is a small arrow icon beside where
  it goes, and screen readers hear "Back to Feeds" instead of a stray
  symbol.

## 23 October 2026: Settings as tiles, and quieter empty pages

- Settings' choices (sort order, theme, font, text size, line width) are
  tiles you click or tap; the chosen one is filled in. Theme tiles show a
  little disc of each color, and each font's name is written in that font.
- Keys look like small keys, in the shortcuts list and in "Press ? for
  shortcuts".
- With no article open, the reading area says so quietly in its middle.
- The sign-in page has one line under the name: "A quiet place to read."
- On a phone, the bar above the page takes your chosen theme's color.

## 23 October 2026: Removing build leftovers added by mistake

- The previous change accidentally included a folder of temporary build
  files (`server/target-r2`, about 800 MB, made by the agent while
  testing). They held nothing secret, only compiled copies of slowfeed's
  own public code, but they don't belong in the repository. This removes
  them and tells git and the image build to ignore any such folder from now
  on. The app itself was not affected.

## 23 October 2026: Calmer buttons and a tidier search box

- Buttons no longer sit in heavy black boxes. Toolbar actions (Refresh,
  Mark all as read, Edit feed, Open original, Copy link, Star, Mark unread)
  are a word with a small icon; each form's main button (Sign in, Add feed,
  Save) is filled in; text boxes have a softer edge.
- The search field stays one line tall when it shows where you're
  searching (`in: Tech`); long names are shortened with "…".
- When a screen opens, its title shows the keyboard's place as a short bar
  beside it instead of a box around it; a selected row gets a whole outline
  instead of two stray lines.
- Rows and buttons deepen a little under the mouse pointer.

## 23 October 2026: The final V1 pass (Milestone 14)

- Settings → Your data has **Export starred articles**: a JSON Feed file
  (a standard format other feed readers open) with every starred article,
  its text, its original link and the feed it came from. With your OPML
  file, it's your safety net.
- Screen readers now hear "Marked as read" when you open an article.
- A speed check for the export, and a test that a screen reader finds the
  three panes and the headings. V1 is built; what's left is your own
  final run through SPEC's "How to check it" steps, with a screen reader.

## 23 October 2026: Search (Milestone 10)

- Press `/` (or use the field above the list) to search every article's
  title and text. Matching words show in bold; titles that contain your
  words come first.
- The search starts where you are, shown as a chip like `in: Tech`; remove
  it to search everything. Typed filters (`is:unread`, `is:starred`,
  `feed:name`, `folder:name`, `after:2026-01-31`, `before:...`) are
  suggested as you type and become chips. The sliders button opens Search
  options, which shows and changes the same things.
- Results work like any list, "Mark all as read" included. Escape takes you
  back to where you were.
- Hindi words are found whole. Articles you already have are added to the
  search in the background on the first start; that takes a few seconds.

## 23 October 2026: Fewer reviews for small changes

- Changes to documents only, and tiny fixes, no longer wait for a second
  agent's review. Features, screens, your data, fetching, sign-in and the
  rules still get one. The automatic checks run on everything as before.

## 23 October 2026: slowfeed on your phone (Milestone 13)

- On a phone, slowfeed is one screen at a time: Feeds → a list → an
  article. Each has a back arrow that says where it goes, and the phone's
  own back gesture does the same.
- Refresh sits in the top bar. While reading, Previous, Next, Star, Share
  and Open original sit at the bottom, within thumb reach.
- Add it to your home screen: it opens full-screen with its own icon, and
  without a connection it opens and says slowfeed can't be reached.
- After an update, Settings says "A new version is ready" with Reload, and
  a tab that can't carry on says "slowfeed was updated. Reload to continue."

## 23 October 2026: Folders, editing feeds and OPML (Milestone 9)

- Folders: put a feed in one or more from its new "Edit feed" button, where
  you can also rename it. Folders are listed A to Z in the sidebar with
  their unread numbers; the small button beside each shows its feeds.
  "Edit folder" renames or deletes one (its feeds stay).
- Unsubscribe from "Edit feed". Undo brings the feed back whole; after your
  next action its articles are gone for good, except starred ones.
- A search field at the top of the sidebar finds a feed or folder by name.
- Settings → Your data imports your OPML file (feeds arrive over a few
  minutes) and exports one. The first screen links to it too.

## 23 October 2026: New articles arrive on their own (Milestone 8)

- slowfeed now checks your feeds in the background, each on its own
  rhythm: busy blogs every 30 minutes, quiet ones once a day. It asks
  publishers "anything new?" so unchanged feeds cost them almost nothing,
  and it slows down when they ask.
- The list never changes under you. When new articles are waiting, a quiet
  line says "New items · press r" (on phones, "tap Refresh"). `r` or the
  new Refresh button shows them, and updates the unread numbers.
- If a publisher corrects an article, the new words replace the old
  quietly, and it stays read.
- A feed that keeps failing is retried less and less often. The daily
  check now says when some feeds have failed for three days or more.

## 23 October 2026: Read, unread, star and undo (Milestone 7)

- An article counts as read once it's shown: its title turns grey and
  regular weight, and the feed's grey unread number in the sidebar drops.
- `m` or "Mark unread" makes it unread again. `Shift+A` or "Mark all as
  read" marks only the articles listed on screen.
- `s` or the Star button stars an article; starred ones carry a small star
  and are listed under Starred.
- After each of these, the line above the list says what happened, with
  Undo (or `u`).
- Unread now lists only unread articles. Settings has a new Reading
  section: newest or oldest first, shared across your devices.

## 23 October 2026: Merges reach the live app again

- Since Milestone 2, every merge built correctly but never told Render to
  update, most likely because the saved deploy address had a stray space or
  line break in it.
  slowfeed's deploy step now tidies the address, and says plainly when
  it's wrong.

## 23 October 2026: Reading articles (Milestone 6)

- Click an article, or press `j` and `k`, and it appears in the reading
  area: the publisher's own text, in your reading font and size, with
  headings, quotes, code, tables and images in place.
- Invisible tracking images are removed, so they never load.
- A summary-only feed shows its summary and points you to the original;
  slowfeed never fetches the rest.
- "Open original" (or `v`) and "Copy link" always sit above the article.
  `Enter` opens an article to read, Escape goes back, `+` and `-` change
  the text size.
- The next article is loaded in advance, so `j` never makes you wait.

## 23 October 2026: Add a feed and see its articles (Milestone 5)

- Paste a blog's address (or its feed's) and slowfeed finds its feed and
  lists its articles, newest first, 50 at a time with "Show older items".
- "+ Add feed" sits at the bottom of the sidebar; `a` does the same. Your
  feeds are listed in the sidebar, alphabetically, each with its own page.
- A site with several feeds lets you choose; a page with none, or a feed
  you already follow, gets a plain sentence instead of an error.
- slowfeed only visits public websites, introduces itself, and gives up on
  slow or huge files. Article text is cleaned of anything unsafe before
  it's saved (you'll read it from Milestone 6).
- A speed test now runs on a made-up library of 500 feeds and a year of
  articles, so the app stays fast as yours grows.

## 23 October 2026: Spending fewer tokens

- One milestone per thread: once a milestone is merged, the next starts
  fresh.
- Small, low-risk changes get a lighter second-agent review.
- AGENTS.md and DESIGN.md say the same things in fewer words. No rule
  changed; agents gained two habits: short command output, and screenshots
  only when a screen changed.

## 23 October 2026: Agents start building straight away

- When you ask for the next milestone, agents now start from the plan and
  the spec instead of writing a new plan for you to approve. They still ask
  when something isn't settled (a real choice, a new library, a design
  change, anything that could lose data), and you still say yes before
  anything is merged.

## 23 October 2026: Look and feel (Milestone 4)

- The placeholder page is gone. After signing in you see the real, empty
  app: a sidebar with Unread, Starred and All, an item list and a reading
  area, each told apart by tone. Ink blue marks where you are.
- Three areas on a wide window, two on a medium one, one on a phone. Hide
  and show the sidebar with its button or `[`.
- Settings: theme, reading font, text size and line width, remembered on
  each device, plus the version and Sign out.
- Keyboard: `?` lists every shortcut, `g` then `u`/`s`/`a` jumps between
  views, Escape goes back, and a clear outline shows where you are.
- All four fonts are in, served by slowfeed itself. The greys are warm.

## 23 October 2026: A list of concepts to learn

- New page, `docs/concepts.md`: the names of the ideas, tools and terms
  slowfeed is built with, grouped by area, for you to learn one at a time.
- Agents now add any new concept to it in the same change that brings it in.

## 23 October 2026: V1 trimmed for one reader

- V1 is just for you, so these moved to V2: backups, river mode, instant
  updates (WebSub), the feed health page, removing year-old articles, the
  "New to feeds?" guide page, and keeping a tab open across an update
  working. Your OPML file and the starred export are your safety net.
- Milestone 2 is marked done. The daily check now runs every morning at
  08:39, and its instructions handle an address ending in `/`.

## 23 October 2026: Live on Render, with sign-in (Milestone 2)

- slowfeed now has a password. A new browser sees only the password field;
  each device stays signed in for a year; Sign out ends that device only.
  After five wrong passwords, slowfeed makes you wait before trying again.
- You set the password with `slowfeed set-password` in Render's Shell tab.
  slowfeed only ever stores the scrambled form.
- Merging a pull request now puts it live by itself: GitHub builds slowfeed
  into a ready-to-run package and tells Render to run it.
- A public status page, and a key-protected diagnostics page for the daily
  health check an agent runs.
- New guides: setting up Render (`docs/operations/render-setup.md`), every
  setting (`settings.md`) and the daily check (`daily-check.md`).

## 23 October 2026: Agents may merge, after a brief and your yes

- You no longer have to press Merge yourself. When a change is ready, the
  agent sends you a short, plain-language brief of what's about to go live,
  and merges only once you say yes. You can still press Merge whenever you
  like.

## 22 October 2026: Skeleton and automatic checks (Milestone 1)

- slowfeed exists as a real program: for now, one quiet page with the
  wordmark and "Nothing here yet.", in all three themes.
- Every change is now checked automatically before it can be merged:
  formatting, likely mistakes, tests, accessibility and contrast, no motion,
  the download size budget, approved libraries only, and Hindi search. All
  checks run from one script, so they don't depend on GitHub.
- Each pull request shows screenshots of every screen. A weekly report flags
  known security problems in the libraries slowfeed uses.
- main is protected: only pull requests with passing checks can be merged.
- New: decision notes (`docs/decisions/`) and how-to guides (`docs/operations/`).

## 22 October 2026: Planning

- The design, engineering rules, V1 feature list (SPEC) and build plan are
  agreed. No app yet.
- Decided along the way: password scrambled with argon2; nightly backups
  built into slowfeed; agents watch the live app through a status page and
  a daily check; the repository stays public, under the MIT licence.
- Added a guide for the owner (`docs/owner-guide.md`), the approved
  libraries list, this change history, and a front page (README).
