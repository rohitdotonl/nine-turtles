# 0215: Their page says each thing once, and every date is "20 Oct"

**In one line:** Their page drops Lately (their list already shows their newest) and Edit becomes a quiet underlined word; every date in the app reads "20 Oct" ("20 Oct 2025" another year), months always three letters

*9 November 2026. The owner's picks from the Dieter Rams critique (D02-5).*

**Decision.**

1. **No Lately on their page** (SPEC section 36), on a computer or a phone.
   Their three newest pieces repeated their list, which sits beside the page
   on a computer and one step back on a phone. Your highlights from their
   writing stay.
2. **Edit is a quiet underlined word** beside their name (the `text-link`
   style, small to the eye but 44px tall and wide to touch, as Forgot? on the
   sign-in page), not a bordered button, so **Write to** is the page's
   one strong button.
3. **Every date in the app has one form: "20 Oct"**, with its year after it
   ("20 Oct 2025") when it isn't this year: an article's time, Everyone you
   follow, Not working, a paused or quiet feed. Things that last always carry
   their year, this year too: passkeys, your plan, a connected assistant, the
   admin pages' readers and backups ("Passkey added 27 Oct 2026"). Months are
   always three letters, September too ("29 Sep", not the browser's "Sept").
   Every date is written by `web/src/lib/times.ts` (`when`, `dayOrToday`,
   `date`, `dateOrToday`, `dayAndTime`); nothing else formats one.
   *Revised by decision 0232: the order ("20 Oct" or "Oct 20") and the
   clock follow the device.*

**Why.** Saying the same thing twice on one screen is noise, and two strong
buttons compete for what the page is for, writing to them. Two date forms
("20 Oct" in lists, "20 October" elsewhere) were one more thing to read.

**Not changed.** The slashed zero in dates (the interface typeface's own)
is on the owner's to-do list; it needs a new font file.
