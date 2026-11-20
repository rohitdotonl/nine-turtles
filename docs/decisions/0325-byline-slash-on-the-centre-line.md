# 0325: The byline's slash sits on the centre line, the names either side of it

**In one line:** In "Author / Publication" under an article's title, the slash sits on the column's centre line, under the picture and above the day, with the author's name ending at it and the publication's starting after it, so the head looks symmetrical whatever the names' lengths.

*20 November 2026. The owner, looking at "John Gruber / Daring Fireball" live: "Doesn't look symmetrical. What can we improve in alignment". Shown the slash on the centre line (A) beside the names stacked with no slash (B).*

**What changes** (SPEC section 7; builds on decision 0323).
1. The two names and the slash are three columns, the names' as wide as each other (a grid of `1fr auto 1fr`), with 0.55em between each, about what a space and the earlier extra room gave.
2. The author's name is set to end at the slash and the publication's to start after it; a long one wraps on its own side, so the slash stays on the line.
3. A name alone, with no author besides, is centred as before.
4. The byline moved into its own small piece of the web app (`Byline.svelte`), out of the article view.

**Why.** Centring the whole line put the slash wherever the names' lengths left it, off the line the picture, the day and the closing rule share; with one short and one long name it read as lopsided.

**Cost.** With a very short name beside a very long one, the short one's side has empty room, and the long one may wrap sooner than a centred line would. Each name has about half the column (some 18 letters on a small phone), so a long single word, such as a web address, breaks inside itself sooner than before.

**Revisit if** wrapped names look awkward on a phone, or readers find the hanging names harder to read than one centred line.
