# 16. OPML import and export

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

OPML is the standard file format feed readers use to move subscription lists between apps.

**What it does**
- **Import:** (YouTube subscriptions from Google Takeout come in the same way, section 38) from Settings → Your data, or from the first-visit welcome's "Bring your list from another app…", which opens the file chooser directly (section 2). A feed that appears several times in the file becomes one feed in several folders. Feeds you already have are not duplicated (they join the file's folders). A feed another reader of this nine turtles already follows isn't stored twice: you get it with its newest five articles unread and the older ones read, and new ones arrive unread. A feed nobody here follows yet gets the same at its first check: its newest five unread, the rest read (decision 0194). Folders inside folders become the innermost one. Afterwards, a plain summary says what was added and what couldn't be read, for example "Added 120 feeds and 8 folders. Their articles arrive over the next few minutes." The feeds appear at once with the file's names; their articles arrive in the background, a few feeds at a time, as with any feed.
- **Undo for an import** (decision 0238): in Settings › Your data, an import that added something ends with "Wrong file? **Undo the import**", drawn as every Undo line is, with a × (section 8). It takes away exactly what that import added, the feeds it followed, the folders it made and the folders it put feeds you already followed into, and nothing that was there before; then it says "Undone.". Like every Undo it lasts until you do something else here (another import, ×, or leaving the page), and at most ten minutes; after that, or once a new version of nine turtles has gone live in between, it says "It's too late to undo that." The welcome's "Bring your list from another app…" has no Undo: its import is the reader's first step.
- **At most 1,000 feeds per reader** (decision 0090): a file that would take you past 1,000 imports nothing and says so plainly: "Nothing was imported. You follow 950 feeds, and this file would add 120 more, past the 1,000 one reader can follow." Feeds the file lists that you already follow don't count.
- **Export:** downloads an OPML file of all your feeds and folders. A feed in several folders appears under each of them.
- Your own OPML file is never stored in the code repository.

- **Dropping the file** (decision 0248): on a computer, an `.opml` (or `.xml`) file dragged onto nine turtles' window and let go is imported in the same way. While it's held, a line at the top of the sidebar's people and folders says "Drop a list of feeds (OPML) to import it."; afterwards the summary shows in the note at the sidebar's foot, with Undo when the import added something (decision 0238).

**How to check it**
1. Import your OPML file. The summary says how many feeds were added. Your folders appear in the sidebar.
2. Import a second file, then press **Undo the import**: its feeds and new folders go from the sidebar; what you followed before stays where it was.
3. Export, then import the export into another feed reader (or back into a fresh nine turtles). Everything is there, with the same folders.
4. On a computer, drag an OPML file onto nine turtles' window and let go: the sidebar's foot says what was imported, with Undo.
