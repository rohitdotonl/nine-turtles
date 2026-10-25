# 0073: Marks try again while nine turtles is out of reach

*25 October 2026. After the owner saw "An article couldn't be marked as read" while a new version was going live, and the message stayed until a reload.*

**Decision.** A read mark or star that can't reach nine turtles is tried
again quietly, after 1, 2, 4, 8 and then every 15 seconds, for up to a
minute from when the mark was made. Only "can't connect", a timeout, and
502/503/504 (the host's answers while the server restarts) count; any other
answer, such as 500 or 401, fails at once, since trying again wouldn't help.

- **Counted from when the mark was made,** so marks queued behind one another
  give up together instead of adding their minutes up.
- **Lists don't wait for a save that's waiting to try again.** They normally
  wait for saves so a list opened next shows them; while the server is out
  of reach they'd fail anyway, and say so, rather than hang for a minute.
- **If a mark still fails,** the note at the foot of the list says so with
  **Try again**. The message goes once a later mark is saved, or Try again is
  pressed. A failure that arrives after a newer undoable action keeps that
  action's Undo beside Try again, and the line returns to it afterwards.
  Nothing disappears on a timer (DESIGN.md → "Nothing moves unless you move
  it").

**Why.** Merging a pull request restarts the only server for a few seconds
(nine turtles runs as one instance on Render). A mark made then used to be taken back
at once, with a message that only an undoable action or a reload replaced.
