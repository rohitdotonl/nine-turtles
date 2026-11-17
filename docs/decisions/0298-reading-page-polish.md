# 0298: The whole reading page polished: pauses, pictures, media, code, a calmer bar and a softer ending

**In one line:** The article page gets room in three steps, a short section break and a ◆ end mark, pictures and code up to 5rem wider on a computer, a dark video screen, quiet chapters, code that keeps its lines, a top bar of View original ↗, Share, Save and More that stays and names the article, and a softer Write back with no address under it.

*17 November 2026. Tracker item 10 ("it doesn't look so polished"). The owner saw ten whole-page versions on nine real articles of every format (essay, notes, a link post, YouTube, a podcast, pictures, an email newsletter, code) and picked these parts one by one; then chose ending A of four.*

**What changes.**
1. **Names.** A feed's name loses an email address in brackets after it ("Every (reader@example.com)" is "Every"; `feed::tidy_name`, tidied for followers at the next check as 0260 does). An author whose name is the source's spelled a letter or two differently is said once ("Ana Rodrigues in Ana Rodriguez"; names of six letters or more only, `byline.ts`). Never cut words after a colon: a feed called "Simon Willison's Weblog: blogging" keeps it, as cutting would also cut real names.
2. **No address on the article's page.** Under Write back nothing names who it goes to: an address printed there travels with every screenshot and shared screen. Screen readers still hear "Write back to {name}". Replaces 0183's "to Hal Brennan, hal@example.com" line.
3. **Plain zeros** in YouTube chapter times and the podcast player (the open "crossed zero" to-do, for these places).
4. **A link post's way on** ("Read the rest on {publisher} ↗") is the page's one main button, filled in a deep tone of the ink.
5. **Pauses** (`pauses.ts`, `article-text.css`): room in three steps (0.8em, 1.75em around pictures, quotations, code and tables, 2.5em around a break); a section break is the byline's short rule, and a typed one ("------", "* * *") is drawn the same, its marks kept but hidden; a ◆ after the writer's last words (or after a last picture), drawn by CSS so it's never copied, highlighted or read, never on a summary or a video's description. Only classes change, so highlights and the reading place, which count letters, never move.
6. **Pictures and code given room:** up to 5rem past the text each side, only as far as the pane has free (a container query), never past a picture's own size. Captions in the interface's small type, centred (replaces 0053's serif caption).
7. **Video and podcast:** the video waits on a dark screen in every theme with "Nothing loads from YouTube until you press Play." No picture of the video is fetched (the owner kept the privacy floor as it is). Chapters in the reading face, two columns, quiet times. The podcast panel gets a fine edge.
8. **Code keeps each line whole** on a soft tint, with an edge shadow while there's more to scroll. Wrapping was drawn and dropped: Python's indentation is meaning.
9. **The bar:** on a computer View original ↗ in words, then Share, Save and More (refined the same day by 0299: two and two, Share in More). Write back leaves every bar, the phone's toolbar too: it ends the article, is on their page, and `w` starts it (replaces 0214's paper plane).
10. **The bar stays** on a computer (replaces 0263) and, once the title has scrolled up under it, names the article and its source over a hairline (0299: the title alone, in the true middle), fading in over 0.15 seconds (an exception to "no motion", in `fadeIn.ts`, none with reduced motion; DESIGN.md → Exceptions log).
11. **The ending (A):** Save and View original in the muted grey; Write back small and soft (a faint edge, the second ink), still 44px tall.

**Considered and declined by the owner.** One row of three same-size end buttons; a publisher's sign-off set as small print and a "Next" title at the end; a magazine look (a section label over the title, no portrait, much wider media, reading time). Fetching a video's picture through our server.

**Revisit if** the ◆ lands somewhere odd often (a newsletter ending on a Subscribe link), or the running title crowds the bar at very large text sizes.
