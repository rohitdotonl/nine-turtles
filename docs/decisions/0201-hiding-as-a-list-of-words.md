# 0201: Hiding as a list of words

*6 November 2026.*

**Context.** Point 9 of the owner's whole-app review of what to remove or
simplify. Hiding was a sentence filled in on a sheet ("Hide articles about
[words] from [everyone / this person]"), with a switch on each rule, an Edit
sheet, and a question after saving ("Also hide the 12 unread articles that
match?"). Two versions were mocked up: a safe one (the same list without the
switch) and a bold one, a plain list of words like Mastodon's and Bluesky's
muted words, with a time limit. The owner chose the bold one, with For good
as the usual choice.

**Decision.**

- Settings › Hiding starts with one field, **Hide articles about…**, Add,
  and how long: **For a week**, **For a month** or **For good** (chosen
  first, and again after each word).
- Adding hides at once the unread articles already about the word, with no
  question; Undo removes the word and puts exactly those back.
- Each word is one row: the word, whose articles and how long ("Everyone ·
  for good", "Maya Chen · 5 days left"), and Remove, at once, with Undo.
  The per-rule switch and the Edit sheet go.
- No folder choice: everyone or one person, as decision 0173 has it. A word
  for one person still starts from their page or an article's More menu,
  which opens Settings › Hiding with "Only from" them and "Everyone
  instead".
- When its time is up, a word stops hiding and leaves the list; what it hid
  stays hidden.
- Structure change 45 adds `rules.until` (null is for good). Nothing is
  removed: words paused before keep being paused, hide nothing, and say
  "paused" on their row; Remove takes them away. Assistants (MCP) are left
  as they are, so they still can make a paused word.
- The server's edit, pause and apply routes go; making a word from the
  screen hides what already matches in the same request.

**Consequences.** One page and no sheet: fewer steps to hide something, and
nothing to switch on and off. A word for an election or a match can end on
its own. Changing a word means removing it and adding it again.
