# 0183: The core path

*5 November 2026.*

**Decision.** Fifteen changes to the path every reader walks (adding
someone, reading, writing back, their page, Edit, folders), agreed with the
owner over three rounds (the owner's core path, points 1 to 15, and the
keys, points 16 and 17, in a second change the same day):

- **Adding someone** asks one question once they're found: the field goes,
  the title reads "Maya Chen is…", their site and newest title show, and two
  tiles finish it, **A person** ("Someone you might write back to.") and
  **A publication** ("Anything you only read or watch, and won't write back
  to."), each with its icon (a new person icon, and the newspaper). The
  field is "Their website's address"; the welcome's line is "Paste the
  address of someone's blog, newsletter or channel."; the line saying
  nine turtles finds the feed went; a site with no feed says "nine turtles
  couldn't find a way to follow this site. You could write to them and ask
  if they have a feed or a newsletter."
- **Reading:** a publication's articles name their writer in every list
  ("Lena Fischer · Garden Letters · 1 Nov"); a summary says "Only the
  beginning is shared here."
- **Write back** is the solid ink button with a paper plane, the only solid
  button in the reading pane, naming them in full ("Write back to Tomas
  Berg"): the first-name rule went. With no address on their site: "No
  email address on their site. Paste it here and it's saved."; the box's
  foot says only "It sends from your own email."
- **Their page** has **Write to Tomas Berg**, the same button, under their
  name, with the address under it (no subject); the Email row and the muted
  line ("A person · following since …") went.
- **Edit** keeps Name, Email address, This is, Folders, Pause for a while,
  then Unsubscribe. Four settings went, with their data: Kind of source (the
  app still reads it from the feed), Check for new articles (every feed
  is checked on its own rhythm), Open articles on the website, and the line
  saying how often they post. Someone with one source gets a quiet line,
  "Does Tomas Berg also write a newsletter, make videos or host a podcast?",
  and "+ Add another place". The folder note is "Type a name to make a
  folder."
- **Folders:** one made or chosen in Edit opens in the sidebar; unsubscribing
  from the last person in a folder removes the folder too, and Undo brings
  both back.
- **Keys:** `e` opens Edit for the person, publication or folder whose list
  you're in ("Edit this person or publication"); opening and closing a
  folder moved to `o` ("Open / close this folder"). `←` and `→` move the
  keyboard between the sidebar, the list and the article ("Move between
  panes"); `↑` and `↓` move inside the one you're in: the sidebar's rows,
  the list's articles, or scrolling the article. In a field, a menu, a row
  of choices or the podcast player, the arrows keep their usual job. This
  ends decision 0180's "no keys for moving between panes".

**Why.** Each step should say what it means for the reader, in their words,
and nothing more: a person is someone you might write back to, so the
question says that; settings a reader never needs are noise in Edit.

**Data.** Structure change 41 drops `subscriptions.check_at_most`,
`subscriptions.open_on_site` and `feeds.check_at_most` (the owner's standing
permission to delete removed features' data, 3 November 2026; the backup
before every structure change keeps them). Earlier corrections of a
source's kind stay in `subscriptions.place`; nothing changes them any more.

**Full names in the "another place" line.** The agreed text says "Does
Tomas also write…"; with the first-name rule gone everywhere (point 7), it
uses the name in the sidebar, as Write back does.
