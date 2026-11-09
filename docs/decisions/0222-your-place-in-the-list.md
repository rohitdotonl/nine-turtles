# 0222: Your place shows in the list

*9 November 2026.*

**Decision.** While nine turtles keeps your place in an article (decision
0060), the article's row in every list says how far you got, in a few plain
words after the time: "· Just begun", "· A third read", "· Half read",
"· Two-thirds read" or "· Nearly finished". A place kept on another device
(decision 0175) says "· Part read", since only the device that measured it
knows how far. The words go when the place does: once you reach the end or
scroll back to the top.

**Why.** Rohit asked for it on 9 November 2026, from the Silvio Rizzi
critique (`critique-24`, suggestion 3). The place was kept but invisible in
the list: a half-read article looked exactly like a finished one, so the
reader had no reason to go back to it unless the empty reading area happened
to offer it. Seeing "Half read" in the list lets them finish what someone
wrote, by their own choice (principle 2, the writer comes first).

**How.** A kept place now also holds `read`: how much of the article has been
in view, from 0 to 1 (the window's bottom down the whole text), measured when
the place is written down. It stays on the device, like the place; the server
still keeps only the block and how far into it. A place that comes back from
the server unchanged keeps the share this device measured. The row's words
come from `howFarWords` (`web/src/lib/places.ts`) and are shown by
`RowPlace.svelte`, which listens for places being kept or forgotten.

**Limits.** Words, never a bar, a percentage or a count: it describes one
article, like "Starred", and is not a reading statistic (DESIGN.md → "Never").
In the source name's muted grey (AA), never the accent.
