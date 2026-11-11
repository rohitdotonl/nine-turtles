# 37. Writing back

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.
Decision 0147; the shape agreed with the owner on 2 November 2026 (PLAN.md →
V1, item 2). Its look gets a refinement round.*

**What it does**
- **Write back on every article** of a person you follow (never a
  publication's, decision 0192): at the article's
  end, under its closing rule (and under "Read the rest on …" for a summary), one
  centred button, **Write back**: an outlined button with a
  paper-plane icon, as Mark all as read ends a list, so it's quieter than
  the writing (decision 0242; solid ink before). Under it, in small muted
  type, who it goes to, named in full by the name in the sidebar, and the
  address it writes to: "to Maya Chen, maya@example.com" (the owner's core
  path, points 6 and 7, decision 0183). The button stays one short word
  whatever the name's length, so a long name never swells it into a block
  (decision 0255; it said "Write back to Maya Chen" before); screen readers
  still hear "Write back to Maya Chen" as the button's name. It's also one press from the
  text, a paper plane beside Star in the article's top bar (on a phone, in
  its bottom toolbar), on the keyboard, **`w`** (section 19), and in a row's
  own menu in the list, which opens the article and starts it (section 6;
  decision 0214). An article of a place you no longer follow (one kept only
  in Starred) has none: there's no person to write to.
- **Not for publications** (decision 0192, the owner's choice): a
  publication is something you only read or watch, so its articles end with
  no Write back, no paper plane and no Write back in a row's menu, `w` does nothing there, its page
  has no Write to, and so no address on its page. Making it **A person**
  on its page brings them back, with any address kept from before.
- **Write to, on their page** (the owner's core path, point 9): the same
  solid button with the paper plane, **Write to Tomas Berg**, sits under
  their name on their page (section 36), with the address under it. It
  opens your email app with the address only and an empty subject. When no
  address is known, it opens the same box as Write back (below), whose
  button then says **Write**.
- **Two more places** (decision 0212): a person's card under Not working
  in Everyone you follow (section 15), and **Ask them for a feed** under
  Add's no-feed message (section 3), which asks a site nobody follows yet.
  In both, Write to and the box's Write are everyday bordered buttons, so
  the place's own main button stays the only solid one.
- **It opens your own email app,** with their address and the subject
  "Re: " and the article's title filled in (a title that already starts
  "Re:" keeps its own). nine turtles never sends that email and never sees
  it, or your inbox; it only makes the `mailto:` link your device opens. The
  body is left empty for you, unless you highlighted words in the article.
  Once pressed, a line under the address says "Opening your email app…",
  and under it "Nothing opened?" with **Copy their address** (underlined
  words, as the list's note's buttons), which copies it and says "Copied.":
  on a computer with no email app set up, the press otherwise does nothing
  you can see (decision 0229). The line goes once you come back from the email app (the page was hidden while it opened) or another article opens. A copy that fails says so in oxblood with the alert icon.
- **Write back about this** (decision 0205): when you've highlighted words
  in the article (section 42), the email starts with them, each quote on
  lines beginning "> " as email apps quote, a blank line after each, then
  room for your reply (at most 1,500 characters of quotes as written into
  the link, so it stays one email apps take; quotes past that are left
  out, and a first quote too long by itself keeps its first words, ending
  "…"). One more line under the address says so, in the same
  quiet type: "Your email starts with the words you highlighted." (or
  "…the words you chose." after Write back about this) The small
  menu beside words you choose, and the one beside a highlight you press,
  end with **Write back about this**, set apart by a hairline because it
  leaves nine turtles; it writes back starting with only those words,
  without highlighting them. Not for publications, as Write back isn't.
  Write to, on their page, never quotes anything.
- **Where the address comes from,** first match wins: the address you typed
  for the person; the one the article's own source gives; the one another of
  their sources gives. A feed gives its author's address (an Atom or JSON
  Feed author, an RSS feed's `managingEditor`, a podcast's owner), or, when
  every article that names an author's address names the same one, that;
  else, when no article names one, the address the articles' own text gives
  for writing back: a `mailto:` link whose subject starts "Re:" or whose
  words say so ("Reply by email", "Email me", "Get in touch" and the like),
  or a `mailto:` link to the same address in two or more articles (a
  sign-off). Any other address in an article may be someone else's, so it's
  never used. A magazine whose articles name or link several gives none, and
  a website's `webMaster` never counts. Only what the feed brought is read:
  finding an address in the feed fetches nothing. A newsletter gives its Reply-To address, else
  its From address, from its first email that has one (a later email can't
  swap it). An address made only to send from ("no-reply", "donotreply",
  bounce and mailer addresses) is never used. A feed's address arrives with
  the next new article nine turtles fetches; a newsletter's with its next
  email.
- **When nine turtles doesn't know it,** Write back opens a quiet bordered
  box in place, as + Add a source does: "Write back to Alpha", and one
  short line. While nine turtles looks on their site (below) it says
  "Looking on their site…", in plain words with nothing moving. When it
  finds an address, it fills it into the field and says "Found on their
  site. Check it, then press Write back."; the reader checks it and presses
  Write back to keep it (a page can show someone else's address too). When
  it finds none, "No email address on their site. Paste it here and it's
  saved." (point 8). When it couldn't look (their site didn't answer, or
  nine turtles can't be reached), "Their site couldn't be checked for an
  address. Paste it here and it's saved."
  Once the reader changes a found address, the box is as before. With no website known it
  doesn't look, and says "nine turtles doesn't have their address yet.
  Paste it here and it's saved."; then **Find it on their site** (an everyday button that opens their
  website, the one their feed names or else their article's home page, in a
  new tab; left out when nine turtles knows
  neither, and once an address found there is filled in), **Their email address**, **Write back** and **Not now**, and
  under them, quietly, "It sends from your own email." only (point 8). The
  keyboard starts on the field; Not now puts it back on the button.
  Something that isn't one address ("ivy at home", two addresses) is refused
  in oxblood words, keeping what you typed. Write back opens your email app
  at once and keeps the address for the person, on every source of theirs,
  so you're asked once; from then on Write back opens your email app
  straight away.
- **Looking on their site** (decision 0168, the second floor's one visit
  for Write back): only when the reader presses Write back and no address is
  known, nine turtles' server visits the writer's site, the one their feed
  names (else their newest article's home page, never the article): the
  home page, and, if it gives no address, the one contact page it links to
  on the same site (else an about page): a link whose words are just
  "Contact", "About me" and the like, or whose short address is `/contact`
  or `/about`, never a post's ("About time"). An address counts when it's an
  email link, or written out on the page; one at the site's own name wins,
  else the page's only one; several others give none, and a blog host's own
  address never counts as the writer's. It takes at most 8
  seconds, after which the box asks. It's done once for the writer, for
  everyone who follows them: pressing Write back again answers from what was
  found, or not found, without visiting. A site that didn't answer isn't
  counted, so a later press tries again; one that answered with an error
  or asked nine turtles to slow down is counted, and never asked again.
- **Their page** (section 36) shows it under **Write to …**, once nine
  turtles knows it, with **Change** beside it (decision 0254): the same box
  as Write back's opens in place, filled with it ("Correct it, or paste a new
  one."), with Save and Not now; change it and press Save to write somewhere
  else; empty it to go back to what their feed gives, if anything.
- Each reader's addresses are theirs alone. The address a feed gives is the
  same for everyone who follows it, as its name is.

**How to check it**
1. Follow a blog whose feed names no address (most WordPress blogs). Open an
   article and scroll to its end: **Write back**, with "to …" under it. Press it: the box
   says "Looking on their site…", then either fills in the address it found
   there or says it didn't find one. Type "someone at home" and press Write back: it
   says it doesn't look like an email address, keeping what you typed.
2. Type a real address and press Write back: your email app opens with it
   and "Re: " and the title. Back in nine turtles, the button now shows the
   address under it; open another of their articles and press it: the email
   app opens straight away.
3. Open their page (press their name at the top of their list): **Write to
   …** with the address under it; pressing it opens your email app with no
   subject. Press Change: the box has it; change it and press Save; the page
   shows the new one.
4. Press **Find it on their site** in that box: their website opens in a
   new tab, and the box is still there to paste the address into.
5. Follow a blog whose articles end with a "Reply by email" link: after its
   next new article, Write back opens your email app at once with that
   address.
6. Follow a blog whose feed names its author's email (many Atom feeds, and
   RSS feeds with `managingEditor`), or a newsletter: Write back opens your
   email app at once, with no question, and their page shows the address.
7. On a computer, open an article and press `w`: the same as pressing
   Write back.
8. Follow a blog whose contact page shows the writer's email but whose feed
   doesn't: press Write back; the field fills with the address and the line
   says "Found on their site. Check it, then press Write back." Press Not
   now and Write back again: the same address appears at once (nothing is
   visited twice).
9. Highlight a sentence in an article of someone whose address is known.
   Under Write back's address: "Your email starts with the words you
   highlighted." Press Write back: your email starts with "> " and the
   sentence. Choose other words: the small menu ends with **Write back
   about this**; press it, and the email starts with those words only. (It
   counts as pressing Write back: with no address known, it opens the same
   box and the same one look on their site, decision 0168.)
