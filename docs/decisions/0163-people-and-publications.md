# 0163: People and publications

*3 November 2026. Agreed with the owner, Rohit. Refines decision 0146
(people); the refinement round PLAN.md → V1, item 1 asked for. SPEC
section 36.*

**Decision.**

- **Someone or something.** Everything a reader follows is a **person**
  or a **publication**. The sidebar lists rows outside folders under two
  headings, **People** and **Publications**; folders hold both.
  "Publications" names that heading only: a person's blog or channel is
  never called a publication.
- **The guess.** A source joined to others is always a person. For a
  source on its own, nine turtles guesses once from the feed alone, never
  fetching a page: one author name is a person, several a publication; with
  no names, a place of someone's own on a shared site (Substack, Medium,
  YouTube, Bluesky…) is a person, and a site whose own name is a whole word
  of the feed's title (NASA at apod.nasa.gov) is a publication, unless the
  title says it's someone's or the address is a name run together; still
  unclear is a person. Add asks "someone or something?" with the guess
  chosen; Edit can change it for one source. Code:
  `server/src/writers/kind.rs`.
- **One page for both.** Their name at the top of their list ("Alpha ›"),
  About in the More menu, or `i` opens their page in the reading area (a
  screen of its own on a phone). The reading area beside a list otherwise
  shows the quiet line, as every list does; 0146's page that replaced it is
  gone.
- **Edit on the page.** Edit turns the page into its settings (Done saves,
  Cancel or Escape doesn't). It holds the name, email address, person or
  publication (one source), a person's sources (each › opens that source's
  own settings) with **+ Add a source**, the folders, and **Unsubscribe from
  Alpha**, which leaves every source of theirs at once, with Undo. A
  source's settings end in **Take out of Alpha**, with Undo. The More
  menu's "Edit person…" is gone; `Shift+E` still opens Edit.
- **+ Add** replaces "Add feed" at the sidebar's foot ("Add a person or
  publication"; `/add`, with `/add-feed` still working).
- **+ Add a source** (was "Add another place") shows a site's several
  feeds to choose from, and asks which folders to keep when the two are in
  different ones (all ticked). This replaces 0146's choices 6 and 7.
- **A source's kind** (Blog, Video, Newsletter, Podcast) is read from the
  feed (any episode makes it a podcast), and the reader can correct it.
  This replaces 0146's choice 9.
- **"Is this the same person?" is removed.** nine turtles no longer asks
  whether two sources are one person. This replaces 0146's same-person
  question and choice 8.
- **Addresses:** `/people/12`, `/publications/7`, `…/about`, `…/edit`,
  `/people/12/sources/34`. Old `/feeds/12` addresses still open and are
  tidied to the new ones.
- **Data (structure change 33,** `server/migrations/0033_people_and_publications.sql`):
  `subscriptions.kind` (person or publication) and `subscriptions.place`
  (the source's kind) are added, both empty at first and filled the next
  time a reader's sidebar loads; `subscriptions.same_asked` is dropped. It
  held only the record of the question, nothing a reader sees or keeps.

**Why.** Following a magazine isn't following a person, so calling
everything a person was untrue. One page for both, with Edit on it, means
one place to learn instead of a page and a separate sheet. The same-person
question went because the owner wants to treat readers like adults: they
know who is who, and can join sources themselves with + Add a source.
nine turtles shouldn't second-guess them.
