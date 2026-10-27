# Decisions

Short notes on significant technical decisions: what was decided, why, and
what would make us revisit it. They exist so a future agent (or person)
doesn't undo a deliberate choice by accident.

One file per decision, numbered in order: `NNNN-short-name.md`. If a
decision changes, a new note replaces it and the old one says "Replaced by …"
at the top. Notes that later ones have replaced may be folded into one
summary note, one line each (as 0061 did); their full text stays in the
repository's history.

| # | Decision |
|---|---|
| [0001](0001-one-check-script.md) | Every check runs through one script |
| [0002](0002-pinned-tool-versions.md) | Exact versions of Rust, Node and GitHub's building blocks |
| [0003](0003-library-check.md) | How the library check knows what's approved |
| [0004](0004-search-hindi.md) | Search splits words so Hindi stays whole |
| [0005](0005-screenshots.md) | Screenshots appear as a comment on each pull request |
| [0006](0006-second-agent-review.md) | The second-agent review is written instructions, not an app |
| [0007](0007-repository-layout.md) | `server/` and `web/`, with the frontend packed into the program |
| [0008](0008-fonts-and-placeholder-colors.md) | Fonts served in pieces; placeholder colors until Milestone 4 |
| [0009](0009-agents-may-merge.md) | Agents may merge once the owner has given permission (per change, or in advance in a plan or session) |
| [0010](0010-sign-in.md) | How sign-in works: setting the password, signed-in devices, wrong guesses |
| [0011](0011-container-image.md) | The container image, where it's stored, and automatic deploys |
| [0012](0012-v1-for-one-reader.md) | V1 is for one reader: no backups, and six features moved to V2 |
| [0013](0013-look-and-feel.md) | Look and feel: colors, fonts, type scale, reader settings per device, addresses |
| [0014](0014-no-plan-step.md) | No separate plan to approve: agents build from PLAN and SPEC, asking only when needed |
| [0015](0015-saving-tokens.md) | Spending fewer tokens: one milestone per thread, light reviews, shorter AGENTS.md and DESIGN.md |
| [0016](0016-adding-feeds.md) | Adding feeds: autodiscovery on the pasted page, private addresses refused, cleaning before storing, list order and speed test |
| [0017](0017-reading-articles.md) | Reading articles: tracking images removed by size, images from anywhere, prefetching, selecting is showing |
| [0018](0018-read-and-star.md) | Read state, stars and undo: two marks per article, partial indexes, marks shown first and saved in order, shared sort order |
| [0019](0019-background-checks.md) | Background checks and Refresh: each feed's rhythm, rounds, polite answers, failing feeds counted, the list asks once a minute |
| [0020](0020-folders-and-opml.md) | Folders, unsubscribing and OPML: folder pairs, hide first and clear later, edit pages with addresses, import fetches in the background |
| [0021](0021-no-review-for-small-changes.md) | No second-agent review for documents-only changes and tiny fixes |
| [0022](0022-phones-and-installing.md) | Phones and installing: history steps for back, a page-first service worker, a version on every answer |
| [0023](0023-search.md) | Search: a contentless index of tag-free text, every typed word quoted, title matches first, filters as plain settings, speed |
| [0024](0024-starred-export-and-final-pass.md) | Starred export as JSON Feed 1.1 with a `_slowfeed` source extension; "Marked as read" spoken to screen readers; export speed |
| 0025–0055 | The UI redesign, step by step: folded into [0061](0061-redesign-notes-folded.md), one line each |
| [0056](0056-nine-turtles-one-theme.md) | Renamed nine turtles (the program, settings, database, repository and Render service keep the name slowfeed); one theme, Original, by day and by night, with Light, Dark and Match device; the theme tiles, Bold and Literata's 800 removed (replaces the theme list of 0046) |
| [0057](0057-grey-pill-green-star.md) | Where you are: a plain neutral grey pill, its sidebar icon in ink; a light green for filled stars, the one second color (changes 0037, 0041 and 0043) |
| [0058](0058-renamed-everywhere.md) | nine turtles everywhere: repository, image, program, `NINE_TURTLES_*` settings, database file, cookie and saved preferences, with the old names still read for now; Render's address and disk keep slowfeed (changes 0056) |
| [0059](0059-apple-books-reference.md) | Apple Books is the design reference, written into DESIGN.md: floors first, then Apple Books; principles brought up to date; each screen described once, in SPEC.md |
| [0060](0060-bookmark-and-phone-search-button.md) | A bookmark in every article (your place kept per device, by paragraph, forgotten at the top or the end) and, on a phone, the list's search field behind a Search button beside More |
| [0061](0061-redesign-notes-folded.md) | The redesign notes 0025–0055 folded into one summary, their files deleted (full text in the history) |
| [0062](0062-shortcuts-in-words-find-and-one-tip.md) | Shortcuts in words at the sidebar's foot; the shortcut list grouped by what you're doing, with a find field; one welcome tip, once, under "No article open" (changes 0041's no-hint rule) |
| [0063](0063-plain-theme-system-serif.md) | A second theme, Plain (rohit.onl's bare look: black on white, blue underlined article links, the accent in the text color), and System serif, the device's own serif, as a reading font (adds to 0056) |
| [0064](0064-a-beautiful-empty-page-and-capital-keys.md) | "Time to read something beautiful." in the empty reading area (replaces "No article open"); tooltips print keys as capitals, like the key caps; Shortcuts becomes "Keys" with an icon |
| [0065](0065-faster-checks.md) | The checks run in parts side by side (frontend, Rust, browser tests in two halves) behind one **All checks**; documents-only pull requests skip them; changelog entries go in `docs/changes/`, one file each (revisits 0001) |
| [0066](0066-website-and-domain.md) | A website at nineturtles.app (Eleventy, GitHub Pages), the app at app.nineturtles.app, in one repository; website-only changes skip the app's checks and deploy |
| [0067](0067-turtle-logo.md) | A logo of nine turtles seen from the side, in one ink, for the app icon and the browser tab; the wordmark stays words (revisits 0022) |
| [0068](0068-river-mode.md) | River mode: a reading mode with no Unread view, counts or read styling |
| [0069](0069-websub.md) | WebSub: subscribe to a feed's hub at `NINE_TURTLES_PUBLIC_URL`/websub/{token}, a secret per feed, signed deliveries only (hmac, sha1, sha2), 10-day leases renewed a day early, backup checks at most twice a day |
| [0070](0070-other-apps.md) | Reeder, NetNewsWire and other feed readers sync through the Google Reader API at `/api/greader`, signing in with an app password made in Settings (never the owner's own); apps may follow, unfollow and file feeds, with unfollowing hidden first |
| [0071](0071-feed-health-page.md) | The feed health page: in Settings › Feeds, listed after two failures in a row, no status colors, Retry respects "slow down", Find new address moves a feed keeping everything |
| [0072](0072-youtube-videos.md) | YouTube videos play in YouTube's own privacy-enhanced player, loaded only once Play is pressed; a YouTube player inside a blog post becomes a link (first numbered 0068, which river mode also took; 0071 is the feed health page) |
| [0073](0073-marks-retry-while-out-of-reach.md) | A mark that can't reach nine turtles (a restart, a dropped connection) tries again for up to a minute; if it still fails, the note offers Try again and clears once a later mark is saved |
| [0075](0075-health-check.md) | A scheduled GitHub Actions job checks the status page every 15 minutes and GitHub emails the owner when nine turtles isn't answering after 5 tries a minute apart; no outside monitoring service |
| [0079](0079-new-to-feeds.md) | "New to feeds?" in the first-visit welcome: a sheet explaining feeds, a link to the website's guide, and five fixed starter feeds, none ticked (an owner-approved exception to "not a discovery engine") |
| [0076](0076-backups.md) | Nightly backups to any S3-compatible storage (R2 first), a copy before every structure change, 30 nightly + 12 monthly + 10 before-change kept, restore onto an empty disk with `NINE_TURTLES_RESTORE_FROM`; the S3 requests written in-house with reqwest, hmac and sha2 (replaces 0012's "no backups") |
| [0080](0080-tidying-many-feeds.md) | Your feeds, in Settings › Feeds: every feed with when it last posted, quiet feeds (6 months or a year), and Edit to move or unsubscribe from several at once with one Undo; a page in Settings, not ticks in the sidebar; Move to… puts each feed in one folder (numbered 0080 because changes built at the same time took 0073 to 0079) |
| [0081](0081-saved-searches.md) | Saved searches: Save search… in the list's More menu, listed in the sidebar under Unread, Starred and All, with Edit, Delete and Undo; kept as JSON in a small new table |
| [0082](0082-feed-settings.md) | Settings for each feed, in Edit feed: Inbox or River (a river feed skips Unread and counts nothing), checks at most hourly or daily, and opening articles on the publisher's website; three columns on `feeds` with today's behavior as default |
| [0085](0085-open-tabs-switch-on-the-next-move.md) | A tab left open across an update switches to the new version the next time you go to another place, once marks are saved and no Undo would be lost; it checks on coming back into view and every 5 minutes |
| [0086](0086-dodo-payments.md) | Payments through Dodo Payments as merchant of record (the owner signs up as an Individual); built last in test mode, switched on after Dodo approves the live website; Paddle revisited once there's sales history |
| [0087](0087-sign-in-by-email.md) | Signing in by email and password (structure change 13), the owner still by password alone; wrong tries slowed per account, never saying whether an email exists; the owner's sign-up switch (Closed, Invite link, Open waiting for confirmation emails), at most 20 sign-up tries an hour, one at a time |
| [0090](0090-readers-page-and-limits.md) | The owner's Readers page (Settings › Readers › All readers): counts, what needs a look, and each reader's feed count, never which feeds (showing "last here" waits for the owner); at most 1,000 feeds per reader; feeds whose followers have all been away 30 days checked once a day; no structure change |
| [0091](0091-newsletters-as-feeds.md) | Newsletters as feeds: Cloudflare Email Routing and a small Worker post each raw email to nine turtles with a shared secret; emails are read with mail-parser and tidied for reading; never shared between readers; part one keeps nothing yet |
| [0092](0092-check-your-email.md) | After a link is sent, the form gives way to "Check your email" (said once) with a quiet Send again that sends nothing within a minute; the server sends one password link to an address a minute (sign-up links excepted), as well as three an hour; no limits per IP address (behind Render's proxy) |
| [0093](0093-readers-page-shows-last-here.md) | The Readers page shows the day each reader was last here ("Last here today"), from what nine turtles already keeps; readers are told under Account in Settings and in the privacy policy; no structure change |
| [0094](0094-payments-in-test-mode.md) | Paying through Dodo Payments, built in test mode: a free trial with no card (14 days, a setting), monthly and yearly plans at prices that are settings, Dodo's checkout and billing pages, signed webhooks, our own record of each subscription (structure change 18); an ended plan keeps reading and exports but stops adding feeds; deleting an account cancels its plan first |
| [0095](0095-pausing-a-feed.md) | Pausing a feed from Edit feed: while paused, its new articles still arrive but nothing from it piles up as unread (structure change 19, `subscriptions.paused_at`) |
| [0096](0096-sign-in-links.md) | "Email me a sign-in link": a link that signs in once, within 15 minutes, for every reader including the owner; one press on its page; passwords keep working; the same limits as a password link; structure change 20 adds the `sign-in` purpose to `email_links` |
| [0097](0097-easing-unread-guilt.md) | Easing unread guilt: unread that lets go after a chosen time, "Catch me up", and Unread counts that can be hidden |
| [0098](0098-importing-stars.md) | Importing starred articles from other feed readers (Google Reader format and JSON Feed) in Settings › Your data; a star of an article nine turtles already has goes on it, any other is kept in a hidden feed of the reader's own, never shared; read, never fetched, no Undo needed, no structure change; Pocket left out |
| [0099](0099-feed-finder.md) | The feed finder at nineturtles.app/feed-finder/: the app looks (`/api/find-feeds`, anyone, no sign-in) the way Add feed does, the page and its first feed once; answers remembered 30 minutes, one site at most 6 lookups in half an hour, limits for everyone together and nothing about visitors kept; CORS lets only the website's pages read it; at most 10 feeds read from any page (Add feed too) |
| [0100](0100-starter-packs.md) | Starter packs at nineturtles.app/packs/: hand-picked blogs by theme, website only, the same for everyone and never ranked; each blog credited and linked; an OPML download once a pack has blogs; a made-up test pack is built only for the checks |
| [0101](0101-reading-offline.md) | Reading offline, words only: each device keeps the first 200 unread and newest 200 starred articles in IndexedDB, images as a short note; read, mark and star offline; marks sent later say when they were made and the latest wins (structure change 21); deleted whenever nobody is signed in |
| [0102](0102-wrong-turn.md) | "Wrong turn?": one 404 page for the app and the website, with a small "404 error", eight turtles one way and one the other, and "tell me which one"; the website footer's turtles and line move to About |
| [0104](0104-add-from-anywhere.md) | Adding a feed from anywhere: `/add-feed?url=…` (or a link inside `text`/`title`) opens Add a feed with the address and looks through the feed finder without following; only Add feed follows. A GET Web Share Target for Android, an Apple Shortcuts shortcut for iPhone, and a bookmarklet in Settings › Add from anywhere |
