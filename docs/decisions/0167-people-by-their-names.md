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
  person still called by their feed's own title, as the publisher last gave
  it (`feeds.title`, now refreshed at every changed check, so a label from
  an imported feed list never counts as the publisher's, and one reader's
  label never reaches another), and only once; a joined
  person keeps the name the reader chose. Answering "No, a publication"
  gives it back the feed's title.
- **Write back calls a person by their first name** ("Write back to
  Tomas") when their name is their own: two to four capitalised words that
  aren't a blog's title. Anything else is said whole.
- **People already followed** are renamed the same way, once, at their
  feed's next check, when its title is fresh: structure change 35 adds
  `subscriptions.name_pending` to mark them, and the check clears it.
- **Also in this change:** an article's byline names the author only when
  that isn't the name already shown ("Hal Brennan · 19 Oct"), and "Read on
  …" names the site by its own title ("Read on Garden Letters") or its
  address.

## Why

nine turtles is for people you might write to. A person is someone with a
name; a blog's title is a place. Asking "someone you might write to?" says
why the question matters.
