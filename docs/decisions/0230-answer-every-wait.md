# 0230: Every wait is answered

**In one line:** Every wait is answered: "Loading Outdoors…", "Loading the article…" and "Starting the video…" after half a second, "You're signed out" with Sign in, "You're following …" with Undo, and keys that need an article saying to choose one

*10 November 2026.*

Rohit's "implement all" (10 November 2026) on round 2 of the critique
through the principle "Answer every action": six moments a press still got
no answer, mostly while waiting.

**What changed.**

1. **A list on its way says so.** A list that takes more than half a
   second shows one line where its rows will be, "Loading Outdoors…" (its
   name; "Searching…" for a search), in the closing caption's muted serif.
2. **An article on its way says so:** "Loading the article…" under the
   byline, muted, in the reading face, after half a second.
3. **A video on its way says so.** Pressed, the Play box stays over
   YouTube's player until the player has loaded, saying "Starting the
   video…" after half a second. The publisher's player still plays it (second floor).
4. **Signed out says so.** A mark the server refused because the reader is
   no longer signed in says "You're signed out, so the star wasn't saved."
   with **Sign in** in Try again's place (a reload: the sign-in page, then
   the same list), since trying again could never work.
5. **Following is named, with Undo.** After following, the list that opens
   says "You're following Maya Chen." with Undo, which unfollows them (an
   unfollow, kept for undo like any other) and goes back to the home list.
6. **A key that needs an article says so.** `s`, `m`, `w` and `n` with no
   article chosen say "Choose an article first. j chooses the first one.",
   a passing line that never takes away an Undo.

**How.** One small piece, `LateLine.svelte`, says a wait's words after half
a second (`SAY_AFTER_MS`, shared with the busy buttons of decision 0229),
so a quick answer never flickers. Each line is heard by screen readers.

**Why.** Principle 8, "Instant and still", and principle 5, "Honest by
default": a blank space looks broken or empty, and a Try again that can't
work isn't an answer. No spinner, skeleton, fade or new color.
