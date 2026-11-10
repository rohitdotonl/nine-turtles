# 0142: The brand's details: empty lists, "Wrong turn?", emails, the share picture, the tab icon

**In one line:** The brand's details: one shape for empty lists ("Nothing … yet." and how to start), Unread ends "That's everything for now.", the welcome says "Hello. Who would you like to read?", "Wrong turn?" on one left edge, emails signed by Rohit, a black-tile share picture, and the tab icon always a black square

*2 November 2026. Chosen by the owner from mockups (today, a safe and a bold
option for each, with a creative director's review), in the brand work's
"details" area.*

## Decision

- **An empty list has one shape and one pattern:** a short fact in the
  reading serif ("Nothing from this feed yet."), and only when there's
  something to do, how to start in the interface's text, muted ("Press the
  star on any article to keep it here."). On the list's left edge, never
  centred, no picture. Every "nothing yet" is said the same way. A feed adds
  when it was last checked (the server's `fetched_at`, sent with each feed
  as `checked_at`), the fact a reader wonders about: broken, or just quiet?
  A search that found nothing says what it looked for and where. The words
  are in `docs/spec/06-item-list.md`; the code in `web/src/lib/listWording.ts`.
- **Unread ends "That's everything for now."**, as DESIGN.md's Voice table
  already said; "You're all caught up." was a finish line. The closing
  caption moves onto the row titles' edge, in the serif, with room under it.
- **The empty reading pane's line sits at the optical middle,** about 40%
  down, on a 32px line.
- **The welcome says "Hello. Who would you like to read?"**, the Voice
  table's line for this moment, instead of "A quiet place to read.", since
  "calm" and "quiet" aren't the brand (decision 0132). For the same reason
  the sign-in pages' line under the name becomes the headline, "Read
  people. Write back."
- **"Wrong turn?" sits on one left edge,** like the home page, its parts
  grouped by their gaps (16 / 48 / 20 / 24 / 40) instead of an even 40px,
  and "404 error" in sentence case instead of spaced capitals. The turtles'
  drawing is unchanged, as the owner asked.
- **Emails are signed "Rohit", then "nine turtles"** (DESIGN.md: emails
  speak as Rohit), and stay plain text: they are keys to an account, plain
  text looks the same everywhere and shows the real link. The note sent
  when an email changes ends "Reply to this email and I'll help you get
  your account back." instead of "tell whoever runs this nine turtles";
  the owner checked that mail to hello@nineturtles.app reaches him.
- **The share picture is the app icon's black tile** with the nine turtles
  and "Read people. Write back.", 1200 by 630, everything inside the middle
  square (`website/src/images/share.png`), with its size, a description and
  `twitter:card` in every page's head. It replaces an old screenshot of the
  app, which blurred at preview size and was the wrong shape.
- **The tab icon is always the black square** with a light turtle filling
  most of it, by day and by night. A tab icon can't see the tab's color, so
  a bare turtle, or today's white square, could vanish on a dark tab.
- **Where the turtles appear** is written down (DESIGN.md, Name and
  signature): only as the logo, the icons, the share picture and the two
  existing drawings; never as a character.

## Why not

- **An HTML email with a button:** most email apps would show it in Georgia
  anyway, and a broken account email costs more than a nicer one gains.
- **"Newest: Mira Okafor, yesterday" on an empty Unread:** pointing at the
  next article from an empty screen is a small pull (principle 1).
- **A turtle on empty screens or at the end of a list:** a mascot, and a
  reward for finishing.
