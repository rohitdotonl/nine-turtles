# 0235: Printing an article prints the article

*10 November 2026.*

Rohit's "implement all suggestions from rounds 1 and 2 except P03-8"
(10 November 2026), suggestion P03-6 of the critique through the principle
"Fit what people already do". Before, Print printed whatever was on screen:
on a computer, mostly the sidebar and the list, and only the first screen
of the article.

**Decision.** With an article open, the browser's Print prints that article
alone, black on white in every theme, as a page of a book: its title,
byline, words, pictures and the reader's highlights, running on from page
to page, then a credit line, "From Reading Room, by Asha Rao, 20 Oct 2026.
The original: https://…", so the paper says where it came from (the second
floor). Nothing of the app's own is printed: no sidebar, list, toolbar,
buttons, players or Write back. With no article open, the page prints as it
looks. The credit line is only on paper; on screen the byline and View
original already say it.

**How.** `web/src/print.css`, a print style sheet: every element that
neither holds the article nor is inside it is hidden (`:has()`), and what
holds it lets it run on (no fixed heights or scrolling). The credit line is
`.print-credit` in `ArticleView.svelte`, hidden on screen.
`web/tests/print.spec.ts` checks it in Chromium's print mode.
