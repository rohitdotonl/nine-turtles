# 22. Everyone can read here (accessibility)

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- Contrast meets WCAG AA everywhere (an international accessibility standard) and AAA for article text, in every theme, including grey text.
- Nothing relies on color alone.
- Screen readers find the three panes as named regions, hear which item is selected, and hear changes such as "marked as read" (said when an article is opened, though nothing about it is written on screen). Each article is marked with its language so it's pronounced correctly: the item's language if given, otherwise the feed's; if neither says, it's left unmarked rather than guessed.
- Follows the system's text size, reduced motion, high contrast and light/dark settings.

**How to check it**
1. Zoom the browser to 200%: everything still works and nothing overlaps.
2. Turn on your phone's or computer's screen reader (VoiceOver, TalkBack or NVDA). Move through items: it reads the title and says when things are marked as read.
3. The automatic checks run contrast and accessibility tests on every screen in every theme; a pull request can't pass if they fail.
