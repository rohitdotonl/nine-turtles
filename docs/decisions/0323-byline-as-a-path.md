# 0323: The byline reads "Author / Publication", or the name alone, with no "by" or "in" to see

**In one line:** Under an article's title the byline shows "{author} / {publication}" (a faint slash, as a path or breadcrumb is written) or just the name when there's no one besides, instead of "by {author} in {publication}"; screen readers still hear "by" and "in".

*20 November 2026. The owner, comparing today's "by John Gruber in Daring Fireball" with a breadcrumb ("Guides / Product"): "this would reduce chrome/verbosity a lot. When it's just a name, it would show the name. When it's a name and publication, it would show John Gruber / Daring Fireball."*

**What changes** (SPEC section 7, replacing that part of decision 0294).
1. The italic "by" and "in" go from sight. They stay in the line as visually hidden words, so a screen reader still says "by John Gruber in Daring Fireball", a sentence, rather than two names.
2. Between the author and the publication, a slash with a space after it and a no-break space before it (so it never starts a line), in `--faint`, the list's date grey, with 0.3em more room on each side so the names stand clearly apart (the owner, the same day: "add good space before and after /"), hidden from screen readers.
3. Everything else stays: the picture above, the names in the reading face, full ink, regular weight; the publication's link underlined at rest as every link is (BRAND.md), opening their list; the day small and faint on its own line.

**Why.** Under a title already set like a book's, the name is what's needed; "by" and "in" added two words and a second voice (italic, grey) to every article. The slash is the web's familiar way to say one thing sits inside another, and it's quieter than words.

**Revisit if** readers take the slash for a path they can press, or miss who wrote it.
