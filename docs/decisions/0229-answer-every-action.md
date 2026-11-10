# 0229: Every press is answered

*10 November 2026.*

Rohit's "Implement all suggestions" (10 November 2026) on the critique of
nine turtles through the principle "Answer every action" (the 24
critiques, principle 2): six places where a press got no visible answer.

**What changed.**

1. **A mark made while reading is said where you read.** The list's note
   ("Starred.", "Marked as unread.", with Undo and ×) used to appear only
   at the foot of the list, which is out of sight while reading on a phone
   or with the list hidden on a computer, so Mark unread there changed
   nothing on screen, and screen readers didn't hear it (the hidden list's
   note is hidden too). While the list is out of sight, the same note now
   floats 12px above the article's foot (above a phone's toolbar), and the
   article gains room at its end so the note never covers its last words or
   Write back. The list
   keeps the note; the article only draws it (`listNote.ts`,
   `AwayNote.svelte`), and only on the article it was made on.
2. **Refresh with nothing new says so:** "Nothing new has arrived since
   14:05." Like the key lines in 6, it is a passing line (`inform` in
   `ItemList.svelte`): it never takes away the last action's Undo (`u`
   still undoes it) and never covers a failed save's line.
3. **A main button that waits says what it's doing,** in its own word,
   once the wait passes half a second ("Signing in…", "Saving…",
   "Following…"; `Waiting.svelte`), as Add already said "Looking…". The
   button keeps its look (decision 0045) and its width (both words share
   one cell), so nothing beside it moves.
4. **Write back says "Opening your email app…"** under the address once
   pressed, with **Copy their address** for when nothing opened (a
   computer with no email app set up does nothing visible otherwise).
5. **A press is felt:** a still 10% tone of the ink under a finger or a
   held mouse button on rows, buttons and underlined words to press
   (`pressed.css`), the main action a step to the full ink; the browser's
   own tap flash off. No fade.
6. **A key with nothing to do says why:** `j` / `k` at the list's ends and
   `u` with nothing to undo.

**Why.** Principle 8, "Instant and still": every press answered visibly
within about a tenth of a second, without motion. Each fix reuses a
piece the app already had (the note, a word changing, a tone), so none
adds a new way of doing things (principle 6). No animation, no color
beyond the ink, and each answer is words a screen reader hears.

**Limits.** No spinners, no timers that put a note away, no counts. The
pressed tone is never the only answer: what the press does still shows.
