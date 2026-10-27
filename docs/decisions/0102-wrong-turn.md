# 0102: "Wrong turn?", one 404 page for the app and the website

*October 2026.*

**Decision.** The owner chose the page on 27 October 2026, from mockups. An
address that isn't one of nine turtles' places now opens **"Wrong turn?"**,
in the app and on the website alike, instead of the app quietly opening
Unread (SPEC section 4; DESIGN.md → "Name and signature").

- **What it shows:** a small "404 error" (the owner wanted the number shown,
  quietly), then nine turtles from the logo, eight walking one way and one,
  a few steps behind, turned the other, big enough that the joke is seen at
  a glance; then "Wrong turn?", two short lines, an invitation to say which
  link was broken, signed "Rohit". The app adds "Back to your reading".
- **"Tell me which one"** opens the reader's own email app, addressed to
  hello@nineturtles.app, with the address they reached already written in
  (the app); nine turtles still sends no email itself.
- **What counts as a place:** `router.ts` → `knownPath`, the same addresses
  `parse` reads. A feed, folder or saved search you don't have keeps its own
  "Feed not found" in the list, since its address is well-formed.
- **The footer:** the website's walking turtles and "Some of us like to read
  slowly. That's the idea." moved from every page's footer to the end of the
  About page, at the owner's request; the footer keeps only its links.

**Revisit if** the server learns the app's places and can answer with a
real 404 status (today it serves the app for any address and the app
decides).
