# 37. Writing back

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.
Decision 0147; the shape agreed with the owner on 2 November 2026 (PLAN.md →
V1, item 2). Its look gets a refinement round.*

**What it does**
- **Write back on every article** of someone you follow: at the article's
  end, under its closing rule (and under "Read on …" for a summary), one
  centred button, **Write back to Tomas** (a person by their first name
  when their name is their own, as "Tomas Berg" is, rather than a blog's
  title, which is said whole: "Write back to Notes from Tomas"; section 36),
  with the address it writes to under it in small muted type. It's also in
  the article's More menu (**Write back**) and on the keyboard, **`w`**
  (section 19). An article of a place you no longer follow (one kept only
  in Starred) has none: there's no person to write to.
- **It opens your own email app,** with their address and the subject
  "Re: " and the article's title filled in (a title that already starts
  "Re:" keeps its own). nine turtles never sends that email and never sees
  it, or your inbox; it only makes the `mailto:` link your device opens. The
  body is left empty for you.
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
  finding an address fetches nothing. A newsletter gives its Reply-To address, else
  its From address, from its first email that has one (a later email can't
  swap it). An address made only to send from ("no-reply", "donotreply",
  bounce and mailer addresses) is never used. A feed's address arrives with
  the next new article nine turtles fetches; a newsletter's with its next
  email.
- **When nine turtles doesn't know it,** Write back opens a quiet bordered
  box in place, as + Add a source does: "Write back to Alpha", a line
  saying nine turtles doesn't know their address yet, that many writers
  give it on their site (often an About or Contact page), that it's kept on
  their page once pasted, and that your own email app sends what you write;
  then **Find it on their site** (an everyday button that opens their
  website, the one their feed names or else their article's home page, in a
  new tab; left out, with the line about it, when nine turtles knows
  neither), **Their email address**, **Write back** and **Not now**. The
  keyboard starts on the field; Not now puts it back on the button.
  Something that isn't one address ("ivy at home", two addresses) is refused
  in oxblood words, keeping what you typed. Write back opens your email app
  at once and keeps the address for the person, on every source of theirs,
  so you're asked once; from then on Write back opens your email app
  straight away.
- **Their page** (section 36) shows it as **Email**, under their sources,
  as a link that opens your email app; it's left out while
  nine turtles doesn't know it. Edit (on their page) has an **Email address**
  field under the name ("Write back opens your own email app with this
  address."): change it and press Done to write somewhere else; empty it to go
  back to what their feed gives, if anything.
- Each reader's addresses are theirs alone. The address a feed gives is the
  same for everyone who follows it, as its name is.

**How to check it**
1. Follow a blog whose feed names no address (most WordPress blogs). Open an
   article and scroll to its end: **Write back to …**. Press it: the box
   asks for their address. Type "someone at home" and press Write back: it
   says it doesn't look like an email address, keeping what you typed.
2. Type a real address and press Write back: your email app opens with it
   and "Re: " and the title. Back in nine turtles, the button now shows the
   address under it; open another of their articles and press it: the email
   app opens straight away.
3. Open their page (press their name at the top of their list): **Email**
   shows the address. Press Edit: the field has it; change it and press
   Done; the page shows the new one.
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
