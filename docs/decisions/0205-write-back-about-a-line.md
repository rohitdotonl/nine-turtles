# 0205: Write back about a line

**In one line:** Words chosen or a highlight pressed offer Write back about this (people only): the email starts with those words quoted; Write back starts with every highlight in the article and says so under the address

*6 November 2026.*

**Decision.** The small menu beside words chosen in an article, and the
one beside a highlight pressed, end with **Write back about this**, under
a hairline, for a person's article (never a publication's). It opens the
reader's email app as Write back does, with the email's body starting
with those words quoted ("> " at the start of each line, a blank line
after). Write back itself starts the email with every highlight the
reader made in the article, and says so under the address: "Your email
starts with the words you highlighted." Quotes past 1,500 characters, as
written into the link, are left out so the link stays one email apps take
(some refuse much past 2,000); a first quote too long by itself keeps its
first words, ending "…", so the email never starts empty under that line. The owner chose
this on 6 November 2026 from the "aha" mockups (idea 2), and said ship it.

**Why.** Writing back is the half of nine turtles a newcomer doesn't
expect. Answering one line someone wrote, quoted as letters and emails
always have, is the smallest step from reading to writing, and it uses
what the reader already did (highlighting) instead of asking for more.

**How.** Only the web app changes: `writeBack.ts` builds the `mailto:`
link with a `body`, `ArticleMarks` hands its quotes to `WriteBack`, and
`HighlightMenu` gains the one item. Nothing is stored or sent by nine
turtles; SPEC sections 37 and 42.
