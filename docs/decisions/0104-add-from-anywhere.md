# 0104: Adding a feed from anywhere

*27 October 2026. Asked for by the owner: add a feed from the system share
sheet, from Apple's Shortcuts app, and from any link.*

## Decision

- **One address does it all: `/add-feed?url=<address>`.** It opens Add a feed
  with the address in the field (`web/src/lib/share.ts`, read in
  `Shell.svelte` before the address bar is tidied back to `/add-feed`). Share
  menus often put the link inside `text` ("Have a look at https://…"), or
  rarely in `title`, so without `url` the first `http`/`https` address in
  `text`, then `title`, is used, without a sentence's closing punctuation,
  and cut at 2,048 characters. The shared address is used for that one
  opening; Add a feed opened again later starts empty.
- **It looks, but never follows.** On opening, nine turtles looks at the page
  for its feeds straight away, as if the reader had pasted it, but through
  the feed finder's lookup (`GET /api/find-feeds`, decision 0099), which
  only answers what a page names and changes nothing. Add feed's own
  request (`POST /api/feeds`) follows a feed when the page names just one,
  so it could not be used here without following something unasked. What's
  found is shown as Add feed's usual list of choices (decision 0049), "Found
  this feed:" for one, and only the reader's press of **Add feed** follows
  the chosen one. Cancel, Escape and the X follow nothing.
- **This fits decision 0016's rule on autodiscovery.** nine turtles fetches
  only the one page the reader gave it, once, because they asked, reads the
  `<link rel="alternate">` lines it names and never guesses addresses or
  fetches an article's page. Sharing a page to nine turtles is the reader
  explicitly handing it that page, the same as pasting it. (The finder then
  fetches the first feed once for its preview, as on the website; Add feed
  would fetch it on adding anyway.) The same downloader, refusal of private
  addresses and per-site limits apply.
- **When the finder is busy or can't be reached, nine turtles says nothing:**
  the address waits in the field and Add feed works as always. Problems it
  does report ("no feed", "not an address", …) are Add feed's own sentences.
- **Signed out:** the sign-in page shows at the same address, so after signing
  in Add a feed opens with the address kept. Nothing is stored for this.
- **Android and other browsers that support it: a Web Share Target** in
  `web/public/manifest.webmanifest` (`GET` to `/add-feed` with `title`,
  `text` and `url`), so an installed nine turtles appears in the share menu.
- **iPhone and iPad: an Apple Shortcuts shortcut,** because Safari doesn't
  support share targets for home-screen web apps. The steps are in SPEC
  section 20: Share Sheet input (URLs, Safari web pages) → URL Encode → Open
  URLs `https://app.nineturtles.app/add-feed?url=` + the encoded text.
- **Computers: a bookmarklet,** shown in a small Settings group, **Add from
  anywhere**, with the Shortcuts address, each with Copy (as Other apps shows
  its server address). Both are built from `location.origin`, so every
  installation shows its own address and nothing is written into the code.
  It sits in Settings, not in the Add a feed sheet, so the sheet stays one
  field and one action ("power is hidden, never missing").

## Why not

- *Pressing Add feed for the reader on arrival:* it would follow a
  single-feed site without the reader's say, and "nothing moves unless you
  move it".
- *Only filling in the address:* the reader would still have to press Add
  feed to find out whether the page has a feed at all; looking (without
  following) answers that at once and costs the publisher nothing more.
- *A share target with `POST`:* it needs the service worker to catch the
  request; `GET` works with the page alone and nothing is uploaded.
