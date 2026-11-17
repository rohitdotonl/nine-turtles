# 0300: A finer frame for every kind of post: a nameplate, finer players, one ending

**In one line:** Above an article's title a small nameplate in spaced capitals says what it is ("Video", "Episode") and where it's from; the video and the podcast player are drawn finer and as wide as pictures on a computer; a video's description sits a step smaller; and the ◆ alone ends the writer's words, with Save and View original under it in small capitals.

*17 November 2026. Tracker item 11 ("why the New Yorker feels posh"). The owner asked for a posh, New Yorker-like reading page, then turned down the magazine version (a rubric, drop cap, first line in capitals: "Don't make it a magazine") and asked for something that serves short notes, YouTube videos and podcasts as well as long essays. He saw ten versions on a long essay, a short note, a video and a podcast, then close-ups of the five suggested, and said "implement only 5". He also asked for the podcast player's 15 and 30, which touched their arrows, to be fixed.*

**What changes.**
1. **The nameplate.** One line above the title in the reading face's spaced capitals, at the meta size, in the second ink: "Video · " or "Episode · " when it's one, then the feed's name (a link, as the byline's was), or the site's own name when the feed is named for its person ("Mr. and Mrs. Psmith's Bookshelf" over "by John Psmith"). It's drawn above the title but comes after it in the page, so the title still takes the keyboard on opening and screen readers hear "Video from 3Blue1Brown" after it.
2. **The byline names the writer only.** "by {author}" or "by {the person the feed is named for}"; "in {feed}" is gone (the plate says it), and where the plate already says the only name there is, the byline is the day alone, so nothing is said twice. Refines 0294.
3. **Finer players.** On a computer a video and the podcast player use the spare width pictures do (up to 5rem past the text each side). The podcast player loses its tinted panel and rounded corners for two fine lines on the page (refines 0298). Its 15 and 30 are redrawn inside a larger circle with room to spare, in the interface's face.
4. **A video's notes.** Its description is set at 0.9 times the text, its chapters a step smaller under a fine line, so the video leads.
5. **One ending.** Where the ◆ ends the writer's words, the closing rule under it steps aside; Save and View original keep their icons, their words in the reading face's spaced capitals at the meta size.

**A rule changed.** DESIGN.md → "The system" said never small spaced capitals (decision 0244). The nameplate and the end's two words are named exceptions there and in `scripts/check-system.mjs`: they're the article's own furniture, in the reading face, not a group's label, which stays `.label`.

**Considered and declined.** The magazine (a rubric, the name in capitals, the first line in capitals, a drop cap, every section opening in capitals, a bigger title): it dresses the writer's words, a drop cap on "Hello," looks silly, and capitals override a writer's own lowercase. No lonely last word in every paragraph (`text-wrap: pretty`): tried and taken back in decision 0040, which keeps it for the last paragraph only. The day in full ("Thursday 1 October 2026"): undoes the short dates of 0294. The name in spaced capitals: magazine. Warm paper instead of white: colour is its own topic (tracker part C). No writer's picture at the top: undoes 0285.

**Revisit if** a feed's name is so long the plate wraps to three lines, or readers miss "in {feed}" in the byline.
