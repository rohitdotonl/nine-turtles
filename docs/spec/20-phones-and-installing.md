# 20. Phones and installing the app

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- One column you move through: **Feeds → Items → Article**. The feeds list is the home screen; no hamburger menu.
- Top bar: a back arrow labeled with where it goes (e.g. "‹ Tech", drawn as a small arrow icon; screen readers hear "Back to Tech") and the screen title. More beside a list's title; search and search-options icons on the feeds and items screens (with search, Milestone 10).
  - The feeds screen: the large "nine turtles" wordmark and **Refresh** as an icon alone (a 44px tap, named "Refresh"; it updates the unread numbers); **Add feed** and **Settings** sit together at the bottom, as on a computer. No sidebar toggle. It's the root of the screens, as on an iPhone: no row is marked as selected, and every row (Unread, Starred, All, Recently read, folders, feeds) ends in a small chevron, after its count, because it leads on to a screen of its own.
  - A list: "‹ Feeds", then the list's name (one line, ending in "…" if long) with **Search** (a magnifier) and **More** (…) beside it, More holding Mark all as read, Refresh, the sort order and Edit (section 6). The top bar never scrolls. The search field waits behind the Search button, so the first article sits right under the title (decision 0060): a tap shows the field with the keyboard in it, and it stays until the button is tapped again with nothing searched, Escape, or going to another place (never on its own, so nothing moves under a finger); while a search is on it always shows.
  - An article: the back button with the list's name in words ("‹ Tech"; screen readers hear "Back to Tech"; a long name ends in "…") at the left, and **Open original** as an icon at the right, on the same solid bar as on a computer (section 7).
  - Add a feed: "‹ Feeds".
  - The back button sits in the same place on every screen, its arrow the same size, 8px from the screen's edge, so it never jumps as you move between screens.
- One side margin on every phone screen: names, titles and text start 20px from the screen's edge (on the feeds screen, the wordmark, the section names and the icons of Unread, Starred, All and Recently read). A list keeps a gutter for its unread dot, as Books and Mail do on iOS: its title, search field and article titles start 28px in, and the dot sits 10px from the edge (decision 0054).
- The system back gesture and back button go back one step, the same as the back arrow. Opening nine turtles' front page on a phone shows the feeds; an address that names a list opens that list, and its back arrow still leads to the feeds.
- "Settings" sits at the bottom of the feeds screen, beside "Add feed".
- No custom swipes on list items.
- Article toolbar at the bottom, within thumb reach and clear of the phone's home indicator, solid in the page's color with a faint line along its top so the text ends at an edge: five quiet icons without words, each a 44px tap with its name for screen readers: previous · next · Aa · star · More (…). The five always share the bar evenly: on the first article Previous (and on the last, Next) keeps its arrow in its place, faded, and does nothing; screen readers hear it as dimmed (decision 0047). More opens upwards with Share (or Copy link), Mark unread and Add to collection… (and, for an episode, Add to Up Next). While an episode plays, the Now playing bar sits just above this toolbar (section 35). Aa opens the reading panel (section 7) as a sheet along the bottom of the screen. Article text reads a little smaller than on a wide screen, so a line keeps about 40 characters.
- Every tap target is at least 44 pixels.
- Can be added to the home screen on iPhone and Android; it then opens full-screen with its own icon: nine small turtles seen from the side, three rows of three with the middle row a little to the right, dark on white (decision 0067). The same turtles mark the browser tab, on white by day and on near-black by night.
- Without a connection, the app still opens: signed in, with the articles kept on the device for reading offline (section 32); on a device that keeps none, it says plainly that nine turtles can't be reached. The service worker keeps a copy of the app itself and its fonts, never of your articles: those are the app's own copies.
- **Sharing a page to nine turtles** (decision 0104; what happens next is in section 3, "Adding from anywhere"):
  - **Android:** once nine turtles is on the home screen, share any page and choose **nine turtles**. Add a feed opens with its address and looks for its feed; press Add feed to follow it.
  - **iPhone and iPad:** Safari doesn't let home-screen web apps appear in the share sheet (Apple doesn't support web share targets), so make a shortcut once in Apple's **Shortcuts** app:
    1. Open Shortcuts, tap **+** for a new shortcut, and name it **Add to nine turtles**.
    2. Tap the shortcut's settings (the **ⓘ** or the name at the top) and turn on **Show in Share Sheet**. Under the types it receives, keep only **URLs** and **Safari web pages**.
    3. Add the action **URL Encode** (search for it); it encodes the **Shortcut Input**.
    4. Add the action **Open URLs**. As its address, type `https://app.nineturtles.app/add-feed?url=` (Settings › Add from anywhere has it, with Copy) and, right after it with no space, insert the **URL Encoded Text** from the step before.
    5. Done. In Safari, on any page, tap Share and choose **Add to nine turtles**: nine turtles opens Add a feed with that page.

**How to check it**
1. On your phone, open the app: you see your feeds. Tap a folder, a feed, an article; the back arrow says where it goes each time.
2. Swipe back from the screen edge: you go back one step.
3. In an article, press Next and Previous at the bottom: they move through the list. On the first article, Previous shows a faded arrow in its usual place and does nothing; the bar has no gap.
4. Use "Add to Home Screen". Open it from the icon: no browser bars.
5. On Android, with nine turtles on the home screen, share a blog from the browser and choose nine turtles: Add a feed opens with the blog's address and its feed found; nothing is added until you press Add feed. On an iPhone, make the shortcut above and share a blog from Safari to **Add to nine turtles**: the same happens.
