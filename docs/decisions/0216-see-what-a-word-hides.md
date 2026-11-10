# 0216: See what a word will hide, and Start reading keeps its paragraphs

**In one line:** Settings › Hiding shows, as you type, how many unread articles a word would hide, the newest five and where the word is, before Add; Start reading shows a summary's first paragraph, never paragraphs run together (Start reading part replaced by 0220)

*Point 2 no longer applies: Start reading was removed by decision 0220.*

*9 November 2026. The owner asked for both ("Implement V3 and V6") from the
Bret Victor critique (`critique-24/designer-03-bret-victor.html` in the
project's files).*

**Decision.**

1. **Settings › Hiding shows what a word would hide before it's added**
   (SPEC section 27). As the reader types, a moment after typing rests,
   under the field: "“garden” would hide 5 unread articles." (or "matches
   nothing unread now."), then the newest five of them, each its title in
   the reading face and, in muted words, who wrote it and whether the word
   is "in the title" or "in the text", then "And 12 more." when there are
   more, and "Nothing is hidden until you press Add." Only the first line
   is spoken to screen readers, politely. It follows "Only from" when the
   field is for one person, and goes when the field empties (after Add
   too). It hides nothing and makes no word.
2. **Start reading's opening is the article's first paragraph, whether the
   feed sent the full text or only a summary** (SPEC section 7). A summary's
   paragraphs were run together ("…having dinner.There is…"); now its first
   paragraph is shown as the full text's is, and wherever text is joined,
   a block's end or a line break leaves a space.

**Why.** Victor's "immediate connection": a hiding word is a small rule the
reader writes, and they should see what it does while they write it, not
after (one word could quietly hide every post from a publication they chose
to follow). Undo stays, but the reader no longer decides blind. The
preview uses the very matching Add uses (`rules::matching_now`), so the two
never disagree. The run-together paragraphs changed the writer's words on
their way to the reader ("The writer comes first").

**Limits.** Read-only: `POST /api/rules/preview` reads the reader's unread
articles a batch at a time, outside any write, as Add's own matching does;
the screen asks once typing rests for 400 ms and never twice at once (the
latest word waits for the answer on its way), so a reader starts at most one
scan at a time, and a late answer for an older word is dropped. When it
can't say (offline, a word too long), it shows nothing. No colour, no motion: the list appears and changes only as the
reader types.
