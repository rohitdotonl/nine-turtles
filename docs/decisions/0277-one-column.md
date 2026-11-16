# 0277: One column for the list and the article, and the list's page made for two panes

**In one line:** On a computer the list's title, search and titles start where an opened article's text starts (the window's centred reading column, its width in the reader's Aa) and end on its right edge, Settings and Everyone you follow start on that line too, and the article's (and a person's page's) bar stands over the text; an empty list has the page to itself ("Nothing unread." large and centred, "New writing will show up here."); and Unread reads as a book's contents page: each name larger, as a chapter's, and no day beside its titles.

> **Partly replaced by [0278](0278-unread-shows-its-order.md):** with the sidebar showing, the list's column and Settings are centred beside the sidebar instead of starting where the article's text starts; with the sidebar hidden they still line up.

*16 November 2026. The owner, after reading one thing at a time (decision 0275): "nothing's changed except moving the article pane behind a click. We must optimise other things for the two-pane structure." He chose these three from now-vs-after pictures ("Implement both of these suggestions. Just shorten the copy of Nothing unread. And implement … One column for both screens"), and said to implement and merge without a local trial.*

**What changes (on a computer, unless said; a phone keeps its layout).**
1. **One column.** The list's column was centred in the room the sidebar
   left (42rem with its edges), and the article's text in the whole window,
   so opening one jumped about 150px sideways. Now both use the reading
   column: the list's titles start on the text's left edge and the list's
   More ends on its right. Where the sidebar leaves too little room (a medium
   window), the list keeps its own 32px edge. Settings, Everyone you follow,
   Hidden articles and All readers start their 560px column on the same line.
   The article's bar stands over the text: ‹ and the list's name on its left
   edge, the last icon on its right edge (it was at the window's corners).
   The same for the × on a person's page.
2. **When a list is empty, the end gets the page.** The fact set as an
   article's title is (Literata's display cut, regular, 38px at the usual
   text size), in the ink, centred about a third of the way down,
   and one line under it in the reading serif at the reader's text size, muted. Unread now says
   "Nothing unread." and "New writing will show up here." (the owner asked
   for the copy to be short), on a phone too, in its usual shape. Words only: the brand sheet keeps the turtles
   off empty lists. This amends decision 0142's "on the list's left edge,
   never centred", which a phone keeps.
3. **Unread as a contents page.** Each person's name is a chapter heading
   (display cut, regular, at the heading size, 24px), and Unread shows **no
   day** beside its titles, on any device: they're already newest first under
   each name, and on a wide page the day sat far from short titles. Screen
   readers still hear it. The owner first chose a dotted leader from each
   title to its day, then asked for the days to go instead ("Remove dates
   that are in front of the titles."). Amends decision 0271.

**How.** The reading column's width is worked out once, on `<main>`, in the
reader's face and size, as a registered CSS length (`@property
--reading-width`), so it reaches the list and the bars as pixels and
follows Aa with no script (`reading-column.css`). The list's padding uses it
with `100vw` and the pane's own width, so the sidebar's width needs no
reading (`list-column.css`). On a system whose scroll bars take room
(Windows, some Linux) the two can differ by half a scroll bar, about 8px;
with overlay scroll bars (a Mac, phones) they match exactly.

**Not done, by the owner's choice:** next and previous buttons on an
article (they would take attention from the article), and an article's
opening words under each title in the list (most writers don't write a first
line to be seen in a list).
