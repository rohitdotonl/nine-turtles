# 0245: Every gap on the scale, four grey tones

*10 November 2026.*

Rohit's "Yes, don't be lazy. Finish the work." (10 November 2026), on the
two follow-ups decision 0244 left: moving the app's older gaps onto the
spacing scale, and gathering its grey tones. Counted that day: 193 paddings,
margins and gaps off the scale (6px alone in about 100 places) and 22
different strengths of the text color used as greys.

**Decision.**

1. **Every gap is on the scale** (4, 8, 12, 16, 20, 24, 32, 40, 48, 64px).
   6px becomes 8px: a field's name now sits 8px over its field (decision
   0122 said 6), a field's helper line 8px under it (0052), a picture's
   caption 8px under it (0053), and a group's name 8px over the group, the
   critique's "label to its group: 8". 10px becomes 12 for padding and 8 for
   the space between an icon and its word, except in the sidebar, where it
   becomes 12 so the names' edge lands on 40px (it was 38); 14px becomes 12
   or 16; 18px becomes 16, so cards and grouped rows are 16px inside on every
   side. A list's row is 24px above its title and 24px below its line (it
   was 22 and 28, decision 0128), so the rows keep their air and their
   rhythm is on the scale. On a computer, the article and a person's page
   keep 64px of paper beside the text (it was 56). A close × beside a title
   is pulled 12px into the margin, so its drawing (20px in a 44px button)
   ends exactly on the page's edge.
2. **Room, not gaps.** 44px is allowed only as room kept for a 44px target
   beside words, and 96 and 192px only as a page's room above or below. Room
   measured from buttons (the article bar's pane buttons, the sidebar
   button, the password's Show) and the Play triangle's 2px optical nudge
   are named exceptions, in the table and the check, and so is the logo's
   9px beside the name (the owner's choice, DESIGN.md's Exceptions log).
3. **Four grey tones,** each the text color at one strength, named for its
   job: fill 5%, line 10%, strong 20%, edge 65%. The press, every hairline
   and card edge share the line tone; a field's fill is the fill tone, like
   the search field's; a field's edge, a chosen tile's edge and the
   keyboard's ring on rows are the edge tone (a field's edge was 55%, so it
   is a little clearer now). The main button stays the ink at 88% (decision
   0045) and is the full ink under the pointer (it was 96%). The pointer's
   tone, a chip's and the search field's fill were three names for nearly
   the same grey (5%, 7%, 6%); they are one, `--fill`. An open Aa or More
   button sits on the press's line tone, so it stays a step deeper than the
   pointer's. The underline under a link, a highlight or a searched word is
   the edge tone: at 45% the highlight's line fell just under 3 : 1 on White
   and Paper (2.99 and 2.82), and it is the sign that the words are marked,
   so it must reach 3 : 1 (the first floor); a test now holds it there.
4. **The check holds it.** `scripts/check-system.mjs` now fails any gap off
   the scale and any grey outside the four, including the text's own color
   (`currentColor`) mixed in, Tailwind's spelling (`in_srgb`) and Tailwind's
   faded ink (`bg-ink/10`), instead of only counting them. It lets 44, 96 and
   192px pass anywhere; the review checks they are room, not gaps.

**Why these strengths.** The accessibility checks (`contrast.test.ts`)
decided them: muted text must keep 4.5 : 1 on a pressed row in the sidebar,
which rules out a 12% press; a dark theme's grouped list must stay a clear
step off the page, which needs the line tone there; and the selection pill
must stay deeper than a row under the pointer, which rules out a 6% fill.

**Not changed.** Positions measured from other things (the list's 28px edge
and its unread dot, the top line's height, the safe area) stay as named
variables; the text sizes, corners and icons are decision 0244's.
