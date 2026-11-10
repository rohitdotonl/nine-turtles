# 0207: Arranging the sidebar: folders in your own order, and dragging people into folders

**In one line:** Folders in your own order (structure change 46) by dragging or Edit's handles; people and publications dragged onto a folder (Option or Ctrl keeps both), out of one, or between People and Publications; a folder left empty goes, with Undo; Folders, People and Publications in bold words with a quiet Edit

*6 November 2026.*

**Context.** The owner asked for an easy way to change the order of their
folders and to put people and publications in folders, "as easy as drag and
drop". Folders were always A to Z, and filing someone meant opening their
page and Edit. Both are frequent and were slow. Mockups of today's sidebar
beside the suggested one, on a computer and a phone, were shown first; the
owner chose the details below.

**Decision.**

- **Folders keep the reader's own order.** A new folder goes at the bottom;
  renaming keeps its place. Structure change 46 adds `folders.position`,
  filled from today's A-to-Z order so nothing moves on the day it ships.
  The order is per reader and kept on the server (`POST /api/folders/order`,
  which ignores folders that aren't the reader's), so it's the same on every
  device, and Everyone you follow, the Move sheet and the OPML export follow
  it. People and publications stay A to Z.
- **Dragging, with no mode to switch on.** A mouse drags once it moves a few
  pixels, so a wobbly click never moves anything. A finger presses and holds
  for half a second, so a swipe still scrolls; a handle drags at once.
  Pointer events, so mouse, pen and finger share one way of working. Safari
  on the iPhone gets the extra care it needs: its own long-press menu,
  link preview and text choosing are turned off on rows that drag, and the
  page doesn't scroll under a held row.
- **Edit** at the end of the Folders line gives every row a handle (the
  grip icon). It is the way for the keyboard, screen readers and anyone who
  would rather not drag: a folder's handle is a menu (Move to the top, up,
  down, to the bottom), a person's opens "Move to a folder". With a mouse,
  Edit shows only while the pointer is on the sidebar, so it never adds
  chrome to a resting sidebar. A settings icon was considered and refused:
  one icon, one meaning (BRAND.md → "Icons"), and the gear already means
  Settings.
- **Filing by dragging:** onto a folder moves someone there, out of the
  folder they were dragged from; Option on a Mac, Ctrl on Windows and
  Linux, keeps them in both, with the pointer's +. Onto People or
  Publications takes them out of that folder. One in no folder dragged
  between People and Publications becomes the other. Someone in several
  places can't be a publication (decision 0163, section 36): a line under
  Publications says why while they're held over it, and the note says it if
  they're let go there.
- **A folder left empty goes,** as unsubscribing from its last person does,
  and Undo brings it back in its place. Only the sidebar's arranging does
  this; Edit on someone's page has no Undo line, so unticking a folder there
  leaves it, empty (the floor: nothing deletes without Undo).
- **Headings:** Folders, People and Publications become bold words in full
  ink, sentence case, so a heading never looks quieter than the Edit beside
  it (option B of three shown). Edit is small and muted (12px on a computer,
  14px on a touch screen).
- **Every arranging is said** in one line at the sidebar's foot, with Undo
  (BRAND.md → "Messages"), and screen readers hear where a moved folder is
  now. The line sits at the sidebar's foot rather than the list's, because a
  phone's feeds screen has no list.
- **Nothing animates** (the floors): a line, a tone and the lifted row's name
  appear and go.

**Not done.** Arranging people by hand inside a folder (they stay A to Z);
folders inside folders.
