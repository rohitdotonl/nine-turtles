# 0215: Their page says each thing once, and every date is "20 Oct"

*9 November 2026. The owner's picks from the Dieter Rams critique (D02-5).*

**Decision.**

1. **No Lately on their page** (SPEC section 36), on a computer or a phone.
   Their three newest pieces repeated their list, which sits beside the page
   on a computer and one step back on a phone. Your highlights from their
   writing stay.
2. **Edit is a quiet underlined word** beside their name (the `text-link`
   style, 44px tall), not a bordered button, so **Write to** is the page's
   one strong button.
3. **Every date in the app has one form: "20 Oct"**, and "20 Oct 2025" for
   another year: an article's time, Everyone you follow, Not working, a
   paused or quiet feed, passkeys, your plan, the admin pages. Months are
   always three letters, September too ("29 Sep", not the browser's "Sept").
   The one way to write a date lives in `web/src/lib/times.ts`.

**Why.** Saying the same thing twice on one screen is noise, and two strong
buttons compete for what the page is for, writing to them. Two date forms
("20 Oct" in lists, "20 October" elsewhere) were one more thing to read.

**Not changed.** The slashed zero in dates (the interface typeface's own)
is on the owner's to-do list; it needs a new font file.
