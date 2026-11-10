# 0173: Rules become one sentence, "Hide articles about…"

**In one line:** *(Switched-off rules deleted by 0174.)* Rules become one sentence: "Hide articles about [words] from [everyone / this person]", started from an article's More menu or a person's page; star, mark read, author, folders and the title-only choice go; Settings › Hiding and Hidden articles (no count); folder rules become one per person, rules with an author or star / mark read are kept but never shown or run (structure change 39)

*The switched-off rules were deleted by [0174](0174-keep-starred.md).*

*4 November 2026. Step 8 of the owner's review plan. Rohit said go on the
whole plan and permitted removing these features and their data, including
the data path below. The words were agreed in the owner's review thread.*

**Why.** A rule was a five-blank sentence (words, where to look, author,
place, action) with three actions. Nearly every use is one thing: "I don't
want to see articles about this." One sentence with two blanks says it,
and needs no explaining.

**Decision.**

- **One sentence:** "Hide articles about [words] from [everyone / this
  person]." Words are found whole, in the title or the text. "This person"
  is anyone the reader follows, a person or a publication, and covers all
  their sources (the rule stores one of their places, `feed_id`, and widens
  to the others that share its `writer_id`).
- **Gone:** the star and mark-as-read actions, the author blank, the folder
  choice and the "its title / its title or text" choice. If someone misses
  them, they'll write. Deleting a folder no longer touches rules, so its
  Undo (and the assistants' `create_folder`) hands back only saved searches.
- **Names:** Settings › **Hiding** (`/settings/hiding`), **Hidden articles**
  (`/settings/hidden`, with no count beside it), **Unhide**, "· Hidden" in
  search. The old addresses (`/settings/rules`, `/settings/muted`) still
  open those pages. The database keeps its words (`rules`, `entries.muted`).
- **Where it starts:** an article's More menu and a quiet link on a person's
  page, both **Hide articles about…** (one name everywhere: not "like this",
  which would suggest nine turtles judges similarity). Both open Settings ›
  Hiding with the sentence set to that person, so there is one editor and
  the "Also hide the 12 unread articles that match?" question and Undo stay
  where they were. "Add a rule…" in Edit goes.
- **One quiet line** under the sentence: "Hidden articles are kept and marked
  read. Search still finds them." The line about whole words goes: it
  explains machinery, and the sentence already works as people expect.
- **Leaving someone:** when one of a person's sources is cleared, their rule
  moves to another source of theirs still followed; only when none is left
  does it say "from someone you no longer follow".
- **The data path (structure change 39):** rules that fit (mute, words, every
  feed or one feed) carry on, reworded; an old title-only rule still looks
  in titles only and says "(in titles)". A rule for a folder becomes one rule
  per person in that folder (paused if it was); one whose folder held nobody
  or was already gone matches nothing, as before. Rules with an author, or
  that starred or marked read, stay in the table untouched but are never
  shown or run (`rules::RULES` reads only the others). What any rule already
  did stays done. Rohit had no rules, so nothing changes for him.
- **Assistants (MCP):** `add_rule` takes `words` and an optional `feed_id`
  (any of the person's feeds), plus `title_only`, `paused` and `place_gone`
  only to make a removed rule again (so one whose person is gone never comes
  back for everyone); `list_rules` and `delete_rule` answer the new shape.
