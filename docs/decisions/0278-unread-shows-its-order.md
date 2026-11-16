# 0278: Unread shows how it's arranged, quietly

**In one line:** In Unread each name has the day that placed it right beside it ("Simon Willison  Today"), "People" and "Publications" are matching quiet labels, titles get more room (16px above and below), the unread dot everywhere is smaller (6px) and a softened accent held to 3 : 1, and every list is centred beside the sidebar; the order itself is unchanged.

*16 November 2026. The owner asked how Unread is sorted, what takes precedence, and why All articles isn't sorted the same, then chose this from pictures over several rounds.*

**What the owner saw.** Unread (decision 0271) lists people before
publications, people by their newest unread article, and each person's
articles together. None of that showed, so someone who posted an hour ago
and a month ago put the month-old article above another person's from last
week, with nothing to say why. The owner didn't want readers to have to
guess the rules, but to see at a glance how the list is arranged; and found
the first builds cluttered (a label, a name, "latest today" and a day, four
layers before a title), the far-right days making the eye cross the page,
and the dot and day too loud.

**Choices shown:** every article strictly by time; days first; a person's
week together with older apart; and keeping the order but showing it. The
owner chose to keep the order and show it, then trimmed it to this.

**Decision.**
1. **The day beside each name**, 12px after it, in the rows' date type and
   the dates' grey (`--faint`): "Today", "Saturday", "14 Oct" (decision
   0218's words; their oldest unread's day when sorting oldest first). It
   is the day of the first title under the name, which is always the one
   that placed them, so the screen reads it from that article; no server
   change. Its exact time is its tooltip; a screen reader hears it with the
   name's heading. Reading down the names shows the order; no "latest"
   words. Rows still show no day (decision 0277).
2. **"People" and "Publications"**, matching quiet labels: the meta size,
   regular, in the dates' grey. Both `h3`; every name `h4` under its label.
3. **Room:** titles 16px above and below each other, the first 20px under
   its name, 40px between people, the labels 48px above (16px at the top)
   and 8px over the first name.
4. **The unread dot, everywhere a row has one,** is 6px (was 8px) in the
   accent softened (`--unread-dot`: White #6d86b6, Paper #9e6e2e, Night
   #667ca2), each at least 3 : 1 on the page, the list and the selected
   row's tint, so it still clearly marks unread for everyone (under a name
   it is the one sign besides what a screen reader hears). High-contrast
   modes still draw it in the text color. The sidebar's Unread dot keeps
   the full accent: on the sidebar's selected pill the softened one would
   fall below 3 : 1.
5. **Every list, and Settings and Everyone you follow, is centred in the
   area beside the sidebar** (the owner, comparing both on his Mac): its
   column stays as wide as an opened article's (decision 0277) but no
   longer starts where the article will; with the sidebar showing, an
   opened article (alone in the window, decision 0275) starts about 128px
   further left. The owner chose a balanced list, the screen read most,
   over that line-up; with the sidebar hidden they still line up. Settings,
   Everyone you follow and the pages under Settings centre their own
   column (560px for Settings) in the same area.
6. **Unchanged:** the order, All articles and every other list's order,
   offline Unread, the weekly email and assistants.

**Why All articles stays a timeline.** It holds read articles too; grouped
by person, one busy writer's hundreds of old articles would sit in one block
above everyone else. Unread is what's waiting for you, by who; All articles
is what arrived, by when.

**Revisit** if readers still find the order surprising when far behind:
setting a person's week apart from their older articles builds on this
without undoing it.
