# 22. Everyone can read here (accessibility)

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- Contrast meets WCAG AA everywhere (an international accessibility standard) and AAA for article text, in every theme, including grey text.
- Nothing relies on color alone.
- Screen readers find the three panes as named regions, hear which item is selected, and hear changes such as "marked as read" (said when an article is opened, though nothing about it is written on screen). Each article is marked with its language so it's pronounced correctly: the item's language if given, otherwise the feed's, when the article's letters agree with it; when most of its letters are in a script one language usually stands for (Devanagari, Arabic, Hebrew, Chinese, Japanese…), that language. Scripts many languages share (Latin, Cyrillic) are never guessed: an article there that names no language is left unmarked (decision 0223, section 24).
- Follows the system's text size, reduced motion, high contrast and light/dark settings. On an iPhone or iPad, the system's text size (Settings › Display & Brightness › Text Size, and Larger Text in Accessibility) grows or shrinks the whole app, as it does Mail and Messages: the sidebar, lists, buttons, Settings and the article together, up to twice its size; Aa's text size stays the reader's own control for the article, on top (decision 0252). It's read when nine turtles opens and each time the reader comes back to it. Android's browsers and a computer's zoom already scale the whole page by themselves.

**How to check it**
1. Zoom the browser to 200%: everything still works and nothing overlaps.
2. On an iPhone, set Text Size larger, then come back to nine turtles: the sidebar, list and buttons are larger too.
3. Turn on your phone's or computer's screen reader (VoiceOver, TalkBack or NVDA). Move through items: it reads the title and says when things are marked as read.
4. The automatic checks run contrast and accessibility tests on every screen in every theme; a pull request can't pass if they fail.
