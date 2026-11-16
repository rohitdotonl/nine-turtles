# 0286: Write back, reworked: a split button with every way back, and off for one person

**In one line:** At an article's end Write back becomes a split button: an arrow beside it opens Email app, Gmail, Outlook.com, Copy their address and Comment on their site, and the way chosen becomes the main button for that person; a person's settings get a Write back switch that takes it away from them.

*16 November 2026. The owner asked for three ways at an article's end (write back, copy the email, comment or go to the article, for Substack or YouTube) and a way to switch writing back off per person. He pointed out that a Substack reader may want to email the writer too, that View original already is a way to the comments, and that the answer must work for any platform, not a list of them. Shown ten versions and then five more minimal ones, he chose the split button ("5"), with the email place remembered per device and the other ways per person, and the top bar and the end's Save and View original left as they are.*

**Why.** Three buttons at the end of every article would ask for a choice
each time a reader finishes (principle 1, nothing pulls). One button that
does what this reader does with this person, with every other way one press
behind its arrow, keeps the end as quiet as before (less, but better) while
nothing is hidden (power is findable, never in the way).

**Decision.**
1. **A split button** at an article's end: the main button and, joined by a
   hairline, a 44px arrow opening a menu (MoreMenu, its rows with icons):
   Email app, Gmail, Outlook.com, Copy {address} (only with an address),
   a hairline, Comment on their site. The current way is ticked. Choosing
   one does it at once.
2. **Remembered:** where email opens stays this device's choice (decision
   0259). Whether the main button writes an email, copies the address or
   opens the comments is kept for the person on the server
   (`subscriptions.write_back_way`: empty for email, `copy` or `comment`;
   on every place of theirs, as the typed address is), so it follows the
   reader to every device. The paper plane, `w`, a row's menu and Write
   back about this always write an email.
3. **Comments** are where the feed says: RSS's `<comments>`, or an Atom
   `rel="replies"` link to a web page (kept in `articles.comments_url`,
   read by feed-rs, which nine turtles already uses); never a feed of
   comments, never a list of platforms. Where the feed doesn't say, the
   article's own page, where comments usually are. Only ever linked to,
   never fetched (the second floor).
4. **A Write back switch per person** (`subscriptions.write_back_off`, on
   every place of the person). Off, they are written to nowhere in nine
   turtles, but stay a person, unlike "A publication". Joining people keeps
   it off if any was off and keeps the first way chosen; separating a source
   puts both back to the start for it; Undo of either puts them back.
5. **Icons** (BRAND.md → Icons): Copy address two overlapping pages,
   Comment a speech bubble, the arrow the chevron pointing down.

**Not chosen.** Three buttons in a row: a choice at every article's end.
A separate Comments link beside View original (tried first): two ways to
the same page. A sticky top bar so the end needs no Save and View original
(it reverses decision 0263, whose reason still holds). Naming Substack or
YouTube in the code: it wouldn't reach other platforms.
