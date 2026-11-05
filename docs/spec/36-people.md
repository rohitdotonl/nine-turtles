# 36. People and publications

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.
Decision 0146 made people; decision 0163 (agreed with the owner on 3
November 2026) added publications, one page for both, and Edit on that page.
PLAN.md → V1, item 1.*

**What it does**
- **Someone or something.** Everything a reader follows is either a
  **person** (someone) or a **publication** (something, such as a magazine
  or NASA's picture of the day). A person has one or more **sources**: a
  blog, a YouTube channel, a newsletter, a podcast. A **folder** is a group
  of people and publications. On these screens nine turtles never says
  "feed"; the word stays only in technical spots (Feed health, importing or
  exporting a feed list).
- **Two headings.** In the sidebar, rows not in a folder sit under
  **People**, then **Publications**, each A to Z by name. Folders hold
  both. "Publications" names that sidebar heading only: a person's blog or
  channel is never called a publication. A person with several sources has
  one row, with their name, and a dot when any source has something unread,
  in every folder any of their sources is in.
- **Which is which.** A source joined to others is always a person. For a
  source on its own, nine turtles guesses once, from the feed alone (it never
  fetches a page to find out):
  - one author name on its articles: a person; several names: a publication;
  - no names: a place of someone's own on a site many people share (a
    Substack, Medium, a YouTube channel, a Bluesky account and the like): a
    person;
  - a site whose own name is a whole word of the feed's title (NASA at
    apod.nasa.gov, "NASA Picture of the Day"): a publication, unless the title
    says it's someone's ("Alpha's blog") or the site's address is a name run
    together (janedoe.com, "Jane Doe");
  - still unclear: a person.

  When adding through **+ Add** (section 3), the reader is asked to finish
  "Tomas Berg is…" with one of two tiles (**A person**, "Someone you might
  write back to."; **A publication**, "Anything you only read or watch, and
  won't write back to."), with the guess already chosen. They can change it later in
  Edit (for one source only, and not for the last source left of someone
  joined, who stays a person). Feeds followed before this change get their
  guess the next time the sidebar loads; an imported feed gets it once
  nine turtles has checked it for the first time, so the guess sees its
  writers.
- **Called by their name** (owner's plan, step 2). When a source on its
  own is first guessed a person and every one of its articles is signed by
  the same one author (in any capitalisation), the person is called by that
  name, as the feed writes it ("Tomas Berg", not his blog's title "Notes
  from Tomas"). A role or placeholder ("admin", "editor", "staff" and the
  like) is never taken for a name. When the feed doesn't name one author,
  the blog's title stays, and Edit fixes the rest. A name the reader gave (in
  Edit, or in the app they imported from) always wins: nine turtles only renames a person still called by
  their feed's own title (as the publisher last gave it, never a name brought
  from another app), once, when it first guesses them; people followed
  before this change are renamed the same way, once, at their feed's next
  check. An Atom feed that names its author once, for all its entries, signs
  each of them, so it counts as one author for the person-or-publication
  guess too (an organisation named as a feed's only author is guessed a
  person, and Edit fixes it). Only "No, a publication" in the question after
  adding gives back the feed's title; changing **This is** in Edit later
  keeps whatever name it has.
- **Their list:** choosing the row lists everything they made, newest first
  (or as the reader sorts), one list across all their sources (`/people/12`
  or `/publications/7`). With two or more sources, each row says which source
  it came from in place of their name: **Blog**, **Video**, **Newsletter**,
  or **Podcast**. Everywhere else (Unread, All articles, Starred, search, Notes,
  the article's own line) an article is credited by their name. Mark
  all as read, "new articles", search in their list and reading offline all
  cover every source. Beside a list, the reading area shows the quiet line
  ("Time to read something beautiful."), as it does for every list.
- **Their page,** the same for a person and a publication
  (`/people/12/about`): opened by pressing their name at the top of their
  list ("Alpha ›"), by **Info about Alpha** in the list's More menu, or by the
  `i` key. On a computer it opens in the reading area beside their list,
  where an article would; on a phone it's a screen of its own, with ‹ back to
  their list. It shows their name with an **Edit** button beside it; for one
  source whose own title isn't their name, that title under it, in the
  reading serif ("Notes from Tomas" under Tomas Berg); under that, **Write
  to Tomas Berg**, the solid ink button with the paper plane, with the
  address under it once nine turtles knows it (section 37; the owner's core
  path, point 9); then their sources, each by its kind (Blog, Video,
  Newsletter, Podcast) with a link to the publisher's own site (a blog by its
  website, "alpha.example"; a channel or newsletter by its own name). The
  muted line that said what they are, their folders and since when ("A
  person · in Friends · following since March 2026") and the separate Email
  line went (point 10). At its foot, a quiet link,
  **Hide articles about…**, opens Settings › Hiding with a new rule for
  them (section 27).
- **Edit** (`/people/12/edit`) turns the same
  page into their settings. **Done** saves and turns it back; **Cancel** or
  Escape turns it back unchanged. Top to bottom (the owner's core path,
  points 11 and 12):
  - **Name** and **Email address** (where Write back writes to them,
    section 37);
  - for one source, **This is: A person / A publication**;
  - **Folders** (one list for all their sources: Done puts every source in
    exactly those);
  - for one source, its settings right here in Edit: **Pause for a while**
    (and a YouTube channel's two switches);
  - for someone with two or more sources, their **Sources**, each a row
    whose › opens that source's own settings, and **+ Add a source** under
    them; for a person with one source, no Sources heading, only a line near
    the foot: "Does Tomas Berg also write a newsletter, make videos or host a
    podcast? Add it, and everything Tomas Berg makes shows in one place." and
    a link, **+ Add another place**, which opens the same box;
  - at the foot, **Unsubscribe from Alpha** in red words, which leaves every
    source of theirs at once, with Undo.
- **A source's settings** (`/people/12/sources/34`, from Edit's ›), titled
  by its **kind** (read from the feed: a newsletter, a YouTube channel is
  Video, a feed with any episode is Podcast, anything else Blog; no longer
  the reader's to correct, decision 0183): YouTube's Include Shorts and Include live streams (section 38), Pause for a
  while, **Find new address** while it's
  failing (section 17), and at the foot **Take out of Alpha**: it becomes a
  person or publication of its own, guessed afresh, with Undo. Done saves
  and goes back to Edit.
- **+ Add a source** opens in place: choose someone already followed, or
  paste the address of their blog, channel or newsletter (followed as + Add
  would). If the address offers several feeds, the choices show first. If
  the two being joined are in different folders, it asks which folders to
  keep, all ticked to begin with. Either way they become one person, and
  their list opens with "Alpha is one person now · Undo". Undo puts every
  source back as it was, with its own folders and each under the name it
  had; a source followed just then is unfollowed again. The person keeps
  the name they had, or, for two sources on their own, takes the first one's
  (the one the reader started from).
- **nine turtles never joins sources by itself, and never asks.** Only the
  reader joins them (decision 0163 removed "Is this the same person?").
- **A folder can become a person:** Edit folder has a tick box row, **This
  is one person** ("Everything in it becomes one row, "Alpha", with one page.
  The folder goes; you can undo it straight afterwards."). Saving with it
  ticked joins everything in the folder into one person named as the folder
  (renamed first, if the name changed), deletes the folder (its rules
  wait, as when a folder is deleted, section 15), and opens
  the person's list with "Alpha is one person now · Undo", which makes the
  folder again with everything in it, and its rules.
- **Addresses:** `/people/12` and `/publications/7` for a list, `…/about`
  for the page, `…/edit` for Edit, `/people/12/sources/34` for a source's
  settings. Old `/feeds/12` and `/feeds/12/edit` addresses still open, and
  the address bar is tidied to the new one. An address for someone the
  reader doesn't follow says so plainly, on a computer and a phone alike: "Not found", and "You don't follow anyone at this address. It may have been an old one."
- **Unsubscribing** from a person leaves every source of theirs (Undo brings
  them all back). To leave one source only, take it out first. Following a
  source again later starts it afresh, on its own. Find new address keeps the
  source in its person. Each reader's people and publications are theirs
  alone.

**How to check it**
1. Follow a blog by one person and a site with several writers: the blog is
   under **People**, the site under **Publications**. A blog that signs every
   article with one author's name is called by that name, and its page shows
   the blog's title under it; Write back at an article's end says "Write
   back to" and their full name, as in the sidebar.
2. Press a person's name at the top of their list: their page opens beside
   the list (on a phone, as its own screen), with **Write to …** under
   their name and their sources, and no muted line.
3. Press **Edit**, change **This is** to A publication, press **Done**: the
   row moves under Publications.
4. In Edit, press **+ Add a source** and choose someone in another folder:
   it asks which folders, all ticked. Join: one row, both lists in one, each
   row labelled by kind. Undo: two rows again.
5. In Edit on that person, press › on a source, then **Take out of …**: two
   rows again. Undo joins them back.
6. Press **Unsubscribe from …** on a person with two sources: the row goes.
   Undo: it's back with both.
7. Make a folder holding two sources, open Edit folder, tick **This is one
   person** and Save: the folder is gone, one row with its name. Undo: the
   folder is back with both.
8. Visit an old `/feeds/N` address: the list opens and the address bar shows
   `/people/N` or `/publications/N`.
