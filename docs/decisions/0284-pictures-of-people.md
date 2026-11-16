# 0284: A picture of each person and publication

**In one line:** A round picture leads an article's byline (40px) and tops a person's or publication's page (72px): the one the reader chose, else the picture the feed names, else the site's own icon (a small one sits small inside the circle), else their initials; on their page, pressing it offers "Choose a picture…" and "Use the automatic picture", each with Undo.

*16 November 2026. The owner asked for it from a New Yorker byline, saw initials and the site's icon side by side on his own writers, and chose the site's icon.*

**Why.** A face beside the byline makes an article feel like it comes
from a person, which is what nine turtles is for (principle 2, the writer
comes first). It shows in two places only, the article and their page, so
lists stay words.

**Decision.**
1. **Where it comes from, in order:** the picture the reader chose; the
   picture the feed itself names (RSS `<image>` or `itunes:image`, Atom's
   logo or icon, JSON Feed's icon; kept in `feeds.picture_url` each time the
   feed is fetched with something new); the site's own icons,
   `/apple-touch-icon.png` then `/favicon.ico`; their initials (two for a
   person, one for a publication) in the titles' face and the second ink.
   A picture narrower than 96 of its own pixels would blur filling the
   circle: it is kept back while a bigger one is tried, then shown small in
   the middle of the circle. The circle shows only its tone while pictures
   load, so initials never flash first. A picture a tab found missing is
   not asked for again in that tab (fetch politely).
2. **Who fetches them:** the reader's browser, from the publisher's site,
   exactly as an article's pictures load (decision 0017); nine turtles'
   server never asks a site for an icon. The page's rules already allow
   images from anywhere (`security::CONTENT_SECURITY_POLICY`).
3. **No color of its own:** the circle is the grouped rows' tone with a
   hairline edge; initials never get a color per person (the accent marks
   only what's yours to look at, decision 0037).
4. **Choosing one** is on their page only: the picture is a button (named
   "Change picture of {name}", with a small pencil on its edge so it reads
   as changeable) opening a small menu. Any picture the device can open,
   of any size, will do: the browser turns it the way the camera held it,
   cuts its middle square, shrinks it to 256px (smoothly), and writes it as
   WebP, or JPEG where it can't write WebP: a 4 MB phone photo arrives as
   about 10 KB. nine turtles keeps only JPEG, PNG or WebP, judged by its
   first bytes, at most 256 KB (far above what a shrunk picture weighs: a
   safety net, never a limit a reader meets),
   in the `pictures` table (structure change 52), a copy on each of the
   person's places (as a note is), each reader's own. It is served only to
   that reader, with `nosniff` and a `default-src 'none'` rule. Changing it
   and going back to the automatic picture both say so beside it, with Undo
   (the floor: nothing deletes without undo). Deleting the account or one's
   data removes them.
5. **Not now:** pictures in lists or the sidebar, cropping by hand, and
   pictures in Your data's export.
