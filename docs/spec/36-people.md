# 36. People and publications

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.
Decision 0146 made people; decision 0163 (agreed with the owner on 3
November 2026) added publications and one page for both; decision 0254 made
that one page hold their settings too, with no Edit mode; decision 0264
added "could be either" and says why.
PLAN.md → V1, item 1.*

**What it does**
- **Someone or something.** Everything a reader follows is either a
  **person** (someone) or a **publication** (something, such as a magazine
  or NASA's picture of the day). A person has one or more **sources**: a
  blog, a YouTube channel, a newsletter, a podcast. A **folder** is a group
  of people and publications. On these screens nine turtles never says
  "feed"; the word stays only in technical spots (importing or exporting a
  feed list).
- **Two headings.** In the sidebar, rows not in a folder sit under
  **People**, then **Publications**, each A to Z by name. Folders hold
  both. "Publications" names that sidebar heading only: a person's blog or
  channel is never called a publication. A person with several sources has
  one row, with their name, and a dot when any source has something unread,
  in every folder any of their sources is in.
- **Which is which** (decision 0264). A source joined to others is always
  a person. For a source on its own, nine turtles sorts it once, from the
  feed alone (it never fetches a page to find out), by the first of these
  that fits, and keeps why:
  1. a YouTube channel or playlist: **could be either** (a vlogger's channel
     and a company's sign their videos alike);
  2. several names sign its articles: a publication;
  3. one name signs them, a person's name (not a role such as "admin", nor
     the feed's or the site's own name): a person;
  4. no such name, and the site is someone's own: a place of theirs on a
     site many people share (a Substack, Medium, a Bluesky account and the
     like), a title that says it's someone's ("Jeff Kaufman's Writing"), or
     an address that is a name-like title run together (janedoe.com, "Jane
     Doe"): a person;
  5. no such name, and the site's own name is a whole word of its title
     (NASA at apod.nasa.gov, "NASA Picture of the Day"): a publication;
  6. a folder it came in (from an imported list) says which, by a whole
     word of its name: Friends, Family, People, Personal or Writers for a
     person; News, Newspapers, Magazines, Publications, Companies, Media or
     Press for a publication;
  7. anything else: **could be either**.

  **Could be either** acts as a publication everywhere (under
  Publications, no Write back) until the reader settles it: by a tick on
  Everyone you follow (section 15), in their settings, in Add's question, or at
  the end of one of their articles (section 7). Their settings say why under
  **This is**: "nine turtles chose this: one name signs every article." (or
  "the site is someone's own", "several names sign its articles", "it
  writes under its site's own name"), "nine turtles chose this from the name
  of the folder it came in.", "nine turtles couldn't tell: no name signs
  their articles. Kept as a publication until you choose.", "nine turtles
  can't tell a person's channel from a company's. Kept as a publication
  until you choose.", or "Your choice."; while it could be either, neither
  option is chosen, so one press settles it. Someone followed before this
  change keeps the setting they had, with no line.

  When adding through **+ Add** (section 3), the reader is asked to finish
  "Tomas Berg is…" with one of two tiles (**A person**, "Someone you might
  write back to."; **A publication**, "Anything you only read or watch, and
  won't write back to."), with nine turtles' choice already chosen and the
  line under them saying why ("nine turtles chose this: one name signs
  every article. You can change this later in their settings."). When it
  couldn't tell, neither is chosen, and the line says "nine turtles couldn't
  tell from their feed. Left as it is, they're kept with Publications. You
  can change this later in their settings."; Done leaves them so. They can
  change it later in their settings (for one source only, and not for the last
  source left of someone joined, who stays a person). An imported feed is
  sorted once nine turtles has checked it for the first time, so the rules
  see its writers.
- **A feed's own name, tidied** (decision 0260). Many feeds wrap their
  name in words that only say it's a feed: nine turtles takes them off
  once, as the feed arrives, so "Blog – Pete's Site » Latest Posts" is
  "Pete's Site", "Posts on Small Kitchen" is "Small Kitchen" and "Maren
  Holt's Blog RSS Feed" is "Maren Holt". Only the wrapping goes (Blog, Feed,
  RSS, Atom, Posts, Latest posts, Home and the like, as a part of their own
  between – | » · and similar, or "Posts on …", "… RSS Feed", "…'s Blog"); a
  name made only of such words stays whole. Someone already followed by the
  feed's untidied name is tidied at its next check; a name the reader gave,
  or brought from another app under another name, is never touched. A
  title whose symbols a blog coded twice ("Tom &amp;amp; Jerry",
  "&amp;#8217;") shows them as themselves ("Tom & Jerry", "’"), for
  articles arriving from now on.
- **Called by their name** (owner's plan, step 2). When a source on its
  own is first sorted a person by its one name and every one of its articles is signed by
  the same one author (in any capitalisation), the person is called by that
  name, as the feed writes it ("Tomas Berg", not his blog's title "Notes
  from Tomas"). A role or placeholder ("admin", "editor", "staff" and the
  like) is never taken for a name. When the feed doesn't name one author,
  the blog's title stays, and their Name setting fixes the rest. A name the reader gave (on
  their page, or in the app they imported from) always wins: nine turtles only renames a person still called by
  their feed's own title (as the publisher last gave it, never a name brought
  from another app), once, when it first guesses them; people followed
  before this change are renamed the same way, once, at their feed's next
  check. An Atom feed that names its author once, for all its entries, signs
  each of them, so it counts as one author for sorting too (an
  organisation named as a feed's only author is sorted a person, unless the
  name is the feed's or the site's own, and their settings fix it). Only "No, a publication" in the question after
  adding gives back the feed's title; changing **This is** in their settings later
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
- **Their page,** the same for a person and a publication (but a
  publication has no Write to, decision 0192), with no Edit mode
  (decision 0254) (`/people/12/about`): a page about them, with their
  settings on a page of its own, one press away (decision 0267). Opened by pressing their name at
  the top of their list ("Alpha ›"), by their name under an article's title
  (underlined, faintly), by **Info about Alpha** in the list's More menu or
  a row's own menu, or by the `i` key (in any list, for the chosen
  article's writer; decision 0214). On a computer it opens in the reading
  area beside their list, where an article would, in the article's own
  column (decision 0219), under the article's bar with an **×** at its
  right end (and Escape) back to their list; on a phone it's a screen of its
  own, with ‹ back to their list. Top to bottom:
  - **Their name**, large, as an article's title is; under it **where they
    publish**, each place a link to its own website, 44px to touch: by its
    own title when that isn't their name ("Notes from Tomas" under Tomas
    Berg, decision 0167), else a blog by its website ("alpha.example") and a
    channel or newsletter by its own name; one called just what they are by
    what it is, "Website" or "YouTube channel";
  - while a source is paused, the line saying so with Resume (section 15,
    decision 0239); while one isn't working, the line naming it with Find
    new address (section 15);
  - for a person, **Write to Tomas Berg**, an outlined button with the
    paper plane (their name leads the page, decision 0267), with the address under it once nine turtles knows it
    (section 37), and **Change** beside the address, which opens the same
    box as Write back's, filled with it, to correct it (Save, Not now);
  - one card, a grouped list's tone and corners, holding what's yours of
    them, a hairline between the two (decision 0267):
  - **Your note** (section 42), "Add a note…" while there's none;
  - **Your highlights**, the words you highlighted in their writing (the
    newest article first, at most 20; Notes has them all), each as at an
    article's end, with "From {title} · {day}" (the title opens the
    article) and your note on it, an untitled piece by its opening words
    (section 6); with none, "Nothing highlighted yet." and "Words you
    highlight in their writing gather here."; if they can't be loaded, one
    quiet line says "Your highlights from their writing couldn't be loaded.
    Open the page again to try once more." (decision 0211). There is no
    Lately: their list already shows their newest (decision 0215);
  - last, one row built as Settings' own rows are: the cog, **Settings**
    and ›, which opens their settings.
- **Their settings** (`/people/12/settings`, decision 0267): a page of its
  own, where their page was, titled **Settings** with **‹ Tomas Berg**
  above the title. That and Escape go back to their page, with the
  keyboard on its Settings row; on a computer the **×** stays at the
  bar's right end and goes back to their list. The keyboard starts on
  the title, and Tab goes to Name. Each setting changes the moment it's
  touched, with no Save, Cancel or Done (decision 0254). Top to bottom:
    - **Name**, kept on Enter (the keyboard stays in the field) or on
      leaving the field, with "Saved." under it; Escape while typing puts it
      back. An empty name isn't kept ("Give them a name."); a name that
      couldn't be saved stays as typed, with why under the settings;
    - for one source, **This is: A person / A publication**; A publication
      takes Write to and its address away at once (decision 0192);
    - **Folders**, the folders they're in, in words ("1 and Friends",
      "None"); pressed, every folder opens under it in place as a tick
      list, each tick counting at once, with **New folder…** as its first
      row, above the folders (decision 0261; Enter makes it and puts them in it; the sidebar opens it; Escape
      empties it, and only an empty one's Escape leaves the page). One list
      for all their sources;
    - **Pause for a while**, every source of theirs at once;
    - for a YouTube channel on its own, **Include Shorts** and **Include
      live streams** (section 38);
    - **Hide articles about… ›**, which opens Settings › Hiding with the
      field set to them ("Only from …", section 27); its back button then
      reads "‹ Alpha" and leads back to their settings;
  - for someone with two or more sources, **Sources**: each by its name
    over its kind (Blog, Video, Newsletter, Podcast, read from the feed and
    no longer the reader's to correct, decision 0183), with **Take out** at
    its end (it becomes a person or publication of its own, guessed afresh,
    with Undo), and a channel's two switches under it;
  - **+ Add a source** (for a person with one source, **+ Add their
    newsletter, videos or podcast**, decision 0241);
  - apart, **Unsubscribe from Alpha** in red words, which leaves every
    source of theirs at once, with Undo.

  The old addresses for Edit (`/people/12/edit`) and a source's settings
  (`/people/12/sources/34`) open their settings, and the address bar is
  tidied to `…/settings`; so does `e` in their list.
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
- **Dropped onto someone** (decision 0250): in the sidebar, someone held
  (section 5) and let go on another person or publication's row makes the
  two one person, at once, under the name of the one dropped on (their name,
  or, for a source on its own, its title). While they're held over the row,
  the row takes the drop tone and the lifted name says "One person with
  Maya Chen". They keep every folder either was in, and the note at the
  sidebar's foot says "Maya Chen is one person now." with Undo, which puts
  each source back as + Add a source's Undo does. For the pointer only; the
  keyboard joins them with + Add a source.
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
  for the page and `…/settings` for their settings (`…/edit` and `/people/12/sources/34` open the settings too). Old `/feeds/12` and `/feeds/12/edit` addresses still open, and
  the address bar is tidied to the new one. An address for someone the
  reader doesn't follow says so plainly, on a computer and a phone alike: "Not found", and "You don't follow anyone at this address. It may have been an old one."
- **Unsubscribing** from a person leaves every source of theirs (Undo brings
  them all back, and so does Bring back for 30 days, as one row under
  Recently unsubscribed, decision 0240). To leave one source only, take it out first. Following a
  source again within its 30 days brings it back whole, in its person;
  after that it starts afresh, on its own. Find new address keeps the
  source in its person. Each reader's people and publications are theirs
  alone.

**How to check it**
1. Follow a blog by one person and a site with several writers: the blog is
   under **People**, the site under **Publications**, and each one's settings say
   why under This is. A blog that signs every
   article with one author's name is called by that name, and its page shows
   the blog's title under it; Write back at an article's end says "Write
   back to" and their full name, as in the sidebar.
2. Press a person's name at the top of their list: their page opens beside
   the list (on a phone, as its own screen), with **Write to …** (outlined) under
   their name and their sources, one card with Your note and Your
   highlights, then one row, **Settings ›**, and no muted line. Press that
   row: their settings open in its place, titled Settings, with
   **‹ their name** above. Press it, or Escape: their page again, with the
   keyboard on the Settings row.
3. In their settings, choose **This is: A publication**: the
   row moves under Publications at once, and on their page Write to has gone.
4. In their settings, press **+ Add their newsletter, videos or podcast** and choose someone in another folder:
   it asks which folders, all ticked. Join: one row, both lists in one, each
   row labelled by kind. Undo: two rows again.
5. In that person's settings, press **Take out** on a source's row under
   Sources: two rows again. Undo joins them back.
6. Press **Unsubscribe from …** on a person with two sources: the row goes.
   Undo: it's back with both.
7. Make a folder holding two sources, open Edit folder, tick **This is one
   person** and Save: the folder is gone, one row with its name. Undo: the
   folder is back with both.
8. In the sidebar, drag one blog onto another's row: the lifted name says
   "One person with …" and the row darkens. Let go: one row, under the
   name of the one dropped on, with "… is one person now." and Undo, which
   parts them again (decision 0250).
9. Visit an old `/feeds/N` address: the list opens and the address bar shows
   `/people/N` or `/publications/N`.
10. Highlight words in an article of someone's, then open their page: under
   Write to and your note, **Your highlights** shows those words, "From" the
   article's title, and there is no Lately. Press the title: the article opens.
11. Import a list with a blog whose articles name no one, at an address
   that isn't a name: it's under Publications, and its page says "nine
   turtles couldn't tell…" with neither option chosen. Choose A person: it
   moves under People, and the line says "Your choice.".
