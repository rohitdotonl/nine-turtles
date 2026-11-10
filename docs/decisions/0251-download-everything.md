# 0251: Download everything

**In one line:** Settings › Your data's three exports become one Download everything: a .zip that opens as a folder of plain pages (index.html, one page per kept article) plus the OPML, JSON Feed and Markdown files, so what a reader kept outlasts nine turtles.

*11 November 2026.*

Rohit's "2" on the "Design for decades, again" critique
(`critique-24/design-for-decades-2.html`, in the project's files).

**What was wrong.** What a reader kept left nine turtles only as three
technical files (OPML, JSON Feed, Markdown), each its own row. None is
something a person can open and read in twenty years without another app.
"Built to last" (principle 10) is about the reader's reading too.

**Decision.**

1. **One row, Download everything,** in Your data and in both delete sheets,
   replacing Export OPML, Export starred articles and Export notes and
   highlights. It's offered from the first day: even with nothing kept, it
   holds who you follow and says how to keep something (so the "Nothing
   starred yet" / "No notes yet" rows of decision 0191 go).
2. **What's inside** (SPEC section 23): one folder named for the day, with
   `index.html` (people you follow, then every starred or marked article by
   year), `articles/<year>/<number>-<title words>.html` per article (text,
   original link, highlights and notes), and `follows.opml`,
   `starred.json`, `notes-and-highlights.md` for other apps.
3. **Plain pages.** HTML with its style inside, no scripts, no fonts to
   fetch, light or dark as the device is set. Pictures stay on the
   publisher's site (the second floor: nothing of theirs is copied that the
   app itself doesn't show).
4. **No library.** The zip is written by hand (`server/src/zip.rs`), stored
   rather than compressed: the contents are text, and a stored zip is the
   simplest kind, readable by every unzip tool. "Boring and few."
5. **The old routes go:** `/api/starred/export`, `/api/notes/export` and
   the download from `GET /api/opml` are removed (their files live on inside
   the zip; importing still posts to `/api/opml`, and assistants still get
   the OPML file from `subscriptions::opml_for`). `/api/feeds` no longer says
   whether anything is starred or noted: only those rows needed it.

**Limits.** Built in memory, one article's text read at a time (the starred
file a hundred at a time), and one download at a time for the whole server,
so a small server never holds two (the second-agent review); at most 65,525
articles (a plain zip's limit), far more than any reader stars. Each starred
text is in the zip twice (its page and starred.json): accepted, as text is
small. While it's built the browser shows nothing until the file starts; a
typical library should take about a second or less.
