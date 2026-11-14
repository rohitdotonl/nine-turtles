# 0271: Unread, by person

**In one line:** Unread names each person once, as a heading in the reading serif, with their unread titles under it (each with its day at the row's right end), people first by their newest unread article (oldest, sorting oldest first), then "Publications"; every other list, the weekly email and assistants are unchanged.

*14 November 2026. Flow 1 of the owner's design critique, "Unread: the person first, no extra presses", which the owner approved with its pictures.*

**What the owner saw.** Unread listed titles, each with the writer in small
grey type under it, so a person with three new articles took six lines and
their name was read three times. Suggested: each person's name once, their
unread titles under it, people first, publications after. Every title stays
one press away; a person with one article takes two lines, with three four.

**Decision.**
1. **Only Unread,** on a computer and a phone (and in the owner's trial,
   decision 0269, which is only a layout). All articles, Starred, Notes, a
   folder's list, one person's list and search results keep their order by
   time and their rows. Offline, Unread lists the copies on the device by
   time, as before (they carry no names to group by).
2. **Who is one person:** whoever the sidebar shows as one row: places
   joined into a person (decision 0146) are one; a place on its own is its
   own. Its name is shown exactly as a row showed it (`sourceOf`). People
   are whoever the sidebar files as people (a place not sorted yet
   included); publications, and one nine turtles couldn't sort (decision
   0264), come after "Publications". The rule is written once, `feeds::kind!`,
   for the sidebar, Everyone you follow and Unread.
3. **The order:** people by their newest unread article, newest first (by
   their oldest, when the reader sorts oldest first), their titles in the
   reader's order under them; then publications the same way. Ties go by
   number, so the order never shuffles.
4. **The look:** the name is a real heading in the reading serif at 20px,
   semibold, on the titles' edge, 24px above it, so a screen reader goes
   name to name: a person's name and "Publications" are `h3`, under the
   list's `h2`, and a publication's name is `h4`, under "Publications" (the
   look is the same). It can't be pressed: a row's name couldn't be either.
   Under it each title is a row as before (the unread dot, a semibold unread
   title, the selection pill, the menu, a drag, Command-click), 12px above
   and below. Its small line (the day; a publication's writer before it; an
   episode's length, "Half read" and the star after it) sits at the row's
   right end beside the title's first line while the title keeps at least
   12rem and three fifths of the row; otherwise it goes under the title, as
   in every other list (a long writer's name, a narrow phone, large text, a
   narrow list), so the title always keeps a readable width. The source's
   name is still said to screen readers, as in one person's own list.
   "Publications" is the one label, 40px above, 8px over the first name.
   Unread titles stay semibold: the pictures showed them regular, but the
   weight is how unread shows without color (DESIGN.md, decision 0037).
   Which it should be is the owner's open question
   (`docs/planning/questions.md`).
5. **Pages stay 50.** A page that ends inside someone's articles carries on
   with them on the next, without their name again. Each page of the list
   counts only the articles there when it first loaded (`LATEST`), and
   carries on from the person the last page ended in where they then stood,
   so an article read on screen, or one arriving, never moves a person
   under the reader. Someone whose place changed because the reader read
   their newest can come back further down with articles already listed;
   the screen lists each article once. One gap is accepted: if someone not yet
   listed moves earlier while the reader scrolls (a newer article of theirs is
   marked unread again, by Undo or on another device, before the next page
   loads), they can be passed over until the list loads again. Nothing
   is lost: their articles stay unread, and the next load (`r`, or coming
   back to Unread) lists everyone whole.
6. **Keys and marks as before.** j and k go title to title in the order
   shown, across names; Tab, Enter, Mark all as read, Undo and "New
   articles · press r" are unchanged, and a read article stays where it is
   until the list loads again.
7. **Other ways in.** The weekly email already groups unread by person
   (decision 0150); it now takes who is one person from the same
   `feeds::whose!`, and still orders people by name. An assistant's
   `list_unread` is unchanged: SPEC section 33 doesn't say its lists follow
   the screen's.

**How it's built.** `server/src/feeds/by_person.rs` answers Unread: each
place's newest (or oldest) unread time and count from the reader's unread
entries alone, each person's from their places', then only the people
needed to fill the page have their articles read and sorted, so a reader
with a year unread waits no longer than one who keeps up (tests/speed.rs,
under 100 ms either way). Its page position is
`time:id:publication:time:person:latest`; other lists keep `time:id`. A position of the wrong kind
is refused (400), so an Unread tab left open across the change loads
more only once it reloads. The
screen draws the names from `whose` and `publication` on each article
(`people.ts` → `headsOf`). No database structure change.

**Revisit** if the owner wants the name pressable (to their page), the same
grouping in other lists, or assistants' lists to follow the screen's.
