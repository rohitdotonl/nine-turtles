# 0127: Six questions before writing code

*29 October 2026.*

**Decision.** Before writing code, an agent asks six questions in order and
stops at the first yes: does this need to exist; is it already in this
codebase; does the standard library, SQLite or the browser do it; does a
library we already have do it; can it be a line or two in an existing
place; and only then, the smallest thing that works, with a test if it has
logic. The list lives in `docs/ENGINEERING.md` → "Keeping the code tidy";
AGENTS.md points to it and the second-agent review looks for code it would
have made unnecessary. The floors are never cut to write less.

**Why.** The code tidy-up of October 2026 used Ponytail's "ladder"
(github.com/DietrichGebert/ponytail) as its yardstick, and most of what it
removed was code one of these questions would have stopped. The owner
asked (29 October 2026) for the list in our own words.

**Not chosen.** Installing Ponytail itself as a plugin: it works only in
some agent tools and brings settings we don't control, while everything
agents follow lives in the repository so tools stay replaceable
(ENGINEERING.md → "No vendor lock-in"). Step 4 is ours, not Ponytail's: a
new library still needs the owner's yes.
