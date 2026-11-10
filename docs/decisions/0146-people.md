# 0146: People: one row and one page per person

**In one line:** *(Refined by 0163.)* People: one sidebar row and one page per person, whose places (blog, channel, newsletter) list as one; joined only by the reader (Add another place, "Is this the same person?" on clear evidence, or "This is one person" on a folder), each with Undo; Edit feed becomes Edit person; in the code they're `writers`

*2 November 2026. The shape was agreed with the owner (PLAN.md → V1, item
1, and the pictures at https://claude.ai/artifact/N6VBtfpfGavgN8Dz7bPyFS);
the owner gave advance permission to build and ship it. The smaller choices
below were made by the building agent while the owner was away, each listed
for the owner's refinement round.*

**Decision.**

- A **person** is one human with one or more **places** (a blog, a YouTube
  channel, a newsletter); a **folder** is a group of people. Each person is
  one sidebar row and one page; their list holds all their places. A place
  on its own is a person with one place and looks as before (SPEC section
  36).
- Places are joined only by the reader: **Add another place** (on the
  page and in Edit person), a yes to **"Is this the same person?"**, or
  **This is one person** on a folder. Every join and separation has Undo.
- nine turtles asks "Is this the same person?" once per place, and only on
  clear evidence: two places on one website of the reader's people's own,
  never on a host many people share. It never fetches a page to look for
  evidence (the "never fetch an article's web page" rule stands).
- In the code they're **writers** (`server/src/writers.rs`, the `writers`
  table, structure change 28), because the readers are already `people`.
  The screen says "person"; the word "feed" leaves the sidebar, the person's
  page and Edit person.

**Choices made while the owner was away** (each easy to reverse):

1. Edit feed became **Edit person**, opened from the More menu as before; it
   gains the person's places, Add another place and "… isn't the same
   person". A place of a person with several keeps its own settings, under
   "Settings for this blog", with "Its settings" leading to the others'.
2. The sidebar's section is **People**; the find field says "Find a person
   or folder"; "Pause this feed" became **Pause for a while** and "Add a rule
   for this feed…" **Add a rule…**.
3. The person's page replaces "Time to read something beautiful." beside a
   person's list (the quiet line stays everywhere else, and while searching
   in their list); it keeps the keyboard tip under its buttons.
4. A person's row opens their first followed place's address
   (`/feeds/3`); any of their places' addresses opens the same list.
5. Labels in a person's list: Blog, Video, Newsletter, and Podcast for an
   episode; shown only for a person with two or more places.
6. Joining puts every place in every folder any of them was in, rather than
   asking.
7. Pasting an address in Add another place follows the site's first feed if
   it offers several, rather than asking which.
8. The "same person" evidence is the same website only; "their site links
   the other place" (the plan's example) would need nine turtles to read the
   site's page, which it doesn't do outside adding a feed. Left for later.
9. A place's kind is told from its address alone: YouTube's feeds are
   videos, newsletters are newsletters, everything else is a blog.

**Why.** "Read people. Write back." needs people, not files: one row for
Rohit, not one for his blog and one for his channel, and one page that will
hold where to write back (V1 item 2). Keeping places on their own until the
reader joins them means nothing changes for anyone who never uses it, and
nothing is ever joined by mistake.
