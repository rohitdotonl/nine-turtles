# 24. Languages

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- The interface is in English.
- Articles can be in any language; each is marked with its language (decision 0221): the feed's, when the article's letters agree with it; otherwise, when most of the letters are in a script one language usually stands for (Devanagari, Arabic, Hebrew, kana, Han, Hangul, Thai and the other Indian scripts, Greek, Georgian, Armenian), that language. Scripts many languages share (Latin, Cyrillic) are never guessed: there the feed's word stands, and a feed's tag for a script the text isn't in is left out.
- Right-to-left articles (Arabic, Persian, Urdu, Hebrew, Yiddish…) read right to left: the title and the text share the right edge, the byline lines up on it, and lists and quotations keep their bullets and line on the right. nine turtles' own words around them (the byline's date, Write back, menus) stay English and left to right.
- Each script gets its own type settings (DESIGN.md → "Typography"): more room between lines for Devanagari, Arabic, Hebrew, Chinese, Japanese and Korean, a lighter Devanagari title, strict Japanese line breaks, and no slanted letters where a script has no italics.
- A writer's name or a title in another script keeps its own direction wherever it sits beside nine turtles' words (the list, the sidebar, a list's heading, the byline, Write back). Fields the reader types in (search, Find a person, notes, folder names, words to hide) start in the direction of what's typed. Find a person compares letters as written, vowel signs included.
- Search covers English, other Latin-alphabet languages and Hindi. Chinese and Japanese search are not in V1.

**How to check it**
Covered by sections 14 and 22. Open an article in Arabic or Hebrew whose feed names no language: the title and text start on the right, the byline lines up under the title on the right, and a screen reader reads it in an Arabic or Hebrew voice. Open a Hindi article: the lines have visibly more room than an English one and quotations are upright.
