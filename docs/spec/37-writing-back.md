# 37. Writing back

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.
Decision 0147; the shape agreed with the owner on 2 November 2026 (PLAN.md →
V1, item 2). Its look gets a refinement round.*

**What it does**
- **Write back on every article** of someone you follow: at the article's
  end, under its closing rule (and under "Read on …" for a summary), one
  centred button, **Write back to Alpha** (the person's name, section 36),
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
  every article that names an author's address names the same one, that; a
  magazine whose articles name several gives none, and a website's
  `webMaster` never counts. A newsletter gives its Reply-To address, else
  its From address, from its first email that has one (a later email can't
  swap it). An address made only to send from ("no-reply", "donotreply",
  bounce and mailer addresses) is never used. A feed's address arrives with
  the next new article nine turtles fetches; a newsletter's with its next
  email.
- **When nine turtles doesn't know it,** Write back opens a quiet bordered
  box in place, as + Add a source does: "Write back to Alpha", a line
  saying nine turtles doesn't know their address yet, that it's kept on
  their page once typed, and that your own email app sends what you write;
  then **Their email address**, **Write back** and **Not now**. The
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
4. Follow a blog whose feed names its author's email (many Atom feeds, and
   RSS feeds with `managingEditor`), or a newsletter: Write back opens your
   email app at once, with no question, and their page shows the address.
5. On a computer, open an article and press `w`: the same as pressing
   Write back.
