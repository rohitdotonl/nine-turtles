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
| [0009](0009-agents-may-merge.md) | Agents may merge after a brief and the owner's yes |
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
