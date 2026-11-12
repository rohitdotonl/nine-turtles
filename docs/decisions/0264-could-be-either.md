# 0264: Could be either

**In one line:** nine turtles sorts each followed place into a person or a publication by seven rules, keeps why (`subscriptions.kind_why`, structure change 51), and when the feed can't tell, files it as "could be either", kept with the publications until the reader settles it on Everyone you follow, their page, Add, or once at the end of their articles.

*12 November 2026.*

Rohit's pick (11 November 2026) of the proposal "Sort imported feeds into
people and publications": its steps 1 to 5 and the bolder ask at an
article's end. The pictures he approved are `sorting-proposal/` in the
project's files.

**What was wrong.** For a place on its own, nine turtles guessed a person
or a publication from the feed (decision 0163), and when nothing told, it
guessed a person. An imported list filled People with magazines and
companies, and nothing said which guesses were sure and which were not, or
why. The reader had no way to find the doubtful ones except one at a time.

**Decision.**

1. **Seven rules, the first that fits** (`server/src/writers/kind.rs`):
   a YouTube channel or playlist could be either (decision 0213 stands: it
   acts as a publication); several names sign its articles: a publication;
   one person's name signs them (not a role, not the feed's or the site's
   own name): a person; the site is someone's own (a place on a site many
   people share, a title saying it's someone's, or an address that is a
   name-like title run together, janedoe.com): a person; the site's own name
   is a word of its title: a publication; a folder it came in has a telling
   word (Friends, Family, People, Personal, Writers; News, Newspapers,
   Magazines, Publications, Companies, Media, Press): that; anything else
   could be either. "Still unclear: a person" is gone.
2. **Why is kept**: `subscriptions.kind_why`, one of `one-name`, `own-site`,
   `several-names`, `site-name`, `folder`, `unsure-no-names`,
   `unsure-channel`, or `reader` when the reader chose. Open means
   `unsure-…`. `kind` stays `person` or `publication`, so an open place is a
   publication everywhere (sidebar, no Write back) and every query that read
   `kind` reads it as before.
3. **Places already followed keep their setting.** The new column is empty
   for them: no "why" line, never in the list to settle.
4. **Where the reader settles it**: Everyone you follow lists the open ones
   first, a tick making each a person at once and "The rest are
   publications" settling the others with Undo; their page says why under
   "This is", with neither option chosen while open; Add's question leaves
   both tiles unchosen when it can't tell; and the end of their articles asks
   once, "Is … someone you might write back to?". Any of these, and a drag
   between People and Publications, saves `reader`; Undo puts back the
   reason it had.
5. **An import says how it went**: once every feed it added is checked,
   Unread and All articles say "Your list is in: 18 people and 4
   publications. 8 could be either." with Look them over and ×. The feeds it
   added are kept in the `import_note` row of `person_settings`, so the line
   survives a reload; closing it, looking them over or undoing the import
   removes it.

**Limits learned building it.** A feed's name is tidied as it arrives
(decision 0260), so "Jim Nielsen's Blog" is "Jim Nielsen" by the time it's
sorted: the possessive is gone, and rule 4 finds him by his address
(blog.jim-nielsen.com) instead. An address that is a magazine's name run
together ("Low-tech Magazine" at lowtechmagazine.com) isn't a person's: the
title must read as a name, two or three capitalised words, none of them a
publication's word (The, Magazine, News, Journal…).

A name said as theirs must read as a name, and not a magazine's: "Harper's
Magazine", "Men's Health", "Reader's Digest" and "The World's Best…" aren't
someone's own site. And a person's name that is also their blog's title
("Julia Evans" signing "Julia Evans") is still theirs, when it reads as a
name of two or three words; a role such as "admin" beside one name doesn't
count against it (the second-agent review, 13 November 2026).

**Exceptions.** The question at an article's end and Add's unchosen tiles
are written in DESIGN.md's Exceptions log (principle 3, asks only as a last
resort), and the import line widens decision 0249's entry.
