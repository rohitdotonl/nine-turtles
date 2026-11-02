# 0148: No unread counts: a small dot says something is new

*2 November 2026. The shape was agreed with the owner (PLAN.md → V1, item
3, decision 0140); the owner gave advance permission to build and ship it
("Go on V1. Ship each one."). The smaller choices below were made by the
building agent while the owner was away, each listed for the owner's
refinement round.*

**Decision.**

- The sidebar shows **no numbers**: no count beside a feed, a person or a
  folder. A feed, person or folder with something unread has a **small
  dot** at its row's end, in the theme's accent, where the count stood. It
  says that something is new, never how much (SPEC section 5).
- **Settings › Reading › Unread counts** (Show or Hide, decision 0097) is
  gone: with no numbers there's nothing to hide. Unread, the list's unread
  dot and read styling are unchanged; in river mode there are no dots.
- The Exceptions log's "Unread counts in V1" row is removed: principle 1,
  "Nothing pulls", no longer bends for them. The unread dot's row now
  covers the sidebar's dot too.
- Other apps that sync over the Google Reader protocol (SPEC section 26)
  still get their unread counts: that's the protocol, and what those apps
  show is theirs. AI assistants (SPEC section 33) are unchanged.

**Choices made while the owner was away** (each easy to reverse):

1. **The dot's size:** 6px, a step smaller than the article list's 8px dot,
   because the sidebar's names are smaller than the list's titles; the same
   accent and the same shape, so it reads as the same mark.
2. **Where it sits:** at the row's right end, where the count was, so every
   dot sits in one column; a folder's arrow still takes its place under the
   pointer, as it did the count's.
3. **What screen readers hear:** ", unread" after the name ("Alpha,
   unread"), as after an unread article's title, never a number.
4. **A folder's dot** shows when any of its feeds has something unread.
5. **The reader's old choice** (`counts` in `person_settings`, and this
   device's `nine-turtles.counts`) is left where it is and no longer read:
   removing it would gain nothing and is a change to stored data. A tab
   still open from before that sends it is answered as if it hadn't.

**Why.** A count is a pile that grows: it turns reading into a backlog to
clear, which is the pull social media uses (DESIGN.md principle 1). The dot
answers the question the reader actually has, "is there something new from
them?", without saying "you're behind".
