# 0218: Dates in words, a summary only when it is one, list numbers in the margin

**In one line:** Dates say Today, Yesterday, the weekday for the past week, then 20 Oct (exact time in the tooltip); an RSS description is the whole article unless it ends in … or […] or has a Read more link; a summary's note links "Read the rest on {publisher} ↗"; on a computer an article's list numbers hang in the margin

*9 November 2026.*

Three of Rohit's picks (R4-3, R4-1 and R4-5) from a design critique an
agent wrote following Oliver Reichenstein's published principles (not by
him), asked for on 9 November 2026.

**1. Dates in words.** An article's date, in the list, under its title, in
Start reading and on a person's page, says the day the way a person would:
"Today", "Yesterday", the weekday for the rest of the past week
("Thursday"), then "20 Oct" this year and "20 Oct 2025" before. The exact
day and time is in the tooltip ("Sunday, 8 November 2026 at 06:00"). Days
are counted by the calendar in the reader's time zone. A sentence that
names a moment later today ("The site asked nine turtles to wait until
20:30") keeps the clock time. *Why:* today's articles showed a clock time
with a leading zero ("06:00", "00:00"); nobody reading a blog needs the
minute it arrived, only whether it's new, and the interface face draws its
zero with a slash, so a friend's post looked like a line in a log. The
words never change in front of the reader: "Today" turns into "Yesterday"
only when a list next loads. The exact time is only in the tooltip, so
a keyboard, touch or screen-reader reader doesn't get it: on purpose, since
the day is the information and the minute is shown to no one by default;
the tooltip is an extra for whoever wants it, not something hidden.

**2. A summary only when it is one.** Atom and JSON Feed keep a summary and
the full text apart, so a summary there is a summary. RSS has one place for
the text, `<description>`, which many blogs fill with the whole post. Until
now nine turtles called it a summary every time, so whole essays ended "Only
the beginning is shared here.", which wasn't true. Now an RSS description is
the article's text unless it shows it was cut: it ends in "…" or "[…]"
(WordPress's usual cut, even with its "The post … appeared first on …" line
after it), or it has a link saying "Read more", "Continue reading", "Keep
reading" or "Read the rest". Most readers don't try to tell (NetNewsWire
shows what the feed sends; Reeder, Feedbin, Inoreader, Miniflux and Readwise
offer to fetch the page, which the publisher floor rules out), so this is
nine turtles' own rule, written in `server/src/feed/whole.rs`. A whole
article ends with its closing rule and no note: the writer is already
credited under the title and by View original, so "First published on …"
isn't needed. A summary's note now links "Read the rest on {publisher} ↗",
with the open-in-new-tab arrow rather than "›", which means a place inside
the app. Articles already stored are put right the next time their feed changes
(usually with its next post), for those the feed still lists.

**3. List numbers in the margin.** On a computer, an article's own lists hang
their numbers and bullets in the margin, so a list's words start on the
same left edge as every paragraph, as a carefully set book does. On a phone
the 20px margin has no room, so they stay inside, and a list inside a list
always does. Write back stays centred (Rohit's choice).
