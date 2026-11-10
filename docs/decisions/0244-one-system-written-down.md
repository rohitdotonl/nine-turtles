# 0244: One system, written down and checked

**In one line:** One system, written down and checked: DESIGN.md → "The system" is the whole system on one page and `scripts/check-system.mjs` fails anything outside it; three interface text sizes, one title size (24px), one label for every group (replacing 0123 and 0198's small capitals), icons at two sizes with one line, two corners and one shadow, one top for every phone screen

*10 November 2026.*

Rohit's "Implement all of your suggestions" (10 November 2026), for the
fresh structure-and-discipline critique (`critique-24/structure-discipline-2.html`,
in the project's files). Principle 10 asks for a small set of rules, written
down so they keep being followed. The app had the rule ("one system") but
not the system: it lived in a dozen separate bullets, and nothing checked it.
So, counted on 10 November: 11 interface text sizes, 4 sizes for a place's
title, 4 ways to label a group, 3 ways to build a phone screen's top, icons
at 6 sizes with their lines from 1.0 to 1.65px, 11 corner roundings and 4
shadows on things that float.

**Decision.**

1. **The system on one page.** `DESIGN.md` → "The system" holds every
   spacing step, text size, title size, the label, both icon sizes, the
   corners, the shadow, the grey tones and the phone's top, each named
   exception with its reason. The spacing scale is 4, 8, 12, 16, 20, 24,
   32, 40, 48 and 64px (20 and 40 are the page edges on a phone and a
   computer, the critic's own amendment).
2. **The computer checks it.** `scripts/check-system.mjs` (in
   `scripts/check.sh frontend`) fails any change whose corner, shadow, text
   size, icon size or label isn't in the table, as the no-motion check does
   for animation. Older spacing values off the scale (193, most of them
   6px) and the 22 tones
   mixed from the ink are counted: no new one may appear, and the count is
   lowered in the same change that lowers it. Tailwind's own corners and
   shadows are switched off, as its text sizes already were.
3. **Three interface text sizes:** meta 13px, interface 15px and base 16px,
   with their touch twins 15, 17 and 16. The old small size (14px, buttons,
   helper text, the byline) joins meta, so on a touch screen it is now 15px
   rather than smaller than the meta line beside it. The sidebar's rows are the
   interface size with a mouse too (15px, were 14px), a step above the
   label over them.
4. **One title size:** every place's title is 24px, a person's name and the
   welcome's "Hello" too (were 28px), a phone sheet's (was 20px) and the
   list's title in a narrow pane (was 22px, now it ends in "…").
5. **One label for every group** (changing decisions 0123 and 0198, which
   chose small spaced capitals): the sidebar's, semibold words in full ink,
   sentence case, 13px (15 on a touch screen). Settings' groups, the
   welcome, a person's page ("Your highlights", "Source"), an article's end,
   the Aa panel and the sidebar all use it. Small capitals at 11px were the
   hardest text in the app to read. The welcome's example kinds (Blog,
   Newsletter, YouTube) are the small muted grey.
6. **One icon set, two sizes:** 16px beside a word and 20px alone in a
   button (18 and 22 on a touch screen), with the line held at 1.5px at
   every size. Named exceptions: the tick inside a tick box (14px), Add's
   two 36px drawings, and the players' own controls.
7. **Two corners and one shadow:** 8px for what you press or type in, 12px
   for what holds things, round for switches, chips and dots, 4px for small
   marks inside them; one shadow for everything that floats.
8. **One top for every phone screen:** Back at the very top in the top
   line's height, its arrow on the 20px edge, then the title on the line
   under it at 24px: a list, Settings and its pages, Everyone you follow, a
   person's page and a source's settings. A list's title keeps its 28px
   start for the unread dot and the keyboard's ring (decisions 0049, 0054),
   the table's one named exception.

**Not done, and why.** A 20px left edge on lists too (the dot would crowd
the focus ring); the reading sizes (the reader's own, through Aa); the
list's 12px dates (Rohit's choice, decision 0206, now a named exception).
Two parts of the critique are follow-ups, not done here: moving the 193
older gaps onto the scale (6px is written into several decisions, such as
a field's name 6px over it, decision 0122, so each needs a look), and
gathering the 22 grey tones into four named ones (each is held to a
contrast floor). The check already stops new drift in both. (Both done the same day: decision 0245.)

Visual only: no feature, wording or data changed, every button stays 44px,
every text keeps its contrast.
