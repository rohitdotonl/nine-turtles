# 0138: "Follow this person?" when a page is shared

**In one line:** A page shared to nine turtles opens one question, "Follow <name>?", with the site under it and one press, Follow (the site's own feed, its first); no field, no choice of feeds, no word of "feed" or "RSS"; nothing saved as a link, no read-later (the owner, 1 November 2026)

*1 November 2026. Asked for by the owner, after the positioning work ("read
people, not feeds", `docs/RnD/ideal-reader.md`).*

## Decision

- **A page shared to nine turtles opens one question,** "Follow <name>?",
  not Add a feed's field (the ways in are decision 0104's: a share menu, a
  Shortcuts shortcut, a bookmark). The name is the one the person's feed
  gives itself, from the feed finder's preview (decision 0099); until it's
  known, "Follow this person?". Under it, their site ("jane.example") and,
  under "Lately", the titles of their three newest pieces, from the same
  preview, as plain text, so the reader knows who they're saying yes to. One
  press, **Follow**, beside **Not now** (`web/src/lib/FollowPerson.svelte`,
  `web/src/lib/follow.ts`).
- **No word of "feed" or "RSS" on that screen,** problems included: they
  are said in their own sentences, or Add feed's where those have neither
  word.
- **Follow follows the site's own feed,** the first the page names, without
  a choice: a site's first feed is its main one, and a list of feeds is the
  machinery the question hides. Someone wanting another one can still paste
  its address into Add a feed.
- **Still never follows by itself** (decision 0104): the look only looks;
  only Follow follows. Not now, Escape and the X follow nothing.
- **Nothing is saved as a link, and there's no read-later:** the owner chose
  this over a save-for-later, which would mean fetching pages and a pile
  that grows.

## Why not

- *Keeping Add a feed's field, prefilled:* it asks the reader to think about
  feeds, the word the new positioning drops.
