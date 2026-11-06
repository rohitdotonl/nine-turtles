# 0198: "Or try one" in the welcome, and no dead end for an email-only newsletter

*6 November 2026. The owner's onboarding review, finding 5; the owner chose the examples, approved the design after three rounds of mockups ("the UX is good"), chose "Start reading", and asked for "Bring your list from another app…" to stay prominent for people who already use feeds.*

**Decision.**
- Under "Bring your list from another app…", the welcome shows **Or try
  one**: three fixed examples, a blog (www.rohit.onl), a newsletter
  (jmarriott.substack.com) and a YouTube channel (youtube.com/@TwoCentsPBS),
  as quiet rows: the kind in small capitals, the address, and "Try".
- Pressing one follows it at once through the ordinary add path, without
  the person-or-publication question (the guess stands). The welcome stays
  and shows "Newest from {name}" with their newest title in the reading
  serif (it opens them), "You're following {name}…", **Start reading** (an
  outlined button; Add stays the one filled button) and the examples not
  yet pressed. Going anywhere else in the app ends it.
- A site with no feed, under Add's usual sentence, offers the reader's own
  newsletter address with Copy and a link to the site: an email-only
  newsletter then arrives as a feed (section 28) instead of a dead end.
- "New to feeds? Start here" moves under the examples; "Bring your list…"
  stays just under the field, the first way in for someone who already
  reads feeds.

**Why.** Onboarding should end in an "aha": you give an address, and a
person's own writing is simply here. An example of each kind of address
teaches what to paste better than a sentence, and one press gets a newcomer
there. Nothing is followed until they press, and the examples are fixed and
the same for everyone (DESIGN.md's Exceptions log).

**Built.** `web/src/lib/welcomeTry.svelte.ts` (the examples and the state
that keeps the welcome), `TryOne.svelte`, `ByEmail.svelte`; `Shell.svelte`
ends it on any move.
