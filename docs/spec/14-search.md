# 14. Search

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- `/` puts you in the search field, which sits under the list's title: a slim, faintly filled field with soft corners and no edge, 36px tall with a mouse on a wide window and 44px on a touch screen or a phone, the same field as the sidebar's find field. A faint search icon starts the field; the "Search options" (sliders) button sits inside it at its right end.
- Results follow a moment after you stop typing, or at once on Enter. Every word must appear; a word also finds longer words it begins ("read" finds "reading"); words in double quotes are found together.
- The search starts out limited to where you are, shown as a removable chip inside the field, e.g. `[ in: Tech × ]`, as soon as you're in the search (the field focused, its options open, or words typed). At rest the field just says "Search", since the list's title already names it. Remove the chip to search everything.
- **Search options** opens a small popover under its button, floating over the list rather than pushing it down, drawn as a menu: two short sections of rows, with a checkmark at the start of each one that holds and its words semibold (decision 0188). **Search in**: the list you started from (marked "This list") and **Everything**. **Show only**: **Starred**. Nothing else: searching another feed or folder means going there first, and unread, notes and dates are left to the lists themselves (Unread, Notes) and to the sort order. The rows are radio buttons and a tick box underneath, for keyboards and screen readers. Escape closes it and returns to its button (a second Escape closes the search); so does a press outside it, or the keyboard moving out of the search. The panel and the chips always match. The search box stays one line for its one or two chips: they shrink and end in "…", with their whole text in a tooltip; on a narrow list it wraps, so every chip stays readable.
- Titles and article text are always searched together; title matches come first.
- Highlights and notes are searched too: section 42.
- **Nothing is typed as a filter** (decision 0180): searching is typing words. Where to search and Starred are chosen in the options; each choice shows as a chip in plain words (**in: Tech**, **Starred**). `is:starred` is searched as ordinary words. Backspace at the start of the field removes the last chip.
- Results look and behave like the normal item list, including "Mark all as read" in the More menu. The list's title says where they come from: **"Results in All articles"**, or "Results in {the feed, folder, Unread or Starred}" while the search is limited to one. A quiet line above the results says how many were found ("16 results", or "50+ results" while more can load). Where the search options would cover that line (a narrow list, or a phone), the options repeat it in a quiet line at their foot, so ticking a filter always shows how many it leaves (decision 0054). Refresh is hidden while searching: there's nothing new to fetch for a search.
- Matching words, in a title and in the line of text under it alike, have a faint tone of the theme's accent behind them with small rounded corners and a fine underline (so never tone alone), in the text's own weight (decision 0037). Screen readers hear them as highlighted.
- Under the title of each result whose text (not only its title) holds a searched word, up to two muted lines show that text around the first match, before the source and time: a few words before it, then on to about 90 characters, cut only between words, with "…" where text was left out, and ending in "…" if the list is too narrow for two lines. Three typed dots in the publisher's text show as one "…" too. The searched words in it are marked as in the title, and in full ink rather than muted grey. The line is plain text: nothing from the feed's HTML comes through.
- Once the field has words in it, a **×** at its end ("Clear search", a 44px target) empties the field, keeping any chips, and leaves the keyboard in it.
- Works for English, other Latin-alphabet languages, and Hindi.
- Searches can't be saved (decision 0174, which removed saved searches): the search field starts empty each time.
- Tab moves from the field into the open options, onto the place being searched; Escape closes search and returns you to where you were.

**How to check it**
1. In a folder, press `/`, type a word you remember from an article. The chip shows the folder; results appear with the word marked by a faint tone behind it and a fine underline, and a result whose text holds the word shows a line of that text with the word marked the same way. Press × to empty the field.
2. Remove the chip: results now come from all feeds.
3. Open the options, tick Starred: a chip says "Starred", and only starred items are listed.
4. Open the options, choose This list: the place chip comes back. The options hold only Search in and Starred.
5. Search a Hindi word from a Hindi article: that article is found.
6. Press Escape: you're back exactly where you were.
