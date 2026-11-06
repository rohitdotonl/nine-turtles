# 0197: One house style for messages

*6 November 2026.*

**Decision.** Every line the app says after an action or a failure follows
one house style, written in [`BRAND.md`](../BRAND.md) → "Messages": what
you did is a full sentence with a full stop ("Starred.", "Unsubscribed from
Mira Okafor."); a failure names the thing and says what to do ("The star
couldn't be saved. Try again in a moment."); no connection starts "You're
offline."; a successful Undo always says "Undone." and a failed one "That
couldn't be undone. Try again in a moment."; no file formats, commands or
network terms in a message. The owner approved the rules and the rewrite on
6 November 2026 (the doc "Popups and error messages: what to improve").

**Why.** The same thing was said several ways ("Couldn't change that.",
"That didn't work just now.", "It's back.", "The passkey is back.",
"Check your connection and try again"), some lines had no full stop, and
five failures said only "That couldn't be saved." without naming what.
The owner notices inconsistent wording; one style makes the app read as
made by one hand ("cohesive", "made by a person, to the last detail").

**How.** The lines said in many places live once, in
`web/src/lib/messages.ts` (`UNREACHABLE`, `UNDONE`, `UNDO_FAILED`), and
`feeds.ts`'s `undoRefused` gives every Undo of a feed or folder the same
failure line. Every other message was rewritten in place. Help pages keep
technical names (OPML, JSON Feed) where they explain them.
