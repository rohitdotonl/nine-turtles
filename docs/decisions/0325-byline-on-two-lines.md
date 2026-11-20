# 0325: An author besides the publication goes on their own line, with "in" and the publication under it

**In one line:** When a feed names an author besides the publication, the byline is two centred lines, "{author}" and under it "*in* {publication}" (the "in" small, italic, in the second ink), replacing decision 0323's one-line "{author} / {publication}"; a name alone stays one centred line.

*20 November 2026. The owner, on "John Gruber / Daring Fireball" live: "Doesn't look symmetrical." Shown real screenshots of today's line, the slash on the centre line (A) and the names stacked (B), with long and short names on a phone and a computer, he liked B and asked "would the user get it that the first row is author name and second is the publication?"; a small italic "in" settles it.*

> **Partly replaces [0323](0323-byline-as-a-path.md):** its slash goes; its hidden "by" for screen readers stays.

**What changes** (SPEC section 7).
1. The author's name on a line of its own, centred; under it, centred, "in" and the publication's name (the link, as before). The day under both, as before.
2. Screen readers hear "by Mina Okafor in Asha Rao".
3. The byline moved into its own small piece of the web app (`Byline.svelte`), out of the article view.

**Why.** One centred line put the slash wherever the names' lengths left it, so the head looked lopsided; putting the slash on the centre line (tried first) left half a phone's width empty beside a long name. Two centred lines stay even with any names on any screen. Without a word, a publication named after a person ("Mina Okafor" over "Asha Rao") reads as two writers; "in" says which is which without leaning on the underline or a shade of grey.

**Cost.** One more line under the title when the feed names an author besides.

**Revisit if** the extra line feels heavy on articles that always name an author.
