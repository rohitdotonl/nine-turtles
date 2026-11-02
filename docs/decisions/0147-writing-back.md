# 0147: Writing back opens the reader's own email app

*2 November 2026. The shape was agreed with the owner (PLAN.md → V1, item
2); the owner gave advance permission to build and ship it ("Go on V1. Ship
each one."). The smaller choices below were made by the building agent while
the owner was away, each listed for the owner's refinement round.*

**Decision.**

- **Write back** on every article of someone the reader follows opens the
  reader's own email app with the writer's address and "Re: the title"
  filled in. nine turtles never sends or reads that email: it only makes the
  `mailto:` link (SPEC section 37).
- The address comes from the reader (typed once, kept for the person), else
  the article's own place, else another of the person's places. A feed gives
  its author's, editor's or podcast owner's address; a newsletter its
  Reply-To, else its From. Send-only ("no-reply") addresses are never used.
- When nothing gives one, the reader types it once, in place; the person's
  page shows it and Edit person changes it.
- Stored as `feeds.email` (the publisher's, shared) and
  `subscriptions.write_to` (the reader's, on every place of the person),
  structure change 29, which only adds two empty columns.

**Choices made while the owner was away** (each easy to reverse):

1. **Where the button sits:** at the article's end, under its closing rule,
   centred, "Write back to Alpha", with the address under it in small muted
   type, rather than as an icon in the top bar: you write back after reading,
   and an envelope icon would need a name to be clear. It's also in More and
   on `w`.
2. **The subject only:** the email's body is left empty (no quote, no link
   to the article), so the reader's words come first. The title in "Re: …"
   says which piece it's about.
3. **A feed's address** is its author's or editor's; the articles' own
   author addresses only when they all agree (one writer); never the
   website's webmaster, who runs the site rather than writing it.
4. **A newsletter's address** is kept from its first email that gives one,
   as its one-click unsubscribe is, so a forged later email can't redirect
   replies.
5. **The reader's address wins** over the feed's, and emptying it in Edit
   person goes back to the feed's.
6. **Articles of a place no longer followed** (kept only in Starred) have no
   Write back: there's no person to keep an address on.
7. **The email app opens at once** when the reader types an address, while
   it's being kept, so a slow connection never stops the email app opening.

**Why.** The headline is "Read people. Write back." Writing back is what
turns reading into knowing someone, and an email from a reader is the
nicest thing a blogger gets. Doing it through the reader's own email app
keeps nine turtles out of the conversation (DESIGN.md: "not an email app",
"the writer comes first"), needs no new outside service, and costs nothing.
