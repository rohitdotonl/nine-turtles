# 0223: Other scripts set with the same care as English

**In one line:** Other scripts set with the same care as English: an article's language checked against its letters, right-to-left made whole, each script's own line height and title, names fenced, fields typed in any direction

*9 November 2026. Approved by the owner ("just implement your suggestions"),
after the critique in the project files (`critique-24/other-scripts.html`,
from Reichenstein's R4-6).*

**What we decided.** An article's language is the feed's only when the
article's letters agree with it. When most letters are in a script one
language usually stands for (Devanagari, Arabic, Hebrew, kana, Han, Hangul,
Thai…), a feed that says nothing, or names another language (WordPress
writes `en-US` by default), gives way to that script's usual language.
Shared scripts (Latin, Cyrillic) are never guessed. It's worked out when an
article is opened (`server/src/feeds/language.rs`), from the title and text,
so every article already saved benefits, and nothing is stored.

From that mark: right-to-left articles read right to left (title, text,
lists, quotations, byline on one right edge); each script gets its own line
height, title setting and emphasis (`web/src/scripts.css`); names and titles
are fenced (`<bdi>`) wherever they sit beside nine turtles' English; fields
start in the direction of what's typed; Find a person compares letters as
written.

**Why.** Screen readers choose their voice by the language mark, and
browsers the shapes and spacing of a script. With English set with care and
everything else by accident, a reader could see which writers the app was
built for (principle 7, the first floor).

**Still to come.** A serif Devanagari and a Naskh Arabic reading face, and
search in Chinese and Japanese, each in its own pull request.
