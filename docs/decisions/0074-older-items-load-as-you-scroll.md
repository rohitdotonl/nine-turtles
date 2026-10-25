# 0074: Older items load as you reach the bottom of a list

*25 October 2026. Asked for by the owner ("Implement 1 … I choose auto-load. Change the rule.").*

**Decision.** A list no longer waits behind a "Show older items" button.
When the bottom of the list comes into view, the next 50 articles load
below by themselves, with a small grey centred "Loading…" while they arrive.
Nothing above moves. When nothing more is left, the list ends with a quiet
"You're all caught up."

- **The list still ends.** It holds only articles from feeds you follow;
  nothing is added to keep you scrolling. That is what stays on DESIGN.md's
  "Never" list: algorithmic ranking, and padding a list so it never ends.
- **The keyboard and screen readers keep a button.** "Show older items" is
  still there, hidden until Tab reaches it, then a small grey outlined pill
  centred under the list. If it loads the last page, the keyboard's place
  moves to the first article just added.
- **A failure stops it.** If a page can't be loaded, it doesn't try again on
  its own: the message says so and the button shows for everyone.
- **Never in the accent.** The old button's bold blue words broke the rule
  that the accent marks only what's unread or found (decisions 0037, 0057).

**Why.** The owner found the button ugly and chose loading as you scroll
over a quieter button, knowing DESIGN.md listed infinite scroll under
"Never". DESIGN.md Part 1 (principles 2 and 5 and the "Never" list),
SPEC.md and AGENTS.md were changed with the owner's approval.
