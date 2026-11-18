# 0308: Notes, grouped by person

**In one line:** the Notes list is grouped by person, as Unread is: each name once with no day, the person with the newest mark first and their newest marks first; each article shows the reader's marks (marker icon for a highlight, page icon for a note) with its title quiet under them, and the list comes whole.

*18 November 2026. Item 4 of the Jony Ive critique, round two, agreed by the owner in the mockups ("what we agreed").*

**What changes.**
1. **Grouped by person** (`server/src/feeds/notes_list.rs`, SPEC section 42). A person is who Unread groups by (`whose!`: their joined places, else one place). People are placed by their newest mark (highlight or note, by when it was made), articles within them by theirs; ties go to the later mark. Publications are mixed in by the same order with no "People" or "Publications" labels: Notes is about what you kept, not who's a person.
2. **Marks, not dates.** Each article brings its marks, newest first (`marks` in place of the old `highlighted` and `noted`, which are gone). The row shows them with the icons from decision 0307, then the title, quiet; no date, no unread dot and no Mark all as read at its end, since Notes isn't about what's left to read.
3. **One page.** The list comes whole instead of 50 at a time: it's the reader's own marks, a short list even for a heavy highlighter, and a page boundary would split a person. The Sort setting doesn't apply.
4. Search from Notes is unchanged: its results are articles, each with "Highlighted · …" or "Your note · …".

**Considered and not taken.** One row per mark: then one article's marks could be split across rows, and choosing a row would no longer mean choosing an article (j and k, the reading area, a row's menu all work on articles). Dates beside names or marks: the owner chose none.

**Revisit if** a reader's Notes grows to thousands of articles and loading it whole is slow.
