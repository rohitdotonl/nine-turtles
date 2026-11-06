# 0192: No Write back for publications

*6 November 2026.*

**Context.** Since decision 0163, everything a reader follows is a person or a
publication, and nine turtles asks which when it's added: "A person: someone
you might write back to" or "A publication: anything you only read or watch,
and won't write back to." But Write back (SPEC section 37) was never turned
off for publications ("Write back to Garden Letters"), so the question changed
little and the publication's tile promised something the app didn't do. The
owner, reviewing onboarding, chose to remove it.

**Decision.**

- A publication has no Write back: not at the end of its articles, not in the
  article's More menu, not on `w`, and no Write to on its page.
- Its Edit has no Email address field; the field goes as soon as A publication
  is chosen, and nothing typed in it then is kept. The field moves under
  **This is**, so choosing takes away only what's below the choice and
  nothing above the pointer moves.
- Choosing **A person** in Edit brings all of it back, with any address kept
  from before (the address stays stored; only what's shown changes).
- The question when adding stays, with nine turtles' guess chosen in advance
  (the owner: no guess is reliable enough to skip asking).

**Consequences.** The person-or-publication question now means something: a
person is someone you write to, a publication is something you read. No data
changes. Assistants over MCP (SPEC section 33) have no Write back of their own,
so nothing changes there.
