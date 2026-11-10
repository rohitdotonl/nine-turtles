# 0177: Add from anywhere in one tap

**In one line:** Add from anywhere in one tap: a bookmark button to drag to the bookmarks bar (Copy kept for keyboard users) and a ready-made Apple Shortcut from its iCloud link, shown only once the owner has made it; the Shortcuts address row and build-it-yourself steps go

*4 November 2026.*

**Decision.** Settings › Add from anywhere stops asking readers to build
things themselves:

- **On a computer:** a button, **Add to nine turtles**, to drag to the
  bookmarks bar (a "bookmarklet", as the website's feed finder already has).
  **Copy** stays beside it, because dragging needs a mouse: keyboard and
  screen-reader users copy the bookmark and paste it as a new bookmark's
  address. Pressed inside nine turtles the button goes nowhere and says
  "Drag it to your bookmarks bar: it works from there."
- **On iPhone and iPad:** a ready-made Apple Shortcut, **Add to nine
  turtles**, installed from its iCloud link with **Get the Shortcut**,
  instead of the steps to build one. Apple lets a Shortcut be shared only
  from a device signed in to iCloud, so the owner makes it once and its link
  is written into the app (`SHORTCUT_LINK` in `web/src/lib/share.ts`). Until
  that link exists, the row isn't shown: never a button that leads nowhere.
  The Shortcut opens `https://app.nineturtles.app/add?url=<the page>`.
- **Android** is unchanged: the share menu, once nine turtles is on the
  home screen.

The "Address for Apple Shortcuts" row goes. The bookmark now opens `/add`
and is wrapped in `void(…)`, so no browser shows the address as a page of
text before going.

**Why.** Step 11 of the owner's review: making a Shortcut by hand was eight
steps no reader should have to follow, and copying a `javascript:` address
into a new bookmark is a programmer's chore.
