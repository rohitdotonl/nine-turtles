# 0123: Less chrome: space instead of lines, spaced-capital names, a rule as a sentence, a quieter Aa panel

*28 October 2026.*

**Decision.** The owner brought four design pictures (after Tufte, Vignelli,
Fukasawa and Rams) and asked for the app to follow them within its floors.
What each screen looks like is in `docs/SPEC.md` sections 5, 6, 7 and 27 and
`docs/DESIGN.md` Part 2; this note records what was taken and what wasn't.

1. **No lines between the list's rows.** Space parts one article from the
   next: 14px above a title and 15px below its meta line (was 10 and 11 with
   a hairline, decision 0041). The publisher's name in a row's meta line is
   in the muted grey, a step stronger than the time, so the credit reads
   first. The unread dot stays centred on the title's first line.
2. **Spaced capitals for names that head others.** The sidebar's section
   names (Folders, Feeds) and a folder's own name are small, semibold,
   uppercase and tracked, as Settings' group names are. A folder's name
   starts on the 20px margin with nothing before it: its show-or-hide arrow
   moves to the row's right end, showing in place of the count on hover, on
   the keyboard and always on touch (replacing decision 0041's arrow before
   the name), and choosing a closed folder opens it. Its feeds sit on the
   sidebar's one 46px name edge (no longer a step further in, decision 0043)
   with a faint 1px line down their left under the folder's name, and each
   folder group has 8px of room above it. Screen readers read the names as
   written. Sidebar feed names, like the list's, leave out a newsletter
   sender's address in brackets.
3. **A rule is one sentence.** "When a new article has ___ in its title, by
   any author, from all feeds, then mute it." Each blank is a real text box
   or menu with its own name for screen readers, 44px to press, with only a
   dashed line under it; what the chosen action does, and how words are
   found, sit under the sentence in quiet words.
4. **The Aa panel is one quiet line per setting:** its name in small spaced
   capitals at the left; Appearance as three swatches (white, black, half of
   each), the chosen one ringed in the text color; theme, font and line width
   as plain words, the chosen one semibold, in full ink and underlined, so
   it never shows by color alone.

**Not taken, and why.**
- An always-showing pill of reading settings over the article: it would sit
  on the text (principle 1); the same choices stay one press away behind Aa.
- Read articles faded below AA: the muted greys stay at 4.5 : 1 (first floor).
- Leaving out the publisher's name in a folder's list: crediting the source
  is the second floor. (A single feed's own list already leaves it out.)
- A grid drawn behind the reading pane: decoration that does no job.
