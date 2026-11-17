# 0297: A writer's pull quote keeps its mark and is set big

**In one line:** The cleaning keeps one class name on a block, `pull-quote`, for the pull-quote marks Substack, WordPress and Ghost write, and the article shows it in the title's face, centred, half again the text's size, between two short rules like the byline's.

*17 November 2026. Found while choosing quotations (decision 0296): every version the owner saw on his Substack articles showed the pull quote fixed this way, and he chose version 2 with it. Built as its own change because it touches the cleaning.*

**The problem.** A pull quote is a line the writer repeats big to catch the eye. The cleaning dropped every class name, so it showed as an ordinary paragraph repeating a sentence from just above or below, which looks like our mistake.

**What changes.**
1. `feed::clean` turns a known pull-quote mark into `class="pull-quote"`: Substack's `pullquote` on a `div`, WordPress's `wp-block-pullquote` on a `figure` (or a `blockquote` in older posts) and Ghost's alternative quote, `kg-blockquote-alt`. Any other class on those blocks is dropped with its attribute, so every other article is cleaned exactly as before.
2. `web/src/article-text.css`: the title's face at regular weight, 1.4 times the text (1.25 on a phone, so a heading still leads), centred, balanced lines, a 2.5rem rule in `--strong` above and below; a WordPress pull quote's inner quotation loses its line; a named source under it at a caption's size in the second ink; italics inside it in the text face's own italic, as in headings.

**Why.** We show only what the feed contains, as the writer meant it. Some readers delete pull quotes as repeats; that hides a choice the writer made. Big, centred and between rules is how Substack, WordPress and magazines set them, and the byline's short rule ties it to the rest of the page. A newsletter that arrives by email still loses every class (its tidying drops them), so its pull quote stays a plain paragraph.

**Considered.** Deleting pull quotes as repeats (Readability's way): hides the writer's choice. Showing them as an ordinary quote: two quote looks for one thing, and still reads as a repeat.

**Revisit if** another blog tool with many writers marks pull quotes its own way.
