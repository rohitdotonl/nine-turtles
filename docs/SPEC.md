# nine turtles: what it does

*Agreed with the owner; agents build from it (decision 0014). Based on `docs/DESIGN.md`, which takes
precedence: if this document and DESIGN.md disagree, DESIGN.md is right and
this document has a bug.*

Each feature has two parts:
- **What it does:** the behavior, in plain language.
- **How to check it:** steps you can follow yourself in the app.

Each section is its own file in [`spec/`](spec/), listed below by its
number; "SPEC section 28" means the file numbered 28. Read only the sections
your change touches.

A few words used throughout:
- **Feed:** the file a website publishes listing its latest writing (RSS, Atom or JSON Feed).
- **Item / article:** one piece of writing from a feed.
- **Pane:** one of the side-by-side columns on screen (feeds, items, article).
- **Vim keys:** single-letter keyboard shortcuts such as `j` and `k`, named after a classic text editor.

## Sections

| # | Section |
|---|---|
| 1 | [Sign-in](spec/01-sign-in.md) |
| 2 | [First visit (empty state)](spec/02-first-visit.md) |
| 3 | [Adding a feed](spec/03-adding-a-feed.md) |
| 4 | [Layout](spec/04-layout.md) |
| 5 | [Sidebar](spec/05-sidebar.md) |
| 6 | [Item list](spec/06-item-list.md) |
| 7 | [Reading an article](spec/07-reading-an-article.md) |
| 8 | [Read state, marking unread, "mark all as read", undo](spec/08-read-state-and-undo.md) |
| 9 | [Star](spec/09-star.md) |
| 10 | [Reading modes: inbox and river](spec/10-reading-modes.md) |
| 11 | [Background fetching (being polite to publishers)](spec/11-background-fetching.md) |
| 12 | [WebSub (instant updates from publishers who offer it)](spec/12-websub.md) |
| 13 | [Refresh: the view waits for you](spec/13-refresh.md) |
| 14 | [Search](spec/14-search.md) |
| 15 | [Folders and managing feeds](spec/15-folders-and-feeds.md) |
| 16 | [OPML import and export](spec/16-opml-import-and-export.md) |
| 17 | [Feed health page](spec/17-feed-health-page.md) |
| 18 | [Settings and appearance](spec/18-settings-and-appearance.md) |
| 19 | [Keyboard](spec/19-keyboard.md) |
| 20 | [Phones and installing the app](spec/20-phones-and-installing.md) |
| 21 | [Sharing](spec/21-sharing.md) |
| 22 | [Everyone can read here (accessibility)](spec/22-everyone-can-read-here.md) |
| 23 | [Your data: keeping and exporting](spec/23-your-data.md) |
| 24 | [Languages](spec/24-languages.md) |
| 25 | [Speed](spec/25-speed.md) |
| 26 | [Other apps: syncing with Reeder and NetNewsWire](spec/26-other-apps.md) |
| 27 | [Rules and mutes](spec/27-rules-and-mutes.md) |
| 28 | [Newsletters as feeds](spec/28-newsletters-as-feeds.md) |
| 29 | [Paying for nine turtles](spec/29-paying-for-nine-turtles.md) |
| 30 | [The feed finder (on the website)](spec/30-the-feed-finder.md) |
| 31 | [Starter packs (on the website)](spec/31-starter-packs.md) |
| 32 | [Reading offline](spec/32-reading-offline.md) |
| 33 | [Connecting your own AI assistant (MCP)](spec/33-ai-assistants-mcp.md) |
| 34 | [Collections](spec/34-collections.md) |
| 35 | [Podcasts](spec/35-podcasts.md) |

## Not built yet, and never

Not built yet: the ideas in `docs/DESIGN.md` → "V2 parking lot".

Never: notifications, badges, streaks, reading stats, endless feeds padded with things you didn't follow, algorithmic ranking, likes or comments, platform share buttons, scraping full articles, decorative effects or animation.
