# 0221: One sheet of paper, one desk

*9 November 2026.*

Rohit's pick (suggestion 2) from a design critique an agent wrote following
Kenya Hara's published way of working (not by him), asked for on
9 November 2026.

**What changed.** The article list sits on the page itself, in the same
color as the article (White, Paper or Night), not on a tone one step off
it. On a computer the 1px line where the list meets the article (decision
0054) parts them; the sidebar stays toned. On a phone the list and the
article you open from it are now the same page. The selection pill in the
list is the text color mixed into the page (8% by day, 12% by night), so
`--tint-list` is now `#ECECEC` on White, `#E6E2D9` on Paper and `#2C2C2C`
on Night. The note at the list's foot sits on a band of the page too. The
welcome's cards (the feeds a site offers, what was found, the two tiles)
are grouped cards a tone off the page everywhere, so the special case for
the welcome "on the list's grey" is gone.

**What stays.** The `--list` tone (one step off the page) is still used
where something sits *in* a page: code blocks in an article, the ground
behind a phone's sheets, and grouped rows' fallback. The sidebar's tone,
the pane line and the pill's look are unchanged.

**Why.** The list's grey (`#F7F7F7` on White) was so close to the page that
it didn't read as a region of its own, only as slightly dull paper, and on
a phone the paper changed under the reader every time they went from the
list to an article. Two materials with one clear edge, the desk and the
paper, read more plainly than three nearly equal tones (principles 3 and
10). Contrast only improves: every text color now sits on the page, and
`contrast.test.ts` checks the new pill against the page.
