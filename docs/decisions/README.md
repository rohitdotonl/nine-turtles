# Decisions

Short notes on significant technical decisions: what was decided, why, and
what would make us revisit it. They exist so a future agent (or person)
doesn't undo a deliberate choice by accident.

One file per decision, numbered in order: `NNNN-short-name.md`. A note is
never deleted; if a decision changes, a new note replaces it and the old one
says "Replaced by …" at the top.

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
| [0025](0025-controls-and-icons.md) | Four kinds of control (everyday, main, toolbar, field) and one hand-drawn icon set; headings opened by the app show a short bar, not a box; Settings choices as tiles; key caps |
| [0026](0026-hierarchy-redesign.md) | A type scale by role, three inks, deeper area tones, one selection style, a shared top line; Settings and the shortcut hint at the bottom of the sidebar |
| [0027](0027-taste-first-icons-and-settings.md) | Taste first; icons where the convention is an icon (close, settings, the article's actions); Settings as grouped cards with theme pictures; a grouped shortcut list |
| [0028](0028-one-place-style-and-a-floating-note.md) | One rounded "where you are" shape in the sidebar and list; an unread dot; a floating note instead of reserved lines; one top line for pages |
| [0029](0029-literata-semibold.md) | Literata semibold (600) instead of bold for titles and headings; same download size |
| [0030](0030-flush-place-bar.md) | "Where you are" bar flush with the pane's edge in both panes; the keyboard on the selected article grows the bar instead of drawing a ring |
