# 36. People

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.
Decision 0146; the shape agreed with the owner on 2 November 2026 (PLAN.md →
V1, item 1). The page's look isn't final: it gets a refinement round.*

**What it does**
- **A person is one human with one or more places on the web:** a blog, a
  YouTube channel, a newsletter. A **folder** is a group of people. Readers
  learn only these two words: on the sidebar, a person's page and Edit person,
  nine turtles never says "feed".
- **One row, one page.** Each person is one row in the sidebar, under
  **People** (or in their folders), A to Z by their name. A place nobody has
  joined to another is a person with one place: its row looks exactly as
  before. A person with several places has one row, with their name, its count
  their places' counts added up, in every folder any of their places is in.
- **Their list:** choosing the row lists everything they made, newest first
  (or as the reader sorts), one list across all their places
  (`/feeds/3`, any of their places' numbers). With two or more places, each
  row says which place it came from in place of their name: **Blog**,
  **Video**, **Newsletter**, or **Podcast** for an episode. Everywhere else
  (Unread, All, Starred, search, Recently read, the article's own line) an
  article is credited to the person by their name. Mark all as read, "new
  articles", search in their list and reading offline all cover every place.
- **Their page:** on a window with the reading area, until an article is
  opened, it shows their page instead of the quiet line: their name (Literata,
  28px), then their places as a two-column list, each by what it is (Blog,
  Video, Newsletter, in the muted grey) with a link to the publisher's own site
  (a blog by its website, "alpha.example"; a channel or newsletter by its own
  name), then **Following** since the month the reader followed their first
  place ("since March 2026", "since this month"). Under it: **Add another
  place**, **Edit person…**, and, while the list has something to open, how
  to open it (the same tip as the quiet line's, decision 0062). Searching in
  their list shows the quiet line again. Once nine turtles knows where to
  write to them, an **Email** line between their places and Following holds
  it (section 37).
- **Add another place**, on the page and in Edit person, opens in place: a
  list of everyone else the reader follows ("Someone you already follow",
  then **Join**), and a field for the address of their blog, channel or
  newsletter (**Follow and join**: followed as Add a feed would, then joined;
  a site offering several feeds gives its first). Either way their list opens
  with "Alpha is one person now · Undo". Undo puts every place back as it was,
  with its own folders and each person under the name they had; a place
  followed just then by Follow and join is unfollowed again. The keyboard
  starts on the first field, and Not now puts it back on the button.
- **Joining** puts every place of the person in every folder any of them was
  in; the person keeps the name they had, or, for two places on their own,
  takes the first one's (the place the reader started from). Places of two
  people joined become one person.
- **"Is this the same person?"** nine turtles never joins places by itself.
  It asks, once per place, only on clear evidence: two places the reader
  follows on the same website of their own (`alpha.example` and
  `www.alpha.example/news`), never on a site many people share (YouTube,
  Substack, Medium, GitHub and the like). The question sits on the person's
  page, a quiet bordered box: "Is Alpha's letters the same person as Alpha's
  blog?", "Their places are on the same website.", then **Yes, they're one
  person** and **No**. Yes joins them, with Undo; No (or joining them any
  other way) and it's never asked about those places again.
- **Edit person** (the list's More menu, `Shift+E`, or the page's **Edit person…**;
  the sheet at `/feeds/3/edit` that was Edit feed, SPEC section 15): **Name**
  (the person's; for a place on its own, as before), then **Email address**
  (where Write back writes to them, section 37), then **Places**, each by
  what it is and its name, with Add another place under them and, on a person
  with several, "Alpha's letters isn't the same person", which makes that
  place a person of its own again ("… is on its own again · Undo"). Each other
  place has **Its settings**, which opens the sheet on that place. Then the
  **Folders** (one list for all their places: saving puts every place in
  exactly those), then this place's own **Settings** ("Settings for this
  blog" on a person with several), Add a rule…, and Unsubscribe (from this
  place only; its tooltip says so).
- **A folder can become a person:** Edit folder has a tick box row, **This
  is one person** ("Everything in it becomes one row, "Alpha", with one page.
  The folder goes; you can undo it straight afterwards."). Saving with it
  ticked joins everything in the folder into one person named as the folder
  (renamed first, if the name changed), deletes the folder (its rules and
  saved searches wait, as when a folder is deleted, section 15), and opens
  the person's list with "Alpha is one person now · Undo", which makes the
  folder again with everything in it, its rules and its saved searches.
- **Unsubscribing** from a place leaves the person with their other places;
  following it again later starts it afresh, on its own. A person whose places
  are all gone leaves the sidebar. Find new address keeps the place in its
  person. Each reader's people are theirs alone.

**How to check it**
1. Follow two blogs on one website (a blog and its newsletter page). Open the
   second: its page asks "Is … the same person as …?". Press **Yes, they're
   one person**: one row, both lists in one, each row labelled Blog. Press
   Undo: two rows again.
2. On a person's page, press **Add another place**, choose someone you follow
   and press **Join**: one row with both their names' articles, labelled by
   place. Open Edit person: both places are listed, with "Its settings" on the
   other one.
3. In Edit person, rename them and tick a folder, then Save: the row has the
   new name, in that folder, and Unread credits their articles to that name.
4. In Edit person on a person with two places, press "… isn't the same
   person": two rows again. Undo joins them back.
5. Make a folder holding two places, open Edit folder, tick **This is one
   person** and Save: the folder is gone, one row with its name. Undo: the
   folder is back with both.
6. Follow a blog on its own: its row and list look as before; its page shows
   one place and since when.
