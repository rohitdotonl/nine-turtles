# 0167: People are called by their names

*3 November 2026. Step 2 of the owner's review (items 1 and 7): in the
owner's test a blog by Tomas Berg became a person called "Notes from Tomas",
and Write back said "Write back to Notes from Tomas".*

## Decision

- **The question after adding** is "Is Tomas Berg someone you might write
  to?", answered **Yes, a person** (under People) or **No, a publication**
  (under Publications). Same one tap, same place, the guess already chosen.
  It replaces "someone or something?" (decision 0163), whose words were the
  app's, not the reader's.
- **A feed that signs every article with one author's name** names the
  person: nine turtles calls them that, as the feed writes it, when it first
  guesses a source on its own is a person (`writers::kind::one_author`).
  Their page shows the blog's own title under the name. One unsigned article
  is enough to leave the title alone (it may be someone else's), as is a
  role such as "admin". An Atom feed's one author signs its entries too.
- **A name the reader gave always wins.** nine turtles renames only a
  person still called by their feed's own title, and only once; a joined
  person keeps the name the reader chose. Answering "No, a publication"
  gives it back the feed's title.
- **Write back calls a person by their first name** ("Write back to
  Tomas") when their name is their own: two to four capitalised words that
  aren't a blog's title. Anything else is said whole.
- **People already followed** were renamed the same way, once, by
  structure change 35, which changes only names (no structure), and only
  where the reader hadn't given one.

## Why

nine turtles is for people you might write to. A person is someone with a
name; a blog's title is a place. Asking "someone you might write to?" says
why the question matters.
