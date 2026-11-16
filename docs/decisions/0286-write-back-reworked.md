# 0286: Write back, reworked: Copy address, Comments, and off for one person

**In one line:** Write back stays the one private way to answer; the line under it ends in Copy address; an article whose feed says where its comments are gets a quiet Comments link beside View original (on a phone, Open comments in More); and a person's settings get a Write back switch that takes it away from them.

*16 November 2026. The owner asked for three ways at an article's end (write back, copy the email, comment or go to the article, for Substack or YouTube) and a way to switch writing back off per person. Shown a choice, he pointed out that a Substack reader may want to email the writer too, that View original already is the comment button, and that the answer must work for any platform, not a list of them.*

**Why.** Three buttons at the end of every article would ask for a choice
each time a reader finishes (principle 1, nothing pulls). Most of what was
asked for is already there in another shape: View original opens the page
where comments are, and copying the address was behind "Didn't open?". So
the change makes what exists findable, and adds only what's missing.

**Decision.**
1. **Copy address** ends the line that shows the address, at an article's
   end and on their page, so it's never folded away.
2. **Comments** only when the feed itself names where an article's comments
   are: RSS's `<comments>`, or an Atom `rel="replies"` link to a web page
   (kept in `articles.comments_url`, read by feed-rs, which nine turtles
   already uses). Never a feed of comments, never the article's own
   address, never a list of platforms. It's the publisher's own page, only
   ever linked to (the second floor). Where a feed doesn't say, View
   original is the way to the comments.
3. **A Write back switch per person** (`subscriptions.write_back_off`,
   kept on every place of the person as the typed address is). Off, they
   are written to nowhere in nine turtles, but stay a person, unlike
   "A publication". Joining people keeps it off if any was off; separating
   a source turns it back on for that source; Undo of either puts it back.
4. **Comments' icon** is a speech bubble (BRAND.md → Icons).

**Not chosen.** A per-person "Email / Comments / Off" choice with one
button (one way per person): a Substack reader may want both. Naming
Substack or YouTube in the code: it wouldn't reach other platforms.
