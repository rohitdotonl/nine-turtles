# 0231: Fit what people already do: search, Command Z, going back, the tab

*10 November 2026.*

Rohit's "implement all suggestions from rounds 1 and 2 except P03-8"
(10 November 2026), from the critique through the principle "Fit what
people already do" (`critique-24/principle-03-fit-what-people-do.html` and
its round 2, in the project's files). This note covers the first four,
P03-1, P03-4, P03-5 and P03-7; the others get their own notes.

**What changed.**

1. **The box at the top searches articles too (P03-1).** Under what "Find a
   person or folder" finds by name, one row, **Search articles for “soup”**;
   it, or Enter in the field, searches every article for the same words in
   All articles, with the words in the list's search field. With no name
   found, the line says "No person or folder is called “soup”." rather than
   naming "the sidebar", our word for it. The field itself still finds only
   names as you type (the Exceptions log entry is unchanged).
2. **Command Z undoes (P03-4).** Command Z (Ctrl Z off a Mac) does what `u`
   does, never while typing in a field. It's the first shortcut with Command
   or Ctrl; every other one stays the browser's. It's one more key in the
   same table (decision 0103), so the cheat sheet, the key check and the
   Undo button's tooltip ("Undo (U or Command Z)") all come from it; the
   cheat sheet says "or" between keys that do the same thing.
3. **Settings' pages go back (P03-5).** On a phone, Settings has "‹ Home"
   where its X was, as every other phone screen goes back; Everyone you
   follow, Hidden articles and All readers have "‹ Settings", "‹ Hiding" and
   "‹ Readers" above their titles, as Settings' own pages already did
   (decision 0120). On a computer, Settings itself keeps its X: it opens
   over the place you were, and closing goes back there.
4. **The tab names the article (P03-7).** While an article is open the
   browser tab says "The pleasure of a slow letter · nine turtles"; with
   none open, the place's name, as before. History and the window title
   follow it.

**Why.** Principle 3, "Clear at a glance": familiar ways are kept unless
broken on purpose. The top box is where everyone types to find anything;
Command Z is the undo hands reach for without thinking; on a phone an X
means "close what popped up" and a back arrow "go back a step"; and every
website names what you're looking at in its tab. None of these breaks a
floor; they add no motion, color or count.

**How.** `searching.svelte.ts` gains `wordsEverywhere`; `keyboard.ts`
reads Command or Ctrl only for the table's `Mod+` keys, and `onMac` moved
there from `sidebarDrag.ts` (one copy); `PageHead`'s back line is reused;
`titleFor` takes the open article's title.
