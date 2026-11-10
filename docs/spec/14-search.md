# 14. Search

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- `/` puts you in the search field, which sits under the list's title: a slim, faintly filled field with soft corners and no edge, 36px tall with a mouse on a wide window and 44px on a touch screen or a phone, the same field as the sidebar's find field. A faint search icon starts the field.
- Results follow a moment after you stop typing, or at once on Enter. Every word must appear; a word also finds longer words it begins ("read" finds "reading"); words in double quotes are found together.
- The search starts out limited to where you are, shown as a removable chip inside the field, e.g. `[ in: Tech × ]`, as soon as you're in the search (the field focused, or words typed). At rest the field says "Search articles", so it can't be mistaken for the sidebar's field that finds a person or folder by name (decision 0217); its label, which screen readers and voice control use, says the same. Remove the chip (its ×, or Backspace at the start of the field) to search everything; to search one place again, leave the search and start it there.
- **Nothing else to choose** (decision 0241, which removed the Search options panel of decision 0189): where you start is the filter. A search from Starred finds only starred articles, from Unread only unread ones, from Notes only what you marked, from a folder or a person only theirs; searching another feed or folder means going there first; dates are left to the sort order. The search box stays one line for its chip: it shrinks and ends in "…", with its whole text in a tooltip.
- Titles and article text are always searched together; title matches come first.
- Highlights and notes are searched too: section 42.
- **Nothing found in one place** (decision 0212): the empty list offers **Search all articles** (section 6), the same words, everywhere, at once; a search already everywhere offers nothing more.
- **Nothing is typed as a filter** (decision 0180): searching is typing words. `is:starred` is searched as ordinary words.
- Results look and behave like the normal item list, including "Mark all as read" in the More menu. The list's title says where they come from: **"Results in All articles"**, or "Results in {the feed, folder, Unread, Starred or Notes}" while the search is limited to one. A quiet line above the results says how many were found ("16 results", or "50+ results" while more can load). It is said once, nowhere else. Refresh is hidden while searching: there's nothing new to fetch for a search.
- Matching words, in a title and in the line of text under it alike, have a faint tone of the theme's accent behind them with small rounded corners and a fine underline (so never tone alone), in the text's own weight (decision 0037). Screen readers hear them as highlighted.
- Under the title of each result whose text (not only its title) holds a searched word, up to two muted lines show that text around the first match, before the source and time: a few words before it, then on to about 90 characters, cut only between words, with "…" where text was left out, and ending in "…" if the list is too narrow for two lines. Three typed dots in the publisher's text show as one "…" too. The searched words in it are marked as in the title, and in full ink rather than muted grey. The line is plain text: nothing from the feed's HTML comes through.
- Once the field has words in it, a **×** at its end ("Clear search", a 44px target) empties the field, keeping the chip, and leaves the keyboard in it.
- Works in English and other Latin-alphabet languages with or without accents ("cafe" finds "café"), Hindi words whole, Chinese and Japanese characters found side by side anywhere in a sentence ("阅读器"), and Arabic and Hebrew with or without their vowel marks (decision 0228), as do other languages that put spaces between words. Thai, Lao, Khmer and Burmese, also written without spaces, aren't searchable yet.
- Searches can't be saved (decision 0174, which removed saved searches): the search field starts empty each time.
- Escape closes search and returns you to where you were.

**How to check it**
1. In a folder, press `/`, type a word you remember from an article. The chip shows the folder; results appear with the word marked by a faint tone behind it and a fine underline, and a result whose text holds the word shows a line of that text with the word marked the same way. Press × to empty the field.
2. Remove the chip: results now come from all feeds.
3. Go to Starred, search a word from a starred article: the chip says "in: Starred" and only starred items are listed. There is no Search options button.
4. Search the same word from All articles: unstarred articles with it are found too.
5. Search a Hindi word from a Hindi article, and two or three Chinese or Japanese characters from the middle of a sentence: each article is found, the characters marked in its line of text.
6. Press Escape: you're back exactly where you were.
