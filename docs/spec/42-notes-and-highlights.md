# 42. Notes and highlights

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.
V1 item 8 (`docs/PLAN.md`), decision 0164.*

Private marks of the reader's own: words highlighted in an article, a note
on a highlight, a note on the whole article, and a note on each person.
Only the reader ever sees them. Nothing about them is public, shared, sent
anywhere or counted.

**Highlighting words in an article**
- Choosing words in an article's text (with the mouse, a finger, or the
  keyboard where the browser allows it) opens a small menu beside them:
  **Highlight** (its key, `h`) and **Add a note…**, then, for a person's
  article, **Write back about this** under a hairline (section 37,
  decision 0205).
- Right after highlighting, a small menu beside the words says
  **Highlighted**, with **Add a note…** (the note box opens there) and
  **Done** (the owner, 3 November 2026: a new reader shouldn't have to find
  the note at the article's end).
- A highlight is drawn in soft pencil: a faint tone of the ink behind the
  words and a fine line under them, in every theme, never a color of its
  own. One with a note ends in a small page icon.
- Pressing a highlight opens its own menu: its note (if any), **Edit note**
  (or **Add a note…**), **Copy** (the words in quotation marks, then the
  publisher's name and the article's link) and **Remove highlight**, then,
  for a person's article, **Write back about this** under a hairline. A
  removed highlight shows "Highlight removed · Undo" at the article's foot
  until something else is done.
- A note is written in a box in place, with **Save** and **Not now**. An
  empty note takes the note off, never the highlight.
- **Nothing typed is thrown away** (decision 0235). The box stays open, with
  the words, until the save is confirmed (Save says "Saving…" after half a
  second). If it fails, the message sits under the words in oxblood with the
  alert icon, "The note couldn't be saved, so your words are still here.
  Try again in a moment.", and Save becomes **Try again**. A note written
  and not saved is kept on this device: Not now, Escape, a press outside
  the box, Back and going to another article all keep it. Coming back to
  the article, its box is open at the end with the words and "**Not saved
  yet.** Kept from when you left this article." (a note on highlighted
  words waits under its highlight; one on words chosen but not yet
  highlighted waits under those words, and Save highlights them). Opened
  again without leaving, the box says "**Not saved yet.**". **Discard**
  beside the line throws the words away, with "Note discarded · Undo" at
  the article's foot (the keyboard on Undo). The same for the note on a
  person ("Kept from when you left this page."), its Undo in place.
- **`n`** writes a note on the words chosen; with none chosen, a note
  on the whole article.
- A highlight keeps its words and a little of the text either side, never a
  position: if the publisher changes the article, the words are found again
  wherever they now are. Words no longer in the article stay in the list
  below, marked "No longer in the article".

**At the article's end**
- Under the closing rule, above Write back (section 37): **Your
  highlights**, each quote with its note, **Edit note** (or **Add a
  note…**), **Copy** and **Remove**; pressing a quote shows it in the text.
  Remove puts the keyboard on Undo. Then
  **Your note**, the reader's note on the whole article, with **Edit note**.
- The More menu's **Add a note…** (and `n`) opens the note box there:
  "A note on this article", "Only you see it. Search finds it, and Your
  data exports it."

**Videos and podcasts**
- On a YouTube video (section 38) or a podcast's episode (section 35) that's
  playing, a new note starts with the time it's at ("12:34 "). Each time in
  a note on such an article is a button that takes the player back there.

**Without a connection** (section 32)
- With a connection, a change the server won't take (a note too long, an
  article gone) goes back to how it was, and the top bar says why in plain
  words; nothing is lost without a word.
- Highlights and notes are still made and shown at once. They're kept on
  this device and sent, in order, as soon as the connection is back. Until
  then one quiet line stays at the article's foot: "You're offline. This is
  saved on this device only, and reaches your account once you're back
  online."
- The Notes list needs a connection; it says so, as search does.

**Notes**
- **Notes** in the sidebar, under Starred, lists every article the reader
  highlighted or wrote a note on, in the reader's order, each with its first
  highlight ("Highlighted · …") or its note ("Your note · …") under the
  title. The row is there from the first day (decision 0222): before any
  highlight or note, its list says "No notes yet." and how to make one.
- A marked article is kept like a starred one: the yearly clean-up and
  unsubscribing leave it (unless the reader chooses otherwise, below).

**A note on a person** (section 36)
- A person's page has **Add a note…**, or **Your note** with **Edit note**:
  where you met, when you last wrote. It's the same on each of their places,
  and joining places into one person joins their notes.
- The sidebar's "Find a person or folder" finds a person by it.
- Their page also lists **Your highlights** from their writing, the
  newest article first, at most 20 (decision 0211); Notes keeps them all.

**Search** (section 14)
- Search finds articles by the words of their highlights and notes as well
  as their own. A result found that way says so: "Highlighted · …" or "Your
  note · …".
- A search started in **Notes** looks only through marked articles
  (its chip says "in: Notes"); search has no notes filter of its own
  (decision 0189).

**Unsubscribing** (section 15)
- When the reader starred, highlighted or wrote a note on any of a place's
  articles, or wrote a note on the person, Unsubscribe asks first: "Keep
  what you saved from {name}?", saying what there is, with **Keep them**
  and **Cancel** together; then, under a hairline, apart (decision 0239),
  "Or, if you don't want them any more:" and an oxblood button that names
  exactly what goes: "Remove the 2 starred articles too", "Remove the
  starred article, the 3 highlighted or noted articles and your note on
  them too". Keep them works as unsubscribing always has. The red button
  removes those articles, their highlights and notes, and the note on the
  person as well. Either can be undone straight
  afterwards; once Undo's ten minutes are over, what was chosen is done.
  The place itself is still kept 30 days under Recently unsubscribed
  (section 15, decision 0240); Bring back returns it without what was
  removed, and Undo from then says "It's too late to undo that." rather
  than bring back less than it promises.
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
  write a note on an article or a person.

**How to check it**
1. Open an article, choose a few words, press **Highlight**: they're drawn
   in soft pencil, and listed under Your highlights at the end.
2. Press the highlight, **Add a note…**, type and Save: a small page shows
   after it. Reload: both are still there.
3. Press `n` with nothing chosen: write a note on the article. Notes
   appears in the sidebar and lists the article.
4. Search for a word of the note: the article is found, "Your note · …".
5. Turn the connection off and highlight something: the quiet offline line
   shows; turn it on, and the line goes.
6. On a person's page, Add a note…, then type a word of it in the sidebar's
   find field: the person is found.
7. Their page › Edit › Unsubscribe: it asks what to do with what you
   saved. Choose Keep them: Notes still lists the article.
8. Settings › Your data › Export notes and highlights: a Markdown file with
   all of it.
