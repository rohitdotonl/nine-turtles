# 42. Notes and highlights

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.
V1 item 8 (`docs/PLAN.md`), decision 0162.*

Private marks of the reader's own: words highlighted in an article, a note
on a highlight, a note on the whole article, and a note on each person.
Only the reader ever sees them. Nothing about them is public, shared, sent
to other apps (section 22) or counted anywhere.

**Highlighting words in an article**
- Choosing words in an article's text (with the mouse, a finger, or the
  keyboard where the browser allows it) opens a small menu beside them:
  **Highlight** (its key, `h`) and **Add a note…**.
- Right after highlighting, a small menu beside the words says
  **Highlighted**, with **Add a note…** (the note box opens there) and
  **Done** (the owner, 3 November 2026: a new reader shouldn't have to find
  the note at the article's end).
- A highlight is drawn in soft pencil: a faint tone of the ink behind the
  words and a fine line under them, in every theme, never a color of its
  own. One with a note ends in a small page icon.
- Pressing a highlight opens its own menu: its note (if any), **Edit note**
  (or **Add a note…**), **Copy** (the words in quotation marks, then the
  publisher's name and the article's link) and **Remove highlight**. A
  removed highlight shows "Highlight removed · Undo" at the article's foot
  until something else is done.
- A note is written in a box in place, with **Save** and **Not now**. An
  empty note takes the note off, never the highlight.
- **Shift+H** writes a note on the words chosen; with none chosen, a note
  on the whole article.
- A highlight keeps its words and a little of the text either side, never a
  position: if the publisher changes the article, the words are found again
  wherever they now are. Words no longer in the article stay in the list
  below, marked "No longer in the article".

**At the article's end**
- Under the closing rule, above Write back (section 37): **Your
  highlights**, each quote with its note, **Edit note** (or **Add a
  note…**) and **Remove**; pressing a quote shows it in the text. Then
  **Your note**, the reader's note on the whole article, with **Edit note**.
- The More menu's **Add a note…** (and Shift+H) opens the note box there:
  "A note on this article", "Only you see it. Search finds it, and Your
  data exports it."

**Videos and podcasts**
- On a YouTube video (section 38) or a podcast's episode (section 35) that's
  playing, a new note starts with the time it's at ("12:34 "). Each time in
  a note on such an article is a button that takes the player back there.

**Without a connection** (section 32)
- Highlights and notes are still made and shown at once. They're kept on
  this device and sent, in order, as soon as the connection is back. Until
  then one quiet line stays at the article's foot: "You're offline. This is
  saved on this device only, and reaches your account once you're back
  online."
- The Notes list needs a connection; it says so, as Recently read does.

**Notes**
- **Notes** in the sidebar, under Starred, lists every article the reader
  highlighted or wrote a note on, in the reader's order, each with its first
  highlight ("Highlighted · …") or its note ("Your note · …") under the
  title. The row appears once there's a first highlight or note, and can be
  hidden in Settings › Show in the sidebar.
- A marked article is kept like a starred one: the yearly clean-up and
  unsubscribing leave it (unless the reader chooses otherwise, below).

**A note on a person** (section 36)
- A person's page has **Add a note…**, or **Your note** with **Edit note**:
  where you met, when you last wrote. It's the same on each of their places,
  and joining places into one person joins their notes.
- The sidebar's "Find a person or folder" finds a person by it.

**Search** (section 14)
- Search finds articles by the words of their highlights and notes as well
  as their own. A result found that way says so: "Highlighted · …" or "Your
  note · …".
- **With notes** in the search options (typed `is:noted`) shows only marked
  articles. Limited to a feed, it's that person's.

**Unsubscribing** (section 15)
- When the reader starred, highlighted or wrote a note on any of a place's
  articles, or wrote a note on the person, Unsubscribe asks first: "Keep
  what you saved from {name}?", saying what there is, with **Keep them**,
  **Remove them too** and **Cancel**. Keep them works as unsubscribing
  always has. Remove them too removes those articles, their highlights and
  notes, and the note on the person as well. Either can be undone straight
  afterwards; once the unsubscribe can't be undone, what was chosen is done.
- With nothing kept, Unsubscribe doesn't ask.

**Your data** (section 18)
- **Export notes and highlights** saves one Markdown file: each person
  with their note, then each marked article with its title linked to the
  original, its date, its highlights as quotations with their notes, and the
  note on the whole article.
- Delete all my data and deleting the account take them too.

**AI assistants** (section 33)
- A connected assistant can read the reader's notes and highlights, add a
  highlight (only on words the article has), change or remove one, and
  write a note on an article or a person. Other apps (section 22) never see
  them.

**How to check it**
1. Open an article, choose a few words, press **Highlight**: they're drawn
   in soft pencil, and listed under Your highlights at the end.
2. Press the highlight, **Add a note…**, type and Save: a small page shows
   after it. Reload: both are still there.
3. Press Shift+H with nothing chosen: write a note on the article. Notes
   appears in the sidebar and lists the article.
4. Search for a word of the note: the article is found, "Your note · …".
5. Turn the connection off and highlight something: the quiet offline line
   shows; turn it on, and the line goes.
6. On a person's page, Add a note…, then type a word of it in the sidebar's
   find field: the person is found.
7. Edit feed › Unsubscribe on that place: it asks what to do with what you
   saved. Choose Keep them: Notes still lists the article.
8. Settings › Your data › Export notes and highlights: a Markdown file with
   all of it.
