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
| [0030](0030-flush-place-bar.md) | "Where you are" bar flush with the pane's edge in both panes; the selected article's focus is the usual outline, not a grey hairline |
| [0031](0031-sheets-and-popovers.md) | Short tasks (add or edit a feed, edit a folder) as sheets over the list; search options as a popover with date presets |
| [0032](0032-more-themes.md) | Eight more themes to try (four light, four dark), each with its own "where you are" accent; the owner prunes later (superseded by 0046) |
| [0033](0033-one-mark-per-row.md) | The keyboard's outline replaces the selected row's fill; one search field style; sheets anchored, each with Cancel; "That's everything." ends a list (selection refined by 0036) |
| [0034](0034-aa-panel-and-quiet-toolbars.md) | An "Aa" reading panel beside the text (size, theme, font, width); quiet icon toolbars on the article; Refresh and a More menu beside the list title |
| [0035](0035-sheets-search-and-welcome.md) | One family for sheets (sans title, Cancel then the main action in one foot row, destructive actions as muted-red words) and things that float; search excerpts cut on the server as plain-text pieces; a × in the search field; the welcome in the reading area |
| [0036](0036-apple-books-type-and-selection.md) | Toward Apple Books: the system interface font, phone-sized text on touch screens, a selection that keeps its fill with the focus ring outside, hairlines between list rows, a tighter reading rhythm (selection refined by 0037) |
| [0037](0037-one-selection-pill.md) | One selection pill in the sidebar and the list (accent mixed into the pane, no bar), the focus ring drawn inside it, an 8px accent unread dot, one search highlight, a calmer list rhythm |
| [0038](0038-toolbars-and-chrome.md) | Toolbars anchored to the pane edges; one More (…) per list (Edit and Refresh inside) and per article (Copy link and Mark unread inside); translucent top bars (withdrawn by 0040); a labelled back button and five-icon bottom bar on phones; quieter byline, tighter title, the summary note as the last paragraph |
| [0039](0039-settings-and-sheets.md) | Settings as Apple Books' grouped inset lists with "Aa" theme tiles and an A/A text size; sheets placed above the middle and grown by content, a lighter dim, the destructive action at the row's far left; 1px fields with red errors; search options as a checkmark menu; a fading shortcut list; a calmer first visit (supersedes parts of 0027, 0031, 0035) |
| [0040](0040-solid-bars-and-text.md) | Solid article bars (no see-through, supersedes that part of 0038) with a hairline only once scrolled; a hairline above the phone's toolbar; no scrollbar gutter strip; the summary note as small centred end matter; titles filling the measure; search results as title, text, meta; a silent empty reading pane |
| [0041](0041-list-and-sidebar-geometry.md) | A 24px gutter for the unread dot with every title 32px in; hairlines that end with the pill; a one-line list title stepping to 22px in a narrow pane (reverses 0038's two lines); one search well at rest; counts in one column with folder arrows first; no shortcut hint; the welcome alone on a first visit; dark pills from ink; no selection and chevrons on the phone's feeds screen |
| [0042](0042-sheets-and-settings-in-one-voice.md) | Sheets and Settings in one voice: serif sheet titles with no ring on a non-operable heading, 20px before a borderless Cancel, one line on a refused field, a folder checklist that shows both states, a shortcut list that fits; Settings with the sample on the page, glyphs on action rows (Sign out stays ink), A \| Medium \| A, edgeless raised segments and lighter dark groups (supersedes parts of 0035 and 0039) |
| [0043](0043-one-top-line-and-phone-edges.md) | One top-line height (`--bar-h`, 56px) for every pane so their lines and hairlines meet; toolbar focus rings drawn inside the button; one left edge for every sidebar name, a folder's feeds a step in; the selected sidebar place's icon in the accent; on a phone one back-button position, one 20px margin with the dot in it, and folders without an arrow |
| [0044](0044-reading-pane-endings.md) | Quiet endings and blank paper in the reading pane: a short end-note link that never breaks (the publisher named in the byline), balanced titles (replaces 0040's lone-word rule), at least 56px beside the text on a computer, an empty reading pane with nothing drawn (replaces 0040's visible line) |
| [0045](0045-controls-that-say-what-they-are.md) | Controls that say what they are: a text-size stepper (two round-ended As, the step's name between them on no track), one ring on the chosen theme tile (no badge), square tick boxes and 44px rows for Edit feed's folders, a main button that darkens rather than pales under the pointer, "Import an OPML file…" just under the welcome's field, a true minus on the shortcut list (supersedes parts of 0039 and 0042) |
| [0046](0046-apple-books-themes.md) | Apple Books' six themes (Original, Quiet, Paper, Bold, Calm, Focus), each by day and by night, with an Appearance choice of Light, Dark or Match device; Bold sets article text heavier; old choices carried over (supersedes 0032) |
