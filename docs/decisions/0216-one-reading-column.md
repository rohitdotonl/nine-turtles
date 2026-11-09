# 0216: One column for the reading area

*9 November 2026. The owner's pick from the Massimo Vignelli critique (Vignelli 1).*

**Decision.** On a computer, everything the reading area shows hangs from
one column: an article, Start reading, and a person's page (with its Edit
pages). They share the article's left edge, right edge and line length,
its room for a scrollbar, and its first line just under the article's bar.
Start reading's small label sits above that line, so its title stands
exactly where the article's title will be: pressing Start reading moves
nothing. The column is one set of rules in `web/src/app.css`
(`.reading-column`, `--reading-top`, `.lead-pane`, `.scroll-gutter`).

**Why.** Before, each started somewhere else: the article 56px in, their
page 40px in and 10% down, Start reading 20px in, 18% down and wider than
the article. The same title jumped when Start reading opened it, and the
three read as three slightly different places. A grid that everything
hangs from is what makes an app feel built as one thing (principle 6,
Cohesive) and still when you act (principle 8).

**Not changed.** Phones: their screens already share one left edge. The
type sizes, words and buttons are unchanged.
