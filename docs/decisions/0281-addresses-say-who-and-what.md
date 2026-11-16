# 0281: Addresses say who and what

**In one line:** Addresses lead with names and end with a number (`/jim-nielsen-54/making-a-website-in-2026-5905`, `/unread/takuya-matsuyama/i-moved-39-repos-6373`, `/folders/friends-4`); only the number is read; `/people/`, `/publications/` and `/articles/` are gone, and the addresses from before no longer open (the owner's choice)

*16 November 2026.*

Rohit asked: "Can we change the URL to be more helpful? Like Author name,
feed name and title name?" Shown three ways (numbers only, words after the
numbers, words first), he chose words first, "best for readability", and
said: "it's okay to break older links. Keep the code clean."

**Decision.**

1. **A person or publication** is at their name and number: `/jim-nielsen-54`,
   with `/about` and `/settings` after it for their page and their settings.
   Addresses no longer say person or publication (that part of decision 0163
   goes): the sidebar does.
2. **A folder** is at `/folders/friends-4`, and `/folders/friends-4/edit`.
3. **An open article** (decision 0233) is its title and number under its
   list: `/jim-nielsen-54/making-a-website-in-2026-5905`. Under a list that
   isn't the writer's own (Unread, Starred, Notes, All, a folder), the
   writer's name comes between: `/unread/takuya-matsuyama/i-moved-39-repos-6373`.
   An untitled post uses its opening words.
4. **Only the number counts.** The words may be old, wrong or missing
   (`/54`, `/an-old-name-54/an-old-title-5905`): the same place opens, and the
   address bar then shows today's words, in place, adding nothing to the
   browser's history. So renaming someone, or a publisher editing a title,
   never breaks a link.
5. **The words** are lowercase letters and numbers joined by hyphens. Accents
   are dropped ("Café Noël" → `cafe-noel`), apostrophes join their word
   (`claude-codes`), anything else is a gap. Letters of other scripts (Hindi,
   Japanese, Arabic…) are left out, so such a title adds no words and its
   number does the work, and an address stays plain to copy. A name is cut at
   a whole word within 40 letters (30 before a title), a title within 50.
6. **The addresses from before** (`/people/12`, `/publications/7`,
   `/feeds/12`, `…/edit`, `…/sources/34`, `…/articles/29`) are wrong turns now
   (SPEC section 4). Nothing outside the app links to them: shared links are
   always the original's (the second floor).

**Why the number.** A name can't find a place on its own: two people can
share one, and names change. Ending each part with its number keeps every
link working through renames, and no name can clash with one of nine
turtles' own pages (`/settings`, `/unread`), which never end in a number.

**Privacy.** Names and titles now show in the browser's history (the tab's
title already did, decision 0231) and, when a page is loaded from its
address, in the host's request logs. nine turtles sends no referrer
(`Referrer-Policy: no-referrer`), so no publisher sees them.

**How.** `web/src/lib/router.ts`: `pathFor` is a place's identity, its
address by numbers alone (`/54`), for comparing places; `addressFor` adds the
names Shell gives it (`nameAddressesBy`); `withArticle` makes an article's
part; `articleIn` and `parse` read the numbers and skip the words;
`withoutWords` turns an address back into its identity. `Shell.svelte` writes
the address and puts today's names in it once the sidebar has loaded.
