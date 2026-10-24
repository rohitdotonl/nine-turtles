# 0027: Taste first, icons where they're expected, Settings as grouped cards

**Date:** 24 October 2026 · **Decided by:** the owner

## What the owner said

"Taste first. Good UI and UX principles first. And the rules set by me
last. The only thing I am sure about is the three pane structure. Rest is
open to change." The owner pointed at words where an icon is the
convention ("Settings", "Close") and a Settings page whose sections ran
into each other. They asked us to measure against Things, Linear and
Notion (not Reeder), along with Apple's own apps, Arc, Raycast, Craft, Bear
and Superhuman. Notes on what those apps do are in the project files
(`ui-polish/references.md`, outside the repository).

## What we chose

- **Icons where the convention is an icon:** close (X), settings (a cog),
  the shortcut list (a keyboard), and the article's copy link, star and
  mark unread. Each is named for screen readers and in its tooltip, with its
  key. Words stay for "Open original" (the way to the publisher), Add feed,
  and a form's main action. This replaces DESIGN.md's "words beside icons".
- **Settings as grouped cards,** like a system settings window: a small
  heading above each card, one setting per row, hairlines between rows, the
  name on the left and the choices on the right on a wide screen. Choices
  are segmented controls; themes are small pictures of the app in each
  theme. "Match this device" is now "Automatic".
- **The shortcut list** is grouped in two columns, what each does on the
  left and its keys on the right, and lists only what works today.
- **The sidebar's views** (Unread, Starred, All) get small icons.
- **The list's title** wraps between words onto at most two lines, then
  ends in "…" with the whole name as its tooltip (refining 0026, where it
  wrapped without limit and could break inside a word).

## What stays

The floors: AA contrast (AAA for article text), never color alone, full
keyboard use with visible focus, 44px touch targets, ink blue only for
"where you are".
