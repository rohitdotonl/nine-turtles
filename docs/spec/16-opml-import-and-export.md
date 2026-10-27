# 16. OPML import and export

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

OPML is the standard file format feed readers use to move subscription lists between apps.

**What it does**
- **Import:** from Settings → Your data, or from the empty state. A feed that appears several times in the file becomes one feed in several folders. Feeds you already have are not duplicated (they join the file's folders). A feed another reader of this nine turtles already follows isn't stored twice: you get it with its articles so far marked read, and new ones arrive unread. Folders inside folders become the innermost one. Afterwards, a plain summary says what was added and what couldn't be read, for example "Added 120 feeds and 8 folders. Their articles arrive over the next few minutes." The feeds appear at once with the file's names; their articles arrive in the background, a few feeds at a time, as with any feed.
- **At most 1,000 feeds per reader** (decision 0090): a file that would take you past 1,000 imports nothing and says so plainly: "Nothing was imported. You follow 950 feeds, and this file would add 120 more, past the 1,000 one reader can follow." Feeds the file lists that you already follow don't count.
- **Export:** downloads an OPML file of all your feeds and folders. A feed in several folders appears under each of them.
- Your own OPML file is never stored in the code repository.

**How to check it**
1. Import your OPML file. The summary says how many feeds were added. Your folders appear in the sidebar.
2. Export, then import the export into another feed reader (or back into a fresh nine turtles). Everything is there, with the same folders.
