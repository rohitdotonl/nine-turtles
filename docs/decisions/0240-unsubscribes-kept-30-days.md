# 0240: Your own unsubscribes are kept 30 days, with Bring back

*10 November 2026.*

Rohit's "Implement every suggestion from round 1. From round 2, implement
10, 11, 12, 13, 14" (10 November 2026), suggestion 6 of the critique
through the principle "Forgiving"
(`critique-24/principle-04-forgive-mistakes.html`, in the project's files).
His message is also his yes to the change in the floor's wording below. The
owner's critic settled the words and the two questions below.

**Decision.**

- Every unsubscribe, the reader's own as an assistant's already was, is
  kept, hidden, for 30 days (`folders::KEPT_FOR`) with its articles, read
  history and folders, then cleared for good as before. Undo straight
  afterwards stays as it was; unsubscribing from someone else no longer
  ends the first one's keep.
- **Recently unsubscribed**, the last group of Settings › Everyone you
  follow, lists them, newest first, one row per person: the name,
  "Unsubscribed today · kept until 8 Dec" (or "Unsubscribed by an
  assistant …"), and **Bring back**, which has Undo like every action
  there. Under it: "Kept for 30 days, with their articles, so you can
  bring them back."
- **One list.** What an assistant unsubscribes from moved there too, out of
  Settings › Connected assistants, which now says so in one line (one copy
  of each thing). `subscriptions.by_assistant` (structure change 49) keeps
  who did it; every unsubscribe kept before this was an assistant's.
- **"Remove them too"** still happens once Undo's ten minutes are over
  (`notes::drop_kept_due`), not after 30 days: otherwise the starred
  articles and notes the reader asked to remove would stay in Starred,
  Notes and search for a month. The place itself is kept its 30 days, and
  Bring back returns it without them. Undo, from then, says it's too late
  (`subscriptions.removed_at`), rather than bring back less than it says.
- Bring back and adding a kept one again count towards the 1,000 feeds a
  reader follows; a folder hidden with everyone in it waiting never blocks
  its name (renaming another folder to it takes its place).
- **The floor's wording** (AGENTS.md, ENGINEERING.md → "The floor"):
  unsubscribing stays one of the three exceptions to undo, but only once
  its 30 days are over.
- Only the import's Undo still clears at once: it takes back exactly what
  the import added (decision 0238).

**Why.** Undo handles a slip; a mistake (the wrong Hal) is noticed days
later. nine turtles already forgave an assistant this way and not the
reader.

**Costs, checked before building.** Nothing is deleted sooner than before,
only later, so no data can be lost by this change. The disk keeps what an
unsubscribed feed already had for 30 more days; the feed isn't checked
meanwhile (when nobody else follows it), so nothing new piles up. A
newsletter's sender is told to stop once the 30 days are over rather than
after ten minutes (so Bring back works whole); its emails are dropped
until then, and for `STAYS_AWAY_FOR` (30 days) after, so a slow sender
can't bring it back by itself.
