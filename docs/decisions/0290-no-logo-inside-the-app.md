# 0290: Inside the app the name stands alone, with no logo

**In one line:** The nine turtles logo leaves every page inside the app (the sidebar's top line, the sign-in pages and the other one-off pages); the words "nine turtles" stay, and the logo stays on the website, the app icon, the tab icon and the share picture.

*16 November 2026. The owner: "remove the logo, keep the words." The website stays as it is.*

**What changes.**
1. **The sidebar's top line** shows "nine turtles" in words alone, at the
   same size, weight and ink as before (22px semibold in the second ink on a
   computer, 28px on a phone's feeds screen; SPEC section 5). Without the 36px
   of turtles before it, the name fits on one line even at the sidebar's
   narrowest width.
2. **The sign-in pages** (sign in, sign up, the emailed-link pages, a new
   password), the weekly email's stop page and "Connect this assistant?" lose
   the 56px logo above the name or question (SPEC section 1).
3. The app's `Logo.svelte` is deleted, since nothing in the app draws it.

**Unchanged.** The website's top (the nine before the name), the app icon,
the browser-tab icon, the share picture, and the turtles of "Wrong turn?" and
the About page's end, which are drawings, not the logo. Replaces part of
decision 0067 ("it stands before the wordmark wherever the wordmark is
shown") and the sidebar half of the logo's lockup (DESIGN.md's Exceptions
log, now "The name's size").
